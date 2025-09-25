import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'lil-gui';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

let scene, renderer, camera, floor, orbitControls;
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
	const container = document.getElementById( 'container' );

	camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.1, 100 );
	camera.position.set( 0, 2, - 5 );

	clock = new THREE.Clock();

	scene = new THREE.Scene();
	scene.background = new THREE.Color( 0x5e5d5d );
	scene.fog = new THREE.Fog( 0x5e5d5d, 2, 20 );

	group = new THREE.Group();
	scene.add( group );

	followGroup = new THREE.Group();
	scene.add( followGroup );

	const dirLight = new THREE.DirectionalLight( 0xffffff, 5 );
	dirLight.position.set( - 2, 5, - 3 );
	dirLight.castShadow = true;
	const cam = dirLight.shadow.camera;
	cam.top = cam.right = 2;
	cam.bottom = cam.left = - 2;
	cam.near = 3;
	cam.far = 8;
	dirLight.shadow.mapSize.set( 1024, 1024 );
	followGroup.add( dirLight );
	followGroup.add( dirLight.target );

	renderer = new THREE.WebGLRenderer( { antialias: true } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( animate );
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 0.5;
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	container.appendChild( renderer.domElement );

    const pmremGenerator = new THREE.PMREMGenerator( renderer );
    scene.environment = pmremGenerator.fromScene( new RoomEnvironment( renderer ), 0.04 ).texture;

	orbitControls = new OrbitControls( camera, renderer.domElement );
	orbitControls.target.set( 0, 1, 0 );
	orbitControls.enableDamping = true;
	orbitControls.enablePan = false;
	orbitControls.maxPolarAngle = PI90 - 0.05;
	orbitControls.update();

	// EVENTS
	window.addEventListener( 'resize', onWindowResize );
	document.addEventListener( 'keydown', onKeyDown );
	document.addEventListener( 'keyup', onKeyUp );

	// DEMO
    loadModel();
    addFloor();
}

function addFloor() {
	const size = 50;

	const mat = new THREE.MeshStandardMaterial( { color: 0x404040, roughness: 0.85 } );

	const g = new THREE.PlaneGeometry( size, size );
	g.rotateX( - PI90 );

	floor = new THREE.Mesh( g, mat );
	floor.receiveShadow = true;
	scene.add( floor );
}

function loadModel() {
	const loader = new GLTFLoader();
	loader.load( 'public/Soldier.glb', function ( gltf ) {
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
        console.log(animations);
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
		const dx = ( position.x - floor.position.x );
		const dz = ( position.z - floor.position.z );
		if ( Math.abs( dx ) > controls.floorDecale ) floor.position.x += dx;
		if ( Math.abs( dz ) > controls.floorDecale ) floor.position.z += dz;
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
}