(function () {
  const canvas = document.getElementById('glcanvas7');
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
    uniform mat4 uMVP;
    uniform mat4 uMV;
    varying float vDepth;

    void main() {
    vec4 viewPos = uMV * vec4(aPos, 1.0);
    // z im View-Space ist (bei Standard-OpenGL-Konvention) negativ vor der Kamera
    vDepth = -viewPos.z;  // Entfernung entlang Z zur Kamera, positiv nach vorne

    gl_Position = uMVP * vec4(aPos, 1.0);
  }

  `;

  const fsSource = `
    precision mediump float;

    varying float vDepth;
    uniform float uNear;
    uniform float uFar;

    void main() {
        float depth01 = (vDepth - uNear) / (uFar - uNear);
        depth01 = clamp(depth01, 0.0, 1.0);

        float gray =depth01;

        gl_FragColor = vec4(vec3(gray), 1.0);
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
    uMVP: gl.getUniformLocation(program, 'uMVP'),
    uMV:  gl.getUniformLocation(program, 'uMV'),
    uNear: gl.getUniformLocation(program, 'uNear'),
    uFar:  gl.getUniformLocation(program, 'uFar')
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
    const {nu, nv} = S.grid;
    const u0 = S.uRange[0], u1 = S.uRange[1];
    const v0 = S.vRange[0], v1 = S.vRange[1];

    const pos = new Float32Array(nu * nv * 3);

    for (let j = 0; j < nv; j++) {
      const v = v0 + (v1 - v0) * (j / (nv - 1));
      for (let i = 0; i < nu; i++) {
        const u = u0 + (u1 - u0) * (i / (nu - 1));
        const [x,y,z] = S.pos(u,v);
        const k = (j*nu + i) * 3;
        pos[k]   = x;
        pos[k+1] = y;
        pos[k+2] = z;
      }
    }

    const tri = [];
    for (let j = 0; j < nv-1; j++) {
      for (let i = 0; i < nu-1; i++) {
        const a = j*nu + i;
        const b = a + 1;
        const c = a + nu;
        const d = c + 1;
        tri.push(a, b, c,  b, d, c);
      }
    }

    return {
      pos,
      indices: new Uint16Array(tri),
      triCount: tri.length
    };
  }

  function createSurfaceObject(surface, tx, ty, tz, rotMat) {
    const geo = buildGeometry(surface);

    const vboPos = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vboPos);
    gl.bufferData(gl.ARRAY_BUFFER, geo.pos, gl.STATIC_DRAW);

    const ebo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geo.indices, gl.STATIC_DRAW);

    const s = surface.scale || 1.0;
    let model = scaleMatrix(s);
    if (rotMat) model = multiply(rotMat, model);
    model = multiply(translateMatrix(tx, ty, tz), model);

    return {
      vboPos,
      eboTri: ebo,
      triCount: geo.triCount,
      model
    };
  }

  const surfaceObjects = [
    createSurfaceObject(Drop, -0.6,  0.0, 0, rotX(Math.PI * -0.5)),
    createSurfaceObject(Horn, 0.2,  0.4, -2, rotY(Math.PI * 0.2)),
    createSurfaceObject(SakuraPetal, 0.5, -0.4,  -4, rotX(-Math.PI *-0.5))
  ];

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
    gl.uniform1f(loc.uNear, nearVal);
    gl.uniform1f(loc.uFar,  farVal);
    resize();
    updateInput();

    gl.clearColor(0.1, 0.1, 0.1, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const proj = makePerspective(Math.PI / 3, aspect, nearVal, farVal);


    const view = makeLookAt(cameraPos, cameraTarget, cameraUp);

    const vp = multiply(proj, view);

    const rotSceneMat = multiply(rotY(rotYScene), rotX(rotXScene));

    gl.useProgram(program);
    gl.enableVertexAttribArray(loc.aPos);

    for (const obj of surfaceObjects) {
      const modelScene = multiply(rotSceneMat, obj.model);
      const mv = multiply(view, modelScene);
      const mvp = multiply(proj, mv);

      gl.uniformMatrix4fv(loc.uMV,  false, mv);
      gl.uniformMatrix4fv(loc.uMVP, false, mvp);

      gl.bindBuffer(gl.ARRAY_BUFFER, obj.vboPos);
      gl.vertexAttribPointer(loc.aPos, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, obj.eboTri);
      gl.drawElements(gl.TRIANGLES, obj.triCount, gl.UNSIGNED_SHORT, 0);
    }

    requestAnimationFrame(draw);
  }

  draw();
})();
