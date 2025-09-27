// src/main.js
import * as THREE from 'three';
import { initScene } from './scene.js';
import { createFloor } from './floor.js';
import { initSplashPool } from './splashes.js';
import { initWeather } from './weather.js';
import { loadModel } from './model.js';
import { initEvents } from './events.js';
import { animate } from './animate.js';
import { renderer } from './scene.js';

import { initMinimap } from './minimap.js';

let clock;

export { clock };

export function init() {
    console.log('Initializing application...');
    const container = document.getElementById('container');
    clock = new THREE.Clock();

    initScene(container);

    createFloor();
    initSplashPool();
    initWeather();
    loadModel();
    initEvents();
    initMinimap();

    // Set animation loop
    renderer.setAnimationLoop(animate);
}

init();