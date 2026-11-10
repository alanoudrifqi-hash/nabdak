// GPU-rendered water: animated height field, refraction and iridescent caustics.
// CSS remains visible if WebGL is unavailable. No camera, tracking or network calls.
function mountWater(canvas, control, options = {}) {
  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    powerPreference: "low-power",
  });
  if (!gl) {
    if (control) control.hidden = true;
    return () => {};
  }
  const vertex = "attribute vec2 a; void main(){gl_Position=vec4(a,0.,1.);}";
  const fragment = `precision mediump float;
    uniform vec2 resolution; uniform float time; uniform sampler2D logo; uniform float logoOpacity;
    uniform vec3 brandDeep, brandInk, brandBlue, brandSilver, brandCyan;
    float height(vec2 p){
      float t=time*.25;
      return sin(p.x*3.2+p.y*2.1+t)*.42
        + sin(p.y*4.8-p.x*1.4-t*.8)*.24
        + sin(length(p-vec2(.6,-.3))*7.5-t*1.6)*.17
        + sin(p.x*7.+sin(p.y*4.+t)-t)*.09;
    }
    void main(){
      vec2 uv=gl_FragCoord.xy/resolution;
      vec2 p=(uv-.5)*vec2(resolution.x/resolution.y,1.)*2.;
      float h=height(p);
      vec2 slope=vec2(height(p+vec2(.012,0.))-height(p-vec2(.012,0.)),height(p+vec2(0.,.012))-height(p-vec2(0.,.012)))/.024;
      vec2 refract=p+slope*.13;
      float flow=sin(refract.x*1.7+refract.y*.8+h+time*.05)*.5+.5;
      vec3 dark=brandDeep, sage=brandBlue, gold=brandCyan, rust=brandInk;
      vec3 color=mix(dark,sage,smoothstep(.08,.85,flow));
      color=mix(color,gold,smoothstep(.1,1.2,refract.x-refract.y*.7)*.7);
      color=mix(color,rust,smoothstep(.5,1.7,refract.x-refract.y)*.8);
      vec3 normal=normalize(vec3(-slope*.42,1.));
      float light=max(dot(normal,normalize(vec3(-.6,.8,1.))),0.);
      float caustic=pow(.5+.5*sin(h*10.+p.x*2.),16.);
      color*=.64+.45*light;
      color+=brandSilver*caustic*.18;
      color+=brandCyan*pow(light,28.)*.18;
      color*=1.-.27*length(uv-.5);
      vec2 logoUV=vec2((p.x+slope.x*.025)/1.8+.5, (p.y+slope.y*.025)/.8+.5);
      if(logoUV.x>0.&&logoUV.x<1.&&logoUV.y>0.&&logoUV.y<1.)color=mix(color,vec3(.8,.94,1.),texture2D(logo,logoUV).a*logoOpacity);
      gl_FragColor=vec4(color,1.);
    }`;
  function shader(type, source) {
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      gl.deleteShader(s);
      throw new Error("Water shader unavailable");
    }
    return s;
  }
  let program, vs, fs;
  try {
    vs = shader(gl.VERTEX_SHADER, vertex);
    fs = shader(gl.FRAGMENT_SHADER, fragment);
    program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw new Error("Water program unavailable");
  } catch {
    if (control) control.hidden = true;
    return () => {};
  }
  gl.useProgram(program);
  const palette = getComputedStyle(document.documentElement);
  for (const [uniform, token] of [
    ["brandDeep", "deep"],
    ["brandInk", "ink"],
    ["brandBlue", "blue"],
    ["brandSilver", "silver"],
    ["brandCyan", "cyan"],
  ]) {
    const hex = palette
      .getPropertyValue("--brand-" + token)
      .trim()
      .replace("#", "");
    const rgb = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    gl.uniform3f(gl.getUniformLocation(program, uniform), ...rgb);
  }
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const a = gl.getAttribLocation(program, "a");
  gl.enableVertexAttribArray(a);
  gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
  const logoTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, logoTexture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array([0, 0, 0, 0]),
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  if (options.logoText)
    void document.fonts.ready.then(() => {
      if (destroyed) return;
      const mark = document.createElement("canvas");
      mark.width = 1024;
      mark.height = 512;
      const c = mark.getContext("2d");
      c.font = "500 230px Thmanyah";
      c.direction = "rtl";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillStyle = "#fff";
      c.fillText(options.logoText, 512, 256);
      gl.bindTexture(gl.TEXTURE_2D, logoTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mark);
      draw();
    });
  const logoOpacity = gl.getUniformLocation(program, "logoOpacity");
  const r = gl.getUniformLocation(program, "resolution"),
    t = gl.getUniformLocation(program, "time");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let paused = reduced.matches,
    visible = true,
    frame = 0,
    last = 0,
    elapsed = 0,
    destroyed = false;
  function draw() {
    gl.uniform1f(logoOpacity, options.logoOpacity || 0);
    gl.uniform2f(r, canvas.width, canvas.height);
    gl.uniform1f(t, elapsed);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  function resize() {
    const box = canvas.getBoundingClientRect();
    const scale = Math.min(devicePixelRatio || 1, 1.25, 1600 / Math.max(box.width, box.height));
    canvas.width = Math.max(1, Math.round(box.width * scale));
    canvas.height = Math.max(1, Math.round(box.height * scale));
    gl.viewport(0, 0, canvas.width, canvas.height);
    draw();
  }
  function tick(now) {
    frame = 0;
    if (destroyed || paused || !visible || document.hidden) return;
    if (!last) last = now;
    if (now - last >= 32) {
      elapsed += Math.min((now - last) / 1000, 0.1);
      last = now;
      draw();
    }
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
    if (control) {
      control.textContent = paused ? "تشغيل التمـوّج ↻" : "إيقاف التمـوّج Ⅱ";
      control.setAttribute("aria-pressed", String(paused));
    }
    if (!paused && visible && !document.hidden)
      frame = requestAnimationFrame(tick);
  }
  const click = () => {
    paused = !paused;
    sync();
  };
  const preference = () => {
    paused = reduced.matches;
    sync();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    sync();
  });
  io.observe(canvas);
  control?.addEventListener("click", click);
  reduced.addEventListener("change", preference);
  document.addEventListener("visibilitychange", sync);
  const lost = (e) => {
    e.preventDefault();
    destroyed = true;
    cancelAnimationFrame(frame);
    canvas.classList.remove("ready");
    if (control) control.hidden = true;
  };
  canvas.addEventListener("webglcontextlost", lost);
  resize();
  canvas.classList.add("ready");
  sync();
  return () => {
    destroyed = true;
    cancelAnimationFrame(frame);
    ro.disconnect();
    io.disconnect();
    control?.removeEventListener("click", click);
    reduced.removeEventListener("change", preference);
    document.removeEventListener("visibilitychange", sync);
    canvas.removeEventListener("webglcontextlost", lost);
    gl.deleteTexture(logoTexture);
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
  };
}

window.NaqlaTheme = Object.assign(window.NaqlaTheme || {}, {mountWater});
