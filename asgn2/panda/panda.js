

// ===================== SHADERS =====================
const VSHADER_SOURCE = `
attribute vec4 a_Position;
uniform mat4 u_ModelMatrix;
uniform mat4 u_GlobalRotation;
void main() {
  gl_Position = u_GlobalRotation * u_ModelMatrix * a_Position;
}
`;

const FSHADER_SOURCE = `
precision mediump float;
uniform vec4 u_FragColor;
void main() {
  gl_FragColor = u_FragColor;
}
`;

// ===================== GLOBALS =====================
let gl, a_Position, u_ModelMatrix, u_GlobalRotation, u_FragColor;

// UI globals
let gAnimalGlobalRotation = 30; // rotY slider -> global Y rotation (rubric)
let gCameraRotX = 15;           // used for mouse X rotation (still okay)
let g_lShoulder = 25;           // lArm slider -> shoulder joint (level 1)
let g_rShoulder = -25;          // rArm slider -> shoulder joint (level 1)
let g_elbow = 15;               // rotX slider -> elbow joint (level 2) (no HTML change)
let g_animOn = true;            // anim checkbox

// Animation time
let g_startTime = performance.now();
let g_seconds = 0;

// Poke animation state
let g_pokeActive = false;
let g_pokeStart = 0;

// Mouse rotate
let mouseDown = false;
let lastX = 0, lastY = 0;

// Buffers (built once)
let cubeVBO = null;
let cylVBO = null;
let cylVertexCount = 0;

const fpsDiv = document.createElement("div");
fpsDiv.style.position = "fixed";
fpsDiv.style.top = "8px";
fpsDiv.style.right = "8px";
fpsDiv.style.padding = "6px 10px";
fpsDiv.style.background = "rgba(0,0,0,0.6)";
fpsDiv.style.color = "#0f0";
fpsDiv.style.font = "12px monospace";
fpsDiv.style.zIndex = "9999";
fpsDiv.textContent = "FPS: --";
document.body.appendChild(fpsDiv);

let fpsLastTime = performance.now();
let fpsFrameCount = 0;


function mat4Identity() {
  const m = new Float32Array(16);
  m[0]=1; m[5]=1; m[10]=1; m[15]=1;
  return m;
}
function mat4Copy(a) { return new Float32Array(a); }

function mat4Mul(a, b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c*4 + r] =
        a[0*4 + r] * b[c*4 + 0] +
        a[1*4 + r] * b[c*4 + 1] +
        a[2*4 + r] * b[c*4 + 2] +
        a[3*4 + r] * b[c*4 + 3];
    }
  }
  return out;
}

function mat4Translate(m, tx, ty, tz) {
  const t = mat4Identity();
  t[12]=tx; t[13]=ty; t[14]=tz;
  return mat4Mul(m, t);
}
function mat4Scale(m, sx, sy, sz) {
  const s = mat4Identity();
  s[0]=sx; s[5]=sy; s[10]=sz;
  return mat4Mul(m, s);
}
function mat4RotateX(m, deg) {
  const rad = deg * Math.PI / 180;
  const c = Math.cos(rad), s = Math.sin(rad);
  const r = mat4Identity();
  r[5]=c;  r[9]=-s;
  r[6]=s;  r[10]=c;
  return mat4Mul(m, r);
}
function mat4RotateY(m, deg) {
  const rad = deg * Math.PI / 180;
  const c = Math.cos(rad), s = Math.sin(rad);
  const r = mat4Identity();
  r[0]=c;  r[8]=s;
  r[2]=-s; r[10]=c;
  return mat4Mul(m, r);
}
function mat4RotateZ(m, deg) {
  const rad = deg * Math.PI / 180;
  const c = Math.cos(rad), s = Math.sin(rad);
  const r = mat4Identity();
  r[0]=c;  r[4]=-s;
  r[1]=s;  r[5]=c;
  return mat4Mul(m, r);
}

// matrix stack (hierarchy)
const stack = [];
function pushMat(m) { stack.push(mat4Copy(m)); }
function popMat() { return stack.pop(); }

// SHADER UTILS 
function compileShader(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const msg = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(msg);
  }
  return sh;
}
function createProgram(gl, vsSrc, fsSrc) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const msg = gl.getProgramInfoLog(prog);
    gl.deleteProgram(prog);
    throw new Error(msg);
  }
  return prog;
}

// ===================== GEOMETRY BUILDERS (ONCE) =====================

// Single function that builds cube triangles into one buffer (rubric)
function initCubeBuffer() {
  const v = new Float32Array([
    // Front
    -0.5,-0.5, 0.5,   0.5,-0.5, 0.5,   0.5, 0.5, 0.5,
    -0.5,-0.5, 0.5,   0.5, 0.5, 0.5,  -0.5, 0.5, 0.5,
    // Back
    -0.5,-0.5,-0.5,  -0.5, 0.5,-0.5,   0.5, 0.5,-0.5,
    -0.5,-0.5,-0.5,   0.5, 0.5,-0.5,   0.5,-0.5,-0.5,
    // Left
    -0.5,-0.5,-0.5,  -0.5,-0.5, 0.5,  -0.5, 0.5, 0.5,
    -0.5,-0.5,-0.5,  -0.5, 0.5, 0.5,  -0.5, 0.5,-0.5,
    // Right
     0.5,-0.5,-0.5,   0.5, 0.5,-0.5,   0.5, 0.5, 0.5,
     0.5,-0.5,-0.5,   0.5, 0.5, 0.5,   0.5,-0.5, 0.5,
    // Top
    -0.5, 0.5,-0.5,  -0.5, 0.5, 0.5,   0.5, 0.5, 0.5,
    -0.5, 0.5,-0.5,   0.5, 0.5, 0.5,   0.5, 0.5,-0.5,
    // Bottom
    -0.5,-0.5,-0.5,   0.5,-0.5,-0.5,   0.5,-0.5, 0.5,
    -0.5,-0.5,-0.5,   0.5,-0.5, 0.5,  -0.5,-0.5, 0.5,
  ]);

  cubeVBO = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeVBO);
  gl.bufferData(gl.ARRAY_BUFFER, v, gl.STATIC_DRAW);
}

// Non-cube primitive: cylinder built once (simple triangle strip converted to triangles)
function initCylinderBuffer(segments = 20) {
  // Cylinder aligned with Z axis, radius 0.5, z in [-0.5, +0.5]
  const verts = [];
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const x0 = Math.cos(a0) * 0.5, y0 = Math.sin(a0) * 0.5;
    const x1 = Math.cos(a1) * 0.5, y1 = Math.sin(a1) * 0.5;

    // Side quad -> two triangles (z = -0.5 to +0.5)
    verts.push(x0, y0, -0.5,  x1, y1, -0.5,  x1, y1,  0.5);
    verts.push(x0, y0, -0.5,  x1, y1,  0.5,  x0, y0,  0.5);

    // Front cap (z=+0.5)
    verts.push(0,0,0.5,  x1,y1,0.5,  x0,y0,0.5);
    // Back cap (z=-0.5)
    verts.push(0,0,-0.5, x0,y0,-0.5, x1,y1,-0.5);
  }

  const v = new Float32Array(verts);
  cylVertexCount = v.length / 3;

  cylVBO = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cylVBO);
  gl.bufferData(gl.ARRAY_BUFFER, v, gl.STATIC_DRAW);
}

// ===================== DRAW FUNCTIONS =====================

// Rubric: drawCube(Matrix M) — standalone (binds buffer + sets matrix)
function drawCube(M, rgba) {
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeVBO);
  gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(a_Position);

  gl.uniformMatrix4fv(u_ModelMatrix, false, M);
  gl.uniform4f(u_FragColor, rgba[0], rgba[1], rgba[2], rgba[3]);
  gl.drawArrays(gl.TRIANGLES, 0, 36);
}

function drawCylinder(M, rgba) {
  gl.bindBuffer(gl.ARRAY_BUFFER, cylVBO);
  gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(a_Position);

  gl.uniformMatrix4fv(u_ModelMatrix, false, M);
  gl.uniform4f(u_FragColor, rgba[0], rgba[1], rgba[2], rgba[3]);
  gl.drawArrays(gl.TRIANGLES, 0, cylVertexCount);
}

// ===================== GLOBAL ROTATION UNIFORM =====================
function updateGlobalRotationUniform() {
  let G = mat4Identity();
  G = mat4RotateY(G, gAnimalGlobalRotation); // rubric: global axis slider rotation
  G = mat4RotateX(G, gCameraRotX);           // extra (mouse x-rot)
  G = mat4Scale(G, 0.9, 0.9, 0.9);
  gl.uniformMatrix4fv(u_GlobalRotation, false, G);
}

// ===================== ANIMATION (OUTSIDE RENDER) =====================
let g_headBob = 0;
let g_legSwing = 0;
let g_tailWiggle = 0;
let g_pawCurl = 0;

function updateAnimationAngles() {
  if (!g_animOn && !g_pokeActive) return;

  // If poking, override with a short special sequence
  if (g_pokeActive) {
    const p = (g_seconds - g_pokeStart); // seconds since poke
    // 1.0s poke: quick head tilt + bigger arm wave
    const k = Math.max(0, 1 - p / 1.0);
    g_headBob = Math.sin(p * 10) * 10 * k;
    g_legSwing = Math.sin(p * 8) * 8 * k;
    g_tailWiggle = Math.sin(p * 14) * 20 * k;
    g_pawCurl = 35 * k;

    // also wave arms
    g_lShoulder = 60 * k;
    g_rShoulder = -60 * k;

    if (p > 1.0) g_pokeActive = false;
    return;
  }

  // Normal natural-ish loop
  g_headBob = Math.sin(g_seconds * 2.0) * 6;
  g_legSwing = Math.sin(g_seconds * 2.5) * 18;
  g_tailWiggle = Math.sin(g_seconds * 3.2) * 12;
  g_pawCurl = (Math.sin(g_seconds * 4.5) * 10) + 10;

  // swing arms automatically (overrides sliders only when anim is ON)
  const swing = Math.sin(g_seconds * 2.5) * 35;
  g_lShoulder = 20 + swing;
  g_rShoulder = -20 - swing;
}

function renderScene() {
  // Required: clear both buffers
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Required: send global rotation uniform
  updateGlobalRotationUniform();

  const WHITE = [0.95, 0.95, 0.95, 1];
  const BLACK = [0.08, 0.08, 0.08, 1];
  const PINK  = [0.90, 0.55, 0.65, 1];
  const OFFW  = [0.85, 0.85, 0.85, 1];

  // Base animal transform
  let M = mat4Identity();
  M = mat4Translate(M, 0, -0.05, 0);

  // -------------- BODY (part 1) --------------
  let body = mat4Translate(M, 0, -0.05, 0);
  body = mat4Scale(body, 0.55, 0.45, 0.40);
  drawCube(body, WHITE);

  // belly (part 2)
  let belly = mat4Translate(M, 0, -0.05, 0.21);
  belly = mat4Scale(belly, 0.30, 0.28, 0.12);
  drawCube(belly, OFFW);

  // tail (part 3) (animated)
  let tail = mat4Translate(M, 0, -0.02, -0.33);
  tail = mat4RotateY(tail, g_tailWiggle);
  tail = mat4Scale(tail, 0.14, 0.14, 0.14);
  drawCube(tail, BLACK);

  // -------------- HEAD GROUP --------------
  let headBase = mat4Translate(M, 0, 0.38, 0.12);
  headBase = mat4RotateX(headBase, g_headBob);

  // head (part 4)
  let head = mat4Scale(headBase, 0.38, 0.34, 0.30);
  drawCube(head, WHITE);

  // snout as CYLINDER (non-cube primitive!) (part 5)
  let snout = mat4Translate(headBase, 0, -0.10, 0.27);
  snout = mat4RotateX(snout, 90);
  snout = mat4Scale(snout, 0.18, 0.18, 0.22);
  drawCylinder(snout, OFFW);

  // nose (part 6)
  let nose = mat4Translate(headBase, 0, -0.04, 0.34);
  nose = mat4Scale(nose, 0.10, 0.07, 0.06);
  drawCube(nose, BLACK);

  // ears (part 7,8)
  let earL = mat4Translate(headBase, -0.20, 0.22, -0.02);
  earL = mat4Scale(earL, 0.14, 0.14, 0.12);
  drawCube(earL, BLACK);

  let earR = mat4Translate(headBase,  0.20, 0.22, -0.02);
  earR = mat4Scale(earR, 0.14, 0.14, 0.12);
  drawCube(earR, BLACK);

  // eye patches (extra color detail)
  let e1 = mat4Translate(headBase, -0.14, 0.05, 0.26);
  e1 = mat4Scale(e1, 0.14, 0.12, 0.06);
  drawCube(e1, BLACK);

  let e2 = mat4Translate(headBase,  0.14, 0.05, 0.26);
  e2 = mat4Scale(e2, 0.14, 0.12, 0.06);
  drawCube(e2, BLACK);

  // mouth hint
  let mouth = mat4Translate(headBase, 0, -0.15, 0.30);
  mouth = mat4Scale(mouth, 0.12, 0.03, 0.05);
  drawCube(mouth, PINK);

  // using a stack so that the lower parts stay connected.

  // LEFT ARM: shoulder (level 1) -> elbow (level 2) -> paw (level 3)
  let shoulderL = mat4Translate(M, -0.34, 0.10, 0.10);
  shoulderL = mat4RotateZ(shoulderL, g_lShoulder);

  pushMat(shoulderL);
  {
    // upper arm
    let upper = mat4Translate(shoulderL, -0.08, -0.16, 0);
    upper = mat4Scale(upper, 0.18, 0.28, 0.18);
    drawCube(upper, BLACK);

    // elbow frame (attached) - second level joint uses g_elbow (rotX slider)
    let elbowFrame = mat4Translate(shoulderL, -0.08, -0.33, 0);
    elbowFrame = mat4RotateZ(elbowFrame, g_elbow);
    pushMat(elbowFrame);
    {
      // forearm
      let fore = mat4Translate(elbowFrame, 0, -0.10, 0);
      fore = mat4Scale(fore, 0.16, 0.22, 0.16);
      drawCube(fore, BLACK);

      // paw frame (third level joint)
      let pawFrame = mat4Translate(elbowFrame, 0, -0.26, 0.02);
      pawFrame = mat4RotateX(pawFrame, g_pawCurl);
      let paw = mat4Scale(pawFrame, 0.18, 0.10, 0.20);
      drawCube(paw, BLACK);
    }
    popMat();
  }
  popMat();

  // RIGHT ARM: same hierarchy, elbow mirrored
  let shoulderR = mat4Translate(M, 0.34, 0.10, 0.10);
  shoulderR = mat4RotateZ(shoulderR, g_rShoulder);

  pushMat(shoulderR);
  {
    let upper = mat4Translate(shoulderR, 0.08, -0.16, 0);
    upper = mat4Scale(upper, 0.18, 0.28, 0.18);
    drawCube(upper, BLACK);

    let elbowFrame = mat4Translate(shoulderR, 0.08, -0.33, 0);
    elbowFrame = mat4RotateZ(elbowFrame, -g_elbow);
    pushMat(elbowFrame);
    {
      let fore = mat4Translate(elbowFrame, 0, -0.10, 0);
      fore = mat4Scale(fore, 0.16, 0.22, 0.16);
      drawCube(fore, BLACK);

      let pawFrame = mat4Translate(elbowFrame, 0, -0.26, 0.02);
      pawFrame = mat4RotateX(pawFrame, g_pawCurl);
      let paw = mat4Scale(pawFrame, 0.18, 0.10, 0.20);
      drawCube(paw, BLACK);
    }
    popMat();
  }
  popMat();

  // -------------- LEGS (2 legs total) --------------
  // Each leg: hip/thigh (level 1) -> calf (level 2) -> foot (level 3-ish)
  // Uses g_legSwing for a natural walk-ish motion.
  const hipSwing = g_legSwing;
  const kneeBend = 25 + Math.abs(g_legSwing) * 0.6;

  // LEFT LEG
  let hipL = mat4Translate(M, -0.18, -0.30, -0.05);
  hipL = mat4RotateX(hipL, -hipSwing);
  pushMat(hipL);
  {
    // thigh
    let thigh = mat4Translate(hipL, 0, -0.12, 0);
    thigh = mat4Scale(thigh, 0.18, 0.24, 0.18);
    drawCube(thigh, BLACK);

    // knee frame
    let knee = mat4Translate(hipL, 0, -0.26, 0);
    knee = mat4RotateX(knee, kneeBend);
    pushMat(knee);
    {
      // calf
      let calf = mat4Translate(knee, 0, -0.10, 0);
      calf = mat4Scale(calf, 0.16, 0.22, 0.16);
      drawCube(calf, BLACK);

      // foot frame
      let ankle = mat4Translate(knee, 0, -0.24, 0.06);
      ankle = mat4RotateX(ankle, -kneeBend * 0.6);
      let foot = mat4Scale(ankle, 0.22, 0.08, 0.26);
      drawCube(foot, BLACK);
    }
    popMat();
  }
  popMat();

  // RIGHT LEG
  let hipR = mat4Translate(M, 0.18, -0.30, -0.05);
  hipR = mat4RotateX(hipR, hipSwing);
  pushMat(hipR);
  {
    let thigh = mat4Translate(hipR, 0, -0.12, 0);
    thigh = mat4Scale(thigh, 0.18, 0.24, 0.18);
    drawCube(thigh, BLACK);

    let knee = mat4Translate(hipR, 0, -0.26, 0);
    knee = mat4RotateX(knee, kneeBend);
    pushMat(knee);
    {
      let calf = mat4Translate(knee, 0, -0.10, 0);
      calf = mat4Scale(calf, 0.16, 0.22, 0.16);
      drawCube(calf, BLACK);

      let ankle = mat4Translate(knee, 0, -0.24, 0.06);
      ankle = mat4RotateX(ankle, -kneeBend * 0.6);
      let foot = mat4Scale(ankle, 0.22, 0.08, 0.26);
      drawCube(foot, BLACK);
    }
    popMat();
  }
  popMat();
}

function tick() {
  const now = performance.now();
  g_seconds = (now - g_startTime) / 1000.0;

  // FPS update
  fpsFrameCount++;
  if (now - fpsLastTime >= 500) {
    const fps = (fpsFrameCount * 1000) / (now - fpsLastTime);
    fpsDiv.textContent = `FPS: ${fps.toFixed(1)}`;
    fpsFrameCount = 0;
    fpsLastTime = now;
  }

  updateAnimationAngles();
  renderScene();

  requestAnimationFrame(tick);
}


// UI WIRING 
function wireUI() {
  const rotY = document.getElementById("rotY");   // global rotation (rubric)
  const rotX = document.getElementById("rotX");   // used as elbow joint (rubric)
  const lArm = document.getElementById("lArm");   // shoulder joint
  const rArm = document.getElementById("rArm");   // shoulder joint
  const anim = document.getElementById("anim");   // on/off button

  const rotYv = document.getElementById("rotYv");
  const rotXv = document.getElementById("rotXv");
  const lArmv = document.getElementById("lArmv");
  const rArmv = document.getElementById("rArmv");

  function sync() {
    if (rotYv) rotYv.textContent = ` ${gAnimalGlobalRotation}°`;
    if (rotXv) rotXv.textContent = ` ${g_elbow}° (elbow)`;
    if (lArmv) lArmv.textContent = ` ${g_lShoulder}°`;
    if (rArmv) rArmv.textContent = ` ${g_rShoulder}°`;
  }

  if (rotY) rotY.oninput = () => { gAnimalGlobalRotation = +rotY.value; sync(); renderScene(); };
  if (rotX) rotX.oninput = () => { g_elbow = +rotX.value; sync(); renderScene(); };
  if (lArm) lArm.oninput = () => { if (!g_animOn) g_lShoulder = +lArm.value; sync(); renderScene(); };
  if (rArm) rArm.oninput = () => { if (!g_animOn) g_rShoulder = +rArm.value; sync(); renderScene(); };

  if (anim) anim.onchange = () => {
    g_animOn = anim.checked;
    // when animation turns OFF, restore shoulders from sliders immediately
    if (!g_animOn) {
      if (lArm) g_lShoulder = +lArm.value;
      if (rArm) g_rShoulder = +rArm.value;
    }
    sync();
  };

  sync();

  // Mouse control rotate (rubric) - drag to change global + x rotation
  const canvas = document.getElementById("webgl");
  canvas.addEventListener("mousedown", (e) => {
    mouseDown = true;
    lastX = e.clientX; lastY = e.clientY;
  });
  window.addEventListener("mouseup", () => mouseDown = false);
  window.addEventListener("mousemove", (e) => {
    if (!mouseDown) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;

    gAnimalGlobalRotation += dx * 0.5;
    gCameraRotX += dy * 0.5;
    gCameraRotX = Math.max(-90, Math.min(90, gCameraRotX));

    if (rotY) rotY.value = gAnimalGlobalRotation;
    sync();
    renderScene();
  });

  // Shift-click poke (rubric)
  canvas.addEventListener("click", (e) => {
    if (!e.shiftKey) return;
    g_pokeActive = true;
    g_pokeStart = g_seconds;
  });
}

// ===================== MAIN =====================
function main() {
  const canvas = document.getElementById("webgl");
  gl = canvas.getContext("webgl", { preserveDrawingBuffer: true });
  if (!gl) { alert("WebGL not supported"); return; }

  const prog = createProgram(gl, VSHADER_SOURCE, FSHADER_SOURCE);
  gl.useProgram(prog);

  a_Position = gl.getAttribLocation(prog, "a_Position");
  u_ModelMatrix = gl.getUniformLocation(prog, "u_ModelMatrix");
  u_GlobalRotation = gl.getUniformLocation(prog, "u_GlobalRotation");
  u_FragColor = gl.getUniformLocation(prog, "u_FragColor");

  gl.clearColor(.678, .84, .9, 1);

  // Required: depth test + clear depth buffer in renderScene
  gl.enable(gl.DEPTH_TEST);

  initCubeBuffer();
  initCylinderBuffer(20);
  wireUI();

  // Required: call renderScene at end of main
  renderScene();

  // Required: tick() animates at least one part
  requestAnimationFrame(tick);
}

main();
