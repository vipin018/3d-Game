// src/fog.js
import * as THREE from 'three';
import { settings } from './config.js';
import { scene, setFogPlane, setFogUniforms } from './scene.js';

export function createVolumetricFog() {
    // Create a box for volumetric fog effect to allow height variation
    const fogGeometry = new THREE.BoxGeometry(100, 20, 100);
    
    const fogMaterial = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            fogColor: { value: new THREE.Color(settings.fog_color) },
            fogDensity: { value: settings.fog_density },
            fogHeight: { value: settings.fog_height },
            cameraPosition: { value: new THREE.Vector3() },
            enableNoise: { value: settings.fog_noise },
            fogSpeed: { value: settings.fog_speed }
        },
        vertexShader: `
            varying vec2 vUv;
            varying vec3 vWorldPosition;
            void main() {
                vUv = uv;
                vec4 worldPos = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPos.xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float time;
            uniform vec3 fogColor;
            uniform float fogDensity;
            uniform float fogHeight;
            uniform vec3 cameraPosition;
            uniform bool enableNoise;
            uniform float fogSpeed;
            
            varying vec2 vUv;
            varying vec3 vWorldPosition;
            
            // Simple 3D noise function
            float hash(vec3 p) {
                p = fract(p * 0.3183099 + .1);
                return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
            }
            
            float noise(vec3 p) {
                vec3 i = floor(p);
                vec3 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);
                
                return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                               mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                           mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                               mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
            }
            
            void main() {
                // Height-based fog density (higher density at bottom)
                float localY = max(vWorldPosition.y, 0.0);
                float heightFactor = 1.0 - clamp(localY / fogHeight, 0.0, 1.0);
                float baseDensity = fogDensity * heightFactor;
                
                // Add animated 3D noise for volumetric effect and movement
                float noiseFactor = 1.0;
                if (enableNoise) {
                    vec3 noisePos = vWorldPosition * 0.05 + vec3(time * fogSpeed, 0.0, 0.0);
                    noiseFactor = noise(noisePos) * 0.5 + 0.5;
                }
                
                float finalDensity = baseDensity * noiseFactor;
                
                // Distance from camera (simplified)
                float dist = length(vWorldPosition - cameraPosition) * 0.01;
                float fogFactor = exp(-finalDensity * dist);
                fogFactor = 1.0 - clamp(fogFactor, 0.0, 1.0);
                
                gl_FragColor = vec4(fogColor, fogFactor * 0.8);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
        side: THREE.DoubleSide
    });

    const newFogPlane = new THREE.Mesh(fogGeometry, fogMaterial);
    newFogPlane.position.y = 10; // Center the box at y=10 (bottom at y=0, top at y=20)
    setFogPlane(newFogPlane);
    scene.add(newFogPlane);
    
    setFogUniforms(fogMaterial.uniforms);
}