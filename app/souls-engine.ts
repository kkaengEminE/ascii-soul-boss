// World-space articulated meshes, perspective projection and an ASCII z-buffer.
type V = [number, number, number];
type Hud = { hp:number; stamina:number; boss:number; locked:boolean; message:string; action:string };
export type GameHandle = { dispose():void; reset():void; model(n:number):void; combat(on:boolean):void; input(code:string,down:boolean):void };
const add=(a:V,b:V):V=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const sub=(a:V,b:V):V=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const mul=(a:V,s:number):V=>[a[0]*s,a[1]*s,a[2]*s];
const dot=(a:V,b:V)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a:V,b:V):V=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=(a:V):V=>mul(a,1/(Math.hypot(...a)||1));
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const ease=(t:number)=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const angle=(a:number,b:number)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
const rotate=(v:V,a:number):V=>[v[0]*Math.cos(a)+v[2]*Math.sin(a),v[1],-v[0]*Math.sin(a)+v[2]*Math.cos(a)];
const palette=[[133,163,173],[198,169,115],[115,57,53],[227,220,183],[49,62,70],[248,175,79],[93,120,138],[128,95,155],[255,96,71]];

export function createGame(canvas:HTMLCanvasElement, publish:(hud:Hud)=>void):GameHandle {
  const ctx=canvas.getContext("2d"); if(!ctx) throw new Error("Canvas 2D unavailable");
  let width=1000,height=650,cols=156,rows=78,cell=7;
  let zbuf=new Float32Array(cols*rows),glyph=new Uint8Array(cols*rows),colors=new Uint8Array(cols*rows),lights=new Uint8Array(cols*rows);
  const keys=new Set<string>(); let raf=0,last=0,ui=0,clock=0;
  let p:V=[0,0,7],yaw=Math.PI,cam:V=[0,4.1,12.7],camYaw=Math.PI,locked=true;
  let hp=100,stamina=100,boss=100,variant=0,retaliate=false,message="보스에게 다가가 검을 휘둘러 보세요";
  let action="idle",age=0,combo=0,queued=false,connected=false,regen=0,walk=0,velocity=0;
  let rollDir:V=[0,0,-1],enemyAge=0,enemyState="idle",enemyCooldown=2,enemyYaw=0,enemyHit=false,flash=0,shake=0;
  const reset=()=>{p=[0,0,7];yaw=Math.PI;cam=[0,4.1,12.7];camYaw=Math.PI;locked=true;hp=stamina=boss=100;action="idle";age=0;queued=false;combo=0;enemyState="idle";enemyAge=0;enemyYaw=0;enemyCooldown=2;flash=shake=0;keys.clear();message="정면 대치 · J 약공격 / K 강공격";};
  const startAttack=(heavy=false)=>{
    if(hp<=0||boss<=0)return;
    if(action==="light"&&age>.15&&!heavy){queued=true;return;}
    const cost=heavy?29:17;
    if(action!=="idle"||stamina<cost)return;
    action=heavy?"heavy":"light";age=0;connected=false;stamina-=cost;regen=1.05;
    if(locked)yaw=Math.atan2(-p[0],-p[2]);
  };
  function input(code:string,down:boolean){
    if(!down){keys.delete(code);return;} if(keys.has(code))return;keys.add(code);
    if(code==="KeyR")reset();
    if(code==="KeyQ")locked=!locked;
    if(code==="KeyJ")startAttack();if(code==="KeyK")startAttack(true);
    if(code==="Space"&&hp>0&&action==="idle"&&stamina>=25){
      const x=Number(keys.has("KeyD"))-Number(keys.has("KeyA")),z=Number(keys.has("KeyW"))-Number(keys.has("KeyS"));
      rollDir=unit(rotate([-x,0,z||(!x?-1:0)],camYaw)); action="roll";age=0;stamina-=25;regen=1.15;
    }
  }
  const kd=(e:KeyboardEvent)=>{if((e.target as HTMLElement)?.closest("input,textarea"))return;if(["KeyW","KeyA","KeyS","KeyD","KeyJ","KeyK","KeyQ","KeyR","Space"].includes(e.code)){e.preventDefault();input(e.code,true);}};
  const ku=(e:KeyboardEvent)=>input(e.code,false);const blur=()=>keys.clear();
  window.addEventListener("keydown",kd);window.addEventListener("keyup",ku);window.addEventListener("blur",blur);
  const resize=()=>{const r=canvas.getBoundingClientRect();width=r.width;height=r.height;const dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);cols=width<600?110:160;cell=width/cols;rows=Math.ceil(height/(cell*1.65));zbuf=new Float32Array(cols*rows);glyph=new Uint8Array(cols*rows);colors=new Uint8Array(cols*rows);lights=new Uint8Array(cols*rows);};
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
  let right:V=[1,0,0],up:V=[0,1,0],forward:V=[0,0,-1];
  const project=(v:V):V=>{const d=sub(v,cam),z=dot(d,forward);return [cols*.5+dot(d,right)*cols*.62/z,rows*.48-dot(d,up)*cols*.62/z/1.65,z];};
  function pixel(x:number,y:number,z:number,g:number,c:number,l:number){x=Math.round(x);y=Math.round(y);if(x<0||x>=cols||y<0||y>=rows||z<.1)return;const i=y*cols+x;if(z>=zbuf[i])return;zbuf[i]=z;glyph[i]=g;colors[i]=c;lights[i]=l;}
  function triangle(a:V,b:V,c:V,color:number){
    const n=unit(cross(sub(b,a),sub(c,a))),light=clamp(.38+Math.abs(dot(n,unit([-.5,1,.7])))*.62,.2,1);
    const A=project(a),B=project(b),C=project(c);if(Math.min(A[2],B[2],C[2])<.2)return;
    const area=(B[1]-C[1])*(A[0]-C[0])+(C[0]-B[0])*(A[1]-C[1]);if(Math.abs(area)<.001)return;
    for(let y=Math.max(0,Math.floor(Math.min(A[1],B[1],C[1])));y<=Math.min(rows-1,Math.ceil(Math.max(A[1],B[1],C[1])));y++)for(let x=Math.max(0,Math.floor(Math.min(A[0],B[0],C[0])));x<=Math.min(cols-1,Math.ceil(Math.max(A[0],B[0],C[0])));x++){
      const u=((B[1]-C[1])*(x-C[0])+(C[0]-B[0])*(y-C[1]))/area,v=((C[1]-A[1])*(x-C[0])+(A[0]-C[0])*(y-C[1]))/area,w=1-u-v;
      if(u>=0&&v>=0&&w>=0)pixel(x,y,1/(u/A[2]+v/B[2]+w/C[2]),Math.round(light*4)+1,color,Math.round(light*7));
    }
  }
  function line(a:V,b:V,c:number,g=2){const A=project(a),B=project(b);if(Math.min(A[2],B[2])<.2)return;const steps=Math.min(500,Math.ceil(Math.max(Math.abs(A[0]-B[0]),Math.abs(A[1]-B[1]))));for(let i=0;i<=steps;i++){const t=i/(steps||1);pixel(A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t,1/((1-t)/A[2]+t/B[2]),g,c,4);}}
  function actor(pos:V,heading:number,scale:number,isBoss:boolean){
    const rolling=!isBoss&&action==="roll",attacking=isBoss?enemyState==="attack":action==="light"||action==="heavy";
    const t=isBoss?enemyAge:age,heavy=isBoss||action==="heavy",wind=heavy?.58:.22,active=heavy?.26:.18;
    const reverse=!isBoss&&!heavy&&combo===1?-1:1;
    const swing=attacking?(t<wind?.24+(-1.65*reverse-.24)*ease(t/wind):t<wind+active?reverse*(-1.65+3.3*ease((t-wind)/active)):1.65*reverse+(.24-1.65*reverse)*ease((t-wind-active)/.3)):.24;
    const gait=isBoss?0:Math.sin(walk)*velocity*.55;
    const recoil=isBoss&&flash>0?Math.sin(flash*35)*.12:0;
    function world(v:V):V{let local=v;if(rolling){const a=age/.62*Math.PI*2;local=[v[0],(v[1]-1)*Math.cos(a)-v[2]*Math.sin(a)+.85,(v[1]-1)*Math.sin(a)+v[2]*Math.cos(a)];}return add(pos,rotate(mul([local[0],local[1]+(isBoss?recoil:Math.abs(gait)*.055),local[2]],scale),heading));}
    function box(center:V,size:V,color:number){const pts:V[]=[];for(let i=0;i<8;i++)pts.push(world([center[0]+size[0]*(i&1?.5:-.5),center[1]+size[1]*(i&2?.5:-.5),center[2]+size[2]*(i&4?.5:-.5)]));for(const [a,b,c,d] of [[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]]){triangle(pts[a],pts[b],pts[c],color);triangle(pts[a],pts[c],pts[d],color);}}
    function bone(a:V,b:V,r:number,color:number){const d=unit(sub(b,a)),u=mul(unit(cross(d,Math.abs(d[1])>.9?[1,0,0]:[0,1,0])),r),v=mul(unit(cross(d,u)),r);const ring=(p:V)=>[add(add(p,u),v),add(sub(p,u),v),sub(sub(p,u),v),add(sub(p,v),u)];const A=ring(a).map(world),B=ring(b).map(world);for(let i=0;i<4;i++){const j=(i+1)%4;triangle(A[i],A[j],B[j],color);triangle(A[i],B[j],B[i],color);}triangle(B[0],B[1],B[2],color);triangle(B[0],B[2],B[3],color);}
    const armor=isBoss?(enemyState==="attack"&&t<wind?8:variant===2?7:0):6;
    const broad=isBoss&&variant===1?1.22:1;
    // Separate articulated greaves, knees, cuirass, shoulders and helmet.
    for(const side of [-1,1]){const stride=gait*side;bone([side*.25,.92,0],[side*.29,.49,stride*.36],.13,4);bone([side*.29,.49,stride*.36],[side*.32,.12,stride],.14,armor);box([side*.32,.08,stride+.08],[.3,.16,.46],4);box([side*.29,.5,stride*.36+.12],[.22,.19,.13],1);}
    box([0,1.22,0],[.79*broad,.63,.43],armor);box([0,.92,0],[.72,.15,.47],1);
    box([0,1.65,0],[.24,.14,.23],4);box([0,1.92,0],[.47,.48,.42],1);
    box([0,1.93,.22],[.37,.105,.045],4);box([-.105,1.95,.25],[.055,.04,.03],5);box([.105,1.95,.25],[.055,.04,.03],5);box([0,1.79,.235],[.075,.18,.06],3);
    if(isBoss&&variant===2){bone([-.19,2.1,0],[-.38,2.47,0],.055,1);bone([.19,2.1,0],[.38,2.47,0],.055,1);}
    const shoulder:V=[.52*broad,1.5,0];
    const hand:V=attacking?[.48+Math.sin(swing)*.6,1.2+(heavy?.45:.1),.3+Math.cos(swing)*.42]:[.65, .94,.18];
    bone(shoulder,[.72,1.19,hand[2]*.4],.15,armor);bone([.72,1.19,hand[2]*.4],hand,.12,armor);
    box([-.53*broad,1.5,0],[.4,.28,.49],armor);box(shoulder,[.4,.28,.49],armor);
    bone([-.54*broad,1.45,0],[-.66,1.02,.17],.14,armor);
    box([-.7,1.04,.3],[isBoss&&variant===1?.65:.38,isBoss&&variant===1?1.05:.56,.12],armor);box([-.7,1.04,.375],[.07,.45,.025],1);
    const tip:V=attacking?add(hand,[Math.sin(swing)*1.25,heavy?.85*(1-ease((t-wind)/active))-.3:.12,Math.cos(swing)*1.25]):add(hand,[.12,-.77,.31]);
    bone(hand,tip,.045,3);bone(add(hand,[-.19,0,0]),add(hand,[.19,0,0]),.035,1);
    // Cape is a real rear-facing surface, not a screen-space overlay.
    const sway=Math.sin(clock*3)*.065+gait*.13;
    const cape=[world([-.36,1.57,-.26]),world([.36,1.57,-.26]),world([.5+sway,.45,-.42]),world([-.5+sway,.45,-.42])];triangle(cape[0],cape[2],cape[1],2);triangle(cape[0],cape[3],cape[2],2);
    for(const x of [-.2,0,.2])line(world([x,1.5,-.275]),world([x+sway,.49,-.44]),2,2);
    if(attacking&&t>wind&&t<wind+active){for(let k=1;k<=4;k++){const a=swing-k*.16;line(world(add(hand,[Math.sin(a)*.8,.12,Math.cos(a)*.8])),world(add(hand,[Math.sin(a)*1.35,.12,Math.cos(a)*1.35])),3,7);}}
  }
  function update(dt:number){
    clock+=dt;age+=dt;flash=Math.max(0,flash-dt);shake=Math.max(0,shake-dt);regen-=dt;
    const x=Number(keys.has("KeyD"))-Number(keys.has("KeyA")),z=Number(keys.has("KeyW"))-Number(keys.has("KeyS"));
    const move=rotate(unit([-x,0,z]),camYaw);velocity+=(Number(!!(x||z)&&action==="idle"&&hp>0)-velocity)*Math.min(1,dt*12);walk+=dt*9*velocity;
    if(hp>0){
      if(action==="roll"){p=add(p,mul(rollDir,dt*7.7*(1-age/.8)));if(age>.62)action="idle";}
      else {const attacking=action==="light"||action==="heavy";p=add(p,mul(move,dt*(attacking?.65:2.9)));if(x||z){const desired=locked?Math.atan2(-p[0],-p[2]):Math.atan2(move[0],move[2]);yaw+=angle(yaw,desired)*Math.min(1,dt*14);}if(attacking){
        const heavy=action==="heavy",wind=heavy?.58:.22,duration=heavy?1.12:.68;
        if(age>wind&&age<wind+.13)p=add(p,mul(rotate([0,0,1],yaw),dt*(heavy?3:2)));
        if(age>=wind+.07&&!connected){connected=true;const toward=Math.atan2(-p[0],-p[2]);if(Math.hypot(p[0],p[2])<3.4&&Math.abs(angle(yaw,toward))<.95&&boss>0){boss=Math.max(0,boss-(heavy?18:combo?10:8));flash=.22;shake=.1;message=boss<=0?"보스 격파 · R로 다시 시작":heavy?"강공격 적중":"베기 적중";}else message="검이 닿지 않았습니다 · 조금 더 가까이";}
        if(age>duration){action="idle";if(queued&&stamina>=17&&!heavy){combo=1-combo;queued=false;startAttack();}else{queued=false;combo=0;}}
      }else if(action==="hurt"&&age>.45)action="idle";}
    }
    const dist=Math.hypot(p[0],p[2]);if(dist<2.25)p=mul(unit([p[0]||.01,0,p[2]||1]),2.25);if(dist>11)p=mul(p,11/dist);
    if(regen<=0&&action==="idle")stamina=Math.min(100,stamina+dt*22);
    enemyCooldown-=dt;
    if(retaliate&&boss>0&&hp>0){
      if(enemyState==="idle"&&enemyCooldown<=0&&dist<4.7){enemyState="attack";enemyAge=0;enemyHit=false;enemyYaw=Math.atan2(p[0],p[2]);message="보스가 검을 듭니다 · 회피 준비";}
      if(enemyState==="attack"){enemyAge+=dt;if(enemyAge>.76&&!enemyHit){enemyHit=true;const invincible=action==="roll"&&age>.06&&age<.43;if(dist<4.3&&Math.abs(angle(enemyYaw,Math.atan2(p[0],p[2])))<1.15&&!invincible){hp=Math.max(0,hp-22);action="hurt";age=0;queued=false;shake=.2;message=hp<=0?"YOU DIED · R로 다시 시작":"피격 · 붉은 준비 동작 뒤에 회피하세요";}else message="회피 성공 · 반격할 틈입니다";}if(enemyAge>1.5){enemyState="idle";enemyCooldown=1.6;}}
    }
    if(locked)camYaw+=angle(camYaw,Math.atan2(-p[0],-p[2]))*(1-Math.exp(-dt*4.7));
    const desired=add(p,rotate([-.85,3.2,-6.4],camYaw));cam=add(cam,mul(sub(desired,cam),1-Math.exp(-dt*7)));
    const target=locked?add(mul(p,.38),[0,1.05,0]):add(p,add(rotate([0,0,4],camYaw),[0,1.05,0]));
    forward=unit(sub(target,cam));right=unit(cross(forward,[0,1,0]));up=unit(cross(right,forward));
  }
  function draw(){
    zbuf.fill(Infinity);glyph.fill(0);colors.fill(0);lights.fill(0);
    // Sparse world-space floor marks make translation and orbit readable.
    for(let x=-14;x<=14;x+=1)for(let z=-14;z<=14;z+=1){if(Math.hypot(x,z)>14)continue;const P=project([x,-.03,z]);pixel(P[0],P[1],P[2],1,4,2);}
    for(const radius of [4.6,10])for(let i=0;i<100;i++){const a=i/100*Math.PI*2,b=(i+1)/100*Math.PI*2;line([Math.sin(a)*radius,-.02,Math.cos(a)*radius],[Math.sin(b)*radius,-.02,Math.cos(b)*radius],4,1);}
    for(let i=0;i<12;i++){const a=i/12*Math.PI*2,x=Math.sin(a)*13,z=Math.cos(a)*13;for(const dx of [-.35,.35])line([x+dx,0,z],[x+dx,4,z],4,2);line([x-.35,4,z],[x+.35,4,z],4,2);}
    actor([0,boss<=0?-.85:0,0],enemyYaw,1.65,true);
    actor(p,yaw,1,false);
    if(locked&&boss>0){const P=project([0,2.25,0]);pixel(P[0],P[1],.1,8,3,7);}
    ctx!.fillStyle="#0b100f";ctx!.fillRect(0,0,width,height);ctx!.font=`bold ${cell*1.58}px "Courier New", monospace`;ctx!.textAlign="center";ctx!.textBaseline="middle";
    const chars=" .:ox#@/o";const offset=shake>0?Math.sin(clock*90)*2:0;
    const css=palette.map(c=>Array.from({length:8},(_,l)=>`rgb(${c.map(v=>Math.round(v*(.6+l*.085))).join(",")})`));
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const i=y*cols+x;if(!glyph[i])continue;ctx!.fillStyle=css[colors[i]][lights[i]];ctx!.fillText(chars[glyph[i]],(x+.5)*cell+offset,(y+.5)*cell*1.65);}
  }
  const loop=(now:number)=>{const dt=Math.min(.035,(now-last)/1000||.016);last=now;update(dt);draw();if(now-ui>80){ui=now;publish({hp,stamina,boss,locked,message,action:action==="idle"?(velocity>.2?"선회 / 이동":"대기"):action==="roll"?"회피":action==="hurt"?"피격":age<(action==="heavy"?.58:.22)?"공격 준비":age<(action==="heavy"?.84:.4)?"베기":"회복"});}raf=requestAnimationFrame(loop);};raf=requestAnimationFrame(loop);
  return {reset,model(n){variant=n;reset();},combat(on){retaliate=on;enemyState="idle";enemyCooldown=1.5;message=on?"보스 반격 활성화":"연습 모드 · 보스가 공격하지 않습니다";},input,dispose(){cancelAnimationFrame(raf);observer.disconnect();window.removeEventListener("keydown",kd);window.removeEventListener("keyup",ku);window.removeEventListener("blur",blur);}};
}
