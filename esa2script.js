{
const GRID_W = 40;  
const GRID_H = 40;
const FLIP_Y = false;

const paths = [
  {
    mode: 'LINE_LOOP',
    color: [0.6, 0.9, 1.0],
    points: [
      [20,4],[19,8],[19,13],[18,17],[19,17],[18,20],[17,26],[17,20],[18,17],[14,13],
      [12,19],[6,11],[2,24],[9,32],[12,29],[17,26],[17,28],[19,25],[17,28],[17,31],
      [19,33],[19,31],[20,31],[22,33],[22,28],[19,25],[22,28],[22,26],[23,20],[22,17],
      [21,17],[22,20],[22,26],[28,29],[31,32],[38,24],[34,11],[28,19],[26,13],[22,17], 
      [21,13]
    ]
  },
];

const canvas = document.getElementById('glcanvas2');
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
  void main() {
    gl_Position = vec4(aPos, 0.0, 1.0);
  }
`;

const fsSource = `
  precision mediump float;
  uniform vec3 uColor;
  void main() {
    gl_FragColor = vec4(uColor, 1.0);
  }
`;

function compileShader(type, source) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, source);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPLETE_STATUS) && !gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error('Shader-Compile-Fehler:\n' + info);
  }
  return sh;
}

const vs = compileShader(gl.VERTEX_SHADER, vsSource);
const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);

const program = gl.createProgram();
gl.attachShader(program, vs);
gl.attachShader(program, fs);
gl.linkProgram(program);
if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
  const info = gl.getProgramInfoLog(program);
  throw new Error('Program-Link-Fehler:\n' + info);
}
gl.useProgram(program);

const aPos = gl.getAttribLocation(program, 'aPos');
const uColor = gl.getUniformLocation(program, 'uColor');

const vbo = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
gl.enableVertexAttribArray(aPos);
gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

function toNDC(points) {
  const out = [];
  for (const p of points) {
    let [xg, yg] = p;
    if (FLIP_Y) yg = GRID_H - yg;
    const x = (2 * (xg / GRID_W)) - 1;
    const y = (2 * (yg / GRID_H)) - 1;
    out.push(x, y);
  }
  return new Float32Array(out);
}

function draw() {
  resize();
  gl.clearColor(0.07, 0.07, 0.07, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  for (const path of paths) {
    const { mode, color = [1,1,1], points } = path;
    if (!points || points.length < 2) continue;

    const data = toNDC(points);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.uniform3f(uColor, color[0], color[1], color[2]);

    const glMode = ({
      'LINES': gl.LINES,
      'LINE_STRIP': gl.LINE_STRIP,
      'LINE_LOOP': gl.LINE_LOOP
    })[(mode || 'LINE_LOOP').toUpperCase()] || gl.LINE_LOOP;

    const count = data.length / 2;
    gl.drawArrays(glMode, 0, count);
  }
}
draw();
}
