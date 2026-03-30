// app.js
(() => {
  "use strict";

  // ========= DOM / GL =========
  const canvas = document.getElementById("gl");
  const statsEl = document.getElementById("stats");
  const gl = canvas.getContext("webgl", { antialias: true, alpha: false });
  if (!gl) { alert("WebGL not supported"); return; }

  function resize() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const w = Math.floor(canvas.clientWidth * dpr);
    const h = Math.floor(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }
  window.addEventListener("resize", resize);

  // ========= Shaders (more samplers, per-face tex id) =========
  const VS = `
    attribute vec3 aPos;
    attribute vec3 aNor;
    attribute vec2 aUV;
    attribute float aTex;

    uniform mat4 uProj;
    uniform mat4 uView;

    attribute vec3 aCol;
    varying vec3 vCol;

    varying vec3 vWorldPos;
    varying vec3 vWorldNor;
    varying vec2 vUV;
    varying float vTex;
    varying float vFog;

    void main() {
      // Your voxel positions are already in world coords
      vec4 world = vec4(aPos, 1.0);

      vec4 viewPos = uView * world;
      gl_Position = uProj * viewPos;

      vCol = aCol;

      // Keep lighting inputs in WORLD space
      vWorldPos = aPos;
      vWorldNor = aNor;

      vUV  = aUV;
      vTex = aTex;

      float dist = length(viewPos.xyz);
      vFog = clamp((dist - 25.0) / 70.0, 0.0, 1.0);
    }
  `;

  // 7 textures: grassTop, grassSide, dirt, cobble, brick, sky, star
  const FS = `
    precision mediump float;

    varying vec3 vWorldPos;
    varying vec3 vWorldNor;
    varying vec2 vUV;
    varying float vTex;
    varying float vFog;
    varying vec3 vCol;

    uniform sampler2D uTex0;
    uniform sampler2D uTex1;
    uniform sampler2D uTex2;
    uniform sampler2D uTex3;
    uniform sampler2D uTex4;
    uniform sampler2D uTex5;
    uniform sampler2D uTex6;

    uniform bool uShowNormals;   // NEW

    uniform bool uLightingOn;

    uniform vec3 uLightPos;    // point light position (world)
    uniform vec3 uLightColor;  // light color (rgb)
    uniform vec3 uCamPos;      // camera position (world)

    vec4 sampleTex(float t, vec2 uv){
      if (t < 0.5) return texture2D(uTex0, uv);
      if (t < 1.5) return texture2D(uTex1, uv);
      if (t < 2.5) return texture2D(uTex2, uv);
      if (t < 3.5) return texture2D(uTex3, uv);
      if (t < 4.5) return texture2D(uTex4, uv);
      if (t < 5.5) return texture2D(uTex5, uv);
      return texture2D(uTex6, uv);
    }

    void main() {
      vec3 n = normalize(vWorldNor);

      // Normal visualization mode:
      // map [-1,1] -> [0,1] so you can see direction as color
      if (uShowNormals) {
        gl_FragColor = vec4(n * 0.5 + 0.5, 1.0);
        return;
      }

      // Otherwise, render your original textured world (no lighting yet)
      vec3 baseColor;

      if (vTex < 0.0) {
        baseColor = vCol;  // sphere color 
      } else {
        vec4 tex = sampleTex(vTex, vUV);
        baseColor = tex.rgb;
      }

      // if lighting off, just show base color (still fog)
      if (!uLightingOn) {
        vec3 fogCol = vec3(0.55, 0.75, 0.98);
        vec3 col = mix(baseColor, fogCol, vFog);
        gl_FragColor = vec4(col, 1.0);
        return;
      }

      // ---- Phong lighting (world space) ----
      vec3 N = normalize(vWorldNor);
      vec3 P = vWorldPos;

      // Light direction from surface point to light
      vec3 L = normalize(uLightPos - P);

      // View direction from surface point to camera
      vec3 V = normalize(uCamPos - P);

      // Ambient
      float ka = 0.35;
      vec3 ambient = ka * baseColor * uLightColor;

      // Diffuse
      float kd = 0.95;
      float diff = max(dot(N, L), 0.0);
      vec3 diffuse = kd * diff * baseColor * uLightColor;

      // Specular (Blinn-Phong)
      float ks = 0.35;
      float shininess = 38.0;
      vec3 H = normalize(L + V);
      float spec = pow(max(dot(N, H), 0.0), shininess);
      vec3 specular = ks * spec * uLightColor;

      // Combine
      vec3 lit = ambient + diffuse + specular;

      // Optional: clamp so it doesn't blow out
      lit = clamp(lit, 0.0, 1.0);

      // Fog after lighting
      vec3 fogCol = vec3(0.55, 0.75, 0.98);
      lit = mix(lit, fogCol, vFog);

      gl_FragColor = vec4(lit, 1.0);
    }
  `;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(s) || "Shader compile failed");
    }
    return s;
  }
  function link(vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(p) || "Program link failed");
    }
    return p;
  }

  const prog = link(compile(gl.VERTEX_SHADER, VS), compile(gl.FRAGMENT_SHADER, FS));
  gl.useProgram(prog);

  const loc = {
    aCol: gl.getAttribLocation(prog, "aCol"),
    aPos: gl.getAttribLocation(prog, "aPos"),
    aNor: gl.getAttribLocation(prog, "aNor"),
    aUV:  gl.getAttribLocation(prog, "aUV"),
    aTex: gl.getAttribLocation(prog, "aTex"),
    uProj: gl.getUniformLocation(prog, "uProj"),
    uView: gl.getUniformLocation(prog, "uView"),
    uTex0: gl.getUniformLocation(prog, "uTex0"),
    uTex1: gl.getUniformLocation(prog, "uTex1"),
    uTex2: gl.getUniformLocation(prog, "uTex2"),
    uTex3: gl.getUniformLocation(prog, "uTex3"),
    uTex4: gl.getUniformLocation(prog, "uTex4"),
    uTex5: gl.getUniformLocation(prog, "uTex5"),
    uTex6: gl.getUniformLocation(prog, "uTex6"),
    uShowNormals: gl.getUniformLocation(prog, "uShowNormals"),
    uLightingOn: gl.getUniformLocation(prog, "uLightingOn"),
    uLightPos: gl.getUniformLocation(prog, "uLightPos"),
    uLightColor: gl.getUniformLocation(prog, "uLightColor"),
    uCamPos: gl.getUniformLocation(prog, "uCamPos"),
  };


  const bufCol = gl.createBuffer();

  let lightAngle = 0;
  let g_showNormals = false;
  gl.uniform1i(loc.uShowNormals, g_showNormals ? 1 : 0);
  const normalsCheckbox = document.getElementById("toggleNormals");
  if (normalsCheckbox) {
    normalsCheckbox.addEventListener("change", () => {
      g_showNormals = normalsCheckbox.checked;
    });
  }

  const W = 32, D = 32, H = 16;
  const AIR = 0, GRASS = 1, DIRT = 2, COBBLE = 3, BRICK = 4, STAR = 5;

  let g_lightingOn = true;

  // pick a light position that makes sense in your world
  let g_lightPos = [W/2, 8.0, D/2];  // center-ish, above

  let g_lightColor = [1.3, 1.3, 1.2]; // white for now

  const lightingCheckbox = document.getElementById("toggleLighting");

  if (lightingCheckbox) {
    lightingCheckbox.addEventListener("change", () => {
      g_lightingOn = lightingCheckbox.checked;
    });
  }

  const sx = document.getElementById("lightX");
  const sy = document.getElementById("lightY");
  const sz = document.getElementById("lightZ");

  const sr = document.getElementById("lightR");
  const sg = document.getElementById("lightG");
  const sb = document.getElementById("lightB");

  const orbitCheckbox = document.getElementById("lightOrbit");

  function readSliders() {
    if (sx) g_lightPos[0] = parseFloat(sx.value);
    if (sy) g_lightPos[1] = parseFloat(sy.value);
    if (sz) g_lightPos[2] = parseFloat(sz.value);

    if (sr) g_lightColor[0] = parseFloat(sr.value);
    if (sg) g_lightColor[1] = parseFloat(sg.value);
    if (sb) g_lightColor[2] = parseFloat(sb.value);
  }

  [sx,sy,sz,sr,sg,sb].forEach(el => el && el.addEventListener("input", readSliders));
  readSliders();

  // ========= Minimal Math =========
  function mat4Identity() {
    return new Float32Array([1,0,0,0,
                             0,1,0,0,
                             0,0,1,0,
                             0,0,0,1]);
  }
  function mat4Perspective(out, fovy, aspect, near, far) {
    const f = 1.0 / Math.tan(fovy / 2);
    const nf = 1 / (near - far);
    out[0] = f / aspect; out[1]=0; out[2]=0; out[3]=0;
    out[4] = 0; out[5]=f; out[6]=0; out[7]=0;
    out[8] = 0; out[9]=0; out[10]=(far+near)*nf; out[11]=-1;
    out[12]=0; out[13]=0; out[14]=(2*far*near)*nf; out[15]=0;
    return out;
  }

  // ========= Texture Loading =========
  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  function createTextureFromImage(img, unit, samplerLoc) {
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);

    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

    gl.uniform1i(samplerLoc, unit);
    return tex;
  }

  // ========= World (real voxels) =========

  // --- HUD labels for equipped block ---
  const BLOCK_NAMES = {
    [GRASS]: "Grass",
    [DIRT]: "Dirt",
    [COBBLE]: "Cobblestone",
    [BRICK]: "Brick",
  };

  // ===== Separate BlockBox UI (not HUD) =====
  const equippedNameEl = document.getElementById("equippedName");
  const blockRows = Array.from(document.querySelectorAll("#blockBox .row"));

  function updateBlockUI(placeType) {
    if (!equippedNameEl || blockRows.length === 0) return;

    equippedNameEl.textContent = BLOCK_NAMES[placeType] ?? `ID ${placeType}`;

    for (const r of blockRows) {
      const b = Number(r.dataset.block);
      r.classList.toggle("active", b === placeType);
    }
  }

  // blocks[x + W*(y + H*z)]
  const blocks = new Uint8Array(W * H * D);

  function idx(x,y,z){ return x + W * (y + H * z); }
  function inBounds(x,y,z){ return x>=0 && y>=0 && z>=0 && x<W && y<H && z<D; }
  function getBlock(x,y,z){ return inBounds(x,y,z) ? blocks[idx(x,y,z)] : AIR; }
  function setBlock(x,y,z,v){ if (inBounds(x,y,z)) blocks[idx(x,y,z)] = v; }
  function isSolid(x,y,z){ return getBlock(x,y,z) !== AIR; }

  function seedWorld(){
    for (let z=0; z<D; z++){
      for (let x=0; x<W; x++){
        setBlock(x, 0, z, GRASS);
        if (H>1) setBlock(x, 1, z, DIRT);

        const border = (x===0||z===0||x===W-1||z===D-1);
        if (border) {
          for (let y=1; y<Math.min(H, 5); y++) setBlock(x,y,z, BRICK);
        }

        if ((x % 7 === 0) && z>3 && z<D-4) {
          for (let y=1; y<Math.min(H, 4); y++) setBlock(x,y,z, COBBLE);
        }
        if ((z % 9 === 0) && x>3 && x<W-4) {
          for (let y=1; y<Math.min(H, 4); y++) setBlock(x,y,z, COBBLE);
        }

        const dx = x - 22, dz = z - 22;
        const r2 = dx*dx + dz*dz;
        if (r2 <= 10) {
          for (let y=1; y<Math.min(H, 8); y++) setBlock(x,y,z, BRICK);
        } else if (r2 <= 22) {
          for (let y=1; y<Math.min(H, 4); y++) setBlock(x,y,z, COBBLE);
        }
      }
    }
  }
  seedWorld();

  // Place the 3 star blocks in the world
  setBlock(6, 2, 6, STAR);
  setBlock(18, 2, 10, STAR);
  setBlock(14, 2, 16, STAR);

  // ========= MINI GAME =========
  let gameWon = false;
  let starsCollected = 0;

  const gameMessage = document.getElementById("gameMessage");
  function showMessage(text, duration = 3000) {
    gameMessage.textContent = text;
    gameMessage.style.display = "block";
    if (duration > 0) {
      setTimeout(() => { gameMessage.style.display = "none"; }, duration);
    }
  }

  // ========= Block → per-face texture id =========
  // Texture slots:
  // 0 grass_top, 1 grass_side, 2 dirt, 3 cobble, 4 brick, 5 sky, 6 star
  // face: 0=+X 1=-X 2=+Z 3=-Z 4=+Y 5=-Y
  function faceTex(block, face){
    if (block === STAR) return 6;
    if (block === GRASS) {
      if (face === 4) return 0;
      if (face === 5) return 2;
      return 1;
    }
    if (block === DIRT)  return 2;
    if (block === COBBLE) return 3;
    if (block === BRICK) return 4;
    return 3;
  }

  // ========= Mesh Build =========
  let pos = [], nor = [], uv = [], tex = [], col = [];
  let vertexCount = 0;

  function pushTri(a,b,c, n, uva,uvb,uvc, t){
    pos.push(...a,...b,...c);
    nor.push(...n,...n,...n);
    uv.push(...uva,...uvb,...uvc);
    tex.push(t,t,t);

    const dummy = [1,1,1];  // doesn't matter since textured path ignores vCol
    col.push(...dummy, ...dummy, ...dummy);
  }
  function pushQuad(a,b,c,d, n, uva,uvb,uvc,uvd, t){
    pushTri(a,b,c, n, uva,uvb,uvc, t);
    pushTri(a,c,d, n, uva,uvc,uvd, t);
  }

  function pushColor3(c) { col.push(c[0], c[1], c[2]); }

  function addSphere(cx, cy, cz, radius, stacks=16, slices=24) {
    for (let i = 0; i < stacks; i++) {
      const phi1 = Math.PI * i / stacks;
      const phi2 = Math.PI * (i+1) / stacks;

      for (let j = 0; j < slices; j++) {
        const theta1 = 2*Math.PI * j / slices;
        const theta2 = 2*Math.PI * (j+1) / slices;

        const p1 = [
          cx + radius * Math.sin(phi1)*Math.cos(theta1),
          cy + radius * Math.cos(phi1),
          cz + radius * Math.sin(phi1)*Math.sin(theta1)
        ];
        const p2 = [
          cx + radius * Math.sin(phi2)*Math.cos(theta1),
          cy + radius * Math.cos(phi2),
          cz + radius * Math.sin(phi2)*Math.sin(theta1)
        ];
        const p3 = [
          cx + radius * Math.sin(phi2)*Math.cos(theta2),
          cy + radius * Math.cos(phi2),
          cz + radius * Math.sin(phi2)*Math.sin(theta2)
        ];
        const p4 = [
          cx + radius * Math.sin(phi1)*Math.cos(theta2),
          cy + radius * Math.cos(phi1),
          cz + radius * Math.sin(phi1)*Math.sin(theta2)
        ];

        const n1 = normalizeVec3([p1[0]-cx, p1[1]-cy, p1[2]-cz]);
        const n2 = normalizeVec3([p2[0]-cx, p2[1]-cy, p2[2]-cz]);
        const n3 = normalizeVec3([p3[0]-cx, p3[1]-cy, p3[2]-cz]);
        const n4 = normalizeVec3([p4[0]-cx, p4[1]-cy, p4[2]-cz]);

        // first triangle
        pos.push(...p1, ...p2, ...p3);
        nor.push(...n1, ...n2, ...n3);
        uv.push(0,0, 0,0, 0,0);
        tex.push(-1, -1, -1);   // IMPORTANT: solid color
        tex.push(-1,-1,-1);
        const sphereColor = [0.2, 0.8, 1.0];
        pushColor3(sphereColor); pushColor3(sphereColor); pushColor3(sphereColor);


        // second triangle
        pos.push(...p1, ...p3, ...p4);
        nor.push(...n1, ...n3, ...n4);
        uv.push(0,0, 0,0, 0,0);
        tex.push(-1, -1, -1);
        pushColor3(sphereColor); pushColor3(sphereColor); pushColor3(sphereColor);
      }
    }
  }

  function normalizeVec3(v){
    const len = Math.hypot(v[0], v[1], v[2]);
    return [v[0]/len, v[1]/len, v[2]/len];
  }

  async function loadOBJ(url) {
    const res = await fetch(url);
    const text = await res.text();

    const positions = [];
    const normals = [];
    const faces = [];

    const lines = text.split("\n");

    for (let line of lines) {
      line = line.trim();

      if (line.startsWith("v ")) {
        const [, x, y, z] = line.split(/\s+/);
        positions.push([parseFloat(x), parseFloat(y), parseFloat(z)]);
      }

      else if (line.startsWith("vn ")) {
        const [, x, y, z] = line.split(/\s+/);
        normals.push([parseFloat(x), parseFloat(y), parseFloat(z)]);
      }

      else if (line.startsWith("f ")) {
        const parts = line.split(/\s+/).slice(1);

        // Triangles assumed (since you exported triangulated)
        const tri = parts.map(p => {
          const [v, vt, vn] = p.split("/");
          return {
            v: parseInt(v) - 1,
            n: vn ? parseInt(vn) - 1 : null
          };
        });

        faces.push(tri);
      }
    }
    return { positions, normals, faces };
  }

  function buildMesh(){
    pos = []; nor = []; uv = []; tex = [];

    const SKY = 220;
    const cx = W/2, cz = D/2;
    const sx0 = cx - SKY, sx1 = cx + SKY;
    const sz0 = cz - SKY, sz1 = cz + SKY;
    const sy0 = -SKY,     sy1 = SKY;

    const tileSky = 2;
    const U0=0, V0=0, U1=tileSky, V1=tileSky;
    const TSKY = 5;

    pushQuad([sx1,sy0,sz0],[sx1,sy1,sz0],[sx1,sy1,sz1],[sx1,sy0,sz1],[-1,0,0],
      [U0,V0],[U0,V1],[U1,V1],[U1,V0], TSKY);
    pushQuad([sx0,sy0,sz1],[sx0,sy1,sz1],[sx0,sy1,sz0],[sx0,sy0,sz0],[1,0,0],
      [U0,V0],[U0,V1],[U1,V1],[U1,V0], TSKY);
    pushQuad([sx0,sy0,sz1],[sx0,sy1,sz1],[sx1,sy1,sz1],[sx1,sy0,sz1],[0,0,-1],
      [U0,V0],[U0,V1],[U1,V1],[U1,V0], TSKY);
    pushQuad([sx1,sy0,sz0],[sx1,sy1,sz0],[sx0,sy1,sz0],[sx0,sy0,sz0],[0,0,1],
      [U0,V0],[U0,V1],[U1,V1],[U1,V0], TSKY);
    pushQuad([sx0,sy1,sz0],[sx0,sy1,sz1],[sx1,sy1,sz1],[sx1,sy1,sz0],[0,-1,0],
      [U0,V0],[U0,V1],[U1,V1],[U1,V0], TSKY);
    pushQuad([sx0,sy0,sz1],[sx0,sy0,sz0],[sx1,sy0,sz0],[sx1,sy0,sz1],[0,1,0],
      [U0,V0],[U0,V1],[U1,V1],[U1,V0], TSKY);

    const U00=0, V00=0, U11=1, V11=1;

    for (let z=0; z<D; z++){
      for (let y=0; y<H; y++){
        for (let x=0; x<W; x++){
          const b = getBlock(x,y,z);
          if (b === AIR) continue;

          const x0=x, x1=x+1;
          const y0=y, y1=y+1;
          const z0=z, z1=z+1;

          if (!isSolid(x+1,y,z)){
            pushQuad([x1,y0,z0],[x1,y0,z1],[x1,y1,z1],[x1,y1,z0],[1,0,0],
              [U00,V00],[U11,V00],[U11,V11],[U00,V11], faceTex(b,0));
          }
          if (!isSolid(x-1,y,z)){
            pushQuad([x0,y0,z1],[x0,y0,z0],[x0,y1,z0],[x0,y1,z1],[-1,0,0],
              [U00,V00],[U11,V00],[U11,V11],[U00,V11], faceTex(b,1));
          }
          if (!isSolid(x,y,z+1)){
            pushQuad([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],[0,0,1],
              [U00,V00],[U11,V00],[U11,V11],[U00,V11], faceTex(b,2));
          }
          if (!isSolid(x,y,z-1)){
            pushQuad([x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],[0,0,-1],
              [U00,V00],[U11,V00],[U11,V11],[U00,V11], faceTex(b,3));
          }
          if (!isSolid(x,y+1,z)){
            pushQuad([x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1],[0,1,0],
              [U00,V00],[U11,V00],[U11,V11],[U00,V11], faceTex(b,4));
          }
          if (!isSolid(x,y-1,z)){
            pushQuad([x0,y0,z1],[x1,y0,z1],[x1,y0,z0],[x0,y0,z0],[0,-1,0],
              [U00,V00],[U11,V00],[U11,V11],[U00,V11], faceTex(b,5));
          }
        }
      }
    }

    vertexCount = pos.length / 3;
    addSphere(W/2, 6, D/2, 2.0);
    if (window.loadedOBJ) {
      addOBJToMesh(window.loadedOBJ, 1.0, [10, 2, 10]);
    }

    vertexCount = pos.length / 3;
  }

  // ========= Buffers =========
  const bufPos = gl.createBuffer();
  const bufNor = gl.createBuffer();
  const bufUV  = gl.createBuffer();
  const bufTex = gl.createBuffer();

  function upload(){
    gl.bindBuffer(gl.ARRAY_BUFFER, bufCol);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(col), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(loc.aCol);
    gl.vertexAttribPointer(loc.aCol, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, bufPos);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(loc.aPos);
    gl.vertexAttribPointer(loc.aPos, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, bufNor);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(nor), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(loc.aNor);
    gl.vertexAttribPointer(loc.aNor, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, bufUV);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uv), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(loc.aUV);
    gl.vertexAttribPointer(loc.aUV, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, bufTex);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(tex), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(loc.aTex);
    gl.vertexAttribPointer(loc.aTex, 1, gl.FLOAT, false, 0, 0);
  }


  function addOBJToMesh(objData, scale=1.0, offset=[0,0,0]) {
    const { positions, normals, faces } = objData;

    for (const tri of faces) {
      for (const vert of tri) {
        const p = positions[vert.v];
        const n = vert.n !== null ? normals[vert.n] : [0,1,0];

        // transform + scale
        pos.push(
          p[0] * scale + offset[0],
          p[1] * scale + offset[1],
          p[2] * scale + offset[2]
        );

        nor.push(n[0], n[1], n[2]);

        uv.push(0,0);
        tex.push(-1); // solid color
        const objColor = [1.0, 0.8, 0.2];   // gold
        pushColor3(objColor);
      }
    }
  }
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0.55, 0.75, 0.98, 1.0);

  // ========= Player / Controls =========
  const cam = new Camera({
    pos: [2.5, 3.2, 2.5],
    fovDeg: 60,
    near: 0.1,
    far: 500,
    maxPitchDeg: 75,
  });

  const MOVE_SPEED = 6.0;
  const ROT_SPEED = 2.5; // radians per second
  const PLAYER_RADIUS = 0.3;
  const PLAYER_HEIGHT = 1.8;

  canvas.addEventListener("click", () => canvas.requestPointerLock());
  document.addEventListener("mousemove", (e) => {
    if (document.pointerLockElement !== canvas) return;
    const sens = 0.0022;
    cam.look(-e.movementX * sens, -e.movementY * sens);
  });

  const keys = new Set();
  window.addEventListener("keydown", (e) => {
    keys.add(e.code);
    if (e.code === "Space") e.preventDefault();
  }, { passive:false });
  window.addEventListener("keyup", (e) => keys.delete(e.code));

  window.addEventListener("keydown", (e) => {
    if (e.code === "KeyN") g_showNormals = !g_showNormals;  // N toggles normals
    if (e.code === "KeyL") g_lightingOn = !g_lightingOn;    // L toggles lighting
  });

  function collides(x, y, z) {
    const minX = Math.floor(x - PLAYER_RADIUS);
    const maxX = Math.floor(x + PLAYER_RADIUS);
    const minY = Math.floor(y);
    const maxY = Math.floor(y + PLAYER_HEIGHT);
    const minZ = Math.floor(z - PLAYER_RADIUS);
    const maxZ = Math.floor(z + PLAYER_RADIUS);

    for (let yy = minY; yy <= maxY; yy++) {
      for (let zz = minZ; zz <= maxZ; zz++) {
        for (let xx = minX; xx <= maxX; xx++) {
          if (isSolid(xx, yy, zz)) return true;
        }
      }
    }
    return false;
  }

  function movePlayer(dt) {

    if (keys.has("KeyQ")) {
      cam.look( ROT_SPEED * dt, 0 );   // rotate left
    }

    if (keys.has("KeyE")) {
      cam.look(-ROT_SPEED * dt, 0 );   // rotate right
    }
    
    const fwd = (keys.has("KeyW") ? 1 : 0) + (keys.has("KeyS") ? -1 : 0);
    const str = (keys.has("KeyD") ? -1 : 0) + (keys.has("KeyA") ? 1 : 0);
    const dist = MOVE_SPEED * dt;

    let newX = cam.pos[0];
    let newY = cam.pos[1];
    let newZ = cam.pos[2];

    if (fwd !== 0) {
      const dx = Math.sin(cam.yaw) * dist * fwd;
      const dz = Math.cos(cam.yaw) * dist * fwd;
      if (!collides(newX + dx, newY, newZ)) newX += dx;
      if (!collides(newX, newY, newZ + dz)) newZ += dz;
    }

    if (str !== 0) {
      const dx =  Math.cos(cam.yaw) * dist * str;
      const dz = -Math.sin(cam.yaw) * dist * str;

      if (!collides(newX + dx, newY, newZ)) newX += dx;
      if (!collides(newX, newY, newZ + dz)) newZ += dz;
    }

    cam.pos[0] = newX;
    cam.pos[2] = newZ;

    cam.pos[1] = Math.max(1.2, cam.pos[1]);

    // --- star pickup (touch star block) ---
    const px = Math.floor(cam.pos[0]);
    const py = Math.floor(cam.pos[1] - 1);
    const pz = Math.floor(cam.pos[2]);

    if (!gameWon && getBlock(px, py, pz) === STAR) {
      setBlock(px, py, pz, AIR);
      starsCollected++;
      buildMesh();
      upload();

      showMessage(`⭐ Collected! (${starsCollected}/3)`);

      if (starsCollected === 3) {
        gameWon = true;
        showMessage("🎉 YAY YOU GOT ALL 3!", 0);
      }
    }
  }

  // ========= Raycast =========
  function getForwardDir() { return cam.getForwardDir(); }

  function raycast(maxDist=6.0) {
    const [ox, oy, oz] = cam.pos;
    const [dx, dy, dz] = getForwardDir();

    let x = Math.floor(ox);
    let y = Math.floor(oy);
    let z = Math.floor(oz);

    const stepX = dx > 0 ? 1 : -1;
    const stepY = dy > 0 ? 1 : -1;
    const stepZ = dz > 0 ? 1 : -1;

    const invDx = dx !== 0 ? 1 / Math.abs(dx) : 1e30;
    const invDy = dy !== 0 ? 1 / Math.abs(dy) : 1e30;
    const invDz = dz !== 0 ? 1 / Math.abs(dz) : 1e30;

    const nextVoxX = (dx > 0) ? (x + 1) : x;
    const nextVoxY = (dy > 0) ? (y + 1) : y;
    const nextVoxZ = (dz > 0) ? (z + 1) : z;

    let tMaxX = (dx !== 0) ? (Math.abs(nextVoxX - ox) * invDx) : 1e30;
    let tMaxY = (dy !== 0) ? (Math.abs(nextVoxY - oy) * invDy) : 1e30;
    let tMaxZ = (dz !== 0) ? (Math.abs(nextVoxZ - oz) * invDz) : 1e30;

    const tDeltaX = invDx;
    const tDeltaY = invDy;
    const tDeltaZ = invDz;

    let traveled = 0;
    let px=x, py=y, pz=z;
    let nx=0, ny=0, nz=0;

    for (let i=0; i<256; i++){
      if (traveled > maxDist) break;

      if (isSolid(x,y,z)) {
        return { x,y,z, px,py,pz, nx,ny,nz };
      }

      px = x; py = y; pz = z;

      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        traveled = tMaxX;
        tMaxX += tDeltaX;
        x += stepX;
        nx = -stepX; ny = 0; nz = 0;
      } else if (tMaxY < tMaxZ) {
        traveled = tMaxY;
        tMaxY += tDeltaY;
        y += stepY;
        nx = 0; ny = -stepY; nz = 0;
      } else {
        traveled = tMaxZ;
        tMaxZ += tDeltaZ;
        z += stepZ;
        nx = 0; ny = 0; nz = -stepZ;
      }

      if (!inBounds(x,y,z)) break;
    }
    return null;
  }

  // ========= Place/Delete =========
  let placeType = BRICK; // default equipped

  // IMPORTANT: keep this mapping fixed (NOT random)
  window.addEventListener("keydown", (e) => {
    if (e.code === "Digit1") placeType = GRASS;
    if (e.code === "Digit2") placeType = COBBLE;
    if (e.code === "Digit3") placeType = BRICK;
    if (e.code === "Digit4") placeType = DIRT;
  });

  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  canvas.addEventListener("mousedown", (e) => {
    if (document.pointerLockElement !== canvas) return;

    const hit = raycast(7.0);
    if (!hit) return;

    if (e.button === 0) {
      setBlock(hit.x, hit.y, hit.z, AIR);
    } else if (e.button === 2) {
      setBlock(hit.px, hit.py, hit.pz, placeType);
    } else {
      return;
    }

    buildMesh();
    upload();
  });

  // ========= Render =========
  let last = performance.now();
  let fpsSmooth = 60;

  async function main() {
    const [grassTop, grassSide, dirt, cobble, brick, sky, starTex] = await Promise.all([
      loadImage("./textures/grass_top.png"),
      loadImage("./textures/grass_side.png"),
      loadImage("./textures/dirt.png"),
      loadImage("./textures/cobblestone.png"),
      loadImage("./textures/brick.png"),
      loadImage("./textures/sky.png"),
      loadImage("./textures/star.png"),
    ]);

    createTextureFromImage(grassTop,  0, loc.uTex0);
    createTextureFromImage(grassSide, 1, loc.uTex1);
    createTextureFromImage(dirt,      2, loc.uTex2);
    createTextureFromImage(cobble,    3, loc.uTex3);
    createTextureFromImage(brick,     4, loc.uTex4);
    createTextureFromImage(sky,       5, loc.uTex5);
    createTextureFromImage(starTex,   6, loc.uTex6);

    const objData = await loadOBJ("./model.obj");
    window.loadedOBJ = objData;

    buildMesh();
    upload();

    showMessage("Mine, and find 3 stars scattered across the map", 4000);
    requestAnimationFrame(frame);
  }

  function frame(now){
    resize();
    const dt = Math.min(0.05, (now-last)/1000);
    last = now;

    movePlayer(dt);

    if (orbitCheckbox && orbitCheckbox.checked) {
      lightAngle += dt * 0.8; // speed
      const r = 10.0;
      // orbit around center of world, keep Y from slider
      const cx = W * 0.5, cz = D * 0.5;
      g_lightPos[0] = cx + Math.cos(lightAngle) * r;
      g_lightPos[2] = cz + Math.sin(lightAngle) * r;

      // keep sliders visually in sync (optional)
      if (sx) sx.value = g_lightPos[0].toFixed(1);
      if (sz) sz.value = g_lightPos[2].toFixed(1);
    }

    const aspect = canvas.width / canvas.height;
    cam.setAspect(aspect);
    cam.updateView();

    gl.uniformMatrix4fv(loc.uProj, false, cam.proj);
    gl.uniformMatrix4fv(loc.uView, false, cam.view);
    gl.uniform1i(loc.uShowNormals, g_showNormals ? 1 : 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniform1i(loc.uLightingOn, g_lightingOn ? 1 : 0);
    gl.uniform3fv(loc.uLightPos, new Float32Array(g_lightPos));
    gl.uniform3fv(loc.uLightColor, new Float32Array(g_lightColor));
    gl.uniform3fv(loc.uCamPos, new Float32Array(cam.pos));
    gl.drawArrays(gl.TRIANGLES, 0, vertexCount);

    const fps = 1/dt;
    fpsSmooth = fpsSmooth*0.9 + fps*0.1;

    const hit = (document.pointerLockElement === canvas) ? raycast(7.0) : null;
    const hitStr = hit ? `Hit: (${hit.x},${hit.y},${hit.z})` : "Hit: none";

    // --- HUD: show equipped block by name + key mapping ---
    const equippedName = BLOCK_NAMES[placeType] ?? `ID ${placeType}`;

    statsEl.textContent =
      `Tris: ${(vertexCount/3)|0} | FPS: ${fpsSmooth.toFixed(0)} | ` +
      `Pos: ${cam.pos.map(v=>v.toFixed(2)).join(", ")} | ` +
      `Equipped(1=Grass 2=Cobble 3=Brick 4=Dirt): ${equippedName} | ` +
      `${hitStr}`;

    updateBlockUI(placeType);

    requestAnimationFrame(frame);
  }

  main().catch(err => {
    console.error(err);
    alert("Texture load failed. Make sure ./textures/*.png exists and you're running a local server.");
  });
})();
