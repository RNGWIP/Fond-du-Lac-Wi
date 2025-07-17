import * as THREE from './3js_material/three.module.js';
import { GLTFLoader } from './3js_material/GLTFLoader.js';
import { OrbitControls } from './3js_material/OrbitControls.js';
import { CSS3DRenderer, CSS3DObject } from './3js_material/CSS3DRenderer.js';


console.log('Init started');

let scene, camera, renderer, cssRenderer, controls;
let raycaster, mouse;
let powerButtonMesh = null;
let blinkingInterval;
let zooming = false;
let screenMesh = null;
let screenPlaceholderMesh = null;
let screenPlaceholderRoot = null;
let cssObject = null;
let stickyNoteObject = null;

//let placeholderAspectratio = 1.6; // fallback default


init();
animate();
window.addEventListener('message', (event) => {
    console.log('PARENT PAGE RECEIVED postMessage:', event.data);
    if (event.data && event.data.action === 'sessionExpired') {
        console.log('Received sessionExpired message');
        startSessionFadeOut();
      }
      
    
    if (event.data && event.data.action === 'openStickynote') {
      console.log('Message received from iframe: adding sticky note!');
      addStickynote();
    }
    if (event.data && event.data.action === 'goBack') {
        console.log('Message received: remove sticky note only!');
        if (stickyNoteObject) {
          scene.remove(stickyNoteObject);
          stickyNoteObject = null;
          console.log('Removed sticky note from scene.');
        }
        // DO NOT remove iframe here; leave it intact
      }
      
  });
  

function init() {
  console.log('Init function running');

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  // Camera
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.001, 100);

  camera.position.set(7.5, 5.5, 4);
  console.log('Camera position:', camera.position);


// CSS3DRenderer
cssRenderer = new CSS3DRenderer();
cssRenderer.setSize(window.innerWidth, window.innerHeight);
cssRenderer.domElement.style.position = 'absolute';
cssRenderer.domElement.style.top = '0';
cssRenderer.domElement.style.left = '0';
document.body.appendChild(cssRenderer.domElement);
cssRenderer.domElement.style.pointerEvents = 'none';
cssRenderer.domElement.style.zIndex = '10'; // ensures iframe is above canvas

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);
  console.log('Renderer initialized');



  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.target.set(7.5, 5.5, 4);  // match your scene's focus point
controls.update();

  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
  directionalLight.position.set(5, 5, 5);
  scene.add(directionalLight);

  const pointLight = new THREE.PointLight(0xffffff, 1);
  pointLight.position.set(2, 3, 4);
  scene.add(pointLight);

  // Helpers
  const gridHelper = new THREE.GridHelper(1000, 1000);
  scene.add(gridHelper);

  //const axesHelper = new THREE.AxesHelper(5);
  //scene.add(axesHelper);

  // Raycaster setup
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  // Loader
  const loader = new GLTFLoader();

  // Load computer base
  loader.load(
    './Computer3dAssets/computer.glb',
    (gltf) => {
      console.log('Loaded computer.glb', gltf);
      scene.add(gltf.scene);
    },
    undefined,
    (error) => {
      console.error('Error loading computer:', error);
    }
  );

  // Load power button
  loader.load(
    './Computer3dAssets/powerbutton.glb',
    (gltf) => {
      console.log('Loaded powerbutton.glb', gltf);
      powerButtonMesh = gltf.scene;
      scene.add(powerButtonMesh);
    },
    undefined,
    (error) => {
      console.error('Error loading powerbutton:', error);
    }
  );

  // Load screen (dark)
  loader.load(
    './Computer3dAssets/screen2.glb',
    (gltf) => {
      screenMesh = gltf.scene;
  
      // Make all meshes in the screen purely black and non-reflective
      screenMesh.traverse((child) => {
        if (child.isMesh) {
          child.material = new THREE.MeshBasicMaterial({ color: 0x000000 });
        }
      });
  
      scene.add(screenMesh);
      console.log('Loaded screen2.glb (now matte black)');
    },
    undefined,
    (error) => console.error('Error loading screen:', error)
  );
  
  
  loader.load('./Computer3dAssets/screenPlaceholder2.glb', (gltf) => {
    // Load entire scene
    screenPlaceholderRoot = gltf.scene;
    screenPlaceholderRoot.visible = false;
    scene.add(screenPlaceholderRoot);
  
    // Find mesh inside scene
    screenPlaceholderMesh = null;
    screenPlaceholderRoot.traverse((child) => {
      if (child.isMesh) {
        screenPlaceholderMesh = child;
        console.log('Found mesh:', child.name);
      }
    });
  
    if (!screenPlaceholderMesh) {
      console.warn('No mesh found inside screenPlaceholder2.glb');
      return;


      
    }
  
    // Compute bounding box of the mesh geometry
    screenPlaceholderMesh.geometry.computeBoundingBox();
    const bbox = screenPlaceholderMesh.geometry.boundingBox;
  
    // Log bounding box size (real size of mesh in world units)
    const size = new THREE.Vector3();
    bbox.getSize(size);
    console.log('Mesh bounding box size (width, height, depth):', size);
  
    // Get center of bounding box in local space
    const localCenter = new THREE.Vector3();
    bbox.getCenter(localCenter);
  
    // Update world matrix to get accurate world position
    screenPlaceholderMesh.updateWorldMatrix(true, false);
  
    // Transform local center to world position
    const worldCenter = localCenter.clone().applyMatrix4(screenPlaceholderMesh.matrixWorld);
    console.log('Mesh center in world space:', worldCenter);
  
    console.log('Use the bounding box size above as the real physical scale of your mesh for manual CSS3DObject scale setting.');
  
  }, undefined, (error) => {
    console.error('Error loading screenPlaceholder2:', error);
  });
  
  


  // Event listeners
  window.addEventListener('resize', onWindowResize, false);
  window.addEventListener('click', onClick, false);

  setTimeout(()=> {
    startIntroCameraAnimation();
  }, 1500);
  window.camera = camera;
  window.controls = controls;
}

function onClick(event) {
  if (zooming || !powerButtonMesh) return;

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(powerButtonMesh, true);

  if (intersects.length > 0) {
    console.log('Power button clicked');
    startZoom();
  }

  const testDiv = document.createElement('div');
testDiv.textContent = "HELLO";
testDiv.style.background = "red";
testDiv.style.width = "200px";
testDiv.style.height = "100px";

//const testObject = new CSS3DObject(testDiv);
//testObject.position.set(0, 2, 2);
//scene.add(testObject);

}

function startZoom() {
    zooming = true;
  
    const startPos = camera.position.clone();
    const targetPos = new THREE.Vector3(0, 2, 2.5);
  
    const startTarget = controls.target.clone();
    const endTarget = new THREE.Vector3(0, 2, 0);
  
    const duration = 2000;
    const startTime = performance.now();
  
    function animateZoom() {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
  
      camera.position.lerpVectors(startPos, targetPos, t);
      controls.target.lerpVectors(startTarget, endTarget, t);
  
      if (t < 1) {
        requestAnimationFrame(animateZoom);
      } else {
        console.log('Zoom complete');
        showIframe();
      }
    }
  
    animateZoom();
  }
  

function showIframe() {
  // Remove previous CSS3DObjects
  scene.children = scene.children.filter(child => !(child instanceof CSS3DObject));

  const iframe = document.createElement('iframe');
  iframe.src = 'fdl-desktop.html';
  iframe.style.width = '1244px';
  iframe.style.height = '765px';
  iframe.style.border = 'none';
  iframe.style.pointerEvents = 'auto';
  iframe.style.position = 'absolute';

  cssObject = new CSS3DObject(iframe);

  // PLACE AT ORIGIN
  cssObject.position.set(0, 2.080819845199585, .38106998801231384);
  cssObject.rotation.set(0, 0, 0);
  cssObject.scale.set(.0019671403120505376, .0017993858481989026, .002);

  scene.add(cssObject);

  console.log('Iframe added at origin');
}

function updateIframeVisibility() {
    const cameraPos = new THREE.Vector3();
    camera.getWorldPosition(cameraPos);
  
    const checkVisibility = (cssObj) => {
      if (!cssObj) return;
      
      const objPos = new THREE.Vector3();
      cssObj.getWorldPosition(objPos);
  
      const toCamera = cameraPos.clone().sub(objPos).normalize();
  
      const normal = new THREE.Vector3(0, 0, 1);
      normal.applyQuaternion(cssObj.quaternion);
  
      const dot = normal.dot(toCamera);
      cssObj.element.style.display = dot > 0 ? 'block' : 'none';
    };
  
    checkVisibility(cssObject);
    checkVisibility(stickyNoteObject);
    //checkVisibility(lockScene);
  }
  
    
  
  
  
  

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  cssRenderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
  cssRenderer.render(scene, camera);

  updateIframeVisibility();
}

window.addEventListener('keydown', (e) => {
    if (e.key === 'p') {
      console.log('Camera position:', camera.position);
      console.log('Camera lookAt target:', controls.target);
    }
  });
  

function startIntroCameraAnimation() {
    const start = camera.position.clone();
    const end = new THREE.Vector3(0, 2.5, 9.5);
    const startTime = performance.now();
    const duration = 3000;
  
    function animateIntro() {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      camera.position.lerpVectors(start, end, t);
      //camera.lookAt(0, 1, 0);
      controls.target.set(0, 1.5, 0);
  
      if (t < 1) {
        requestAnimationFrame(animateIntro);
      } else {
        enablePowerButtonBlink();
      }
    }
  
    animateIntro();
  }
  
  let blinkingMaterials = [];

  function enablePowerButtonBlink() {
    if (!powerButtonMesh) {
      console.warn('Power button mesh not loaded yet.');
      return;
    }
  
    // Gather all materials
    blinkingMaterials = [];
    powerButtonMesh.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.emissive = new THREE.Color(0x000000);
        blinkingMaterials.push(child.material);
      }
    });
  
    if (blinkingMaterials.length === 0) {
      console.warn('No emissive-capable materials found on power button.');
      return;
    }
  
    blinkingInterval = setInterval(() => {
      blinkingMaterials.forEach((material) => {
        const current = material.emissive.getHex();
        material.emissive.setHex(current === 0xaaaaaa ? 0x000000 : 0xaaaaaa);
      });
    }, 500);
  
    console.log('Power button blinking started');
  }
  function addStickynote() {
    console.log('Adding sticky note as CSS3DObject');
  
    const noteDiv = document.createElement('div');
    noteDiv.innerHTML = `
      <div style="padding: 10px;">
        <h3 style="margin: 0; font-size: 18px;">for mom and dad</h3>
        <p style="margin: 5px 0 0; font-size: 16px;">
        first use 'ls',\n
        then 'cd',\n
        then 'ls' again,\n 
        then 'cat',\n
        and finally 'cd ..' to go back :)
                </p>
            </div>
            `;
  
    noteDiv.style.width = '200px';
    noteDiv.style.height = '160px';
    noteDiv.style.background = '#E7DB7F';
    //noteDiv.style.border = '2px solid black';
    noteDiv.style.boxShadow = '4px 4px 10px rgba(0,0,0,0.5)';
    noteDiv.style.fontFamily = '"Comic Sans MS", cursive, sans-serif';
    noteDiv.style.color = 'black';
    noteDiv.style.display = 'flex';
    noteDiv.style.flexDirection = 'column';
    noteDiv.style.justifyContent = 'center';
    noteDiv.style.alignItems = 'center';
    noteDiv.style.textAlign = 'center';
    noteDiv.style.boxSizing = 'border-box';
  
    const stickyNote = new CSS3DObject(noteDiv);
    stickyNote.position.set(1.2, 2.65, 0.5);  // adjust position in front of screen
    stickyNote.rotation.set(0, 0, -.33);
    stickyNote.scale.set(0.002, 0.002, 0.002);  // adjust scale to match your scene
  
    stickyNoteObject = stickyNote;
    scene.add(stickyNoteObject);

  
    console.log('Sticky note added as CSS3DObject with text!');
  }
  
  function removeIframeAndStickyNote() {
    if (cssObject) {
      scene.remove(cssObject);
      cssObject = null;
      console.log('Removed iframe from scene.');
    }
  
    if (stickyNoteObject) {
      scene.remove(stickyNoteObject);
      stickyNoteObject = null;
      console.log('Removed sticky note from scene.');
    }
  }

  function startSessionFadeOut() {
    console.log('Starting fade-out sequence...');
  
    // 1. Gather objects to fade out
    let fadeOutObjects = [];
    scene.traverse((obj) => {
      if (obj.isMesh) fadeOutObjects.push(obj);
    });
    if (cssObject) fadeOutObjects.push(cssObject);
    if (stickyNoteObject) fadeOutObjects.push(stickyNoteObject);
  
    // Timing configuration
    const initialPause = 3000;     // wait BEFORE starting fadeout
    const fadeOutDuration = 2000;  // fade out time
    const blackoutPause = 1500;    // pause on black before goodbye
    const fadeInDuration = 2000;   // fade in goodbye text
  
    // NEW STEP: wait before *starting* the fade-out
    setTimeout(() => {
      console.log('Initial pause complete. Beginning fade-out.');
  
      const fadeOutStartTime = performance.now();
  
      function fadeOutStep() {
        if (screenMesh) {
            screenMesh.visible = false;
          }
        const elapsed = performance.now() - fadeOutStartTime;
        const t = Math.min(elapsed / fadeOutDuration, 1);
        const opacity = 1 - t;
  
        fadeOutObjects.forEach(obj => {
          if (obj.material && 'opacity' in obj.material) {
            obj.material.transparent = true;
            obj.material.opacity = opacity;
          }
          if (obj instanceof CSS3DObject) {
            obj.element.style.opacity = opacity;
          }
        });
  
        if (t < 1) {
          requestAnimationFrame(fadeOutStep);
        } else {
          // Fully faded out, remove from scene
          fadeOutObjects.forEach(obj => scene.remove(obj));
          console.log('Fade-out complete. Blackout pause begins.');
  
          // Pause on black screen
          setTimeout(() => {
            fadeInGoodbyeText();
          }, blackoutPause);
        }
      }
  
      requestAnimationFrame(fadeOutStep);
    }, initialPause);
  
    // Function to show and fade in the goodbye message
    function fadeInGoodbyeText() {
      showGoodbyeMessage();
  
      const fadeInStartTime = performance.now();
  
      function fadeInStep() {
        const elapsed = performance.now() - fadeInStartTime;
        const t = Math.min(elapsed / fadeInDuration, 1);
  
        if (goodbyeCSS) {
          goodbyeCSS.element.style.opacity = t;
        }
  
        if (t < 1) {
          requestAnimationFrame(fadeInStep);
        } else {
          console.log('Goodbye message fade-in complete');
        }
      }
  
      requestAnimationFrame(fadeInStep);
    }
  }
  
  
  let goodbyeCSS = null;

  function showGoodbyeMessage() {
    const goodbyeDiv = document.createElement('div');
    goodbyeDiv.innerHTML = `
      <div style="
        color: #0f0;
        font-size: 32px;
        font-family: 'Courier New', Courier, monospace;
        text-align: center;
        width: 400px;
      ">
        goodbye forever now...
      </div>
    `;
    goodbyeDiv.style.opacity = '0'; // start fully transparent
    goodbyeDiv.style.background = 'transparent';
    goodbyeDiv.style.pointerEvents = 'none';
  
    goodbyeCSS = new CSS3DObject(goodbyeDiv);
  
    // Position the text where the screen would be
    goodbyeCSS.position.set(0, 2.08, 0.381); // Same as iframe
    goodbyeCSS.rotation.set(0, 0, 0);
    goodbyeCSS.scale.set(0.002, 0.002, 0.002);
  
    scene.add(goodbyeCSS);
  
    console.log('Goodbye message added to scene.');
  }
  
  
  
  //.0019671403120505376, .0017993858481989026, .002
  window.addEventListener('keydown', (e) => {
    if (e.key === 'r' && e.shiftKey) {
      console.log('Resetting scene overlay and iframe...');
      removeIframeAndStickyNote();
    }
  });
    
  
  
  
