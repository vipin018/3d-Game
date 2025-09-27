// src/window-resize.js
import * as THREE from 'three';
import { camera, renderer } from './scene.js';

export function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}