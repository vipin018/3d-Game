// src/floor.js
import * as THREE from 'three';
import { scene, setFloor } from './scene.js';

export function createFloor() {
    const geometry = new THREE.PlaneGeometry(200, 200);
    const material = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const newFloor = new THREE.Mesh(geometry, material);
    newFloor.rotation.x = -Math.PI / 2;
    newFloor.position.y = 0;
    newFloor.receiveShadow = true;
    setFloor(newFloor);
    scene.add(newFloor);
}