// camera.js
(() => {
  "use strict";

  function mat4Identity() {
    return new Float32Array([
      1,0,0,0,
      0,1,0,0,
      0,0,1,0,
      0,0,0,1
    ]);
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

  // CLEAN LookAt (stable)
  function mat4LookAt(out, eye, at, up) {
    const zx = eye[0] - at[0];
    const zy = eye[1] - at[1];
    const zz = eye[2] - at[2];
    let zlen = Math.hypot(zx, zy, zz);
    const zxN = zx / zlen;
    const zyN = zy / zlen;
    const zzN = zz / zlen;

    const xx = up[1]*zzN - up[2]*zyN;
    const xy = up[2]*zxN - up[0]*zzN;
    const xz = up[0]*zyN - up[1]*zxN;
    let xlen = Math.hypot(xx, xy, xz);
    const xxN = xx / xlen;
    const xyN = xy / xlen;
    const xzN = xz / xlen;

    const yx = zyN*xzN - zzN*xyN;
    const yy = zzN*xxN - zxN*xzN;
    const yz = zxN*xyN - zyN*xxN;

    out[0]=xxN; out[1]=yx; out[2]=zxN; out[3]=0;
    out[4]=xyN; out[5]=yy; out[6]=zyN; out[7]=0;
    out[8]=xzN; out[9]=yz; out[10]=zzN; out[11]=0;

    out[12]=-(xxN*eye[0]+xyN*eye[1]+xzN*eye[2]);
    out[13]=-(yx*eye[0]+yy*eye[1]+yz*eye[2]);
    out[14]=-(zxN*eye[0]+zyN*eye[1]+zzN*eye[2]);
    out[15]=1;

    return out;
  }

  class Camera {
    constructor({
      pos=[2.5,3.2,2.5],
      yaw=0,
      pitch=0,
      fovDeg=60,
      near=0.1,
      far=500
    }={}) {

      this.pos = pos.slice();
      this.yaw = yaw;
      this.pitch = pitch;

      this.fov = fovDeg*Math.PI/180;
      this.near = near;
      this.far = far;

      this.view = mat4Identity();
      this.proj = mat4Identity();

      this.maxPitch = Math.PI/2 - 0.01;
      this.up = [0,1,0];
    }

    setAspect(aspect){
      mat4Perspective(this.proj, this.fov, aspect, this.near, this.far);
    }

    look(dYaw, dPitch){
      this.yaw += dYaw;
      this.pitch += dPitch;

      if(this.pitch > this.maxPitch) this.pitch = this.maxPitch;
      if(this.pitch < -this.maxPitch) this.pitch = -this.maxPitch;
    }

    getForward(){
      return [
        Math.sin(this.yaw)*Math.cos(this.pitch),
        Math.sin(this.pitch),
        Math.cos(this.yaw)*Math.cos(this.pitch)
      ];
    }

    updateView(){
      const f = this.getForward();
      const at = [
        this.pos[0]+f[0],
        this.pos[1]+f[1],
        this.pos[2]+f[2]
      ];
      mat4LookAt(this.view, this.pos, at, this.up);
    }

    moveForward(d){
      this.pos[0]+=Math.sin(this.yaw)*d;
      this.pos[2]+=Math.cos(this.yaw)*d;
    }

    moveBackward(d){ this.moveForward(-d); }

    strafeRight(d){
      this.pos[0]+=Math.cos(this.yaw)*d;
      this.pos[2]-=Math.sin(this.yaw)*d;
    }

    strafeLeft(d){ this.strafeRight(-d); }

    moveUp(d){ this.pos[1]+=d; }

    getForwardDir(){ return this.getForward(); }
  }

  window.Camera = Camera;
})();
