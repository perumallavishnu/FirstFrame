/* gl_common.js: shared GLSL (uniforms, helpers). Scenes and main are in later files. */
(function () {
  'use strict';
  const FF = (window.FF = window.FF || {});
  const G = (FF.GLSL = FF.GLSL || {});

  G.head = `#version 300 es
precision highp float;
precision highp int;
out vec4 outColor;
#define PI 3.14159265359
#define MAXS 160

uniform int uScene;
uniform vec2 uRes;
uniform vec4 uWin;        // sensor window: centre x, centre y (mm), width, height (mm)
uniform float uF, uN, uFocus;   // focal length mm, f-number, focus distance mm
uniform int uBlades;
uniform float uPoly;      // 0 round .. 1 polygon
uniform float uCat;       // cat's-eye offset at the frame corner (aperture radii)
uniform float uDist;      // distortion k1
uniform float uBase;      // base sensor blur sigma, micrometres (diffraction + AA)
uniform vec2 uAb;         // lens aberration sigma centre / corner, micrometres
uniform float uT0, uT;    // exposure start (s), duration (s)
uniform int uNS;          // samples this pass
uniform int uPass;
uniform float uSeed;
uniform float uSceneEV, uCCT;
uniform float uSubjD, uSpeed;
uniform vec2 uAim;        // yaw, pitch (rad)
uniform float uPanRate;   // rad/s (panning)
uniform vec4 uShX[3];     // yaw shake components (A, f, phi, 0)
uniform vec4 uShY[3];
uniform float uFlashK;    // GN^2 * power / N^2 (value units * d^2); 0 = off
uniform float uTf;        // flash time
uniform int uMeter;       // 1 = meter / AF map pass
uniform sampler2D uPrev;

struct Lay { vec3 alb; float lit; vec3 emi; float a; float sub; };

float gFoot = 0.001;   // pixel footprint (m) at the current layer
vec3 gIll = vec3(1.0); // key-light colour (luma-normalised)

float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float hash13(vec3 p3){ p3 = fract(p3*.1031); p3 += dot(p3, p3.zyx+31.32); return fract((p3.x+p3.y)*p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3 += dot(p3, p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash12(i),hash12(i+vec2(1,0)),f.x), mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<4;i++){ s+=a*vnoise(p); p=p*2.03+17.1; a*=.5; } return s; }

vec3 lin(vec3 c){ return pow(c, vec3(2.2)); }
float sdCircle(vec2 p, float r){ return length(p)-r; }
float sdBox(vec2 p, vec2 b){ vec2 d=abs(p)-b; return length(max(d,0.))+min(max(d.x,d.y),0.); }
float sdRBox(vec2 p, vec2 b, float r){ return sdBox(p,b-r)-r; }
float sdEll(vec2 p, vec2 r){ float k0=length(p/r); float k1=length(p/(r*r)); return k0*(k0-1.)/max(k1,1e-6); }
float sdSeg(vec2 p, vec2 a, vec2 b){ vec2 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.); return length(pa-ba*h); }
float cov(float d, float w){ return clamp(0.5 - d/max(w,1e-5), 0., 1.); }
mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }

vec3 cct2rgb(float k){
  float t = clamp(k,1000.,12000.)/100.;
  float r,g,b;
  if(t<=66.){ r=255.; g=99.4708025861*log(t)-161.1195681661; }
  else { r=329.698727446*pow(t-60.,-0.1332047592); g=288.1221695283*pow(t-60.,-0.0755148492); }
  if(t>=66.) b=255.; else if(t<=19.) b=0.; else b=138.5177312231*log(t-10.)-305.0447927307;
  vec3 c = max(pow(clamp(vec3(r,g,b)/255.,0.,1.), vec3(2.2)), vec3(0.03));
  return c/dot(c, vec3(0.2126,0.7152,0.0722));
}
Lay mk(vec3 alb, float lit, float a){ return Lay(alb, lit, vec3(0.), a, 0.); }
`;
})();
