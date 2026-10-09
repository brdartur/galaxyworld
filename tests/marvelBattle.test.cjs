const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const ts = require('typescript');

function load(file) {
  const module = { exports: {} };
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  new Function('require', 'module', 'exports', js)(
    id => id.startsWith('.') ? load(path.resolve(path.dirname(file), id + '.ts')) : require(id),
    module, module.exports,
  );
  return module.exports;
}

const { HERO_IDS } = load(path.resolve('src/lib/marvelHeroes.ts'));
const { DEFAULT_ACTIVITIES } = load(path.resolve('src/lib/activitySettings.ts'));
const { battleFrame, VILLAIN_IDS, BATTLE_CYCLE } = load(path.resolve('src/lib/marvelBattle.ts'));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const sceneFor = (width = 1920, height = 1080) => {
  const size = Math.max(.4, Math.min(1, width / 1000));
  return {
    width, height, bottom: width < 640 ? 150 : 130,
    station: { x: width * .82, y: height * .28, radius: 90 * size },
    anchors: {
      sun: { x: width * .51, y: height * .49, radius: 56 * size },
      earth: { x: width * .38, y: height * .37, radius: 26 * size },
      mars: { x: width * .67, y: height * .4, radius: 23 * size },
      jupiter: { x: width * .73, y: height * .62, radius: 48 * size },
      saturn: { x: width * .31, y: height * .56, radius: 46 * size },
      neptune: { x: width * .82, y: height * .57, radius: 34 * size },
    },
  };
};

function teamSettings(mask, villains = VILLAIN_IDS) {
  const settings = { ...DEFAULT_ACTIVITIES };
  HERO_IDS.forEach((id, index) => { settings[id] = Boolean(mask & (1 << index)); });
  VILLAIN_IDS.forEach(id => { settings[id] = villains.includes(id); });
  return settings;
}

test('all 31 chosen teams defend against every villain across repeated encounter cycles', () => {
  assert.deepEqual(VILLAIN_IDS, ['thanos', 'ultron', 'galactus']);
  assert.equal(BATTLE_CYCLE, 48);
  const scene = sceneFor();
  const moments = [0, 3, 6, 10, 14, 15, 20, 29.99, 30, 35, 36, 40.9];
  for (let mask = 1; mask < 32; mask++) {
    const selected = HERO_IDS.filter((id, index) => mask & (1 << index));
    for (const villain of VILLAIN_IDS) {
      const settings = teamSettings(mask, [villain]);
      for (let cycle = 0; cycle < 3; cycle++) {
        for (const local of moments) {
          const encounter = battleFrame(cycle * BATTLE_CYCLE + local, scene, settings);
          assert.ok(encounter, `team=${selected}, villain=${villain}, cycle=${cycle}, local=${local}`);
          assert.equal(encounter.villain.id, villain);
          assert.deepEqual(Object.keys(encounter.defenders), selected, 'defenders contain exactly the chosen heroes');
          assert.ok(encounter.planet.id !== 'sun' && scene.anchors[encounter.planet.id]);
          const anchor = scene.anchors[encounter.planet.id];
          assert.equal(encounter.planet.x, anchor.x);
          assert.equal(encounter.planet.y, anchor.y);
          assert.equal(encounter.planet.radius, anchor.radius);
          if (local >= 15 && local < 30) {
            assert.equal(encounter.stage, 'clash');
            assert.ok(encounter.shield > .9 && encounter.attack > 0);
            for (const hero of selected) {
              const frame = encounter.defenders[hero];
              assert.equal(frame.combat, true, 'all selected heroes interrupt patrol together');
              assert.equal(frame.target.x, encounter.villain.x, 'counterattack points at the actual villain');
              assert.equal(frame.target.y, encounter.villain.y);
              assert.match(frame.action, /ЗАЩИТА/);
              assert.equal(frame.meteor, undefined, 'patrol meteor does not leak into combat');
              assert.equal(frame.trail.length, 0, 'defense replaces the patrol flight trail');
            }
          }
        }
        assert.equal(battleFrame(cycle * BATTLE_CYCLE + 41, scene, settings), null, 'the retreat is followed by a quiet interval');
        assert.equal(battleFrame(cycle * BATTLE_CYCLE + 47.9, scene, settings), null);
      }
    }
  }
});

test('solo heroes and teams of any size win on the same defense timeline', () => {
  const scene = sceneFor();
  const moments = [15, 20, 25, 30, 35, 36];
  for (const villain of VILLAIN_IDS) {
    const baseline = moments.map(time => battleFrame(time, scene, teamSettings(31, [villain])));
    for (let mask = 1; mask < 32; mask++) {
      let previousHealth = 1;
      moments.forEach((time, index) => {
        const encounter = battleFrame(time, scene, teamSettings(mask, [villain]));
        assert.ok(encounter.villainHealth >= 0 && encounter.villainHealth <= previousHealth);
        assert.equal(encounter.villainHealth, baseline[index].villainHealth, 'team size changes formation, not victory timing');
        assert.equal(encounter.shield, baseline[index].shield);
        assert.equal(encounter.counter, baseline[index].counter);
        previousHealth = encounter.villainHealth;
      });
      assert.equal(previousHealth, 0, 'every selected solo hero or team fully defeats the attack');
      const repelled = battleFrame(35, scene, teamSettings(mask, [villain]));
      assert.equal(repelled.stage, 'repelled');
      assert.equal(repelled.villain.pose, 'stagger');
      assert.equal(repelled.attack, 0, 'a defeated villain stops attacking the planet');
      assert.ok(repelled.counter > 0);
      assert.match(repelled.villain.action, /ОТРАЖЕНО/);
    }
  }
});

test('villain selection excludes disabled enemies and all-off prevents any attack', () => {
  const scene = sceneFor();
  for (let mask = 1; mask < 8; mask++) {
    const selected = VILLAIN_IDS.filter((id, index) => mask & (1 << index));
    for (let cycle = 0; cycle < 12; cycle++) {
      const encounter = battleFrame(cycle * BATTLE_CYCLE + 20, scene, teamSettings(31, selected));
      assert.equal(encounter.villain.id, selected[cycle % selected.length]);
    }
  }
  for (const time of [0, 6, 20, 35, 48, 120]) {
    assert.equal(battleFrame(time, scene, { ...teamSettings(31), battles: false }), null);
    assert.equal(battleFrame(time, scene, teamSettings(0)), null, 'zero chosen heroes do not create a defense team or spawn an enemy');
    assert.equal(battleFrame(time, scene, teamSettings(31, [])), null);
  }
  for (const time of [NaN, Infinity, -Infinity]) assert.equal(battleFrame(time, scene, teamSettings(31)), null);
  const cosmetic = { ...teamSettings(1), heroEffects: false, battleEffects: false };
  assert.equal(battleFrame(20, scene, cosmetic).defenders.ironMan.combat, true, 'hiding effects keeps defense behavior active');
});

test('an attack requires a visible real planet and never falls back to the Sun', () => {
  const scene = sceneFor();
  const fixtures = [
    { ...scene, anchors: {} },
    { ...scene, anchors: { sun: scene.anchors.sun } },
    { ...scene, anchors: Object.fromEntries(Object.keys(scene.anchors).map(id => [id, null])) },
    { ...scene, anchors: Object.fromEntries(Object.keys(scene.anchors).map(id => [id, { x: -500, y: -400, radius: 20 }])) },
    { ...scene, anchors: { earth: { x: NaN, y: 350, radius: 20 } } },
    { ...scene, anchors: { earth: { x: 700, y: 350, radius: 0 } } },
  ];
  for (const fixture of fixtures) {
    for (const time of [0, 12, 20, 35, 48, 100]) assert.equal(battleFrame(time, fixture, teamSettings(31)), null);
  }
  const single = { ...scene, anchors: { sun: scene.anchors.sun, mars: scene.anchors.mars } };
  for (let cycle = 0; cycle < 8; cycle++) {
    assert.equal(battleFrame(cycle * BATTLE_CYCLE + 20, single, teamSettings(31)).planet.id, 'mars');
  }
});

test('moving projected planet anchors updates shields, interception and counterattack targets', () => {
  const scene = sceneFor();
  scene.anchors = { sun: scene.anchors.sun, earth: scene.anchors.earth };
  const moved = { ...scene, anchors: { ...scene.anchors, earth: { ...scene.anchors.earth, x: scene.anchors.earth.x + 120, y: scene.anchors.earth.y + 70 } } };
  const before = battleFrame(20, scene, teamSettings(31));
  const after = battleFrame(20, moved, teamSettings(31));
  assert.equal(after.planet.x - before.planet.x, 120);
  assert.equal(after.planet.y - before.planet.y, 70);
  assert.equal(after.planet.radius, before.planet.radius);
  assert.ok(distance(after.intercept, before.intercept) > 20, 'shield interception follows the planet');
  assert.ok(distance(after.villain, before.villain) > 20, 'enemy attack origin follows the new target location');
  assert.equal(after.shield, before.shield, 'camera movement changes geometry, not defense progress');
  assert.equal(after.attackProgress, before.attackProgress);
  for (const frame of [before, after]) {
    const scale = frame.defenders.ironMan.scale;
    assert.ok(Math.abs(distance(frame.intercept, frame.planet) - (frame.planet.radius + 19 * scale)) < 1e-6,
      'incoming attack reaches the shield at the planet perimeter');
    assert.deepEqual(frame.villain.target, frame.intercept);
    for (const hero of HERO_IDS) {
      assert.equal(frame.defenders[hero].target.x, frame.villain.x);
      assert.equal(frame.defenders[hero].target.y, frame.villain.y);
    }
  }
});

test('an encounter keeps its original target through camera changes until the next cycle', () => {
  const scene = sceneFor();
  const settings = teamSettings(31);
  const initialScene = { ...scene, anchors: { sun: scene.anchors.sun, jupiter: scene.anchors.jupiter } };
  const initial = battleFrame(20, initialScene, settings);
  assert.equal(initial.planet.id, 'jupiter');
  const chosen = { cycle: initial.cycle, planetId: initial.planet.id };
  assert.equal(battleFrame(21, scene, settings).planet.id, 'earth', 'newly available planets would change an unlocked selection');
  assert.equal(battleFrame(21, scene, settings, chosen).planet.id, 'jupiter', 'the ongoing raid stays on its original planet');
  const fewer = { ...scene, anchors: { jupiter: scene.anchors.jupiter, neptune: scene.anchors.neptune } };
  assert.equal(battleFrame(22, fewer, settings, chosen).planet.id, 'jupiter', 'other planets disappearing do not transfer the raid');
  const moving = { ...scene, anchors: { ...scene.anchors,
    jupiter: { ...scene.anchors.jupiter, x: scene.anchors.jupiter.x + 80, y: scene.anchors.jupiter.y - 50 } } };
  const followed = battleFrame(23, moving, settings, chosen);
  assert.equal(followed.planet.x, moving.anchors.jupiter.x, 'the lock keeps the identity, not stale screen coordinates');
  assert.equal(followed.planet.y, moving.anchors.jupiter.y);
  const hidden = { ...scene, anchors: { ...scene.anchors, jupiter: { x: -500, y: -500, radius: 48 } } };
  assert.equal(battleFrame(24, hidden, settings, chosen), null, 'hidden target pauses the illustration instead of switching planets');
  const missing = { ...scene, anchors: { ...scene.anchors, jupiter: null } };
  assert.equal(battleFrame(25, missing, settings, chosen), null);
  const resumed = battleFrame(26, scene, settings, chosen);
  assert.equal(resumed.planet.id, 'jupiter', 'the same raid resumes when the original planet returns');
  assert.equal(resumed.stage, 'clash');
  const next = battleFrame(BATTLE_CYCLE + 20, scene, settings, chosen);
  const fresh = battleFrame(BATTLE_CYCLE + 20, scene, settings);
  assert.equal(next.planet.id, fresh.planet.id, 'a previous-cycle lock does not constrain the new encounter');
  assert.notEqual(next.planet.id, chosen.planetId);
});

function finitePoint(point, message) {
  assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y), message);
}

test('battle geometry stays finite and visible on desktop and mobile throughout cycles', () => {
  for (const [width, height] of [[1920, 1080], [1280, 720], [768, 1024], [375, 812], [360, 640]]) {
    const scene = sceneFor(width, height);
    for (const villain of VILLAIN_IDS) {
      for (let time = 0; time < 240; time += .5) {
        const encounter = battleFrame(time, scene, teamSettings(31, [villain]));
        if (time % BATTLE_CYCLE >= 41) { assert.equal(encounter, null); continue; }
        assert.ok(encounter, `${villain} has a visible planet in ${width}x${height} at t=${time}`);
        for (const key of ['shield', 'attack', 'counter', 'victory', 'villainHealth', 'attackProgress']) {
          assert.ok(Number.isFinite(encounter[key]) && encounter[key] >= 0 && encounter[key] <= 1, `${key} stays normalized`);
        }
        for (const point of [encounter.planet, encounter.intercept, encounter.villain, ...Object.values(encounter.defenders)]) {
          finitePoint(point, `${villain} finite point in ${width}x${height}`);
          assert.ok(point.x >= 0 && point.x <= width && point.y >= 0 && point.y <= height);
        }
        assert.ok(encounter.planet.radius > 0);
        assert.ok(encounter.villain.scale > 0 && encounter.villain.opacity >= 0 && encounter.villain.opacity <= 1);
        for (const frame of Object.values(encounter.defenders)) {
          for (const key of ['angle', 'scale', 'opacity', 'phase', 'effect']) assert.ok(Number.isFinite(frame[key]));
          if (frame.target) finitePoint(frame.target, 'defense target is finite');
          if (frame.hammer) finitePoint(frame.hammer, 'combat hammer is finite');
        }
      }
    }
  }
});

test('battle drawing balances Canvas state and supports effects on and off', () => {
  const drawing = load(path.resolve('src/lib/marvelBattleDrawing.ts'));
  const states = [], calls = [];
  const target = { globalAlpha: 1, measureText: text => ({ width: text.length * 6 }) };
  const ctx = new Proxy(target, {
    get(object, key) {
      if (key in object) return object[key];
      return (...args) => {
        args.filter(value => typeof value === 'number').forEach(value => assert.ok(Number.isFinite(value), `${String(key)} gets finite coordinates`));
        calls.push([key, ...args]);
        if (key === 'save') states.push({ ...object });
        if (key === 'restore') {
          assert.ok(states.length, 'restore has a matching save');
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
      if (key === 'globalAlpha') assert.ok(Number.isFinite(value) && value >= 0 && value <= 1, 'opacity is normalized');
      if (key === 'lineWidth') assert.ok(Number.isFinite(value) && value > 0);
      object[key] = value;
      return true;
    },
  });
  for (const villain of VILLAIN_IDS) {
    for (const mask of [1, 2, 31]) {
      for (const effects of [false, true]) {
        for (const showLabel of [false, true]) {
          for (let time = 0; time < 144; time += .5) {
            const encounter = battleFrame(time, sceneFor(), teamSettings(mask, [villain]));
            if (!encounter) continue;
            drawing.drawBattleBackdrop(ctx, encounter, { effects, showLabel });
            assert.equal(states.length, 0, `${villain} backdrop balances Canvas state`);
            drawing.drawBattleForeground(ctx, encounter, { effects });
            assert.equal(states.length, 0, `${villain} foreground balances Canvas state`);
            assert.equal(ctx.globalAlpha, 1, 'draws restore the previous opacity');
            calls.length = 0;
          }
        }
      }
    }
    const encounter = battleFrame(20, sceneFor(), teamSettings(31, [villain]));
    drawing.drawBattleBackdrop(ctx, encounter, { effects: false, showLabel: false });
    drawing.drawBattleForeground(ctx, encounter, { effects: false });
    const withoutEffects = calls.length;
    calls.length = 0;
    drawing.drawBattleBackdrop(ctx, encounter, { effects: true, showLabel: false });
    drawing.drawBattleForeground(ctx, encounter, { effects: true });
    assert.ok(calls.length > withoutEffects, `${villain} hiding effects removes actual beam/shield drawing`);
    calls.length = 0;
  }
});
