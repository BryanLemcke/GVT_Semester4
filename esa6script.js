// === Gesamte Szene in EINER Datei: Torus + Plane + 4 Kugeln ===
// Voraussetzung im HTML:
//  - <canvas id="glcanvas6"></canvas>
//  - <script id="vertexshader" type="x-shader/x-vertex">...</script>
//  - <script id="fragmentshader" type="x-shader/x-fragment">...</script>
//  - glMatrix (mat4) eingebunden

var app = (function() {

    var gl;
    var canvas;

    // The shader program object is also used to
    // store attribute and uniform locations.
    var prog;

    // Array of model objects.
    var models = [];

    // Model that is target for user input.
    var interactiveModel;

    var camera = {
        // Initial position of the camera.
        eye : [0, 1, 4],
        // Point to look at.
        center : [0, 0, 0],
        // Roll and pitch of the camera.
        up : [0, 1, 0],
        // Opening angle given in radian.
        // radian = degree*2*PI/360.
        fovy : 60.0 * Math.PI / 180,
        // Camera near plane dimensions:
        // value for left right top bottom in projection.
        lrtb : 2.0,
        // View matrix.
        vMatrix : mat4.create(),
        // Projection matrix.
        pMatrix : mat4.create(),
        // Projection types: ortho, perspective, frustum.
        projectionType : "perspective",
        // Angle to Z-Axis for camera when orbiting the center
        // given in radian.
        zAngle : 0,
        // Distance in XZ-Plane from center when orbiting.
        distance : 4
    };

    var animate = false;       
    var lastTime = 0;
    var animAngle = 0;   



    function start() {
    init();
    lastTime = performance.now();
    requestAnimationFrame(animationLoop);
    }


    function init() {
        initWebGL();
        initShaderProgram();
        initUniforms();
        initModels();
        initEventHandler();
        initPipline();
    }

  function resize() {
    if (!canvas || !gl) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(canvas.clientWidth * dpr);
    const h = Math.round(canvas.clientHeight * dpr);

    if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewportWidth = w;
        gl.viewportHeight = h;
    }

    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    camera.aspect = gl.viewportWidth / gl.viewportHeight;
}


    function initWebGL() {
    canvas = document.getElementById('glcanvas6');
    gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

    if (!gl) {
        alert("WebGL wird nicht unterstützt.");
        return;
    }

    resize();

    window.addEventListener('resize', resize);
}


    /**
     * Init pipeline parameters that will not change again. 
     * If projection or viewport change, their setup must
     * be in render function.
     */
    function initPipline() {
        gl.clearColor(.95, .95, .95, 1);

        // Backface culling.
        gl.frontFace(gl.CCW);
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);

        // Depth(Z)-Buffer.
        gl.enable(gl.DEPTH_TEST);

        // Polygon offset of rastered Fragments.
        gl.enable(gl.POLYGON_OFFSET_FILL);
        gl.polygonOffset(0.5, 0);

        // Set viewport.
        gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);

        // Init camera.
        // Set projection aspect ratio.
        camera.aspect = gl.viewportWidth / gl.viewportHeight;
    }

    function initShaderProgram() {
        // Init vertex shader.
        var vs = initShader(gl.VERTEX_SHADER, "vertexshader");
        // Init fragment shader.
        var fs = initShader(gl.FRAGMENT_SHADER, "fragmentshader");
        // Link shader into a shader program.
        prog = gl.createProgram();
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.bindAttribLocation(prog, 0, "aPosition");
        gl.linkProgram(prog);

        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            console.log("Could not link shader program:", gl.getProgramInfoLog(prog));
        }

        gl.useProgram(prog);
    }

    /**
     * Create and init shader from source.
     * 
     * @parameter shaderType: openGL shader type.
     * @parameter SourceTagId: Id of HTML Tag with shader source.
     * @returns shader object.
     */
    function initShader(shaderType, SourceTagId) {
        var shader = gl.createShader(shaderType);
        var shaderSource = document.getElementById(SourceTagId).text;
        gl.shaderSource(shader, shaderSource);
        gl.compileShader(shader);
        if(!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.log(SourceTagId + ": " + gl.getShaderInfoLog(shader));
            return null;
        }
        return shader;
    }

    function initUniforms() {
        // Projection Matrix.
        prog.pMatrixUniform = gl.getUniformLocation(prog, "uPMatrix");

        // Model-View-Matrix.
        prog.mvMatrixUniform = gl.getUniformLocation(prog, "uMVMatrix");
    }


     function initModels() {
        // fillstyle
        var fs = "fillwireframe";
        createModel("torus", fs, [0, 0.8, 0], [0, 0, 0], [1.3, 1.3, 1.3], {});
        createModel("plane", "wireframe",  [0, 0, 0], [0, 0, 0], [1, 1, 1], {});

        var sphereScale = [0.12, 0.12, 0.12];
        var yCenter = 0.8;    

        createModel("sphere", fs, [0, yCenter, 0], [0, 0, 0], sphereScale, {orbitOffset: 0.0});
        createModel("sphere", fs, [0, yCenter, 0], [0, 0, 0], sphereScale, {orbitOffset: Math.PI / 2});
        createModel("sphere", fs, [0, yCenter, 0], [0, 0, 0], sphereScale, {orbitOffset: Math.PI});
        createModel("sphere", fs, [0, yCenter, 0], [0, 0, 0], sphereScale, {orbitOffset: 3*Math.PI / 2});
    
        // Select one model that can be manipulated interactively by user.
        interactiveModel = models[0];
    }


    /**
     * Create model object, fill it and push it in models array.
     * 
     * @parameter geometryname: string with name of geometry.
     * @parameter fillstyle: wireframe, fill, fillwireframe.
     */
    function createModel(geometryname, fillstyle, translate, rotate, scale, options) {
        var model = {};
        model.fillstyle = fillstyle;
        model.geometry = geometryname;
        model.options = options || {};
        model.orbitOffset = model.options.orbitOffset || 0;
        initDataAndBuffers(model, geometryname);
        initTransformations(model, translate, rotate, scale);

        models.push(model);
    }

    /**
     * Set scale, rotation and transformation for model.
     */
    function initTransformations(model, translate, rotate, scale) {
        // Store transformation vectors.
        model.translate = translate;
        model.rotate = rotate;
        model.scale = scale;

        // Create and initialize Model-Matrix.
        model.mMatrix = mat4.create();

        // Create and initialize Model-View-Matrix.
        model.mvMatrix = mat4.create();
    }

    /**
     * Init data and buffers for model object.
     * 
     * @parameter model: a model object to augment with data.
     * @parameter geometryname: string with name of geometry.
     */
    function initDataAndBuffers(model, geometryname) {
        // Provide model object with vertex data arrays.
        // Fill data arrays for Vertex-Positions, Normals, Index data:
        // vertices, normals, indicesLines, indicesTris;
        // Pointer this refers to the window.
        this[geometryname]['createVertexData'].apply(model);

        // Setup position vertex buffer object.
        model.vboPos = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, model.vboPos);
        gl.bufferData(gl.ARRAY_BUFFER, model.vertices, gl.STATIC_DRAW);
        // Bind vertex buffer to attribute variable.
        prog.positionAttrib = gl.getAttribLocation(prog, 'aPosition');
        gl.enableVertexAttribArray(prog.positionAttrib);

        // Setup normal vertex buffer object.
        model.vboNormal = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, model.vboNormal);
        gl.bufferData(gl.ARRAY_BUFFER, model.normals, gl.STATIC_DRAW);
        // Bind buffer to attribute variable.
        prog.normalAttrib = gl.getAttribLocation(prog, 'aNormal');
        gl.enableVertexAttribArray(prog.normalAttrib);

        // Setup lines index buffer object.
        model.iboLines = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.iboLines);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, model.indicesLines, 
            gl.STATIC_DRAW);
        model.iboLines.numberOfElements = model.indicesLines.length;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

        // Setup triangle index buffer object.
        model.iboTris = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.iboTris);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, model.indicesTris, 
            gl.STATIC_DRAW);
        model.iboTris.numberOfElements = model.indicesTris.length;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    }

    function initEventHandler() {
        // Rotation step.
        var deltaRotate = Math.PI / 36;
        var deltaTranslate = 0.05;

        window.onkeydown = function(evt) {
            var key = evt.which ? evt.which : evt.keyCode;
            var c = String.fromCharCode(key);
            // Use shift key to change sign.
            var sign = evt.shiftKey ? -1 : 1;

            // Change projection of scene.
            switch(c) {
                case('O'):
                    camera.projectionType = "ortho";
                    camera.lrtb = 2;
                    break;
                case('F'):
                    camera.projectionType = "frustum";
                    camera.lrtb = 1.2;
                    break;
                case('P'):
                    camera.projectionType = "perspective";
                    break;
            }
            // Camera move and orbit.
            switch(c) {
                case('C'):
                    // Orbit camera.
                    camera.zAngle += sign * deltaRotate;
                    break;
                case('H'):
                    // Move camera up and down.
                    camera.eye[1] += sign * deltaTranslate;
                    break;
                case('D'):
                    // Camera distance to center.
                    camera.distance += sign * deltaTranslate;
                    break;
                case('V'):
                    // Camera fovy in radian.
                    camera.fovy += sign * 5 * Math.PI / 180;
                    break;
                case('B'):
                    // Camera near plane dimensions.
                    camera.lrtb += sign * 0.1;
                    break;
                case('K'):
                    // Animation ein-/ausschalten
                    animate = !animate;
                    break;
            }
            // Render the scene again on any key pressed.
            render();
        };
    }

    /**
     * Run the rendering pipeline.
     */
    function render() {
        // Clear framebuffer and depth-/z-buffer.
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        setProjection();
        calculateCameraOrbit();

        // Set view matrix depending on camera.
        mat4.lookAt(camera.vMatrix, camera.eye, camera.center, camera.up);

        // Loop over models.
        for(var i = 0; i < models.length; i++) {
            // Update modelview for model.
            updateTransformations(models[i]);

            // Set uniforms for model.
            gl.uniformMatrix4fv(prog.mvMatrixUniform, false, 
                models[i].mvMatrix);
            
            draw(models[i]);
        }
    }

 function animationLoop(time) {
    var t = time || 0;
    var dt = (t - lastTime) / 1000.0;  
    if (dt < 0) dt = 0;
    if (dt > 0.05) dt = 0.05; 
    lastTime = t;

    if (animate) {
        var speed = 1.5;
        animAngle += speed * dt;
    }

    render();
    requestAnimationFrame(animationLoop);
}

    function calculateCameraOrbit() {
        // Calculate x,z position/eye of camera orbiting the center.
        var x = 0, z = 2;
        camera.eye[x] = camera.center[x];
        camera.eye[z] = camera.center[z];
        camera.eye[x] += camera.distance * Math.sin(camera.zAngle);
        camera.eye[z] += camera.distance * Math.cos(camera.zAngle);
    }

    function setProjection() {
        // Set projection Matrix.
        switch(camera.projectionType) {
            case("ortho"):
                var v = camera.lrtb;
                mat4.ortho(camera.pMatrix, -v, v, -v, v, -10, 10);
                break;
            case("frustum"):
                var vf = camera.lrtb;
                mat4.frustum(camera.pMatrix, -vf/2, vf/2, -vf/2, vf/2, 1, 10);
                break;
            case("perspective"):
                mat4.perspective(camera.pMatrix, camera.fovy, 
                    camera.aspect, 1, 10);
                break;
        }
        // Set projection uniform.
        gl.uniformMatrix4fv(prog.pMatrixUniform, false, camera.pMatrix);
    }


    /**
     * Update model-view matrix for model.
     * (Translation + Skalierung, Rotation wäre optional noch möglich)
     */
   function updateTransformations(model) {
    var mMatrix = model.mMatrix;
    var mvMatrix = model.mvMatrix;

    mat4.identity(mMatrix);

    if (model.geometry === "plane") {

        mat4.translate(mMatrix, mMatrix, model.translate);
        mat4.scale(mMatrix, mMatrix, model.scale);

    } else if (model.geometry === "torus" || model.geometry === "sphere") {

        var groupMatrix = mat4.create();
        mat4.identity(groupMatrix);

        mat4.rotateY(groupMatrix, groupMatrix, animAngle);
        mat4.rotateX(groupMatrix, groupMatrix, animAngle * 0.6);

        mat4.translate(groupMatrix, groupMatrix, [0, 0.8, 0]);

        var local = mat4.create();
        mat4.identity(local);

        if (model.geometry === "torus") {
            mat4.scale(local, local, model.scale); 

        } else if (model.geometry === "sphere") {

            var phi = animAngle + model.orbitOffset;
            var Rpath = 1; 

            z = Rpath * Math.cos(phi)
            x = Rpath + Rpath * Math.sin(phi)
            var y = 0.0;    

            mat4.translate(local, local, [x, y, z]);
            mat4.scale(local, local, model.scale);
        }

        mat4.multiply(mMatrix, groupMatrix, local);

    } else {
        mat4.translate(mMatrix, mMatrix, model.translate);
        mat4.rotateX(mMatrix, mMatrix, model.rotate[0]);
        mat4.rotateY(mMatrix, mMatrix, model.rotate[1]);
        mat4.rotateZ(mMatrix, mMatrix, model.rotate[2]);
        mat4.scale(mMatrix, mMatrix, model.scale);
    }

    mat4.multiply(mvMatrix, camera.vMatrix, mMatrix);
}


    function draw(model) {
        // Setup position VBO.
        gl.bindBuffer(gl.ARRAY_BUFFER, model.vboPos);
        gl.vertexAttribPointer(prog.positionAttrib, 3, gl.FLOAT, false, 
            0, 0);

        // Setup normal VBO.
        gl.bindBuffer(gl.ARRAY_BUFFER, model.vboNormal);
        gl.vertexAttribPointer(prog.normalAttrib, 3, gl.FLOAT, false, 0, 0);

        // Setup rendering tris.
        var fill = (model.fillstyle.search(/fill/) != -1);
        if(fill) {
            gl.enableVertexAttribArray(prog.normalAttrib);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.iboTris);
            gl.drawElements(gl.TRIANGLES, model.iboTris.numberOfElements, 
                gl.UNSIGNED_SHORT, 0);
        }

        // Setup rendering lines.
        var wireframe = (model.fillstyle.search(/wireframe/) != -1);
        if(wireframe) {
            gl.disableVertexAttribArray(prog.normalAttrib);
            gl.vertexAttrib3f(prog.normalAttrib, 0, 0, 0);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.iboLines);
            gl.drawElements(gl.LINES, model.iboLines.numberOfElements, 
                gl.UNSIGNED_SHORT, 0);
        }
    }

    // App interface.
    return {
        start : start
    };

}());


// === Geometrie: Torus ===
var torus = (function() {

    function createVertexData() {
        var n = 16;
        var m = 32;

        // Positions.
        this.vertices = new Float32Array(3 * (n + 1) * (m + 1));
        var vertices = this.vertices;
        // Normals.
        this.normals = new Float32Array(3 * (n + 1) * (m + 1));
        var normals = this.normals;
        // Index data.
        this.indicesLines = new Uint16Array(2 * 2 * n * m);
        var indicesLines = this.indicesLines;
        this.indicesTris = new Uint16Array(3 * 2 * n * m);
        var indicesTris = this.indicesTris;

        var du = 2 * Math.PI / n;
        var dv = 2 * Math.PI / m;
        var r = 0.3;
        var R = 0.5;
        // Counter for entries in index array.
        var iLines = 0;
        var iTris = 0;

        // Loop angle u.
        for(var i = 0, u = 0; i <= n; i++, u += du) {
            // Loop angle v.
            for(var j = 0, v = 0; j <= m; j++, v += dv) {

                var iVertex = i * (m + 1) + j;

                var x = (R + r * Math.cos(u)) * Math.cos(v);
                var y = (R + r * Math.cos(u)) * Math.sin(v);
                var z = r * Math.sin(u);

                // Set vertex positions.
                vertices[iVertex * 3]     = x;
                vertices[iVertex * 3 + 1] = y;
                vertices[iVertex * 3 + 2] = z;

                // Calc and set normals.
                var nx = Math.cos(u) * Math.cos(v);
                var ny = Math.cos(u) * Math.sin(v);
                var nz = Math.sin(u);
                normals[iVertex * 3]     = nx;
                normals[iVertex * 3 + 1] = ny;
                normals[iVertex * 3 + 2] = nz;

                // Set index.
                // Line on beam.
                if(j > 0 && i > 0) {
                    indicesLines[iLines++] = iVertex - 1;
                    indicesLines[iLines++] = iVertex;
                }
                // Line on ring.
                if(j > 0 && i > 0) {
                    indicesLines[iLines++] = iVertex - (m + 1);
                    indicesLines[iLines++] = iVertex;
                }

                // Set index.
                // Two Triangles.
                if(j > 0 && i > 0) {
                    indicesTris[iTris++] = iVertex;
                    indicesTris[iTris++] = iVertex - 1;
                    indicesTris[iTris++] = iVertex - (m + 1);
                    //
                    indicesTris[iTris++] = iVertex - 1;
                    indicesTris[iTris++] = iVertex - (m + 1) - 1;
                    indicesTris[iTris++] = iVertex - (m + 1);
                }
            }
        }
    }

    return {
        createVertexData : createVertexData
    };

}());


// === Geometrie: Sphere ===
var sphere = (function() {

    function createVertexData() {
        var n = 32;
        var m = 32;

        // Positions.
        this.vertices = new Float32Array(3 * (n + 1) * (m + 1));
        var vertices = this.vertices;
        // Normals.
        this.normals = new Float32Array(3 * (n + 1) * (m + 1));
        var normals = this.normals;
        // Index data.
        this.indicesLines = new Uint16Array(2 * 2 * n * m);
        var indicesLines = this.indicesLines;
        this.indicesTris = new Uint16Array(3 * 2 * n * m);
        var indicesTris = this.indicesTris;

        var du = 2 * Math.PI / n;
        var dv = Math.PI / m;
        var r = 1;
        // Counter for entries in index array.
        var iLines = 0;
        var iTris = 0;

        // Loop angle u.
        for(var i = 0, u = 0; i <= n; i++, u += du) {
            // Loop angle v.
            for(var j = 0, v = 0; j <= m; j++, v += dv) {

                var iVertex = i * (m + 1) + j;

                var x = r * Math.sin(v) * Math.cos(u);
                var y = r * Math.sin(v) * Math.sin(u);
                var z = r * Math.cos(v);

                // Set vertex positions.
                vertices[iVertex * 3]     = x;
                vertices[iVertex * 3 + 1] = y;
                vertices[iVertex * 3 + 2] = z;

                // Calc and set normals.
                var vertexLength = Math.sqrt(x * x + y * y + z * z);
                normals[iVertex * 3]     = x / vertexLength;
                normals[iVertex * 3 + 1] = y / vertexLength;
                normals[iVertex * 3 + 2] = z / vertexLength;

                // Set index.
                // Line on beam.
                if(j > 0 && i > 0) {
                    indicesLines[iLines++] = iVertex - 1;
                    indicesLines[iLines++] = iVertex;
                }
                // Line on ring.
                if(j > 0 && i > 0) {
                    indicesLines[iLines++] = iVertex - (m + 1);
                    indicesLines[iLines++] = iVertex;
                }

                // Set index.
                // Two Triangles.
                if(j > 0 && i > 0) {
                    indicesTris[iTris++] = iVertex;
                    indicesTris[iTris++] = iVertex - 1;
                    indicesTris[iTris++] = iVertex - (m + 1);
                    //
                    indicesTris[iTris++] = iVertex - 1;
                    indicesTris[iTris++] = iVertex - (m + 1) - 1;
                    indicesTris[iTris++] = iVertex - (m + 1);
                }
            }
        }
    }

    return {
        createVertexData : createVertexData
    };

}());


// === Geometrie: Plane ===
var plane = (function() {

    function createVertexData() {
        var n = 100;
        var m = 100;

        // Positions.
        this.vertices = new Float32Array(3 * (n + 1) * (m + 1));
        var vertices = this.vertices;
        // Normals.
        this.normals = new Float32Array(3 * (n + 1) * (m + 1));
        var normals = this.normals;
        // Index data.
        this.indicesLines = new Uint16Array(2 * 2 * n * m);
        var indicesLines = this.indicesLines;
        this.indicesTris = new Uint16Array(3 * 2 * n * m);
        var indicesTris = this.indicesTris;

        var du = 20 / n;
        var dv = 20 / m;
        // Counter for entries in index array.
        var iLines = 0;
        var iTris = 0;

        // Loop u.
        for(var i = 0, u = -10; i <= n; i++, u += du) {
            // Loop v.
            for(var j = 0, v = -10; j <= m; j++, v += dv) {

                var iVertex = i * (m + 1) + j;

                var x = u;
                var y = 0;
                var z = v;

                // Set vertex positions.
                vertices[iVertex * 3]     = x;
                vertices[iVertex * 3 + 1] = y;
                vertices[iVertex * 3 + 2] = z;

                // Calc and set normals.
                normals[iVertex * 3]     = 0;
                normals[iVertex * 3 + 1] = 1;
                normals[iVertex * 3 + 2] = 0;

                // Set index.
                // Line on beam.
                if(j > 0 && i > 0) {
                    indicesLines[iLines++] = iVertex - 1;
                    indicesLines[iLines++] = iVertex;
                }
                // Line on ring.
                if(j > 0 && i > 0) {
                    indicesLines[iLines++] = iVertex - (m + 1);
                    indicesLines[iLines++] = iVertex;
                }

                // Set index.
                // Two Triangles.
                if(j > 0 && i > 0) {
                    indicesTris[iTris++] = iVertex;
                    indicesTris[iTris++] = iVertex - 1;
                    indicesTris[iTris++] = iVertex - (m + 1);
                    //
                    indicesTris[iTris++] = iVertex - 1;
                    indicesTris[iTris++] = iVertex - (m + 1) - 1;
                    indicesTris[iTris++] = iVertex - (m + 1);
                }
            }
        }
    }

    return {
        createVertexData : createVertexData
    };

}());

app.start();