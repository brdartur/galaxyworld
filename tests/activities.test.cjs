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

// Compact 2D paths must fit the available viewport without scaling any planet.
for (const [width,height] of [[1615,697],[1010,434],[345,400]]) {
  const compact=geometry.compactOrbits2D(width,height);
  assert.equal(compact.sunRadius,74 * .75);
  assert.ok(geometry.ORBIT_STRETCH_X_2D > 1, 'ellipses extend horizontally');
  bodies.forEach((p,i)=>{
    const radius=geometry.PLANET_RADIUS_2D(p.diameterKm);
    assert.equal(compact.planetRadii[i],radius,'resizing only changes orbital paths');
    const xExtent=radius*1.24*(p.ring?2.4:1),yExtent=radius*1.24*(p.ring?1.35:1);
    for(let j=0;j<360;j++) {
      const a=j*Math.PI/180;
      const x=Math.cos(a)*compact.radii[i]*geometry.ORBIT_STRETCH_X_2D;
      const y=Math.sin(a)*compact.radii[i];
      assert.ok(Math.abs(x)+xExtent<=width/2+1e-6,`${p.id} fits horizontally`);
      assert.ok(Math.abs(Math.sin(a)*compact.radii[i])+yExtent<=height/2+1e-6,`${p.id} fits vertically`);
      assert.ok(geometry.isNearOrbit2D(x,y,compact.radii[i]),`${p.id} can be selected anywhere on its ellipse`);
    }
  });
}
console.log('PASS: all 8 orbital paths fit at all angles while planet sizes remain unchanged');
assert.ok(!geometry.isNearOrbit2D(100,0,100),'old circle edge does not select the horizontal ellipse');
assert.ok(geometry.isNearOrbit2D(165,0,100),'orbit hit tolerance is measured in screen pixels');
assert.ok(!geometry.isNearOrbit2D(175,0,100),'points outside the hit tolerance are rejected');

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

// Exercise the actual pointer handlers, including a constellation crossing an orbit.
const hit=load(path.resolve('src/lib/constellationGeometry.ts'));
const shape={name:'TEST CONSTELLATION',pts:[[0,0],[1,0],[1,1],[0,1]],seg:[[0,1],[1,2],[2,3]]};
const inst={c:0,x:300,y:220,s:200,rot:.45,glow:0};
const pts=hit.constellationPoints(shape.pts,inst);
const middle=[(pts[0][0]+pts[1][0])/2,(pts[0][1]+pts[1][1])/2];
assert.ok(hit.hitsConstellation(...middle,shape,inst),'lines can be grabbed between stars');
assert.ok(hit.hitsConstellation(300,220,shape,inst),'name can be grabbed');
assert.ok(!hit.hitsConstellation(-500,-500,shape,inst));
const captured=new Set(),interactions=[];
const ctxDrag=vm.createContext({
  hitsConstellation:hit.hitsConstellation,CONSTELLATIONS:[shape],cInsts:[inst],mouse:{x:0,y:0},hoverId:null,
  cameraRef:{current:{panX:0,panY:0}},pick:()=>null,pickOrbit:()=> 'earth',
  propsRef:{current:{showOrbits:true,onSelect:id=>interactions.push(['planet',id]),onOrbitSelect:id=>interactions.push(['orbit',id]),onHover(){}}},
  canvas:{style:{},getBoundingClientRect:()=>({left:10,top:20}),setPointerCapture:id=>captured.add(id),hasPointerCapture:id=>captured.has(id),releasePointerCapture:id=>captured.delete(id)}
});
const handlers=source.slice(source.indexOf('    let dragIdx ='),source.indexOf('    const onWheel ='));
vm.runInContext(ts.transpile(handlers)+'\nglobalThis.handlers={onDown,onMove,onLeave,onUp};',ctxDrag);
const event=(x,y,id=7)=>({clientX:x+10,clientY:y+20,pointerId:id,isPrimary:true,button:0,preventDefault(){}});
ctxDrag.handlers.onDown(event(...middle));assert.ok(captured.has(7));
ctxDrag.handlers.onLeave();
ctxDrag.handlers.onMove(event(middle[0]+120,middle[1]+50));
assert.equal(inst.x,420);assert.equal(inst.y,270);
assert.equal(ctxDrag.cameraRef.current.panX,0);assert.deepEqual(interactions,[],'constellation drag wins over orbit selection');
ctxDrag.handlers.onMove(event(0,0,9));assert.equal(inst.x,420,'other pointers cannot hijack drag');
ctxDrag.handlers.onUp(event(0,0,9));assert.ok(captured.has(7));
ctxDrag.handlers.onUp(event(0,0));assert.equal(captured.size,0);
ctxDrag.handlers.onDown(event(-400,-400));assert.deepEqual(interactions,[['orbit','earth']],'ordinary orbit clicks still work');
ctxDrag.pickOrbit=()=>null;
ctxDrag.handlers.onDown(event(-400,-400));ctxDrag.handlers.onMove(event(-310,-430));
assert.equal(ctxDrag.cameraRef.current.panX,90);assert.equal(ctxDrag.cameraRef.current.panY,-30);
ctxDrag.handlers.onUp(event(0,0));assert.equal(captured.size,0);
console.log('PASS: star/line/name hit testing, pointer capture, orbit priority, cancellation and background panning');
