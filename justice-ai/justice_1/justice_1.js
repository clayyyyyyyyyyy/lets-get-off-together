let sceneShader;
let pg;

const vert = `
precision highp float;

attribute vec3 aPosition;
attribute vec2 aTexCoord;
varying vec2 vTexCoord;

void main() {
  vTexCoord = aTexCoord;
  vec4 positionVec4 = vec4(aPosition, 1.0);
  positionVec4.xy = positionVec4.xy * 2.0 - 1.0;
  gl_Position = positionVec4;
}
`;

const frag = `
precision highp float;

uniform vec2 iResolution;
uniform float iTime;

varying vec2 vTexCoord;

float t, tt, b, bb, g, a, la;
vec2 z, e = vec2(0.0008, -0.0008);
vec3 pp, op, cp, po, no, al, ld;
vec4 np;

mat2 r2(float r){
  float c = cos(r), s = sin(r);
  return mat2(c, s, -s, c);
}

float bo(vec3 p, vec3 r){
  p = abs(p) - r;
  return max(max(p.x, p.y), p.z);
}

vec2 fb(vec3 p, float i, float s){
  vec2 h;
  vec2 t = vec2(length(p.xz) - 2.0 - clamp(sin(p.y * 5.0), -0.2, 0.2) * 0.2, 5.0);

  t.x = abs(t.x) - 0.2;

  pp = p;
  pp.y += 1.0 - i * 2.0;

  a = max(abs(bo(pp, vec3(0.65, 2.0, 200.0))) - 0.2, abs(pp.y) - 1.0);
  t.x = min(t.x, mix(a, length(pp.xy - sin(p.z * 0.5)) - 0.5, b));

  pp.x = mix(abs(pp.x) - 0.7, pp.y * 0.5 - 0.8, b);
  pp.z = mod(pp.z, 3.0) - 1.5;
  pp -= mix(vec3(0.0, 1.0, 0.0), vec3(0.0, -1.3, 0.0) + sin(p.z * 0.5), b);

  t.x = min(t.x, bo(pp, vec3(0.1, 2.0, 0.1)));

  pp.y -= 2.0;
  la = length(pp) - 0.1;
  g += 0.08 / (0.12 + la * la * 42.0);
  t.x = min(t.x, la);

  t.x /= s;
  t.x = max(t.x, -(length(op.xy - vec2(-2.0 * b, 6.0 - i * 0.1)) - 5.0));
  t.x = max(t.x, (abs(op.y) - 5.0 + i));

  h = vec2(length(p.xz) - 1.0 + (pp.y * 0.1 / (i * 2.0 + 1.0)), 3.0);
  h.x /= s;
  h.x = max(h.x, -(length(op.xy - vec2(0.0, 6.1 + 3.0 * b - i * 0.1)) - 5.0));
  h.x = max(h.x, (abs(op.y) - 5.5 - 5.0 * b + i));
  t = t.x < h.x ? t : h;

  if(i < 2.0){
    h = vec2(abs(length(p.xz) - 1.2) - 0.1, 6.0);
    h.x /= s;
    h.x = max(h.x, -(length(op.xy - vec2(-1.0 * b, 6.2 - i * 0.1)) - 5.0));
    h.x = max(h.x, (abs(op.y) - 6.0 + i));
    t = t.x < h.x ? t : h;
  }

  return t;
}

vec2 mp(vec3 p){
  // continuous transformation instead of abrupt mode-switching
  p.yz *= r2(mix(-0.785, -0.6154, bb));
  p.xz *= r2(mix(0.0, 0.785, bb));

  op = p;

  // keep this continuous too
  b = clamp(cos(op.z * 0.1 + tt * 0.22), -0.25, 0.25) * 2.0 + 0.5;

  p.z = mod(p.z - tt, 10.0) - 5.0;

  vec2 h;
  vec2 t = vec2(1000.0);

  np = vec4(p, 1.0);

  // reduced from deeper complexity for speed
  for(int i = 0; i < 4; i++){
    np.xz = abs(np.xz) - 2.1 + sin(np.y * 0.5) * 0.5 * b;
    np.xz *= r2(-0.785);
    np *= 2.02;

    h = fb(np.xyz, float(i), np.w);
    h.x *= 0.78;
    t = t.x < h.x ? t : h;
  }

  h = vec2(p.y + 2.0 + 3.0 * cos(p.x * 0.35), 6.0);
  h.x = max(h.x, p.y);
  h.x *= 0.5;
  t = t.x < h.x ? t : h;

  cp = p;
  return t;
}

vec2 tr(vec3 ro, vec3 rd){
  vec2 h;
  vec2 t = vec2(-3.0);

  for(int i = 0; i < 88; i++){
    h = mp(ro + rd * t.x);
    if(h.x < 0.001 || t.x > 16.0) break;
    t.x += h.x * 0.92;
    t.y = h.y;
  }

  if(t.x > 16.0) t.y = 0.0;
  return t;
}

float AO(float d){
  return clamp(mp(po + no * d).x / d, 0.0, 1.0);
}

float SH(float d){
  return smoothstep(0.0, 1.0, mp(po + ld * d).x / d);
}

vec3 getNormal(vec3 p){
  return normalize(
    e.xyy * mp(p + e.xyy).x +
    e.yyx * mp(p + e.yyx).x +
    e.yxy * mp(p + e.yxy).x +
    e.xxx * mp(p + e.xxx).x
  );
}

void main(){
  vec2 uv = vTexCoord;
  uv.y = 1.0 - uv.y;
  vec2 p = (uv - 0.5) * 2.0;
  p.x *= iResolution.x / iResolution.y;

  g = 0.0;
  tt = iTime * 0.85 + 8.0;

  // smooth 0..1 oscillation instead of binary snapping
  bb = 0.5 + 0.5 * sin(tt * 0.12);

  vec3 ro = vec3(p * 7.2, -8.0);
  vec3 rd = normalize(vec3(0.0, 0.0, 1.0));

  vec3 fo = vec3(0.13, 0.10, 0.12) - length(p) * 0.10;
  vec3 co = fo;

  ld = normalize(vec3(-0.45, 0.55, -0.3));

  z = tr(ro, rd);
  t = z.x;

  if(z.y > 0.0){
    po = ro + rd * t;
    no = getNormal(po);

    al = mix(vec3(0.0, 0.1, 0.3), vec3(0.4, 0.3, 0.1), b);

    if(z.y < 5.0) {
      al = vec3(0.0);
    }

    if(z.y > 5.0){
      al = vec3(1.0);
      no -= 0.12 * ceil(abs(cos(cp * 5.2)) - 0.05);
      no = normalize(no);
    }

    float dif = max(0.0, dot(no, ld));
    float fr = pow(clamp(1.0 + dot(no, rd), 0.0, 1.0), 3.0);
    float sp = pow(max(dot(reflect(-ld, no), -rd), 0.0), 28.0);

    co = mix(
      sp + al * (AO(0.07) + 0.22) * (dif + SH(0.65)),
      fo,
      min(fr, 0.45)
    );

    co = mix(fo, co, exp(-0.0009 * t * t * t));
  }

  co = mix(co, co.xzy, length(p * 0.55));

  vec3 glow = g * 0.18 * mix(
    vec3(1.0, 0.55, 0.1),
    vec3(1.0),
    0.5 + 0.5 * sin(t * 3.0)
  );

  co += glow;

  // gentler contrast curve
  co = pow(max(co, 0.0), vec3(0.62));

  gl_FragColor = vec4(co, 1.0);
}
`;

function setup() {
  pixelDensity(1);

  createCanvas(windowWidth, windowHeight);
  noStroke();

  // render at reduced internal resolution for speed
  let scale = 1;
  pg = createGraphics(floor(windowWidth * scale), floor(windowHeight * scale), WEBGL);
  pg.pixelDensity(1);
  pg.noStroke();

  sceneShader = pg.createShader(vert, frag);
}

function draw() {
  pg.shader(sceneShader);
  sceneShader.setUniform("iResolution", [pg.width, pg.height]);
  sceneShader.setUniform("iTime", millis() * 0.001);

  pg.push();
  pg.clear();
  pg.rect(-pg.width / 2, -pg.height / 2, pg.width, pg.height);
  pg.pop();

  image(pg, 0, 0, width, height);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);

  let scale = 0.6;
  pg = createGraphics(floor(windowWidth * scale), floor(windowHeight * scale), WEBGL);
  pg.pixelDensity(2);
  pg.noStroke();

  sceneShader = pg.createShader(vert, frag);
}
