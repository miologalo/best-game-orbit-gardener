// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between five screens: title,
// play, paused, win and lose.
//
// ?seed=N fixes the falling pattern. ?shot=start|play|nearwin|win (with
// &seed=N) stages that scene instead of running the loop, paints it twice and
// sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createSoundFX } from './audio.js';
import {
  EVENT_BLIGHT, EVENT_BLOOM, EVENT_CURE, EVENT_HOP, EVENT_HURT,
  EVENT_IMPACT, EVENT_LOSE, EVENT_PLANT, EVENT_WARNING, EVENT_WATER,
  EVENT_WIN, EVENT_WITHER, createWorld,
} from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import {
  SCREEN_LOSE, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN,
  createRenderer,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const sound = createSoundFX();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, world);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // The title screen's garden runs in attract mode: it orbits and sways,
  // but nothing dries out and no meteor ever falls.
  world.reset(true);

  // Screen readers (and anyone watching the page's text) hear the screen changes and each event.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    sound.unlock();
    world.reset(false);
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Grow 12 blooms before the season ends.');
  }

  function endGame() {
    const state = world.state;
    screen = state.over === 'win' ? SCREEN_WIN : SCREEN_LOSE;
    if (state.score > best) {
      best = state.score;
      saveBest(best);
    }
    if (state.over === 'win') {
      sound.win();
      announce(`Season complete. ${state.blooms} blooms. Score ${state.score}.`);
    } else {
      sound.lose();
      announce(`The garden faded. ${state.blooms} blooms. Score ${state.score}.`);
    }
  }

  function playEventSound(events) {
    if (events & EVENT_WARNING) sound.warning();
    if (events & EVENT_IMPACT) sound.impact();
    if (events & EVENT_HURT) sound.hurt();
    if (events & EVENT_PLANT) sound.plant();
    if (events & EVENT_WATER) sound.water();
    if (events & EVENT_CURE) sound.cure();
    if (events & EVENT_BLOOM) sound.bloom();
    if (events & EVENT_BLIGHT) sound.blight();
    if (events & EVENT_WITHER) sound.wither();
    if (events & EVENT_HOP) sound.hop();
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_RESTART && screen !== SCREEN_TITLE) {
      startGame();
      return;
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_WIN || screen === SCREEN_LOSE)) {
      sound.click();
      startGame();
      return;
    }
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, null, true);
      return;
    }
    const move = input.takeMove();
    const events = world.step(STEP, move, false);
    playEventSound(events);
    if (events & EVENT_BLOOM) announce(`${world.state.blooms} blooms. Score ${world.state.score}.`);
    else if (events & EVENT_BLIGHT) announce('A plant caught blight. Water it to save it.');
    else if (events & EVENT_HURT) announce(`Hit. ${world.state.hearts} hearts left.`);
    if (events & (EVENT_WIN | EVENT_LOSE)) endGame();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting the season run out unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Orbit Gardener. Grow 12 blooms before the season ends. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
