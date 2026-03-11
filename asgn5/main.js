import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js";
import { PointerLockControls } from "https://unpkg.com/three@0.160.0/examples/jsm/controls/PointerLockControls.js";
import { GLTFLoader } from "https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x9d958a, 10, 45);

// ---------- Renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// ---------- Camera ----------
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  500
);
camera.position.set(12, 8, 14);

// ---------- Controls ----------
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.2, 0);
controls.enableDamping = true;
controls.minDistance = 4;
controls.maxDistance = 40;

// ---------- First-person roam mode ----------
const fpControls = new PointerLockControls(camera, document.body);

let isFirstPerson = false;
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;

const fpVelocity = new THREE.Vector3();
const fpDirection = new THREE.Vector3();
const fpEyeHeight = 0.8;
const fpSpeed = 4.2;

let roamHintGroup = null;
let roamLabelSprite = null;

const collisionMeshes = [];
const playerRadius = 0.35;

// ---------- Skybox ----------
const cubeLoader = new THREE.CubeTextureLoader();
const skybox = cubeLoader.load([
  "./skybox/px.jpg",
  "./skybox/nx.jpg",
  "./skybox/py.jpg",
  "./skybox/ny.jpg",
  "./skybox/pz.jpg",
  "./skybox/nz.jpg",
]);
scene.background = skybox;
scene.environment = skybox;

// ---------- Lights ----------
const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xfff2cc, 1.8);
directionalLight.position.set(8, 16, 6);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.left = -30;
directionalLight.shadow.camera.right = 30;
directionalLight.shadow.camera.top = 30;
directionalLight.shadow.camera.bottom = -30;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 80;
scene.add(directionalLight);

const pointLight = new THREE.PointLight(0xffd27f, 2.2, 50);
pointLight.position.set(-6, 6, -2);
pointLight.castShadow = true;
scene.add(pointLight);

// ---------- Textures ----------
const textureLoader = new THREE.TextureLoader();

const cobbleTex = textureLoader.load("./textures/cobblestone.jpg");
cobbleTex.wrapS = THREE.RepeatWrapping;
cobbleTex.wrapT = THREE.RepeatWrapping;
cobbleTex.repeat.set(10, 10);

const woodTex = textureLoader.load("./textures/wood.jpg");
woodTex.wrapS = THREE.RepeatWrapping;
woodTex.wrapT = THREE.RepeatWrapping;
woodTex.repeat.set(2, 2);

const brickTex = textureLoader.load("./textures/brick.jpg");
brickTex.wrapS = THREE.RepeatWrapping;
brickTex.wrapT = THREE.RepeatWrapping;
brickTex.repeat.set(2, 2);

const metalTex = textureLoader.load("./textures/iron.jpg");
metalTex.wrapS = THREE.RepeatWrapping;
metalTex.wrapT = THREE.RepeatWrapping;
metalTex.repeat.set(1, 1);

// ---------- Materials ----------
const cobbleMat = new THREE.MeshStandardMaterial({ map: cobbleTex });
const woodMat = new THREE.MeshStandardMaterial({ map: woodTex });
const brickMat = new THREE.MeshStandardMaterial({ map: brickTex });
const metalMat = new THREE.MeshStandardMaterial({ map: metalTex });

const darkMetalMat = new THREE.MeshStandardMaterial({
  color: 0x2e3138,
  metalness: 0.6,
  roughness: 0.5,
});

const cardboardMat = new THREE.MeshStandardMaterial({
  color: 0x8a6a46,
  roughness: 0.95,
});

const glowMat = new THREE.MeshStandardMaterial({
  color: 0x66d9ff,
  emissive: 0x44ccff,
  emissiveIntensity: 2.0,
});

const wallMat = new THREE.MeshStandardMaterial({
  color: 0x9d958a,
  roughness: 1.0,
});

// ---------- Ground ----------
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40),
  cobbleMat
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// ---------- Back wall / alley walls ----------
const backWall = new THREE.Mesh(
  new THREE.BoxGeometry(20, 10, 0.8),
  wallMat
);
backWall.position.set(0, 5, -10);
backWall.castShadow = true;
backWall.receiveShadow = true;
scene.add(backWall);
addCollider(backWall);

const leftWall = new THREE.Mesh(
  new THREE.BoxGeometry(0.8, 10, 20),
  wallMat
);
leftWall.position.set(-10, 5, 0);
leftWall.castShadow = true;
leftWall.receiveShadow = true;
scene.add(leftWall);
addCollider(leftWall);

const rightWall = new THREE.Mesh(
  new THREE.BoxGeometry(0.8, 10, 20),
  wallMat
);
rightWall.position.set(10, 5, 0);
rightWall.castShadow = true;
rightWall.receiveShadow = true;
scene.add(rightWall);
addCollider(rightWall);

// ---------- Door ----------
const door = new THREE.Mesh(
  new THREE.BoxGeometry(4, 6, 0.3),
  new THREE.MeshStandardMaterial({ color: 0x6b4328 })
);
door.position.set(0, 3, -9.45);
door.castShadow = true;
scene.add(door);
addCollider(door);

// ---------- Steps ----------
const step1 = new THREE.Mesh(new THREE.BoxGeometry(5, 0.5, 1.2), wallMat);
step1.position.set(0, 0.25, -7.6);
step1.castShadow = true;
step1.receiveShadow = true;
scene.add(step1);
addCollider(step1);

const step2 = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.5, 1.0), wallMat);
step2.position.set(0, 0.75, -8.2);
step2.castShadow = true;
step2.receiveShadow = true;
scene.add(step2);
addCollider(step2);

const step3 = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.5, 0.8), wallMat);
step3.position.set(0, 1.25, -8.7);
step3.castShadow = true;
step3.receiveShadow = true;
scene.add(step3);
addCollider(step3);

// ---------- Giant props ----------
const primitives = [];

// Trash can
const trashCan = new THREE.Mesh(
  new THREE.CylinderGeometry(1.6, 1.9, 4.5, 24),
  darkMetalMat
);
trashCan.position.set(7, 2.25, -1);
trashCan.castShadow = true;
trashCan.receiveShadow = true;
scene.add(trashCan);
addCollider(trashCan);
primitives.push(trashCan);

// Trash can lid
const trashLid = new THREE.Mesh(
  new THREE.CylinderGeometry(1.95, 1.95, 0.25, 24),
  darkMetalMat
);
trashLid.position.set(7, 4.6, -1);
trashLid.rotation.z = 0.08;
trashLid.castShadow = true;
scene.add(trashLid);
addCollider(trashLid);
primitives.push(trashLid);

// Pipe 1
const pipe1 = new THREE.Mesh(
  new THREE.CylinderGeometry(0.25, 0.25, 8, 16),
  metalMat
);
pipe1.position.set(-6.5, 5, -4);
pipe1.castShadow = true;
scene.add(pipe1);
primitives.push(pipe1);

// Pipe 2
const pipe2 = new THREE.Mesh(
  new THREE.CylinderGeometry(0.22, 0.22, 5.5, 16),
  metalMat
);
pipe2.position.set(-5.2, 4.5, -6);
pipe2.rotation.z = 0.2;
pipe2.castShadow = true;
scene.add(pipe2);
primitives.push(pipe2);

function addCollider(mesh) {
  collisionMeshes.push(mesh);
  return mesh;
}

// Crates / boxes
function makeBox(w, h, d, x, y, z, material, rotY = 0, rotZ = 0) {
  const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  box.position.set(x, y, z);
  box.rotation.y = rotY;
  box.rotation.z = rotZ;
  box.castShadow = true;
  box.receiveShadow = true;
  scene.add(box);
  primitives.push(box);
  addCollider(box);
  return box;
}

makeBox(2.2, 2.0, 2.2, -6.2, 1.0, 1.5, cardboardMat, 0.25);
makeBox(1.6, 1.3, 1.6, -3.8, 0.65, 1.7, cardboardMat, -0.2);
makeBox(2.5, 1.8, 2.0, 4.0, 0.9, 2.8, cardboardMat, 0.15);
makeBox(1.8, 1.5, 1.6, 6.3, 0.75, 4.8, cardboardMat, -0.15);
makeBox(2.3, 1.7, 2.1, 2.0, 0.85, 5.8, cardboardMat, 0.1);

// Wooden ramps / planks
const ramp1 = makeBox(5.5, 0.2, 1.3, -5.9, 1.2, -3.0, woodMat, 0.08, -0.28);
const ramp2 = makeBox(4.5, 0.2, 1.0, 3.4, 0.95, 0.6, woodMat, -0.15, 0.22);

// Giant cans
const can1 = new THREE.Mesh(
  new THREE.CylinderGeometry(0.7, 0.7, 2.0, 20),
  metalMat
);
can1.position.set(-1.5, 0.0, 2.8);
can1.rotation.z = 0.4;
can1.castShadow = true;
can1.receiveShadow = true;
scene.add(can1);
primitives.push(can1);

const can2 = new THREE.Mesh(
  new THREE.CylinderGeometry(0.8, 0.8, 2.4, 20),
  metalMat
);
can2.position.set(7.2, 1.2, 2.7);
can2.rotation.z = -0.65;
can2.castShadow = true;
can2.receiveShadow = true;
scene.add(can2);
primitives.push(can2);

// Small debris spheres
function makeSphere(r, x, y, z, color) {
  const s = new THREE.Mesh(
    new THREE.SphereGeometry(r, 20, 20),
    new THREE.MeshStandardMaterial({ color })
  );
  s.position.set(x, y, z);
  s.castShadow = true;
  s.receiveShadow = true;
  scene.add(s);
  primitives.push(s);
  return s;
}

makeSphere(0.55, -2.5, 0.55, -2.2, 0x5b3a29);
makeSphere(0.45, 2.0, 0.45, -1.5, 0x6f7f2f);
makeSphere(0.38, 4.0, 0.38, -3.8, 0x8a4b2a);

// Collectibles / wow feature
const collectible1 = new THREE.Mesh(
  new THREE.SphereGeometry(0.3, 20, 20),
  glowMat
);
collectible1.position.set(-4.4, 3.4, -3.0);
collectible1.castShadow = true;
scene.add(collectible1);
primitives.push(collectible1);

const collectible2 = new THREE.Mesh(
  new THREE.SphereGeometry(0.3, 20, 20),
  glowMat
);
collectible2.position.set(2.3, 2.45, 0.8);
collectible2.castShadow = true;
scene.add(collectible2);
primitives.push(collectible2);

const collectible3 = new THREE.Mesh(
  new THREE.SphereGeometry(0.3, 20, 20),
  glowMat
);
collectible3.position.set(0, 2.3, -7.8);
collectible3.castShadow = true;
scene.add(collectible3);
primitives.push(collectible3);

// Window-light helper spheres
const lightOrb1 = new THREE.Mesh(
  new THREE.SphereGeometry(0.22, 16, 16),
  new THREE.MeshStandardMaterial({
    color: 0xfff0c0,
    emissive: 0xffdd99,
    emissiveIntensity: 1.2
  })
);
lightOrb1.position.set(-6, 5.5, -7.6);
scene.add(lightOrb1);
primitives.push(lightOrb1);

const lightOrb2 = new THREE.Mesh(
  new THREE.SphereGeometry(0.22, 16, 16),
  new THREE.MeshStandardMaterial({
    color: 0xfff0c0,
    emissive: 0xffdd99,
    emissiveIntensity: 1.2
  })
);
lightOrb2.position.set(6.2, 5.2, -7.8);
scene.add(lightOrb2);
primitives.push(lightOrb2);

// Optional extra shapes to comfortably exceed 20
makeBox(1.2, 1.2, 1.2, -7.5, 0.6, 4.5, cardboardMat, 0.15);
makeBox(1.5, 0.8, 1.0, 6.0, 0.4, -4.2, cardboardMat, -0.15);
makeBox(1.8, 0.4, 1.4, -1.0, 0.2, 6.5, woodMat, 0.25);

// ---------- Traversal add-ons: make every orb reachable ----------

// A few helper routes / platforms without replacing your original layout

// ---- Left route: up toward collectible1 and lightOrb1 ----
// Ground-to-mid stack near left wall
makeBox(1.4, 0.6, 1.4, -7.4, 0.3, -1.8, cardboardMat, 0.1);
makeBox(1.4, 1.2, 1.4, -6.6, 0.6, -2.7, cardboardMat, -0.1);
makeBox(1.5, 1.8, 1.5, -5.6, 0.9, -3.5, cardboardMat, 0.12);
makeBox(1.6, 2.4, 1.6, -4.7, 1.2, -4.5, cardboardMat, -0.08);

// Small plank walkway near collectible1
makeBox(2.4, 0.18, 0.9, -4.8, 2.35, -3.2, woodMat, 0.15, 0.0);

// Higher stack toward the left yellow orb
makeBox(1.5, 3.0, 1.5, -7.2, 1.5, -6.0, cardboardMat, 0.08);
makeBox(1.5, 3.8, 1.5, -6.3, 1.9, -7.0, cardboardMat, -0.05);
makeBox(1.5, 4.6, 1.5, -5.3, 2.3, -7.8, cardboardMat, 0.12);

// Narrow final ledge under lightOrb1
makeBox(2.2, 0.2, 1.0, -5.9, 4.7, -7.5, woodMat, 0.0, 0.0);

// Leaning support beam on left for visual readability
const leftPole = new THREE.Mesh(
  new THREE.CylinderGeometry(0.14, 0.14, 4.6, 12),
  woodMat
);
leftPole.position.set(-6.9, 2.2, -5.2);
leftPole.rotation.z = 0.52;
leftPole.castShadow = true;
leftPole.receiveShadow = true;
scene.add(leftPole);
primitives.push(leftPole);

// ---- Center route: make collectible2 more intentionally attainable ----
makeBox(1.2, 0.6, 1.2, 0.5, 0.3, -0.2, cardboardMat, 0.08);
makeBox(1.2, 1.2, 1.2, 1.3, 0.6, 0.2, cardboardMat, -0.08);
makeBox(1.2, 1.8, 1.2, 2.0, 0.9, 0.6, cardboardMat, 0.12);

// Little platform just beneath collectible2
makeBox(1.8, 0.18, 1.2, 2.2, 1.95, 0.8, woodMat, -0.12, 0.0);

// ---- Right route: up toward lightOrb2 ----
makeBox(1.4, 0.7, 1.4, 7.6, 0.35, -2.8, cardboardMat, -0.08);
makeBox(1.4, 1.4, 1.4, 7.0, 0.7, -4.0, cardboardMat, 0.1);
makeBox(1.4, 2.2, 1.4, 6.5, 1.1, -5.3, cardboardMat, -0.12);
makeBox(1.5, 3.0, 1.5, 6.2, 1.5, -6.5, cardboardMat, 0.08);
makeBox(1.5, 3.8, 1.5, 6.0, 1.9, -7.6, cardboardMat, -0.06);

// Final catwalk under right yellow orb
makeBox(2.4, 0.2, 1.0, 6.2, 4.8, -7.6, woodMat, 0.0, 0.0);

// A diagonal plank from the mid-right area into the upper-right route
const rightBridge = makeBox(5.0, 0.2, 1.0, 5.5, 2.7, -5.4, woodMat, -0.45, 0.38);

// Extra tall post so the right side feels designed, not random
const rightSupport = new THREE.Mesh(
  new THREE.CylinderGeometry(0.16, 0.16, 5.8, 12),
  woodMat
);
rightSupport.position.set(7.7, 2.9, -6.1);
rightSupport.rotation.z = -0.4;
rightSupport.castShadow = true;
rightSupport.receiveShadow = true;
scene.add(rightSupport);
primitives.push(rightSupport);

function createTextSprite(message) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  canvas.width = 1024;
  canvas.height = 256;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(20, 28, 40, 0.72)";
  ctx.beginPath();
  ctx.roundRect(20, 30, 984, 170, 28);
  ctx.fill();

  ctx.strokeStyle = "rgba(102, 217, 255, 0.9)";
  ctx.lineWidth = 6;
  ctx.stroke();

  ctx.fillStyle = "#c9f6ff";
  ctx.font = "bold 58px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(message, canvas.width / 2, canvas.height / 2 + 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });

  const sprite = new THREE.Sprite(material);
  sprite.scale.set(3.2, 0.8, 1);
  return sprite;
}


function createRoamHint() {
  const hintGroup = new THREE.Group();

  const arrowMat = new THREE.MeshStandardMaterial({
    color: 0x66d9ff,
    emissive: 0x44ccff,
    emissiveIntensity: 1.8,
    roughness: 0.35,
    metalness: 0.15,
  });

  // vertical shaft
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 0.65, 12),
    arrowMat
  );
  shaft.position.y = 0.35;
  shaft.castShadow = true;
  hintGroup.add(shaft);

  // downward arrow head
  const head = new THREE.Mesh(
    new THREE.ConeGeometry(0.11, 0.22, 16),
    arrowMat
  );
  head.position.y = -0.05;
  head.rotation.x = Math.PI;
  head.castShadow = true;
  hintGroup.add(head);

  roamLabelSprite = createTextSprite("Press Q to roam around as him");
  roamLabelSprite.position.set(0, 1.1, 0);
  hintGroup.add(roamLabelSprite);

  return hintGroup;
}

// ---- Bonus: a back-wall shelf path so the rear collectible route feels stronger ----
makeBox(2.0, 0.35, 1.2, -2.4, 1.7, -6.8, woodMat, 0.05, 0.0);
makeBox(2.0, 0.35, 1.2, 0.0, 2.0, -7.4, woodMat, 0.0, 0.0);
makeBox(2.0, 0.35, 1.2, 2.3, 2.2, -7.0, woodMat, -0.05, 0.0);

// ---------- Character Model ----------
const gltfLoader = new GLTFLoader();
let character = null;

gltfLoader.load(
  "./models/little-guy.glb",
  (gltf) => {
    character = gltf.scene;

    character.scale.set(0.5, 0.5, 0.5);
    character.position.set(-2, 0, 0);
    character.rotation.y = Math.PI * 0.2;

    character.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    scene.add(character);

    roamHintGroup = createRoamHint();
    scene.add(roamHintGroup);
  },
  undefined,
  (error) => {
    console.error("Error loading GLB:", error);
  }
);

// ---------- Fake light-beam planes ----------
const beamMat = new THREE.MeshBasicMaterial({
  color: 0xfff4c8,
  transparent: true,
  opacity: 0.16,
  side: THREE.DoubleSide,
  depthWrite: false,
});

const beam1 = new THREE.Mesh(new THREE.PlaneGeometry(6, 2), beamMat);
beam1.position.set(-5.8, 5.3, -5.8);
beam1.rotation.y = 0.55;
beam1.rotation.z = -0.12;
scene.add(beam1);

const beam2 = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.6), beamMat);
beam2.position.set(5.8, 5.0, -6.2);
beam2.rotation.y = -0.55;
beam2.rotation.z = 0.1;
scene.add(beam2);

// ---------- Count check ----------
console.log("Primitive count:", primitives.length);

function enterFirstPerson() {
  if (!character || isFirstPerson) return;

  isFirstPerson = true;
  controls.enabled = false;

  // hide character because now "you are him"
  character.visible = false;

  // place camera at little-guy position
  camera.position.set(
    character.position.x,
    character.position.y + fpEyeHeight,
    character.position.z
  );

  // reset camera orientation cleanly
  camera.up.set(0, 1, 0);
  camera.rotation.set(0, 0, 0);

  // use character facing direction to build a stable horizontal look target
  const forward = new THREE.Vector3(0, 0, 1);
  forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), character.rotation.y);

  const lookTarget = new THREE.Vector3(
    camera.position.x + forward.x,
    camera.position.y,
    camera.position.z + forward.z
  );

  camera.lookAt(lookTarget);

  if (roamHintGroup) roamHintGroup.visible = false;

  fpControls.lock();
}

function exitFirstPerson() {
  if (!character || !isFirstPerson) return;

  isFirstPerson = false;
  controls.enabled = true;

  // place character where the player ended up
  character.position.set(
    camera.position.x,
    0,
    camera.position.z
  );

  // make character face the same horizontal direction as the camera
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();

  character.rotation.y = Math.atan2(forward.x, forward.z);

  character.visible = true;

  controls.target.set(
    character.position.x,
    1.0,
    character.position.z
  );

  camera.position.set(
    character.position.x + 6,
    character.position.y + 4,
    character.position.z + 7
  );

  camera.up.set(0, 1, 0);

  if (roamHintGroup) roamHintGroup.visible = true;

  fpControls.unlock();
}

window.addEventListener("keydown", (event) => {
  switch (event.code) {
    case "KeyQ":
      if (isFirstPerson) {
        exitFirstPerson();
      } else {
        enterFirstPerson();
      }
      break;
    case "KeyW":
      moveForward = true;
      break;
    case "KeyS":
      moveBackward = true;
      break;
    case "KeyA":
      moveLeft = true;
      break;
    case "KeyD":
      moveRight = true;
      break;
  }
});

window.addEventListener("keyup", (event) => {
  switch (event.code) {
    case "KeyW":
      moveForward = false;
      break;
    case "KeyS":
      moveBackward = false;
      break;
    case "KeyA":
      moveLeft = false;
      break;
    case "KeyD":
      moveRight = false;
      break;
  }
});

document.addEventListener("pointerlockchange", () => {
  if (isFirstPerson && document.pointerLockElement !== document.body) {
    exitFirstPerson();
  }
});

// ---------- Resize ----------
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});


const tempBox = new THREE.Box3();
const expandedBox = new THREE.Box3();

function collidesAt(position) {
  for (const mesh of collisionMeshes) {
    tempBox.setFromObject(mesh);

    // ignore objects that are clearly above the player
    if (tempBox.max.y < 0.0 || tempBox.min.y > 1.8) continue;

    expandedBox.copy(tempBox).expandByScalar(playerRadius);

    if (
      position.x >= expandedBox.min.x &&
      position.x <= expandedBox.max.x &&
      position.z >= expandedBox.min.z &&
      position.z <= expandedBox.max.z
    ) {
      return true;
    }
  }

  return false;
}
// ---------- Animation ----------
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  const t = clock.getElapsedTime();

  collectible1.rotation.y += 0.03;
  collectible1.position.x = -4.4 + Math.sin(t * 0.8) * 0.25;
  collectible1.position.y = 3.4 + Math.sin(t * 2.0) * 0.12;

  collectible2.rotation.y += 0.03;
  collectible2.position.x = 2.3 + Math.sin(t * 2.2 + 1.2) * 0.12;
  collectible2.position.y = 2.45 + Math.sin(t * 2.2 + 1.2) * 0.12;

  collectible3.rotation.y += 0.03;
  collectible3.position.x = 0.0 + Math.sin(t * 1.8 + 2.1) * 0.12;
  collectible3.position.y = 2.3 + Math.sin(t * 1.8 + 2.1) * 0.12;

  lightOrb1.position.y = 5.5 + Math.sin(t * 1.7) * 0.08;
  lightOrb2.position.y = 5.2 + Math.sin(t * 1.9 + 1.1) * 0.08;

  pointLight.intensity = 2.0 + Math.sin(t * 2.5) * 0.25;

  if (character) {
    character.rotation.y = 0.4 + Math.sin(t * 1.2) * 0.08;
  }

    // Floating prompt over the little guy in orbit mode
  if (character && roamHintGroup && !isFirstPerson) {
    roamHintGroup.visible = true;
    roamHintGroup.position.set(
      character.position.x,
      character.position.y + 1.55 + Math.sin(t * 2.4) * 0.08,
      character.position.z
    );
    roamHintGroup.lookAt(camera.position);
  }

  // First-person ground roaming
  if (isFirstPerson) {
    fpDirection.set(0, 0, 0);

    if (moveForward) fpDirection.z += 1;
    if (moveBackward) fpDirection.z -= 1;
    if (moveLeft) fpDirection.x -= 1;
    if (moveRight) fpDirection.x += 1;

    if (fpDirection.lengthSq() > 0) {
      fpDirection.normalize();

      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      forward.y = 0;
      forward.normalize();

      const right = new THREE.Vector3();
      right.crossVectors(forward, camera.up).normalize();

      const move = new THREE.Vector3();
      move.addScaledVector(forward, fpDirection.z * fpSpeed * delta);
      move.addScaledVector(right, fpDirection.x * fpSpeed * delta);

      const nextPosition = camera.position.clone();

      // try X move first
      nextPosition.x += move.x;
      if (!collidesAt(nextPosition)) {
        camera.position.x = nextPosition.x;
      }

      // then try Z move
      nextPosition.copy(camera.position);
      nextPosition.z += move.z;
      if (!collidesAt(nextPosition)) {
        camera.position.z = nextPosition.z;
      }
    }

    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -8.8, 8.8);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -8.8, 8.8);
    camera.position.y = 0 + fpEyeHeight;
  }

  if (!isFirstPerson) {
    controls.update();
  }

  renderer.render(scene, camera);
}

animate();