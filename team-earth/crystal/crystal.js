// p5.js — Ammann–Beenker Quasicrystal (instant, robust, ultra-vibrant)
// • Immediate first frame via uTimeSeed (no touch needed)
// • Full-spectrum holography (fixed N=5, WebGL1-safe)
// • Unrolled tri-shell; no derivatives; full-canvas plane(width,height)

let sh;
let touchX=0.5, touchY=0.5, tx=0.5, ty=0.5;
const TIME_SEED = 200.0 + Math.random()*300.0; // evolved start each load

const VERT = `
precision mediump float;
attribute vec3 aPosition;
attribute vec2 aTexCoord;
uniform mat4 uProjectionMatrix, uModelViewMatrix;
varying vec2 vUv;
void main(){
  vUv = aTexCoord;
  gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition,1.0);
}
`;

const FRAG = `
#ifdef GL_ES
precision mediump float;   // mediump for wider iOS/Android safety
#endif

varying vec2 vUv;
uniform vec2  uResolution;
uniform float uTime;
uniform float uTimeSeed;
uniform vec2  uTouch;

uniform float uScale;
uniform float uGain;
uniform float uSharp;
uniform float uPhasonAmt;
uniform float uHueSpread;
uniform float uChrome;
uniform float uTimeScale;

#define PI 3.14159265359
#define TAU 6.28318530718

float sat(float x){ return clamp(x,0.0,1.0); }
vec2  rot(vec2 p, float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c)*p; }

vec3 hsv2rgb(vec3 h){
  vec3 p = abs(fract(vec3(h.x)+vec3(0.,2./3.,1./3.))*6. - 3.);
  vec3 rgb = clamp(p-1., 0., 1.);
  return mix(vec3(1.), rgb, h.y) * h.z;
}

// Saturation / vibrance helpers
vec3 satAdjust(vec3 c, float s){ float l=dot(c, vec3(0.299,0.587,0.114)); return mix(vec3(l), c, s); }
vec3 vibrance(vec3 c, float v){ float l=dot(c, vec3(0.2126,0.7152,0.0722)); float amt = 1.0 + v; return mix(vec3(l), c, amt); }

float h12(vec2 p){
  vec3 p3 = fract(vec3(p.xyx)*.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec2 p){
  vec2 i=floor(p), f=fract(p);
  vec2 u=f*f*(3.0-2.0*f);
  float a=h12(i+vec2(0,0));
  float b=h12(i+vec2(1,0));
  float c=h12(i+vec2(0,1));
  float d=h12(i+vec2(1,1));
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}

float doubleExpSigmoid(float x, float K){
  x = sat(x);
  float a = pow(2.0, K*(2.0*x-1.0));
  return a/(a+1.0);
}

// wavelength (nm) → sRGB (fast)
vec3 wavelengthToSRGB(float wl){
  wl = clamp(wl, 380.0, 700.0);
  float r = exp(-0.5*pow((wl-605.0)/35.0,2.0)) + 0.30*exp(-0.5*pow((wl-690.0)/20.0,2.0));
  float g = exp(-0.5*pow((wl-540.0)/30.0,2.0)) + 0.15*exp(-0.5*pow((wl-575.0)/18.0,2.0));
  float b = exp(-0.5*pow((wl-445.0)/25.0,2.0)) + 0.20*exp(-0.5*pow((wl-405.0)/15.0,2.0));
  vec3 rgb = vec3(r,g,b);
  float m = max(1e-4, max(rgb.r, max(rgb.g, rgb.b)));
  rgb /= m;
  rgb = pow(rgb, vec3(0.9));
  return rgb;
}

// Ammann–Beenker tri-shell (UNROLLED: WebGL1-safe)
void abTriShell(in vec2 x, float k0, float silver,
                float ph1, float ph2, float ph3,
                out float C, out float S, out vec2 gC)
{
  C=0.0; S=0.0; gC=vec2(0.0);

  // shell 1
  for (int i=0;i<8;i++){
    float th=float(i)*PI/4.0; vec2 kdir=vec2(cos(th), sin(th));
    float a = dot(kdir,x)*k0 + ph1;
    float c = cos(a), s = sin(a);
    C += c; S += s; gC += -s * kdir * k0;
  }
  // shell 2
  float k1 = k0*(1.0+sqrt(2.0));
  for (int i=0;i<8;i++){
    float th=float(i)*PI/4.0; vec2 kdir=vec2(cos(th), sin(th));
    float a = dot(kdir,x)*k1 + ph2;
    float c = cos(a), s = sin(a);
    C += c; S += s; gC += -s * kdir * k1;
  }
  // shell 3
  float k2 = k1*(1.0+sqrt(2.0));
  for (int i=0;i<8;i++){
    float th=float(i)*PI/4.0; vec2 kdir=vec2(cos(th), sin(th));
    float a = dot(kdir,x)*k2 + ph3;
    float c = cos(a), s = sin(a);
    C += c; S += s; gC += -s * kdir * k2;
  }

  C /= 24.0; S /= 24.0; gC /= 24.0;
}

void main(){
  vec2 R=uResolution;
  float asp=R.x/R.y;
  vec2 p=(vUv-0.5)*vec2(asp,1.0);

  // Immediate evolved state
  float t = uTimeSeed + uTime * uTimeScale;

  // scale + slow spin
  float Scl = uScale * (1.0 + 0.03*sin(0.17*t) + 0.025*sin(0.11*t+1.7));
  vec2 x = p * Scl * 560.0;
  x = rot(x, 0.04*t);

  // phason base (works even if touch never changes)
  vec2 d = uTouch - 0.5;
  float swirl = atan(d.y, d.x);
  float phBase = uPhasonAmt * (0.36*t + 1.7*length(d)*sin(swirl + 0.9*t));

  float silver = 1.0 + sqrt(2.0);
  float kMedian = 2.42;
  float k0 = kMedian * (1.0 + 0.16*sin(0.23*t) + 0.11*sin(0.41*t+2.1));

  float ph1 = phBase*0.85 + 0.33*sin(0.21*t);
  float ph2 = -phBase*1.15 + 0.29*cos(0.157*t+1.1);
  float ph3 = phBase*0.55 + 0.31*sin(0.173*t+2.6);

  // field + analytic gradient
  float Cre, Sim; vec2 gC;
  abTriShell(x, k0, silver, ph1, ph2, ph3, Cre, Sim, gC);

  // node shaping
  float A = sqrt(Cre*Cre + Sim*Sim);
  float shaped = pow(A, uSharp);
  float nodes = smoothstep(0.22, 0.88, uGain*shaped);

  // faux normal from gradient → chrome & Fresnel
  float G = length(gC);
  vec3 n = normalize(vec3(normalize(gC + vec2(1e-6)), 1.0/(1.0 + 2.0*sat(0.9*G))));
  float VoN = clamp(n.z, 0.0, 1.0);
  float Fres = pow(1.0-VoN, 3.0);

  // FULL-SPECTRUM HOLOGRAPHY (fixed N=5 — safest)
  float phi = atan(Sim, Cre);
  float thickness = 540.0
                  + 160.0*sin(0.55*t + 3.0*phi)
                  + 100.0*sin(0.37*t + 1.9)
                  + 240.0*sat(0.7*G);

  vec3 spectral = vec3(0.0);
  // five stratified samples (no dynamic breaks)
  float wl0 = mix(380.0,700.0, (0.5)/5.0);
  float wl1 = mix(380.0,700.0, (1.5)/5.0);
  float wl2 = mix(380.0,700.0, (2.5)/5.0);
  float wl3 = mix(380.0,700.0, (3.5)/5.0);
  float wl4 = mix(380.0,700.0, (4.5)/5.0);
  float w0 = 0.5 + 0.5*cos(TAU*thickness/wl0);
  float w1 = 0.5 + 0.5*cos(TAU*thickness/wl1);
  float w2 = 0.5 + 0.5*cos(TAU*thickness/wl2);
  float w3 = 0.5 + 0.5*cos(TAU*thickness/wl3);
  float w4 = 0.5 + 0.5*cos(TAU*thickness/wl4);
  float rim = (0.75 + 0.25*Fres);
  spectral = rim * ( w0*wavelengthToSRGB(wl0)
                   + w1*wavelengthToSRGB(wl1)
                   + w2*wavelengthToSRGB(wl2)
                   + w3*wavelengthToSRGB(wl3)
                   + w4*wavelengthToSRGB(wl4) ) / 5.0;

  spectral = satAdjust(spectral, 1.25);
  spectral = vibrance(spectral, 0.18);

  // Radial personas (no bands)
  float r = length(p);
  float layers = 9.0;
  float layerIdxF = r * layers * (0.9 + 0.1*sin(0.7*t));
  float layerNoise = vnoise(vec2(layerIdxF*1.3, 0.2*t));
  float layerSel = fract(layerIdxF + 0.35*layerNoise);
  float layerMask = smoothstep(0.15, 0.85, layerSel);

  // Base hue steering
  float hBase = fract(0.52 + uHueSpread*(0.17*phi/TAU)
                      + 0.06*sin(1.4*t) + 0.05*sin(2.2*t+0.7));
  float hLayer = 0.12*sin(2.0*layerIdxF + 0.8*t);
  float hue = fract(hBase + 0.5*hLayer*layerMask);

  // S/V with strong shaping
  float s0 = sat(0.16 + 1.85*G);
  float v0 = sat(0.10 + 0.98*nodes + 0.22*pow(sat(1.0-r),2.0));
  float s = doubleExpSigmoid(s0, 0.55);
  float v = doubleExpSigmoid(v0, 0.55);

  vec3 baseHSV = hsv2rgb(vec3(hue, s, v));

  // Chrome channel phasing
  float dH = 0.025 + 0.065*Fres;
  vec3 RgbR = hsv2rgb(vec3(fract(hue+dH), s, v));
  vec3 RgbG = hsv2rgb(vec3(hue,          s, v));
  vec3 RgbB = hsv2rgb(vec3(fract(hue-dH), s, v));
  vec3 chromed = vec3(RgbR.r, RgbG.g, RgbB.b);

  float spec = pow(VoN, 28.0) * 0.48 + Fres * 0.78;

  // Compose (vibrant, controlled)
  vec3 col = mix(baseHSV, spectral,           0.60);
  col = mix(col,     chromed,                 uChrome*(0.28 + 0.36*Fres));
  col += spec * (0.30 * normalize(spectral + 1e-3));

  // Final saturation & vibrance boost
  col = satAdjust(col, 1.30);
  col = vibrance(col, 0.18);

  // filmic-ish gamma
  col = pow(col, vec3(0.94));
  gl_FragColor = vec4(col, 1.0);
}
`;

function setup(){
  createCanvas(windowWidth, windowHeight, WEBGL);
  pixelDensity(Math.min(2.0, window.devicePixelRatio||1)); // fast first paint
  noStroke();
  sh = createShader(VERT, FRAG);
}

function draw(){
  // touch easing (works fine even if untouched)
  touchX += (tx - touchX) * 0.12;
  touchY += (ty - touchY) * 0.12;

  shader(sh);
  sh.setUniform('uResolution', [width, height]);
  sh.setUniform('uTime', millis()/1000);
  sh.setUniform('uTimeSeed', TIME_SEED);
  sh.setUniform('uTouch', [touchX, touchY]);

  // vibrant, fast defaults
  sh.setUniform('uScale', 0.05);
  sh.setUniform('uGain',  1.55);
  sh.setUniform('uSharp', 2.25);
  sh.setUniform('uPhasonAmt', 1.0);
  sh.setUniform('uHueSpread', 0.22);
  sh.setUniform('uChrome', 0.95);
  sh.setUniform('uTimeScale', 0.82);

  plane(width, height);
}

function mouseMoved(){ tx=constrain(mouseX/width,0,1); ty=constrain(mouseY/height,0,1); }
function touchMoved(){
  if(touches.length){ tx=constrain(touches[0].x/width,0,1); ty=constrain(touches[0].y/height,0,1); }
  return false;
}
function windowResized(){ resizeCanvas(windowWidth, windowHeight); }
