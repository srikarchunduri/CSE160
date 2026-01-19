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
