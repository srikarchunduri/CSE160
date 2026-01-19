// ColoredPoint.js (c) 2012 matsuda
// Vertex shader program
var VSHADER_SOURCE = `
  attribute vec4 a_Position;
  uniform float u_Size;
  void main() {
    gl_Position = a_Position;
    gl_PointSize = u_Size;
  }`

// Fragment shader program
var FSHADER_SOURCE = `
  precision mediump float; 
  uniform vec4 u_FragColor;
  void main() { 
    gl_FragColor = u_FragColor;
  }`

// Global variables
let canvas;
let gl;
let u_FragColor;
let a_Position;
let u_Size;

function setupWebGL(){
  // Retrieve <canvas> element
  canvas = document.getElementById('webgl160');

  // Get the rendering context for WebGL
  // gl = getWebGLContext(canvas);
  gl = canvas.getContext("webgl", {preserveDrawingBuffer: true});
  if (!gl) {
    console.log('Failed to get the rendering context for WebGL');
    return;
  }
}

function connectVariablesToGLSL(){
    // Initialize shaders
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('Failed to intialize shaders.');
    return;
  }

  // // Get the storage location of a_Position
  a_Position = gl.getAttribLocation(gl.program, 'a_Position');
  if (a_Position < 0) {
    console.log('Failed to get the storage location of a_Position');
    return;
  }

  // Get the storage location of u_FragColor
  u_FragColor = gl.getUniformLocation(gl.program, 'u_FragColor');
  if (!u_FragColor) {
    console.log('Failed to get the storage location of u_FragColor');
    return;
  }

  u_Size = gl.getUniformLocation(gl.program, 'u_Size');
  if (!u_Size) {
    console.log('Failed to get the storage location of u_Size');
    return;
  }
}

// Global variables for defining UI
const POINT = 0;
const TRIANGLE = 1;
const CIRCLE = 2;

let g_SelectedColor = [1.0, 1.0, 1.0, 1.0]; // Default: white
let g_SelectedSize = 5;
let g_SelectedType = POINT; // Default shape type
let g_SelectedSegments = 10;

function addActionsForHtmlUI(){
  // Add actions for HTML UI elements

  // Button Events (shape type)
  document.getElementById('green').onclick = function() { g_SelectedColor = [0.0, 1.0, 0.0, 1.0]; };
  document.getElementById('red').onclick = function() { g_SelectedColor = [1.0, 0.0, 0.0, 1.0]; };
  document.getElementById('clear').onclick = function() { g_shapes = []; renderAllShapes(); };

  // Slider Events
  document.getElementById('redslide').addEventListener('mouseup', function() {g_SelectedColor[0] = this.value/100.0; } );
  document.getElementById('greenslide').addEventListener('mouseup', function() {g_SelectedColor[1] = this.value/100.0; } );
  document.getElementById('blueslide').addEventListener('mouseup', function() {g_SelectedColor[2] = this.value/100.0; } );

  // Size slider elements
  document.getElementById('sizeslide').addEventListener('mouseup', function() {g_SelectedSize = this.value; } );

  document.getElementById('pointButton').onclick = function() { g_SelectedType = POINT; };
  document.getElementById('triButton').onclick = function() { g_SelectedType = TRIANGLE; };
  document.getElementById('circleButton').onclick = function() { g_SelectedType = CIRCLE; };

  document.getElementById('segmentsSlide').addEventListener('input', function () { 
    g_SelectedSegments = Number(this.value); 
    document.getElementById('segmentsLabel').innerHTML = this.value; 
  });
  document.getElementById('pictureButton').onclick = function() { drawPicture(); };
}

function main() {

  setupWebGL();
  connectVariablesToGLSL();

  addActionsForHtmlUI(); 

  // Register function (event handler) to be called on a mouse press
  // Essentially, this is a mouse handler, remember that
  canvas.onmousedown = click;
  // canvas.onmousemove = click;
  canvas.onmousemove = function(ev) {
    if(ev.buttons == 1) { // ev.buttons is set to 1 when it is held down
      click(ev);
    }
  };
  // Specify the color for clearing <canvas>
  gl.clearColor(0.0, 0.0, 0.0, 1.0);

  // Clear <canvas>
  gl.clear(gl.COLOR_BUFFER_BIT);
}

var g_shapes=[]; // Store all shapes

// var g_points = [];  // The array for the position of a mouse press
// var g_colors = [];  // The array to store the color of a point
// Another global variable to store the sizes
// var g_sizes = [];

function convertCoordinatesEventToGL(ev) {
  var x = ev.clientX; // x coordinate of a mouse pointer
  var y = ev.clientY; // y coordinate of a mouse pointer
  var rect = ev.target.getBoundingClientRect();

  x = ((x - rect.left) - canvas.width/2)/(canvas.width/2);
  y = (canvas.height/2 - (y - rect.top))/(canvas.height/2);

  return ([x, y]);
}

function renderAllShapes(){

  var starttime = performance.now();
  // Clear <canvas>
  gl.clear(gl.COLOR_BUFFER_BIT);

  //var len = g_points.length;
  var len = g_shapes.length;
  for(var i = 0; i < len; i++) {
    g_shapes[i].render();
  }

  var duration = performance.now() - starttime;
  sendTextToHTML("numdot: " + len + " ms: " + Math.floor(duration) + " fps: " + Math.floor(10000/duration)/10, "numdot");
}

function sendTextToHTML(text, htmlID) {
  var htmlElm = document.getElementById(htmlID);
  if (!htmlElm)
  {
    console.log("Failed to get " + htmlID + " from Html");
  }

  htmlElm.innerHTML = text;
}

// var g_colors = [];
// var g_points =[];

function click(ev) {
  var [x, y] = convertCoordinatesEventToGL(ev);

  let point;
  // Now we check what type of shape it is
  if (g_SelectedType == POINT) 
  {
    point = new Point();
  } 
  else if (g_SelectedType == TRIANGLE) 
  {
    point = new Triangle();
  }
  else if (g_SelectedType == CIRCLE) {
    point = new Circle();
    point.segments = g_SelectedSegments;
  }

  point.position = [x, y, 0.0];
  point.color = g_SelectedColor.slice();
  point.size = g_SelectedSize;
  g_shapes.push(point);

  // Store the coordinates to g_points array
  // g_points.push([x, y]);

  // g_colors.push(g_SelectedColor.slice());

  // g_sizes.push(g_SelectedSize);
  // g_colors.push([g_SelectedColor[0], g_SelectedColor[1], g_SelectedColor[2], g_SelectedColor[3]]); 
  // Store the coordinates to g_points array
  // if (x >= 0.0 && y >= 0.0) {      // First quadrant
  //   g_colors.push([1.0, 0.0, 0.0, 1.0]);  // Red
  // } else if (x < 0.0 && y < 0.0) { // Third quadrant
  //   g_colors.push([0.0, 1.0, 0.0, 1.0]);  // Green
  // } else {                         // Others
  //   g_colors.push([1.0, 1.0, 1.0, 1.0]);  // White
  // }

  renderAllShapes();
}

function drawPicture() {
  // Helper: set color then draw triangle
  function tri(r, g, b, ax, ay, bx, by, cx, cy) {
    gl.uniform4f(u_FragColor, r, g, b, 1.0);
    drawTriangle([ax, ay, bx, by, cx, cy]);
  }

  // optional: clear first
  gl.clear(gl.COLOR_BUFFER_BIT);

  // ---- Coordinate plan ----
  // We'll build everything inside a bounding box:
  // left=-0.85, right=0.80, top=0.80, bottom=-0.85
  // and use a few key junction points similar to your sketch.

  const L = -0.85, R = 0.80, T = 0.80, B = -0.85;
  const Mx = 0.00, My = 0.00;

  // a few helpful anchors
  const topMidX = -0.05;
  const topMidY = 0.80;
  const midLeftX = -0.85;
  const midLeftY = 0.05;

  const k1x = -0.10, k1y = 0.35;   // upper center pivot
  const k2x =  0.20, k2y = 0.05;   // mid pivot
  const k3x = -0.10, k3y = -0.15;  // lower center pivot

  // =========================
  // TOP BAND (big shapes)
  // =========================

  // Top-left small square split (yellow + blue)
  tri(0.95, 0.78, 0.15,  L,  T,   -0.55, T,   -0.55, 0.55); // yellow
  tri(0.20, 0.45, 0.95,  L,  T,    L,    0.55, -0.55, 0.55); // blue

  // Big pink-ish top-left field (approx)
  tri(0.95, 0.60, 0.70,  -0.55, T,   topMidX, T,   -0.55, 0.05);
  tri(0.95, 0.60, 0.70,  topMidX, T,  -0.55, 0.05, topMidX, 0.05);

  // Purple triangle in upper middle-left
  tri(0.55, 0.40, 0.80,  -0.45, 0.05,  k1x, 0.35,  k1x, 0.05);

  // Large red diagonal wedge across top middle
  tri(0.90, 0.25, 0.25,  topMidX, T,   0.75, T,    k2x, 0.05);
  tri(0.90, 0.25, 0.25,  topMidX, T,   k2x, 0.05,  k1x, 0.35);

  // Large orange right trapezoid-ish area (split into 2 triangles)
  tri(0.95, 0.60, 0.10,  k2x, 0.05,  0.75, T,   R,  0.05);
  tri(0.95, 0.60, 0.10,  k2x, 0.05,  R,  0.05, 0.30, 0.05);

  // =========================
  // CENTER “PINWHEEL” REGION
  // =========================

  // Small yellow-ish center triangle (under the red wedge)
  tri(0.95, 0.85, 0.20,  k1x, 0.05,  k2x, 0.05,  0.05, -0.05);

  // Small purple block (approx as 2 triangles)
  tri(0.60, 0.45, 0.85,  -0.05, -0.05,  0.20, -0.05,  0.20, -0.20);
  tri(0.60, 0.45, 0.85,  -0.05, -0.05,  0.20, -0.20, -0.05, -0.20);

  // Small yellow triangle to the right of purple
  tri(0.98, 0.85, 0.25,   0.20, -0.05,  0.35, -0.05,  0.35, -0.20);

  // =========================
  // LEFT-BOTTOM LARGE BLOCK
  // =========================

  // Left “house roof” yellow triangle (upper-left of the green)
  tri(0.98, 0.90, 0.30,  -0.65, 0.05,  -0.30, 0.05,  -0.475, 0.25);

  // Green triangle block
  tri(0.10, 0.75, 0.20,  L, 0.05,  -0.65, 0.05,  L, -0.45);

  // Big lime/yellow diagonal region (split into 3 triangles)
  tri(0.80, 0.95, 0.10,  -0.65, 0.05,  0.05, -0.45,  -0.65, -0.45);
  tri(0.80, 0.95, 0.10,  -0.65, 0.05,  0.05, 0.05,   0.05, -0.45);
  tri(0.80, 0.95, 0.10,  -0.65, -0.45,  0.05, -0.45, -0.10, B);

  // =========================
  // CENTER-BOTTOM + RIGHT DIAMOND
  // =========================

  // Blue rectangle-ish center (2 triangles)
  tri(0.20, 0.55, 0.95,   0.05, 0.05,   0.45, 0.05,   0.45, -0.25);
  tri(0.20, 0.55, 0.95,   0.05, 0.05,   0.45, -0.25,  0.05, -0.25);

  // Pink diagonal square-ish region under it (2 triangles)
  tri(0.95, 0.45, 0.60,   0.05, -0.25,  0.45, -0.25,  0.45, -0.55);
  tri(0.95, 0.45, 0.60,   0.05, -0.25,  0.45, -0.55,  0.05, -0.55);

  // Bottom orange triangle
  tri(0.95, 0.55, 0.10,   0.05, -0.55,  0.45, -0.55,  0.05, B);

  // Right “diamond” (made of 6 triangles to match the multi-color wedges)
  const dx = 0.55, dy = -0.20;      // diamond center
  const dW = 0.35, dH = 0.25;

  const dLx = dx - dW, dRx = dx + dW;
  const dTy = dy + dH, dBy = dy - dH;

  // top-left wedge (purple)
  tri(0.60, 0.45, 0.85,  dx, dTy,   dLx, dy,   dx, dy);

  // top-right wedge (orange)
  tri(0.95, 0.65, 0.25,  dx, dTy,   dx, dy,   dRx, dy);

  // right-middle (peach)
  tri(0.95, 0.70, 0.55,  dRx, dy,   dx, dy,   dx, dBy);

  // bottom wedge (pink)
  tri(0.95, 0.35, 0.75,  dx, dBy,   dx, dy,   dLx, dy);

  // center diagonal split inside diamond (blue/pink feel)
  tri(0.25, 0.55, 0.95,  dx, dy,   dLx, dy,   dx, dTy);
  tri(0.95, 0.45, 0.60,  dx, dy,   dx, dBy,   dRx, dy);

  // =========================
  // A few extra small triangles to match the busy center look
  // (and to ensure 20+ triangles clearly)
  // =========================

  tri(0.98, 0.85, 0.25,  -0.05, 0.05,   0.05, 0.05,  0.05, -0.05);
  tri(0.95, 0.60, 0.70,  -0.30, 0.05,  -0.10, 0.05, -0.10, -0.15);
  tri(0.90, 0.25, 0.25,  -0.10, 0.35,   0.05, 0.05,  0.20, 0.05);
  tri(0.95, 0.60, 0.10,   0.20, 0.05,   0.30, 0.05,  0.20, -0.05);
}

