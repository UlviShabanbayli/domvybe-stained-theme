// DV87 STAINED THEME · GLSL (ES 1.0, runs on WebGL1 and WebGL2).
// Baked once per resize: NOISE (256² tiling noise), STONE (the page: limestone albedo + relief), WINDOW (moulding, lead,
// cathedral glass, seeds, streaks — two targets). Every frame: COMP (scene, behind the DOM) and OVER (light, above it).

export const COMMON = `
precision highp float;
float hash12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*0.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec2 hash22(vec2 p){ vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3+=dot(p3,p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(hash12(i),hash12(i+vec2(1,0)),u.x), mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),u.x), u.y); }
float fbm(vec2 p){ float a=0.5, s=0.0; for(int i=0;i<5;i++){ s+=a*vnoise(p); p=mat2(1.6,1.2,-1.2,1.6)*p+vec2(17.1,9.2); a*=0.5; } return s/0.97; }
// distance to a diamond-quarry lead lattice in unit-square uv, n diamonds per axis pair
float quarry(vec2 uv, vec2 n){ vec2 a=vec2(uv.x*n.x+uv.y*n.y, uv.x*n.x-uv.y*n.y); vec2 f=abs(fract(a)-0.5); return min(0.5-f.x,0.5-f.y)/length(n); }
vec2 qcell(vec2 uv, vec2 n){ return floor(vec2(uv.x*n.x+uv.y*n.y, uv.x*n.x-uv.y*n.y)); }
// equilateral lancet: arch above the spring line ys (two circles of radius 2hw on the opposite springers), box below
float sdArch(vec2 p, float cx, float ys, float hw, float yb){
  if(p.y<ys){ float r=2.0*hw; return max(length(p-vec2(cx-hw,ys))-r, length(p-vec2(cx+hw,ys))-r); }
  vec2 q=vec2(abs(p.x-cx)-hw, p.y-yb); return max(q.x,q.y);
}
float sdBox(vec2 p, vec2 b){ vec2 d=abs(p)-b; return length(max(d,0.0))+min(max(d.x,d.y),0.0); }
`;

// periodic value noise for a seamless 256² tile: r = soft fbm (caustics), g = fine hammered grain, b = clouds, a = rays
export const NOISE = `${COMMON}
uniform vec2 uRes;
float pn(vec2 p, float P){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
  float a=hash12(mod(i,P)), b=hash12(mod(i+vec2(1,0),P)), c=hash12(mod(i+vec2(0,1),P)), d=hash12(mod(i+vec2(1,1),P));
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y); }
float pfbm(vec2 p, float P){ float a=0.5, s=0.0; for(int i=0;i<5;i++){ s+=a*pn(p,P); p*=2.0; P*=2.0; a*=0.5; } return s/0.97; }
void main(){
  vec2 uv=gl_FragCoord.xy/uRes;
  float r=pfbm(uv*4.0, 4.0);
  float g=pfbm(uv*32.0+7.0, 32.0);
  float b=pfbm(uv*3.0+3.0, 3.0);
  float a=pfbm(vec2(uv.x*16.0, uv.y*2.0)+11.0, 16.0);
  gl_FragColor=vec4(r,g,b,a);
}`;

// the page: warm limestone plaster with faint ashlar coursing. rgb = sqrt(albedo), a = relief under the sun (N·L / 1.6)
export const STONE = `${COMMON}
uniform vec2 uRes; uniform float uPx; uniform float uBlock;
float height(vec2 c){
  float h=fbm(c*0.011)*0.55+fbm(c*0.05)*0.3+vnoise(c*0.33)*0.08;
  // ashlar: courses of blocks, staggered, with a soft recessed joint
  vec2 b=vec2(uBlock*2.0, uBlock);
  float row=floor(c.y/b.y);
  vec2 q=vec2(c.x+mod(row,2.0)*b.x*0.5, c.y);
  vec2 f=mod(q,b);
  float j=min(min(f.x,b.x-f.x), min(f.y,b.y-f.y));
  h-=0.16*smoothstep(3.0,0.0,j);
  h+=0.05*hash12(floor(q/b)+3.0);
  return h;
}
void main(){
  vec2 c=vec2(gl_FragCoord.x, uRes.y-gl_FragCoord.y)/uPx;      // css px, y down
  float h=height(c);
  float e=0.75;
  vec2 g=vec2(height(c+vec2(e,0.0))-height(c-vec2(e,0.0)), height(c+vec2(0.0,e))-height(c-vec2(0.0,e)))/(2.0*e);
  vec3 n=normalize(vec3(-g*7.0, 1.0));
  vec3 L=normalize(vec3(-0.55,-0.45,0.7));                       // the sun comes from the window, upper left
  float rel=clamp(dot(n,L)/L.z, 0.0, 1.6)/1.6;
  float st=fbm(c*0.012)*0.6+fbm(c*0.06)*0.4;
  vec3 alb=vec3(0.215,0.19,0.168)*(0.86+0.2*st);
  alb*=0.96+0.08*vnoise(c*0.9);
  alb=mix(alb, alb*vec3(0.92,0.9,0.95), smoothstep(0.55,0.75,fbm(c*0.004+5.0)));   // cooler patches
  alb*=1.0-0.07*smoothstep(-0.05,-0.3,h-fbm(c*0.011)*0.55-fbm(c*0.05)*0.3);         // joints a touch darker
  gl_FragColor=vec4(sqrt(alb), rel);
}`;

// the window, baked in its own box. W0: rgb colour (glass stores transmitted colour / 2), a = glass coverage.
// W1: r = hammered texture (sparkle, sheen), g = how much glass light the moulding receives, b = window coverage, a = glass class
// (0 pane, .33 pale arch glass, .66 gold quatrefoil + corner squares, 1 = oculus ring in the selected colour)
const WINDOW_BODY = `
uniform vec2 uRes; uniform float uPx;
uniform vec4 uWin;   // cx, ys, hw, yb (rt px, y down)
uniform float uF, uRh, uS;  // frame width, row height, design scale (rt px per design px)
uniform vec3 uCol[6];
struct G { vec3 c; float cover; float lead; float cls; float rip; float rec; float win; };
vec3 lin(vec3 c){ return pow(c, vec3(2.2)); }
G shade(vec2 p){
  G o; o.c=vec3(0.0); o.cover=0.0; o.lead=1e3; o.cls=0.0; o.rip=0.0; o.rec=0.0; o.win=0.0;
  float cx=uWin.x, ys=uWin.y, hw=uWin.z, yb=uWin.w, S=uS;
  float dIn=sdArch(p,cx,ys,hw,yb);
  float dOut=dIn-uF;
  vec2 gp=p/uPx;
  o.win=smoothstep(0.75*uPx,-0.75*uPx,dOut);
  if(dOut>uPx) return o;
  // ---- stone moulding: outer chamfer, a hollow cove, a roll, the deep reveal next to the glass
  if(dIn>-1.0*uPx){
    float t=clamp(-dOut/uF,0.0,1.0);
    vec2 e=vec2(1.0,0.0);
    vec2 g=normalize(vec2(sdArch(p+e.xy,cx,ys,hw,yb)-sdArch(p-e.xy,cx,ys,hw,yb), sdArch(p+e.yx,cx,ys,hw,yb)-sdArch(p-e.yx,cx,ys,hw,yb))+1e-5);
    // profile slope (height rising toward the glass) → a surface normal
    float sl = t<0.12 ? 1.6 : (t<0.42 ? -1.4*cos((t-0.12)/0.30*3.14159) : (t<0.72 ? 1.2*cos((t-0.42)/0.30*3.14159) : -2.2));
    vec3 n=normalize(vec3(g*sl*0.55, 1.0));
    vec3 key=normalize(vec3(-0.55,-0.75,0.55));
    float lam=max(dot(n,key),0.0);
    float st=fbm(gp*0.05)*0.6+fbm(gp*0.2)*0.4;
    vec3 alb=lin(vec3(0.53,0.49,0.44))*(0.82+0.3*st);
    alb*=1.0-0.12*smoothstep(0.6,0.0,vnoise(gp*0.6));            // pitting
    vec3 fr=alb*(0.05+0.42*lam);
    fr*=1.0-0.55*smoothstep(0.72,1.0,t);                           // the reveal falls into shadow
    fr*=1.0-0.25*smoothstep(0.08,0.0,t);                           // arris
    // a thin bright arris on the roll catches the room light
    fr+=alb*0.25*exp(-pow((t-0.56)/0.03,2.0))*max(dot(g,-normalize(vec2(0.55,0.75))),0.0);
    o.c=fr;
    o.rec=smoothstep(0.35,1.0,t)*(0.6+0.4*max(dot(-g,normalize(vec2(0.0,1.0))),0.0));
  }
  if(dIn>=0.0) return o;
  // ---- inside: glass and lead
  float lead=1e3; vec3 gc=vec3(0.0); float cls=0.0;
  float th=fbm(gp*0.018);
  float rip=vnoise(gp*0.21)*0.6+vnoise(gp*0.47)*0.4;
  if(p.y>=ys){
    float col=p.x<cx?0.0:1.0;
    float row=clamp(floor((p.y-ys)/uRh),0.0,2.0);
    float idx=row*2.0+col;
    float pw=hw, ph=uRh;
    vec2 lp=vec2(p.x-(cx-hw+col*hw), p.y-ys-row*uRh);
    vec3 pc=uCol[0];
    for(int k=0;k<6;k++){ if(abs(float(k)-idx)<0.5) pc=uCol[k]; }
    float dEdge=min(min(lp.x,pw-lp.x),min(lp.y,ph-lp.y));
    float bar=dEdge-4.6*S;                                         // iron saddle bars / mullion between panes
    float bw=0.085*min(pw,ph);
    float lb=abs(dEdge-bw)-1.6*S;                                  // the border fillet
    bool inBorder=dEdge<bw;
    bool tb=(lp.y<bw||lp.y>ph-bw), lr=(lp.x<bw||lp.x>pw-bw);
    float dc=min(tb?min(abs(lp.x-bw),abs(lp.x-pw+bw)):1e3, lr?min(abs(lp.y-bw),abs(lp.y-ph+bw)):1e3)-1.6*S;
    vec2 iuv=(lp-bw)/vec2(pw-2.0*bw, ph-2.0*bw);
    float dq=quarry(iuv, vec2(2.0,3.0))*min(pw-2.0*bw,ph-2.0*bw)-1.7*S;
    lead=min(bar, lb);
    if(inBorder) lead=min(lead, dc); else lead=min(lead, dq);
    vec2 cell=qcell(iuv, vec2(2.0,3.0));
    float pv=hash12(cell+idx*13.0);
    // Beer–Lambert: thickness varies per piece and within it
    float d=0.55+0.85*th+0.35*(pv-0.5);
    vec3 T=pow(pc, vec3(d));
    float streak=vnoise(vec2(gp.x*0.012+idx*3.1+gp.y*0.004, gp.y*0.075));
    T*=0.78+0.45*streak;
    T+=mix(pc,vec3(1.0),0.55)*0.32*pow(smoothstep(0.35,0.95,th+0.25*streak),3.0);
    if(inBorder){
      bool corner=tb&&lr;
      T=corner? lin(vec3(0.98,0.76,0.32))*(0.7+0.5*th) : pow(pc, vec3(d*1.35))*(0.85+0.3*streak);
      cls=corner?0.66:0.0;
    }
    // seeds: tiny bubbles caught in the glass
    vec2 sc=floor(gp/7.0); vec2 so=hash22(sc+idx);
    float sr=0.5+1.3*hash12(sc+5.0);
    float sd=length(gp-(sc+so)*7.0);
    float seed=step(0.955,hash12(sc+idx*1.7))*smoothstep(sr,sr*0.4,sd);
    T=mix(T, T*1.6+0.03, seed*0.7);
    T*=1.0-0.35*step(0.955,hash12(sc+idx*1.7))*smoothstep(sr*0.6,sr,sd)*smoothstep(sr*1.4,sr,sd);
    gc=T;
  } else {
    // arch head: pale cathedral glass in small quarries, a central mullion, the oculus with a gold quatrefoil
    vec2 oc=vec2(cx, ys-0.86*hw);
    float R=0.52*hw;
    vec2 q=(p-oc)/R;
    float r=length(q), a=atan(q.y,q.x);
    float foil=0.6+0.2*cos(4.0*a);
    float dRing=abs(r-1.0)*R-3.4*S;
    float dInner=abs(r-0.8)*R-1.6*S;
    float dFoil=abs(r-foil)*R-2.0*S;
    float dSpoke=(min(abs(q.x),abs(q.y))*R-1.6*S)+1e3*step(foil,r);
    float dMull=(abs(p.x-cx)-4.2*S)+1e3*step(r,1.0);
    float dPale=quarry(vec2((p.x-cx)/hw*0.5+0.5, (p.y-(ys-1.75*hw))/(1.75*hw)), vec2(3.0,6.0))*hw-1.3*S;
    if(r<1.0){
      lead=min(min(dRing,dFoil),dSpoke);
      if(r>foil) lead=min(lead, dInner);
    } else lead=min(min(dRing,dMull),dPale+1e3*step(r,1.12));
    lead=min(lead, abs(p.y-ys)-4.6*S);                                // transom at the spring line
    if(r<foil){ gc=lin(vec3(1.0,0.78,0.3))*(0.62+0.6*th)*(0.85+0.3*rip); cls=0.66; }
    else if(r<1.0){ gc=vec3(0.62,0.62,0.6)*(0.7+0.5*th)*(r<0.8?1.0:0.85); cls=1.0; }
    else { gc=lin(mix(vec3(0.96,0.9,0.74),vec3(0.84,0.88,0.9),vnoise(gp*0.02)))*(0.55+0.55*th)*(0.9+0.2*vnoise(gp*vec2(0.01,0.07))); cls=0.33; }
  }
  // the glass darkens into the came (putty, thickness), the reveal shades the glass edge
  gc*=0.6+0.4*smoothstep(0.0,10.0*S,lead);
  gc*=1.0-0.35*smoothstep(-16.0*S,0.0,dIn);
  float lw=smoothstep(0.8*uPx,-0.8*uPx,lead);
  // lead came: rounded, dark, with a soft highlight on the side facing the room light
  float prof=clamp(-lead/(2.4*S),0.0,1.0);
  vec3 leadC=lin(vec3(0.075,0.072,0.07))*(0.55+0.7*prof)+vec3(0.012)*pow(prof,6.0);
  leadC*=0.85+0.3*vnoise(gp*0.4);
  o.c=mix(gc*0.5, leadC, lw);
  o.cover=(1.0-lw)*smoothstep(0.8*uPx,-0.8*uPx,dIn);
  o.cls=cls; o.rip=rip; o.lead=lead;
  return o;
}
`;
export const WINDOW0 = `${COMMON}${WINDOW_BODY}
void main(){ vec2 p=vec2(gl_FragCoord.x, uRes.y-gl_FragCoord.y); G o=shade(p); gl_FragColor=vec4(o.c, o.cover); }`;
export const WINDOW1 = `${COMMON}${WINDOW_BODY}
void main(){ vec2 p=vec2(gl_FragCoord.x, uRes.y-gl_FragCoord.y); G o=shade(p); gl_FragColor=vec4(o.rip, o.rec, o.win, o.cls); }`;

// the light that falls through the picked pane: a sheared projection of the pane, its lead lattice as soft shadow,
// per-piece and hammered-glass caustics, a passing cloud, and the colour wave that travels away from the window.
// Works in css px so the scene and the overlay (different resolutions) agree exactly.
export const POOL = `
uniform vec2 uPO; uniform mat2 uPInv;            // pool origin, inverse of [U V] (css px)
uniform vec3 uPTo, uPFrom; uniform float uWave; uniform vec2 uWaveO, uWaveD;
uniform float uPI, uCloud, uTime; uniform vec3 uWarm;
uniform sampler2D uNoise;
vec3 pool(vec2 c, out float mask, out float s){
  vec2 uv=uPInv*(c-uPO);
  s=dot(c-uWaveO, uWaveD);
  float sc=clamp(s,0.0,1.0);
  float pen=0.006+0.022*sc;
  vec2 e=smoothstep(-pen,pen,uv)*smoothstep(1.0+pen,1.0-pen,uv);
  float m=e.x*e.y;
  mask=m;
  if(m<=0.0) return vec3(0.0);
  float bw=0.085;
  vec2 d2=min(uv,1.0-uv); float dEdge=min(d2.x,d2.y);
  vec2 iuv=(uv-bw)/(1.0-2.0*bw);
  float dq=quarry(iuv, vec2(2.0,3.0))*(1.0-2.0*bw);
  float d=abs(dEdge-bw);
  if(dEdge>bw) d=min(d,dq);
  float lw=0.0045;
  float sh=1.0-smoothstep(lw-pen*0.6, lw+pen*1.1, d);
  // the pane's own bars at the very edge also shade
  sh=max(sh, 1.0-smoothstep(0.0, 0.012+pen, dEdge));
  vec2 cell=qcell(iuv, vec2(2.0,3.0));
  float pv=dEdge>bw ? 0.86+0.26*hash12(cell+17.0) : 0.8;
  float caus=0.72+0.56*texture2D(uNoise, uv*vec2(1.3,1.9)+0.37).r;
  caus*=0.88+0.24*texture2D(uNoise, uv*vec2(5.0,7.0)+0.11).g;
  vec2 k=(uv-vec2(0.42,0.46))*vec2(1.15,1.0);
  float core=0.5+0.62*exp(-dot(k,k)*2.4);
  float cl=texture2D(uNoise, c/1400.0+uTime*vec2(0.0045,0.0016)).b;
  float cloud=1.0-uCloud*smoothstep(0.35,0.75,cl);
  float w=smoothstep(uWave-0.16, uWave+0.02, s);               // 1 where the new light has not arrived yet
  vec3 col=mix(uPTo, uPFrom, w);
  col+=uPTo*0.55*exp(-pow((s-uWave+0.05)/0.07,2.0))*step(uWave,1.25)*step(-0.2,uWave);   // the bright leading edge
  return col*uWarm*m*(1.0-0.86*sh)*pv*caus*core*cloud*uPI;
}
`;

export const COMP = `${COMMON}${POOL}
uniform vec2 uRes; uniform float uDpr; uniform vec2 uScroll;
uniform sampler2D uStone; uniform vec2 uDoc;
uniform sampler2D uW0, uW1; uniform vec2 uWOrg, uWSize;   // window box (canvas px, y down)
uniform vec4 uWin; uniform float uRh, uF;                 // canvas px
uniform vec3 uCol[6]; uniform float uInt[6]; uniform float uA[6];
uniform vec3 uLight;                                      // the light leaving the window now (Σ a·colour)
uniform vec3 uGlint;                                      // pane, sweep position, amplitude
uniform vec2 uSS, uSE; uniform float uSW, uEW;            // beam: start, end (css px), half widths
uniform vec3 uBeamC; uniform float uDust, uPoolK, uExpo;
void main(){
  vec2 p=vec2(gl_FragCoord.x, uRes.y-gl_FragCoord.y);
  vec2 c=p/uDpr;
  vec2 suv=(c+uScroll)/uDoc;
  vec4 S=texture2D(uStone, vec2(suv.x, 1.0-suv.y));
  vec3 alb=S.rgb*S.rgb; float rel=S.a*1.6;
  // the room: dim, brighter toward the window
  vec2 wc=vec2(uWin.x, (uWin.y+uWin.w)*0.5)/uDpr;
  float vig=smoothstep(1.5,0.05,length((c-wc)/max(uRes.x,uRes.y)*uDpr*vec2(0.9,1.1)));
  vec3 col=alb*(0.075+0.16*vig);
  float dIn=sdArch(p,uWin.x,uWin.y,uWin.z,uWin.w);
  float dO=max(dIn-uF,0.0)/uDpr;
  col*=1.0-0.45*exp(-dO/22.0);                                      // the recess and sill shade the wall
  float Ls=max(max(uLight.r,uLight.g),uLight.b);
  col+=uLight*alb*(1.25*exp(-dO/34.0)+0.22*exp(-dO/120.0)+0.025*exp(-dO/420.0));   // glass light spilling on the stone
  // the pool on the stone (relief shows in the light)
  float pm, ps; vec3 L=pool(c, pm, ps);
  col+=alb*rel*L*uPoolK;
  // the beam through the room, with rays, and dust motes catching it
  vec2 bd=uSE-uSS; float bl=length(bd); vec2 dir=bd/max(bl,1.0); vec2 nr=vec2(-dir.y,dir.x);
  vec2 r=c-uSS; float t=dot(r,dir)/max(bl,1.0); float ac=dot(r,nr);
  float bw=mix(uSW,uEW,clamp(t,0.0,1.0));
  float beam=smoothstep(bw,bw*0.25,abs(ac))*smoothstep(0.0,0.22,t)*smoothstep(1.3,0.55,t);
  beam*=0.45+0.8*texture2D(uNoise, vec2(ac/bw*0.22+0.5, t*0.18+uTime*0.003)).a;
  float win=0.0;
  vec2 wl=(p-uWOrg)/uWSize;
  vec4 A=vec4(0.0), B=vec4(0.0);
  if(wl.x>0.0&&wl.y>0.0&&wl.x<1.0&&wl.y<1.0){ A=texture2D(uW0, vec2(wl.x,1.0-wl.y)); B=texture2D(uW1, vec2(wl.x,1.0-wl.y)); win=B.b; }
  col+=uBeamC*beam*(1.0-win)*0.1;
  if(uDust>0.0){
    vec2 dp=c*0.085+vec2(uTime*0.32, -uTime*0.2);
    vec2 cell=floor(dp); vec2 o=hash22(cell); float h=hash12(cell+3.1);
    vec2 f=fract(dp)-(0.2+0.6*o);
    float sz=0.05+0.08*hash12(cell+9.0);
    float mote=step(0.955,h)*smoothstep(sz,0.0,length(f))*(0.45+0.55*sin(uTime*1.3+h*40.0));
    col+=mix(uBeamC,vec3(1.0),0.5)*mote*(beam*2.2+pm*0.25)*uDust*(1.0-win);
  }
  // the window
  if(win>0.0){
    vec3 base=A.rgb;
    vec3 g=base*2.0;
    float cls=B.a;
    vec3 gcol;
    if(p.y>=uWin.y && (cls<0.15 || cls>0.5&&cls<0.85)){
      float cl=p.x<uWin.x?0.0:1.0;
      float row=clamp(floor((p.y-uWin.y)/uRh),0.0,2.0);
      float idx=row*2.0+cl;
      vec2 puv=vec2((p.x-(uWin.x-uWin.z+cl*uWin.z))/uWin.z, (p.y-uWin.y-row*uRh)/uRh);
      float I=0.0, a=0.0; vec3 pc=vec3(0.0);
      for(int k=0;k<6;k++){ if(abs(float(k)-idx)<0.5){ I=uInt[k]; a=uA[k]; pc=uCol[k]; } }
      if(cls>0.5) I=0.35+0.9*I;                                     // gold corner squares
      vec2 dd=(puv-vec2(0.46,0.42))*vec2(1.0,1.15);
      float hot=a*(1.1*exp(-dot(dd,dd)*7.0)+0.25*exp(-dot(dd,dd)*1.6))*(0.45+1.1*B.r);
      gcol=g*I+mix(pc,vec3(1.0),0.6)*hot*g*3.2;
      if(abs(idx-uGlint.x)<0.5){
        float gx=(puv.x*0.8+puv.y)*0.55;
        gcol+=mix(pc,vec3(1.0),0.75)*exp(-pow((gx-uGlint.y)/0.045,2.0))*uGlint.z*(0.35+1.2*B.r)*1.4;
      }
    } else if(cls<0.5){ gcol=g*(0.045+0.08*Ls)+g*uLight*0.1; }    // pale arch glass
    else if(cls<0.85){ gcol=g*(0.38+0.4*Ls); }                    // gold quatrefoil
    else { gcol=g*uLight*1.25+g*0.06; }                             // the oculus ring takes the picked colour
    vec3 wcol=mix(base, gcol, A.a);
    wcol+=uLight*B.g*alb*3.2;                                         // the reveal glows with the glass light
    wcol+=vec3(0.006)*B.r*A.a;
    col=mix(col, wcol, win);
  }
  // veiling glare: the lit panes bloom over their lead and frame
  vec2 wb=uWSize*0.5;
  if(abs(p.x-uWin.x)<uWin.z+uF+160.0*uDpr && p.y>uWin.y-uWin.z*2.0-uF && p.y<uWin.w+uF+160.0*uDpr){
    vec3 bl=vec3(0.0);
    for(int k=0;k<6;k++){
      if(uA[k]>0.002){
        float cl=mod(float(k),2.0), row=floor(float(k)/2.0);
        vec2 ce=vec2(uWin.x-uWin.z*0.5+cl*uWin.z, uWin.y+uRh*(row+0.5));
        float d=max(sdBox(p-ce, vec2(uWin.z*0.5,uRh*0.5)),0.0)/uDpr;
        bl+=uCol[k]*uA[k]*(0.16*exp(-d/10.0)+0.07*exp(-d/55.0));
      }
    }
    col+=bl;
  }
  col=1.0-exp(-col*uExpo);
  col=pow(col, vec3(1.0/2.2));
  col+=(hash12(gl_FragCoord.xy)-0.5)*0.007;
  gl_FragColor=vec4(col,1.0);
}`;

// light over the DOM (screen blend): only the pool, nothing else
export const OVER = `${COMMON}${POOL}
uniform vec2 uRes; uniform float uPx; uniform float uOverK;
void main(){
  vec2 c=vec2(gl_FragCoord.x, uRes.y-gl_FragCoord.y)/uPx;
  float m, s; vec3 L=pool(c, m, s);
  vec3 o=1.0-exp(-L*uOverK);
  o+=(hash12(gl_FragCoord.xy)-0.5)*0.006*m;
  gl_FragColor=vec4(max(o,0.0),1.0);
}`;
