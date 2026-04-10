let sh;
let noiseTex;

const vert = `
precision highp float;

attribute vec3 aPosition;
attribute vec2 aTexCoord;

uniform mat4 uProjectionMatrix;
uniform mat4 uModelViewMatrix;

varying vec2 vTexCoord;

void main() {
  vTexCoord = aTexCoord;
  gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
}
`;

const frag = `
precision highp float;

uniform vec2 iResolution;
uniform float iTime;
uniform sampler2D iChannel0;

varying vec2 vTexCoord;

vec2 e = vec2(0.00035, -0.00035);
float t, tt, b, bb, g, gg, gr, gt;
vec3 np, pp, op, po, no, al, ld, rp;

float bo(vec3 p, vec3 r) {
  p = abs(p) - r;
  return max(max(p.x, p.y), p.z);
}

mat2 r2(float r) {
  float c = cos(r), s = sin(r);
  return mat2(c, s, -s, c);
}

const mat2 deg45 = mat2(0.7071, 0.7071, -0.7071, 0.7071);

vec4 texNoise(vec2 uv, sampler2D tex) {
  float f = 0.0;
  f += texture2D(tex, uv * 0.125).r * 0.5;
  f += texture2D(tex, uv * 0.25).r * 0.25;
  f += texture2D(tex, uv * 0.5).r * 0.125;
  f += texture2D(tex, uv * 1.0).r * 0.125;
  f = pow(f, 1.2);
  return vec4(f * 0.45 + 0.05);
}

vec2 mp(vec3 p, float ga) {
  op = p;
  p.z = mod(p.z - tt * 2.0, 30.0) - 15.0;
  pp = p;

  b = smoothstep(0.0, 1.0, sin(op.z * 0.05 + tt * 0.2 + 3.5) * 0.5 + 0.5);

  pp.xy = vec2(abs(abs(pp.x) - 8.2) - (1.0 + 4.0 * b), abs(pp.y));
  pp.z = mod(pp.z, 2.0) - 1.0;

  rp = pp;
  rp.y -= 4.0 * b + 1.0;
  rp.xy *= r2(b * 6.28);

  gr = 1.0;
  gt = 1.0;
  vec2 sca = vec2(0.5, 1.0);
  vec4 gp = vec4(p.xz * 0.5, rp.xy);

  for (int i = 0; i < 3; i++) {
    gp = abs(gp) - 1.5;
    gp.xy *= deg45;
    gp.zw *= deg45;
    gp *= 0.85;
    sca *= 0.85;
    gr = min(gr, clamp(sin(gp.x * 5.0), -0.25, 0.25) * 0.5 * sca.x);
    gt = min(gt, clamp(sin(gp.z * 5.0), -0.25, 0.25) * 0.5 * sca.y);
  }

  vec2 h;
  vec2 res = vec2(0.75 * bo(rp, vec3(1.0, 1.0, 1.0 - b * 0.2)), 3.0);

  np = rp;
  np.xz *= r2(b * 0.785);
  res.x = max(res.x, 0.7 * bo(np - gt * 0.7 * b, vec3(1.0, 1.0, 1.0 - b * 0.2)));

  vec3 sp = rp;
  sp.y -= 2.6 - sin(b * 3.14) * 7.25 + b * 3.0;
  res.x = min(res.x, 0.7 * max(length(rp.xz) - 0.1, abs(sp.y + 1.0 - sin(b * 3.14) * 2.1) - 1.0));

  float whiteCyl = 0.6 * max(
    abs(abs(length(rp.xz) - 0.5 - gt * 0.5) - 0.1) - 0.05,
    abs(rp.y) - 1.1 - b * 3.4
  );

  h = vec2(whiteCyl, 6.0);
  h.x = min(h.x, length(rp.xy) - 0.2);
  h.x = min(h.x, max(abs(length(abs(rp.yz)) - 0.2 * b) - 0.1, abs(rp.x) - 1.1));

  float spheres = 0.7 * (length(sp) - 0.1);
  h.x = min(h.x, spheres);
  g += 1.0 / (0.1 + spheres * spheres * 100.0) * ga;

  np = abs(p) - vec3(0.0, 7.0, 0.0);
  np.xy *= deg45;

  pp = p;
  pp.y = abs(pp.y) - 21.0;
  float ter = 0.8 * bo(pp, vec3(50.0, 10.0, 200.0) - gr * 2.0);
  ter = max(ter, -0.9 * bo(np, vec3(8.0, 8.0, 200.0) - gr * 2.0));

  float vertCyl = length(rp.xz) - 0.15;
  bb = max(0.0, (b - 0.9) * 10.0);
  vertCyl = max(vertCyl, abs(rp.y + 5.0 * bb) - 1.0);
  vertCyl = min(vertCyl, 0.7 * max(length(rp.yz), abs(rp.x - 1.0) - 2.2 * bb));
  gg += 1.0 / (0.1 + vertCyl * vertCyl * (200.0 - sin(bb + op.z * 0.2 + tt * 2.0) * 180.0)) * ga * bb;

  h.x = min(h.x, vertCyl);
  res = res.x < h.x ? res : h;

  h = vec2(ter, 7.0);
  res = res.x < h.x ? res : h;

  return res;
}

vec2 tr(vec3 ro, vec3 rd) {
  vec2 h;
  vec2 res = vec2(0.1, 0.0);

  for (int i = 0; i < 128; i++) {
    h = mp(ro + rd * res.x, 1.0);
    if (h.x < 0.0001 || res.x > 80.0) break;
    res.x += h.x;
    res.y = h.y;
  }

  if (res.x > 80.0) res.y = 0.0;
  return res;
}

float AO(float d) {
  return clamp(mp(po + no * d, 0.0).x, 0.0, 1.0);
}

float SH(float d) {
  return smoothstep(0.0, 1.0, mp(po + ld * d, 0.0).x);
}

void main() {
  vec2 uv = vTexCoord;
  uv.y = 1.0 - uv.y;

  vec2 fragCoord = uv * iResolution;
  vec2 p = (fragCoord / iResolution - 0.5) / vec2(iResolution.y / iResolution.x, 1.0);

  g = 0.0;
  gg = 0.0;

  tt = mod(iTime, 57.973) + 8.0;
  b = smoothstep(0.0, 1.0, sin(tt * 0.2) * 0.5 + 0.5);

  vec3 ro = mix(
    vec3(0.0, 15.0 - 15.0 * b, 20.0),
    vec3(
      -18.0 * sin(tt * 0.2),
      (10.0 - 20.0 * ceil(sin(tt * 0.2))) * sign(sin(tt * 0.1)),
      15.0
    ),
    ceil(cos(tt * 0.2))
  );

  vec3 cw = normalize(vec3(0.0) - ro);
  vec3 cu = normalize(cross(cw, vec3(0.0, 1.0, 0.0)));
  vec3 cv = normalize(cross(cu, cw));
  vec3 rd = mat3(cu, cv, cw) * normalize(vec3(p, 0.5));

  vec3 fo = vec3(0.1, 0.15, 0.2) - length(p) * 0.18 + texNoise(rd.xz, iChannel0).r * 0.2;
  vec3 co = fo;

  ld = normalize(vec3(-0.2, 0.3, -0.3));

  vec2 hit = tr(ro, rd);
  t = hit.x;

  if (hit.y > 0.0) {
    po = ro + rd * t;

    no = normalize(
      e.xyy * mp(po + e.xyy, 0.0).x +
      e.yyx * mp(po + e.yyx, 0.0).x +
      e.yxy * mp(po + e.yxy, 0.0).x +
      e.xxx * mp(po + e.xxx, 0.0).x
    );

    al = vec3(0.05);
    if (hit.y > 5.0) al = vec3(1.0);
    if (hit.y > 6.0) al = mix(vec3(1.5), vec3(0.05, 0.2, 0.5), sin(gr * 60.0) * 0.5 + 0.5);

    float dif = max(0.0, dot(no, ld));
    float fr = pow(1.0 + dot(no, rd), 4.0);
    float sp = pow(max(dot(reflect(-ld, no), -rd), 0.0), 40.0);

    co = mix(sp + al * (AO(0.1) + 0.2) * (dif + SH(2.0)), fo, min(fr, 0.5));
    co = mix(fo, co, exp(-0.00001 * t * t * t));
  }

  co += g * 0.2 * mix(vec3(0.7, 0.3, 0.0), vec3(1.0, 0.2, 0.1), 1.0 - b)
      + gg * 0.2 * vec3(0.05, 0.2, 0.5);

  co = mix(co, co.zyx, length(p) * 0.5);
  co = pow(max(co, 0.0), vec3(0.55));

  gl_FragColor = vec4(co, 1.0);
}
`;

function setup() {
  pixelDensity(1);
  createCanvas(windowWidth, windowHeight, WEBGL);
  noStroke();

  sh = createShader(vert, frag);

  noiseTex = createGraphics(256, 256);
  noiseTex.pixelDensity(1);
  noiseTex.noSmooth();
  noiseTex.loadPixels();

  for (let y = 0; y < noiseTex.height; y++) {
    for (let x = 0; x < noiseTex.width; x++) {
      const i = 4 * (x + y * noiseTex.width);
      const n = random(255);
      noiseTex.pixels[i + 0] = n;
      noiseTex.pixels[i + 1] = n;
      noiseTex.pixels[i + 2] = n;
      noiseTex.pixels[i + 3] = 255;
    }
  }

  noiseTex.updatePixels();
}

function draw() {
  background(0);
  shader(sh);

  sh.setUniform("iResolution", [width, height]);
  sh.setUniform("iTime", millis() * 0.001);
  sh.setUniform("iChannel0", noiseTex);

  plane(width, height);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
