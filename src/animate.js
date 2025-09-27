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
        const fallSpeed = 0.6 + Math.random() * 0.2;
        rainGroup.children.forEach(line => {
            line.position.y -= fallSpeed;
            if (line.position.y < 0) {
                // Create splash at impact position
                createSplash(line.position.x, line.position.z);
                // Reset drop
                line.position.y = 60 + Math.random() * 20;
                line.position.x = (Math.random() - 0.5) * 200;
                line.position.z = (Math.random() - 0.5) * 200;
            }
        });
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