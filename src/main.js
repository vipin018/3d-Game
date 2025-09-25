import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'lil-gui';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { FlyControls } from 'three/examples/jsm/controls/FlyControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

let scene, renderer, camera, orbitControls, flyControls;
let group, followGroup, model, skeleton, mixer, clock;

let actions;

const settings = {
    show_skeleton: false,
    control_mode: 'Orbit'
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

init();

function init() {
    const container = document.getElementById('container');

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 2, -5);

    clock = new THREE.Clock();

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x5e5d5d);

    const environment = new RoomEnvironment();
    scene.environment = environment;

    group = new THREE.Group();
    scene.add(group);

    followGroup = new THREE.Group();
    scene.add(followGroup);

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 5);
    dirLight.position.set(-2, 5, -3);
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
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setAnimationLoop(animate);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.5;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    container.appendChild(renderer.domElement);
    renderer.compile(scene, camera);

    orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.target.set(0, 1, 0);
    orbitControls.enableDamping = true;
    orbitControls.enablePan = false;
    orbitControls.maxPolarAngle = PI90 - 0.05;
    orbitControls.update();

    flyControls = new FlyControls(camera, renderer.domElement);
    flyControls.enabled = false;

    const textureLoader = new THREE.TextureLoader();
    const diffuseMap = textureLoader.load('textures/floor/aerial_rocks_02_diff_1k.jpg');
    const normalMap = textureLoader.load('textures/floor/aerial_rocks_02_nor_gl_1k.jpg');
    const roughnessMap = textureLoader.load('textures/floor/aerial_rocks_02_rough_1k.jpg');
    const aoMap = textureLoader.load('textures/floor/aerial_rocks_02_arm_1k.jpg');
    const displacementMap = textureLoader.load('textures/floor/aerial_rocks_02_disp_1k.jpg'); // Fixed displacement map

    const floorMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: diffuseMap,
        normalMap: normalMap,
        roughnessMap: roughnessMap,
        aoMap: aoMap,
        displacementMap: displacementMap,
        displacementScale: 0.2, // Default value
        displacementBias: 0 // Default value
    });

    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(50, 50, 100, 100),
        floorMaterial
    );
    floor.geometry.attributes.uv2 = floor.geometry.attributes.uv;
    floor.name = 'floor';
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    addRandomGeometries();

    // EVENTS
    window.addEventListener('resize', onWindowResize);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    // DEMO
    loadModel();
}

function loadModel() {
    const loader = new GLTFLoader();
    const path = "models/Soldier.glb";
    loader.load(path, function (gltf) {
        model = gltf.scene;
        group.add(model);
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

function addRandomGeometries() {
    const textureLoader = new THREE.TextureLoader();
    const boxDiffuseMap = textureLoader.load('textures/box/concrete_floor_02_diff_1k.jpg');
    const boxNormalMap = textureLoader.load('textures/box/concrete_floor_02_nor_gl_1k.jpg');
    const boxRoughnessMap = textureLoader.load('textures/box/concrete_floor_02_rough_1k.jpg');
    const boxAoMap = textureLoader.load('textures/box/concrete_floor_02_arm_1k.jpg');
    const boxDisplacementMap = textureLoader.load('textures/box/concrete_floor_02_disp_1k.jpg');

    for (let i = 0; i < 20; i++) {
        const size = Math.random() * 1 + 0.2;
        const geometry = new RoundedBoxGeometry(size, size, size, 10, 0.1);
        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            map: boxDiffuseMap,
            normalMap: boxNormalMap,
            roughnessMap: boxRoughnessMap,
            aoMap: boxAoMap,
            displacementMap: boxDisplacementMap,
            displacementScale: 0.05, // Default value
            displacementBias: 0 // Default value
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.geometry.attributes.uv2 = mesh.geometry.attributes.uv; // Required for aoMap
        const yPos = size / 2;
        mesh.position.set(Math.random() * 40 - 20, yPos, Math.random() * 40 - 20);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.name = 'box' + i; // Name for GUI access
        scene.add(mesh);
    }
}

function updateCharacter(delta) {
    if (flyControls.enabled) {
        if (mixer) mixer.update(delta);
        orbitControls.update();
        return;
    }

    const fade = controls.fadeDuration;
    const key = controls.key;
    const up = controls.up;
    const ease = controls.ease;
    const rotate = controls.rotate;
    const position = controls.position;
    const azimuth = orbitControls.getAzimuthalAngle();

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
        camera.position.add(ease);
        group.position.copy(position);
        group.quaternion.rotateTowards(rotate, controls.rotateSpeed);
        orbitControls.target.copy(position).add({ x: 0, y: 1, z: 0 });
        followGroup.position.copy(position);
    }

    if (mixer) mixer.update(delta);
    orbitControls.update();
}

function unwrapRad(r) {
    return Math.atan2(Math.sin(r), Math.cos(r));
}

function createPanel() {
    const panel = new GUI({ width: 310 });

    const generalFolder = panel.addFolder('General');
    generalFolder.add(settings, 'control_mode', ['Orbit', 'Fly']).onChange(mode => {
        if (mode === 'Orbit') {
            orbitControls.enabled = true;
            flyControls.enabled = false;
            if (model) model.visible = true;
        } else {
            orbitControls.enabled = false;
            flyControls.enabled = true;
            if (model) model.visible = false;
        }
    });
    generalFolder.add(settings, 'show_skeleton').onChange(b => {
        if (skeleton) skeleton.visible = b;
    });
    generalFolder.add(renderer, 'toneMappingExposure', 0, 2, 0.01);

    const characterFolder = panel.addFolder('Character');
    characterFolder.add(controls, 'runVelocity', 0, 10, 0.1);
    characterFolder.add(controls, 'walkVelocity', 0, 10, 0.1);
    characterFolder.add(controls, 'rotateSpeed', 0, 0.2, 0.01);

    const lightFolder = panel.addFolder('Lights');

    const ambientLight = scene.getObjectByProperty('type', 'AmbientLight');
    const ambientFolder = lightFolder.addFolder('Ambient Light');
    ambientFolder.add(ambientLight, 'visible');
    ambientFolder.add(ambientLight, 'intensity', 0, 5, 0.1);
    ambientFolder.addColor(ambientLight, 'color');

    const dirLight = scene.getObjectByProperty('type', 'DirectionalLight');
    const dirFolder = lightFolder.addFolder('Directional Light');
    dirFolder.add(dirLight, 'visible');
    dirFolder.add(dirLight, 'intensity', 0, 10, 0.1);
    dirFolder.addColor(dirLight, 'color');

    const floor = scene.getObjectByName('floor');
    const floorFolder = panel.addFolder('Floor');
    floorFolder.add(floor, 'visible');
    floorFolder.addColor(floor.material, 'color');
    floorFolder.add(floor.material, 'metalness', 0, 1, 0.1);
    floorFolder.add(floor.material, 'roughness', 0, 1, 0.1);
    floorFolder.add(floor.material, 'wireframe');
    floorFolder.add(floor.material, 'displacementScale', 0, 5, 0.01);
    floorFolder.add(floor.material, 'displacementBias', -2, 2, 0.01);
    // Texture controls for floor
    const floorTextures = {
        diffuseMap: true,
        normalMap: true,
        roughnessMap: true,
        aoMap: true,
        displacementMap: true
    };
    const floorTextureFolder = floorFolder.addFolder('Textures');
    floorTextureFolder.add(floorTextures, 'diffuseMap').name('Diffuse Map').onChange(v => {
        floor.material.map = v ? textureLoader.load('textures/floor/aerial_rocks_02_diff_1k.jpg') : null;
        floor.material.needsUpdate = true;
    });
    floorTextureFolder.add(floorTextures, 'normalMap').name('Normal Map').onChange(v => {
        floor.material.normalMap = v ? textureLoader.load('textures/floor/aerial_rocks_02_nor_gl_1k.jpg') : null;
        floor.material.needsUpdate = true;
    });
    floorTextureFolder.add(floorTextures, 'roughnessMap').name('Roughness Map').onChange(v => {
        floor.material.roughnessMap = v ? textureLoader.load('textures/floor/aerial_rocks_02_rough_1k.jpg') : null;
        floor.material.needsUpdate = true;
    });
    floorTextureFolder.add(floorTextures, 'aoMap').name('AO Map').onChange(v => {
        floor.material.aoMap = v ? textureLoader.load('textures/floor/aerial_rocks_02_arm_1k.jpg') : null;
        floor.material.needsUpdate = true;
    });
    floorTextureFolder.add(floorTextures, 'displacementMap').name('Displacement Map').onChange(v => {
        floor.material.displacementMap = v ? textureLoader.load('textures/floor/aerial_rocks_02_disp_1k.jpg') : null;
        floor.material.needsUpdate = true;
    });

    // Box material controls (apply to all boxes)
    const boxMaterial = scene.getObjectByName('box0').material; // Use first box's material for GUI
    const boxFolder = panel.addFolder('Boxes');
    boxFolder.addColor(boxMaterial, 'color');
    boxFolder.add(boxMaterial, 'metalness', 0, 1, 0.1);
    boxFolder.add(boxMaterial, 'roughness', 0, 1, 0.1);
    boxFolder.add(boxMaterial, 'wireframe');
    boxFolder.add(boxMaterial, 'displacementScale', 0, 5, 0.01);
    boxFolder.add(boxMaterial, 'displacementBias', -2, 2, 0.01);
    // Texture controls for boxes
    const boxTextures = {
        diffuseMap: true,
        normalMap: true,
        roughnessMap: true,
        aoMap: true,
        displacementMap: true
    };
    const boxTextureFolder = boxFolder.addFolder('Textures');
    boxTextureFolder.add(boxTextures, 'diffuseMap').name('Diffuse Map').onChange(v => {
        for (let i = 0; i < 20; i++) {
            const box = scene.getObjectByName('box' + i);
            box.material.map = v ? textureLoader.load('textures/box/concrete_floor_02_diff_1k.jpg') : null;
            box.material.needsUpdate = true;
        }
    });
    boxTextureFolder.add(boxTextures, 'normalMap').name('Normal Map').onChange(v => {
        for (let i = 0; i < 20; i++) {
            const box = scene.getObjectByName('box' + i);
            box.material.normalMap = v ? textureLoader.load('textures/box/concrete_floor_02_nor_gl_1k.jpg') : null;
            box.material.needsUpdate = true;
        }
    });
    boxTextureFolder.add(boxTextures, 'roughnessMap').name('Roughness Map').onChange(v => {
        for (let i = 0; i < 20; i++) {
            const box = scene.getObjectByName('box' + i);
            box.material.roughnessMap = v ? textureLoader.load('textures/box/concrete_floor_02_rough_1k.jpg') : null;
            box.material.needsUpdate = true;
        }
    });
    boxTextureFolder.add(boxTextures, 'aoMap').name('AO Map').onChange(v => {
        for (let i = 0; i < 20; i++) {
            const box = scene.getObjectByName('box' + i);
            box.material.aoMap = v ? textureLoader.load('textures/box/concrete_floor_02_arm_1k.jpg') : null;
            box.material.needsUpdate = true;
        }
    });
    boxTextureFolder.add(boxTextures, 'displacementMap').name('Displacement Map').onChange(v => {
        for (let i = 0; i < 20; i++) {
            const box = scene.getObjectByName('box' + i);
            box.material.displacementMap = v ? textureLoader.load('textures/box/concrete_floor_02_disp_1k.jpg') : null;
            box.material.needsUpdate = true;
        }
    });
}

function setWeight(action, weight) {
    action.enabled = true;
    action.setEffectiveTimeScale(1);
    action.setEffectiveWeight(weight);
}

function onKeyDown(event) {
    const key = controls.key;
    switch (event.code) {
        case 'ArrowUp': case 'KeyW': case 'KeyZ': key[0] = -1; break;
        case 'ArrowDown': case 'KeyS': key[0] = 1; break;
        case 'ArrowLeft': case 'KeyA': case 'KeyQ': key[1] = -1; break;
        case 'ArrowRight': case 'KeyD': key[1] = 1; break;
        case 'ShiftLeft': case 'ShiftRight': key[2] = 1; break;
    }
}

function onKeyUp(event) {
    const key = controls.key;
    switch (event.code) {
        case 'ArrowUp': case 'KeyW': case 'KeyZ': key[0] = key[0] < 0 ? 0 : key[0]; break;
        case 'ArrowDown': case 'KeyS': key[0] = key[0] > 0 ? 0 : key[0]; break;
        case 'ArrowLeft': case 'KeyA': case 'KeyQ': key[1] = key[1] < 0 ? 0 : key[1]; break;
        case 'ArrowRight': case 'KeyD': key[1] = key[1] > 0 ? 0 : key[1]; break;
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
    updateCharacter(delta);
    if (flyControls.enabled) flyControls.update(delta);
    renderer.render(scene, camera);
}