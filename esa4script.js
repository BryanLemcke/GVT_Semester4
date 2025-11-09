(function () {
  const canvas = document.getElementById('glcanvas4');
  const gl = canvas.getContext('webgl', { antialias: true });

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(canvas.clientWidth * dpr);
    const h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
    }
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  }
  window.addEventListener('resize', resize);

 const vsFill = `
    attribute vec3 aPos;
    attribute vec3 aColor;
    uniform float uScale;
    uniform mat4  uModel;
    varying vec3 vColor;
    void main(){
      vec3 p = (uModel * vec4(aPos,1.0)).xyz;
      gl_Position = vec4(uScale * p, 1.0);
      vColor = aColor;
    }
  `;
  const fsFill = `
    precision mediump float;
    varying vec3 vColor;
    void main(){ gl_FragColor = vec4(vColor, 1.0); }
  `;
  const vsLine = `
    attribute vec3 aPos;
    uniform float uScale;
    uniform mat4  uModel;
    void main(){
      vec3 p = (uModel * vec4(aPos,1.0)).xyz;
      gl_Position = vec4(uScale * p, 1.0);
    }
  `;
  const fsLine = `
    precision mediump float;
    uniform vec3 uLineColor;
    void main(){ gl_FragColor = vec4(uLineColor, 1.0); }
  `;

  function compile(type, src){
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src); gl.compileShader(sh);
    if(!gl.getShaderParameter(sh, gl.COMPILE_STATUS)){
      throw new Error('Shader-Fehler:\n' + gl.getShaderInfoLog(sh));
    }
    return sh;
  }
  function makeProgram(vsSrc, fsSrc){
    const vs = compile(gl.VERTEX_SHADER, vsSrc);
    const fs = compile(gl.FRAGMENT_SHADER, fsSrc);
    const p = gl.createProgram();
    gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
    if(!gl.getProgramParameter(p, gl.LINK_STATUS)){
      throw new Error('Link-Fehler:\n' + gl.getProgramInfoLog(p));
    }
    return p;
  }

  function rotX(a){ const c=Math.cos(a), s=Math.sin(a);
    return new Float32Array([1,0,0,0,  0,c,s,0,  0,-s,c,0,  0,0,0,1]);
  }
  function rotY(a){ const c=Math.cos(a), s=Math.sin(a);
    return new Float32Array([ c,0,-s,0,  0,1,0,0,  s,0,c,0,  0,0,0,1]);
  }
  function mul(a,b){ const o=new Float32Array(16);
    for(let i=0;i<4;i++)for(let j=0;j<4;j++){ let s=0; for(let k=0;k<4;k++) s+=a[i*4+k]*b[k*4+j]; o[i*4+j]=s; }
    return o;
  }

  const progFill = makeProgram(vsFill, fsFill);
  const locF = {
    aPos: gl.getAttribLocation(progFill, 'aPos'),
    aColor: gl.getAttribLocation(progFill, 'aColor'),
    uScale: gl.getUniformLocation(progFill, 'uScale'),
    uModel: gl.getUniformLocation(progFill, 'uModel'),
  };

  const progLine = makeProgram(vsLine, fsLine);
  const locL = {
    aPos: gl.getAttribLocation(progLine, 'aPos'),
    uScale: gl.getUniformLocation(progLine, 'uScale'),
    uModel: gl.getUniformLocation(progLine, 'uModel'),
    uLineColor: gl.getUniformLocation(progLine, 'uLineColor'),
  };


  // Rotation
  function rotX(a) {
    const c = Math.cos(a), s = Math.sin(a);
    return new Float32Array([
      1,0,0,0,
      0,c,s,0,
      0,-s,c,0,
      0,0,0,1
    ]);
  }
  function rotY(a) {
    const c = Math.cos(a), s = Math.sin(a);
    return new Float32Array([
       c,0,-s,0,
       0,1, 0,0,
       s,0, c,0,
       0,0, 0,1
    ]);
  }
  function mul(a,b) {
    const o = new Float32Array(16);
    for (let i=0;i<4;i++) for (let j=0;j<4;j++) {
      let s = 0;
      for (let k=0;k<4;k++) s += a[i*4+k]*b[k*4+j];
      o[i*4+j] = s;
    }
    return o;
  }

  // Parametrisierte Flächen
  const a_drop = 0.6, b_drop = 1.1; 
  const Drop = {
    name:'Tropfen',
    uRange:[0.0, Math.PI],
    vRange:[0.0, 2.0*Math.PI],
    grid:{nu:140, nv:80},
    scale:0.7,
    pos(u,v){
      const x = a_drop * (b_drop - Math.cos(u)) * Math.sin(u) * Math.cos(v);
      const y = a_drop * (b_drop - Math.cos(u)) * Math.sin(u) * Math.sin(v);
      const z = Math.cos(u);
      return [x,y,z];
    }
  };

  const a_h=1.8 , b_h=1.7, c_h=0.1;
  const Horn = {
    name:'Horn',
    uRange:[0.0, 1.0],
    vRange:[-Math.PI, Math.PI],
    grid:{nu:160, nv:64},
    scale:0.4,
    pos(u,v){
      const x = (a_h + u*Math.cos(v)) * Math.sin(b_h*Math.PI*u);
      const y = (a_h + u*Math.cos(v)) * Math.cos(b_h*Math.PI*u) + c_h*u;
      const z = u * Math.sin(v);
      return [x,y,z];
    }
  };
  const SakuraPetal = {
  name: 'Sakura-Blütenblatt',
  uRange: [0.0, 1.0],
  vRange: [-Math.PI/2, Math.PI/2],
  grid: { nu: 180, nv: 120 },
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

const Surfaces = [Drop, Horn, SakuraPetal];

  // Gitter + Linienindizes
   function buildGrid(S){
    const {nu,nv} = S.grid;
    const u0=S.uRange[0], u1=S.uRange[1];
    const v0=S.vRange[0], v1=S.vRange[1];

    const pos = new Float32Array(nu*nv*3);
    let zmin=+1e9, zmax=-1e9;

    for(let j=0;j<nv;j++){
      const v = v0 + (v1-v0)*(j/(nv-1));
      for(let i=0;i<nu;i++){
        const u = u0 + (u1-u0)*(i/(nu-1));
        const [x,y,z] = S.pos(u,v);
        const k=(j*nu+i)*3; pos[k]=x; pos[k+1]=y; pos[k+2]=z;
        if (z<zmin) zmin=z; if (z>zmax) zmax=z;
      }
    }

    const tri = [];
    for(let j=0;j<nv-1;j++){
      for(let i=0;i<nu-1;i++){
        const a = j*nu + i;
        const b = a + 1;
        const c = a + nu;
        const d = c + 1;
        tri.push(a,b,c,  b,d,c);
      }
    }
    const lines = [];
    for(let j=0;j<nv;j++) for(let i=0;i<nu-1;i++){ const a=j*nu+i, b=a+1; lines.push(a,b); }
    for(let i=0;i<nu;i++) for(let j=0;j<nv-1;j++){ const a=j*nu+i, b=a+nu; lines.push(a,b); }

const col = new Float32Array(nu*nv*3);

function lerp(a,b,t){ return a + (b-a)*t; }
function mixColor(c1,c2,t){
  return [ lerp(c1[0],c2[0],t),
           lerp(c1[1],c2[1],t),
           lerp(c1[2],c2[2],t) ];
}

for(let j=0;j<nv;j++){
  for(let i=0;i<nu;i++){
    const n = j*nu + i;
    const u = u0 + (u1-u0)*(i/(nu-1));
    const v = v0 + (v1-v0)*(j/(nv-1));
    const z = pos[n*3+2];

    let c = [1,1,1];

    // Tropfen
    if (S.name === 'Tropfen') {
      const span = Math.max(1e-6, zmax - zmin);
      const t = (z - zmin)/span;            
      const c1=[0.05,0.10,0.40];            // dunkelblau
      const c2=[0.70,0.90,1.00];            // hellblau
      c = mixColor(c1,c2,t);
    }

    // Horn
    else if (S.name === 'Horn') {
      const t = (v - v0)/(v1 - v0);         
      const c1=[0.90,0.75,0.35];             // hellgold
      const c2=[0.45,0.35,0.10];             // dunkelgold
      c = mixColor(c1,c2,t);
    }

    // Sakura-Blütenblatt
    else if (S.name.includes('Sakura')) {
      const t = u;                          
      const c1=[1.0,0.85,0.9];               // rosa
      const c2=[0.9,0.25,0.35];              // rosa-rot
      const c3=[1.0,0.95,0.95];              // weiß
      const mid = mixColor(c1,c2,t);
      const edge = mixColor(mid,c3,0.3*Math.abs(Math.sin(v*2.0)));
      c = edge;
    }

    col[n*3+0]=c[0];
    col[n*3+1]=c[1];
    col[n*3+2]=c[2];
  }
}
    return {
      pos,
      col,
      tri: new Uint16Array(tri),
      lines: new Uint16Array(lines),
      triCount: tri.length,
      lineCount: lines.length,
      nu, nv
    };
  }

  const vboPos = gl.createBuffer();
  const vboCol = gl.createBuffer();
  const eboTri = gl.createBuffer();
  const eboLine = gl.createBuffer();

  function upload(geo){
    gl.bindBuffer(gl.ARRAY_BUFFER, vboPos);
    gl.bufferData(gl.ARRAY_BUFFER, geo.pos, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, vboCol);
    gl.bufferData(gl.ARRAY_BUFFER, geo.col, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, eboTri);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geo.tri, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, eboLine);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geo.lines, gl.STATIC_DRAW);
  }

  // Status / Render
  let current = 0;
  let geo = buildGrid(Surfaces[current]);
  upload(geo);

  let angle=0, autorotate=true;
  let drawFill = true, drawLines = true; 
  const BASE = 0.7;

  function draw(){
    resize();
    gl.clearColor(0.05,0.07,0.10,1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);

    if(autorotate) angle += 0.01;
    const model = mul(rotY(angle), rotX(-0.9));
    const scale = BASE * (Surfaces[current].scale || 0.8);

    if (drawFill) {
      gl.useProgram(progFill);
      gl.uniform1f(locF.uScale, scale);
      gl.uniformMatrix4fv(locF.uModel, false, model);

      gl.bindBuffer(gl.ARRAY_BUFFER, vboPos);
      gl.enableVertexAttribArray(locF.aPos);
      gl.vertexAttribPointer(locF.aPos, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, vboCol);
      gl.enableVertexAttribArray(locF.aColor);
      gl.vertexAttribPointer(locF.aColor, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, eboTri);
      gl.drawElements(gl.TRIANGLES, geo.triCount, gl.UNSIGNED_SHORT, 0);
    }

    if (drawLines) {
      gl.useProgram(progLine);
      gl.uniform1f(locL.uScale, scale);
      gl.uniformMatrix4fv(locL.uModel, false, model);
      gl.uniform3f(locL.uLineColor, 0.90, 0.94, 0.99); 

      gl.bindBuffer(gl.ARRAY_BUFFER, vboPos);
      gl.enableVertexAttribArray(locL.aPos);
      gl.vertexAttribPointer(locL.aPos, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, eboLine);
      gl.lineWidth(1.0);
      gl.drawElements(gl.LINES, geo.lineCount, gl.UNSIGNED_SHORT, 0);
    }

    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);

  window.addEventListener('keydown', (e)=>{
    if(e.key==='b' || e.key==='B'){
      current = (current+1) % Surfaces.length;
      geo = buildGrid(Surfaces[current]);
      upload(geo);
      console.log('Fläche:', Surfaces[current].name);
    }
    if(e.key==='r' || e.key==='R'){ autorotate = !autorotate; }
    if(e.key==='l' || e.key==='L'){ drawLines = !drawLines; }
    if(e.key==='f' || e.key==='F'){ drawFill = !drawFill; }
    if(e.key==='m' || e.key==='M'){
      if (drawLines && drawFill) { drawFill = false; }
      else if (drawLines && !drawFill) { drawLines = false; drawFill = true; }
      else if (!drawLines && drawFill) { drawLines = true; drawFill = true; }
      else { drawLines = true; drawFill = true; }
    }
  });
})();