// src/events.js
import { onWindowResize } from './window-resize.js';
import { onKeyDown, onKeyUp } from './controls.js';

export function initEvents() {
    window.addEventListener('resize', onWindowResize);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
}