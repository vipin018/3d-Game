// src/scene.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { settings, toneMappingOptions, controls } from './config.js';
import { setMinimapCity } from './minimap.js';

let scene, renderer, camera, group, followGroup;
let floor;
let fogUniforms, fogPlane;
let rainGroup;
let splashPool = [];
let splashActive = [];

let cityBoundingBox;

export { scene, renderer, camera, group, followGroup, floor, fogUniforms, fogPlane, rainGroup, splashPool, splashActive, cityBoundingBox };

export function setInitialCameraPosition(characterPosition) {
    const offset = controls.cameraOffset;
    camera.position.copy(characterPosition).add(offset);
    camera.lookAt(characterPosition);
}


export function setRainGroup(newRainGroup) {
    rainGroup = newRainGroup;
}


export function setFogPlane(mesh) {
    fogPlane = mesh;
}

export function setFogUniforms(uniforms) {
    fogUniforms = uniforms;
}


export function setFloor(mesh) {
    floor = mesh;
}


export function initScene(container) {
    console.log('Initializing scene...');
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.frustumCulled = true;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x5e5d5d);

    // Enhanced fog with height-based density
    scene.fog = new THREE.FogExp2(settings.fog_color, settings.fog_density);

    // Load HDRI
    const rgbeLoader = new RGBELoader();
    rgbeLoader.load('/hdri/environment.hdr', function (texture) {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        scene.environment = texture;
        scene.background = texture;
    });

    group = new THREE.Group();
    scene.add(group);

    followGroup = new THREE.Group();
    scene.add(followGroup);

    // ambient light
    const ambLight = new THREE.AmbientLight(0xffffff, 1);
    scene.add(ambLight);

    // Directional Light (only light source)
    const dirLight = new THREE.DirectionalLight(0xffffff, 5); // Reduced intensity
    dirLight.position.set(2, 10, 5); // Positioned directly above for testing
    dirLight.castShadow = true;
    const cam = dirLight.shadow.camera;
    cam.top = cam.right = 2;
    cam.bottom = cam.left = -2;
    cam.near = 3;
    cam.far = 8;
    dirLight.shadow.mapSize.set(512, 512);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.BasicShadowMap;
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setAnimationLoop(() => {}); // Will be set later
    renderer.toneMapping = toneMappingOptions[settings.tone_mapping];
    renderer.toneMappingExposure = 0.2;
    renderer.outputEncoding = THREE.sRGBEncoding;
    container.appendChild(renderer.domElement);
    renderer.compile(scene, camera);
    scene.add(dirLight);

    // Load city model
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

        // Calculate and store the bounding box
        cityBoundingBox = new THREE.Box3().setFromObject(model);

        // Adjust directional light shadow camera to fit the city
        const citySize = cityBoundingBox.getSize(new THREE.Vector3());
        const cityCenter = cityBoundingBox.getCenter(new THREE.Vector3());
        dirLight.shadow.camera.left = -10; // Smaller frustum around the character
        dirLight.shadow.camera.right = 10;
        dirLight.shadow.camera.top = 10;
        dirLight.shadow.camera.bottom = -10;
        dirLight.shadow.camera.near = 0.5; // Near plane
        dirLight.shadow.camera.far = 50; // Far plane
        dirLight.shadow.camera.updateProjectionMatrix();
        dirLight.target = group; // Make the light follow the character
        scene.add(dirLight.target); // Add the target to the scene

        setMinimapCity(model);
    });
}