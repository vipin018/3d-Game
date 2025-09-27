import * as THREE from 'three';
import { renderer } from './scene.js';

let minimapScene, minimapCamera;
let characterMarker;

const minimapSize = 200;
const minimapMargin = 20;

export function initMinimap() {
    console.log('Initializing 3D minimap...');
    minimapScene = new THREE.Scene();

    // Create an orthographic camera for the top-down view
    const aspect = 1;
    const frustumSize = 100;
    minimapCamera = new THREE.OrthographicCamera(
        frustumSize * aspect / -2,
        frustumSize * aspect / 2,
        frustumSize / 2,
        frustumSize / -2,
        1,
        1000
    );
    minimapCamera.up.set(0, 0, -1); // Set the camera's up direction
    minimapScene.add(minimapCamera);

    const ambientLight = new THREE.AmbientLight(0xffffff, 10);
    minimapScene.add(ambientLight);

    // Create the character marker
    const markerGeometry = new THREE.CylinderGeometry(1, 1, 5, 16);
    const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    characterMarker = new THREE.Mesh(markerGeometry, markerMaterial);
    minimapScene.add(characterMarker);
}

export function setMinimapCity(cityModel) {
    const cityClone = cityModel.clone();
    minimapScene.add(cityClone);
}

export function updateMinimap(characterPosition) {
    if (characterMarker) {
        characterMarker.position.copy(characterPosition);
        minimapCamera.position.set(characterPosition.x, 100, characterPosition.z);
        minimapCamera.lookAt(characterMarker.position);
    }
}

export function renderMinimap() {
    if (!renderer) return;

    renderer.setScissorTest(true);
    renderer.setScissor(minimapMargin, window.innerHeight - minimapSize - minimapMargin, minimapSize, minimapSize);
    renderer.setViewport(minimapMargin, window.innerHeight - minimapSize - minimapMargin, minimapSize, minimapSize);
    renderer.render(minimapScene, minimapCamera);
    renderer.setScissorTest(false);
}