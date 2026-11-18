// The screenshot scenes behind ?shot=start|play|nearwin|win. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered
// by a simple autopilot (tend the neediest patch, hop away from meteors), so
// the frame is what a short game really looks like and the same seed always
// gives the same frame.
import { BLOOMS_TO_WIN, METEOR_FLIGHT_SECONDS, METEOR_WARNING_SECONDS, STEP } from './config.js';
import { SCREEN_LOSE, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 18;
const NEARWIN_BLOOMS = BLOOMS_TO_WIN - 1;
const WIN_LIMIT_SECONDS = 150;
const SAMPLE = STEP;

// How needy a patch is: blighted plants first, then thirsty, then the
// least-grown ready plant, then an empty patch waiting for a seed.
function patchRank(state, ai, pi) {
  const plant = state.asteroids[ai].patches[pi].plant;
  if (!plant) return 1;
  if (plant.stage >= 3) return -1;
  if (state.time < plant.readyAt) return -1;
  if (plant.state === 'blighted') return 5;
  if (plant.state === 'thirsty') return 4;
  return 3 - plant.stage;
}

function neediestPatch(state, ai) {
  let best = -1;
  let bestRank = -1;
  for (let pi = 0; pi < state.asteroids[ai].patches.length; pi += 1) {
    const rank = patchRank(state, ai, pi);
    if (rank > bestRank) {
      bestRank = rank;
      best = pi;
    }
  }
  return bestRank > 0 ? best : -1;
}

function timeToImpact(meteor) {
  if (meteor.state === 'warning') return (METEOR_WARNING_SECONDS - meteor.t) + METEOR_FLIGHT_SECONDS;
  return METEOR_FLIGHT_SECONDS - meteor.t;
}

/** The autopilot's move for this step: a hop, a patch to tend, or nothing. */
function autopilot(state) {
  const g = state.gardener;
  if (g.hop) return { hop: 0, use: null };
  // A meteor about to land on this rock: hop to a rock it is not aimed at.
  for (const meteor of state.meteors) {
    if (meteor.target === g.asteroid && timeToImpact(meteor) < 1.4) {
      for (let ai = 0; ai < state.asteroids.length; ai += 1) {
        if (ai === g.asteroid) continue;
        const threatened = state.meteors.some((m) => m.target === ai && timeToImpact(m) < 2.5);
        if (!threatened) return { hop: ai > g.asteroid ? 1 : -1, use: null };
      }
      // Every rock is threatened: hop anywhere but here.
      return { hop: g.asteroid > 0 ? -1 : 1, use: null };
    }
  }
  // Tend the neediest patch on this rock.
  const patch = neediestPatch(state, g.asteroid);
  if (patch >= 0) return { hop: 0, use: patch };
  // Nothing needs doing here: hop to the rock with the neediest patch.
  let bestAsteroid = -1;
  let bestRank = -1;
  for (let ai = 0; ai < state.asteroids.length; ai += 1) {
    if (ai === g.asteroid) continue;
    for (let pi = 0; pi < state.asteroids[ai].patches.length; pi += 1) {
      const rank = patchRank(state, ai, pi);
      if (rank > bestRank) {
        bestRank = rank;
        bestAsteroid = ai;
      }
    }
  }
  if (bestAsteroid >= 0 && bestRank > 0) {
    return { hop: bestAsteroid > g.asteroid ? 1 : -1, use: null };
  }
  return { hop: 0, use: null };
}

/** The screen for a finished game, or play when it is still going. */
function endScreen(state) {
  if (!state.over) return SCREEN_PLAY;
  return state.over === 'win' ? SCREEN_WIN : SCREEN_LOSE;
}

/**
 * Set `world` to the named scene (start, play, nearwin or win; any other name
 * is start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  const state = world.state;
  if (name !== 'play' && name !== 'nearwin' && name !== 'win') {
    world.reset(true);
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, null, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  world.reset(false);
  if (name === 'play') {
    for (let i = 0; i < PLAY_SECONDS / STEP; i += 1) {
      world.step(STEP, autopilot(state), false);
      if (state.over) break;
    }
    return { screen: endScreen(state), best: state.score };
  }
  if (name === 'nearwin') {
    // Play until one bloom short of the win, then freeze the frame: the
    // garden at its fullest, the score high, the last bloom still to grow.
    for (let i = 0; i < WIN_LIMIT_SECONDS / STEP; i += 1) {
      world.step(STEP, autopilot(state), false);
      if (state.over || state.blooms >= NEARWIN_BLOOMS) break;
    }
    return { screen: endScreen(state), best: state.score };
  }
  // win: the autopilot plays until the 12th bloom lands, or the cap.
  for (let i = 0; i < WIN_LIMIT_SECONDS / STEP; i += 1) {
    world.step(STEP, autopilot(state), false);
    if (state.over) break;
  }
  return { screen: endScreen(state), best: state.score };
}
