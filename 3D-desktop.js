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
let EXPIRY_DATE = null;
let bypassed = false;

init();
animate();
window.addEventListener('message', (event) => {
  console.log('Parent page received postMessage:', event.data);

  if (
    event.data &&
    event.data.action === 'sessionExpired' &&
    !bypassed
  ) {
    console.log('Received sessionExpired (not resurrected)');
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
  }
  if (event.data && event.data.action === "summonPassword") {
    summonPasswordPrompt();
  }
});

function init() {
  console.log('Init function running');

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.001, 100);

  camera.position.set(7.5, 5.5, 4);
  console.log('Camera position:', camera.position);



cssRenderer = new CSS3DRenderer();
cssRenderer.setSize(window.innerWidth, window.innerHeight);
cssRenderer.domElement.style.position = 'absolute';
cssRenderer.domElement.style.top = '0';
cssRenderer.domElement.style.left = '0';
document.body.appendChild(cssRenderer.domElement);
cssRenderer.domElement.style.pointerEvents = 'none';
cssRenderer.domElement.style.zIndex = '10'; 

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);
  console.log('Renderer initialized');

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.target.set(7.5, 5.5, 4);
controls.update();
 
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
  directionalLight.position.set(5, 5, 5);
  scene.add(directionalLight);

  const pointLight = new THREE.PointLight(0xffffff, 1);
  pointLight.position.set(2, 3, 4);
  scene.add(pointLight);

  
  const gridHelper = new THREE.GridHelper(1000, 1000);
  scene.add(gridHelper);
  
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();
  
  const loader = new GLTFLoader();
  
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

  loader.load(
    './Computer3dAssets/screen2.glb',
    (gltf) => {
      screenMesh = gltf.scene;
        
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
    
    screenPlaceholderRoot = gltf.scene;
    screenPlaceholderRoot.visible = false;
    scene.add(screenPlaceholderRoot);
      
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
      
    screenPlaceholderMesh.geometry.computeBoundingBox();
    const bbox = screenPlaceholderMesh.geometry.boundingBox;
     
    const size = new THREE.Vector3();
    bbox.getSize(size);
    console.log('Mesh bounding box size (width, height, depth):', size);
      
    const localCenter = new THREE.Vector3();
    bbox.getCenter(localCenter);
      
    screenPlaceholderMesh.updateWorldMatrix(true, false);
    
    const worldCenter = localCenter.clone().applyMatrix4(screenPlaceholderMesh.matrixWorld);
    console.log('Mesh center in world space:', worldCenter);
  
    console.log('Use the bounding box size above as the real physical scale of your mesh for manual CSS3DObject scale setting.');
  
  }, undefined, (error) => {
    console.error('Error loading screenPlaceholder2:', error);
  });
    
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

const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

window.showIframe = function (resurrecting) {
  
  scene.children = scene.children.filter(child => !(child instanceof CSS3DObject));

if (isSafari) {
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.bottom = '50px';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.background = 'rgba(0, 0, 0, 0)';
  overlay.style.color = '#0f0';
  overlay.style.zIndex = '9999';
  overlay.style.display = 'flex';
  overlay.style.flexDirection = 'column';
  overlay.style.justifyContent = 'center';
  overlay.style.alignItems = 'center';
  overlay.style.textAlign = 'center';
  overlay.innerHTML = `
    <div style="
      max-width: 600px;
      font-family: 'Courier New', Courier, monospace;
      font-size: 1.5rem;
      line-height: 1.6;
    ">
      <p>Sowwwwyyyyy!!! (╥﹏╥) This jouwney is not suppowted on Safawi 🧭🚫 ｡°(°.◜ᯅ◝°)°｡</p>
      <p>Pwease use a diffewent bwowsuh, wike Chwome 4 the fuww expewience ૮꒰◞ ˕ ◟ ྀི꒱ა</p>
    </div>
  `;

  document.body.appendChild(overlay);
  throw new Error("Safari not supported.");
}

  const iframe = document.createElement('iframe');
  iframe.src = resurrecting ? 'fdl-desktop.html?bypassed=1' : 'fdl-desktop.html';
  iframe.style.width = '1244px';
  iframe.style.height = '765px';
  iframe.style.border = 'none';
  iframe.style.pointerEvents = 'auto';
  iframe.style.position = 'absolute';

  cssObject = new CSS3DObject(iframe);  
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
      <div style="padding: 5px;">
        <h3 style="margin: 0; font-size: 18px;">for mom and dad</h3>
        <p style="margin: 5px 0 0; font-size: 13px;">
        (1)st use 'ls',<br>
        (2)nd 'cd "folder name"',<br>
        (3)rd 'ls' to show folder items,<br>
        (4)th 'cat "folder item"',<br>
        (f)inally 'cd ..' to go back :)<br>
        rinse and repeat (づ ᴗ _ᴗ)づ♡
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
    stickyNote.position.set(1.2, 2.63, 0.5);  
    stickyNote.rotation.set(0, 0, -.33);
    stickyNote.scale.set(0.002, 0.002, 0.002);  
  
    stickyNoteObject = stickyNote;
    scene.add(stickyNoteObject);
 
    console.log('Sticky note added as CSS3DObject with text!');
  }
  
  window.removeIframeAndStickyNote = function() {
    if (cssObject) {
      scene.remove(cssObject);
      cssObject = null;
    }

    if (stickyNoteObject) {
      scene.remove(stickyNoteObject);
      stickyNoteObject = null;
      console.log('Removed sticky note from scene.');
    }
  }

  function startSessionFadeOut() {
    console.log('Starting fade-out sequence...');
    let fadeOutObjects = [];
    scene.traverse((obj) => {
      if (obj.isMesh) fadeOutObjects.push(obj);
    });
    if (cssObject) fadeOutObjects.push(cssObject);
    if (stickyNoteObject) fadeOutObjects.push(stickyNoteObject);
 
    const initialPause = 3000;     
    const fadeOutDuration = 2000;
    const blackoutPause = 1500;  
    const fadeInDuration = 2000; 
      
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
          fadeOutObjects.forEach(obj => scene.remove(obj));
          console.log('Fade-out complete. Blackout pause begins.');
  
          setTimeout(() => {
            fadeInGoodbyeText();
          }, blackoutPause);
        }
      }
  
      requestAnimationFrame(fadeOutStep);
    }, initialPause);
    
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
  <div id="goodbye-text" style="
    color: #0f0;
    font-size: 32px;
    font-family: 'Courier New', Courier, monospace;
    text-align: center;
    width: 400px;
    position: relative;
    user-select: none;
  ">
    good<span data-letter="b">b</span>ye f<span data-letter="o">o</span>rever n<span data-letter="o">o</span>w...
  </div>
`;

    goodbyeDiv.style.opacity = '0';
    goodbyeDiv.style.background = 'transparent';
    goodbyeDiv.style.pointerEvents = 'none';
  
    goodbyeCSS = new CSS3DObject(goodbyeDiv);
    goodbyeCSS.element.style.pointerEvents = "auto";

    goodbyeCSS.position.set(0, 2.08, 0.381);
    goodbyeCSS.rotation.set(0, 0, 0);
    goodbyeCSS.scale.set(0.002, 0.002, 0.002);
  
    scene.add(goodbyeCSS);
    
let ritual = [];
const target = ["b","o","o"];

const letters = goodbyeDiv.querySelectorAll("[data-letter]");
letters.forEach(el => {
  el.style.pointerEvents = "auto";        
  el.style.cursor = "default";           
  el.style.background = "rgba(0,0,0,0)"; 
  el.addEventListener("click", () => {
    const l = el.dataset.letter;
    ritual.push(l);
    
    for (let i = 0; i < ritual.length; i++) {
      if (ritual[i] !== target[i]) {
        ritual = [];
        return;
      }
    }
    if (ritual.length === 3) {
      ritual = [];
      summonPasswordPrompt();
    }
  });
});

function summonPasswordPrompt() {
  const promptDiv = document.createElement("div");
  promptDiv.style.position = "fixed";
  promptDiv.style.top = "50%";
  promptDiv.style.left = "50%";
  promptDiv.style.transform = "translate(-50%, -50%)";
  promptDiv.style.background = "black";
  promptDiv.style.color = "#0f0";
  promptDiv.style.padding = "20px";
  promptDiv.style.border = "1px solid #0f0";
  promptDiv.style.fontFamily = "Courier New, monospace";
  promptDiv.style.fontSize = "16px";
  promptDiv.style.zIndex = "9999";
  promptDiv.style.display = "flex";
  promptDiv.style.flexDirection = "column";
  promptDiv.style.alignItems = "center";

  const input = document.createElement("input");
  input.type = "password";
  input.placeholder = "Enter password";
  input.style.background = "black";
  input.style.color = "#0f0";
  input.style.border = "1px solid #0f0";
  input.style.fontFamily = "Courier New, monospace";
  input.style.fontSize = "16px";
  input.style.padding = "8px";
  input.style.marginTop = "10px";
  input.style.width = "300px";

  promptDiv.appendChild(input);
  document.body.appendChild(promptDiv);

  setTimeout(() => input.focus(), 50);

  input.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      if (input.value.trim() === "oh, it's been forever hasn't it...") {
        document.body.removeChild(promptDiv);
        window.resurrect();
      } else {
        input.value = "";
      }
    }
  });
}
}
  //.0019671403120505376, .0017993858481989026, .002
  window.addEventListener('keydown', (e) => {
    if (e.key === 'r' && e.shiftKey) {
      console.log('Resetting scene overlay and iframe...');
      removeIframeAndStickyNote();
    }
  });

window.resurrect = function () {
  console.log("Resurrection triggered");

  bypassed = true;

  if (window.removeIframeAndStickyNote) {
    window.removeIframeAndStickyNote();
  }
  if (window.showIframe) {
    window.showIframe(true);
  }
  console.log("Resurrection complete");
};
//let go (easier said than done lmfao)
