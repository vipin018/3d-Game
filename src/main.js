import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'lil-gui';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { Stats } from 'three/examples/jsm/libs/stats.module.js';

let scene, renderer, camera, orbitControls, stats;
let group, followGroup, model, skeleton, mixer, clock;

let actions;

const settings = {
	show_skeleton: false,
};

const PI = Math.PI;
const PI90 = Math.PI / 2;

const controls = {
	key: [ 0, 0, 0 ],
	ease: new THREE.Vector3(),
	position: new THREE.Vector3(),
	up: new THREE.Vector3( 0, 1, 0 ),
	rotate: new THREE.Quaternion(),
	current: 'Idle',
	fadeDuration: 0.5,
	runVelocity: 5,
	walkVelocity: 1.8,
	rotateSpeed: 0.05,
	floorDecale: 0,
};

init();

function init() {
    const container = document.getElementById('container');

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 2, -5);

    clock = new THREE.Clock();

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x5e5d5d);

    const environment = new RoomEnvironment();
    scene.environment = environment;

    group = new THREE.Group();
    scene.add(group);

    followGroup = new THREE.Group();
    scene.add(followGroup);

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 5);
    dirLight.position.set(-2, 5, -3);
    dirLight.castShadow = true;
    const cam = dirLight.shadow.camera;
    cam.top = cam.right = 2;
    cam.bottom = cam.left = -2;
    cam.near = 3;
    cam.far = 8;
    dirLight.shadow.mapSize.set(1024, 1024);
    followGroup.add(dirLight);
    followGroup.add(dirLight.target);

    const hemisphereLight = new THREE.HemisphereLight( 0xffffff, 0x000000, 1 );
    scene.add( hemisphereLight );

    const pointLight = new THREE.PointLight( 0xffffff, 1, 100 );
    pointLight.position.set( 0, 5, 5 );
    scene.add( pointLight );

    const spotLight = new THREE.SpotLight( 0xffffff, 1, 0, Math.PI / 4, 1, 2 );
    spotLight.position.set( 0, 5, 0 );
    scene.add( spotLight );

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setAnimationLoop(animate);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.5;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    container.appendChild(renderer.domElement);
    renderer.compile(scene, camera);

    orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.target.set(0, 1, 0);
    orbitControls.enableDamping = true;
    orbitControls.enablePan = false;
    orbitControls.maxPolarAngle = PI90 - 0.05;
    orbitControls.update();

    // Reflector
    const reflector = new Reflector( new THREE.PlaneGeometry( 50, 50 ), {
        clipBias: 0.003,
        textureWidth: window.innerWidth * window.devicePixelRatio,
        textureHeight: window.innerHeight * window.devicePixelRatio,
        color: 0x777777
    } );
    reflector.position.y = 0;
    reflector.rotateX( - Math.PI / 2 );
    scene.add( reflector );

    stats = new Stats();
    document.body.appendChild( stats.dom );

    // EVENTS
    window.addEventListener('resize', onWindowResize);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    // DEMO
    loadModel();
}

function loadModel() {
	const loader = new GLTFLoader();
	const path = "models/Soldier.glb"
	loader.load( path, function ( gltf ) {
		model = gltf.scene;
		group.add( model );
		model.rotation.y = PI;
		group.rotation.y = PI;

		model.traverse( function ( object ) {
			if ( object.isMesh ) {
                object.castShadow = true;
                object.receiveShadow = true;
			}
		} );

		skeleton = new THREE.SkeletonHelper( model );
		skeleton.visible = false;
		scene.add( skeleton );

		createPanel();

		const animations = gltf.animations;
		mixer = new THREE.AnimationMixer( model );

		actions = {
			Idle: mixer.clipAction( animations[ 0 ] ),
			Walk: mixer.clipAction( animations[ 3 ] ),
			Run: mixer.clipAction( animations[ 1 ] )
		};

		for ( const m in actions ) {
			actions[ m ].enabled = true;
			actions[ m ].setEffectiveTimeScale( 1 );
			if ( m !== 'Idle' ) actions[ m ].setEffectiveWeight( 0 );
		}

		actions.Idle.play();
		animate();
	} );
}

function updateCharacter( delta ) {
	const fade = controls.fadeDuration;
	const key = controls.key;
	const up = controls.up;
	const ease = controls.ease;
	const rotate = controls.rotate;
	const position = controls.position;
	const azimuth = orbitControls.getAzimuthalAngle();

	const active = key[ 0 ] === 0 && key[ 1 ] === 0 ? false : true;
	const play = active ? ( key[ 2 ] ? 'Run' : 'Walk' ) : 'Idle';

	if ( controls.current != play ) {
		const current = actions[ play ];
		const old = actions[ controls.current ];
		controls.current = play;

        setWeight( current, 1.0 );
        old.fadeOut( fade );
        current.reset().fadeIn( fade ).play();
	}

	if ( controls.current !== 'Idle' ) {
		const velocity = controls.current == 'Run' ? controls.runVelocity : controls.walkVelocity;
		ease.set( key[ 1 ], 0, key[ 0 ] ).multiplyScalar( velocity * delta );
		const angle = unwrapRad( Math.atan2( ease.x, ease.z ) + azimuth );
		rotate.setFromAxisAngle( up, angle );
		controls.ease.applyAxisAngle( up, azimuth );
		position.add( ease );
		camera.position.add( ease );
		group.position.copy( position );
		group.quaternion.rotateTowards( rotate, controls.rotateSpeed );
		orbitControls.target.copy( position ).add( { x: 0, y: 1, z: 0 } );
		followGroup.position.copy( position );
	}

	if ( mixer ) mixer.update( delta );
	orbitControls.update();
}

function unwrapRad( r ) {
	return Math.atan2( Math.sin( r ), Math.cos( r ) );
}

function createPanel() {
	const panel = new GUI( { width: 310 } );
	panel.add( settings, 'show_skeleton' ).onChange( ( b ) => {
		skeleton.visible = b;
	} );
    panel.add( renderer, 'toneMappingExposure', 0, 2, 0.01 );
    panel.add( controls, 'runVelocity', 0, 10, 0.1 );
    panel.add( controls, 'walkVelocity', 0, 10, 0.1 );
    panel.add( controls, 'rotateSpeed', 0, 0.2, 0.01 );

    const lightFolder = panel.addFolder('Lights');

    const ambientLight = scene.getObjectByProperty('type', 'AmbientLight');
    const ambientFolder = lightFolder.addFolder('Ambient Light');
    ambientFolder.add(ambientLight, 'visible');
    ambientFolder.add(ambientLight, 'intensity', 0, 5, 0.1);
    ambientFolder.addColor(ambientLight, 'color');

    const dirLight = scene.getObjectByProperty('type', 'DirectionalLight');
    const dirFolder = lightFolder.addFolder('Directional Light');
    dirFolder.add(dirLight, 'visible');
    dirFolder.add(dirLight, 'intensity', 0, 10, 0.1);
    dirFolder.addColor(dirLight, 'color');

    const hemisphereLight = scene.getObjectByProperty('type', 'HemisphereLight');
    const hemiFolder = lightFolder.addFolder('Hemisphere Light');
    hemiFolder.add(hemisphereLight, 'visible');
    hemiFolder.add(hemisphereLight, 'intensity', 0, 5, 0.1);
    hemiFolder.addColor(hemisphereLight, 'color');

    const pointLight = scene.getObjectByProperty('type', 'PointLight');
    const pointFolder = lightFolder.addFolder('Point Light');
    pointFolder.add(pointLight, 'visible');
    pointFolder.add(pointLight, 'intensity', 0, 10, 0.1);
    pointFolder.addColor(pointLight, 'color');

    const spotLight = scene.getObjectByProperty('type', 'SpotLight');
    const spotFolder = lightFolder.addFolder('Spot Light');
    spotFolder.add(spotLight, 'visible');
    spotFolder.add(spotLight, 'intensity', 0, 10, 0.1);
    spotFolder.addColor(spotLight, 'color');
}

function setWeight( action, weight ) {
	action.enabled = true;
	action.setEffectiveTimeScale( 1 );
	action.setEffectiveWeight( weight );
}

function onKeyDown( event ) {
	const key = controls.key;
	switch ( event.code ) {
		case 'ArrowUp': case 'KeyW': case 'KeyZ': key[ 0 ] = - 1; break;
		case 'ArrowDown': case 'KeyS': key[ 0 ] = 1; break;
		case 'ArrowLeft': case 'KeyA': case 'KeyQ': key[ 1 ] = - 1; break;
		case 'ArrowRight': case 'KeyD': key[ 1 ] = 1; break;
		case 'ShiftLeft' : case 'ShiftRight' : key[ 2 ] = 1; break;
	}
}

function onKeyUp( event ) {
	const key = controls.key;
	switch ( event.code ) {
		case 'ArrowUp': case 'KeyW': case 'KeyZ': key[ 0 ] = key[ 0 ] < 0 ? 0 : key[ 0 ]; break;
		case 'ArrowDown': case 'KeyS': key[ 0 ] = key[ 0 ] > 0 ? 0 : key[ 0 ]; break;
		case 'ArrowLeft': case 'KeyA': case 'KeyQ': key[ 1 ] = key[ 1 ] < 0 ? 0 : key[ 1 ]; break;
		case 'ArrowRight': case 'KeyD': key[ 1 ] = key[ 1 ] > 0 ? 0 : key[ 1 ]; break;
		case 'ShiftLeft' : case 'ShiftRight' : key[ 2 ] = 0; break;
	}
}

function onWindowResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize( window.innerWidth, window.innerHeight );
}

function animate() {
	const delta = clock.getDelta();
	updateCharacter( delta );
	renderer.render( scene, camera );
    stats.update();
}
