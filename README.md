# 3D Soldier Animation Project

This project is an interactive 3D application built with **Three.js** that showcases a soldier character in a dynamic city environment. The application features character animation, user controls, a weather system with volumetric fog and rain, a third-person camera, and a 3D minimap.

## Getting Started

To run this project locally, follow these steps:

1.  **Clone the repository:**

    ```bash
    git clone <repository-url>
    ```

2.  **Navigate to the project directory:**

    ```bash
    cd 3d-Game
    ```

3.  **Install the dependencies:**

    ```bash
    npm install
    ```

4.  **Start the development server:**

    ```bash
    npm run dev
    ```

    This will start a Vite development server and open the application in your default web browser.

## Features

*   **Character Control:** Control the soldier's movement using the WASD or arrow keys.
*   **Weather System:** Switch between different weather conditions (winter, rain, autumn) through the GUI.
*   **Volumetric Fog:** Experience realistic, height-based volumetric fog that adds depth and atmosphere to the scene.
*   **Rain and Splashes:** Watch as rain falls from the sky and creates splashes on the ground.
*   **Third-Person Camera:** The camera follows the character as you navigate the environment.
*   **3D Minimap:** A 3D minimap in the top-left corner displays a top-down view of the city and the character's real-time position.
*   **GUI Controls:** A `lil-gui` panel allows you to tweak various settings in real-time.

## File Structure

The project is organized into several modules, each responsible for a specific part of the application's functionality:

*   `index.html`: The main entry point of the application.
*   `main.css`: Contains the styles for the HTML elements.
*   `package.json`: Defines the project's dependencies and scripts.

### `src` Directory

*   `main.js`: The main script that initializes the entire application.
*   `scene.js`: Initializes the Three.js scene, camera, renderer, and lighting. It also manages the global variables for the scene objects.
*   `config.js`: Contains the configuration settings for the application, such as fog density, character speed, and tone mapping.
*   `controls.js`: Handles the character's movement and animation based on user input.
*   `model.js`: Loads the 3D model of the soldier and its animations.
*   `floor.js`: Creates the ground plane for the scene.
*   `fog.js`: Creates the volumetric fog effect using a custom shader.
*   `rain.js`: Creates the rain effect with individual raindrops.
*   `splashes.js`: Creates and manages the splash effects when raindrops hit the ground.
*   `weather.js`: Manages the weather system, allowing you to switch between different weather conditions.
*   `gui.js`: Creates the `lil-gui` panel for real-time settings adjustment.
*   `events.js`: Sets up the event listeners for window resizing and keyboard input.
*   `animate.js`: The main animation loop that updates the scene, character, and effects in every frame.
*   `window-resize.js`: Handles the resizing of the browser window.
*   `minimap.js`: Manages the 3D minimap feature.

## How It Works

### Character Control (WASD and Arrow Keys)

The character's movement is handled in `src/controls.js`. Here's a breakdown:

1.  **Event Listeners:** `src/events.js` sets up `keydown` and `keyup` event listeners that call the `onKeyDown` and `onKeyUp` functions in `src/controls.js`.
2.  **Key State:** The `controls.key` array in `src/config.js` stores the state of the movement keys (W, A, S, D, and Shift).
3.  **`updateCharacter` Function:** This function is called in the `animate` loop and performs the following actions:
    *   It checks the `controls.key` array to determine the character's intended movement (forward, backward, left, or right) and whether the Shift key is pressed for running.
    *   It smoothly transitions between the 'Idle', 'Walk', and 'Run' animations using the `AnimationMixer`.
    *   It updates the character's position and rotation based on the user's input.

### Weather Control

The weather system is managed by `src/weather.js` and can be controlled through the GUI created in `src/gui.js`.

1.  **GUI Panel:** The `createPanel` function in `src/gui.js` creates a dropdown menu in the `lil-gui` panel that allows you to select a weather condition ('winter', 'rain', or 'autumn').
2.  **`onWeatherChange` Function:** When you select a new weather condition, the `onWeatherChange` function in `src/weather.js` is called. This function adjusts the scene's properties based on the selected weather:
    *   **'winter':** Increases the fog density and enables the fog noise for a snowy, hazy atmosphere.
    *   **'rain':** Hides the fog and makes the rain effect visible.
    *   **'autumn':** Hides both the fog and the rain.

### Camera Object Following

The third-person camera is programmed to follow the character in `src/controls.js`.

1.  **`followGroup`:** A `THREE.Group` named `followGroup` is created in `src/scene.js`. This group's position is updated to match the character's position in every frame.
2.  **Camera Offset:** An `offset` vector is defined to specify the camera's position relative to the character (behind and slightly above).
3.  **Camera Position Update:** In the `updateCharacter` function, the camera's position is set by adding the `offset` to the character's position.
4.  **`lookAt`:** The camera is made to always look at the character's position, ensuring that the character is always in the center of the view.

### 3D Minimap

The 3D minimap is a more advanced feature that provides a real-time, top-down view of the city and the character's position. It is managed by `src/minimap.js`.

1.  **Second Scene:** A second `THREE.Scene` (`minimapScene`) is created exclusively for the minimap.
2.  **Orthographic Camera:** An `THREE.OrthographicCamera` (`minimapCamera`) is used to get a top-down, 2D-like view of the `minimapScene`.
3.  **Cloned City:** To avoid loading the city model twice, the city model from the main scene is cloned and added to the `minimapScene`.
4.  **Character Marker:** A simple red cylinder (`characterMarker`) is used to represent the character on the minimap. Its position is synchronized with the main character's position.
5.  **Viewport Rendering:** The `renderMinimap` function uses `renderer.setViewport` and `renderer.setScissor` to render the `minimapScene` onto a small rectangular area in the top-left corner of the main canvas. This is done in the `animate` loop after the main scene has been rendered.

### Volumetric Fog

The volumetric fog is a custom effect created in `src/fog.js` using a `ShaderMaterial`.

*   **Fog Box:** A large `THREE.BoxGeometry` is created to encompass the scene.
*   **Custom Shader:** A custom vertex and fragment shader is used to create the fog effect. The fragment shader calculates the fog's density based on the height of the object, creating a more realistic effect where the fog is denser near the ground.
*   **Noise:** A 3D noise function is used to add a volumetric, swirling effect to the fog, making it look more natural.

### Rain and Splashes

The rain and splash effects are created in `src/rain.js` and `src/splashes.js`.

*   **Raindrops:** The `createRain` function creates a large number of individual raindrops (lines) and adds them to a `THREE.Group`.
*   **Animation:** In the `animate` loop, the raindrops are moved downwards. When a raindrop hits the ground, a splash effect is created at its position, and the raindrop is reset to the top of the scene.
*   **Splashes:** The `createSplash` function creates a small, circular mesh that quickly expands and fades out to simulate a splash. The splashes are managed in a pool to optimize performance.