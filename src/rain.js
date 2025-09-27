// src/rain.js
import * as THREE from 'three';
import { scene, setRainGroup } from './scene.js';

export function createRain() {
    console.log('Creating rain...');
    const rainCount = 35000;
    const newRainGroup = new THREE.Group();
    newRainGroup.visible = false;

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
        newRainGroup.add(line);
    }

    setRainGroup(newRainGroup);
    scene.add(newRainGroup);
}