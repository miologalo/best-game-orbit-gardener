// Orbit Gardener — the renderer. One canvas, one field of 1280x720, letterboxed
// into whatever window it is served in. Everything is drawn from the world's
// state; nothing here owns game logic.
import {
  ASTEROIDS, BLOOMS_TO_WIN, FIELD, FLOWER_CENTRES, FLOWER_COLOURS,
  PATCH_ANGLES, SEASON_SECONDS, SUN,
} from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WIN = 'win';
export const SCREEN_LOSE = 'lose';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawHeart(ctx, x, y, s, fill) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s / 10, s / 10);
  ctx.beginPath();
  ctx.moveTo(0, 3);
  ctx.bezierCurveTo(-6, -3, -11, 2, 0, 10);
  ctx.bezierCurveTo(11, 2, 6, -3, 0, 3);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}

function drawDroplet(ctx, x, y, s, fill) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.bezierCurveTo(s * 0.75, -s * 0.2, s * 0.6, s * 0.55, 0, s * 0.75);
  ctx.bezierCurveTo(-s * 0.6, s * 0.55, -s * 0.75, -s * 0.2, 0, -s);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}

function drawFlower(ctx, x, y, r, petal, centre, rotation = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.fillStyle = petal;
  for (let i = 0; i < 6; i += 1) {
    ctx.save();
    ctx.rotate((i / 6) * Math.PI * 2);
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.75, r * 0.42, r * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = centre;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSproutIcon(ctx, x, y, s, colour) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = colour;
  ctx.fillStyle = colour;
  ctx.lineWidth = s * 0.16;
  ctx.beginPath();
  ctx.moveTo(0, s * 0.5);
  ctx.quadraticCurveTo(0, 0, 0, -s * 0.2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(-s * 0.32, -s * 0.28, s * 0.34, s * 0.16, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(s * 0.32, -s * 0.28, s * 0.34, s * 0.16, 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function formatTime(seconds) {
  const total = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function fit() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
    const scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    const ox = (canvas.width - FIELD.width * scale) / 2;
    const oy = (canvas.height - FIELD.height * scale) / 2;
    return { scale, ox, oy };
  }

  function drawBackground(state) {
    const grad = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    grad.addColorStop(0, '#0b1030');
    grad.addColorStop(0.55, '#1a1445');
    grad.addColorStop(1, '#2a1a4d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    // Two soft nebulae so the sky is never flat black.
    const nebulae = [
      { x: 180, y: 130, r: 260, colour: 'rgba(107, 79, 161, 0.20)' },
      { x: 1120, y: 600, r: 300, colour: 'rgba(29, 122, 110, 0.16)' },
      { x: 1080, y: 90, r: 200, colour: 'rgba(255, 122, 107, 0.10)' },
    ];
    for (const n of nebulae) {
      const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
      g.addColorStop(0, n.colour);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
    }
    // Stars, twinkling gently.
    for (const star of state.stars) {
      const alpha = 0.35 + 0.6 * Math.abs(Math.sin(state.time * star.speed + star.phase));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawSun(state) {
    const pulse = 1 + 0.02 * Math.sin(state.time * 2);
    const glow = ctx.createRadialGradient(SUN.x, SUN.y, SUN.radius * 0.4, SUN.x, SUN.y, SUN.radius * 2.6);
    glow.addColorStop(0, 'rgba(255, 159, 28, 0.45)');
    glow.addColorStop(0.5, 'rgba(255, 122, 26, 0.14)');
    glow.addColorStop(1, 'rgba(255, 122, 26, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(SUN.x - 160, SUN.y - 160, 320, 320);
    const core = ctx.createRadialGradient(SUN.x, SUN.y, 4, SUN.x, SUN.y, SUN.radius * pulse);
    core.addColorStop(0, '#fff7d6');
    core.addColorStop(0.55, '#ffd166');
    core.addColorStop(1, '#ff9f1c');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(SUN.x, SUN.y, SUN.radius * pulse, 0, Math.PI * 2);
    ctx.fill();
    // Sunspots for texture — each its own path, or the fill would join them
    // with straight lines and paint a triangle across the sun.
    ctx.fillStyle = 'rgba(230, 120, 20, 0.35)';
    for (const [dx, dy, r] of [[-18, 8, 7], [22, -14, 5], [6, 24, 4]]) {
      ctx.beginPath();
      ctx.arc(SUN.x + dx, SUN.y + dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawOrbitRings() {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 10]);
    for (const def of ASTEROIDS) {
      ctx.beginPath();
      ctx.arc(SUN.x, SUN.y, def.orbit, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawAsteroid(a) {
    // The rock is lit from the sun: the gradient's bright side faces inward.
    const lx = a.cx - Math.cos(a.angle) * a.size * 0.35;
    const ly = a.cy - Math.sin(a.angle) * a.size * 0.35;
    const grad = ctx.createRadialGradient(lx, ly, a.size * 0.1, a.cx, a.cy, a.size * 1.15);
    grad.addColorStop(0, a.colour);
    grad.addColorStop(1, a.dark);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(a.cx, a.cy, a.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Craters ride the rock's slow spin.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.20)';
    for (const crater of a.craters) {
      const angle = crater.angle + a.spin;
      const x = a.cx + Math.cos(angle) * crater.dist * a.size;
      const y = a.cy + Math.sin(angle) * crater.dist * a.size;
      ctx.beginPath();
      ctx.arc(x, y, crater.r * a.size, 0, Math.PI * 2);
      ctx.fill();
    }
    // A soft highlight on the sunward edge.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(a.cx, a.cy, a.size - 2, a.angle + Math.PI - 0.7, a.angle + Math.PI + 0.7);
    ctx.stroke();
  }

  function drawPatch(a, patch, pi) {
    const angle = a.angle + PATCH_ANGLES[pi];
    ctx.save();
    ctx.translate(patch.x, patch.y);
    ctx.rotate(angle);
    ctx.fillStyle = a.patch;
    ctx.beginPath();
    ctx.ellipse(0, 0, 17, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  function drawPlant(a, patch, plant, time) {
    const angle = patch.angle;
    const sway = Math.sin(time * 1.6 + patch.x * 0.05) * 0.06;
    const tilt = plant.state === 'thirsty' ? 0.28 : plant.state === 'blighted' ? 0.5 : 0;
    ctx.save();
    ctx.translate(patch.x, patch.y);
    ctx.rotate(angle + Math.PI / 2 + sway + tilt);
    const grow = plant.grow;
    const green = plant.state === 'blighted' ? '#7a6a9a' : plant.state === 'thirsty' ? '#8aa86a' : '#4cc36b';
    const darkGreen = plant.state === 'blighted' ? '#5a4a7a' : '#2e8b57';
    // The stem grows upward (local -y) out of the soil.
    if (plant.stage === 0) {
      ctx.fillStyle = '#6b4a2f';
      ctx.beginPath();
      ctx.ellipse(0, -2, 7, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = green;
      ctx.beginPath();
      ctx.arc(0, -5, 2.5 * grow + 0.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const height = (plant.stage === 1 ? 14 : plant.stage === 2 ? 24 : 30) * grow;
      ctx.strokeStyle = green;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(3, -height * 0.5, 0, -height);
      ctx.stroke();
      // Leaves.
      ctx.fillStyle = darkGreen;
      const leafCount = plant.stage === 1 ? 2 : 3;
      for (let i = 0; i < leafCount; i += 1) {
        const ly = -height * (0.35 + i * 0.25);
        const side = i % 2 === 0 ? -1 : 1;
        ctx.save();
        ctx.translate(0, ly);
        ctx.rotate(side * 0.7);
        ctx.beginPath();
        ctx.ellipse(side * 6, 0, 7, 3.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      if (plant.stage === 2) {
        // A closed bud, waiting for its last watering.
        ctx.fillStyle = '#e9a8c8';
        ctx.beginPath();
        ctx.arc(0, -height - 3, 4.5 * grow + 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      if (plant.stage === 3) {
        drawFlower(ctx, 0, -height - 6, 9, FLOWER_COLOURS[plant.variety], FLOWER_CENTRES[plant.variety], Math.sin(time * 0.8) * 0.15);
        // Sparkles while the bloom celebrates.
        ctx.fillStyle = 'rgba(255, 243, 176, 0.9)';
        for (let i = 0; i < 3; i += 1) {
          const sparkle = (time * 2 + i * 2.1) % 1;
          ctx.globalAlpha = 1 - sparkle;
          ctx.beginPath();
          ctx.arc(Math.cos(i * 2.4) * 16, -height - 6 + Math.sin(i * 3.1) * 10 - sparkle * 12, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
    // Status icons float above the plant, in world space.
    if (plant.stage < 3 && plant.state !== 'ok') {
      const iconY = patch.y - 44;
      if (plant.state === 'thirsty') {
        drawDroplet(ctx, patch.x, iconY, 9, '#7ec8ff');
      } else {
        ctx.fillStyle = '#b388ff';
        ctx.font = 'bold 20px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', patch.x, iconY);
        ctx.fillStyle = 'rgba(179, 136, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(patch.x, iconY, 11, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  function drawGardener(state) {
    const g = state.gardener;
    const pos = g.pos;
    if (!pos) return;
    // Flashing while invulnerable after a meteor hit.
    if (state.invulnerable > 0 && Math.floor(state.time * 12) % 2 === 0) return;
    const a = state.asteroids[g.asteroid];
    const angle = g.hop ? Math.atan2(pos.y - SUN.y, pos.x - SUN.x) : a.angle;
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(angle + Math.PI / 2);
    // Shadow on the rock.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 12, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Legs.
    ctx.fillStyle = '#1d3557';
    ctx.fillRect(-7, -10, 5, 10);
    ctx.fillRect(2, -10, 5, 10);
    // Body: teal overalls with a cream shirt.
    ctx.fillStyle = '#2a9d8f';
    ctx.beginPath();
    ctx.moveTo(-9, -10);
    ctx.quadraticCurveTo(-11, -22, -6, -24);
    ctx.lineTo(6, -24);
    ctx.quadraticCurveTo(11, -22, 9, -10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f1faee';
    ctx.fillRect(-5, -23, 10, 7);
    // Arms; the right one holds the watering can.
    ctx.strokeStyle = '#2a9d8f';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-8, -20);
    ctx.lineTo(-13, -13);
    ctx.moveTo(8, -20);
    ctx.lineTo(14, -15);
    ctx.stroke();
    ctx.fillStyle = '#8d99ae';
    ctx.beginPath();
    ctx.arc(15, -13, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6c757d';
    ctx.fillRect(17, -16, 6, 2.5);
    // Head and the wide green sun hat.
    ctx.fillStyle = '#f4c89a';
    ctx.beginPath();
    ctx.arc(0, -30, 8.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#588157';
    ctx.beginPath();
    ctx.ellipse(0, -35, 13, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -36, 7, Math.PI, 0);
    ctx.fill();
    // Eyes, looking outward.
    ctx.fillStyle = '#1d3557';
    ctx.beginPath();
    ctx.arc(-3, -31, 1.3, 0, Math.PI * 2);
    ctx.arc(3, -31, 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawMeteors(state) {
    for (const meteor of state.meteors) {
      const a = state.asteroids[meteor.target];
      if (meteor.state === 'warning') {
        // A pulsing red ring on the rock it is about to hit.
        const pulse = 1 + 0.18 * Math.sin(state.time * 14);
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 93, 93, 0.9)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(a.cx, a.cy, (a.size + 12) * pulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#ff5d5d';
        ctx.font = 'bold 26px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', a.cx, a.cy - a.size - 20);
        ctx.restore();
      } else {
        // The rock streaks in, fire trailing behind it.
        const dx = a.cx - meteor.fromX;
        const dy = a.cy - meteor.fromY;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        for (let i = 0; i < 6; i += 1) {
          const k = 1 + i * 0.06;
          ctx.fillStyle = i < 2 ? 'rgba(255, 209, 102, 0.85)' : 'rgba(255, 107, 53, 0.55)';
          ctx.beginPath();
          ctx.arc(meteor.x - ux * i * 14, meteor.y - uy * i * 14, 9 - i, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#6b4a3a';
        ctx.beginPath();
        ctx.arc(meteor.x, meteor.y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.arc(meteor.x - 3, meteor.y - 2, 3, 0, Math.PI * 2);
        ctx.arc(meteor.x + 4, meteor.y + 3, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawWaterFx(state) {
    for (const fx of state.waterFx) {
      const g = state.gardener.pos;
      if (!g) continue;
      const k = Math.min(1, fx.t / 0.3);
      const alpha = Math.max(0, 1 - fx.t / 0.55);
      ctx.save();
      ctx.globalAlpha = alpha;
      for (let i = 0; i < 6; i += 1) {
        const s = (i / 5) * k;
        const x = g.x + (fx.x - g.x) * s;
        const y = g.y + (fx.y - g.y) * s - Math.sin(Math.PI * s) * 26;
        drawDroplet(ctx, x, y, 4, '#7ec8ff');
      }
      // A splash ring where the water lands.
      ctx.strokeStyle = 'rgba(126, 200, 255, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, 6 + fx.t * 40, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawParticles(state) {
    for (const p of state.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.colour;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawFloaters(state) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of state.floaters) {
      ctx.globalAlpha = Math.min(1, f.life);
      ctx.font = `bold ${f.size}px system-ui, sans-serif`;
      ctx.fillStyle = f.colour;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawHud(state) {
    // Hearts, top left.
    for (let i = 0; i < 3; i += 1) {
      drawHeart(ctx, 34 + i * 34, 34, 26, i < state.hearts ? '#ff5d5d' : 'rgba(255, 255, 255, 0.18)');
    }
    // Timer, top centre, with a thin season bar under it.
    const urgent = state.remaining <= 15;
    const pulse = urgent ? 1 + 0.07 * Math.sin(state.time * 9) : 1;
    ctx.save();
    ctx.translate(FIELD.width / 2, 40);
    ctx.scale(pulse, pulse);
    ctx.font = 'bold 38px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = urgent ? '#ff5d5d' : '#ffffff';
    ctx.fillText(formatTime(state.remaining), 0, 0);
    ctx.restore();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    roundRect(ctx, FIELD.width / 2 - 90, 62, 180, 6, 3);
    ctx.fill();
    ctx.fillStyle = urgent ? '#ff5d5d' : '#ffd166';
    roundRect(ctx, FIELD.width / 2 - 90, 62, 180 * (state.remaining / SEASON_SECONDS), 6, 3);
    ctx.fill();
    // Blooms and score, top right.
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    drawFlower(ctx, FIELD.width - 168, 30, 11, '#ff6fa5', '#fff3b0');
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${state.blooms} / ${BLOOMS_TO_WIN}`, FIELD.width - 148, 30);
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillStyle = '#ffd166';
    ctx.fillText(`SCORE ${state.score.toLocaleString('en-US')}`, FIELD.width - 24, 62);
    // The controls hint, small at the bottom.
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.textAlign = 'center';
    ctx.fillText('A / D hop between rocks  •  Click a patch to plant or water  •  Space tends the neediest patch  •  P pauses', FIELD.width / 2, FIELD.height - 16);
  }

  function overlay(alpha) {
    ctx.fillStyle = `rgba(6, 8, 26, ${alpha})`;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function drawTitle(state, best) {
    overlay(0.62);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    drawFlower(ctx, FIELD.width / 2 - 400, 128, 22, '#ff6fa5', '#fff3b0', 0.3);
    drawFlower(ctx, FIELD.width / 2 + 400, 128, 22, '#ffd166', '#ff9f1c', -0.3);
    ctx.font = 'bold 68px system-ui, sans-serif';
    ctx.fillStyle = '#ffd166';
    ctx.fillText('ORBIT GARDENER', FIELD.width / 2, 128);
    ctx.font = '24px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Grow 12 blooms before the season ends.', FIELD.width / 2, 182);
    // The three rules, each with a little drawn icon.
    const rules = [
      { icon: 'sprout', text: 'Click a soil patch to plant a seed, then water it to grow.' },
      { icon: 'drop', text: 'Thirsty plants droop, then catch blight — water them to save them.' },
      { icon: 'warn', text: 'When a red ring flashes, hop away: a meteor is about to land.' },
    ];
    ctx.font = '19px system-ui, sans-serif';
    rules.forEach((rule, i) => {
      const y = 248 + i * 40;
      if (rule.icon === 'sprout') drawSproutIcon(ctx, FIELD.width / 2 - 330, y, 20, '#4cc36b');
      if (rule.icon === 'drop') drawDroplet(ctx, FIELD.width / 2 - 330, y, 10, '#7ec8ff');
      if (rule.icon === 'warn') {
        ctx.fillStyle = '#ff5d5d';
        ctx.font = 'bold 22px system-ui, sans-serif';
        ctx.fillText('!', FIELD.width / 2 - 330, y);
        ctx.font = '19px system-ui, sans-serif';
      }
      ctx.fillStyle = '#e8e8f2';
      ctx.textAlign = 'left';
      ctx.fillText(rule.text, FIELD.width / 2 - 305, y);
      ctx.textAlign = 'center';
    });
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText('A / D or ← / → hop  •  Mouse plants and waters  •  Space tends  •  R restarts', FIELD.width / 2, 396);
    const blink = 0.55 + 0.45 * Math.sin(state.time * 4);
    ctx.globalAlpha = blink;
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('CLICK OR PRESS SPACE TO START', FIELD.width / 2, 452);
    ctx.globalAlpha = 1;
    if (best > 0) {
      ctx.font = '18px system-ui, sans-serif';
      ctx.fillStyle = '#ffd166';
      ctx.fillText(`Best score: ${best.toLocaleString('en-US')}`, FIELD.width / 2, 500);
    }
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fillText('A make.fun best-game-01 entry — keyboard and mouse, no downloads, no network.', FIELD.width / 2, FIELD.height - 40);
  }

  function drawEnd(state, best, won) {
    overlay(0.66);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (won) {
      ctx.font = 'bold 60px system-ui, sans-serif';
      ctx.fillStyle = '#ffd166';
      ctx.fillText('SEASON COMPLETE!', FIELD.width / 2, 130);
      ctx.font = '24px system-ui, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`You grew ${state.blooms} blooms before the whistle.`, FIELD.width / 2, 184);
    } else {
      ctx.font = 'bold 56px system-ui, sans-serif';
      ctx.fillStyle = '#ff8fa3';
      ctx.fillText('THE GARDEN FADED', FIELD.width / 2, 130);
      ctx.font = '24px system-ui, sans-serif';
      ctx.fillStyle = '#ffffff';
      const reason = state.loseReason === 'hearts'
        ? 'A meteor took the last heart.'
        : `The season ended with ${state.blooms} blooms — 12 were needed.`;
      ctx.fillText(reason, FIELD.width / 2, 184);
    }
    // Score breakdown, derived from the totals the world kept.
    const bloomScore = state.blooms * 100;
    const waterScore = state.waterings * 10;
    const cureScore = state.cures * 5;
    const timeBonus = Math.max(0, state.score - bloomScore - waterScore - cureScore);
    const lines = [
      [`Blooms  ${state.blooms} × 100`, bloomScore],
      [`Waterings  ${state.waterings} × 10`, waterScore],
      [`Blight cured  ${state.cures} × 5`, cureScore],
    ];
    if (won) lines.push([`Time bonus  ${Math.round(state.remaining)}s × 20`, timeBonus]);
    ctx.font = '21px system-ui, sans-serif';
    lines.forEach(([label, value], i) => {
      const y = 262 + i * 38;
      ctx.fillStyle = '#e8e8f2';
      ctx.textAlign = 'right';
      ctx.fillText(label, FIELD.width / 2 - 10, y);
      ctx.textAlign = 'left';
      ctx.fillText(value.toLocaleString('en-US'), FIELD.width / 2 + 10, y);
    });
    ctx.textAlign = 'center';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillStyle = '#ffd166';
    ctx.fillText(`TOTAL  ${state.score.toLocaleString('en-US')}`, FIELD.width / 2, 262 + lines.length * 38 + 14);
    if (state.score > 0 && state.score >= best) {
      ctx.font = '20px system-ui, sans-serif';
      ctx.fillStyle = '#7ee2a8';
      ctx.fillText('A new best score!', FIELD.width / 2, 262 + lines.length * 38 + 56);
    } else if (best > 0) {
      ctx.font = '18px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fillText(`Best score: ${best.toLocaleString('en-US')}`, FIELD.width / 2, 262 + lines.length * 38 + 56);
    }
    const blink = 0.55 + 0.45 * Math.sin(state.time * 4);
    ctx.globalAlpha = blink;
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('PRESS R OR CLICK TO PLAY AGAIN', FIELD.width / 2, 262 + lines.length * 38 + 108);
    ctx.globalAlpha = 1;
  }

  function drawPaused() {
    overlay(0.6);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 54px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('PAUSED', FIELD.width / 2, FIELD.height / 2 - 20);
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.fillText('Press P or Esc to keep gardening.', FIELD.width / 2, FIELD.height / 2 + 30);
  }

  function draw(state, screen, best) {
    const { scale, ox, oy } = fit();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b1030';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Screen shake offsets the whole field.
    const shake = state.shake > 0 ? state.shake * 22 : 0;
    const sx = shake ? (Math.random() - 0.5) * shake : 0;
    const sy = shake ? (Math.random() - 0.5) * shake : 0;
    ctx.setTransform(scale, 0, 0, scale, ox + sx * scale, oy + sy * scale);

    drawBackground(state);
    drawSun(state);
    drawOrbitRings();
    for (const a of state.asteroids) drawAsteroid(a);
    for (let ai = 0; ai < state.asteroids.length; ai += 1) {
      const a = state.asteroids[ai];
      for (let pi = 0; pi < a.patches.length; pi += 1) {
        const patch = a.patches[pi];
        drawPatch(a, patch, pi);
        if (patch.plant) drawPlant(a, patch, patch.plant, state.time);
      }
    }
    drawMeteors(state);
    drawGardener(state);
    drawWaterFx(state);
    drawParticles(state);
    drawFloaters(state);

    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(state);
    if (screen === SCREEN_TITLE) drawTitle(state, best);
    if (screen === SCREEN_WIN) drawEnd(state, best, true);
    if (screen === SCREEN_LOSE) drawEnd(state, best, false);
    if (screen === SCREEN_PAUSED) drawPaused();
  }

  return { draw };
}
