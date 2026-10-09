const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function load(file) {
  const module = { exports: {} };
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  new Function('require', 'module', 'exports', js)(
    p => p.startsWith('.') ? load(path.resolve(path.dirname(file), p + '.ts')) : require(p),
    module, module.exports,
  );
  return module.exports;
}

const heroes = load(path.resolve('src/lib/marvelHeroes.ts'));
const offsets = { ironMan: 16, thor: 34, silverSurfer: 3, captainMarvel: 48, nova: 58 };
const atLocalTime = (id, local, scene) => heroes.heroFrame(id, local + 64 - offsets[id], scene);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const sceneFor = (width = 1920, height = 1080) => ({
  width, height, bottom: width < 640 ? 150 : 130,
  station: { x: width * .82, y: height * .28, radius: 90 },
  anchors: {
    sun: { x: width * .51, y: height * .47, radius: 56 },
    earth: { x: width * .38, y: height * .41, radius: 28 },
    mars: { x: width * .67, y: height * .4, radius: 23 },
    jupiter: { x: width * .73, y: height * .63, radius: 48 },
    saturn: { x: width * .31, y: height * .56, radius: 58 },
    neptune: { x: width * .82, y: height * .57, radius: 34 },
  },
});

function finitePoint(point, description) {
  assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y), description);
}

test('five distinct heroes retain finite, visible animation coordinates over full cycles', () => {
  assert.deepEqual(heroes.HERO_IDS, ['ironMan', 'thor', 'silverSurfer', 'captainMarvel', 'nova']);
  assert.equal(new Set(heroes.HERO_IDS.map(id => heroes.HERO_DETAILS[id].name)).size, 5);
  for (const [width, height] of [[1920, 1080], [1280, 720], [768, 1024], [375, 812], [360, 640]]) {
    const scene = sceneFor(width, height);
    for (const id of heroes.HERO_IDS) {
      for (let time = -64; time <= 192; time += .125) {
        const frame = heroes.heroFrame(id, time, scene);
        finitePoint(frame, `${id} at ${width}x${height}, t=${time}`);
        assert.ok(frame.x >= 0 && frame.x <= width && frame.y >= 0 && frame.y <= height);
        for (const key of ['angle', 'scale', 'opacity', 'time', 'phase', 'thrust', 'effect']) {
          assert.ok(Number.isFinite(frame[key]), `${id}.${key} at t=${time}`);
        }
        assert.ok(frame.scale >= .55 && frame.scale <= 1.1);
        assert.ok(frame.opacity >= 0 && frame.opacity <= 1);
        assert.ok(frame.phase >= 0 && frame.phase <= 1);
        assert.ok(frame.effect >= 0 && frame.effect <= 1);
        assert.ok(frame.trail.length <= 10);
        for (const point of frame.trail) finitePoint(point, `${id} trail`);
        if (frame.target) finitePoint(frame.target, `${id} target`);
        if (frame.hammer) {
          finitePoint(frame.hammer, 'hammer path');
          assert.ok(Number.isFinite(frame.hammer.angle));
        }
        if (frame.meteor) {
          finitePoint(frame.meteor, 'meteor position');
          assert.ok(Number.isFinite(frame.meteor.radius) && frame.meteor.radius >= 0);
        }
      }
    }
  }
});

test('flight, approach, mission, departure and cycle boundaries stay continuous', () => {
  const scene = sceneFor();
  const missionPoses = { ironMan: 'repair', thor: 'hammer', silverSurfer: 'surf', captainMarvel: 'blast', nova: 'scan' };
  for (const id of heroes.HERO_IDS) {
    const flight = atLocalTime(id, 8, scene);
    const approach = atLocalTime(id, 16, scene);
    const mission = atLocalTime(id, 27, scene);
    const departure = atLocalTime(id, 39, scene);
    assert.equal(mission.pose, missionPoses[id]);
    assert.ok(mission.target && mission.effect > .8);
    assert.equal(mission.trail.length, 0);
    for (const frame of [flight, approach, departure]) assert.equal(frame.trail.length, 10);
    assert.ok(distance(approach, mission) > 1, `${id} approaches the mission`);
    assert.ok(distance(departure, mission) > 1, `${id} leaves the mission`);
    for (const boundary of [0, 12, 19, 35, 43, 64]) {
      const before = atLocalTime(id, boundary - .0001, scene);
      const after = atLocalTime(id, boundary + .0001, scene);
      // The hold pose intentionally floats by up to 2 screen pixels times its scale.
      assert.ok(distance(before, after) < 3, `${id} jumps at local t=${boundary}`);
    }
  }
});

test('Thor throws a separate hammer outward and receives it on the return path', () => {
  const scene = sceneFor();
  const reach = phase => {
    const frame = atLocalTime('thor', 19 + phase * 16, scene);
    assert.ok(frame.hammer, 'mission contains a separate animated hammer');
    const hand = { x: frame.x + 24 * frame.scale, y: frame.y - 7 * frame.scale };
    return { frame, distance: distance(frame.hammer, hand) };
  };
  const start = reach(.01), outward = reach(.25), apex = reach(.5), returning = reach(.75), end = reach(.99);
  assert.equal(start.frame.hammer.returning, false);
  assert.equal(outward.frame.hammer.returning, false);
  assert.equal(returning.frame.hammer.returning, true);
  assert.equal(end.frame.hammer.returning, true);
  assert.ok(start.distance < outward.distance && outward.distance < apex.distance);
  assert.ok(end.distance < returning.distance && returning.distance < apex.distance);
  assert.ok(end.distance < 6, 'returned hammer reaches the hand');
  assert.notEqual(outward.frame.hammer.angle, returning.frame.hammer.angle, 'hammer spins during flight');
});

test('Captain Marvel intercepts a meteor that dissolves after the photon impulse', () => {
  const scene = sceneFor();
  const frames = [.25, .6, .7, .9, .999].map(phase => atLocalTime('captainMarvel', 19 + phase * 16, scene));
  frames.forEach(frame => assert.ok(frame.meteor && frame.target));
  assert.match(frames[0].action, /ПЕРЕХВАТ/);
  assert.match(frames[1].action, /ФОТОННЫЙ/);
  assert.equal(frames[0].meteor.radius, frames[1].meteor.radius);
  assert.ok(frames[2].meteor.radius > frames[3].meteor.radius);
  assert.ok(frames[3].meteor.radius > frames[4].meteor.radius);
  assert.ok(frames[4].meteor.radius < .001, 'meteor vanishes smoothly at mission end');
  assert.equal(atLocalTime('captainMarvel', 36, scene).meteor, undefined);
});

test('Iron Man follows station dragging and scans Earth when the station is hidden', () => {
  const scene = sceneFor();
  const before = atLocalTime('ironMan', 27, scene);
  const movedScene = { ...scene, station: { ...scene.station, x: scene.station.x - 120, y: scene.station.y + 90 } };
  const moved = atLocalTime('ironMan', 27, movedScene);
  assert.equal(moved.x - before.x, -120);
  assert.equal(moved.y - before.y, 90);
  assert.equal(moved.target.x - before.target.x, -120);
  assert.equal(moved.target.y - before.target.y, 90);
  const hidden = atLocalTime('ironMan', 27, { ...scene, station: null });
  assert.equal(hidden.pose, 'scan');
  assert.match(hidden.action, /ЗЕМЛИ/);
  assert.ok(distance(hidden.target, scene.anchors.earth) <= scene.anchors.earth.radius);
  assert.ok(distance(hidden, before) > 100, 'hidden station switches the mission location');
});

test('missing and offscreen projected planets use safe mission fallback positions', () => {
  const scene = sceneFor(375, 812);
  const fixtures = [
    { ...scene, anchors: {}, station: null },
    { ...scene, anchors: { sun: null, earth: null, mars: null, jupiter: null, saturn: null, neptune: null }, station: null },
    { ...scene, anchors: Object.fromEntries(Object.entries(scene.anchors).map(([id, anchor]) =>
      [id, id === 'sun' ? anchor : { x: -1200, y: 5000, radius: 30 }])), station: null },
  ];
  for (const fixture of fixtures) {
    for (const id of heroes.HERO_IDS) {
      for (const local of [0, 15, 20, 27, 34.9, 40, 60]) {
        const frame = atLocalTime(id, local, fixture);
        finitePoint(frame, `${id} fallback`);
        assert.ok(frame.x >= 0 && frame.x <= fixture.width && frame.y >= 0 && frame.y <= fixture.height);
        if (frame.target) assert.ok(frame.target.x >= 0 && frame.target.x <= fixture.width &&
          frame.target.y >= 0 && frame.target.y <= fixture.height, `${id} effect target stays inside the map`);
      }
    }
  }
});

test('procedural drawing balances Canvas state with all effects and captions combinations', () => {
  const drawing = load(path.resolve('src/lib/marvelDrawing.ts'));
  const states = [], calls = [];
  const target = { globalAlpha: 1, measureText: text => ({ width: text.length * 6 }) };
  const ctx = new Proxy(target, {
    get(object, key) {
      if (key in object) return object[key];
      return (...args) => {
        args.filter(value => typeof value === 'number').forEach(value =>
          assert.ok(Number.isFinite(value), `${String(key)} receives a finite number`));
        calls.push([key, ...args]);
        if (key === 'save') states.push({ ...object });
        if (key === 'restore') {
          assert.ok(states.length > 0, 'Canvas restore has a matching save');
          const saved = states.pop();
          for (const property of Object.keys(object)) delete object[property];
          Object.assign(object, saved);
        }
        if (key === 'arc') assert.ok(args[2] >= 0, 'arc radius is nonnegative');
        if (key === 'ellipse') assert.ok(args[2] >= 0 && args[3] >= 0, 'ellipse radii are nonnegative');
        if (key === 'createLinearGradient' || key === 'createRadialGradient') return {
          addColorStop(offset) { assert.ok(Number.isFinite(offset) && offset >= 0 && offset <= 1); },
        };
      };
    },
    set(object, key, value) {
      if (key === 'globalAlpha') assert.ok(Number.isFinite(value) && value >= 0 && value <= 1);
      if (key === 'lineWidth') assert.ok(Number.isFinite(value) && value > 0);
      object[key] = value;
      return true;
    },
  });
  const scene = sceneFor();
  for (const id of heroes.HERO_IDS) {
    for (const effects of [false, true]) {
      for (const showLabel of [false, true]) {
        for (let time = 0; time <= 192; time += .5) {
          drawing.drawMarvelHero(ctx, heroes.heroFrame(id, time, scene), { effects, showLabel });
          assert.equal(states.length, 0, `${id} balances Canvas state at t=${time}`);
          assert.equal(ctx.globalAlpha, 1, `${id} restores opacity`);
          assert.equal(calls.some(call => call[0] === 'fillText'), showLabel);
          calls.length = 0;
        }
      }
    }
    const frame = atLocalTime(id, 27, scene);
    drawing.drawMarvelHero(ctx, frame, { effects: false, showLabel: false });
    const withoutEffects = calls.length;
    calls.length = 0;
    drawing.drawMarvelHero(ctx, frame, { effects: true, showLabel: false });
    assert.ok(calls.length > withoutEffects, `${id} effect toggle removes actual drawing operations`);
    calls.length = 0;
  }
  for (const change of [{ x: NaN }, { y: Infinity }, { scale: 0 }, { opacity: 0 }]) {
    drawing.drawMarvelHero(ctx, { ...heroes.heroFrame('nova', 0, scene), ...change }, { effects: true, showLabel: true });
    assert.equal(calls.length, 0, 'invalid or fully hidden frame does not touch Canvas');
  }
});

// Mount the real component with a small deterministic hooks/RAF harness. The Canvas
// drawing is replaced by a recorder, while settings, lifecycle and heroFrame remain real.
function mountOverlay(initialSettings) {
  const draws = [], battleDraws = [], pending = new Map(), refs = [], effects = [];
  const docListeners = new Map(), parentListeners = new Map(), mediaListeners = new Map();
  const media = { matches: false, addEventListener: (key, fn) => mediaListeners.set(key, fn),
    removeEventListener: key => mediaListeners.delete(key) };
  const scene = sceneFor();
  const parent = {
    getBoundingClientRect: () => ({ width: scene.width, height: scene.height, left: 10, top: 20 }),
    querySelector: () => ({ getBoundingClientRect: () => ({ height: 102 }) }),
    addEventListener: (key, fn) => parentListeners.set(key, fn),
    removeEventListener: key => parentListeners.delete(key),
  };
  let clearCount = 0, disconnectCount = 0, sequence = 0, hook = 0;
  const canvas = { parentElement: parent, width: 0, height: 0, dataset: {},
    getContext: () => ({ setTransform() {}, clearRect() { clearCount++; } }) };
  const document = { hidden: false, addEventListener: (key, fn) => docListeners.set(key, fn),
    removeEventListener: key => docListeners.delete(key) };
  const module = { exports: {} };
  const pendingEffects = [];
  const react = {
    useRef(initial) { const index = hook++; return refs[index] ??= { current: initial }; },
    useEffect(effect, deps) {
      const index = hook++, previous = effects[index];
      if (!previous || deps.some((value, i) => value !== previous.deps[i])) {
        pendingEffects.push(() => {
          previous?.cleanup?.();
          effects[index] = { deps, cleanup: effect() };
        });
      }
    },
  };
  const jsx = (type, props) => ({ type, props });
  const source = ts.transpileModule(fs.readFileSync('src/components/MarvelHeroes.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, {
    module, exports: module.exports,
    require(id) {
      if (id === 'react') return react;
      if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' };
      if (id.endsWith('/marvelHeroes')) return heroes;
      if (id.endsWith('/marvelDrawing')) return { drawMarvelHero(ctx, frame, options) { draws.push({ frame, options }); } };
      if (id.endsWith('/marvelBattle')) return load(path.resolve('src/lib/marvelBattle.ts'));
      if (id.endsWith('/marvelBattleDrawing')) return {
        drawBattleBackdrop(ctx, battle, options) { battleDraws.push({ layer: 'backdrop', battle, options }); },
        drawBattleForeground(ctx, battle, options) { battleDraws.push({ layer: 'foreground', battle, options }); },
      };
      throw new Error(`Unexpected component dependency: ${id}`);
    },
    window: { devicePixelRatio: 3, matchMedia: () => media }, document,
    requestAnimationFrame(fn) { const id = ++sequence; pending.set(id, fn); return id; },
    cancelAnimationFrame: id => pending.delete(id),
    ResizeObserver: class { observe() {} disconnect() { disconnectCount++; } },
  });
  const anchors = { current: scene.anchors }, station = { current: scene.station };
  let settings = initialSettings, showLabels = false;
  function assignCanvas(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'canvas') node.props.ref.current = canvas;
    const children = node.props?.children;
    for (const child of Array.isArray(children) ? children : [children]) assignCanvas(child);
  }
  const render = changes => {
    if (changes?.settings) settings = changes.settings;
    if (changes?.showLabels !== undefined) showLabels = changes.showLabels;
    hook = 0;
    const tree = module.exports.default({ settings, anchors, station, showLabels });
    assignCanvas(tree);
    while (pendingEffects.length) pendingEffects.shift()();
    return tree;
  };
  render();
  return {
    draws, battleDraws, settings, canvas, document, media, anchors, station, render,
    tick(now) { draws.length = 0; battleDraws.length = 0; const callbacks = [...pending.values()]; pending.clear(); callbacks.forEach(fn => fn(now)); },
    pending: () => pending.size,
    hidden(value) { document.hidden = value; docListeners.get('visibilitychange')(); },
    hover(x, y) { parentListeners.get('pointermove')({ pointerType: 'mouse', clientX: x + 10, clientY: y + 20 }); },
    leave() { parentListeners.get('pointerleave')(); },
    reduced(value) { media.matches = value; mediaListeners.get('change')(); },
    clearCount: () => clearCount,
    unmount() { effects.forEach(effect => effect?.cleanup?.()); },
    listeners: () => parentListeners.size + docListeners.size + mediaListeners.size,
    disconnectCount: () => disconnectCount,
  };
}

test('overlay toggles heroes independently and resumes after all-off or tab visibility', () => {
  const settings = load(path.resolve('src/lib/activitySettings.ts')).DEFAULT_ACTIVITIES;
  heroes.HERO_IDS.forEach(id => assert.equal(settings[id], true));
  const overlay = mountOverlay(settings);
  assert.equal(overlay.pending(), 1, 'one overlay RAF is scheduled');
  assert.equal(overlay.canvas.width, 1920 * 2, 'pixel ratio is capped at 2');
  overlay.tick(1000);
  assert.deepEqual(overlay.draws.map(draw => draw.frame.id), heroes.HERO_IDS);
  assert.ok(overlay.draws.every(draw => draw.options.effects && !draw.options.showLabel));

  let now = 1000;
  for (const id of heroes.HERO_IDS) {
    overlay.render({ settings: { ...settings, [id]: false } });
    overlay.tick(now += 40);
    assert.deepEqual(overlay.draws.map(draw => draw.frame.id), heroes.HERO_IDS.filter(other => other !== id));
    assert.equal(overlay.pending(), 1, 'one disabled hero does not stop other animations');
  }
  overlay.render({ settings: { ...settings, heroEffects: false }, showLabels: true });
  overlay.tick(now += 40);
  assert.equal(overlay.draws.length, 5);
  assert.ok(overlay.draws.every(draw => !draw.options.effects && draw.options.showLabel));

  overlay.render({ settings, showLabels: false });
  overlay.tick(now += 40);
  const hero = overlay.draws[0].frame;
  overlay.hover(hero.x, hero.y);
  overlay.tick(now += 40);
  assert.equal(overlay.draws[0].options.showLabel, true, 'hover reveals the name and action');
  overlay.leave();
  overlay.tick(now += 40);
  assert.ok(overlay.draws.every(draw => !draw.options.showLabel));

  const off = { ...settings };
  heroes.HERO_IDS.forEach(id => { off[id] = false; });
  const clearedBefore = overlay.clearCount();
  overlay.render({ settings: off });
  assert.equal(overlay.pending(), 0, 'all disabled heroes cancel the RAF');
  assert.ok(overlay.clearCount() > clearedBefore, 'all-off clears previously drawn sprites');
  overlay.tick(now += 1000);
  assert.equal(overlay.draws.length, 0);

  overlay.render({ settings });
  overlay.tick(now += 40);
  assert.equal(overlay.draws.length, 5, 'reenabling restarts drawing');
  const beforeHidden = overlay.draws[0].frame.time;
  overlay.hidden(true);
  assert.equal(overlay.pending(), 0, 'hidden tab cancels RAF');
  overlay.hidden(false);
  overlay.tick(now += 60000);
  assert.equal(overlay.draws[0].frame.time, beforeHidden, 'resume does not jump through hidden time');

  overlay.reduced(true);
  overlay.tick(now += 40);
  const posedTime = overlay.draws[0].frame.time;
  overlay.tick(now += 1000);
  assert.equal(overlay.draws[0].frame.time, posedTime, 'reduced motion keeps heroes posed');
  assert.ok(overlay.draws.every(draw => !draw.options.effects));
  overlay.unmount();
  assert.equal(overlay.pending(), 0, 'unmount cancels RAF');
  assert.equal(overlay.listeners(), 0, 'unmount removes pointer, visibility and media listeners');
  assert.equal(overlay.disconnectCount(), 1, 'unmount releases ResizeObserver');
});

test('the real overlay lets one chosen hero defend and keeps battle effects independent', () => {
  const defaults = load(path.resolve('src/lib/activitySettings.ts')).DEFAULT_ACTIVITIES;
  const settings = { ...defaults, thanos: false, galactus: false };
  heroes.HERO_IDS.forEach(id => { settings[id] = id === 'ironMan'; });
  const overlay = mountOverlay(settings);
  let now = 1000;
  overlay.tick(now);
  for (let frame = 0; frame < 200; frame++) overlay.tick(now += 100);
  assert.equal(overlay.draws.length, 1, 'selected solo hero is the only visible defender');
  assert.equal(overlay.draws[0].frame.id, 'ironMan');
  assert.equal(overlay.draws[0].frame.combat, true);
  assert.match(overlay.draws[0].frame.action, /ЗАЩИТА/);
  assert.deepEqual(overlay.battleDraws.map(draw => draw.layer), ['backdrop', 'foreground']);
  const encounter = overlay.battleDraws[0].battle;
  assert.equal(encounter.villain.id, 'ultron');
  assert.equal(overlay.draws[0].frame.target.x, encounter.villain.x);
  assert.equal(overlay.draws[0].frame.target.y, encounter.villain.y);
  assert.equal(overlay.canvas.dataset.battleStage, 'clash');
  assert.equal(overlay.canvas.dataset.battleVillain, 'ultron');
  assert.equal(overlay.canvas.dataset.defendingHeroes, 'ironMan');

  overlay.render({ settings: { ...settings, battleEffects: false } });
  overlay.tick(now += 100);
  assert.ok(overlay.battleDraws.every(draw => !draw.options.effects));
  assert.equal(overlay.draws[0].options.effects, true, 'hero effects retain their own toggle');
  assert.equal(overlay.draws[0].frame.combat, true, 'effect toggle keeps the defensive action');
  for (let frame = 0; frame < 160; frame++) overlay.tick(now += 100);
  assert.equal(overlay.battleDraws[0].battle.villainHealth, 0, 'one hero can fully repel the attack');

  overlay.render({ settings: { ...settings, battles: false } });
  overlay.tick(now += 100);
  assert.equal(overlay.battleDraws.length, 0);
  assert.equal(overlay.draws.length, 1, 'disabling attacks preserves the selected patrol hero');
  assert.equal(overlay.draws[0].frame.combat, undefined);
  assert.equal(overlay.canvas.dataset.battleStage, undefined, 'stale battle metadata is cleared');
  assert.equal(overlay.canvas.dataset.battleVillain, undefined);

  overlay.render({ settings: { ...settings, ironMan: false } });
  assert.equal(overlay.pending(), 0, 'no chosen heroes pause all battle animation');
  overlay.tick(now += 1000);
  assert.equal(overlay.draws.length, 0);
  assert.equal(overlay.battleDraws.length, 0, 'an enemy is not drawn without chosen defenders');
  assert.equal(overlay.canvas.dataset.defendingHeroes, undefined);
  overlay.unmount();
});

test('reduced motion shows a visible stationary defense instead of an invisible arrival', () => {
  const defaults = load(path.resolve('src/lib/activitySettings.ts')).DEFAULT_ACTIVITIES;
  const overlay = mountOverlay(defaults);
  overlay.reduced(true);
  overlay.tick(1000);
  assert.equal(overlay.battleDraws[0].battle.stage, 'clash');
  assert.ok(overlay.battleDraws[0].battle.villain.opacity > .9, 'the stationary villain is actually visible');
  assert.ok(overlay.draws.every(draw => draw.frame.combat && !draw.options.effects));
  assert.ok(overlay.battleDraws.every(draw => !draw.options.effects));
  const time = overlay.battleDraws[0].battle.time;
  const coordinates = overlay.draws.map(draw => [draw.frame.x, draw.frame.y]);
  overlay.tick(60000);
  assert.equal(overlay.battleDraws[0].battle.time, time);
  assert.deepEqual(overlay.draws.map(draw => [draw.frame.x, draw.frame.y]), coordinates);
  overlay.unmount();
});
