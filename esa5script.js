(function () {
  const canvas = document.getElementById('glcanvas5');
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
    attribute vec3 aColor;
    uniform mat4 uMVP;
    varying vec3 vColor;
    void main() {
      gl_Position = uMVP * vec4(aPos, 1.0);
      vColor = aColor;
    }
  `;

  const fsSource = `
    precision mediump float;
    varying vec3 vColor;
    void main() {
      gl_FragColor = vec4(vColor, 1.0);
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
    aPos:   gl.getAttribLocation(program, 'aPos'),
    aColor: gl.getAttribLocation(program, 'aColor'),
    uMVP:   gl.getUniformLocation(program, 'uMVP')
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

  function rotZ(a) {
    const c = Math.cos(a), s = Math.sin(a);
    return new Float32Array([
       c,  s, 0, 0,
      -s,  c, 0, 0,
       0,  0, 1, 0,
       0,  0, 0, 1
    ]);
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

  // Geometrie für Flächen
  function buildGeometry(S) {
    const {nu, nv} = S.grid;
    const u0 = S.uRange[0], u1 = S.uRange[1];
    const v0 = S.vRange[0], v1 = S.vRange[1];

    const pos = new Float32Array(nu * nv * 3);
    const col = new Float32Array(nu * nv * 3);

    let zmin = +1e9, zmax = -1e9;

    for (let j = 0; j < nv; j++) {
      const v = v0 + (v1 - v0) * (j / (nv - 1));
      for (let i = 0; i < nu; i++) {
        const u = u0 + (u1 - u0) * (i / (nu - 1));
        const [x,y,z] = S.pos(u,v);
        const k = (j*nu + i) * 3;
        pos[k]   = x;
        pos[k+1] = y;
        pos[k+2] = z;
        if (z < zmin) zmin = z;
        if (z > zmax) zmax = z;
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

    function lerp(a,b,t){ return a + (b-a)*t; }
    function mixColor(c1,c2,t){
      return [ lerp(c1[0],c2[0],t),
               lerp(c1[1],c2[1],t),
               lerp(c1[2],c2[2],t) ];
    }

    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const n = j*nu + i;
        const u = u0 + (u1-u0) * (i/(nu-1));
        const v = v0 + (v1-v0) * (j/(nv-1));
        const z = pos[n*3 + 2];
        let c = [1,1,1];

        if (S.name === 'Tropfen') {
          const span = Math.max(1e-6, zmax - zmin);
          const t = (z - zmin)/span;
          const c1 = [0.05,0.10,0.40];
          const c2 = [0.70,0.90,1.00];
          c = mixColor(c1, c2, t);
        } else if (S.name === 'Horn') {
          const t = (v - v0)/(v1 - v0);
          const c1 = [0.90,0.75,0.35];
          const c2 = [0.45,0.35,0.10];
          c = mixColor(c1,c2,t);
        } else if (S.name === 'Sakura-Blatt') {
          const t = u;
          const c1 = [1.0,0.85,0.9];
          const c2 = [0.9,0.25,0.35];
          const c3 = [1.0,0.95,0.95];
          const mid = mixColor(c1,c2,t);
          const edge = mixColor(mid,c3,0.3*Math.abs(Math.sin(v*2.0)));
          c = edge;
        }

        col[n*3+0] = c[0];
        col[n*3+1] = c[1];
        col[n*3+2] = c[2];
      }
    }

    return {
      pos,
      col,
      indices: new Uint16Array(tri),
      triCount: tri.length
    };
  }

  function createSurfaceObject(surface, tx, ty, tz, rotMat) {
    const geo = buildGeometry(surface);

    const vboPos = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vboPos);
    gl.bufferData(gl.ARRAY_BUFFER, geo.pos, gl.STATIC_DRAW);

    const vboCol = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vboCol);
    gl.bufferData(gl.ARRAY_BUFFER, geo.col, gl.STATIC_DRAW);

    const ebo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geo.indices, gl.STATIC_DRAW);

    const s = surface.scale || 1.0;
    let model = scaleMatrix(s);
    if (rotMat) model = multiply(rotMat, model);
    model = multiply(translateMatrix(tx, ty, tz), model);

    return {
      vboPos,
      vboCol,
      eboTri: ebo,
      triCount: geo.triCount,
      model
    };
  }

  // Flächen in der Szene
  const surfaceObjects = [
    createSurfaceObject(Drop,        -2.2, 0.0,  0.0, rotZ(Math.PI / 2)),
    createSurfaceObject(Horn,         0.0, 0.0,  0.0, rotZ(-Math.PI / 4)),
    createSurfaceObject(SakuraPetal,  2.2, 0.0,  0.0, rotZ(0.0))
  ];

  // Rekursive Kugel
  function buildSphereGeometry(level) {
    let vertices = [
      [ 1, 0, 0],
      [-1, 0, 0],
      [ 0, 1, 0],
      [ 0,-1, 0],
      [ 0, 0, 1],
      [ 0, 0,-1]
    ].map(normalize);

    let faces = [
      [0,2,4],[2,1,4],[1,3,4],[3,0,4],
      [2,0,5],[1,2,5],[3,1,5],[0,3,5]
    ];

    function getMidpointIndex(i1, i2, vertList, cache) {
      const key = i1 < i2 ? i1 + '_' + i2 : i2 + '_' + i1;
      if (cache.has(key)) return cache.get(key);

      const v1 = vertList[i1];
      const v2 = vertList[i2];
      const mx = (v1[0] + v2[0]) * 0.5;
      const my = (v1[1] + v2[1]) * 0.5;
      const mz = (v1[2] + v2[2]) * 0.5;
      const n = normalize([mx,my,mz]);
      const idx = vertList.length;
      vertList.push(n);
      cache.set(key, idx);
      return idx;
    }

    for (let r = 0; r < level; r++) {
      const newFaces = [];
      const cache = new Map();
      for (const f of faces) {
        const i0 = f[0], i1 = f[1], i2 = f[2];
        const a = getMidpointIndex(i0, i1, vertices, cache);
        const b = getMidpointIndex(i1, i2, vertices, cache);
        const c = getMidpointIndex(i2, i0, vertices, cache);

        newFaces.push([i0,a,c], [i1,b,a], [i2,c,b], [a,b,c]);
      }
      faces = newFaces;
    }

    const vertCount = vertices.length;
    const triCount = faces.length;

    const pos = new Float32Array(vertCount * 3);
    const col = new Float32Array(vertCount * 3);
    const triIndices = new Uint16Array(triCount * 3);

    for (let i = 0; i < vertCount; i++) {
      const v = vertices[i];
      const k = i*3;
      pos[k]   = v[0];
      pos[k+1] = v[1];
      pos[k+2] = v[2];

      const t = (v[1] + 1) * 0.5;
      const c1 = [0.1,0.2,0.6];
      const c2 = [0.9,0.95,1.0];
      col[k]   = c1[0] + (c2[0]-c1[0])*t;
      col[k+1] = c1[1] + (c2[1]-c1[1])*t;
      col[k+2] = c1[2] + (c2[2]-c1[2])*t;
    }

    for (let i = 0; i < triCount; i++) {
      const f = faces[i];
      triIndices[i*3]   = f[0];
      triIndices[i*3+1] = f[1];
      triIndices[i*3+2] = f[2];
    }

    const lineList = [];
    function addEdge(i0, i1) {
      lineList.push(i0, i1);
    }
    for (const f of faces) {
      addEdge(f[0], f[1]);
      addEdge(f[1], f[2]);
      addEdge(f[2], f[0]);
    }
    const lineIndices = new Uint16Array(lineList);

    return {
      pos,
      col,
      triIndices,
      lineIndices,
      triCount: triCount * 3,
      lineCount: lineList.length
    };
  }

  function createSphereObject(level) {
    const geo = buildSphereGeometry(level);

    const vboPos = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vboPos);
    gl.bufferData(gl.ARRAY_BUFFER, geo.pos, gl.STATIC_DRAW);

    const vboCol = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vboCol);
    gl.bufferData(gl.ARRAY_BUFFER, geo.col, gl.STATIC_DRAW);

    const eboTri = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, eboTri);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geo.triIndices, gl.STATIC_DRAW);

    const eboLine = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, eboLine);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geo.lineIndices, gl.STATIC_DRAW);

    const s = 1.2;
    const model = multiply(
      translateMatrix(0.0, 0.0, -2.0),
      scaleMatrix(s)
    );

    return {
      vboPos,
      vboCol,
      eboTri,
      eboLine,
      triCount: geo.triCount,
      lineCount: geo.lineCount,
      model
    };
  }

  // Rekursionstiefe & Kugel
  let sphereDepth = 0;
  let sphere = createSphereObject(sphereDepth);

  const depthMinusBtn = document.getElementById('depthMinus');
  const depthPlusBtn  = document.getElementById('depthPlus');
  const depthValueSpan = document.getElementById('depthValue');

  function updateDepthDisplay() {
    if (depthValueSpan) depthValueSpan.textContent = String(sphereDepth);
  }
  updateDepthDisplay();

  function rebuildSphere() {
    sphere = createSphereObject(sphereDepth);
    updateDepthDisplay();
  }

  if (depthMinusBtn) {
    depthMinusBtn.addEventListener('click', () => {
      if (sphereDepth > 0) {
        sphereDepth--;
        rebuildSphere();
      }
    });
  }
  if (depthPlusBtn) {
    depthPlusBtn.addEventListener('click', () => {
      if (sphereDepth < 4) {
        sphereDepth++;
        rebuildSphere();
      }
    });
  }

  let sphereDrawFill  = true;
  let sphereDrawLines = false;

  let camAngle  = 0.0;
  let camRadius = 7.0;  
  const camHeight = 2.5; 

  const camAngleStep  = 0.05;
  const camRadiusStep = 0.3;

  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft')  camAngle -= camAngleStep;
    if (e.key === 'ArrowRight') camAngle += camAngleStep;

    if (e.key === 'n' || e.key === 'N') {
      if (e.shiftKey) camRadius = Math.max(2.0, camRadius - camRadiusStep);
      else            camRadius += camRadiusStep;
    }

    if (e.key === 'm' || e.key === 'M') {
      if (!sphereDrawFill && sphereDrawLines) {
        sphereDrawLines = false;
        sphereDrawFill = true;

      } else if (sphereDrawFill && !sphereDrawLines) {
        sphereDrawFill = false;
        sphereDrawLines = true;
      }
    }
  });

  // Render
  gl.enable(gl.DEPTH_TEST);

  function draw() {
    resize();
    gl.clearColor(0.05, 0.07, 0.10, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const eyeX = camRadius * Math.cos(camAngle);
    const eyeZ = camRadius * Math.sin(camAngle);
    const eyeY = camHeight;

    const eye    = [eyeX, eyeY, eyeZ];
    const target = [0, 0, 0];
    const up     = [0, 1, 0];

    const view = makeLookAt(eye, target, up);
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const proj = makePerspective(Math.PI / 3, aspect, 0.1, 100.0);
    const viewProj = multiply(proj, view);
    const sceneRot = rotX(-Math.PI / 2);
    const vpScene  = multiply(viewProj, sceneRot); 


    gl.useProgram(program);
    gl.enableVertexAttribArray(loc.aPos);
    gl.enableVertexAttribArray(loc.aColor);

    for (const obj of surfaceObjects) {
      const mvp = multiply(vpScene, obj.model);
      gl.uniformMatrix4fv(loc.uMVP, false, mvp);

      gl.bindBuffer(gl.ARRAY_BUFFER, obj.vboPos);
      gl.vertexAttribPointer(loc.aPos, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, obj.vboCol);
      gl.vertexAttribPointer(loc.aColor, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, obj.eboTri);
      gl.drawElements(gl.TRIANGLES, obj.triCount, gl.UNSIGNED_SHORT, 0);
    }

    if (sphere) {
      const mvpSphere = multiply(vpScene, sphere.model);
      gl.uniformMatrix4fv(loc.uMVP, false, mvpSphere);

      gl.bindBuffer(gl.ARRAY_BUFFER, sphere.vboPos);
      gl.vertexAttribPointer(loc.aPos, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, sphere.vboCol);
      gl.vertexAttribPointer(loc.aColor, 3, gl.FLOAT, false, 0, 0);

      if (sphereDrawFill) {
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphere.eboTri);
        gl.drawElements(gl.TRIANGLES, sphere.triCount, gl.UNSIGNED_SHORT, 0);
      }

      if (sphereDrawLines) {
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphere.eboLine);
        gl.drawElements(gl.LINES, sphere.lineCount, gl.UNSIGNED_SHORT, 0);
      }
    }

    requestAnimationFrame(draw);
  }

  draw();
})();
