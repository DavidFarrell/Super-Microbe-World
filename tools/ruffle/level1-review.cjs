#!/usr/bin/env node
// Plays level 1 of the original platformer in Ruffle with real keyboard input and saves
// reference screenshots for the fidelity review (reference/captures/ruffle-level1-*.png).
//
//   NODE_PATH=/opt/node22/lib/node_modules node tools/ruffle/level1-review.cjs [--out=<dir>]
//
// Scenarios (each loads movies/introductionToMicrobes_platformer.swf with level=alpha_level1.xml,
// starts it through Ruffle's context menu "Play" and clicks through the ePhone intro):
//   photo   Ctrl while standing, then Ctrl while riding right and left: shows where the camera
//           flash spawns relative to the avatar (the original uses the avatar's live _width,
//           which includes the hoverboard exhaust while riding).
//   portal  Rides right with repeated jumps until the camera reaches the exit portal: shows the
//           floor tiles drawn over the portal's bottom edge (tiles are duplicated at the next
//           highest depth on every render, above the entity clips).
// Default output: tools/.cache/ruffle-level1 (not committed).

const path = require('path');
const outArg = process.argv.find(a => a.startsWith('--out=')) || '--out=tools/.cache/ruffle-level1';
// journey.cjs reads its mode and options from argv.
process.argv = [process.argv[0], process.argv[1], 'review', outArg];
const { Session } = require(path.join(__dirname, 'journey.cjs'));

const near = (a, b, t) => a.every((v, i) => Math.abs(v - b[i]) <= t);

async function phoneSmall(S) {
  const [p] = await S.probe([[700, 400]]);
  return near(p, [182, 182, 182], 25);
}

// Loads level 1 on its own and waits until the ePhone intro has shrunk away.
async function startLevel1(S) {
  await S.open('/reference/Junior_Game/movies/introductionToMicrobes_platformer.swf', 'level=alpha_level1.xml');
  await S.wait(2500);
  await S.page.mouse.click(400, 225, { button: 'right' });
  await S.wait(400);
  await S.page.evaluate(() => {
    const item = [...window.__ruffle.shadowRoot.querySelectorAll('#context-menu .menu-item')].find(e => e.textContent.trim() === 'Play');
    if (item) item.click();
  });
  await S.wait(3000);
  await S.shot('intro', 'ePhone intro page');
  for (let i = 0; i < 12 && !(await phoneSmall(S)); i++) { await S.page.mouse.click(400, 225); await S.wait(1200); }
  const t0 = Date.now();
  while (!(await phoneSmall(S)) && Date.now() - t0 < 60000) await S.wait(300);
  await S.wait(1000);
  await S.shot('opening', 'opening view after the intro');
}

async function photo(S) {
  await startLevel1(S);
  await S.page.keyboard.press('Control');
  await S.shot('photo-standing', 'camera flash taken while standing');
  await S.wait(1500);
  for (let k = 0; k < 4; k++) {
    await S.page.keyboard.down('ArrowRight');
    await S.wait(250 + k * 120);
    await S.page.keyboard.press('Control');
    await S.shot(`photo-riding-right-${k}`, 'camera flash taken while riding right');
    await S.page.keyboard.up('ArrowRight');
    await S.wait(1500);
  }
  await S.page.keyboard.down('ArrowLeft');
  await S.wait(500);
  await S.page.keyboard.press('Control');
  await S.shot('photo-riding-left', 'camera flash taken while riding left');
  await S.page.keyboard.up('ArrowLeft');
}

async function portal(S) {
  await startLevel1(S);
  await S.page.keyboard.down('ArrowRight');
  for (let i = 0; i < 24; i++) {
    for (let j = 0; j < 2; j++) {
      await S.page.keyboard.down('ArrowUp'); await S.wait(250);
      await S.page.keyboard.up('ArrowUp'); await S.wait(150);
    }
    await S.wait(250);
    await S.shot(`ride-${i}`, 'riding right with double jumps towards the portal');
  }
  await S.page.keyboard.up('ArrowRight');
}

(async () => {
  const S = new Session();
  try {
    await photo(S);
    await portal(S);
  } catch (e) {
    console.log('ERROR', e);
    process.exitCode = 1;
  }
  await S.close();
})();
