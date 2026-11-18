// Orbit Gardener — tuning and constants. One place for every number the game
// balances on, so a play-test can retune the season without touching logic.
export const FIELD = { width: 1280, height: 720 };
export const STEP = 1 / 60;

export const SUN = { x: FIELD.width / 2, y: FIELD.height / 2, radius: 56 };

// The season: 90 seconds to grow 12 blooms. Fewer than 12 at the whistle is a loss.
export const SEASON_SECONDS = 90;
export const BLOOMS_TO_WIN = 12;
export const HEARTS = 3;

// Three asteroids, one per orbit. The middle one counter-rotates so the garden
// never sits still. Colours are the garden's palette: teal, coral, amber.
export const ASTEROIDS = [
  { orbit: 168, size: 50, speed: 0.055, colour: '#2ec4b6', dark: '#1d8a80', patch: '#5b3a29' },
  { orbit: 256, size: 58, speed: -0.038, colour: '#ff7a6b', dark: '#c94f42', patch: '#4a2f24' },
  { orbit: 344, size: 64, speed: 0.026, colour: '#f4a259', dark: '#b97a37', patch: '#54371f' },
];
// Soil patches sit on each asteroid's outer arc, at these angles from "outward".
export const PATCH_ANGLES = [-0.95, 0, 0.95];
export const PATCHES_PER_ASTEROID = 3;

// A plant needs three waterings to bloom: seed -> sprout -> growing -> bloom.
export const STAGES = ['seed', 'sprout', 'growing', 'bloom'];
// After a watering a plant stays happy this long, then it droops (thirsty),
// then blight sets in, then it withers and the patch frees up.
export const DRY_SECONDS = 10;
export const THIRSTY_SECONDS = 6;
export const BLIGHT_SECONDS = 5;
// A bloom is celebrated, then harvested by itself so the patch frees up.
export const BLOOM_HOLD_SECONDS = 3;
// After a watering a plant needs this long to absorb it before it can be
// watered again — three quick clicks do not grow a flower.
export const GROW_DELAY_SECONDS = 4;

// Meteors: the first arrives a little into the season, then one every few
// seconds, faster late on. A warning marker shows first, then the rock streaks in.
export const METEOR_FIRST_SECONDS = 12;
export const METEOR_INTERVAL = [9, 14];
export const METEOR_INTERVAL_LATE = [6.5, 10];
export const METEOR_LATE_AFTER = 60;
export const METEOR_WARNING_SECONDS = 1.5;
export const METEOR_FLIGHT_SECONDS = 1.2;

// Hopping between asteroids takes this long; the gardener cannot tend mid-hop.
export const HOP_SECONDS = 0.35;
// After a meteor hits the gardener's asteroid, this long of flashing safety.
export const INVULNERABLE_SECONDS = 2;

// Points: a bloom is the big one, watering keeps the loop moving, curing
// blight is a small rescue bonus, and a win pays for the time left over.
export const SCORE_BLOOM = 100;
export const SCORE_WATER = 10;
export const SCORE_CURE = 5;
export const SCORE_WIN_TIME = 20;

export const BEST_KEY = 'orbit-gardener-best';

// Flower varieties: pink, gold, violet — petal and centre for each.
export const FLOWER_COLOURS = ['#ff6fa5', '#ffd166', '#b388ff'];
export const FLOWER_CENTRES = ['#fff3b0', '#ff9f1c', '#e0aaff'];
