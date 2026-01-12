// DrawTriangle.js (c) 2012 matsuda
function clear_canvas(ctx, canvas) {
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function v1_inputsetup()
{
  const v1x = parseFloat(document.getElementById('v1x').value);
  const v1y = parseFloat(document.getElementById('v1y').value);
  return new Vector3([v1x, v1y, 0]);
}

function v2_inputsetup() {
  const v2x = parseFloat(document.getElementById('v2x').value);
  const v2y = parseFloat(document.getElementById('v2y').value);
  return new Vector3([v2x, v2y, 0]);
}

function handledraw() {
  const canvas = document.getElementById('example');
  const ctx = canvas.getContext('2d');

  clear_canvas(ctx, canvas);

  const v1x = parseFloat(document.getElementById('v1x').value);
  const v1y = parseFloat(document.getElementById('v1y').value);
  const v2x = parseFloat(document.getElementById('v2x').value);
  const v2y = parseFloat(document.getElementById('v2y').value);

  const v1 = new Vector3([v1x, v1y, 0]);
  const v2 = new Vector3([v2x, v2y, 0]);

  drawVector(ctx, canvas, v1, 'red');
  drawVector(ctx, canvas, v2, 'blue');
}

// for step 5, the drawing handler event
function DrawOperationEvent()
{
  const canvas = document.getElementById('example');
  const ctx = canvas.getContext('2d');
  clear_canvas(ctx, canvas);
  const v1 = v1_inputsetup();
  const v2 = v2_inputsetup();
  drawVector(ctx, canvas, v1, 'red');
  drawVector(ctx, canvas, v2, 'blue');

  const operation = document.getElementById('operation').value;
  const scalar = parseFloat(document.getElementById('scalar').value);

  if (operation === 'add')
  {
    // setting v3 as a sum of v1 and v2 here, you get it?
    const v3 = new Vector3([v1.elements[0], v1.elements[1], 0]);
    v3.add(v2);
    drawVector(ctx, canvas, v3, 'green');
  }
  else if (operation === 'sub') 
  {
    const v3 = new Vector3([v1.elements[0], v1.elements[1], 0]);
    v3.sub(v2);
    drawVector(ctx, canvas, v3, 'green');
  }
  else if (operation === 'mul') 
  {
    const v3 = new Vector3([v1.elements[0], v1.elements[1], 0]);
    const v4 = new Vector3([v2.elements[0], v2.elements[1], 0]);
    v3.mul(scalar);
    v4.mul(scalar);
    drawVector(ctx, canvas, v3, 'green');
    drawVector(ctx, canvas, v4, 'green');
  }
  else if (operation === 'div') 
  {
    const v3 = new Vector3([v1.elements[0], v1.elements[1], 0]);
    const v4 = new Vector3([v2.elements[0], v2.elements[1], 0]);
    v3.div(scalar);
    v4.div(scalar);
    drawVector(ctx, canvas, v3, 'green');
    drawVector(ctx, canvas, v4, 'green');
  }
  else if (operation === 'magnitude') 
  {
    // for the console log with magntitiudes
    console.log('v1 magnitude:', v1.magnitude());
    console.log('v2 magnitude:', v2.magnitude());
  }
  else if (operation === 'normalize')
  {
    const v3 = new Vector3([v1.elements[0], v1.elements[1], 0]).normalize();
    const v4 = new Vector3([v2.elements[0], v2.elements[1], 0]).normalize();
    drawVector(ctx, canvas, v3, 'green');
    drawVector(ctx, canvas, v4, 'green');
  }
  else if (operation === 'angle')
  {
    const angle = angleBetweenVectors(v1, v2);
    console.log('Angle: ', angle);
  }
  else if (operation === 'area')
  {
    const area = areaofTriangle(v1, v2);
    console.log('Area of the triangle: ', area);
  }
}

function areaofTriangle(v1, v2) {
  const c = Vector3.cross(v1, v2);
  const parallelogramArea = c.magnitude();
  return parallelogramArea / 2;
}

function angleBetweenVectors(v1, v2)
{
  const m1 = v1.magnitude();
  const m2 = v2.magnitude();
  if (m1 === 0 || m2 === 0) return 0;

  const dot_product = Vector3.dot(v1, v2);
  let cosA = dot_product / (m1 * m2);

  // avoids NaN from floating point rounding
  cosA = Math.max(-1, Math.min(1, cosA));

  const radians = Math.acos(cosA);
  const degrees = radians * (180 / Math.PI);
  return degrees;
}

function main() {  
  // Retrieve <canvas> element
  var canvas = document.getElementById('example');  
  if (!canvas) { 
    console.log('Failed to retrieve the <canvas> element');
    return false; 
  } 

  // Get the rendering context for 2DCG
  var ctx = canvas.getContext('2d');

  // Draw a blue rectangle
  ctx.fillStyle = 'black'; // Set color to blue
  ctx.fillRect(0, 0, canvas.width, canvas.height);        // Fill a rectangle with the color

  const v1 = new Vector3([2.25, 2.25, 0]);

  drawVector(ctx, canvas, v1, 'red');
}

  function drawVector(ctx, canvas, v, color) {
    const originX = canvas.width / 2;
    const originY = canvas.height / 2;
    const scale = 20;

    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(
      originX + v.elements[0] * scale,
      originY - v.elements[1] * scale 
    );
  ctx.stroke();
}