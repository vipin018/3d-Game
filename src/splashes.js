// src/splashes.js
import * as THREE from 'three';
import { scene, splashPool, splashActive } from './scene.js';

export function initSplashPool() {
    const splashCount = 100; // Number of splash effects to pool
    const splashGroup = new THREE.Group();
    scene.add(splashGroup);

    for (let i = 0; i < splashCount; i++) {
        const geometry = new THREE.CircleGeometry(0.1, 8); // Small circle for splash
        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0
        });
        const splash = new THREE.Mesh(geometry, material);
        splash.rotation.x = -Math.PI / 2;
        splash.scale.set(0, 0, 1);
        splashGroup.add(splash);
        splashPool.push(splash);
        splashActive.push(false);
    }
}

export function createSplash(x, z) {
    // Find an inactive splash
    for (let i = 0; i < splashPool.length; i++) {
        if (!splashActive[i]) {
            const splash = splashPool[i];
            splash.position.set(x, 0.01, z); // Slightly above ground
            splash.material.opacity = 0.8;
            splash.scale.set(0.1, 0.1, 1);
            splashActive[i] = true;
            // Animate splash (will be updated in animate)
            break;
        }
    }
}

export function updateSplashes(delta) {
    for (let i = 0; i < splashPool.length; i++) {
        if (splashActive[i]) {
            const splash = splashPool[i];
            // Expand and fade out
            splash.scale.multiplyScalar(1.1 + Math.random() * 0.2);
            splash.material.opacity -= delta * 3; // Fade quickly

            if (splash.material.opacity <= 0 || splash.scale.x > 1) {
                splashActive[i] = false;
                splash.material.opacity = 0;
                splash.scale.set(0.1, 0.1, 1);
            }
        }
    }
}