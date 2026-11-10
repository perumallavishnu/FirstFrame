/* gl_main.js: scene dispatcher, thin-lens sampling loop, meter pass, and the display (sensor + processing) pass. */
(function () {
  'use strict';
  const G = (window.FF.GLSL = window.FF.GLSL || {});

  G.vert = `#version 300 es
void main(){ vec2 p = vec2((gl_VertexID<<1)&2, gl_VertexID&2); gl_Position = vec4(p*2.-1., 0., 1.); }`;

  G.dispatch = `
int nLayers(int sc){ return sc==0 ? 2 : (sc==1 ? 3 : 4); }
float zOf(int sc, int k){
  if(sc==0) return k==0 ? uSubjD : 5.0;
  if(sc==1) return k==0 ? 1.8 : (k==1 ? uSubjD : 16.0);
  if(sc==2) return k==0 ? 3.0 : (k==1 ? uSubjD : (k==2 ? 30.0 : 300.0));
  if(sc==3) return k==0 ? uSubjD : (k==1 ? 2.2 : (k==2 ? 4.5 : 9.0));
  if(sc==4) return k==0 ? 1.0 : (k==1 ? uSubjD : (k==2 ? 14.0 : 200.0));
  if(sc==5) return k==0 ? uSubjD : (k==1 ? 1.8 : (k==2 ? 3.5 : 6.0));
  return k==0 ? 2.5 : (k==1 ? uSubjD : (k==2 ? 28.0 : 300.0));
}
void layerEval(int sc, int k, vec2 P, float t, out Lay o){
  if(sc==0) scFan(k,P,t,o);
  else if(sc==1) scWater(k,P,t,o);
  else if(sc==2) scCar(k,P,t,o);
  else if(sc==3) scCafe(k,P,t,o);
  else if(sc==4) scPortrait(k,P,t,o);
  else if(sc==5) scCandle(k,P,t,o);
  else scNight(k,P,t,o);
}
// Ray through sensor point xs and lens point lp, layer by layer, front to back.
// mode 0: ambient radiance (grey card = 1); mode 1: flash value (reflectance / d^2).
vec3 trace(vec2 xs, vec2 lp, float t, vec2 th, float v, float s, int mode){
  vec3 acc = vec3(0.); float tr = 1.;
  int nl = nLayers(uScene);
  for(int k=0;k<4;k++){
    if(k>=nl) break;
    float d = zOf(uScene,k), dmm = d*1000.;
    vec2 Pm = (xs*dmm/v + lp*(1.-dmm/s) + dmm*th)/1000.;
    gFoot = max((uWin.z/uRes.x)*dmm/v/1000., 1e-4)*0.8;
    Lay o; layerEval(uScene,k,Pm,t,o);
    float a = o.a*tr;
    if(mode==0) acc += a*(o.alb/0.18*o.lit*gIll + o.emi);
    else acc += a*o.alb*(1.-clamp(o.emi.g*0.02,0.,1.))/(d*d);
    tr *= (1.-o.a);
    if(tr<0.004) break;
  }
  return acc;
}
`;

  G.sceneMain = `
void main(){
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = frag/uRes;
  vec2 xs0 = uWin.xy + (uv-0.5)*uWin.zw;
  gIll = cct2rgb(uCCT);
  const float R0 = 13.41;
  float s = uFocus, v = s*uF/(s-uF);

  if(uMeter==1){                       // meter / AF map pass: pinhole, no blur
    vec3 sum = vec3(0.); float depth = 0.; float sub = 0.; float lumSum = 0.;
    for(int i=0;i<4;i++){
      vec2 jit = (hash22(frag+float(i)*3.7)-0.5)*uWin.zw/uRes;
      vec2 xs = xs0 + jit;
      vec3 acc = vec3(0.); float tr = 1.; int nl = nLayers(uScene);
      for(int k=0;k<4;k++){
        if(k>=nl) break;
        float d = zOf(uScene,k), dmm = d*1000.;
        vec2 Pm = (xs*dmm/uF + dmm*uAim)/1000.;
        gFoot = max((uWin.z/uRes.x)*dmm/uF/1000., 1e-4);
        Lay o; layerEval(uScene,k,Pm,uT0,o);
        float a = o.a*tr;
        acc += a*(o.alb/0.18*o.lit*gIll + o.emi);
        if(i==0 && depth==0. && o.a>0.5){ depth = d; sub = o.sub; }
        tr *= (1.-o.a); if(tr<0.004) break;
      }
      lumSum += dot(acc, vec3(0.2126,0.7152,0.0722));
    }
    float L = lumSum/4.;
    outColor = vec4((log2(max(L,1e-4))+12.)/26., (log2(max(depth,0.5))+1.)/10., sub/4., 1.);
    return;
  }

  float Rap = uF/(2.*uN);
  float rN = length(xs0)/R0;
  vec3 h3 = vec3(hash13(vec3(frag,uSeed)), hash13(vec3(frag.yx+7.1,uSeed+3.1)), hash13(vec3(frag+13.7,uSeed+9.7)));
  float sector = 2.*PI/float(uBlades);
  float norm = sqrt(PI/(0.5*float(uBlades)*sin(sector)));
  float tmid = uT0 + 0.5*uT;
  float c4 = pow(cos(atan(length(xs0)/uF)), 4.);
  vec2 offDir = rN>1e-4 ? normalize(xs0) : vec2(0.);
  vec3 aSum = vec3(0.), fSum = vec3(0.);
  for(int i=0;i<MAXS;i++){
    if(i>=uNS) break;
    float fi = float(i + uPass*uNS);
    vec3 r = fract(vec3(0.8191725134,0.6710436067,0.5497004779)*(fi+1.) + h3);
    float rad = sqrt(r.x), ang = 2.*PI*r.y;
    float a2 = mod(ang, sector)-0.5*sector;
    float pf = cos(0.5*sector)/cos(a2)*norm;
    vec2 q = vec2(cos(ang),sin(ang))*rad*mix(1., pf, uPoly);
    float w = step(length(q - offDir*uCat*rN*rN), 1.0);
    if(w<0.5) continue;
    vec2 lp = q*Rap;
    float tt = uT0 + uT*r.z;
    vec2 u1 = hash22(frag + fi*1.618 + uSeed);
    vec2 gj = sqrt(-2.*log(max(u1.x,1e-4)))*vec2(cos(2.*PI*u1.y), sin(2.*PI*u1.y));
    float ab = uAb.x + (uAb.y-uAb.x)*rN*rN;
    float sig = sqrt(uBase*uBase + ab*ab)*1e-3;
    vec2 xs = xs0 + gj*sig;
    float r2 = dot(xs,xs)/(R0*R0); xs *= 1. + uDist*r2;
    vec2 th = uAim + uPanRate*(tt-tmid)*vec2(1.,0.);
    for(int c=0;c<3;c++){
      th.x += uShX[c].x*sin(6.2831853*uShX[c].y*tt+uShX[c].z);
      th.y += uShY[c].x*sin(6.2831853*uShY[c].y*tt+uShY[c].z);
    }
    aSum += trace(xs, lp, tt, th, v, s, 0);
    if(uFlashK>0.){
      vec2 thf = uAim + uPanRate*(uTf-tmid)*vec2(1.,0.);
      for(int c=0;c<3;c++){
        thf.x += uShX[c].x*sin(6.2831853*uShX[c].y*uTf+uShX[c].z);
        thf.y += uShY[c].x*sin(6.2831853*uShY[c].y*uTf+uShY[c].z);
      }
      fSum += trace(xs, lp, uTf, thf, v, s, 1);
    }
  }
  float cnt = float(uNS);
  float K = 0.18*exp2(uSceneEV)*uT/(uN*uN);
  vec3 val = (aSum/cnt)*K*c4;
  if(uFlashK>0.) val += (fSum/cnt)*uFlashK*cct2rgb(5600.)*c4;
  if(uPass>0){ vec3 prev = texelFetch(uPrev, ivec2(frag), 0).rgb; val = mix(prev, val, 1./float(uPass+1)); }
  outColor = vec4(val, 1.);
}
`;

  G.displayFrag = `#version 300 es
precision highp float;
out vec4 outColor;
uniform sampler2D uAcc;
uniform vec2 uRes;
uniform vec4 uWin;
uniform float uG;        // ISO gain (ISO/100)
uniform float uFWC, uRead, uM, uNR, uSeed, uCorr, uCat, uF;
uniform vec3 uWB;
uniform vec3 uStyle;     // contrast, saturation, mono(0/1)
uniform int uPreview;
float hash13(vec3 p3){ p3 = fract(p3*.1031); p3 += dot(p3, p3.zyx+31.32); return fract((p3.x+p3.y)*p3.z); }
float randn(vec3 p){ float a = max(hash13(p),1e-4), b = hash13(p+17.7); return sqrt(-2.*log(a))*cos(6.2831853*b); }
vec3 oetf(vec3 x){ x = clamp(x,0.,1.); return mix(x*12.92, 1.055*pow(x,vec3(1./2.4))-0.055, step(0.0031308,x)); }
void main(){
  vec2 frag = gl_FragCoord.xy;
  ivec2 ip = ivec2(frag);
  vec3 v100 = texelFetch(uAcc, ip, 0).rgb;
  if(uPreview==1){
    vec3 s = v100; float n = 1.;
    for(int dy=-1; dy<=1; dy++) for(int dx=-1; dx<=1; dx++){ if(dx==0&&dy==0) continue;
      ivec2 q = clamp(ip+ivec2(dx,dy), ivec2(0), ivec2(uRes)-1); s += texelFetch(uAcc, q, 0).rgb; n += 1.; }
    v100 = mix(v100, s/n, 0.7);
  }
  // sensor: photon shot noise + read noise, then ISO gain, clip at saturation
  vec3 ne = max(v100,0.)*uFWC;
  vec3 sig = uG*sqrt(ne + uRead*uRead)/uFWC/sqrt(uM) * uNR;
  vec3 n3 = vec3(randn(vec3(frag,uSeed)), randn(vec3(frag,uSeed+5.1)), randn(vec3(frag,uSeed+9.3)));
  vec3 v = clamp(v100*uG + sig*n3, 0., 1.);
  // lens correction (vignetting) applied after the sensor, so corners get noisier
  if(uCorr>0.5){
    vec2 xs = uWin.xy + (frag/uRes-0.5)*uWin.zw;
    float rN = length(xs)/13.41;
    float o = clamp(uCat*rN*rN, 0., 1.95);
    float A = (2.*acos(o*0.5) - 0.5*o*sqrt(4.-o*o))/3.14159265;
    float c4 = pow(cos(atan(length(xs)/uF)), 4.);
    v *= min(1./max(A*c4,0.2), 5.);
  }
  float mx = max(max(v.r,v.g),v.b);
  vec3 vw = v*uWB;
  vw = mix(vw, vec3(max(vw.r, max(vw.g, vw.b))), smoothstep(0.9, 1.0, mx));   // clipped highlights go neutral, like an in-camera JPEG
  v = clamp(vw, 0., 1.);
  float y = dot(v, vec3(0.2126,0.7152,0.0722));
  v = mix(vec3(y), v, uStyle.y);
  vec3 c = oetf(v);
  c = mix(c, c*c*(3.-2.*c), uStyle.x);
  c += (hash13(vec3(frag,uSeed+2.)) - 0.5)/255.;
  outColor = vec4(c, 1.);
}`;

  G.scenePass = () => G.head + G.sceneA + G.sceneB + G.dispatch + G.sceneMain;
})();
