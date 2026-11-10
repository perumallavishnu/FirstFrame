/* gl_scenes_b.js: GLSL for scenes 3-6 (café, portrait, candle, night street). */
(function () {
  'use strict';
  const G = (window.FF.GLSL = window.FF.GLSL || {});
  G.sceneB = `
vec3 emitC(float k, float inten){ return cct2rgb(k)*inten; }

// ---------- 3: CAFE TABLE ----------
void scCafe(int k, vec2 P, float t, out Lay o){
  o = Lay(vec3(0.),1.,vec3(0.),0.,0.);
  if(k==0){
    float tableTop = -0.045;
    float tbl = cov(P.y - tableTop, gFoot); tbl = 1.-step(tableTop, P.y);
    vec3 wood = lin(vec3(0.42,0.26,0.14))*(0.75+0.5*vnoise(vec2(P.x*40.,P.y*220.)));
    vec2 c = P - vec2(0.,0.0);
    float sauc = cov(sdEll(P-vec2(0.,-0.036), vec2(0.075,0.011)), gFoot);
    float cup = cov(sdRBox(c-vec2(0.,0.012), vec2(0.040,0.034), 0.02), gFoot);
    cup = max(cup, cov(sdEll(c-vec2(0.,0.045), vec2(0.040,0.009)), gFoot));
    float handle = cov(abs(sdCircle(c-vec2(0.052,0.015),0.02))-0.005, gFoot)*step(0.038,c.x);
    float coffee = cov(sdEll(c-vec2(0.,0.043), vec2(0.034,0.0065)), gFoot);
    vec3 porcelain = lin(vec3(0.95,0.94,0.90))*(0.65+0.35*smoothstep(-0.04,0.04,c.x*-1.+0.02));
    vec3 col = wood; float a = tbl;
    col = mix(col, porcelain*0.95, sauc); a = max(a,sauc);
    col = mix(col, porcelain, cup); a = max(a,cup);
    col = mix(col, porcelain, handle); a = max(a,handle);
    col = mix(col, lin(vec3(0.18,0.09,0.04)), coffee); a = max(a,coffee);
    // steam
    float st = 0.;
    for(int i=0;i<3;i++){ float fi=float(i);
      float y = c.y - 0.06; float tt = t*0.5+fi*1.7;
      float x = c.x - (fi-1.)*0.014 - 0.008*sin(y*60.+tt*3.+fi*2.);
      float life = clamp(y/0.10,0.,1.)*step(0.,y);
      st = max(st, smoothstep(0.012,0.0,abs(x))*(1.-life)*step(0.,y)*0.35*(0.6+0.4*sin(tt*2.)));
    }
    float emitS = st;
    o.alb = col; o.lit = 0.85 + 0.2*smoothstep(-0.05,0.05,P.x); o.a = max(a, st);
    o.alb = mix(col, vec3(0.9), st*(1.-a)); o.sub = a>0.5 ? 1. : 0.; return;
  }
  if(k==1){ // bar counter with bottles at 2.2 m
    float bx = floor(P.x/0.22);
    float h = 0.18 + 0.22*hash12(vec2(bx,2.));
    float lx = fract(P.x/0.22)-0.5;
    float bottle = cov(sdRBox(vec2(lx*0.22, P.y-(-0.20+h*0.5)), vec2(0.05,h*0.5), 0.03), gFoot)
                 + cov(sdBox(vec2(lx*0.22, P.y-(-0.20+h+0.05)), vec2(0.014,0.07)), gFoot);
    bottle *= step(-0.6,P.x)*step(P.x,0.9)*step(0.3,hash12(vec2(bx,5.)));
    float counter = 1.-step(-0.20, P.y);
    vec3 bc = mix(lin(vec3(0.15,0.45,0.30)), lin(vec3(0.75,0.45,0.15)), hash12(vec2(bx,9.)));
    vec3 col = mix(lin(vec3(0.20,0.12,0.07))*(0.7+0.5*vnoise(P*vec2(6.,40.))), bc, clamp(bottle,0.,1.));
    o.alb = col; o.lit = 0.75; o.a = clamp(counter+bottle,0.,1.);
    o.emi = bc*0.0; return;
  }
  if(k==2){ // string lights at 4.5 m
    float a = 0.; vec3 em = vec3(0.);
    for(int r=0;r<3;r++){
      float fr = float(r);
      float y0 = 0.55 + fr*0.30 - 0.18*(1.-pow(abs(fract(P.x/2.2+fr*0.3)*2.-1.),2.));
      float bx = (floor(P.x/0.28+fr*0.37)+0.5)*0.28;
      float by = 0.55 + fr*0.30 - 0.18*(1.-pow(abs(fract(bx/2.2+fr*0.3)*2.-1.),2.)) - 0.05;
      float bulb = cov(sdCircle(P-vec2(bx,by), 0.032), gFoot);
      float flick = 0.85+0.15*sin(t*3.+bx*7.+fr);
      a = max(a, bulb); em += emitC(2500., 22.*flick)*bulb;
    }
    o.alb = lin(vec3(0.10,0.07,0.05)); o.lit = 0.4; o.a = a; o.emi = em; return;
  }
  // back wall at 9 m with windows
  vec3 wall = lin(vec3(0.16,0.10,0.07))*(0.7+0.6*vnoise(P*vec2(3.,18.)));
  vec2 wc = vec2(mod(P.x+1.6, 3.2)-1.6, P.y-0.15);
  float win = cov(sdRBox(wc, vec2(0.7,0.9), 0.05), gFoot);
  float mull = max(cov(abs(wc.x)-0.025,gFoot), cov(abs(wc.y)-0.025,gFoot));
  float lamp = cov(sdCircle(vec2(mod(P.x+0.8,1.6)-0.8, P.y-0.8), 0.13), gFoot);
  o.alb = wall; o.lit = 0.35; o.a = 1.;
  o.emi = emitC(7500., 4.5)*win*(1.-mull) + emitC(2700., 28.)*lamp;
}

// ---------- 4: GOLDEN HOUR PORTRAIT ----------
void scPortrait(int k, vec2 P, float t, out Lay o){
  o = Lay(vec3(0.),1.,vec3(0.),0.,0.);
  if(k==0){ // foreground grass at 1 m
    float a = 0.; vec3 col = lin(vec3(0.20,0.40,0.10));
    for(int i=0;i<10;i++){
      float fi=float(i);
      float x0 = -0.5 + fi*0.11 + 0.03*sin(fi*3.1);
      vec2 b = vec2(x0, -0.30);
      vec2 e = b + vec2(0.04*sin(fi*2.3+t*0.7), 0.20+0.08*hash12(vec2(fi,4.)));
      a = max(a, cov(sdSeg(P,b,e)-0.006, gFoot));
    }
    float fl = cov(sdCircle(P-vec2(0.31,-0.17),0.014), gFoot)+cov(sdCircle(P-vec2(-0.27,-0.20),0.012), gFoot);
    col = mix(col, lin(vec3(0.98,0.85,0.20)), clamp(fl,0.,1.)); a = max(a, clamp(fl,0.,1.));
    o.alb = col; o.lit = 1.2; o.a = a; return;
  }
  if(k==1){ // subject at uSubjD: head and shoulders
    vec2 q = P;
    vec2 hc = vec2(0.0, 0.16);
    float head = cov(sdEll(q-hc, vec2(0.085,0.108)), gFoot);
    float hair = cov(sdEll(q-hc-vec2(0.,0.03), vec2(0.098,0.098)), gFoot)*step(hc.y-0.015, q.y)
               + cov(sdRBox(q-hc-vec2(-0.075,-0.02), vec2(0.026,0.09),0.02), gFoot)
               + cov(sdRBox(q-hc-vec2( 0.075,-0.02), vec2(0.026,0.09),0.02), gFoot);
    hair = clamp(hair,0.,1.);
    float neck = cov(sdRBox(q-vec2(0.,0.045), vec2(0.036,0.05),0.01), gFoot);
    float torso = cov(sdRBox(q-vec2(0.,-0.17), vec2(0.20,0.19),0.09), gFoot);
    float eyeL = cov(sdEll(q-hc-vec2(-0.032,0.002), vec2(0.011,0.006)), gFoot);
    float eyeR = cov(sdEll(q-hc-vec2( 0.032,0.002), vec2(0.011,0.006)), gFoot);
    float mouth = cov(abs(length(q-hc-vec2(0.,0.07))-0.032)-0.0035, gFoot)*step(q.y,hc.y-0.032);
    vec3 skin = lin(vec3(0.76,0.55,0.42));
    vec3 col = lin(vec3(0.30,0.40,0.52));
    float a = torso;
    col = mix(col, skin*0.9, neck); a = max(a,neck);
    col = mix(col, skin, head); a = max(a, head);
    col = mix(col, lin(vec3(0.16,0.09,0.05)), hair); a = max(a, hair);
    col = mix(col, lin(vec3(0.07,0.04,0.03)), max(eyeL,eyeR));
    col = mix(col, lin(vec3(0.45,0.15,0.13)), mouth);
    // rim light from the sun behind and above-left
    float d = min(sdEll(q-hc, vec2(0.085,0.108)), sdBox(q-vec2(0.,-0.17), vec2(0.20,0.19))+0.02);
    float rim = smoothstep(0.012,0.0,abs(d)) * smoothstep(-0.05,0.08,q.y*0.6 - q.x*0.9);
    float face = head*(1.-hair);
    o.alb = col; o.lit = 0.30; o.a = a;
    o.emi = emitC(3800., 5.)*rim*a*hair*0.8 + emitC(3800., 3.)*rim*a*0.4;
    o.sub = face>0.5 ? 2. : (a>0.5 ? 1. : 0.);
    return;
  }
  if(k==2){ // trees at 14 m
    float tr = 0.; vec3 col = lin(vec3(0.10,0.22,0.07));
    float n = fbm(P*vec2(0.6,0.5)+4.);
    float canopy = smoothstep(0.50,0.56, n + 0.12*P.y*0.4);
    float trunk = step(abs(mod(P.x+1.1,2.6)-1.3),0.14)*step(P.y,3.5);
    float gaps = smoothstep(0.78,0.84, fbm(P*2.2+11.));
    float a = clamp(max(canopy*step(-0.5,P.y), trunk),0.,1.) * 0.98;
    col = mix(col, lin(vec3(0.30,0.20,0.10)), trunk*(1.-canopy));
    o.alb = col*(0.5+0.8*fbm(P*3.)); o.lit = 0.5; o.a = a;
    o.emi = emitC(3700., 40.)*gaps*canopy*step(0.5,P.y);
    // ground haze lower
    return;
  }
  // sky and sun at 200 m
  vec2 sunP = vec2(-9., 22.);
  float r = length(P-sunP);
  vec3 sky = mix(lin(vec3(1.0,0.78,0.52)), lin(vec3(0.42,0.60,0.92)), smoothstep(0.,60.,P.y));
  float disc = cov(r-5.5, gFoot*1.5);
  float glow = exp(-r*0.07);
  o.alb = lin(vec3(0.0)); o.lit=1.; o.a = 1.;
  o.emi = sky*(5.5+3.0*glow) + emitC(4300., 400.)*disc + emitC(4000., 18.)*glow*glow;
}

// ---------- 5: CANDLELIT TABLE ----------
float candleLight(vec2 P, float z){ // illumination from the flame at (0,0.07) in plane z (flame at uSubjD)
  float dz = z - uSubjD;
  float d2 = dot(P-vec2(0.,0.07), P-vec2(0.,0.07)) + dz*dz + 0.01;
  return clamp(0.06/d2, 0., 6.);
}
void scCandle(int k, vec2 P, float t, out Lay o){
  o = Lay(vec3(0.),1.,vec3(0.),0.,0.);
  float fl = 0.8+0.2*vnoise(vec2(t*9.,1.)) + 0.1*sin(t*23.);
  if(k==0){
    float tableTop = -0.10;
    float tbl = 1.-step(tableTop,P.y);
    vec3 col = lin(vec3(0.40,0.25,0.14))*(0.7+0.6*vnoise(vec2(P.x*30.,P.y*160.)));
    float stick = cov(sdRBox(P-vec2(0.,-0.015), vec2(0.016,0.085),0.006), gFoot);
    float dish = cov(sdEll(P-vec2(0.,-0.098), vec2(0.06,0.012)), gFoot);
    float wick = cov(sdSeg(P, vec2(0.,0.07), vec2(0.0,0.058))-0.0014, gFoot);
    vec2 fp = (P-vec2(0.,0.098)); fp.x *= 1.0 + 0.8*(fp.y); fp.x += 0.0035*sin(t*6.+fp.y*40.)*fl;
    float flame = cov(sdEll(fp, vec2(0.0095,0.027*(0.9+0.2*fl))), gFoot);
    float L = candleLight(P, uSubjD);
    vec3 wax = lin(vec3(0.95,0.90,0.78));
    vec3 c2 = col; float a = tbl;
    c2 = mix(c2, lin(vec3(0.65,0.50,0.22)), dish); a = max(a,dish);
    c2 = mix(c2, wax, stick); a = max(a, stick);
    c2 = mix(c2, vec3(0.02), wick);
    o.alb = c2; o.lit = clamp(L+0.10,0.10,1.1); o.a = max(a, flame);
    o.emi = emitC(1900., 30.*fl)*flame;
    o.sub = max(a,flame)>0.5 ? 1. : 0.; return;
  }
  if(k==1){ // wine glass, book, vase at 1.8 m
    float L = candleLight(P, 1.8);
    float book = cov(sdRBox(P-vec2(0.38,-0.10+0.045), vec2(0.17,0.045), 0.01), gFoot) + cov(sdRBox(P-vec2(0.40,-0.10+0.14), vec2(0.15,0.04), 0.01), gFoot);
    float stem = cov(sdBox(P-vec2(-0.40,-0.02), vec2(0.007,0.10)), gFoot);
    float bowl = cov(sdEll(P-vec2(-0.40,0.20), vec2(0.075,0.10)), gFoot)*step(0.12,P.y);
    float foot = cov(sdEll(P-vec2(-0.40,-0.11), vec2(0.07,0.012)), gFoot);
    float vase = cov(sdRBox(P-vec2(-0.78,0.08), vec2(0.07,0.17),0.05), gFoot);
    float flw = 0.; for(int i=0;i<5;i++){ float fi=float(i); flw = max(flw, cov(sdCircle(P-vec2(-0.78+(fi-2.)*0.045, 0.30+0.04*sin(fi*2.)), 0.032), gFoot)); }
    vec3 col = vec3(0.); float a = 0.;
    col = lin(vec3(0.55,0.15,0.12)); a = clamp(book,0.,1.);
    col = mix(col, lin(vec3(0.85,0.85,0.80)), clamp(stem+foot,0.,1.)*0.5); a = max(a, clamp(stem+foot,0.,1.)*0.5);
    col = mix(col, lin(vec3(0.60,0.12,0.18)), bowl*0.55); a = max(a, bowl*0.45);
    col = mix(col, lin(vec3(0.25,0.35,0.55)), vase); a = max(a, vase);
    col = mix(col, lin(vec3(0.90,0.55,0.62)), flw); a = max(a, flw);
    float tbl = 1.-step(-0.10,P.y);
    o.alb = mix(lin(vec3(0.40,0.25,0.14)), col, a); o.lit = clamp(L+0.10,0.10,1.1); o.a = max(a,tbl);
    return;
  }
  if(k==2){ // shelves at 3.5 m
    float L = candleLight(P, 3.5);
    float shelf = step(abs(mod(P.y+0.2,0.55)-0.0),0.02);
    float sx = floor(P.x/0.07);
    float spine = step(0.35, hash12(vec2(sx,floor((P.y+0.2)/0.55)))) * (1.-shelf);
    vec3 sc = mix(lin(vec3(0.5,0.15,0.12)), lin(vec3(0.15,0.25,0.4)), hash12(vec2(sx,3.)));
    vec3 col = mix(lin(vec3(0.16,0.10,0.07)), sc, spine);
    float win = cov(sdBox(P-vec2(1.3,0.5), vec2(0.35,0.6)), gFoot);
    o.alb = col; o.lit = clamp(L+0.10,0.08,1.1); o.a = 1.;
    o.emi = emitC(9000., 0.25)*win;
    return;
  }
  // far room at 6 m with other candles
  float tc = 0.; vec3 em = vec3(0.);
  for(int i=0;i<4;i++){ float fi=float(i); vec2 cp = vec2(-1.8+fi*1.35+0.3*sin(fi*5.), 0.05+0.2*sin(fi*3.)); float f2 = 0.8+0.2*vnoise(vec2(t*8.+fi*5.,2.));
    float s = cov(sdEll(P-cp, vec2(0.03,0.075)), gFoot); em += emitC(1950., 55.*f2)*s; }
  o.alb = lin(vec3(0.12,0.08,0.06)); o.lit = 0.10; o.a = 1.; o.emi = em*0.5;
}

// ---------- 6: NIGHT STREET ----------
void scNight(int k, vec2 P, float t, out Lay o){
  o = Lay(vec3(0.),1.,vec3(0.),0.,0.);
  float gy = -1.3;
  if(k==0){ // lamp post and railing silhouette at 2.5 m
    float post = cov(sdBox(P-vec2(-0.55,0.0), vec2(0.03,1.4)), gFoot);
    float arm = cov(sdSeg(P, vec2(-0.55,1.35), vec2(-0.10,1.28))-0.02, gFoot);
    float rail = cov(sdBox(P-vec2(0.,gy+0.55), vec2(3.0,0.03)), gFoot) + cov(sdBox(P-vec2(0.,gy+0.25), vec2(3.0,0.025)), gFoot);
    float bars = cov(abs(mod(P.x,0.22)-0.11)-0.012, gFoot)*step(gy,P.y)*step(P.y,gy+0.6);
    float lamp = cov(sdCircle(P-vec2(-0.08,1.25), 0.07), gFoot);
    float a = clamp(post+arm+rail+bars,0.,1.);
    o.alb = lin(vec3(0.04)); o.lit = 1.0; o.a = max(a, lamp);
    o.emi = emitC(2200., 40.)*lamp; return;
  }
  if(k==1){ // road with cars, at uSubjD
    float road = 1.-step(gy,P.y);
    vec3 col = lin(vec3(0.10,0.10,0.11)); float a = road; vec3 em = vec3(0.);
    float L = 36.;
    for(int lane=0; lane<2; lane++){
      float dir = lane==0 ? 1. : -1.;
      float sp = uSpeed*(lane==0?1.0:0.8);
      float off = lane==0 ? 0.0 : 11.;
      for(int c=0;c<3;c++){
        float cx = mod(dir*sp*t + off + float(c)*(L/3.) , L) - L*0.5;
        float yb = gy + (lane==0 ? 0.0 : 0.0);
        vec2 q = P - vec2(cx, yb+0.45);
        float body = cov(sdRBox(q, vec2(2.0,0.42), 0.25), gFoot);
        float hx = dir>0. ? 1.85 : -1.85; float tx = -hx;
        float h1 = cov(sdCircle(q-vec2(hx,0.05), 0.11), gFoot);
        float h2 = cov(sdCircle(q-vec2(hx*0.93,-0.10), 0.07), gFoot);
        float t1 = cov(sdCircle(q-vec2(tx,0.07), 0.09), gFoot);
        float refl = cov(sdBox(P-vec2(cx+hx, yb-0.45), vec2(0.5,0.6)), gFoot*2.)*0.08 * step(P.y,yb);
        col = mix(col, lin(vec3(0.07,0.07,0.09)), body); a = max(a, body);
        em += emitC(5200., 130.)*max(h1,h2) + emitC(1800., 70.)*t1 + emitC(5200., 6.)*refl*step(dir,0.);
      }
    }
    float dash = step(0.5, fract(P.x/3.))*step(abs(P.y-(gy-0.5)),0.04);
    col = mix(col, lin(vec3(0.45)), dash*0.5);
    o.alb = col; o.lit = 3.0; o.a = a; o.emi = em*0.5; o.sub = 1.; return;
  }
  if(k==2){ // street lamps and shopfronts at 28 m
    float lampX = (floor(P.x/12.)+0.5)*12.;
    float pole = cov(sdBox(P-vec2(lampX, gy+4.5), vec2(0.12,4.5)), gFoot);
    float lamp = cov(sdCircle(P-vec2(lampX+0.8, gy+9.2), 0.55), gFoot);
    float sx = floor(P.x/5.);
    float shop = step(0.,P.y-gy)*step(P.y-gy,4.2+3.*hash12(vec2(sx,1.)));
    vec2 w = fract(vec2(P.x/5., (P.y-gy)/1.9));
    float win = step(0.12,w.x)*step(w.x,0.88)*step(0.2,w.y)*step(w.y,0.75)*step(0.5,hash12(vec2(sx,floor((P.y-gy)/1.9))));
    float side = step(0.6, hash12(vec2(sx,5.)));
    vec3 wc = mix(emitC(3000.,1.6), mix(vec3(0.2,0.9,0.8), vec3(1.0,0.2,0.5), hash12(vec2(sx,8.)))*1.6, side);
    o.alb = lin(vec3(0.09,0.09,0.11)); o.lit=2.0; o.a = max(max(shop,pole),lamp);
    o.emi = wc*win*shop + emitC(2100., 40.)*lamp; return;
  }
  // skyline and sky with stars at 300 m
  float h = 14. + 40.*hash12(vec2(floor(P.x/22.),3.));
  float bld = step(P.y, h*step(0.35,hash12(vec2(floor(P.x/22.),9.))) + 0.0) * step(gy*10., P.y);
  vec2 w = fract(vec2(P.x/2.6, P.y/3.2));
  float win = step(0.2,w.x)*step(w.x,0.8)*step(0.25,w.y)*step(w.y,0.75)*step(0.55,hash12(floor(vec2(P.x/2.6,P.y/3.2))));
  vec3 sky = mix(lin(vec3(0.55,0.22,0.10)), lin(vec3(0.01,0.02,0.06)), smoothstep(0.,80.,P.y));
  vec2 pole = vec2(40.,70.);
  vec2 sp = rot(7.2921e-5*t)*(P-pole)+pole;
  vec2 g = floor(sp/2.2); vec2 f = fract(sp/2.2)-0.5;
  float star = step(0.93, hash12(g))*smoothstep(0.09,0.0,length(f - (hash22(g)-0.5)*0.6))*(0.4+hash12(g+4.));
  o.alb = lin(vec3(0.05)); o.lit = 1.2; o.a = 1.;
  o.emi = mix(sky*1.0 + vec3(0.8,0.9,1.2)*star*40.*smoothstep(10.,40.,P.y), emitC(3400.,2.5)*win*0.9 + lin(vec3(0.05))*0.5, bld);
}
`;
})();
