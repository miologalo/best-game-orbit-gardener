// Orbit Gardener — best-game-01 hand-in program (Node 22, standard library only).
//
// The game lives in game/ beside this file: plain static files a desktop
// browser loads offline (game/index.html plus its ES modules, no library, no
// network request). This program hands it in: it copies game/ and
// screenshots/ into the output directory and writes output/dossier.json, the
// summary the judge reads, using the vendored make.fun library in
// vendor/makefun-game.ts (leave that file untouched — the scorer rebuilds the
// dossier with its own copy and compares byte for byte).
//
// How to run it locally:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Outside the grader MAKEFUN_OUTPUT_DIR stands in for /output; with no
// MAKEFUN_OUTPUT_DIR set, /output is used. Serve the game itself with
// `node serve.ts` and open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// Where this file lives, and where the hand-in goes.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's caps from the bounty's gate.json. Only text_max_bytes shapes
// the dossier's bytes; the rest make this program refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more
// than 993 files and directories in game/ or 48 MiB of game files, or a
// game path over 1,000 bytes — game/ shares /output's own 1,000-entry cap
// with screenshots/ and dossier.json).
const dossierCaps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

// Copy a folder beside this file into the output directory, creating the
// destination first. When `optional` is set and the folder is absent, do
// nothing: screenshots/ is optional on disk (the dossier refuses an entry
// with none), so a missing screenshots/ is left to buildDossier.
function copyFolder(name: string, optional = false): void {
  const source = join(repoRoot, name);
  if (optional && !existsSync(source)) return;
  const target = join(outputDir, name);
  mkdirSync(target, { recursive: true });
  cpSync(source, target, { recursive: true });
}

if (!existsSync(join(repoRoot, 'game'))) {
  throw new Error('game/: no such directory — the game is a directory of static files beside main.ts');
}

mkdirSync(outputDir, { recursive: true });
copyFolder('game');
copyFolder('screenshots', true);

writeFileSync(join(outputDir, 'dossier.json'), buildDossier(outputDir, dossierCaps));
