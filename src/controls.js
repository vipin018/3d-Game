// src/controls.js
import { controls } from './config.js';
import { actions, mixer } from './model.js';
import * as THREE from 'three';
import { group, followGroup, camera } from './scene.js';
import { updateMinimap } from './minimap.js';

let logCounter = 0;

export function updateCharacter(delta) {
    if (!actions) return; // Don't update if actions are not yet loaded
    const fade = controls.fadeDuration;
    const key = controls.key;
    const up = controls.up;
    const ease = controls.ease;
    const rotate = controls.rotate;
    const position = controls.position;
    const azimuth = 0;

    const active = key[0] !== 0 || key[1] !== 0;
    const play = active ? (key[2] ? 'Run' : 'Walk') : 'Idle';

    if (controls.current != play) {
        console.log(`Character state changed to: ${play}`);
        const current = actions[play];
        const old = actions[controls.current];
        controls.current = play;

        setWeight(current, 1.0);
        old.fadeOut(fade);
        current.reset().fadeIn(fade).play();
    }

    if (controls.current !== 'Idle') {
        const velocity = controls.current == 'Run' ? controls.runVelocity : controls.walkVelocity;
        ease.set(key[1], 0, key[0]).multiplyScalar(velocity * delta);
        const angle = unwrapRad(Math.atan2(ease.x, ease.z) + azimuth);
        rotate.setFromAxisAngle(up, angle);
        controls.ease.applyAxisAngle(up, azimuth);
        position.add(ease);
        // camera.position.add(ease);
        group.position.copy(position);
        group.quaternion.rotateTowards(rotate, controls.rotateSpeed);
        followGroup.position.copy(position);

        if (logCounter % 60 === 0) {
            console.log(`Character position: x: ${group.position.x.toFixed(2)}, y: ${group.position.y.toFixed(2)}, z: ${group.position.z.toFixed(2)}`);
        }
        logCounter++;

        const offset = controls.cameraOffset;
        camera.position.copy(group.position).add(offset);
        camera.lookAt(group.position);
    }
    updateMinimap(group.position);
    if (mixer) mixer.update(delta);
}

export function unwrapRad(r) {
    return Math.atan2(Math.sin(r), Math.cos(r));
}

export function setWeight(action, weight) {
    action.enabled = true;
    action.setEffectiveTimeScale(1);
    action.setEffectiveWeight(weight);
}

export function onKeyDown(event) {
    const key = controls.key;
    switch (event.code) {
        case 'ArrowDown': case 'KeyS': key[0] = -1; break;
        case 'ArrowUp': case 'KeyW': key[0] = 1; break;
        case 'ArrowRight': case 'KeyD': key[1] = -1; break;
        case 'ArrowLeft': case 'KeyA': key[1] = 1; break;
        case 'ShiftLeft': case 'ShiftRight': key[2] = 1; break;
    }
}

export function onKeyUp(event) {
    const key = controls.key;
    switch (event.code) {
        case 'ArrowDown': case 'KeyS': key[0] = key[0] < 0 ? 0 : key[0]; break;
        case 'ArrowUp': case 'KeyW': key[0] = key[0] > 0 ? 0 : key[0]; break;
        case 'ArrowRight': case 'KeyD': key[1] = key[1] < 0 ? 0 : key[1]; break;
        case 'ArrowLeft': case 'KeyA': key[1] = key[1] > 0 ? 0 : key[1]; break;
        case 'ShiftLeft': case 'ShiftRight': key[2] = 0; break;
    }
}