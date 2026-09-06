const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
function load(file) {
  const module = {exports:{}};
  const js = ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  new Function('require','module','exports',js)(p => p.startsWith('.') ? load(path.resolve(path.dirname(file),p+'.ts')) : require(p),module,module.exports);
  return module.exports;
}
const settings = load(path.resolve('src/lib/activitySettings.ts'));
const drawing = load(path.resolve('src/lib/activityDrawing.ts'));
assert.equal(settings.surfaceMission(15).drilling,true);
assert.equal(settings.surfaceMission(25).sampling,true);
assert.equal(settings.surfaceMission(30).scanning,true);
assert.equal(settings.surfaceMission(40).visible,false);
assert.equal(settings.surfaceMission(40).angle,0);
assert.equal(new Set(settings.ROVER_PLANETS).size,4);
assert.ok(!settings.ROVER_PLANETS.includes('sun'));
const calls=[]; let stack=0;
const ctx = new Proxy({globalAlpha:1, measureText:s=>({width:s.length*6})}, {
  get(target,key) {
    if(key in target) return target[key];
    if(key==='createLinearGradient'||key==='createRadialGradient') return (...args)=> {args.forEach(x=>assert.ok(Number.isFinite(x))); return {addColorStop(){}};};
    return (...args)=> {
      args.filter(x=>typeof x==='number').forEach(x=>assert.ok(Number.isFinite(x),`${String(key)} has invalid coordinate`));
      if(key==='save') stack++;
      if(key==='restore') stack--;
      assert.ok(stack>=0,'unbalanced canvas state'); calls.push([key,...args]);
    };
  },
  set(target,key,value) {target[key]=value; return true;}
});
for(let t=0;t<180;t+=.5) {
  drawing.drawSurfaceExplorer(ctx,40,t%40,settings.DEFAULT_ACTIVITIES);
  drawing.drawStation(ctx,t,settings.DEFAULT_ACTIVITIES);
  drawing.drawRover(ctx,50,t);
  drawing.drawSolarActivity(ctx,60,t);
  drawing.drawMartianShip(ctx,t);
  drawing.drawLander(ctx,t,true,t%40<30);
  assert.equal(stack,0);
  calls.length=0;
}
for(const key of Object.keys(settings.DEFAULT_ACTIVITIES)) {
  const flags={...settings.DEFAULT_ACTIVITIES,[key]:false};
  drawing.drawSurfaceExplorer(ctx,40,15,flags);
  drawing.drawStation(ctx,15,flags);
  assert.equal(stack,0);
}
calls.length=0;
drawing.drawStation(ctx,34,{...settings.DEFAULT_ACTIVITIES,spacewalk:false});
assert.ok(!calls.some(c=>c[0]==='quadraticCurveTo'),'spacewalk toggle removes tether');
calls.length=0;
drawing.drawStation(ctx,34,settings.DEFAULT_ACTIVITIES);
assert.ok(calls.some(c=>c[0]==='quadraticCurveTo'),'spacewalk draws actual tether');
const off={...settings.DEFAULT_ACTIVITIES,drilling:false};
calls.length=0; drawing.drawSurfaceExplorer(ctx,40,15,off);
assert.ok(!calls.some(c=>c[0]==='fillText'&&c[1]==='БУРЕНИЕ'));
calls.length=0; drawing.drawSurfaceExplorer(ctx,40,15,settings.DEFAULT_ACTIVITIES);
assert.ok(calls.some(c=>c[0]==='fillText'&&c[1]==='БУРЕНИЕ'));
console.log('PASS: mission phases, drawing coordinates over 180 seconds, rover targets, effect controls and tether');

// Adjacent orbital lanes must retain body/ring clearance even at conjunction.
const geometry=load(path.resolve('src/lib/orbitLayout.ts'));
const bodies=load(path.resolve('src/data/planets.ts')).PLANETS;
{
  const radii=geometry.spacedOrbits();
  let previous=0, previousExtent=geometry.SUN_RADIUS_2D;
  bodies.forEach((p,i)=>{
    const extent=geometry.PLANET_RADIUS_2D(p.diameterKm)*1.24*(p.ring?2.6:1);
    assert.ok(radii[i]-previous >= previousExtent+extent+23.999);
    previous=radii[i];previousExtent=extent;
  });
}
let previous=0,previousExtent=2.6;
bodies.forEach(p=>{
  const r=geometry.orbitRadius3D(p.distAU);
  const extent=(.24+Math.sqrt(p.diameterKm/142984)*1.5)*2*1.28*(p.ring?2.6:1);
  assert.ok(r>=2*(7+Math.sqrt(p.distAU)*4.1),'3D orbit at least doubled');
  assert.ok(r-previous>=previousExtent+extent+1.999,'3D rings retain clearance');
  previous=r;previousExtent=extent;
});
assert.ok(geometry.orbitRadius3D(2.1)>geometry.orbitRadius3D(1.52));
assert.ok(geometry.orbitRadius3D(3.3)<geometry.orbitRadius3D(5.2));
console.log('PASS: circular orbital clearance, doubled 3D distances and asteroid belt placement');

// Exercise the actual 2D state update at multiple frame rates.
let source=fs.readFileSync('src/components/SolarCanvas.tsx','utf8');
const start=source.indexOf('    const stepAstronaut =');
const end=source.indexOf('    /** пузырь',start);
const step=ts.transpile(source.slice(start,end)).replace('const stepAstronaut','var stepAstronaut');
for(const fps of [30,60,120]) {
  const PLANETS=Array.from({length:8},(_,i)=>({id:String(i)}));
  const placed=[{id:'sun',x:400,y:300,r:50},...PLANETS.map((p,i)=>({...p,x:100+i*70,y:350,r:15+i}))];
  const astronaut={mode:'idle',targetIdx:0,t:0,hold:40,drill:0,flyT:0,fromX:0,fromY:0,x:-9999,y:-9999,angle:0,leaveT:3};
  const context=vm.createContext({PLANETS,placed,astronaut,SUN:{id:'sun'},cx:400,cy:300,SURFACE_DURATION:40,easeInOut:settings.smooth,activityScale:()=>1});
  vm.runInContext(step,context);
  const modes=new Set(); let takeoffs=0;
  for(let frame=0;frame<150*fps;frame++) {
    placed.slice(1).forEach((p,i)=>{p.x=400+Math.cos(frame/fps*.3+i)*200;p.y=320+Math.sin(frame/fps*.3+i)*140;});
    const before=astronaut.mode, fromY=astronaut.fromY;
    context.stepAstronaut(1/fps); modes.add(astronaut.mode);
    assert.ok(Number.isFinite(astronaut.x)&&Number.isFinite(astronaut.y));
    if(before==='surface'&&astronaut.mode==='surface') {
      const target=placed[astronaut.targetIdx+1];
      assert.equal(astronaut.x,target.x); assert.equal(astronaut.y,target.y-target.r-24);
      assert.equal(astronaut.angle,-Math.PI/2,'landing must stay vertical');
    }
    if(before==='takeoff'&&astronaut.mode==='toPlanet') {
      assert.ok(Math.abs(astronaut.y-(fromY-95))<1e-6); takeoffs++;
    }
  }
  assert.deepEqual([...modes].sort(),['landing','surface','takeoff','toPlanet']); assert.ok(takeoffs>=2);
  console.log(`PASS ${fps} FPS: vertical landing, planet tracking and repeated takeoff`);
}
