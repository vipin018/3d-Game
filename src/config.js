import * as THREE from "three"
// src/config.js
export const settings = {
    show_skeleton: false,
    tone_mapping: 'ACESFilmic',
    fog_density: 0,
    fog_color: '#bfbfc0',
    fog_height: 20,
    fog_noise: true,
    fog_speed: 0.5,
    weather: 'autumn'
};

export const PI = Math.PI;
export const PI90 = Math.PI / 2;

export const controls = {
    key: [0, 0, 0],
    ease: new THREE.Vector3(),
    position: new THREE.Vector3(),
    up: new THREE.Vector3(0, 1, 0),
    rotate: new THREE.Quaternion(),
    current: 'Idle',
    fadeDuration: 0.5,
    runVelocity: 5,
    walkVelocity: 1.8,
    rotateSpeed: 0.05,
    floorDecale: 0,
    cameraOffset: new THREE.Vector3(0, 2.3, -7),
};

export const toneMappingOptions = {
    'NoToneMapping': THREE.NoToneMapping,
    'Linear': THREE.LinearToneMapping,
    'Reinhard': THREE.ReinhardToneMapping,
    'Cineon': THREE.CineonToneMapping,
    'ACESFilmic': THREE.ACESFilmicToneMapping
};