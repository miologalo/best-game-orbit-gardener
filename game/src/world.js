// Orbit Gardener — the world: asteroids orbiting a sun, soil patches, plants
// that grow when watered and blight when ignored, meteors that threaten the
// garden, and the gardener hopping between asteroids. Everything is stepped
// in fixed 1/60 s steps; the renderer only ever reads this state.
import {
  ASTEROIDS, BLIGHT_SECONDS, BLOOM_HOLD_SECONDS, BLOOMS_TO_WIN, DRY_SECONDS,
  FIELD, FLOWER_CENTRES, FLOWER_COLOURS, GROW_DELAY_SECONDS, HEARTS, HOP_SECONDS, INVULNERABLE_SECONDS,
  METEOR_FIRST_SECONDS, METEOR_FLIGHT_SECONDS, METEOR_INTERVAL,
  METEOR_INTERVAL_LATE, METEOR_LATE_AFTER, METEOR_WARNING_SECONDS,
  PATCHES_PER_ASTEROID, PATCH_ANGLES, SCORE_BLOOM, SCORE_CURE, SCORE_WATER, SCORE_WIN_TIME,
  SEASON_SECONDS, SUN, THIRSTY_SECONDS,
} from './config.js';

export const EVENT_PLANT = 1;
export const EVENT_WATER = 2;
export const EVENT_CURE = 4;
export const EVENT_BLOOM = 8;
export const EVENT_BLIGHT = 16;
export const EVENT_WITHER = 32;
export const EVENT_WARNING = 64;
export const EVENT_IMPACT = 128;
export const EVENT_HURT = 256;
export const EVENT_WIN = 512;
export const EVENT_LOSE = 1024;
export const EVENT_HOP = 2048;

function makePlant(random) {
  return {
    stage: 0, // 0 seed, 1 sprout, 2 growing, 3 bloom
    state: 'ok', // ok | thirsty | blighted
    water: DRY_SECONDS, // seconds of happiness left before drooping
    timer: 0, // thirsty / blight countdown
    bloomTimer: 0,
    readyAt: 0, // the world time from which it may be watered again
    variety: random.int(0, 2),
    grow: 1, // 0..1 scale animation after a watering
  };
}

function burst(state, x, y, colours, count, speed, size, gravity = 0) {
  for (let i = 0; i < count; i += 1) {
    const angle = state.random.next() * Math.PI * 2;
    const velocity = state.random.range(speed * 0.4, speed);
    state.particles.push({
      x, y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity - speed * 0.3,
      life: state.random.range(0.4, 0.9),
      maxLife: 0.9,
      size: state.random.range(size * 0.6, size),
      colour: state.random.pick(colours),
      gravity,
    });
  }
}

export function createWorld(random) {
  const state = {
    random,
    time: 0,
    remaining: SEASON_SECONDS,
    hearts: HEARTS,
    blooms: 0,
    score: 0,
    waterings: 0,
    cures: 0,
    over: null, // null | 'win' | 'lose'
    loseReason: null, // 'hearts' | 'time'
    nextMeteorAt: METEOR_FIRST_SECONDS,
    shake: 0,
    invulnerable: 0,
    asteroids: [],
    gardener: { asteroid: 1, hop: null, facing: 1 },
    meteors: [],
    particles: [],
    floaters: [],
    waterFx: [], // {x, y, t} watering splashes
    stars: [],
  };

  function asteroidCentre(a) {
    return {
      x: SUN.x + Math.cos(a.angle) * a.orbit,
      y: SUN.y + Math.sin(a.angle) * a.orbit,
    };
  }

  function patchPosition(ai, pi) {
    const a = state.asteroids[ai];
    const angle = a.angle + PATCH_ANGLES[pi];
    return {
      x: a.cx + Math.cos(angle) * (a.size + 2),
      y: a.cy + Math.sin(angle) * (a.size + 2),
      angle,
    };
  }

  function gardenerPosition() {
    const g = state.gardener;
    if (g.hop) {
      const h = g.hop;
      const from = state.asteroids[h.from];
      const to = state.asteroids[h.to];
      const t = h.t / HOP_SECONDS;
      const eased = t * t * (3 - 2 * t);
      // The hop follows the orbit: interpolate the angle (the short way round)
      // and the radius, so the gardener circles the sun and never cuts across
      // it — a straight line between two rocks can pass right through the sun.
      let dAngle = (to.angle - from.angle) % (Math.PI * 2);
      if (dAngle > Math.PI) dAngle -= Math.PI * 2;
      if (dAngle < -Math.PI) dAngle += Math.PI * 2;
      const angle = from.angle + dAngle * eased;
      const fromR = from.orbit + from.size + 16;
      const toR = to.orbit + to.size + 16;
      const radius = fromR + (toR - fromR) * eased + Math.sin(Math.PI * eased) * 30;
      return {
        x: SUN.x + Math.cos(angle) * radius,
        y: SUN.y + Math.sin(angle) * radius,
        hopping: true,
      };
    }
    const a = state.asteroids[g.asteroid];
    return {
      x: a.cx + Math.cos(a.angle) * (a.size + 16),
      y: a.cy + Math.sin(a.angle) * (a.size + 16),
      hopping: false,
    };
  }

  function spawnMeteor() {
    // Half the time the rock comes for the gardener's asteroid — that is the
    // one the player is standing on, and the one they must hop away from.
    let target = random.int(0, state.asteroids.length - 1);
    if (random.next() < 0.5) target = state.gardener.asteroid;
    const a = state.asteroids[target];
    const fromAngle = random.next() * Math.PI * 2;
    const dist = 720;
    state.meteors.push({
      target,
      state: 'warning',
      t: 0,
      fromX: a.cx + Math.cos(fromAngle) * dist,
      fromY: a.cy + Math.sin(fromAngle) * dist,
      x: a.cx + Math.cos(fromAngle) * dist,
      y: a.cy + Math.sin(fromAngle) * dist,
    });
    return EVENT_WARNING;
  }

  function impactMeteor(meteor) {
    const a = state.asteroids[meteor.target];
    const px = a.cx + Math.cos(a.angle) * (a.size + 6);
    const py = a.cy + Math.sin(a.angle) * (a.size + 6);
    state.shake = 0.4;
    burst(state, px, py, ['#ff9f1c', '#ff6b35', '#8d99ae', a.colour], 26, 260, 5, 220);
    burst(state, px, py, ['#ffd166', '#fff3b0'], 12, 160, 3, 60);
    // Every plant on the struck asteroid is destroyed.
    for (const patch of a.patches) {
      if (patch.plant) {
        burst(state, patch.x, patch.y, ['#6b7c5e', '#8d99ae'], 8, 120, 3, 120);
        patch.plant = null;
      }
    }
    let events = EVENT_IMPACT;
    if (state.gardener.asteroid === meteor.target && !state.gardener.hop && state.invulnerable <= 0) {
      state.hearts -= 1;
      state.invulnerable = INVULNERABLE_SECONDS;
      const g = gardenerPosition();
      state.floaters.push({ x: g.x, y: g.y - 34, text: '-1 ♥', life: 1.2, colour: '#ff5d5d', size: 22 });
      events |= EVENT_HURT;
      if (state.hearts <= 0) {
        state.over = 'lose';
        state.loseReason = 'hearts';
        events |= EVENT_LOSE;
      }
    }
    return events;
  }

  function tendPatch(ai, pi) {
    const patch = state.asteroids[ai].patches[pi];
    if (!patch) return 0;
    if (!patch.plant) {
      patch.plant = makePlant(random);
      patch.plant.readyAt = state.time + GROW_DELAY_SECONDS;
      const pos = patchPosition(ai, pi);
      state.waterFx.push({ x: pos.x, y: pos.y, t: 0 });
      burst(state, pos.x, pos.y - 6, ['#90e0a0', '#5fb878'], 6, 80, 2.5, 40);
      return EVENT_PLANT;
    }
    const plant = patch.plant;
    if (plant.stage >= 3) return 0; // a bloom is already celebrating
    if (state.time < plant.readyAt) return 0; // still absorbing the last watering
    const wasBlighted = plant.state === 'blighted';
    plant.stage += 1;
    plant.state = 'ok';
    plant.water = DRY_SECONDS;
    plant.timer = 0;
    plant.grow = 0;
    plant.readyAt = state.time + GROW_DELAY_SECONDS;
    if (plant.stage === 3) plant.bloomTimer = BLOOM_HOLD_SECONDS;
    state.score += SCORE_WATER;
    state.waterings += 1;
    const pos = patchPosition(ai, pi);
    state.waterFx.push({ x: pos.x, y: pos.y, t: 0 });
    burst(state, pos.x, pos.y - 10, ['#7ec8ff', '#bde0ff', '#ffffff'], 10, 110, 2.5, 120);
    let events = EVENT_WATER;
    if (wasBlighted) {
      state.score += SCORE_CURE;
      state.cures += 1;
      events |= EVENT_CURE;
    }
    return events;
  }

  function reset(attract) {
    state.time = 0;
    state.remaining = SEASON_SECONDS;
    state.hearts = HEARTS;
    state.blooms = 0;
    state.score = 0;
    state.waterings = 0;
    state.cures = 0;
    state.over = null;
    state.loseReason = null;
    state.nextMeteorAt = METEOR_FIRST_SECONDS;
    state.shake = 0;
    state.invulnerable = 0;
    state.meteors = [];
    state.particles = [];
    state.floaters = [];
    state.waterFx = [];
    state.gardener = { asteroid: 1, hop: null, facing: 1 };
    state.asteroids = ASTEROIDS.map((def, i) => ({
      ...def,
      angle: random.range(0, Math.PI * 2),
      spin: random.range(0, Math.PI * 2),
      spinSpeed: random.range(0.05, 0.16) * (i % 2 === 0 ? 1 : -1),
      craters: Array.from({ length: 4 }, () => ({
        angle: random.range(0, Math.PI * 2),
        dist: random.range(0.15, 0.62),
        r: random.range(0.1, 0.2),
      })),
      cx: 0,
      cy: 0,
      patches: PATCH_ANGLES.map(() => ({ plant: null })),
    }));
    // The stars are fixed for the run so the sky never shimmers between shots.
    state.stars = Array.from({ length: 150 }, () => ({
      x: random.next() * FIELD.width,
      y: random.next() * FIELD.height,
      r: random.range(0.6, 2.1),
      phase: random.next() * Math.PI * 2,
      speed: random.range(0.4, 1.4),
    }));
    // A lively title backdrop: a few plants already growing on each rock.
    if (attract) {
      const stages = [1, 2, 3, 1, 2];
      let n = 0;
      for (let ai = 0; ai < state.asteroids.length; ai += 1) {
        for (let pi = 0; pi < PATCHES_PER_ASTEROID; pi += 1) {
          if (n >= stages.length) break;
          const plant = makePlant(random);
          plant.stage = stages[n];
          plant.water = DRY_SECONDS;
          if (plant.stage === 3) plant.bloomTimer = 999;
          state.asteroids[ai].patches[pi].plant = plant;
          n += 1;
        }
      }
    }
    for (const a of state.asteroids) {
      const c = asteroidCentre(a);
      a.cx = c.x;
      a.cy = c.y;
    }
  }

  function step(dt, action, attract) {
    let events = 0;
    state.time += dt;

    // The asteroids drift on, and the gardener rides along.
    for (const a of state.asteroids) {
      a.angle += a.speed * dt;
      a.spin += a.spinSpeed * dt;
      const c = asteroidCentre(a);
      a.cx = c.x;
      a.cy = c.y;
    }
    // Patch pixel positions follow the asteroids.
    for (let ai = 0; ai < state.asteroids.length; ai += 1) {
      for (let pi = 0; pi < PATCHES_PER_ASTEROID; pi += 1) {
        const pos = patchPosition(ai, pi);
        state.asteroids[ai].patches[pi].x = pos.x;
        state.asteroids[ai].patches[pi].y = pos.y;
        state.asteroids[ai].patches[pi].angle = pos.angle;
      }
    }
    state.gardener.pos = gardenerPosition();

    if (state.invulnerable > 0) state.invulnerable -= dt;
    if (state.shake > 0) state.shake -= dt;

    // Particles, splashes and floating score text fade on their own clock.
    for (const p of state.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.life -= dt;
    }
    state.particles = state.particles.filter((p) => p.life > 0);
    for (const f of state.floaters) {
      f.y -= 26 * dt;
      f.life -= dt;
    }
    state.floaters = state.floaters.filter((f) => f.life > 0);
    for (const w of state.waterFx) w.t += dt;
    state.waterFx = state.waterFx.filter((w) => w.t < 0.55);

    if (attract || state.over) {
      // The title screen's garden just sits pretty; an ended game freezes.
      for (const a of state.asteroids) {
        for (const patch of a.patches) {
          if (patch.plant && patch.plant.grow < 1) patch.plant.grow = Math.min(1, patch.plant.grow + dt * 2);
        }
      }
      return events;
    }

    // The season clock.
    state.remaining -= dt;
    if (state.remaining <= 0) {
      state.remaining = 0;
      if (state.blooms >= BLOOMS_TO_WIN) {
        state.over = 'win';
        events |= EVENT_WIN;
      } else {
        state.over = 'lose';
        state.loseReason = 'time';
        events |= EVENT_LOSE;
      }
      return events;
    }

    // The gardener's hop.
    const g = state.gardener;
    if (g.hop) {
      g.hop.t += dt;
      if (g.hop.t >= HOP_SECONDS) {
        g.asteroid = g.hop.to;
        g.hop = null;
      }
    } else if (action && action.hop !== 0) {
      const to = g.asteroid + action.hop;
      if (to >= 0 && to < state.asteroids.length) {
        g.hop = { from: g.asteroid, to, t: 0 };
        g.facing = action.hop;
        events |= EVENT_HOP;
      }
    }

    // Tending: plant a seed or water a plant on the gardener's own rock.
    if (action && action.use !== null && action.use !== undefined && !g.hop) {
      const ai = g.asteroid;
      if (action.use === 'auto') {
        // Keyboard: tend whichever patch needs it most — blighted, then
        // thirsty, then the least-grown plant, then an empty patch.
        let best = -1;
        let bestRank = -1;
        for (let pi = 0; pi < PATCHES_PER_ASTEROID; pi += 1) {
          const plant = state.asteroids[ai].patches[pi].plant;
          let rank = -1;
          if (!plant) rank = 1;
          else if (plant.stage < 3 && state.time >= plant.readyAt) {
            rank = plant.state === 'blighted' ? 5 : plant.state === 'thirsty' ? 4 : 3 - plant.stage;
          }
          if (rank > bestRank) {
            bestRank = rank;
            best = pi;
          }
        }
        if (best >= 0 && bestRank > 0) events |= tendPatch(ai, best);
      } else {
        events |= tendPatch(ai, action.use);
      }
    }

    // Plants live their own lives: growth animation, drying, blight, bloom.
    for (let ai = 0; ai < state.asteroids.length; ai += 1) {
      for (const patch of state.asteroids[ai].patches) {
        const plant = patch.plant;
        if (!plant) continue;
        if (plant.grow < 1) plant.grow = Math.min(1, plant.grow + dt / 0.8);
        if (plant.stage >= 3) {
          plant.bloomTimer -= dt;
          if (plant.bloomTimer <= 0) {
            const pos = patchPosition(ai, state.asteroids[ai].patches.indexOf(patch));
            state.blooms += 1;
            state.score += SCORE_BLOOM;
            state.floaters.push({ x: pos.x, y: pos.y - 26, text: `+${SCORE_BLOOM}`, life: 1.1, colour: '#ffd166', size: 20 });
            burst(state, pos.x, pos.y - 12, [FLOWER_COLOURS[plant.variety], '#fff3b0', '#ffffff'], 12, 130, 3, 40);
            patch.plant = null;
            events |= EVENT_BLOOM;
            if (state.blooms >= BLOOMS_TO_WIN) {
              state.over = 'win';
              state.score += Math.round(state.remaining) * SCORE_WIN_TIME;
              events |= EVENT_WIN;
            }
          }
          continue;
        }
        if (plant.state === 'ok') {
          plant.water -= dt;
          if (plant.water <= 0) {
            plant.state = 'thirsty';
            plant.timer = THIRSTY_SECONDS;
          }
        } else if (plant.state === 'thirsty') {
          plant.timer -= dt;
          if (plant.timer <= 0) {
            plant.state = 'blighted';
            plant.timer = BLIGHT_SECONDS;
            events |= EVENT_BLIGHT;
          }
        } else {
          plant.timer -= dt;
          if (plant.timer <= 0) {
            const pos = patchPosition(ai, state.asteroids[ai].patches.indexOf(patch));
            burst(state, pos.x, pos.y - 8, ['#7a6a9a', '#5a4a7a'], 8, 90, 3, 100);
            patch.plant = null;
            events |= EVENT_WITHER;
          }
        }
      }
    }

    // Meteors arrive on their own schedule, faster late in the season.
    if (state.time >= state.nextMeteorAt) {
      const late = state.time >= METEOR_LATE_AFTER;
      const [lo, hi] = late ? METEOR_INTERVAL_LATE : METEOR_INTERVAL;
      state.nextMeteorAt = state.time + random.range(lo, hi);
      events |= spawnMeteor();
    }
    for (const meteor of state.meteors) {
      meteor.t += dt;
      const a = state.asteroids[meteor.target];
      if (meteor.state === 'warning') {
        if (meteor.t >= METEOR_WARNING_SECONDS) {
          meteor.state = 'flying';
          meteor.t = 0;
        }
      } else {
        const k = Math.min(1, meteor.t / METEOR_FLIGHT_SECONDS);
        const eased = k * k;
        meteor.x = meteor.fromX + (a.cx - meteor.fromX) * eased;
        meteor.y = meteor.fromY + (a.cy - meteor.fromY) * eased;
        if (k >= 1) {
          meteor.done = true;
          events |= impactMeteor(meteor);
        }
      }
    }
    state.meteors = state.meteors.filter((m) => !m.done);

    return events;
  }

  // The patch on the gardener's asteroid nearest a screen point, or null when
  // the click is nowhere near a patch. The mouse can only tend the rock the
  // gardener stands on — hop there first.
  function patchAt(x, y) {
    const ai = state.gardener.asteroid;
    let best = null;
    let bestDist = 78;
    for (let pi = 0; pi < PATCHES_PER_ASTEROID; pi += 1) {
      const patch = state.asteroids[ai].patches[pi];
      const dx = patch.x - x;
      const dy = patch.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist) {
        bestDist = dist;
        best = pi;
      }
    }
    return best;
  }

  // Which patch most needs the keyboard's attention on the current rock.
  function nearestNeedyPatch() {
    const ai = state.gardener.asteroid;
    let best = -1;
    let bestRank = -1;
    for (let pi = 0; pi < PATCHES_PER_ASTEROID; pi += 1) {
      const plant = state.asteroids[ai].patches[pi].plant;
      let rank = -1;
      if (!plant) rank = 1;
      else if (plant.stage < 3 && state.time >= plant.readyAt) {
        rank = plant.state === 'blighted' ? 5 : plant.state === 'thirsty' ? 4 : 3 - plant.stage;
      }
      if (rank > bestRank) {
        bestRank = rank;
        best = pi;
      }
    }
    return bestRank > 0 ? best : -1;
  }

  reset(false);
  return { state, reset, step, patchAt, nearestNeedyPatch, patchPosition, gardenerPosition, FLOWER_COLOURS, FLOWER_CENTRES };
}
