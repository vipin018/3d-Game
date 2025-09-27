import * as THREE from 'three';
import { GUI } from 'lil-gui';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

let scene, renderer, camera;
let group, followGroup, model, skeleton, mixer, clock;
let floor; // Global reference to floor mesh for texture updates
let fogUniforms, fogPlane;
let rainGroup;
let splashPool = []; // Pool for splash effects
let splashActive = []; // Track active splashes

let actions;

const settings = {
    show_skeleton: false,
    tone_mapping: 'ACESFilmic',
    fog_density: 0,
    fog_color: '#bfbfc0',
    fog_height: 20,
    fog_noise: true,
    fog_speed: 0.5,
    weather: 'autumn'
};

const PI = Math.PI;
const PI90 = Math.PI / 2;

const controls = {
    key: [0, 0, 0],
    ease: new THREE.Vector3(),
    position: new THREE.Vector3(),
    up: new THREE.Vector3(0, 1, 0),
    rotate: new THREE.Quaternion(),
    current: 'Idle',
    fadeDuration: 0.5,
    runVelocity: 5,
    walkVelocity: 1.8,
    rotateSpeed: 0.05,
    floorDecale: 0,
};

// Available tone mapping options
const toneMappingOptions = {
    'NoToneMapping': THREE.NoToneMapping,
    'Linear': THREE.LinearToneMapping,
    'Reinhard': THREE.ReinhardToneMapping,
    'Cineon': THREE.CineonToneMapping,
    'ACESFilmic': THREE.ACESFilmicToneMapping
};

init();

function init() {
    const container = document.getElementById('container');

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.frustumCulled = true;

    clock = new THREE.Clock();

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x5e5d5d);

    // Enhanced fog with height-based density
    scene.fog = new THREE.FogExp2(settings.fog_color, settings.fog_density);

    // Load HDRI
    const rgbeLoader = new RGBELoader();
    rgbeLoader.load('https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/tiber_island_1k.hdr', function (texture) {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        scene.environment = texture;
        // scene.background = texture;
    });

    group = new THREE.Group();
    scene.add(group);

    followGroup = new THREE.Group();
    scene.add(followGroup);

    // ambient light
    const ambLight = new THREE.AmbientLight(0xffffff, 1);
    scene.add(ambLight);

    // Directional Light (only light source)
    const dirLight = new THREE.DirectionalLight(0xffffff, 10);
    dirLight.position.set(-2, 5, 3);
    dirLight.castShadow = true;
    const cam = dirLight.shadow.camera;
    cam.top = cam.right = 2;
    cam.bottom = cam.left = -2;
    cam.bottom = cam.left = -2;
    cam.near = 3;
    cam.far = 8;
    dirLight.shadow.mapSize.set(512, 512);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.BasicShadowMap;
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setAnimationLoop(animate);
    renderer.toneMapping = toneMappingOptions[settings.tone_mapping];
    renderer.toneMappingExposure = 0.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.BasicShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    container.appendChild(renderer.domElement);
    renderer.compile(scene, camera);
    scene.add(dirLight);

    // Create ground floor for splashes
    createFloor();

    // Create volumetric fog plane
    createVolumetricFog();

    // Create rain system
    createRain();

    // Initialize splash pool
    initSplashPool();

    // Apply default weather
    onWeatherChange(settings.weather);

    // EVENTS
    window.addEventListener('resize', onWindowResize);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    // DEMO
    loadModel();
    const loader = new GLTFLoader();
    loader.load('models/city3.glb', function (gltf) {
        const model = gltf.scene;
        model.position.set(0, 1, 0);
        model.scale.set(0.01,0.01,0.01)
        scene.add(model);

        model.traverse(function (object) {
            if (object.isMesh) {
                object.castShadow = false;
                object.receiveShadow = true;
            }
        });
    });
}

function createFloor() {
    const geometry = new THREE.PlaneGeometry(200, 200);
    const material = new THREE.MeshLambertMaterial({ color: 0x333333 });
    floor = new THREE.Mesh(geometry, material);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    scene.add(floor);
}

function initSplashPool() {
    const splashCount = 100; // Number of splash effects to pool
    const splashGroup = new THREE.Group();
    scene.add(splashGroup);

    for (let i = 0; i < splashCount; i++) {
        const geometry = new THREE.CircleGeometry(0.1, 8); // Small circle for splash
        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0
        });
        const splash = new THREE.Mesh(geometry, material);
        splash.rotation.x = -Math.PI / 2;
        splash.scale.set(0, 0, 1);
        splashGroup.add(splash);
        splashPool.push(splash);
        splashActive.push(false);
    }
}

function createSplash(x, z) {
    // Find an inactive splash
    for (let i = 0; i < splashPool.length; i++) {
        if (!splashActive[i]) {
            const splash = splashPool[i];
            splash.position.set(x, 0.01, z); // Slightly above ground
            splash.material.opacity = 0.8;
            splash.scale.set(0.1, 0.1, 1);
            splashActive[i] = true;
            // Animate splash (will be updated in animate)
            break;
        }
    }
}

function updateSplashes(delta) {
    for (let i = 0; i < splashPool.length; i++) {
        if (splashActive[i]) {
            const splash = splashPool[i];
            // Expand and fade out
            splash.scale.multiplyScalar(1.1 + Math.random() * 0.2);
            splash.material.opacity -= delta * 3; // Fade quickly

            if (splash.material.opacity <= 0 || splash.scale.x > 1) {
                splashActive[i] = false;
                splash.material.opacity = 0;
                splash.scale.set(0.1, 0.1, 1);
            }
        }
    }
}

function createVolumetricFog() {
    // Create a box for volumetric fog effect to allow height variation
    const fogGeometry = new THREE.BoxGeometry(100, 20, 100);
    
    const fogMaterial = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            fogColor: { value: new THREE.Color(settings.fog_color) },
            fogDensity: { value: settings.fog_density },
            fogHeight: { value: settings.fog_height },
            cameraPosition: { value: new THREE.Vector3() },
            enableNoise: { value: settings.fog_noise },
            fogSpeed: { value: settings.fog_speed }
        },
        vertexShader: `
            varying vec2 vUv;
            varying vec3 vWorldPosition;
            void main() {
                vUv = uv;
                vec4 worldPos = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPos.xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float time;
            uniform vec3 fogColor;
            uniform float fogDensity;
            uniform float fogHeight;
            uniform vec3 cameraPosition;
            uniform bool enableNoise;
            uniform float fogSpeed;
            
            varying vec2 vUv;
            varying vec3 vWorldPosition;
            
            // Simple 3D noise function
            float hash(vec3 p) {
                p = fract(p * 0.3183099 + .1);
                return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
            }
            
            float noise(vec3 p) {
                vec3 i = floor(p);
                vec3 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);
                
                return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                               mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                           mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                               mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
            }
            
            void main() {
                // Height-based fog density (higher density at bottom)
                float localY = max(vWorldPosition.y, 0.0);
                float heightFactor = 1.0 - clamp(localY / fogHeight, 0.0, 1.0);
                float baseDensity = fogDensity * heightFactor;
                
                // Add animated 3D noise for volumetric effect and movement
                float noiseFactor = 1.0;
                if (enableNoise) {
                    vec3 noisePos = vWorldPosition * 0.05 + vec3(time * fogSpeed, 0.0, 0.0);
                    noiseFactor = noise(noisePos) * 0.5 + 0.5;
                }
                
                float finalDensity = baseDensity * noiseFactor;
                
                // Distance from camera (simplified)
                float dist = length(vWorldPosition - cameraPosition) * 0.01;
                float fogFactor = exp(-finalDensity * dist);
                fogFactor = 1.0 - clamp(fogFactor, 0.0, 1.0);
                
                gl_FragColor = vec4(fogColor, fogFactor * 0.8);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
        side: THREE.DoubleSide
    });

    fogPlane = new THREE.Mesh(fogGeometry, fogMaterial);
    fogPlane.position.y = 10; // Center the box at y=10 (bottom at y=0, top at y=20)
    scene.add(fogPlane);
    
    fogUniforms = fogMaterial.uniforms;
}

function createRain() {
    const rainCount = 35000;
    rainGroup = new THREE.Group();
    rainGroup.visible = false;

    for (let i = 0; i < rainCount; i++) {
        const points = [
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, -0.3, 0)
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: 0xffffff, // Explicit white
            transparent: true,
            opacity: 0.9
        });
        const line = new THREE.Line(geometry, material);
        line.position.x = (Math.random() - 0.5) * 200;
        line.position.y = Math.random() * 60 + 20;
        line.position.z = (Math.random() - 0.5) * 200;
        rainGroup.add(line);
    }

    scene.add(rainGroup);
}

function onWeatherChange(value) {
    switch (value) {
        case 'winter':
            settings.fog_density = 0.08;
            settings.fog_noise = true;
            scene.fog.density = settings.fog_density;
            if (fogUniforms) {
                fogUniforms.fogDensity.value = settings.fog_density;
                fogUniforms.enableNoise.value = settings.fog_noise;
            }
            if (rainGroup) rainGroup.visible = false;
            break;
        case 'rain':
            settings.fog_density = 0;
            scene.fog.density = settings.fog_density;
            if (fogUniforms) {
                fogUniforms.fogDensity.value = settings.fog_density;
            }
            if (rainGroup) rainGroup.visible = true;
            break;
        case 'autumn':
            settings.fog_density = 0;
            scene.fog.density = settings.fog_density;
            if (fogUniforms) {
                fogUniforms.fogDensity.value = settings.fog_density;
            }
            if (rainGroup) rainGroup.visible = false;
            break;
    }
}

function loadModel() {
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('three/examples/jsm/libs/draco/');
    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);
    const path = "models/Soldier.glb";
    loader.load(path, function (gltf) {
        model = gltf.scene;
        group.add(model);
        model.position.y = 0.8;
        model.rotation.y = PI;
        group.rotation.y = PI;

        model.traverse(function (object) {
            if (object.isMesh) {
                object.castShadow = true;
                object.receiveShadow = true;
            }
        });

        skeleton = new THREE.SkeletonHelper(model);
        skeleton.visible = false;
        scene.add(skeleton);

        createPanel();

        const animations = gltf.animations;
        mixer = new THREE.AnimationMixer(model);

        actions = {
            Idle: mixer.clipAction(animations[0]),
            Walk: mixer.clipAction(animations[3]),
            Run: mixer.clipAction(animations[1])
        };

        for (const m in actions) {
            actions[m].enabled = true;
            actions[m].setEffectiveTimeScale(1);
            if (m !== 'Idle') actions[m].setEffectiveWeight(0);
        }

        actions.Idle.play();
    });
}

function updateCharacter(delta) {
    const fade = controls.fadeDuration;
    const key = controls.key;
    const up = controls.up;
    const ease = controls.ease;
    const rotate = controls.rotate;
    const position = controls.position;
    const azimuth = 0;

    const active = key[0] !== 0 || key[1] !== 0;
    const play = active ? (key[2] ? 'Run' : 'Walk') : 'Idle';

    if (controls.current != play) {
        const current = actions[play];
        const old = actions[controls.current];
        controls.current = play;

        setWeight(current, 1.0);
        old.fadeOut(fade);
        current.reset().fadeIn(fade).play();
    }

    if (controls.current !== 'Idle') {
        const velocity = controls.current == 'Run' ? controls.runVelocity : controls.walkVelocity;
        ease.set(key[1], 0, key[0]).multiplyScalar(velocity * delta);
        const angle = unwrapRad(Math.atan2(ease.x, ease.z) + azimuth);
        rotate.setFromAxisAngle(up, angle);
        controls.ease.applyAxisAngle(up, azimuth);
        position.add(ease);
        // camera.position.add(ease);
        group.position.copy(position);
        group.quaternion.rotateTowards(rotate, controls.rotateSpeed);
        followGroup.position.copy(position);

        const offset = new THREE.Vector3(0, 2.3, -7);
        camera.position.copy(group.position).add(offset);
        camera.lookAt(group.position);
    }

    if (mixer) mixer.update(delta);
}

function unwrapRad(r) {
    return Math.atan2(Math.sin(r), Math.cos(r));
}

function createPanel() {
    const panel = new GUI({ width: 300 });

    const generalFolder = panel.addFolder('General');
    generalFolder.add(settings, 'show_skeleton').onChange(b => {
        if (skeleton) skeleton.visible = b;
    });
    generalFolder.add(settings, 'tone_mapping', Object.keys(toneMappingOptions)).onChange(value => {
        renderer.toneMapping = toneMappingOptions[value];
        renderer.compile(scene, camera);
    });
    generalFolder.add(renderer, 'toneMappingExposure', 0, 2, 0.01);

    const weatherFolder = panel.addFolder('Weather');
    weatherFolder.add(settings, 'weather', ['winter', 'rain', 'autumn']).onChange(onWeatherChange);


    const characterFolder = panel.addFolder('Character');
    characterFolder.add(controls, 'runVelocity', 0, 10, 0.1);
    characterFolder.add(controls, 'walkVelocity', 0, 10, 0.1);
    characterFolder.add(controls, 'rotateSpeed', 0, 0.2, 0.01);
}

function setWeight(action, weight) {
    action.enabled = true;
    action.setEffectiveTimeScale(1);
    action.setEffectiveWeight(weight);
}

function onKeyDown(event) {
    const key = controls.key;
    switch (event.code) {
        case 'ArrowDown': case 'KeyS': key[0] = -1; break;
        case 'ArrowUp': case 'KeyW': key[0] = 1; break;
        case 'ArrowRight': case 'KeyD': key[1] = -1; break;
        case 'ArrowLeft': case 'KeyA': key[1] = 1; break;
        case 'ShiftLeft': case 'ShiftRight': key[2] = 1; break;
    }
}

function onKeyUp(event) {
    const key = controls.key;
    switch (event.code) {
        case 'ArrowDown': case 'KeyS': key[0] = key[0] < 0 ? 0 : key[0]; break;
        case 'ArrowUp': case 'KeyW': key[0] = key[0] > 0 ? 0 : key[0]; break;
        case 'ArrowRight': case 'KeyD': key[1] = key[1] < 0 ? 0 : key[1]; break;
        case 'ArrowLeft': case 'KeyA': key[1] = key[1] > 0 ? 0 : key[1]; break;
        case 'ShiftLeft': case 'ShiftRight': key[2] = 0; break;
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    const delta = clock.getDelta();
    const time = clock.getElapsedTime();
    
    // Update shader uniforms
    if (fogUniforms) {
        fogUniforms.time.value = time;
        fogUniforms.cameraPosition.value.copy(camera.position);
    }

    // Animate rain if visible
    if (rainGroup && rainGroup.visible) {
        const fallSpeed = 0.6 + Math.random() * 0.2;
        rainGroup.children.forEach(line => {
            line.position.y -= fallSpeed;
            if (line.position.y < 0) {
                // Create splash at impact position
                createSplash(line.position.x, line.position.z);
                // Reset drop
                line.position.y = 60 + Math.random() * 20;
                line.position.x = (Math.random() - 0.5) * 200;
                line.position.z = (Math.random() - 0.5) * 200;
            }
        });
    }

    // Update splashes
    updateSplashes(delta);
    
    updateCharacter(delta);
    
    renderer.render(scene, camera);
}