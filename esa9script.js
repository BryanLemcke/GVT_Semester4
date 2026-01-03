(function () {
  const canvas = document.getElementById('glcanvas9');
  if (!canvas) return;

  const gl = canvas.getContext('webgl', { antialias: true });
  if (!gl) {
    alert('WebGL wird nicht unterstützt.');
    return;
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(canvas.clientWidth * dpr);
    const h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  }

  window.addEventListener('resize', resize);
  if (!canvas.style.width) {
    canvas.style.width = '800px';
    canvas.style.height = '600px';
  }
  resize();

  const vsSource = `
attribute vec3 aPos;
attribute vec3 aNormal;
attribute vec2 aTexCoord;

uniform mat4 uMVP;
uniform mat4 uMV;
uniform mat3 uNMatrix;

varying vec3 vNormal;
varying vec3 vPosVS;
varying vec2 vUV;

void main() {
vUV = aTexCoord;
  vec4 posVS = uMV * vec4(aPos, 1.0);
  vPosVS = posVS.xyz;
  vNormal = normalize(uNMatrix * aNormal);
  gl_Position = uMVP * vec4(aPos, 1.0);
}
`;

const fsSource = `
precision mediump float;

varying vec2 vUV;

uniform sampler2D uTex;

void main() {
  gl_FragColor = texture2D(uTex, vUV);
}
`;


  function compileShader(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      throw new Error('Shader-Fehler');
    }
    return sh;
  }

  function createProgram(vsSrc, fsSrc) {
    const vs = compileShader(gl.VERTEX_SHADER, vsSrc);
    const fs = compileShader(gl.FRAGMENT_SHADER, fsSrc);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(prog));
      gl.deleteProgram(prog);
      throw new Error('Link-Fehler');
    }
    return prog;
  }

  const program = createProgram(vsSource, fsSource);
  gl.useProgram(program);

  const loc = {
  aPos: gl.getAttribLocation(program, 'aPos'),
  aNormal: gl.getAttribLocation(program, 'aNormal'),
  aTexCoord: gl.getAttribLocation(program, 'aTexCoord'),

  uMVP: gl.getUniformLocation(program, 'uMVP'),
  uMV: gl.getUniformLocation(program, 'uMV'),
  uNMatrix: gl.getUniformLocation(program, 'uNMatrix'),

  uTex: gl.getUniformLocation(program, 'uTex'),
};

function identity() {
    const m = new Float32Array(16);
    m[0] = m[5] = m[10] = m[15] = 1;
    return m;
}

  function multiply(a, b) {
    const out = new Float32Array(16);
    for (let i = 0; i < 4; ++i) {
      const ai0 = a[i], ai1 = a[i + 4], ai2 = a[i + 8], ai3 = a[i + 12];
      out[i]      = ai0*b[0] + ai1*b[1] + ai2*b[2]  + ai3*b[3];
      out[i + 4]  = ai0*b[4] + ai1*b[5] + ai2*b[6]  + ai3*b[7];
      out[i + 8]  = ai0*b[8] + ai1*b[9] + ai2*b[10] + ai3*b[11];
      out[i + 12] = ai0*b[12]+ ai1*b[13]+ ai2*b[14] + ai3*b[15];
    }
    return out;
  }

  function translateMatrix(tx, ty, tz) {
    const m = identity();
    m[12] = tx;
    m[13] = ty;
    m[14] = tz;
    return m;
  }

  function scaleMatrix(s) {
    const m = identity();
    m[0] = s;
    m[5] = s;
    m[10] = s;
    return m;
  }

  function rotX(a) {
    const c = Math.cos(a), s = Math.sin(a);
    return new Float32Array([
      1,  0,  0, 0,
      0,  c,  s, 0,
      0, -s,  c, 0,
      0,  0,  0, 1
    ]);
  }

  function rotY(a) {
    const c = Math.cos(a), s = Math.sin(a);
    return new Float32Array([
       c, 0, -s, 0,
       0, 1,  0, 0,
       s, 0,  c, 0,
       0, 0,  0, 1
    ]);
  }

  function normalize(v) {
    const len = Math.hypot(v[0], v[1], v[2]);
    return [v[0] / len, v[1] / len, v[2] / len];
  }

  function subtract(a, b) {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  }

  function cross(a, b) {
    return [
      a[1]*b[2] - a[2]*b[1],
      a[2]*b[0] - a[0]*b[2],
      a[0]*b[1] - a[1]*b[0]
    ];
  }

  function makeLookAt(eye, target, up) {
    const zAxis = normalize(subtract(eye, target)); 
    const xAxis = normalize(cross(up, zAxis));
    const yAxis = cross(zAxis, xAxis);

    const m = new Float32Array(16);

    m[0] = xAxis[0];
    m[1] = yAxis[0];
    m[2] = zAxis[0];
    m[3] = 0;

    m[4] = xAxis[1];
    m[5] = yAxis[1];
    m[6] = zAxis[1];
    m[7] = 0;

    m[8]  = xAxis[2];
    m[9]  = yAxis[2];
    m[10] = zAxis[2];
    m[11] = 0;

    m[12] = -(xAxis[0]*eye[0] + xAxis[1]*eye[1] + xAxis[2]*eye[2]);
    m[13] = -(yAxis[0]*eye[0] + yAxis[1]*eye[1] + yAxis[2]*eye[2]);
    m[14] = -(zAxis[0]*eye[0] + zAxis[1]*eye[1] + zAxis[2]*eye[2]);
    m[15] = 1;

    return m;
  }

  function makePerspective(fovy, aspect, near, far) {
    const f = 1.0 / Math.tan(fovy / 2);
    const nf = 1 / (near - far);
    const m = new Float32Array(16);

    m[0] = f / aspect;
    m[1] = 0;
    m[2] = 0;
    m[3] = 0;

    m[4] = 0;
    m[5] = f;
    m[6] = 0;
    m[7] = 0;

    m[8]  = 0;
    m[9]  = 0;
    m[10] = (far + near) * nf;
    m[11] = -1;

    m[12] = 0;
    m[13] = 0;
    m[14] = (2 * far * near) * nf;
    m[15] = 0;

    return m;
  }

  // Parametrisierte Flächen
    function createTorus(R = 1.4, r = 0.5, nuSeg = 128, nvSeg = 64) {
    const nu = nuSeg + 1;
    const nv = nvSeg + 1;

    const pos = new Float32Array(nu * nv * 3);
    const norm = new Float32Array(nu * nv * 3);
    const uv = new Float32Array(nu * nv * 2);
    const idx = new Uint16Array(nuSeg * nvSeg * 6);

    let p = 0, n = 0, t = 0;

    for (let j = 0; j < nv; j++) {
      const v = (j / nvSeg) * Math.PI * 2.0;
      const cv = Math.cos(v);
      const sv = Math.sin(v);

      for (let i = 0; i < nu; i++) {
        const u = (i / nuSeg) * Math.PI * 2.0;
        const cu = Math.cos(u);
        const su = Math.sin(u);

        const x = (R + r * cv) * cu;
        const y = r * sv;
        const z = (R + r * cv) * su;

        pos[p++] = x;
        pos[p++] = y;
        pos[p++] = z;

        norm[n++] = cu * cv;
        norm[n++] = sv;
        norm[n++] = su * cv;

        uv[t++] = i / nuSeg;
        uv[t++] = j / nvSeg;
      }
    }

    let k = 0;
    for (let j = 0; j < nvSeg; j++) {
      for (let i = 0; i < nuSeg; i++) {
        const a = j * nu + i;
        const b = a + 1;
        const c = a + nu;
        const d = c + 1;

        idx[k++] = a; idx[k++] = c; idx[k++] = b;
        idx[k++] = b; idx[k++] = c; idx[k++] = d;
      }
    }

    return { pos, norm, uv, idx };
  }

const mesh = createTorus(1.4, 0.5, 140, 70);

const vboPos = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vboPos);
gl.bufferData(gl.ARRAY_BUFFER, mesh.pos, gl.STATIC_DRAW);

const vboNorm = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vboNorm);
gl.bufferData(gl.ARRAY_BUFFER, mesh.norm, gl.STATIC_DRAW);

const vboUV = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vboUV);
gl.bufferData(gl.ARRAY_BUFFER, mesh.uv, gl.STATIC_DRAW);

const eboTri = gl.createBuffer();
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, eboTri);
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.idx, gl.STATIC_DRAW);


  //Kamera & Interaktion

  let cameraPos = [0, 0, 8.0];
  const cameraTarget = [0, 0, 0];
  const cameraUp = [0, 1, 0];

  const moveSpeed = 0.07;

  let rotXScene = 0.0;
  let rotYScene = 0.0;
  const rotSpeed = 0.03;

  const keys = {};

  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
      if (!e.repeat && e.code === 'KeyP') {
    useProcedural = !useProcedural;
    console.log(
      'Texturmodus:',
      useProcedural ? 'prozedural' : 'Bild'
    );
  }
  });

  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
    
  });

  function updateInput() {
    if (keys['KeyW']) cameraPos[1] += moveSpeed;
    if (keys['KeyS']) cameraPos[1] -= moveSpeed;
    if (keys['KeyA']) cameraPos[0] -= moveSpeed;
    if (keys['KeyD']) cameraPos[0] += moveSpeed;

    if (keys['ArrowLeft'])  rotYScene -= rotSpeed;
    if (keys['ArrowRight']) rotYScene += rotSpeed;
    if (keys['ArrowUp'])    rotXScene -= rotSpeed;
    if (keys['ArrowDown'])  rotXScene += rotSpeed;
  }

  // Render-Setup

  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.clearDepth(1.0);

  function mat3FromMat4(m){
  return new Float32Array([
    m[0], m[1], m[2],
    m[4], m[5], m[6],
    m[8], m[9], m[10]
  ]);
}

function mat3InverseTranspose(a){
  const a00=a[0],a01=a[1],a02=a[2],
        a10=a[3],a11=a[4],a12=a[5],
        a20=a[6],a21=a[7],a22=a[8];

  const b01 = a22*a11 - a12*a21;
  const b11 = -a22*a10 + a12*a20;
  const b21 = a21*a10 - a11*a20;

  let det = a00*b01 + a01*b11 + a02*b21;
  if (!det) det = 1.0;
  det = 1.0 / det;

  const inv = new Float32Array([
    b01*det,
    (-a22*a01 + a02*a21)*det,
    (a12*a01 - a02*a11)*det,

    b11*det,
    (a22*a00 - a02*a20)*det,
    (-a12*a00 + a02*a10)*det,

    b21*det,
    (-a21*a00 + a01*a20)*det,
    (a11*a00 - a01*a10)*det
  ]);

  // transpose(inv)
  return new Float32Array([
    inv[0], inv[3], inv[6],
    inv[1], inv[4], inv[7],
    inv[2], inv[5], inv[8]
  ]);
}

 // Image-Setup
const tex = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, tex);

gl.texImage2D(
  gl.TEXTURE_2D, 0, gl.RGBA,
  1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
  new Uint8Array([255, 0, 255, 255])
);

gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

const img = new Image();
img.onload = () => {
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
};

img.src = "images/torusImage.png";

//Bonus
function createCheckerTexture(gl, size = 256, checks = 16) {
  const data = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cx = Math.floor((x / size) * checks);
      const cy = Math.floor((y / size) * checks);
      const on = ((cx + cy) % 2) === 0;

      const i = (y * size + x) * 4;

      const r = on ? 235 : 25;
      const g = on ? 210 : 35;
      const b = on ? 255 : 90;

      data[i + 0] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }

  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  gl.texImage2D(
    gl.TEXTURE_2D, 0, gl.RGBA,
    size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data
  );

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  gl.bindTexture(gl.TEXTURE_2D, null);
  return t;
}

const texProc = createCheckerTexture(gl, 256, 18);

let useProcedural = false; 
//Bonus Ende

  function draw() {
  resize();
  updateInput();

  gl.clearColor(0.1, 0.1, 0.1, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  const nearVal = 1.0;
  const farVal  = 20.0;
  const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;

  const proj = makePerspective(Math.PI / 3, aspect, nearVal, farVal);
  const view = makeLookAt(cameraPos, cameraTarget, cameraUp);
  const rotSceneMat = multiply(rotY(rotYScene), rotX(rotXScene));

  gl.useProgram(program);

  gl.enableVertexAttribArray(loc.aPos);
  gl.enableVertexAttribArray(loc.aNormal);
  gl.enableVertexAttribArray(loc.aTexCoord);

  const model = rotSceneMat;
  const mv  = multiply(view, model);
  const mvp = multiply(proj, mv);

  gl.uniformMatrix4fv(loc.uMV,  false, mv);
  gl.uniformMatrix4fv(loc.uMVP, false, mvp);

  const nmat = mat3InverseTranspose(mat3FromMat4(mv));
  gl.uniformMatrix3fv(loc.uNMatrix, false, nmat);

  gl.bindBuffer(gl.ARRAY_BUFFER, vboPos);
  gl.vertexAttribPointer(loc.aPos, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, vboNorm);
  gl.vertexAttribPointer(loc.aNormal, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, vboUV);
  gl.vertexAttribPointer(loc.aTexCoord, 2, gl.FLOAT, false, 0, 0);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, useProcedural ? texProc : tex);
  gl.uniform1i(loc.uTex, 0);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, eboTri);
  gl.drawElements(gl.TRIANGLES, mesh.idx.length, gl.UNSIGNED_SHORT, 0);

  requestAnimationFrame(draw);
}

draw();
})();
 
 