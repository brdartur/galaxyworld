import { solarPlasma } from './solarAppearance';
import { smooth, surfaceMission, type ActivitySettings } from "./activitySettings";

const TAU = Math.PI * 2;
type Ctx = CanvasRenderingContext2D;
function line(c: Ctx, pts: number[], color: string, width = 2) {
  c.strokeStyle = color; c.lineWidth = width; c.lineCap = "round";
  c.beginPath(); c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.stroke();
}
function disc(c: Ctx, x: number, y: number, r: number, color: string) {
  c.fillStyle = color; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
}
function caption(c: Ctx, text: string, x: number, y: number) {
  c.font = '600 10px "JetBrains Mono", monospace'; c.textAlign = "center";
  const w = c.measureText(text).width + 16;
  c.fillStyle = "rgba(4,12,24,.85)"; c.fillRect(x - w / 2, y - 11, w, 17);
  c.fillStyle = "#98f5e3"; c.fillText(text, x, y);
}


function metal(c: Ctx, x: number, y: number, w: number, h: number, dark = false) {
  const g = c.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, dark ? '#777f85' : '#e2e4df');
  g.addColorStop(.22, dark ? '#b1b4ad' : '#faf9ee');
  g.addColorStop(.5, dark ? '#505c65' : '#a7b0b2');
  g.addColorStop(1, '#28333d');
  c.fillStyle = g; c.fillRect(x, y, w, h);
}
function polygon(c: Ctx, points: number[], fill: string) {
  c.fillStyle = fill; c.beginPath(); c.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
  c.closePath(); c.fill();
}
function oval(c: Ctx, x: number, y: number, rx: number, ry: number, color: string) {
  c.fillStyle = color; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill();
}

/** Adult EVA proportions, layered fabric, pressure joints and reflective visor. Feet at origin. */
export function drawSuit(c: Ctx, t: number, walking = false, working = false, sample = false) {
  const stride = walking ? Math.sin(t * 6) * 4 : 0;
  c.save(); c.lineJoin = 'round';
  metal(c, -9, -34, 9, 19); // life support pack and thermal cover
  line(c, [-8, -32, -8, -18], '#dad9ce', 1);
  const limb = (pts: number[], width: number) => {
    line(c, pts, '#38434b', width + 1.4);
    line(c, pts, '#b6bdbb', width);
    line(c, pts.map((v,i)=>i%2===0?v-.6:v-.4), '#edece1', width * .42);
  };
  limb([-3,-17,-4+stride,-9,-5+stride,-2],4.7);
  limb([3,-17,4-stride,-9,5-stride,-2],4.7);
  for (const side of [-1,1]) {
    const x=side<0?-4+stride:4-stride;
    for(let i=0;i<3;i++) line(c,[x-2,-10+i,x+2,-10+i],'#646f76',.55);
    line(c,[x-2,-1,x+3,-1],'#424b50',3);
    line(c,[x-1,-2,x+3,-2],'#c6ccc6',1.5);
  }
  c.fillStyle='#c3c9c6'; c.beginPath(); c.roundRect(-6,-34,13,18,4);c.fill();
  metal(c,-4,-32,9,12);
  line(c,[-5,-18,6,-18],'#616c70',2);
  c.fillStyle='#d2d5c9';c.fillRect(-2,-31,7,6);
  c.fillStyle='#444e52';c.fillRect(-1,-30,2,2);c.fillRect(2,-30,2,2);
  for(let i=0;i<3;i++)disc(c,-1+i*2,-26,.55,i===0?'#b55643':'#7b8987');
  line(c,[-3,-24,-2,-20,4,-22,4,-24],'#8d968f',1);
  disc(c,0,-38,5.9,'#687479'); disc(c,-.4,-38.5,5.2,'#e6e5d9');
  const visor=c.createLinearGradient(-2,-42,4,-35);
  visor.addColorStop(0,'#e2c991');visor.addColorStop(.28,'#a17b3e');visor.addColorStop(.55,'#403c30');visor.addColorStop(1,'#111f2b');
  c.fillStyle=visor;c.beginPath();c.ellipse(1,-38,4.2,3.6,-.1,0,TAU);c.fill();
  line(c,[-1.7,-40.5,1,-41,3.3,-40],'#efe9c5',.7);
  disc(c,-4,-36,1.2,'#a1aaa4');
  const handY=working?-19+Math.sin(t*28)*.65:-20+stride*.6;
  limb([-6,-31,-9,-25,working?8:-10,working?handY:-18-stride*.6],3.8);
  limb([6,-31,10,-25,working?14:12,handY],3.8);
  line(c,[7,-29,10,-28],'#963d32',1.4);
  disc(c,working?14:12,handY,2,'#818f8e');
  if(sample){metal(c,12,-20,5,8);c.fillStyle='#776148';c.fillRect(13,-16,3,3);line(c,[12,-20,17,-20],'#eeeade',1.3);}
  c.restore();
}


function drawDrill(c: Ctx, t: number, active: boolean) {
  const shake=active?Math.sin(t*48)*.45:0;
  c.save();c.translate(14+shake,0);
  line(c,[-6,-20,6,-20],'#444f55',2.3);
  metal(c,-3.5,-24,7,14,true);
  for(let i=0;i<5;i++)line(c,[-3,-21+i*1.7,3,-21+i*1.7],'#b6bcb7',.6);
  c.fillStyle='#985044';c.fillRect(-3,-13,6,2);
  line(c,[-3,-12,-8,0,-12,0],'#8a979d',1.5);
  line(c,[3,-12,8,0,12,0],'#ced2cc',1.5);
  line(c,[0,-10,0,3+(active?Math.sin(t*35):0)],'#bac4c6',2.4);
  for(let i=0;i<5;i++){const y=-9+i*2.2+(active?(t*20)%2.2:0);line(c,[-2,y,2,y+1.8],'#515b61',1);}
  if(active){
    oval(c,0,1,4,1.4,'#35302b');
    for(let i=0;i<24;i++){
      const p=(t*1.7+i/24)%1,side=i%2?1:-1;
      c.globalAlpha=(1-p)*.38;
      disc(c,side*p*(9+i%7*2),-Math.sin(p*Math.PI)*(3+i%4*2),.4+i%3*.3,'#b1a18a');
    }
  }
  c.restore();
}


/** Transparent drawing over the same planet geometry used by both renderers. */
export function drawSurfaceExplorer(c: Ctx, radius: number, t: number, settings: ActivitySettings, artScale = 1) {
  const m = surfaceMission(t);
  if (!m.visible) return;
  c.save();
  c.translate(Math.sin(m.angle) * (radius + .5), -Math.cos(m.angle) * (radius + .5));
  c.rotate(m.angle);
  c.scale(artScale, artScale);
  const working = (m.drilling && settings.drilling) || (m.sampling && settings.research);
  drawSuit(c, t, m.walking, working, m.sampling && settings.research);
  if (settings.drilling && t >= 8 && t < 22) drawDrill(c, t, m.drilling);
  if (settings.research && m.sampling) {
    line(c, [13, -14, 18, -5, 21, -2], "#dae8f3", 2);
    disc(c, 21, -2, 2.5, "#b7864e");
  }
  if (settings.research && m.scanning) {
    c.fillStyle = "#4ddbc2"; c.fillRect(10, -17, 8, 5);
    c.strokeStyle = "rgba(73,243,218,.6)"; c.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const r = 6 + ((t * 12 + i * 9) % 28);
      c.beginPath(); c.arc(18, -14, r, -.35, .9); c.stroke();
    }
  }
  c.restore();
  let label = m.label;
  if ((m.drilling && !settings.drilling) || ((m.sampling || m.scanning) && !settings.research)) label = "ОСМОТР ПОВЕРХНОСТИ";
  caption(c, label, 0, radius + 24 * artScale);
}

export function drawRover(c: Ctx, radius: number, time: number, artScale = 1) {
  const phase=time%18;if(phase>16)return;
  c.save();c.globalAlpha=smooth(phase)*(1-smooth(phase-15));
  const angle=-.9+1.8*smooth(phase/15);
  c.translate(Math.sin(angle)*(radius+2*artScale),-Math.cos(angle)*(radius+2*artScale));c.rotate(angle);c.scale(artScale,artScale);
  // Six independently suspended, ribbed aluminium wheels, with the far row in shadow.
  const wheel=(x:number,y:number,far:boolean)=>{
    oval(c,x,y,5.3,5.6,far?'#20272b':'#485154');
    oval(c,x+1,y,3.5,4.5,far?'#3a4245':'#adb1a7');
    for(let j=0;j<10;j++){const a=j*TAU/10+time*3;line(c,[x+Math.cos(a)*4,y+Math.sin(a)*5,x+1+Math.cos(a)*3,y+Math.sin(a)*4],'#202a30',.7);}
    disc(c,x+1,y,1.4,'#56646b');
  };
  for(const x of [-17,0,17])wheel(x-3,-7,true);
  polygon(c,[-20,-23,12,-26,22,-19,-11,-16],'#bfc2b6');
  polygon(c,[-20,-23,-11,-16,-11,-8,-20,-15],'#5c625d');
  metal(c,-11,-16,33,8);
  for(let i=0;i<6;i++)line(c,[-9+i*5,-15,-9+i*5,-9],'#776e54',.65);
  // Thermal foil, deck instruments and radioisotope generator fins.
  polygon(c,[-16,-23,-5,-24,0,-19,-11,-18],'#918065');
  for(let i=0;i<7;i++)line(c,[-16+i*2,-23,-14+i*2,-19],i%2?'#b9a987':'#665e4b',.6);
  for(let i=0;i<6;i++)metal(c,-22+i*2,-26,1.2,10,true);
  line(c,[-14,-12,-6,-5,0,-8,9,-5,18,-12],'#414e57',2.6);
  line(c,[-14,-13,-6,-6,0,-9,9,-6,18,-13],'#c1c7c3',1.2);
  for(const x of [-17,0,17]){line(c,[x,-12,x,-3],'#949e9d',1.6);wheel(x,-3,false);}
  line(c,[7,-24,7,-39],'#3d4a53',3);line(c,[6.5,-24,6.5,-39],'#bfc7c3',1.3);
  metal(c,1,-43,14,6);
  for(const x of [4,12]){disc(c,x,-40,2.1,'#26353c');disc(c,x-.4,-40.5,.7,'#719ba7');}
  line(c,[-7,-24,-10,-34],'#9aa9af',1);oval(c,-10,-34,5,1.7,'#d1d2c2');
  const a=Math.sin(time*.7)*2;
  line(c,[20,-17,27,-23+a,34,-11],'#434f57',3.3);
  line(c,[20,-18,27,-24+a,34,-12],'#c8ccc2',1.5);
  for(const [x,y] of [[20,-17],[27,-23+a],[34,-11]])disc(c,x,y,2,'#6d797d');
  metal(c,31,-11,6,5,true);
  for(let i=0;i<10;i++){c.globalAlpha*=.84;line(c,[-25-i*3,1,-24-i*3,2],'#9c8b71',.65);}
  c.restore();
}


export function drawStation(c: Ctx, time: number, settings: ActivitySettings) {
  c.save();
  // ISS-inspired lattice truss, four photovoltaic wings and pressure modules.
  metal(c,-153,-3,306,7,true);
  for(let x=-150;x<150;x+=12){line(c,[x,-4,x+12,4,x+12,-4],'#9babae',.8);}
  for(const side of [-1,1]){
    for(const offset of [88,130]){
      const x=side*offset-16;
      metal(c,x-1,-65,34,128,true);
      for(const y of [-63,7]){
        const g=c.createLinearGradient(x,y,x+32,y+54);g.addColorStop(0,'#172735');g.addColorStop(.5,'#384450');g.addColorStop(1,'#101f31');
        c.fillStyle=g;c.fillRect(x,y,32,54);
        for(let col=0;col<4;col++)for(let row=0;row<12;row++){
          c.fillStyle=(col+row)%3===0?'#263951':'#1d2e47';c.fillRect(x+col*8+.5,y+row*4.5+.5,6.8,3.4);
        }
        for(let j=0;j<=4;j++)line(c,[x+j*8,y,x+j*8,y+54],'#b0a77c',.35);
        line(c,[x,y,x+32,y],'#d6cfa6',.8);
      }
    }
    // White thermal radiators, offset behind the central structure.
    for(let j=0;j<3;j++){
      const x=side*53+j*side*6;
      polygon(c,[x,-20,x+side*20,-37,x+side*20,16,x,31],'#9ca8aa');
      line(c,[x,-20,x+side*20,-37,x+side*20,16],'#d3d7cd',.7);
    }
  }
  const module=(x:number,y:number,w:number,h:number)=>{
    c.save();c.beginPath();c.roundRect(x,y,w,h,h*.24);c.clip();metal(c,x,y,w,h);
    for(let i=4;i<w;i+=8){line(c,[x+i,y+1,x+i,y+h-1],'#6d787c',.55);}
    line(c,[x+2,y+h*.28,x+w-2,y+h*.28],'#f1f0df',.7);
    c.restore();
    for(const bx of [x+3,x+w-4]){line(c,[bx,y+2,bx,y+h-2],'#444f55',1.5);}
  };
  module(-57,-18,52,29);module(3,-17,48,27);module(-8,-35,18,67);
  module(46,-13,20,20);metal(c,65,-9,5,12,true);
  polygon(c,[-52,11,-19,11,-13,28,-46,28],'#847657');
  for(let i=0;i<8;i++)line(c,[-49+i*4,12,-44+i*4,26],i%2?'#b2a382':'#625b49',.7);
  c.fillStyle='#c6cec6';c.fillRect(41,-25,15,10);
  oval(c,49,-25,6,2,'#414f58');
  disc(c,1,-5,5,'#3b474e');disc(c,1,-5,3,'#1c2b32');
  for(const x of [-40,-16,21,40])line(c,[x,-20,x+8,-20],'#babd9e',1);
  line(c,[-37,-18,-43,-38,-54,-45],'#bdc7c3',1.4);
  c.strokeStyle='#bbc4bf';c.lineWidth=1.3;c.beginPath();c.ellipse(-52,-46,10,4,.45,0,Math.PI);c.stroke();
  line(c,[-53,-44,-51,-51],'#dadbd1',.8);
  // Canadarm with articulated joints and wiring.
  line(c,[28,9,39,34,65,24,76,37],'#404d54',3);
  line(c,[28,9,39,34,65,24,76,37],'#c4c8bb',1.5);
  for(const [x,y] of [[28,9],[39,34],[65,24]])disc(c,x,y,2.3,'#7d8886');
  disc(c,64,6,1.1,Math.sin(time*2)>0?'#be5e48':'#493d36');
  caption(c,'ОРБИТАЛЬНАЯ СТАНЦИЯ',0,83);


  if (settings.stationCrew) {
    const t = time % 56;
    let x = 49 - smooth((t - 2) / 8) * 81, y = -20;
    let label = "ОСМОТР КОРПУСА", walking = t > 2 && t < 10, work = t >= 10 && t < 20 && settings.stationRepair;
    if (t >= 20 && t < 26) { x = -32 + smooth((t - 20) / 6) * 81; walking = true; }
    if (t >= 26 && t < 48 && settings.spacewalk) {
      const progress = t < 37 ? smooth((t - 26) / 11) : 1 - smooth((t - 37) / 11);
      x = 49 + progress * 55; y = -20 - progress * 66;
      label = t < 37 ? "ВЫХОД НА ТРОСЕ / СКАНИРОВАНИЕ" : "ВОЗВРАЩЕНИЕ НА БОРТ";
      c.strokeStyle = "#d0e9f5"; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(49, -24); c.quadraticCurveTo(x - 30, y + 23, x, y - 13); c.stroke();
      if (t > 31 && t < 38) {
        c.strokeStyle = "rgba(102,239,221,.55)";
        for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(x + 12, y - 15, 10 + ((t * 8 + i * 10) % 30), -.5, .5); c.stroke(); }
      }
    } else if (t >= 26 && t < 48) {
      x = 49 - Math.sin((t - 26) / 22 * Math.PI) * 25;
      walking = true;
    } else if (t >= 48) {
      x = 49; y = -20 + smooth((t - 48) / 6) * 18;
      label = "ВОЗВРАЩЕНИЕ В ШЛЮЗ";
    }
    if (work) label = "РЕМОНТ АНТЕННЫ";
    c.save(); c.translate(x, y); c.scale(work ? -.85 : .85, .85);
    c.globalAlpha *= smooth(t / 2) * (1 - smooth((t - 53) / 3));
    drawSuit(c, time, walking, work);
    if (work) {
      line(c, [12, -16, 23, -11 + Math.sin(time * 8) * 4], "#ffcd76", 2.6);
      disc(c,23,-11+Math.sin(time*8)*4,1.7,'#8e999d');


    }
    c.restore(); caption(c, label, 0, 100);
  }
  c.restore();
}

/** Irregular spot groups, fine magnetic filaments and diffuse limb eruptions. */
export function drawSolarActivity(c: Ctx, radius: number, t: number) {
  c.save();
  c.beginPath();c.arc(0,0,radius,0,TAU);c.clip();
  for(let i=0;i<4;i++){
    const a=t*.009+i*1.79,x=Math.sin(a)*radius*.78,y=Math.cos(i*2.1)*radius*.4;
    const foreshorten=Math.max(.15,Math.cos(a));if(Math.cos(a)<0)continue;
    c.save();c.translate(x,y);c.scale(foreshorten,1);c.rotate(i*1.7);
    // Fine, uneven penumbra surrounding a fragmented umbra.
    for(let j=0;j<30;j++){
      const b=j*2.399,r=radius*(.018+(j%7)*.004),xx=Math.cos(b)*r,yy=Math.sin(b)*r*.65;
      oval(c,xx,yy,radius*(.008+(j%3)*.005),radius*.009,'rgba(105,62,23,.16)');
    }
    for(let j=0;j<5;j++)oval(c,Math.sin(j*5)*radius*.022,Math.cos(j*3)*radius*.012,radius*(.01+j*.001),radius*.008,'rgba(67,44,22,.58)');
    const g=c.createRadialGradient(radius*.04,0,0,radius*.04,0,radius*.18);
    g.addColorStop(0,'rgba(255,239,183,.22)');g.addColorStop(1,'rgba(255,189,76,0)');
    c.fillStyle=g;c.fillRect(-radius*.16,-radius*.18,radius*.38,radius*.36);c.restore();
  }
  c.restore();c.save();c.globalCompositeOperation='lighter';
  for(let i=0;i<4;i++){
    const phase=(t/(18+i*5)+i*.23)%1,env=Math.pow(Math.sin(phase*Math.PI),2);
    c.save();c.rotate(i*2.13+.5);c.translate(radius*.99,0);
    // Many offset, translucent strands form one plasma structure, without a neon outline.
    for(let j=0;j<18;j++){
      const spread=j/17,h=radius*(.1+env*.23)*(1-spread*.3),w=radius*(.07+spread*.05);
      const g=c.createLinearGradient(0,0,h,0);
      g.addColorStop(0,'rgba(233,95,27,'+(env*.16)+')');g.addColorStop(.7,solarPlasma(env*.1));g.addColorStop(1,'rgba(255,183,91,0)');
      c.strokeStyle=g;c.lineWidth=.45+(j%3)*.25;c.beginPath();c.moveTo(-radius*.015,-w);
      c.bezierCurveTo(h*.8,-w*1.4,h*(1+.05*Math.sin(t*.3+j)),w*.8,-radius*.012,w*(.6+spread*.3));c.stroke();
    }
    const g=c.createRadialGradient(0,0,0,0,0,radius*.3);
    g.addColorStop(0,'rgba(250,144,56,'+(env*.12)+')');g.addColorStop(1,'rgba(250,144,56,0)');
    c.fillStyle=g;c.fillRect(-radius*.12,-radius*.3,radius*.42,radius*.6);
    c.restore();
  }
  c.restore();
}

/** Pressure hull and deployable legs; local +X is the nose, local -X the ground. */
export function drawLander(c: Ctx, time: number, engine: boolean, legs: boolean) {
  c.save();
  if(engine){
    const len=17+Math.sin(time*38)*1.5,g=c.createLinearGradient(-15,0,-15-len,0);
    g.addColorStop(0,'rgba(224,244,255,.95)');g.addColorStop(.22,'rgba(161,195,236,.65)');g.addColorStop(1,'rgba(217,145,88,0)');
    c.fillStyle=g;c.beginPath();c.moveTo(-14,-2.5);c.bezierCurveTo(-22,-3,-24,-1,-15-len,0);c.bezierCurveTo(-24,1,-22,3,-14,2.5);c.fill();
  }
  polygon(c,[-10,-3,-16,-4,-16,4,-10,3],'#4e5b62');
  for(let i=0;i<5;i++)line(c,[-12-i*.8,-3.2-i*.15,-12-i*.8,3.2+i*.15],'#89918d',.5);
  metal(c,-10,-6,13,12,true);
  c.save();c.beginPath();c.moveTo(1,-6);c.lineTo(14,-6);c.bezierCurveTo(19,-6,24,-2,25,0);c.bezierCurveTo(24,2,19,6,14,6);c.lineTo(1,6);c.closePath();c.clip();metal(c,1,-6,24,12);c.restore();
  for(const x of [-7,-1,4,14])line(c,[x,-5.5,x,5.5],'#586970',.5);
  line(c,[3,-4.5,17,-4.5],'#fbf7dc',.6);
  for(let i=0;i<7;i++){line(c,[-9+i*1.5,-5,-8+i*1.5,5],i%2?'#a19065':'#746b55',.7);}
  disc(c,11,0,3.9,'#606e74');disc(c,11,0,3,'#172d3a');
  line(c,[9,-1.8,11,-2.2,12,-1.8],'#a6c7cc',.6);
  for(let j=0;j<8;j++)disc(c,11+Math.cos(j*TAU/8)*3.5,Math.sin(j*TAU/8)*3.5,.3,'#e3e0c8');
  for(const side of [-1,1]){
    line(c,[-1,side*5,-9,side*(legs?11:6.5),-12,side*(legs?12:7)],'#414f55',2);
    line(c,[-1,side*5,-9,side*(legs?11:6.5),-12,side*(legs?12:7)],'#c4c9ba',.85);
    if(legs){line(c,[-7,side*5,-10,side*11],'#879493',.8);line(c,[-12,side*10,-12,side*14],'#afb7af',1.4);}
    metal(c,-5,side<0?-8:6,4,2,true);
  }
  c.restore();
}


export function drawMartianShip(c: Ctx, time: number) {
  c.save();
  const g=c.createLinearGradient(-20,0,-42,0);g.addColorStop(0,'rgba(220,238,255,.95)');g.addColorStop(.25,'rgba(127,167,218,.55)');g.addColorStop(1,'rgba(130,166,221,0)');
  c.fillStyle=g;c.beginPath();c.moveTo(-20,-3);c.bezierCurveTo(-30,-4,-37,-1,-43-Math.sin(time*27)*2,0);c.bezierCurveTo(-37,1,-30,4,-20,3);c.fill();
  polygon(c,[-14,-5,-21,-4,-21,4,-14,5],'#505d62');
  c.save();c.beginPath();c.moveTo(-17,-8);c.lineTo(9,-8);c.bezierCurveTo(16,-8,24,-4,25,0);c.bezierCurveTo(24,4,16,8,9,8);c.lineTo(-17,8);c.closePath();c.clip();metal(c,-17,-8,43,16);c.restore();
  for(const x of [-13,-8,13,18])line(c,[x,-6.5,x,6.5],'#606f72',.55);
  for(const side of [-1,1]){
    polygon(c,[-15,side*5,-19,side*12,-7,side*10,1,side*6],'#687778');
    line(c,[-18,side*11,-7,side*9],'#bac3bb',.7);
    metal(c,-14,side<0?-11:8,12,3,true);
    for(let j=0;j<5;j++)line(c,[-13+j*2,side*8,-13+j*2,side*10],'#697979',.5);
  }
  oval(c,2,0,8.8,7.3,'#747f7d');oval(c,2,0,7.7,6.3,'#10232c');
  c.save();c.beginPath();c.ellipse(2,0,7.2,5.9,0,0,TAU);c.clip();
  // Seated figure, shaded skin and moving hand behind the cockpit glass.
  oval(c,0,5,4,4,'#627471');
  const skin=c.createRadialGradient(-1,-2,0,0,0,4);skin.addColorStop(0,'#9eaf79');skin.addColorStop(1,'#425b46');
  c.fillStyle=skin;c.beginPath();c.ellipse(0,-1,3.2,4,0,0,TAU);c.fill();
  oval(c,-1.1,-1.2,.85,1.2,'#172323');oval(c,1.2,-1.2,.85,1.2,'#172323');
  line(c,[-.5,1.7,.7,1.7],'#324339',.5);
  const hx=5+Math.sin(time*5.5)*1.3,hy=-2.8;
  line(c,[2.3,4,4,1,hx,hy],'#849c74',1.6);oval(c,hx,hy,1,1.4,'#a5b58c');
  for(let i=0;i<3;i++)line(c,[hx-.7+i*.6,hy,hx-.9+i*.7,hy-2],'#a5b58c',.45);
  c.restore();
  c.strokeStyle='rgba(203,222,213,.5)';c.lineWidth=.6;c.beginPath();c.ellipse(1,-1,6.8,4.9,-.12,Math.PI*1.1,Math.PI*1.75);c.stroke();
  for(let j=0;j<12;j++)disc(c,2+Math.cos(j*TAU/12)*8.2,Math.sin(j*TAU/12)*6.8,.3,'#dddcca');
  c.restore();
}
