let displayShader;

let lastPointerX = 0;
let lastPointerY = 0;
let pointerVX = 0;
let pointerVY = 0;

let flowMomentum = 0;
let pressureMemory = 0;
let stillness = 0;
let pointerDown = 0;
let burst = 0;

// stable interaction anchor
let interactionX = 0.5;
let interactionY = 0.5;

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

const displayFrag = `
precision highp float;

varying vec2 vTexCoord;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_pointer;
uniform vec2 u_velocity;
uniform float u_pointerDown;
uniform float u_burst;
uniform float u_momentum;
uniform float u_pressure;
uniform float u_stillness;

#define TAU 6.28318530718

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

mat2 rot(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

float softSign(float x) {
  return x / (1.0 + abs(x));
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 6; i++) {
    v += a * noise(p);
    p = rot(0.45) * p * 2.03 + vec2(0.18, -0.14);
    a *= 0.5;
  }
  return v;
}

vec2 sovereignFlow(vec2 p, float time) {
  vec2 q = p;
  vec2 acc = vec2(0.0);
  for (float i = 1.0; i <= 6.0; i += 1.0) {
    q += sin(q.yx * i + time * (0.15 + 0.03 * i)) / i;
    acc += vec2(
      sin(q.y * 1.65 + i + time * 0.22),
      cos(q.x * 1.48 - i - time * 0.19)
    ) / i;
  }
  return acc;
}

float sovereignBody(vec2 p, float time) {
  vec2 q1 = p;
  vec2 q2 = rot(0.78) * p * 1.35 + vec2(1.6, -0.75);
  vec2 q3 = rot(-0.62) * p * 2.05 + vec2(-1.05, 1.15);

  for (float i = 1.0; i <= 6.0; i += 1.0) {
    q1 += sin(q1.yx * i + time * (0.18 + 0.02 * i)) / i;
    q2 += sin(q2.yx * (i + 0.7) - time * (0.145 + 0.018 * i)) / i;
    q3 += sin(q3.yx * (i + 1.4) + time * (0.118 + 0.021 * i)) / i;
  }

  float t1 = 1.0 / (0.23 + length(q1));
  float t2 = 1.0 / (0.31 + length(q2));
  float t3 = 1.0 / (0.40 + length(q3));
  float veil = fbm(p * 2.7 + vec2(time * 0.04, -time * 0.05)) * 0.66;

  return t1 * 1.24 + t2 * 0.84 + t3 * 0.48 + veil * 0.34;
}

float field(vec2 p, float time) {
  vec2 f1 = sovereignFlow(p * 1.2, time);
  float b1 = sovereignBody(p + f1 * 0.05, time);
  return b1 + 0.11 * sin(length(p) * 8.0 - time * 0.7);
}

vec3 oilPalette(float phase) {
  vec3 c1 = vec3(0.96, 0.22, 0.04);
  vec3 c2 = vec3(1.00, 0.76, 0.05);
  vec3 c3 = vec3(0.20, 0.95, 0.25);
  vec3 c4 = vec3(0.03, 0.62, 1.00);
  vec3 c5 = vec3(0.28, 0.12, 0.98);
  vec3 c6 = vec3(1.00, 0.10, 0.74);

  vec3 col = vec3(0.0);
  col += c1 * pow(0.5 + 0.5 * cos(TAU * (phase + 0.00)), 10.0);
  col += c2 * pow(0.5 + 0.5 * cos(TAU * (phase + 0.13)), 10.0);
  col += c3 * pow(0.5 + 0.5 * cos(TAU * (phase + 0.29)), 10.0);
  col += c4 * pow(0.5 + 0.5 * cos(TAU * (phase + 0.47)), 10.0);
  col += c5 * pow(0.5 + 0.5 * cos(TAU * (phase + 0.66)), 10.0);
  col += c6 * pow(0.5 + 0.5 * cos(TAU * (phase + 0.83)), 10.0);
  return col;
}

vec3 holographicPalette(float phase, float tilt, float energy) {
  vec3 a = oilPalette(phase);
  vec3 b = oilPalette(phase + 0.17 + tilt * 0.15);
  vec3 c = oilPalette(phase - 0.11 - tilt * 0.08);

  float softEnergy = energy / (1.0 + energy * 1.35);

  vec3 col = a * 0.62 + b * 0.28 + c * 0.18;
  col += vec3(1.0, 0.85, 1.1) * pow(max(softEnergy, 0.0), 2.0) * 0.07;
  return col;
}

vec3 compressHighlights(vec3 c) {
  return c / (1.0 + c * 0.85);
}

vec2 topologicalFold(
  vec2 p,
  vec2 pointer,
  vec2 vel,
  float momentum,
  float pressure,
  float down,
  float still,
  float time
) {
  vec2 rel = p - pointer;
  float r = length(rel) + 0.00001;
  float a = atan(rel.y, rel.x);

  float speed = length(vel);
  vec2 dir = speed > 0.0001 ? normalize(vel) : vec2(1.0, 0.0);
  vec2 perp = vec2(-dir.y, dir.x);

  float along = dot(rel, dir);
  float across = dot(rel, perp);

  float near = exp(-r * 2.2);
  float mid  = exp(-r * 1.25);
  float far  = exp(-r * 0.55);

  float coreRadius = 0.125;
  float coreFade = smoothstep(coreRadius * 0.52, coreRadius * 1.9, r);

  float twist =
      near * (momentum * 1.25 + pressure * 0.52 + down * 0.12)
    + far  * still * 0.10 * sin(a * 2.0 + time * 0.55);

  float foldBand = exp(-abs(across) * 1.8) * exp(-abs(along) * 0.62);

  float signedTurn =
      softSign(across * 2.6)
      * foldBand
      * (momentum * 0.58 + pressure * 0.20);

  a += (twist + signedTurn) * coreFade;

  float pinch = mid * (pressure * 0.16 + down * 0.05);
  float throat = near * pressure * 0.07;

  float rFold = r;
  rFold *= (1.0 - pinch);
  rFold = mix(rFold, 0.11 + (rFold * rFold) / (rFold + 0.24), throat);
  rFold += along * foldBand * momentum * 0.022;

  vec2 polarFolded = pointer + vec2(cos(a), sin(a)) * rFold;

  vec2 safeRel = rel / (r + 0.12);
  vec2 coreFolded =
      pointer
    + rel * (1.0 - 0.12 * pressure - 0.05 * down)
    + dir * mid * momentum * 0.018
    - safeRel * pressure * 0.006;

  return mix(coreFolded, polarFolded, coreFade);
}

void main() {
  vec2 uv = vTexCoord;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= u_resolution.x / u_resolution.y;

  vec2 pointer = u_pointer * 2.0 - 1.0;
  pointer.x *= u_resolution.x / u_resolution.y;

  vec2 vel = vec2(u_velocity.x, -u_velocity.y);
  float speed = length(vel);
  vec2 dir = speed > 0.0001 ? normalize(vel) : vec2(1.0, 0.0);
  vec2 perp = vec2(-dir.y, dir.x);

  float time = u_time * 0.42;

  vec2 rel = p - pointer;
  float d = length(rel);
  float near = exp(-d * 2.2);
  float mid  = exp(-d * 1.2);
  float far  = exp(-d * 0.55);

  float along = dot(rel, dir);
  float across = dot(rel, perp);

  vec2 baseP = p + sovereignFlow(p * 1.55, time) * 0.08;
  vec2 foldedP = topologicalFold(
    baseP,
    pointer,
    vel,
    u_momentum,
    u_pressure,
    u_pointerDown,
    u_stillness,
    time
  );

  foldedP += dir * far * (0.008 + u_momentum * 0.018);

  float body = field(foldedP, time);

  float foldBand = exp(-abs(across) * 2.0) * exp(-abs(along) * 0.68);
  float foldPresence = max(near, foldBand * (0.42 + u_momentum * 0.32));

  float coreBodyFade = smoothstep(0.04, 0.16, d);
  body += mid * coreBodyFade * (u_pressure * 0.32 + u_pointerDown * 0.04);

  float shell  = smoothstep(0.90, 1.68, body);
  float shell2 = smoothstep(1.40, 2.28, body);
  float shell3 = smoothstep(2.04, 3.02, body);

  vec2 px = 1.0 / u_resolution;
  float bx1 = field(foldedP + vec2(px.x * 2.0, 0.0), time);
  float bx2 = field(foldedP - vec2(px.x * 2.0, 0.0), time);
  float by1 = field(foldedP + vec2(0.0, px.y * 2.0), time);
  float by2 = field(foldedP - vec2(0.0, px.y * 2.0), time);
  vec2 grad = vec2(bx1 - bx2, by1 - by2);
  float edge = length(grad);

  vec3 n = normalize(vec3(-grad.x * 1.55, -grad.y * 1.55, 1.0));
  float fres = pow(1.0 - max(dot(n, vec3(0.0, 0.0, 1.0)), 0.0), 2.8);

  float angular = atan(rel.y, rel.x);
  float centerPhaseFade = smoothstep(0.05, 0.17, d);

  float phaseTwist =
      centerPhaseFade
      * near
      * (u_momentum * 0.30 + u_pressure * 0.14)
      * sin(angular * 2.0 - along * 3.6 + time * 0.62);

  float phaseFlip =
      centerPhaseFade
      * foldBand
      * (u_momentum * 0.20 + u_pressure * 0.12)
      * sin(across * 9.0 + time * 0.35);

  float phaseThroat =
      near * u_pressure * 0.10 * cos(d * 9.5 - time * 0.40);

  float phaseBreath =
      far * u_stillness * 0.06 * sin(angular * 3.0 + time * 0.44);

  float foldStrain = length(foldedP - baseP);
  float directionalIridescence =
      dot(normalize(grad + 0.0001), dir) * 0.5 + 0.5;

  float phase =
      body * 1.24
    + fres * 0.25
    + sin(length(foldedP) * 6.2 - time * 0.40) * 0.06
    + phaseTwist
    + phaseFlip
    + phaseThroat
    + phaseBreath
    + foldStrain * 1.00
    + directionalIridescence * 0.18
    + u_burst * near * 0.15;

  float rawSpectralEnergy =
      foldPresence * (0.44 + u_momentum * 0.52 + u_pressure * 0.30)
    + fres * 0.24
    + edge * 0.045
    + u_burst * 0.10;

  float spectralEnergy = rawSpectralEnergy / (1.0 + rawSpectralEnergy * 0.9);

  float tilt =
      directionalIridescence * 2.0 - 1.0
    + softSign(along * 1.5) * foldBand * 0.6;

  float splitA = 0.06 + spectralEnergy * 0.10;
  float splitB = 0.045 + spectralEnergy * 0.08;
  float splitC = 0.025 + foldStrain * 0.06;

  vec3 col = holographicPalette(phase, tilt, spectralEnergy);
  col *= 0.16 + 0.70 * shell;
  col += holographicPalette(phase + splitA, tilt + 0.4, spectralEnergy) * shell2 * 0.26;
  col += holographicPalette(phase - splitB, tilt - 0.35, spectralEnergy) * shell3 * 0.15;
  col += holographicPalette(phase + splitC + fres * 0.08, -tilt, spectralEnergy) * edge * 0.055;

  col += vec3(1.0, 0.95, 1.08) * fres * (0.045 + foldPresence * 0.02);
  col += oilPalette(phase + 0.22 + tilt * 0.06) * foldPresence * 0.028;
  col += vec3(0.8, 0.95, 1.2) * pow(fres, 3.0) * 0.05;

  col = compressHighlights(col);

  vec3 bg = vec3(0.005, 0.007, 0.014);
  float presence = clamp(
    shell * 0.88 + shell2 * 0.38 + shell3 * 0.18 + edge * 0.10,
    0.0,
    1.0
  );

  vec3 finalCol = mix(bg, col, presence);

  float vignette = smoothstep(1.45, 0.26, length((uv - 0.5) * vec2(1.02, 1.02)));
  finalCol *= vignette;

  finalCol = pow(max(finalCol, 0.0), vec3(1.05));

  gl_FragColor = vec4(finalCol, 1.0);
}
`;

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  pixelDensity(min(2, window.devicePixelRatio || 1));
  noStroke();
  displayShader = createShader(vert, displayFrag);

  lastPointerX = mouseX;
  lastPointerY = mouseY;
  interactionX = mouseX / max(1, width);
  interactionY = mouseY / max(1, height);
}

function draw() {
  const now = millis() * 0.001;

  let targetVX = 0;
  let targetVY = 0;

  // only update interaction anchor and velocity while actively touching/pressing
  if (pointerDown > 0.5) {
    interactionX = mouseX / max(1, width);
    interactionY = mouseY / max(1, height);

    targetVX = (mouseX - lastPointerX) / max(1, deltaTime);
    targetVY = (mouseY - lastPointerY) / max(1, deltaTime);
  }

  pointerVX = lerp(pointerVX, targetVX * 60.0, pointerDown > 0.5 ? 0.082 : 0.16);
  pointerVY = lerp(pointerVY, targetVY * 60.0, pointerDown > 0.5 ? 0.082 : 0.16);

  // hard-kill residual drift
  if (abs(pointerVX) < 0.01) pointerVX = 0.0;
  if (abs(pointerVY) < 0.01) pointerVY = 0.0;

  const currentSpeed = dist(0, 0, pointerVX, pointerVY);

  flowMomentum = lerp(
    flowMomentum,
    pointerDown > 0.5 ? (currentSpeed * 0.0035 + 0.14) : 0.0,
    pointerDown > 0.5 ? 0.04 : 0.10
  );

  pressureMemory = lerp(
    pressureMemory,
    pointerDown > 0.5 ? min(1.0, 0.12 + pressureMemory * 1.012) : 0.0,
    pointerDown > 0.5 ? 0.045 : 0.10
  );

  const motionStillness = constrain(1.0 - currentSpeed * 0.02, 0.0, 1.0);
  stillness = lerp(
    stillness,
    pointerDown > 0.5 ? motionStillness : 0.0,
    pointerDown > 0.5 ? 0.08 : 0.10
  );

  burst = lerp(burst, 0.0, pointerDown > 0.5 ? 0.08 : 0.18);
  if (burst < 0.001) burst = 0.0;

  shader(displayShader);
  displayShader.setUniform('u_resolution', [width, height]);
  displayShader.setUniform('u_time', now);
  displayShader.setUniform('u_pointer', [interactionX, interactionY]);
  displayShader.setUniform('u_velocity', [pointerVX, pointerVY]);
  displayShader.setUniform('u_pointerDown', pointerDown);
  displayShader.setUniform('u_burst', burst);
  displayShader.setUniform('u_momentum', flowMomentum);
  displayShader.setUniform('u_pressure', pressureMemory);
  displayShader.setUniform('u_stillness', stillness);

  rect(-width / 2, -height / 2, width, height);

  lastPointerX = mouseX;
  lastPointerY = mouseY;
}

function mousePressed() {
  pointerDown = 1.0;
  interactionX = mouseX / max(1, width);
  interactionY = mouseY / max(1, height);
  lastPointerX = mouseX;
  lastPointerY = mouseY;
  burst = 0.28;
}

function mouseReleased() {
  pointerDown = 0.0;
  pointerVX = 0.0;
  pointerVY = 0.0;
}

function touchStarted() {
  pointerDown = 1.0;
  interactionX = mouseX / max(1, width);
  interactionY = mouseY / max(1, height);
  lastPointerX = mouseX;
  lastPointerY = mouseY;
  burst = 0.28;
  return false;
}

function touchEnded() {
  pointerDown = 0.0;
  pointerVX = 0.0;
  pointerVY = 0.0;
  return false;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
