import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { group, scene, cityBoundingBox, setInitialCameraPosition } from './scene.js';
import { settings, PI, controls } from './config.js';
import { createPanel } from './gui.js';

let model, skeleton, mixer;
let actions;

export function loadModel() {
    console.log('Loading model...');
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('three/examples/jsm/libs/draco/');
    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);
    const path = "models/Soldier.glb";
    loader.load(path, function (gltf) {
        model = gltf.scene;
        group.add(model);

        if (cityBoundingBox) {
            const randomX = THREE.MathUtils.randFloat(cityBoundingBox.min.x, cityBoundingBox.max.x);
            const randomZ = THREE.MathUtils.randFloat(cityBoundingBox.min.z, cityBoundingBox.max.z);
            group.position.set(randomX, 0.8, randomZ);
            controls.position.copy(group.position);
            setInitialCameraPosition(group.position);
        } else {
            group.position.set(-5.32, 0.8, 0.87);
            controls.position.copy(group.position);
            setInitialCameraPosition(group.position);
        }

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
        console.log('Model loaded successfully.');
    });
}
export { model, skeleton, mixer, actions };