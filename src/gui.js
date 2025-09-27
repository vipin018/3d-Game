// src/gui.js
import { GUI } from 'lil-gui';
import { settings, toneMappingOptions, controls } from './config.js';
import { renderer, camera, scene } from './scene.js';
import { skeleton } from './model.js';
import { onWeatherChange } from './weather.js';

export function createPanel() {
    const panel = new GUI({ width: 300 });
    panel.close();

    const generalFolder = panel.addFolder('General');
    generalFolder.add(settings, 'show_skeleton').onChange(b => {
        if (skeleton) skeleton.visible = b;
    });
    generalFolder.add(settings, 'tone_mapping', Object.keys(toneMappingOptions)).onChange(value => {
        renderer.toneMapping = toneMappingOptions[value];
        renderer.compile(scene, camera);
    });
    generalFolder.add(renderer, 'toneMappingExposure', 0, 2, 0.01);

    const weatherFolder = panel.addFolder('Weather');
    weatherFolder.add(settings, 'weather', ['winter', 'rain', 'autumn']).onChange(onWeatherChange);


    const characterFolder = panel.addFolder('Character');
    characterFolder.add(controls, 'runVelocity', 0, 10, 0.1);
    characterFolder.add(controls, 'walkVelocity', 0, 10, 0.1);
    characterFolder.add(controls, 'rotateSpeed', 0, 0.2, 0.01);
}