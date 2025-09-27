// src/weather.js
import { settings } from './config.js';
import { scene, fogUniforms, rainGroup } from './scene.js';
import { createRain } from './rain.js';
import { createVolumetricFog } from './fog.js';

export function onWeatherChange(value) {
    console.log(`Weather changed to: ${value}`);
    switch (value) {
        case 'winter':
            settings.fog_density = 0.08;
            settings.fog_noise = true;
            scene.fog.density = settings.fog_density;
            if (fogUniforms) {
                fogUniforms.fogDensity.value = settings.fog_density;
                fogUniforms.enableNoise.value = settings.fog_noise;
            }
            if (rainGroup) rainGroup.visible = false;
            break;
        case 'rain':
            settings.fog_density = 0;
            scene.fog.density = settings.fog_density;
            if (fogUniforms) {
                fogUniforms.fogDensity.value = settings.fog_density;
            }
            if (rainGroup) rainGroup.visible = true;
            break;
        case 'autumn':
            settings.fog_density = 0;
            scene.fog.density = settings.fog_density;
            if (fogUniforms) {
                fogUniforms.fogDensity.value = settings.fog_density;
            }
            if (rainGroup) rainGroup.visible = false;
            break;
    }
}

export function initWeather() {
    createVolumetricFog();
    createRain();
    onWeatherChange(settings.weather);
}