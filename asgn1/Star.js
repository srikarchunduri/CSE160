class Star {
  constructor() {
    this.type = 'star';
    this.position = [0.0, 0.0, 0.0];
    this.color = [1.0, 1.0, 1.0, 1.0];
    this.size = 10.0;      // outer radius in pixel-ish scale
    this.points = 5;       // 5 point star
  }

  render() {
    const xy = this.position;
    const rgba = this.color;

    gl.uniform4f(u_FragColor, rgba[0], rgba[1], rgba[2], rgba[3]);

    // Convert size (pixels) -> clip space
    const R = (this.size / 400) * 2;     // outer radius
    const r = R * 0.45;                  // inner radius

    // Build 10 vertices alternating outer/inner
    const verts = [];
    const cx = xy[0], cy = xy[1];

    // Start pointing up
    const startAngle = -Math.PI / 2;

    for (let i = 0; i < this.points * 2; i++) {
      const ang = startAngle + i * (Math.PI / this.points);
      const radius = (i % 2 === 0) ? R : r;
      verts.push([cx + Math.cos(ang) * radius, cy + Math.sin(ang) * radius]);
    }

    // Draw star as triangles from center to each edge pair
    for (let i = 0; i < verts.length; i++) {
      const p1 = verts[i];
      const p2 = verts[(i + 1) % verts.length];
      drawTriangle([cx, cy, p1[0], p1[1], p2[0], p2[1]]);
    }
  }
}
