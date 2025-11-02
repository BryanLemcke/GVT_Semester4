{
  const GRID_W = 40;
const GRID_H = 40;
const FLIP_Y = false;

const canvas = document.getElementById('glcanvas3');
const gl = canvas && canvas.getContext('webgl', { antialias: true });

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const displayWidth  = Math.round(canvas.clientWidth  * dpr);
  const displayHeight = Math.round(canvas.clientHeight * dpr);
  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    canvas.width  = displayWidth;
    canvas.height = displayHeight;
  }
  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
}
window.addEventListener('resize', () => { resize(); draw(); });

const vsSource = `
  attribute vec2 aPos;
  attribute vec3 aColor;
  varying vec3 vColor;
  void main() {
    vColor = aColor;
    gl_Position = vec4(aPos, 0.0, 1.0);
  }
`;
const fsSource = `
  precision mediump float;
  varying vec3 vColor;
  void main() {
    gl_FragColor = vec4(vColor, 1.0);
  }
`;

function compile(type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error('Shader-Fehler:\\n' + info);
  }
  return sh;
}

const vs = compile(gl.VERTEX_SHADER, vsSource);
const fs = compile(gl.FRAGMENT_SHADER, fsSource);
const program = gl.createProgram();
gl.attachShader(program, vs);
gl.attachShader(program, fs);
gl.linkProgram(program);
gl.useProgram(program);

const aPos   = gl.getAttribLocation(program, 'aPos');
const aColor = gl.getAttribLocation(program, 'aColor');

function toNDC(xg, yg) {
  let y = yg;
  if (FLIP_Y) y = GRID_H - yg;
  const x = (2 * (xg / GRID_W)) - 1;
  const yn = (2 * (y  / GRID_H)) - 1;
  return [x, yn];
}
function colorIceBlue() {
  return [0.70, 0.95, 1.00];
}
function colorIceBlueDark() {
  return [0.10, 0.40, 0.85];
}
function colorDeepBlue() {
  return [0.02, 0.12, 0.35];
}
function colorGray() {
  return [0.38, 0.40, 0.45];
}
function lerp(a,b,t){ return a + (b-a)*t; }
function lerp3(c0,c1,t){ return [ lerp(c0[0],c1[0],t), lerp(c0[1],c1[1],t), lerp(c0[2],c1[2],t) ]; }

// Punkte A–Z und a–h
const Vertices = {
  A:[20,4],  B:[19,8],  C:[19,13], D:[18,17], E:[19,17], F:[18,20], G:[17,26], H:[17,20], I:[14,13], J:[12,19], K:[6,11],  L:[2,24],
  M:[9,32],  N:[12,28], O:[17,28], P:[19,25], Q:[17,31], R:[19,33], S:[19,31], T:[20,31], U:[22,33], Vv:[22,28], W:[22,26], X:[23,20],
  Y:[22,17], Z:[21,17], a:[22,20], b:[28,29], c:[31,32], d:[38,24], e:[34,11], f:[28,19], g:[26,13], h:[21,13]
};

// Dreiecke mit Farben
const TRI = [
  // Schwanz
  ['A','B','h', { colors: [ colorIceBlue, colorIceBlue, colorDeepBlue] }],
  ['B','C','h', { colors: [ colorIceBlue, colorDeepBlue, colorDeepBlue] }],
  ['C','D','E', { colors: [ colorDeepBlue, colorDeepBlue, colorDeepBlue] }],
  ['C','E','h', { colors: [ colorDeepBlue, colorDeepBlue,colorDeepBlue] }],
  ['h','E','Z', { colors: [ colorDeepBlue, colorDeepBlue, colorDeepBlue] }],
  ['h','Z','Y', { colors: [ colorDeepBlue, colorDeepBlue, colorDeepBlue] }],

  // linker Arm
  ['D','E','F', { colors: [ colorGray, colorGray, colorIceBlueDark] }],
  ['D','H','F', { colors: [ colorGray, colorIceBlueDark, colorIceBlueDark] }],
  ['H','G','F', { colors: [ colorIceBlueDark, colorIceBlueDark, colorIceBlueDark] }],

  // rechter Arm
  ['Y','Z','a', { colors: [ colorGray, colorGray, colorIceBlueDark] }],
  ['Y','a','X', { colors: [ colorGray, colorIceBlueDark, colorIceBlueDark] }],
  ['a','W','X', { colors: [ colorIceBlueDark, colorIceBlueDark, colorIceBlueDark] }],

  // Körper
  ['E','W','Z', { colors: [ colorDeepBlue, colorIceBlueDark, colorDeepBlue] }],
  ['z','W','a', { colors: [ colorDeepBlue, colorIceBlueDark, colorDeepBlue] }],
  ['E','F','G', { colors: [ colorDeepBlue, colorDeepBlue, colorIceBlueDark] }],
  ['E','G','W', { colors: [ colorDeepBlue, colorIceBlueDark, colorIceBlueDark] }],
  ['G','P','W', { colors: [ colorIceBlueDark, colorDeepBlue, colorDeepBlue] }],
  ['G','P','O', { colors: [ colorIceBlueDark, colorDeepBlue, colorDeepBlue] }],
  ['P','Vv','W', { colors:[ colorDeepBlue, colorDeepBlue, colorIceBlueDark] }],

  // Kopf
  ['P','O','Vv', { colors: [ colorIceBlue, colorIceBlueDark, colorIceBlue] }],
  ['O','Q','T', { colors: [ colorIceBlueDark, colorIceBlueDark, colorIceBlue] }],
  ['O','Vv','U', { colors: [ colorIceBlueDark, colorIceBlue, colorIceBlue] }],
  ['Q','R','S', { colors: [ colorIceBlueDark, colorIceBlue, colorIceBlue] }],

  // linker Flügel
  ['D','I','H', { colors: [ colorDeepBlue, colorIceBlue, colorDeepBlue] }],
  ['I','J','H', { colors: [ colorIceBlue, colorIceBlueDark, colorDeepBlue] }],
  ['H','J','G', { colors: [ colorDeepBlue, colorIceBlueDark, colorDeepBlue] }],
  ['J','N','G', { colors: [ colorIceBlueDark, colorIceBlueDark, colorDeepBlue] }],
  ['J','M','N', { colors: [ colorIceBlueDark, colorIceBlueDark, colorIceBlueDark] }],
  ['J','K','M', { colors: [ colorIceBlueDark, colorIceBlue, colorIceBlueDark] }],
  ['K','L','M', { colors: [ colorIceBlue, colorIceBlueDark, colorIceBlueDark] }],

  // rechter Flügel
  ['g','Y','X', { colors: [ colorIceBlue, colorDeepBlue, colorDeepBlue] }],
  ['X','W','f', { colors: [ colorDeepBlue, colorDeepBlue, colorIceBlueDark] }],
  ['g','X','f', { colors: [ colorIceBlue, colorDeepBlue, colorIceBlueDark] }],
  ['f','W','b', { colors: [ colorIceBlueDark, colorDeepBlue, colorIceBlueDark] }],
  ['f','b','c', { colors: [ colorIceBlueDark, colorIceBlueDark, colorIceBlueDark] }],
  ['f','c','e', { colors: [ colorIceBlueDark, colorIceBlueDark, colorIceBlue] }],
  ['e','c','d', { colors: [ colorIceBlue, colorIceBlueDark, colorIceBlueDark] }]
];


function posFromName(name){

  if (name === 'z') name = 'Z';
  const p = Vertices[name];
  return toNDC(p[0], p[1]);
}

function colFromEntry(entry, name){
  if (Array.isArray(entry)) return entry;   
  if (typeof entry === 'function') return entry()
  const p = Vertices[name];
  return colorFromY(p[1]);
}

const positionsArr = [];
const colorsArr = [];

for (const tri of TRI) {
  const [n0, n1, n2, opts] = tri;
  const names = [n0, n1, n2];
  const cols  = (opts && opts.colors) || [];

  for (let i = 0; i < 3; i++) {
    const nm = names[i];
    const [x, y] = posFromName(nm);
    positionsArr.push(x, y);

    const c = colFromEntry(cols[i], nm);
    colorsArr.push(c[0], c[1], c[2]);
  }
}

const positions = new Float32Array(positionsArr);
const colors    = new Float32Array(colorsArr);

const posBuffer   = gl.createBuffer();
const colorBuffer = gl.createBuffer();

function draw() {
  resize();
  gl.clearColor(0.07, 0.07, 0.07, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  // Positionen
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  // Farben
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(aColor);
  gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, 0, 0);

  // Zeichnen
  gl.disable(gl.CULL_FACE);
  gl.drawArrays(gl.TRIANGLES, 0, positions.length / 2);
}

draw();
}