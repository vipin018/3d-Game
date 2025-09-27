// src/animate.js
import * as THREE from 'three';
import { clock } from './main.js'; // Assuming clock is exported from main
import { fogUniforms, rainGroup } from './scene.js';
import { createSplash, updateSplashes } from './splashes.js';
import { updateCharacter } from './controls.js';
import { renderer, camera, scene } from './scene.js';
import { renderMinimap } from './minimap.js';

export function animate() {
    const delta = clock.getDelta();
    const time = clock.getElapsedTime();
    
    // Update shader uniforms
    if (fogUniforms) {
        fogUniforms.time.value = time;
        fogUniforms.cameraPosition.value.copy(camera.position);
    }

    // Animate rain if visible
    if (rainGroup && rainGroup.visible) {
        const rain = rainGroup.children[0];
        const positions = rain.geometry.attributes.position.array;
        const velocities = rain.geometry.attributes.velocity.array;

        for (let i = 0; i < positions.length; i += 3) {
            positions[i + 1] -= velocities[i / 3];
            if (positions[i + 1] < 0) {
                // Create splash at impact position
                createSplash(positions[i], positions[i + 2]);
                // Reset drop
                positions[i + 1] = 60 + Math.random() * 20;
            }
        }
        rain.geometry.attributes.position.needsUpdate = true;
    }

    // Update splashes
    updateSplashes(delta);
    
    updateCharacter(delta);
    
    // Render main scene
    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.setScissor(0, 0, window.innerWidth, window.innerHeight);
    renderer.render(scene, camera);
    
    // Render minimap
    renderMinimap();
}