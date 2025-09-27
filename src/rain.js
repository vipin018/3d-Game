// src/rain.js
import * as THREE from 'three';
import { scene, setRainGroup } from './scene.js';

export function createRain() {
    console.log('Creating rain...');
    const rainCount = 35000;
    const newRainGroup = new THREE.Group();
    newRainGroup.visible = false;

    const positions = new Float32Array(rainCount * 3);
    const velocities = new Float32Array(rainCount);

    for (let i = 0; i < rainCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 200;
        positions[i * 3 + 1] = Math.random() * 60 + 20;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 200;
        velocities[i] = 0.6 + Math.random() * 0.2;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 1));

    const material = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.1,
        transparent: true,
        opacity: 0.9,
    });

    const rain = new THREE.Points(geometry, material);
    newRainGroup.add(rain);

    setRainGroup(newRainGroup);
    scene.add(newRainGroup);
}