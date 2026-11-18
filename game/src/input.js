// Keyboard and mouse, turned into the world's actions. Keys are edge-triggered
// (one hop per press, one tend per press) so holding a key never spams the
// garden. A mouse click tends the patch it lands on — but only on the rock the
// gardener stands on, so the player must hop there first.
import { FIELD } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;

export function createInput(canvas, world) {
  let hop = 0;
  let use = null;
  let actions = 0;

  // The canvas is letterboxed inside the window; map a client point back to
  // the 1280x720 field the world lives in.
  function toField(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / FIELD.width, rect.height / FIELD.height);
    const offsetX = (rect.width - FIELD.width * scale) / 2;
    const offsetY = (rect.height - FIELD.height * scale) / 2;
    return {
      x: (clientX - rect.left - offsetX) / scale,
      y: (clientY - rect.top - offsetY) / scale,
    };
  }

  function onKeyDown(event) {
    if (event.repeat) return;
    switch (event.code) {
      case 'KeyA':
      case 'ArrowLeft':
        hop = -1;
        break;
      case 'KeyD':
      case 'ArrowRight':
        hop = 1;
        break;
      case 'KeyW':
      case 'ArrowUp':
      case 'Space':
        use = 'auto';
        actions |= ACTION_CONFIRM;
        event.preventDefault();
        break;
      case 'Enter':
        actions |= ACTION_CONFIRM;
        break;
      case 'KeyP':
      case 'Escape':
        actions |= ACTION_PAUSE;
        break;
      case 'KeyR':
        actions |= ACTION_RESTART;
        break;
      default:
        break;
    }
  }

  function onPointerDown(event) {
    const point = toField(event.clientX, event.clientY);
    const patch = world.patchAt(point.x, point.y);
    if (patch !== null) use = patch;
    actions |= ACTION_CONFIRM;
  }

  window.addEventListener('keydown', onKeyDown);
  canvas.addEventListener('pointerdown', onPointerDown);

  return {
    // The movement + tend action for this frame, then cleared.
    takeMove() {
      const move = { hop, use };
      hop = 0;
      use = null;
      return move;
    },
    // Confirm / pause / restart presses since the last call, then cleared.
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
