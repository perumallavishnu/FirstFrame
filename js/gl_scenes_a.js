/* gl_scenes_a.js: GLSL for scenes 0-2 (fan, waterfall, passing car). Units: metres. rad 1 = 18% grey under key light. */
(function () {
  'use strict';
  const G = (window.FF.GLSL = window.FF.GLSL || {});
  G.sceneA = `
// ---------- 0: SPINNING FAN ----------
void scFan(int k, vec2 P, float t, out Lay o){
  o = Lay(vec3(0.),1.,vec3(0.),0.,0.);
  if(k==0){
    vec2 q = P - vec2(0.0, 0.10);
    float r = length(q), ang = atan(q.y, q.x);
    float th = fract(uSpeed/60.*t)*6.2831853;
    float R = 0.21, best = 0., sh = 0.8;
    for(int j=0;j<5;j++){
      float da = mod(ang - th - float(j)*1.2566371 + PI, 2.*PI) - PI;
      float sweep = 0.85*r/R;
      float hw = 0.34*(0.5+0.5*smoothstep(0.03,0.12,r))*(1.-0.25*(r/R)*(r/R));
      float dd = (abs(da - sweep) - hw)*max(r,0.02);
      float c = cov(dd, gFoot)*step(0.03,r)*step(r,R);
      if(c>best){ best=c; sh=0.78+0.22*cos((da-sweep)/hw*1.4); }
    }
    float hub = cov(sdCircle(q,0.045), gFoot);
    float cap = cov(sdCircle(q,0.018), gFoot);
    float pole = cov(sdBox(P-vec2(0.,-0.36), vec2(0.014,0.30)), gFoot);
    float base = cov(sdEll(P-vec2(0.,-0.66), vec2(0.16,0.03)), gFoot);
    vec3 col = lin(vec3(0.20,0.21,0.23)); float a = max(pole, base);
    col = mix(col, lin(vec3(0.10,0.55,0.60))*sh, best); a = max(a, best);
    col = mix(col, lin(vec3(0.12,0.13,0.14)), hub); a = max(a, hub);
    col = mix(col, lin(vec3(0.75,0.77,0.80)), cap); a = max(a, cap);
    o.alb = col; o.lit = 1.0; o.a = a; o.sub = 1.;
    return;
  }
  // wall at 5 m
  vec3 wall = mix(lin(vec3(0.80,0.75,0.68)), lin(vec3(0.58,0.56,0.55)), smoothstep(1.2,-1.4,P.y));
  vec2 g = fract(P/0.06)-0.5;
  float inBoard = step(0.3,P.x)*step(P.x,2.4)*step(-0.5,P.y)*step(P.y,1.1);
  float hole = smoothstep(0.2,0.13,length(g))*inBoard;
  wall = mix(wall, wall*0.30, hole);
  wall = mix(wall, lin(vec3(0.85,0.30,0.22)), cov(sdBox(P-vec2(1.0,0.55),vec2(0.22,0.28)),gFoot));
  wall = mix(wall, lin(vec3(0.20,0.45,0.75)), cov(sdBox(P-vec2(1.6,0.30),vec2(0.18,0.22)),gFoot));
  wall = mix(wall, lin(vec3(0.95,0.78,0.25)), cov(sdBox(P-vec2(1.35,0.00),vec2(0.30,0.10)),gFoot));
  vec2 wc = P-vec2(-1.5,0.45);
  float win = cov(sdBox(wc, vec2(0.55,0.65)), gFoot);
  float bars = max(cov(abs(wc.x)-0.02,gFoot)*step(abs(wc.y),0.65), cov(abs(wc.y)-0.02,gFoot)*step(abs(wc.x),0.55));
  o.alb = wall; o.lit = 0.85; o.a = 1.;
  o.emi = vec3(1.0,1.02,1.1)*16.*win*(1.-bars);
}

// ---------- 1: WATERFALL ----------
void scWater(int k, vec2 P, float t, out Lay o){
  o = Lay(vec3(0.),1.,vec3(0.),0.,0.);
  if(k==0){ // foreground ferns and rocks
    float rock = cov(sdEll(P-vec2(-0.75,-0.62), vec2(0.55,0.28)), gFoot) + cov(sdEll(P-vec2(0.85,-0.70), vec2(0.62,0.30)), gFoot);
    float nz = fbm(P*7.);
    float leaves = 0.;
    for(int i=0;i<7;i++){
      float fi=float(i);
      vec2 b = vec2(i<4?-0.95:0.95, -0.55);
      float ang = (i<4? 1.0:2.14) + (fi-3.)*0.17 + sin(t*0.6+fi)*0.015;
      vec2 e = b + vec2(cos(ang),sin(ang))*(0.55+0.07*fi);
      vec2 pa = P-b, ba = e-b; float h = clamp(dot(pa,ba)/dot(ba,ba),0.,1.);
      float w = 0.05*sin(3.1416*h)+0.003;
      leaves = max(leaves, cov(length(pa-ba*h)-w, gFoot));
    }
    float a = clamp(rock+leaves,0.,1.);
    vec3 col = mix(lin(vec3(0.20,0.24,0.22))*(0.6+0.8*nz), lin(vec3(0.07,0.20,0.07))*(0.7+0.6*nz), leaves*(1.-clamp(rock,0.,1.)));
    o.alb = col; o.lit = 0.55; o.a = a; return;
  }
  if(k==1){ // waterfall column
    float W = 1.4;
    float x = P.x/W;
    float edge = smoothstep(1.0,0.8,abs(x + 0.08*sin(P.y*0.7)));
    vec2 q = vec2(P.x*8., (P.y + uSpeed*t)*0.9);
    float n = fbm(q*vec2(1.0,0.28)+3.) ; float n2 = fbm(q*vec2(2.3,0.5)+9.);
    float streak = smoothstep(0.30,0.80, n*0.65 + n2*0.5);
    float top = smoothstep(4.0,3.0,P.y);                      // lip of the fall
    float foam = smoothstep(-2.2,-1.2,P.y)*smoothstep(-0.8,-1.3,P.y);
    vec2 sp = vec2(P.x*3., (P.y+1.6)*3.);
    float splash = fbm(sp + vec2(0., -t*2.)) * smoothstep(1.6,0.2,length(vec2(P.x*0.7,P.y+1.5)));
    float body = edge*top*smoothstep(-1.5,-1.0,P.y);
    float a = clamp(body*(0.45+0.55*streak) + splash*0.9 + foam*edge*0.5, 0., 1.);
    vec3 col = mix(lin(vec3(0.62,0.74,0.80)), lin(vec3(0.97,0.99,1.0)), streak*0.8+splash*0.5);
    o.alb = col; o.lit = 1.0; o.a = a; o.sub = 1.; return;
  }
  // cliff at 16 m
  vec2 q = P*vec2(1.2,0.9);
  float n = fbm(q*3.+2.); float n2 = fbm(q*11.);
  vec3 rock = mix(lin(vec3(0.22,0.20,0.18)), lin(vec3(0.46,0.43,0.38)), n);
  vec3 moss = lin(vec3(0.12,0.30,0.10));
  rock = mix(rock, moss, smoothstep(0.52,0.72, fbm(q*5.+8.)));
  rock *= 0.65 + 0.7*n2;
  float pool = smoothstep(-2.4,-2.6,P.y);
  rock = mix(rock, mix(lin(vec3(0.10,0.30,0.32)), lin(vec3(0.55,0.75,0.80)), fbm(vec2(P.x*3.,P.y*14.)-vec2(0.,t*0.3))), pool);
  o.alb = rock; o.lit = 0.75; o.a = 1.;
  o.emi = lin(vec3(0.7,0.85,1.0))*3.0*smoothstep(3.0,5.5,P.y);
}

// ---------- 2: PASSING CAR ----------
float carX(float t){ float L = 36.; return mod(uSpeed*t, L) - L*0.5; }
void scCar(int k, vec2 P, float t, out Lay o){
  o = Lay(vec3(0.),1.,vec3(0.),0.,0.);
  float gy = -1.2;
  if(k==0){ // fence posts
    float px = mod(P.x+0.9, 1.8)-0.9;
    float post = cov(sdBox(vec2(px,P.y-(gy+0.55)), vec2(0.045,0.55)), gFoot);
    float rail = cov(sdBox(vec2(0.,P.y-(gy+0.65)), vec2(99.,0.04)), gFoot)+cov(sdBox(vec2(0.,P.y-(gy+0.30)), vec2(99.,0.04)), gFoot);
    float a = clamp(post+rail,0.,1.)*step(P.y,gy+1.1)*step(gy,P.y+0.0001+0.0);
    o.alb = lin(vec3(0.55,0.40,0.26))*(0.8+0.4*vnoise(P*vec2(30.,4.))); o.lit=0.95; o.a = a; return;
  }
  if(k==1){
    float road = cov(P.y-gy, gFoot);        // asphalt below ground line
    road = 1.-step(gy, P.y);
    float dash = step(0.5, fract(P.x/2.4))*step(abs(P.y-(gy-0.65)),0.05);
    vec3 col = lin(vec3(0.24,0.24,0.26))*(0.8+0.4*vnoise(P*18.));
    col = mix(col, lin(vec3(0.9)), dash);
    float a = road;
    // car
    float cx = carX(t);
    vec2 c = P - vec2(cx, gy+0.15);
    float body = cov(sdRBox(c-vec2(0.,0.42), vec2(2.05,0.32), 0.2), gFoot);
    float cab = cov(sdRBox(c-vec2(-0.1,0.95), vec2(1.05,0.32), 0.28), gFoot);
    float win = cov(sdRBox(c-vec2(-0.1,0.97), vec2(0.92,0.22), 0.16), gFoot)*step(0.45,c.y-0.45+0.4);
    float pillar = cov(abs(c.x+0.1)-0.04, gFoot);
    float ws = win*(1.-pillar);
    float ang = -uSpeed*t/0.33;
    float wheel=0., rim=0., spoke=0.;
    for(int w=0; w<2; w++){
      vec2 wc = c - vec2(w==0?-1.25:1.25, 0.18);
      wheel = max(wheel, cov(sdCircle(wc,0.33), gFoot));
      rim = max(rim, cov(sdCircle(wc,0.2), gFoot));
      vec2 rr = rot(ang)*wc;
      float sp = 0.; for(int s=0;s<5;s++){ float aa = float(s)*1.2566; sp = max(sp, cov(sdSeg(rr, vec2(0.), vec2(cos(aa),sin(aa))*0.19)-0.018, gFoot)); }
      spoke = max(spoke, sp);
    }
    float shade = 0.75 + 0.35*smoothstep(0.1,1.2,c.y);
    vec3 paint = lin(vec3(0.80,0.12,0.10))*shade;
    vec3 cc = paint; float ca = max(body,cab);
    cc = mix(cc, lin(vec3(0.16,0.22,0.30)), ws);
    cc = mix(cc, lin(vec3(0.05)), wheel); ca = max(ca, wheel);
    cc = mix(cc, lin(vec3(0.72,0.74,0.78)), rim);
    cc = mix(cc, lin(vec3(0.25)), spoke);
    col = mix(col, cc, ca); a = max(a, ca);
    float head = cov(sdRBox(c-vec2(2.0,0.52), vec2(0.07,0.1),0.04), gFoot);
    float tail = cov(sdRBox(c-vec2(-2.0,0.55), vec2(0.06,0.1),0.03), gFoot);
    col = mix(col, lin(vec3(1.,0.95,0.85)), head); col = mix(col, lin(vec3(0.9,0.05,0.05)), tail);
    o.alb = col; o.lit = 1.0; o.a = a; o.sub = ca>0.5 ? 1. : 0.; return;
  }
  if(k==2){ // buildings and trees at 30 m
    float bx = floor(P.x/9.);
    float h = 4.0 + 7.0*hash12(vec2(bx,1.));
    float inb = step(0., P.y-gy)*step(P.y-gy, h)*step(0.5, hash12(vec2(bx,7.))+0.25);
    vec2 w = fract(vec2(P.x/1.6, (P.y-gy)/1.8))-0.5;
    float window = step(abs(w.x),0.28)*step(abs(w.y),0.30);
    vec3 wall = mix(lin(vec3(0.78,0.72,0.64)), lin(vec3(0.55,0.62,0.70)), hash12(vec2(bx,3.)));
    vec3 col = mix(wall, lin(vec3(0.20,0.28,0.38)), window*0.85);
    float tree = cov(sdCircle(vec2(mod(P.x+3.,7.)-3.5, P.y-(gy+3.4)), 2.2+1.0*hash12(vec2(floor((P.x+3.)/7.),5.))), gFoot*2.);
    vec3 tc = lin(vec3(0.16,0.40,0.14))*(0.7+0.6*fbm(P*1.5));
    float ground = 1.-step(gy,P.y);
    float a = max(max(inb, tree*step(0.,P.y-gy)), 0.);
    vec3 outc = mix(wall*(0.9), col, 1.0);
    outc = mix(outc, tc, tree*(1.-inb));
    o.alb = outc; o.lit = 0.9; o.a = clamp(a + ground*0.0,0.,1.); return;
  }
  // sky + hills at 300 m
  vec3 sky = mix(lin(vec3(0.72,0.84,0.96)), lin(vec3(0.30,0.52,0.86)), smoothstep(0.,60.,P.y));
  float cloud = smoothstep(0.55,0.8, fbm(vec2(P.x*0.02, P.y*0.06)+3.));
  sky = mix(sky, lin(vec3(1.)), cloud*0.8);
  float hill = cov(P.y - (6.+10.*fbm(vec2(P.x*0.01,2.))) + 6., gFoot*2.);
  float hl = 1.-step(1., P.y + 8. + 0.0);
  vec3 hc = lin(vec3(0.30,0.45,0.30));
  vec3 col = mix(sky, hc, 1.-smoothstep(0.,1.,(P.y+2.0 - 14.*fbm(vec2(P.x*0.012,2.)))*-1.));
  o.alb = mix(sky, hc, step(P.y, 10.*fbm(vec2(P.x*0.012,2.))-2.)); o.lit = 1.1; o.a = 1.;
}
`;
})();
