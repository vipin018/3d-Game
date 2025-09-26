import * as THREE from 'three';

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { GUI } from 'lil-gui';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

let scene, renderer, camera;
let group, followGroup, model, skeleton, mixer, clock;
let floor; // Global reference to floor mesh for texture updates
let fogUniforms, fogPlane, postProcessing = {};

let actions;

const settings = {
    show_skeleton: false,
    tone_mapping: 'ACESFilmic',
    fog_density: 0.03,
    fog_color: '#212631',
    fog_height: 15,
    fog_noise: true,
    fog_speed: 0.5,
    enable_postfx: false,
    pixel_ratio: 2.0,
    scanlines: true,
    film_grain: true,
    bloom: true
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

    clock = new THREE.Clock();

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x5e5d5d);

    // Enhanced fog with height-based density
    scene.fog = new THREE.FogExp2(settings.fog_color, settings.fog_density);

    // Load HDRI
    const rgbeLoader = new RGBELoader();
    rgbeLoader.load('https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/autumn_field_puresky_1k.hdr', function (texture) {
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
    cam.near = 3;
    cam.far = 8;
    dirLight.shadow.mapSize.set(1024, 1024);
    followGroup.add(dirLight);
    followGroup.add(dirLight.target);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, settings.pixel_ratio));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setAnimationLoop(animate);
    renderer.toneMapping = toneMappingOptions[settings.tone_mapping];
    renderer.toneMappingExposure = 0.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    container.appendChild(renderer.domElement);
    renderer.compile(scene, camera);

    

    // Initialize post-processing
    initPostProcessing();

    // Create volumetric fog plane
    createVolumetricFog();



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

function createVolumetricFog() {
    // Create a large plane for volumetric fog effect
    const fogGeometry = new THREE.PlaneGeometry(100, 100, 1, 1);
    
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
            varying vec3 vPosition;
            void main() {
                vUv = uv;
                vPosition = position;
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
            varying vec3 vPosition;
            
            // Simple noise function
            float hash(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
            }
            
            float noise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);
                
                float a = hash(i);
                float b = hash(i + vec2(1.0, 0.0));
                float c = hash(i + vec2(0.0, 1.0));
                float d = hash(i + vec2(1.0, 1.0));
                
                return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
            }
            
            void main() {
                // Height-based fog density
                float heightFactor = 1.0 - clamp(vPosition.y / fogHeight, 0.0, 1.0);
                float baseDensity = fogDensity * heightFactor;
                
                // Add noise for volumetric effect
                float noiseFactor = 1.0;
                if (enableNoise) {
                    vec2 uv = vUv * 5.0 + time * fogSpeed * 0.1;
                    noiseFactor = noise(uv) * 0.5 + 0.5;
                }
                
                float finalDensity = baseDensity * noiseFactor;
                
                // Distance from camera (simplified)
                float dist = length(vPosition - cameraPosition) * 0.1;
                float fogFactor = exp(-finalDensity * dist);
                fogFactor = 1.0 - clamp(fogFactor, 0.0, 1.0);
                
                gl_FragColor = vec4(fogColor, fogFactor * 0.8);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending
    });

    fogPlane = new THREE.Mesh(fogGeometry, fogMaterial);
    fogPlane.rotation.x = -Math.PI / 2;
    fogPlane.position.y = 0.1; // Slightly above ground
    scene.add(fogPlane);
    
    fogUniforms = fogMaterial.uniforms;
}

function initPostProcessing() {
    // Create a simple post-processing shader pass
    postProcessing.scene = new THREE.Scene();
    postProcessing.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
    const postMaterial = new THREE.ShaderMaterial({
        uniforms: {
            tDiffuse: { value: null },
            time: { value: 0 },
            resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
            pixelRatio: { value: settings.pixel_ratio },
            scanlines: { value: settings.scanlines },
            film_grain: { value: settings.film_grain },
            grainIntensity: { value: 0.1 },
            bloom: { value: settings.bloom },
            bloomIntensity: { value: 0.3 }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform sampler2D tDiffuse;
            uniform float time;
            uniform vec2 resolution;
            uniform float pixelRatio;
            uniform bool scanlines;
            uniform bool filmGrain;
            uniform float grainIntensity;
            uniform bool bloom;
            uniform float bloomIntensity;
            
            varying vec2 vUv;
            
            // Film grain noise
            float grain(vec2 uv) {
                return fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453);
            }

            vec3 bloomEffect(vec3 color) {
                if (!bloom) return color;
                
                // Simple brightness threshold and blur
                float brightness = dot(color, vec3(0.2126, 0.7152, 0.0722));
                if (brightness > 0.7) {
                    color += color * bloomIntensity;
                }
                return color;
            }
            
            void main() {
                vec2 uv = vUv;
                vec4 color = texture2D(tDiffuse, uv);
                
                // Scanlines effect
                if (scanlines) {
                    float scanline = sin(uv.y * resolution.y * 3.14159 * 2.0) * 0.1 + 0.9;
                    color.rgb *= scanline;
                }
                
                // Film grain
                if (filmGrain) {
                    float grainValue = grain(uv + time) * grainIntensity;
                    color.rgb += grainValue - grainIntensity * 0.5;
                }

                // Bloom effect
                color.rgb = bloomEffect(color.rgb);
                
                // Pixelation effect based on pixel ratio
                if (pixelRatio < 1.0) {
                    vec2 pixelSize = 1.0 / resolution;
                    vec2 dxy = pixelSize * pixelRatio;
                    vec2 coord = dxy * floor(uv / dxy);
                    color = texture2D(tDiffuse, coord);
                }
                
                gl_FragColor = color;
            }
        `
    });
    
    postProcessing.plane = new THREE.PlaneGeometry(2, 2);
    postProcessing.quad = new THREE.Mesh(postProcessing.plane, postMaterial);
    postProcessing.scene.add(postProcessing.quad);
    
    postProcessing.uniforms = postMaterial.uniforms;
    
    // Create render target for post-processing
    postProcessing.rt = new THREE.WebGLRenderTarget(
        window.innerWidth, 
        window.innerHeight,
        {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat
        }
    );
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

    const fogFolder = panel.addFolder('Fog Settings');
    fogFolder.add(settings, 'fog_density', 0, 0.1, 0.001).onChange(value => {
        scene.fog.density = value;
        if (fogUniforms) fogUniforms.fogDensity.value = value;
    });
    fogFolder.addColor(settings, 'fog_color').onChange(value => {
        scene.fog.color = new THREE.Color(value);
        if (fogUniforms) fogUniforms.fogColor.value = new THREE.Color(value);
    });
    fogFolder.add(settings, 'fog_height', 1, 50, 1).onChange(value => {
        if (fogUniforms) fogUniforms.fogHeight.value = value;
    });
    fogFolder.add(settings, 'fog_noise').onChange(value => {
        if (fogUniforms) fogUniforms.enableNoise.value = value;
    });
    fogFolder.add(settings, 'fog_speed', 0, 2, 0.1).onChange(value => {
        if (fogUniforms) fogUniforms.fogSpeed.value = value;
    });

    const postFxFolder = panel.addFolder('Post Processing');
    postFxFolder.add(settings, 'enable_postfx');
    postFxFolder.add(settings, 'pixel_ratio', 0.5, 3, 0.1).onChange(value => {
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, value));
        if (postProcessing.uniforms) postProcessing.uniforms.pixelRatio.value = value;
    });
    postFxFolder.add(settings, 'scanlines').onChange(value => {
        if (postProcessing.uniforms) postProcessing.uniforms.scanlines.value = value;
    });
    postFxFolder.add(settings, 'film_grain').onChange(value => {
        if (postProcessing.uniforms) postProcessing.uniforms.filmGrain.value = value;
    });
    postFxFolder.add(settings, 'bloom').onChange(value => {
        if (postProcessing.uniforms) postProcessing.uniforms.bloom.value = value;
    });
    postFxFolder.add(postProcessing.uniforms.grainIntensity, 'value', 0, 0.2, 0.01).name('Grain Intensity');
    postFxFolder.add(postProcessing.uniforms.bloomIntensity, 'value', 0, 1, 0.01).name('Bloom Intensity');

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
    
    if (postProcessing.rt) {
        postProcessing.rt.setSize(window.innerWidth, window.innerHeight);
        postProcessing.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
    }
}

function animate() {
    const delta = clock.getDelta();
    const time = clock.getElapsedTime();
    
    // Update shader uniforms
    if (fogUniforms) {
        fogUniforms.time.value = time;
        fogUniforms.cameraPosition.value.copy(camera.position);
    }
    
    if (postProcessing.uniforms) {
        postProcessing.uniforms.time.value = time;
    }
    
    updateCharacter(delta);
    
    // Render with or without post-processing
    if (settings.enable_postfx) {
        // First pass: render scene to render target
        renderer.setRenderTarget(postProcessing.rt);
        renderer.render(scene, camera);
        
        // Second pass: render post-processing quad to screen
        renderer.setRenderTarget(null);
        postProcessing.uniforms.tDiffuse.value = postProcessing.rt.texture;
        renderer.render(postProcessing.scene, postProcessing.camera);
    } else {
        // Direct rendering without post-processing
        renderer.setRenderTarget(null);
        renderer.render(scene, camera);
    }
}