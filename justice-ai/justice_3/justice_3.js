let sh;

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

varying vec2 vTexCoord;

vec2 z, v, e = vec2(0.00035, -0.00035);
float t, tt, b, g = 0.0, gg = 0.0;
vec3 np, pp, po, no, al, ld, cp, op;

float bo(vec2 p, vec2 b) {
  p = abs(p) - b;
  return length(max(p, 0.0)) + min(max(p.x, p.y), 0.0);
}

float box(vec3 p, vec3 b) {
  p = abs(p) - b;
  return max(max(p.x, p.y), p.z);
}

mat2 r2(float r) {
  float c = cos(r), s = sin(r);
  return mat2(c, s, -s, c);
}

float ex(vec3 p, float sdf, float h) {
  vec2 w = vec2(sdf, abs(p.y) - h);
  return min(max(w.x, w.y), 0.0) + length(max(w, 0.0));
}

vec2 mp(vec3 p) {
  op = p;
  p.x = mod(p.x - tt * 0.7, 20.0) - 10.0;
  np = vec3(p.xz * 0.5, 1.0);
  pp = p - vec3(0.0, 3.0, 0.0);
  pp.xz = mod(pp.xz, 5.0) - 2.5;
  pp.yz *= r2(0.785);

  vec2 h = vec2(1000.0, 6.0);
  vec2 res = vec2(1000.0, 5.0);

  float cutBox = box(pp, vec3(2.0, 1.5, 2.5));

  for (int i = 0; i < 4; i++) {
    b = float(i);
    np.xy = abs(np.xy) - 2.0;
    np.xy *= r2(0.785 * (b + 1.0));
    np *= 1.8;
    np.y = abs(np.y) - 1.5;

    res.x = min(res.x, ex(p, max(bo(np.xy, vec2(5.0, 0.2)) / np.z * 2.0, -cutBox), 1.0 + b * 0.5));
    res.x = abs(res.x) - 0.02 * max(sin(p.y * 10.0), 0.1) - 0.04 * clamp(sin(np.x * 2.5), 0.1, 0.5);

    h.x = min(h.x, ex(p, bo(np.xy, vec2(5.0, 0.01)) / np.z * 2.0, 0.25 + b * 0.5 - 0.1 * cos(op.x * 1.3 + 1.5)));
    res.x = max(res.x, abs(p.y) - 0.3 - b * 0.5);
  }

  h.x = max(h.x, -cutBox + 0.1);
  g += 0.1 / (0.1 + h.x * h.x * (1.0 - sin(op.x * 1.3) * 0.9) * 1600.0);

  cp = vec3(np.xy, p.y * 2.0);
  h.x = min(h.x, box(cp + vec3(-5.0, 2.0, 0.0), vec3(1.7, 1.0, 5.0 + sin(p.x * 0.7))) / np.z * 2.0);

  float part = length(cos(cp.yz * 20.0));
  part = max(part, p.y - 1.5);
  gg += 0.1 / (0.1 + part * part * 12.0);

  res.x = min(res.x, part);
  res = res.x < h.x ? res : h;
  return res;
}

vec2 tr(vec3 ro, vec3 rd) {
  vec2 h;
  vec2 res = vec2(0.1, 0.0);

  for (int i = 0; i < 128; i++) {
    h = mp(ro + rd * res.x);
    if (h.x < 0.0001 || res.x > 20.0) break;
    res.x += h.x;
    res.y = h.y;
  }

  if (res.x > 20.0) res.y = 0.0;
  return res;
}

float a(float d) {
  return clamp(mp(po + no * d).x / d, 0.0, 1.0);
}

float s(float d) {
  return smoothstep(0.0, 1.0, mp(po + ld * d).x / d);
}

void main() {
  vec2 uv = vTexCoord;
  uv.y = 1.0 - uv.y;
  vec2 fragCoord = uv * iResolution;
  vec2 p = (fragCoord.xy / iResolution.xy - 0.5) / vec2(iResolution.y / iResolution.x, 1.0);

  g = 0.0;
  gg = 0.0;

  tt = mod(iTime, 62.82);

  vec3 ro = vec3(
    10.0,
    2.9 - sin(tt * 0.2) * 0.8,
    -4.0 + ceil(cos(tt * 0.2)) * 8.0 + cos(tt * 0.4) * 2.0
  );

  vec3 cw = normalize(vec3(0.0, -6.0, 0.0) - ro);
  vec3 cu = normalize(cross(cw, vec3(0.0, 1.0, 0.0)));
  vec3 cv = normalize(cross(cu, cw));
  vec3 rd = mat3(cu, cv, cw) * normalize(vec3(p, 0.5));

  vec3 fo = vec3(0.18, 0.16, 0.2) - length(p) * 0.25;
  vec3 co = fo;

  ld = normalize(vec3(0.2, 0.4, -0.3));

  z = tr(ro, rd);
  t = z.x;

  if (z.y > 0.0) {
    po = ro + rd * t;

    no = normalize(
      e.xyy * mp(po + e.xyy).x +
      e.yyx * mp(po + e.yyx).x +
      e.yxy * mp(po + e.yxy).x +
      e.xxx * mp(po + e.xxx).x
    );

    no -= 0.3 * ceil(abs(sin(cp * 10.0)) - 0.1);
    no = normalize(no);

    al = mix(vec3(0.4), vec3(0.0, 0.15, 0.75), cp.y * 0.5);
    if (z.y > 5.0) al = vec3(1.2);

    float dif = max(0.0, dot(no, ld));
    float fr = pow(1.0 + dot(no, rd), 4.0);
    float sp = pow(max(dot(reflect(-ld, no), -rd), 0.0), 40.0);

    co = mix(sp + al * (a(0.12) + 0.2) * (dif + s(2.0)), fo, min(fr, 0.4));
    co = mix(fo, co, exp(-0.0007 * t * t * t));
  }

  co += g * 0.1 * vec3(0.1, 0.2, 0.7) + gg * 0.05 * vec3(0.4, 0.1, 0.1);
  co = pow(max(co, 0.0), vec3(0.65));

  gl_FragColor = vec4(co, 1.0);
}
`;

function setup() {
  pixelDensity(1);
  createCanvas(windowWidth, windowHeight, WEBGL);
  noStroke();
  sh = createShader(vert, frag);
}

function draw() {
  background(0);
  shader(sh);
  sh.setUniform("iResolution", [width, height]);
  sh.setUniform("iTime", millis() * 0.001);
  plane(width, height);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
