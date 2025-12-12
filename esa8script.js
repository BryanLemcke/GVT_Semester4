(function () {
  const canvas = document.getElementById('glcanvas8');
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

uniform mat4 uMVP;
uniform mat4 uMV;
uniform mat3 uNMatrix;

varying vec3 vNormal;
varying vec3 vPosVS;

void main() {
  vec4 posVS = uMV * vec4(aPos, 1.0);
  vPosVS = posVS.xyz;
  vNormal = normalize(uNMatrix * aNormal);

  gl_Position = uMVP * vec4(aPos, 1.0);
}
`;

const fsSource = `
precision mediump float;

varying vec3 vNormal;
varying vec3 vPosVS;

uniform bool uToonOn;

struct PhongMaterial {
  vec3 ka;
  vec3 kd;
  vec3 ks;
  float ke;
};
uniform PhongMaterial material;

uniform vec3 ambientLight;

const int MAX_LIGHT_SOURCES = 2;
struct LightSource {
  bool isOn;
  vec3 position;
  vec3 color;
};
uniform LightSource light[MAX_LIGHT_SOURCES];

vec3 phongSingle(vec3 p, vec3 n, vec3 v, LightSource l) {
  vec3 s = normalize(l.position - p);
  vec3 r = reflect(-s, n);
  float sn = max(dot(s, n), 0.0);
  float rv = max(dot(r, v), 0.0);

  vec3 diffuse  = material.kd * l.color * sn;
  vec3 specular = material.ks * l.color * pow(rv, material.ke);
  return diffuse + specular;
}

vec3 toonize(vec3 c) {
  float levels = 4.0;
  return floor(c * levels) / levels;
}

void main() {
  vec3 n = normalize(vNormal);
  vec3 v = normalize(-vPosVS);

  vec3 c = material.ka * ambientLight;
  for (int j = 0; j < MAX_LIGHT_SOURCES; j++) {
    if (light[j].isOn) c += phongSingle(vPosVS, n, v, light[j]);
  }

  if (uToonOn) c = toonize(c);

  gl_FragColor = vec4(c, 1.0);
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
    uMVP: gl.getUniformLocation(program, 'uMVP'),
    uMV:  gl.getUniformLocation(program, 'uMV'),
    uNMatrix: gl.getUniformLocation(program, 'uNMatrix'),
     uToonOn: gl.getUniformLocation(program, 'uToonOn'),
  ambientLight: gl.getUniformLocation(program, 'ambientLight'),

  material: {
    ka: gl.getUniformLocation(program, 'material.ka'),
    kd: gl.getUniformLocation(program, 'material.kd'),
    ks: gl.getUniformLocation(program, 'material.ks'),
    ke: gl.getUniformLocation(program, 'material.ke'),
  },

  light: [
    {
      isOn: gl.getUniformLocation(program, 'light[0].isOn'),
      position: gl.getUniformLocation(program, 'light[0].position'),
      color: gl.getUniformLocation(program, 'light[0].color'),
    },
    {
      isOn: gl.getUniformLocation(program, 'light[1].isOn'),
      position: gl.getUniformLocation(program, 'light[1].position'),
      color: gl.getUniformLocation(program, 'light[1].color'),
    }
  ]
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

  const a_drop = 0.6, b_drop = 1.1; 
  const Drop = {
    name: 'Tropfen',
    uRange: [0.0, Math.PI],
    vRange: [0.0, 2.0*Math.PI],
    grid: { nu: 80, nv: 48 },
    scale: 0.7,
    pos(u,v){
      const x = a_drop * (b_drop - Math.cos(u)) * Math.sin(u) * Math.cos(v);
      const y = a_drop * (b_drop - Math.cos(u)) * Math.sin(u) * Math.sin(v);
      const z = Math.cos(u);
      return [x,y,z];
    }
  };

  const a_h = 1.8, b_h = 1.7, c_h = 0.1;
  const Horn = {
    name: 'Horn',
    uRange: [0.0, 1.0],
    vRange: [-Math.PI, Math.PI],
    grid: { nu: 80, nv: 32 },
    scale: 0.4,
    pos(u,v){
      const x = (a_h + u*Math.cos(v)) * Math.sin(b_h*Math.PI*u);
      const y = (a_h + u*Math.cos(v)) * Math.cos(b_h*Math.PI*u) + c_h*u;
      const z = u * Math.sin(v);
      return [x,y,z];
    }
  };

  const SakuraPetal = {
    name: 'Sakura-Blatt',
    uRange: [0.0, 1.0],
    vRange: [-Math.PI/2, Math.PI/2],
    grid: { nu: 80, nv: 48 },
    scale: 0.7,
    pos(u, v) {
      const a = 1;
      const alpha = 1;
      const h = 0.2;
      const curl = 0.2;
      const n = 0.1;
      const sigma = 0.28;

      const smoothstep = (e0, e1, x) => {
        const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
        return t * t * (3 - 2 * t);
      };

      const sv = Math.sin(v);
      const cv = Math.cos(v);

      const Rb = 1 - 0.35 * (sv * sv) + 0.08 * Math.cos(3 * v);

      const vv = v / sigma;
      const gaussian = Math.exp(-(vv * vv)); 
      const notch = 1 - n * smoothstep(0.8, 1.0, u) * gaussian;

      const r = a * u * Rb * notch;

      const x = r * cv;
      const y = alpha * r * sv;

      const z = h * (1 - u * u) * (0.6 + 0.4 * (cv * cv))
              - curl * u * (sv * sv);

      return [x, y, z];
    }
  };

 function buildGeometry(S) {
  const { nu, nv } = S.grid;
  const u0 = S.uRange[0], u1 = S.uRange[1];
  const v0 = S.vRange[0], v1 = S.vRange[1];

  const pos  = new Float32Array(nu * nv * 3);
  const norm = new Float32Array(nu * nv * 3);

  const epsU = (u1 - u0) / (nu - 1) * 0.5;
  const epsV = (v1 - v0) / (nv - 1) * 0.5;

  const sub = (a,b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
  const cross = (a,b) => [
    a[1]*b[2]-a[2]*b[1],
    a[2]*b[0]-a[0]*b[2],
    a[0]*b[1]-a[1]*b[0]
  ];
  const normalize = (v) => {
    const l = Math.hypot(v[0],v[1],v[2]) || 1;
    return [v[0]/l, v[1]/l, v[2]/l];
  };

  for (let j = 0; j < nv; j++) {
    const v = v0 + (v1 - v0) * (j / (nv - 1));
    for (let i = 0; i < nu; i++) {
      const u = u0 + (u1 - u0) * (i / (nu - 1));

      const p = S.pos(u, v);
      const k = (j * nu + i) * 3;

      pos[k]   = p[0];
      pos[k+1] = p[1];
      pos[k+2] = p[2];

      const uA = Math.max(u0, u - epsU), uB = Math.min(u1, u + epsU);
      const vA = Math.max(v0, v - epsV), vB = Math.min(v1, v + epsV);

      const pU = sub(S.pos(uB, v), S.pos(uA, v));
      const pV = sub(S.pos(u, vB), S.pos(u, vA));

      const n = normalize(cross(pU, pV));

      norm[k]   = n[0];
      norm[k+1] = n[1];
      norm[k+2] = n[2];
    }
  }

  const tri = [];
  for (let j = 0; j < nv - 1; j++) {
    for (let i = 0; i < nu - 1; i++) {
      const a = j * nu + i;
      const b = a + 1;
      const c = a + nu;
      const d = c + 1;
      tri.push(a, b, c, b, d, c);
    }
  }

  return {
    pos,
    norm,
    indices: new Uint16Array(tri),
    triCount: tri.length
  };
}


  function createSurfaceObject(surface, tx, ty, tz, rotMat, color) {
  const geo = buildGeometry(surface);

  const vboPos = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vboPos);
  gl.bufferData(gl.ARRAY_BUFFER, geo.pos, gl.STATIC_DRAW);

  const vboNorm = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vboNorm);
  gl.bufferData(gl.ARRAY_BUFFER, geo.norm, gl.STATIC_DRAW);

  const ebo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geo.indices, gl.STATIC_DRAW);

  const s = surface.scale || 1.0;
  let model = scaleMatrix(s);
  if (rotMat) model = multiply(rotMat, model);
  model = multiply(translateMatrix(tx, ty, tz), model);

  return {
    vboPos,
    vboNorm,
    eboTri: ebo,
    triCount: geo.triCount,
    model,
    baseColor: color
  };
}

  const surfaceObjects = [
  createSurfaceObject(Drop, -0.6,  0.0,  0.0, rotX(Math.PI * -0.5), [0.2, 0.6, 1.0]),
  createSurfaceObject(Horn,  0.2,  0.4, -2.0, rotY(Math.PI * 0.2),  [0.9, 0.8, 0.2]),
  createSurfaceObject(SakuraPetal, 0.5, -0.4, -4.0, rotX(Math.PI * -0.5), [1.0, 0.5, 0.7])
];

const illumination = {
  ambientLight: [0.25, 0.25, 0.25],
  light: [
    { isOn: true, position: [ 4.5, 1.5,  0.0], color: [1.0, 1.0, 1.0] },
    { isOn: true, position: [-4.5, 1.5,  0.0], color: [1.0, 1.0, 1.0] }
  ]
};

let lightAngle = 0.0;
const LIGHT_STEP   = 0.08;
const LIGHT_RADIUS = 4.5;
const LIGHT_HEIGHT = 1.5;

let toonEnabled = false;

function updateLightsOnCircle() {
  const a = lightAngle;
  illumination.light[0].position = [Math.cos(a) * LIGHT_RADIUS, LIGHT_HEIGHT, Math.sin(a) * LIGHT_RADIUS];
  illumination.light[1].position = [Math.cos(a + Math.PI) * LIGHT_RADIUS, LIGHT_HEIGHT, Math.sin(a + Math.PI) * LIGHT_RADIUS];
}

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
  });

  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });

  window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const k = e.key.toLowerCase();

  if (k === 'l') {
    lightAngle += LIGHT_STEP;
    updateLightsOnCircle();
  }
  if (k === 't') {
    toonEnabled = !toonEnabled;
  }
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

  function draw() {
    const nearVal = 1.0;
    const farVal  = 20.0;
    resize();
    updateInput();

    gl.clearColor(0.1, 0.1, 0.1, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const proj = makePerspective(Math.PI / 3, aspect, nearVal, farVal);

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

    return new Float32Array([
      inv[0], inv[3], inv[6],
      inv[1], inv[4], inv[7],
      inv[2], inv[5], inv[8]
    ]);
  }
    const view = makeLookAt(cameraPos, cameraTarget, cameraUp);

    const rotSceneMat = multiply(rotY(rotYScene), rotX(rotXScene));

    gl.useProgram(program);

  gl.enableVertexAttribArray(loc.aPos);
  gl.enableVertexAttribArray(loc.aNormal);

  // globale Uniforms
  gl.uniform1i(loc.uToonOn, toonEnabled ? 1 : 0);
  gl.uniform3fv(loc.ambientLight, illumination.ambientLight);

  // Material (Default)
  gl.uniform3fv(loc.material.ka, [0.15, 0.15, 0.15]);
  gl.uniform3fv(loc.material.ks, [0.6,  0.6,  0.6 ]);
  gl.uniform1f (loc.material.ke, 32.0);

  // Lights: World -> View
  for (let j = 0; j < 2; j++) {
    const L = illumination.light[j];

    gl.uniform1i(loc.light[j].isOn, L.isOn ? 1 : 0);
    gl.uniform3fv(loc.light[j].color, L.color);

    const p = [L.position[0], L.position[1], L.position[2], 1.0];
    const pv = [
      view[0]*p[0] + view[4]*p[1] + view[8]*p[2]  + view[12]*p[3],
      view[1]*p[0] + view[5]*p[1] + view[9]*p[2]  + view[13]*p[3],
      view[2]*p[0] + view[6]*p[1] + view[10]*p[2] + view[14]*p[3]
    ];

    gl.uniform3fv(loc.light[j].position, pv);
  }


  for (const obj of surfaceObjects) {
    const modelScene = multiply(rotSceneMat, obj.model);
    const mv  = multiply(view, modelScene);
    const mvp = multiply(proj, mv);

    gl.uniformMatrix4fv(loc.uMV,  false, mv);
    gl.uniformMatrix4fv(loc.uMVP, false, mvp);

    const nmat = mat3InverseTranspose(mat3FromMat4(mv));
    gl.uniformMatrix3fv(loc.uNMatrix, false, nmat);

    gl.uniform3fv(loc.material.kd, obj.baseColor);

    gl.bindBuffer(gl.ARRAY_BUFFER, obj.vboPos);
    gl.vertexAttribPointer(loc.aPos, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, obj.vboNorm);
    gl.vertexAttribPointer(loc.aNormal, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, obj.eboTri);
    gl.drawElements(gl.TRIANGLES, obj.triCount, gl.UNSIGNED_SHORT, 0);
  }


    requestAnimationFrame(draw);
  }

  draw();
})();
