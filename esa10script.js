(function () {
  const canvas = document.getElementById('glcanvas10');
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
attribute vec3 aColor;

uniform mat4 uMVP;
uniform float uPointSize;

varying vec3 vColor;

void main() {
  vColor = aColor;
  gl_Position = uMVP * vec4(aPos, 1.0);
  gl_PointSize = uPointSize; // in Pixeln
}
`;

const fsSource = `
precision mediump float;

varying vec3 vColor;

void main() {
  // Kreis aus Square-Point machen
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(c, c);
  if (r2 > 1.0) discard;

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
  aPos: gl.getAttribLocation(program, 'aPos'),
  aColor: gl.getAttribLocation(program, 'aColor'),
  uMVP: gl.getUniformLocation(program, 'uMVP'),
  uPointSize: gl.getUniformLocation(program, 'uPointSize'),
};

let vboPos = gl.createBuffer();
let vboCol = gl.createBuffer();
let pointCount = 0;

function setPointCloud(positions, colors) {
  pointCount = positions.length / 3;

  gl.bindBuffer(gl.ARRAY_BUFFER, vboPos);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);

  gl.bindBuffer(gl.ARRAY_BUFFER, vboCol);
  gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
}

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
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
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

  //CSV Code Anfang
  async function loadText(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fetch failed: ${url}`);
    return await res.text();
  }

  function parseCSVWithHeader(text) {
    const lines = text.trim().split(/\r?\n/).filter(l => l.trim().length > 0);
    const sep = lines[0].includes(";") ? ";" : ",";
    const header = lines[0].split(sep).map(s => s.trim());
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(sep).map(s => s.trim());
      const obj = {};
      for (let j = 0; j < header.length; j++) obj[header[j]] = cols[j];
      rows.push(obj);
    }
    return rows;
  }

  function parseCSVRows(text) {
    const lines = text.trim().split(/\r?\n/).filter(l => l.trim().length > 0);
    const sep = lines[0].includes(";") ? ";" : ",";
    const first = lines[0].split(sep).map(s => s.trim());
    const hasHeader = first.some(v => /[a-zA-Z]/.test(v));
    const start = hasHeader ? 1 : 0;

    const rows = [];
    for (let i = start; i < lines.length; i++) {
      rows.push(lines[i].split(sep).map(s => s.trim()));
    }
    return rows;
  }

  function labelToColor(label) {
    if (label == 1) return [1.0, 0.2, 0.2]; // Kama rot
    if (label == 2) return [0.2, 1.0, 0.2]; // Rosa grün
    return [0.2, 0.4, 1.0];                 // Canadian blau
  }

  function normalizePositionsInPlace(pos, targetRadius = 3.0) {
    let maxR = 0;
    for (let i = 0; i < pos.length; i += 3) {
      const r = Math.hypot(pos[i], pos[i+1], pos[i+2]);
      if (r > maxR) maxR = r;
    }
    if (maxR < 1e-6) return;
    const s = targetRadius / maxR;
    for (let i = 0; i < pos.length; i++) pos[i] *= s;
  }

  // Beste Lösung laden
  async function loadBestData() {
    const text = await loadText("data/seeds_best.csv");
    const rows = parseCSVWithHeader(text);

    const pos = new Float32Array(rows.length * 3);
    const col = new Float32Array(rows.length * 3);

    for (let i = 0; i < rows.length; i++) {
      const x = parseFloat(rows[i].x);
      const y = parseFloat(rows[i].y);
      const z = parseFloat(rows[i].z);
      const label = parseInt(rows[i].label, 10);

      pos[i*3+0] = x;
      pos[i*3+1] = y;
      pos[i*3+2] = z;

      const c = labelToColor(label);
      col[i*3+0] = c[0];
      col[i*3+1] = c[1];
      col[i*3+2] = c[2];
    }

    normalizePositionsInPlace(pos, 3.0);
    setPointCloud(pos, col);
  }

  async function loadRawSeeds() {
  const text = await loadText("data/Seeds_dataset.csv");
  const rows = parseCSVRows(text);

  X = [];
  labels = [];

  for (const cols of rows) {
    if (cols.length < 8) continue;

    const feat = [];
    for (let i = 0; i < 7; i++) feat.push(parseFloat(cols[i]));
    const lab = parseInt(cols[7], 10);

    if (feat.some(v => Number.isNaN(v)) || Number.isNaN(lab)) continue;

    X.push(feat);
    labels.push(lab);
  }
}

  // t-SNE Algorithmus
  let tsne = null;
  let X = [];      
  let labels = [];
  let stepCount = 0;

  function updateStepUI() {
    const el = document.getElementById("stepCount");
    if (el) el.textContent = String(stepCount);
  }

  function updatePointCloudFromY(Y) {
    const pos = new Float32Array(Y.length * 3);
    const col = new Float32Array(Y.length * 3);

    for (let i = 0; i < Y.length; i++) {
      pos[i*3+0] = Y[i][0];
      pos[i*3+1] = Y[i][1];
      pos[i*3+2] = Y[i][2];

      const c = labelToColor(labels[i]);
      col[i*3+0] = c[0];
      col[i*3+1] = c[1];
      col[i*3+2] = c[2];
    }

    normalizePositionsInPlace(pos, 3.0);
    setPointCloud(pos, col);
  }

  async function loadRawSeedsAndInitTSNE() {
  if (!X.length) await loadRawSeeds();

  tsne = new tsnejs.tSNE({
    dim: 3,
    perplexity: 50,
    epsilon: 15
  });

  tsne.initDataRaw(X);
  stepCount = 0;
  updateStepUI();
  updatePointCloudFromY(tsne.getSolution());
}

  function stepTSNE(k = 1) {
    if (!tsne) return;
    for (let i = 0; i < k; i++) {
      tsne.step();
      stepCount++;
    }
    updateStepUI();
    updatePointCloudFromY(tsne.getSolution());
  }

  function restartTSNE() {
    if (!X.length) return;
    tsne = new tsnejs.tSNE({
      dim: 3,
      perplexity: 40,
      epsilon: 5
    });
    tsne.initDataRaw(X);
    stepCount = 0;
    updateStepUI();
    updatePointCloudFromY(tsne.getSolution());
  }

  function downloadCSV(filename, content) {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function saveBestEmbedding() {
    if (!tsne) {
      console.warn("t-SNE ist nicht initialisiert");
      return;
    }
    const Y = tsne.getSolution();
    let out = "x,y,z,label\n";
    for (let i = 0; i < Y.length; i++) {
      out += `${Y[i][0]},${Y[i][1]},${Y[i][2]},${labels[i]}\n`;
    }
    downloadCSV("seeds_best.csv", out);
  }

 async function init() {
  await loadRawSeeds();

  try {
    await loadBestData();
    console.log("Beste Lösung geladen");
    stepCount = 0;
    updateStepUI();

    tsne = null;
    return;
  } catch (e) {
  }
  await loadRawSeedsAndInitTSNE();
  stepTSNE(200);
}
  //CSV Code Ende

  //Kamera & Interaktion

  let cameraPos = [0, 0, 8.0];
  const cameraTarget = [0, 0, 0];
  const cameraUp = [0, 1, 0];

  const moveSpeed = 0.07;

  let rotXScene = 0.0;
  let rotYScene = 0.0;
  const rotSpeed = 0.03;

  const keys = {};

window.addEventListener("keydown", (e) => {
  keys[e.code] = true;

  if (e.repeat) return;

  if (e.code === "KeyR") restartTSNE();
  if (e.code === "KeyT" && !e.shiftKey) stepTSNE(1);
  if (e.code === "KeyT" && e.shiftKey)  stepTSNE(10);
  if (e.code === "KeyK") saveBestEmbedding();
  if (e.code === "KeyY") stepTSNE(10);
});

window.addEventListener("keyup", (e) => {
  keys[e.code] = false;
});

function wireUI() {
  const btnRestart = document.getElementById("btnRestart");
  const btnStep    = document.getElementById("btnStep");
  const btnStep10  = document.getElementById("btnStep10");
  const btnSave    = document.getElementById("btnSave");

  if (btnRestart) btnRestart.addEventListener("click", () => restartTSNE());
  if (btnStep)    btnStep.addEventListener("click", () => stepTSNE(1));
  if (btnStep10)  btnStep10.addEventListener("click", () => stepTSNE(10));
  if (btnSave)    btnSave.addEventListener("click", () => saveBestEmbedding());
}

wireUI();


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
    resize();
    updateInput();

    gl.clearColor(0.1, 0.1, 0.1, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const proj = makePerspective(Math.PI / 3, aspect, 0.1, 100.0);
    const view = makeLookAt(cameraPos, cameraTarget, cameraUp);
    const model = multiply(rotY(rotYScene), rotX(rotXScene));
    const mvp = multiply(proj, multiply(view, model));

    gl.useProgram(program);

    gl.uniformMatrix4fv(loc.uMVP, false, mvp);
    gl.uniform1f(loc.uPointSize, 10.0);

    gl.bindBuffer(gl.ARRAY_BUFFER, vboPos);
    gl.enableVertexAttribArray(loc.aPos);
    gl.vertexAttribPointer(loc.aPos, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, vboCol);
    gl.enableVertexAttribArray(loc.aColor);
    gl.vertexAttribPointer(loc.aColor, 3, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.POINTS, 0, pointCount);

    requestAnimationFrame(draw);
  }

  init().catch(err => console.error("Init error:", err));
  draw();
})();