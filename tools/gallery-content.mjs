// Content of the fidelity gallery (web/screenshots/index.html), used by tools/build-gallery.mjs.
//
// Each entry pairs the Flash original with the remake. Flash images are `{ src, caption }` with src
// under reference/captures (Ruffle captures of the original) or web/screenshots/reference (screens
// composed from the original SWFs); remake images are `{ shot, caption }`, a name the screenshot
// sessions in build-gallery.mjs write to web/screenshots/remake/<shot>.webp.
//
// Text markup: `code`, {N:11.2} or {N:10.1 #19} links a web/NOTES.md section, {ART:6} a section of
// web/NOTES-art-decisions.md, {DOC:path|label} any other file (path relative to web/).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cap = n => `reference/captures/${n}`;
const composed = n => `web/screenshots/reference/${n}`;

// Differences that hold for every platform level, stated once in the section introduction.
const LEVEL_OPENINGS = ['038-level1-opening', '042-level2-opening', '046-level3-opening', '050-level4-opening', '079-level5-opening', '085-level6-opening', '091-level7-opening', '107-level8-opening', '111-level9-opening', '183-level10-opening'];
const LEVEL_MOVING = ['039-level1-moving', '043-level2-moving', '047-level3-moving', '051-level4-moving', '080-level5-moving', '086-level6-moving', '092-level7-moving', '108-level8-moving', '112-level9-moving', '184-level10-moving'];
const LEVELS = [
  { title: 'Level 1: the kitchen, photograph 3 Lucy', compare: 'Pepper and salt pots, cheese, loaf, yoghurt pot and sausage on the 50 px grid; the mint worktop; Lucy on the ePhone with three empty tick boxes. In the moment, the camera flash about 55 px ahead of the player.', diff: [] },
  { title: 'Level 2: the hand, photograph 3 more Lucy', compare: 'Skin floor, the hair, plasters and the sore; Lucy on the ePhone (the "photograph a good microbe" goal still shows Lucy, as in Flash).', diff: [] },
  { title: 'Level 3: skin, photograph 3 Steve', compare: 'Dirt clump, hair and plasters; Steve Staphylococcus on the ePhone.', diff: ['The visible wall at the end of the level sits 50 px past the real barrier in the data; the remake keeps the data and clamps the camera ({N:10.4 #58}).'] },
  { title: 'Level 4: the kitchen, photograph 3 Patty', compare: 'Jam jar, salt pot, cheese and Patty Penicillium standing on the bread stick at her spawn cell.', diff: ['The ePhone shows a Patty portrait built from her idle frames; the original showed no picture at all for this goal ({N:10.1 #19}).'] },
  { title: 'Level 5: skin, wash away 3 Slurm with soap', compare: 'Soap pickups, dirt and hair; the kill-goal picture (Slurm) and the kill icon on the ePhone.', diff: ['A soap bar that hits an on-screen bad microbe pays the documented +3, which never fired in Flash ({N:10.1 #18}).'] },
  { title: 'Level 6: skin, wash away the bad microbes', compare: 'Soap pickups, the sore and Donna Dermatophyte; Slurm and the kill icon on the ePhone.', diff: ['The briefing says "all the bad microbes" but the goal is 3 of 4, as in the original data ({N:10.4 #86}).'] },
  { title: 'Level 7: inside the body, defeat Iggy with white blood cells', compare: 'Red flesh floor and ceiling, villi, white blood cell pickups and Iggy Influenza.', diff: ['The ePhone shows an Iggy portrait; Flash showed Slurm for every kill goal, even this one ({N:10.1 #19}).'] },
  { title: 'Level 8: the kitchen, push Lucy into the milk', compare: 'Salt pot, iced bun, sugar cube and crisps; the milk glass goal picture and no mode icon, as in Flash.', diff: [] },
  { title: 'Level 9: three glasses of milk into yoghurt', compare: 'The glass of milk, salt pot, toast and Lucy; the milk goal picture.', diff: [] },
  { title: 'Level 10: inside the body, the super infection', compare: 'Flesh walls, villi and antibiotic capsules; the super infection on the ePhone. In the moment: red blood cells, the green acid and the flesh ledges.', diff: ['A thrown antibiotic bomb now explodes even off screen, and badges at the screen edge point to bombs still in flight (three on the left in the remake moment), so the level can no longer become unwinnable ({N:11.9}, question 7; {N:10.1 #37}).'] },
];

export const GALLERY = [
  {
    id: 'start', title: 'Splash, cutscene and shrinking zone',
    intro: 'The opening of the game, from the TV on the splash to the moment the chosen child is shrunk. The Flash references are Ruffle captures of the 2009 build and, where it helps, the same screen composed from the original SWFs without its text and logos.',
    entries: [
      {
        id: 'splash-tuning', title: 'Splash: the TV tuning in',
        compare: 'The wooden TV, the room, the static and the green "Tuning" bars. Both run the TV animation to the same 170-frame timeline (6.8 s).',
        diff: ['Enter, Space or a tap skips the tuning to the menu; in Flash the whole animation always played ({N:2.1}).'],
        flash: [{ src: cap('302-sa-splash-5s.png'), caption: 'Ruffle capture 302: splash.swf on its own, about 5 s in.' }, { src: composed('splash-tuning.png'), caption: 'Composed from splash.swf at frame 60 (text left out).' }],
        remake: [{ shot: 'splash-tuning', caption: 'Remake, desktop, frame 118.' }],
      },
      {
        id: 'splash-menu', title: 'Splash: New Game',
        compare: 'The final frame: the studio on the TV, the glossy blue New Game button in the same place, the dial and speaker grille.',
        diff: [
          'The TV shows a "Super Microbe World" title instead of the e-Bug logo, and both e-Bug smileys (podium and glass sticker) are erased; the podium carries a "?" medallion ({N:11.2}; {ART:6}).',
          'Level select, Settings and a language badge are added under the TV; Continue appears once a journey is saved ({N:11.1}, decision 3; {N:2.8} item 7).',
          'No red FPS counter (a debug leftover in the original, {N:10.2 #49}).',
        ],
        flash: [{ src: cap('005-splash-new-game.png'), caption: 'Ruffle capture 005: the splash as the game shows it, frame 170.' }, { src: composed('splash-new-game.png'), caption: 'Composed from splash.swf at frame 170, logo and smileys removed.' }],
        remake: [{ shot: 'splash-menu', caption: 'Remake, desktop (keyboard focus on New Game).' }, { shot: 'splash-menu-phone', caption: 'Remake, phone 915 x 412 with touch.' }],
      },
      {
        id: 'cutscene-host', title: 'Cutscene: the host welcomes the player',
        compare: 'Studio set, host at the left podium on `excited`, Amy on the middle podium and Harry on the right, both scoreboards at 0000, the talkie box at the bottom with the speaker tab.',
        diff: [
          'Line 0 says "Super Microbe World Game Show" instead of "e-Bug Game Show" ({N:11.2}; {N:2.4}).',
          'Name tags on the podia and a Main menu button top left are new; text uses the bundled fonts, where Ruffle falls back to Noto Sans for the original Arial ({N:8.6}).',
        ],
        flash: [{ src: cap('006-cutscene-line0.png'), caption: 'Ruffle capture 006: host line 0.' }, { src: composed('cutscene-host.png'), caption: 'Composed from cutscene_introduction.swf frame 10 (no text or branding).' }],
        remake: [{ shot: 'cutscene-host', caption: 'Remake, desktop, line 0 fully typed.' }],
      },
      {
        id: 'cutscene-choose', title: 'Cutscene: choosing Amy or Harry',
        compare: 'The dimmed room, the host on `stop`, and the hovered child playing `happy` while the other plays `disappointed`.',
        diff: [
          'The original buttons were invisible hit areas; the remake draws a focus frame and a name label and adds a device-aware hint line, so the choice also works with the keyboard and a gamepad ({N:11.1}, decision 10).',
        ],
        flash: [{ src: cap('012-avatar-hover-harry.png'), caption: 'Ruffle capture 012: pointer over Harry.' }, { src: composed('cutscene-avatar-choice.png'), caption: 'Composed from frame 20 (`choose_avatar`), both children on `idle`.' }],
        remake: [{ shot: 'cutscene-choose', caption: 'Remake, desktop: Harry focused with the arrow keys.' }, { shot: 'cutscene-choose-phone', caption: 'Remake, phone: nothing focused until a child is tapped.' }],
      },
      {
        id: 'cutscene-form', title: 'Cutscene: the details form',
        compare: 'The blue microbe background, the Nickname label and field in the same place, the Submit button at (398.65, 275.95).',
        diff: [
          'Only the nickname is asked for, pre-filled with the child\'s name; the age and e-mail fields and the research submission are gone, and a short privacy note replaces them ({N:11.2}; {N:10.2 #47}).',
        ],
        flash: [{ src: cap('014-details-form.png'), caption: 'Ruffle capture 014: the form with its pre-filled "Harry", "2" and "dont@have.one".' }, { src: composed('cutscene-details-form.png'), caption: 'Composed from frame 30 (`get_details`), labels and inputs left out.' }],
        remake: [{ shot: 'cutscene-form', caption: 'Remake, desktop.' }],
      },
      {
        id: 'shrink', title: 'Shrinking zone',
        compare: 'The chosen child on the red and white target under three spotlights, the shrink ray top right, the radial floor. The same 149-frame clip (about 6 s) plays.',
        diff: [
          'After the first time it can be skipped (Enter, Space or a tap), with a hint in the corner ({N:2.5}). This shot opens the scene directly, so the hint shows at once.',
        ],
        flash: [{ src: cap('033-r1-shrink-mid.png'), caption: 'Ruffle capture 033: about 1.5 s in.' }, { src: composed('shrink.png'), caption: 'Composed from the shrinking zone and shrinking_harry.swf at frame 1.' }],
        remake: [{ shot: 'shrink', caption: 'Remake, desktop, frame 38 (about 1.5 s in).' }],
      },
    ],
  },
  {
    id: 'levels', title: 'The platform levels',
    intro: 'Each level shows its opening view and a moment of play. Things that differ on every level, and are not repeated below: the red FPS counter is gone ({N:10.2 #49}); the clock shows 180 from the start instead of "90" and ends at 0 ({N:10.1 #8}); the HUD\'s unused stopwatch is shown next to it and the clock turns red in the last 20 s; the "e-Bug" wordmark is removed from the ePhone ({N:3.24}; {N:11.2}). The Flash moments come from holding Right for 1.5 s and tapping Up; the remake moments are taken part way through each level\'s recorded winning input trace (`web/tests/traces`), so the positions differ. The desktop keyboard layout is shown; the touch layout is further down.',
    entries: [
      {
        id: 'briefing', title: 'The ePhone briefing',
        compare: 'The ePhone grown to landscape over the undimmed level and HUD, the host\'s head, the page text in white, the microbe picture and name.',
        diff: [
          'Spelling slips are corrected and the key names follow the device in use ("Press C", "tap the camera button"); the wording is otherwise the original\'s ({N:7.4}).',
          'The "e-Bug" wordmark on the side of the phone is removed ({N:11.2}). Rapid clicks can no longer skip pages ({N:10.1 #17}).',
        ],
        flash: [{ src: cap('404-lv-alpha_level1-intro-p4.png'), caption: 'Ruffle capture 404: level 1, "Lucy is a bacteria."' }, { src: cap('178-level10-intro-p2.png'), caption: 'Ruffle capture 178: level 10, page 2, the antibiotic capsule.' }],
        remake: [{ shot: 'briefing-level1', caption: 'Remake, desktop: level 1, the same page.' }, { shot: 'briefing-level10', caption: 'Remake, desktop: level 10, page 2.' }, { shot: 'briefing-level1-phone', caption: 'Remake, phone: the photo page names the touch button.' }],
      },
      ...LEVELS.map((L, i) => ({
        id: `level${i + 1}`, title: L.title, compare: L.compare, diff: L.diff,
        rows: [
          { label: 'Opening view', flash: [{ src: cap(`${LEVEL_OPENINGS[i]}.png`), caption: `Ruffle capture ${LEVEL_OPENINGS[i].slice(0, 3)}: the opening view after the ePhone shrank.` }], remake: [{ shot: `level${i + 1}-opening`, caption: 'Remake, desktop: briefing skipped, 40 ticks after the start.' }] },
          { label: 'A moment of play', flash: [{ src: cap(`${LEVEL_MOVING[i]}.png`), caption: `Ruffle capture ${LEVEL_MOVING[i].slice(0, 3)}: after holding Right 1.5 s and tapping Up.` }], remake: [{ shot: `level${i + 1}-play`, caption: 'Remake, desktop: part way through the recorded winning trace.' }] },
        ],
      })),
      {
        id: 'level-complete', title: 'Level complete card',
        compare: 'No Flash counterpart: in the original the portal led straight to the next level\'s briefing, or back to the game show after the last level of a round ({N:3.25}; {N:2.6}).',
        diff: ['Score, photos, time and lives, with Next level, Play again and Quit ({N:2.6}, last point).'],
        flash: [],
        remake: [{ shot: 'level1-complete', caption: 'Remake, desktop: level 1 finished by the trace replay.' }, { shot: 'level10-complete', caption: 'Remake, desktop: level 10, the last level of round 5.' }],
      },
      {
        id: 'summary', title: 'Summary card: out of time, or out of lives',
        compare: 'The white panel with a black border over the frozen level, dimmed by a 50% black layer so the orange turns brown; the heading and the prompt to try again.',
        diff: [
          'A retry restarts the same level with the score kept, where Flash went back to the round\'s first level with its briefing; Settings can restore the original rule ({N:11.9}, question 5; {N:10.2 #48}).',
          'The "out of lives" card is opened here with the parameters the flow passes after a death, over a level part way through; the "out of time" card is real (Amy left alone on level 1 for 180 s, as in capture 509).',
        ],
        flash: [{ src: cap('509-amy-timeout-summary.png'), caption: 'Ruffle capture 509: Amy ran out of time on level 1.' }, { src: composed('summary.png'), caption: 'Composed from summary_page.swf over the level\'s orange (text left out).' }],
        remake: [{ shot: 'summary-time', caption: 'Remake, desktop: Amy ran out of time on level 1.' }, { shot: 'summary-died', caption: 'Remake, desktop: the "You Died!" card over level 5.' }],
      },
    ],
  },
  {
    id: 'controls', title: 'Controls, pause and settings',
    intro: 'The original was played with the mouse and keyboard only and had no pause menu or settings. The remake is designed for touch and keyboard equally, with gamepad support.',
    entries: [
      {
        id: 'layouts', title: 'Keyboard layout on a desktop, touch layout on a phone',
        compare: 'The keyboard layout keeps the original HUD exactly: score top right, hearts below it, clock top centre, ePhone bottom right.',
        diff: [
          'On touch screens the ePhone moves to the left edge and the pause and phone buttons sit top left, because thumbs and the action buttons cover the bottom right; controls fade when they pass over the player or a target ({DOC:screenshots/level1-compare.md|level1-compare.md}; {N:3.24}).',
          'The on-screen controls hide after a key press and come back on the next touch; keys can be remapped in Settings ({N:11.1}, decision 10).',
        ],
        flash: [{ src: cap('038-level1-opening.png'), caption: 'Ruffle capture 038: level 1 (the only layout Flash had).' }],
        remake: [{ shot: 'layout-keyboard-desktop', caption: 'Remake, desktop 1280 x 720, keyboard.' }, { shot: 'layout-touch-phone', caption: 'Remake, phone 915 x 412, touch controls.' }],
      },
      {
        id: 'pause', title: 'Pause menu',
        compare: 'No Flash counterpart.',
        diff: ['Esc, the touch pause button, a hidden tab, a lost window focus or turning a phone to portrait pause the game. The card offers Resume, Restart, Settings, Level select and Quit, every button at least 44 CSS px on a phone ({N:11.1}, decisions 9 and 10).'],
        flash: [],
        remake: [{ shot: 'pause-desktop', caption: 'Remake, desktop: Esc during level 1.' }, { shot: 'pause-phone', caption: 'Remake, phone: the touch pause button.' }, { shot: 'pause-settings-desktop', caption: 'Remake, desktop: Settings opened from the pause card; closing it returns to the card.' }],
      },
      {
        id: 'settings', title: 'Settings',
        compare: 'No Flash counterpart.',
        diff: ['Volumes and mute; blind rounds and the restart rule ({N:11.9}, questions 1 and 5); text size, reduced motion and shake, touch opacity and haptics; remappable keys for every action, including the kitchen tools; nickname and progress reset; language ({N:11.1}, decisions 7 to 10).'],
        flash: [],
        remake: [{ shot: 'settings-sound', caption: 'Remake, desktop: Sound.' }, { shot: 'settings-controls', caption: 'Remake, desktop: Controls, with the key bindings.' }, { shot: 'settings-display-phone', caption: 'Remake, phone: Display.' }],
      },
    ],
  },
  {
    id: 'gameshow', title: 'The game show',
    intro: 'The quiz round after each action. The remake plays the live 2009 flow with blind rounds off by default: each round\'s questions are asked once, scored, after the action ({N:11.9}, question 1; {N:2.3}).',
    entries: [
      {
        id: 'gameshow-title', title: 'Round title card',
        compare: 'No Flash counterpart: the original went straight to the host\'s first line.',
        diff: ['A short title card with the round\'s topic, fanfare and applause.'],
        flash: [],
        remake: [{ shot: 'gameshow-title', caption: 'Remake, desktop: round 1.' }],
      },
      {
        id: 'gameshow-studio', title: 'The studio: the host introduces the round',
        compare: 'The studio set, the host on `excited` at the left podium, the two children on their podia with the scoreboards, the talkie with the host\'s line.',
        diff: [
          'The chosen child stands on the player\'s podium and the other child is the CPU, named after that child; Flash always put Harry on the right and called the CPU "Amy" ({N:10.2 #39}).',
          'The purple and pink "e-Bug" arch lettering and the podium smiley are removed ({N:11.2}; {ART:6}); name tags are added.',
        ],
        flash: [{ src: cap('052-r1-sighted-intro1.png'), caption: 'Ruffle capture 052: round 1, first sighted intro line.' }, { src: composed('gameshow.png'), caption: 'Composed from eBugGameShow.swf (no text or branding).' }],
        remake: [{ shot: 'gameshow-studio', caption: 'Remake, desktop: round 1, first intro line.' }],
      },
      {
        id: 'gameshow-board', title: 'The question board',
        compare: '"Question 1", the statement, "10 Points" and the stopwatch top right, and the Agree, Don\'t Know and Disagree buttons in the same places.',
        diff: [
          'Number badges and key hints (1, 2, 3; arrows and Enter) and a larger text option; the board\'s stopwatch stays still, as in Flash, where it was never driven ({N:10.2 #53}).',
        ],
        flash: [{ src: cap('021-r1-blind-q1-board.png'), caption: 'Ruffle capture 021: round 1, question 1.' }, { src: composed('gameshow-question-board.png'), caption: 'Composed from `question_board` (labels left out).' }],
        remake: [{ shot: 'gameshow-board', caption: 'Remake, desktop: round 1, question 1.' }, { shot: 'gameshow-board-phone', caption: 'Remake, phone: the same board for touch.' }],
      },
      {
        id: 'gameshow-verdict', title: 'The verdict and the CPU\'s turn',
        compare: 'The host\'s reply ("Harry, you chose Disagree. This is the....CORRECT answer."), the host and the player reacting, +10 on the player\'s scoreboard; then the CPU child\'s turn.',
        diff: [
          'Every question gets its verdict and a CPU turn, the last one included; Flash skipped both after the last question of a round ({N:10.2 #41}).',
        ],
        rows: [
          { label: 'Verdict', flash: [{ src: cap('060-r1-sighted-q1-response.png'), caption: 'Ruffle capture 060: the correct answer.' }], remake: [{ shot: 'gameshow-verdict', caption: 'Remake, desktop: the correct answer (Disagree, key 3).' }] },
          { label: 'CPU turn', flash: [{ src: cap('061-r1-sighted-q1-cpu.png'), caption: 'Ruffle capture 061: "Amy, you chose the CORRECT answer."' }], remake: [{ shot: 'gameshow-cpu', caption: 'Remake, desktop: the CPU child\'s answer.' }] },
        ],
      },
    ],
  },
  {
    id: 'kitchen', title: 'The kitchen game (round 4)',
    intro: 'Four levels of putting the shopping away. The Flash kitchen always used Harry, whoever was chosen; the remake uses the chosen child ({N:10.3 #75}). Harry is shown on the desktop for a like-for-like comparison and Amy on the phone.',
    entries: [
      {
        id: 'kitchen-intros', title: 'Level intros',
        compare: 'White Verdana Bold text in the original text fields over the dimmed kitchen, and the blue Click button at the bottom.',
        diff: [
          'The backdrop is the live kitchen with the chosen child, dimmed as the SWFs dim their picture; the original intros were one JPEG with Amy in it ({N:10.3 #77}).',
          'Level 4\'s intro says 120 seconds, which is what the level gives; the original said 45 ({N:10.3 #72}). The button says Next and the prompts follow the device.',
        ],
        rows: [
          { label: 'Level 1', flash: [{ src: cap('123-kitchen-l0-intro1.png'), caption: 'Ruffle capture 123: level 1, screen 1.' }, { src: composed('kitchen-intro.png'), caption: 'Composed from kitchen_game_intro_level_0.swf (text left out).' }], remake: [{ shot: 'kitchen0-intro', caption: 'Remake, desktop: level 1, screen 1.' }] },
          { label: 'Level 2', flash: [{ src: cap('136-kitchen-l1-intro1.png'), caption: 'Ruffle capture 136: level 2, screen 1.' }], remake: [{ shot: 'kitchen1-intro', caption: 'Remake, desktop: level 2, screen 1.' }] },
          { label: 'Level 3', flash: [{ src: cap('149-kitchen-l2-intro1.png'), caption: 'Ruffle capture 149: level 3, screen 1.' }], remake: [{ shot: 'kitchen2-intro', caption: 'Remake, desktop: level 3, screen 1.' }] },
          { label: 'Level 4', flash: [{ src: cap('158-kitchen-l3-intro1.png'), caption: 'Ruffle capture 158: level 4, screen 1.' }], remake: [{ shot: 'kitchen3-intro', caption: 'Remake, desktop: level 4, screen 1.' }] },
        ],
      },
      {
        id: 'kitchen-tutorial', title: 'Level 1 tutorial: where does the spring onion go?',
        compare: 'The undimmed kitchen with the spring onion on the counter, waiting for a click on the right place.',
        diff: ['Every place is one large tap target, reachable with Tab and the arrow keys too ({N:11.1}, decision 11).'],
        flash: [{ src: cap('127-kitchen-l0-tutorial.png'), caption: 'Ruffle capture 127.' }],
        remake: [{ shot: 'kitchen0-tutorial', caption: 'Remake, desktop.' }],
      },
      {
        id: 'kitchen-play', title: 'Putting the shopping away',
        compare: 'The play kitchen: yellow walls, mint units, the open pale blue fridge, chequered floor, bin and sink; the child behind the counter; the clock top right; placed items in the fridge, bowl and cupboard.',
        diff: [
          'A legend for the tissues, cling film and sink with their (remappable) keys; each place lights up as a target ({N:5.13}).',
        ],
        flash: [{ src: cap('131-kitchen-l0-placing.png'), caption: 'Ruffle capture 131: level 1 after three placements.' }, { src: composed('kitchen.png'), caption: 'Composed from kitchen_game_main.swf with Harry on `idle`.' }],
        remake: [{ shot: 'kitchen0-play', caption: 'Remake, desktop: level 1 after three placements.' }, { shot: 'kitchen3-play-phone', caption: 'Remake, phone: Amy on level 4 after six placements.' }],
      },
      {
        id: 'kitchen-hygiene', title: 'Sneezes and cling film',
        compare: 'The child\'s sneeze animation (catch it with the tissues), and the cling film wrapped round meat before it goes in the fridge.',
        diff: [
          'Raw meat now contaminates the hands until they are washed, with its own reminder; the original meant to but used the wrong index ({N:11.9}, question 13; {N:10.3 #69}).',
          'Cling film and sneeze flags no longer stick to a food for later levels ({N:10.3 #67}, {N:10.3 #68}).',
        ],
        rows: [
          { label: 'Sneeze', flash: [{ src: cap('619-kitchen-l1-idle2.png'), caption: 'Ruffle capture 619: a sneeze in level 2.' }], remake: [{ shot: 'kitchen1-sneeze', caption: 'Remake, desktop: a sneeze in level 2.' }] },
          { label: 'Cling film', flash: [{ src: cap('631-kitchen-l2-clingfilm.png'), caption: 'Ruffle capture 631: cling film on the item in level 3.' }], remake: [{ shot: 'kitchen2-clingfilm', caption: 'Remake, desktop: cling film on the first meat in level 3.' }] },
        ],
      },
      {
        id: 'kitchen-outro', title: 'Level results',
        compare: 'The white panel with a black border, "Shopping Placed Correctly" and the rows with their x 10 sums, and the Click button.',
        diff: [
          'Every reminder is listed on the "Microbial Mistakes" page (Flash had four slots), and a fourth page, "Points This Level", uses strings the original had but never showed ({N:10.3 #71}, {N:10.3 #81}).',
        ],
        flash: [{ src: cap('133-kitchen-l0-outro1.png'), caption: 'Ruffle capture 133: level 1, page 1.' }, { src: composed('kitchen-outro.png'), caption: 'Composed from kitchen_game_outro.swf (text left out).' }],
        remake: [{ shot: 'kitchen0-outro1', caption: 'Remake, desktop: level 1, page 1, everything put away correctly.' }],
      },
    ],
  },
  {
    id: 'end', title: 'Ending and level select',
    intro: 'The original ended on one host line that asked the player to reload the page, and its click did nothing. The remake adds a winner card and a level select, as the 2011 evaluation recommended.',
    entries: [
      {
        id: 'ending', title: 'The ending',
        compare: 'The studio with both final scores on the podia and the host\'s closing line in the talkie.',
        diff: [
          'The win line names the real opponent and no longer says "reload this web page"; a tie is a draw with its own line ({N:10.2 #64}; {N:11.9}, question 3).',
          'A winner card follows with the quiz points (which decide the winner, as in Flash), the hoverboard and kitchen points, and Play again, Level select and Main menu ({N:10.2 #46}; {N:11.1}, decision 6).',
        ],
        flash: [{ src: cap('190-final-host-line.png'), caption: 'Ruffle capture 190: "Well done! You beat Amy. ... To play again, reload this web page."' }],
        remake: [{ shot: 'ending-line', caption: 'Remake, desktop: the host\'s win line.' }, { shot: 'ending-card', caption: 'Remake, desktop: the winner card.' }],
      },
      {
        id: 'level-select', title: 'Level select',
        compare: 'No Flash counterpart.',
        diff: ['Every platform level and kitchen level completed once is unlocked and can be played alone, with its best score; reached from the splash, the pause menu and the winner card ({N:11.1}, decision 3; {N:11.9}, question 20).'],
        flash: [],
        remake: [{ shot: 'level-select', caption: 'Remake, desktop: six levels and two kitchen levels unlocked.' }, { shot: 'level-select-phone', caption: 'Remake, phone.' }],
      },
    ],
  },
];

// ---------------------------------------------------------------------------------------------
// HTML
// ---------------------------------------------------------------------------------------------
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// GitHub-style heading anchors for the Markdown files the page links to (they render with these
// on GitHub; opened as plain files, the section number in the link text still finds them).
function headings(rel) {
  const map = new Map();
  for (const line of fs.readFileSync(path.join(ROOT, 'web', rel), 'utf8').split('\n')) {
    const m = /^#{2,4}\s+(.*)$/.exec(line);
    if (!m) continue;
    const text = m[1].trim();
    const num = /^(\d+(?:\.\d+)?[a-z]?)\.?\s/.exec(text);
    const slug = text.toLowerCase().replace(/[^\w\- ]/g, '').replace(/ /g, '-');
    if (num && !map.has(num[1])) map.set(num[1], slug);
  }
  return map;
}
const NOTES = headings('NOTES.md');
const ART = headings('NOTES-art-decisions.md');

function inline(text) {
  let s = esc(text);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\{N:([\d.a-z]+)((?: #\d+[a-z]?)?)\}/g, (_, sec, item) => {
    const slug = NOTES.get(sec);
    if (!slug) throw new Error(`no NOTES section ${sec}`);
    return `<a href="../NOTES.md#${slug}">NOTES ${sec}${item}</a>`;
  });
  s = s.replace(/\{ART:(\d+)\}/g, (_, sec) => {
    const slug = ART.get(sec);
    if (!slug) throw new Error(`no art log section ${sec}`);
    return `<a href="../NOTES-art-decisions.md#${slug}">art log section ${sec}</a>`;
  });
  s = s.replace(/\{DOC:([^|}]+)\|([^}]+)\}/g, (_, p, label) => `<a href="../${p}">${label}</a>`);
  return s;
}

function figure(img, kind) {
  if (!img) return '';
  const { file, w, h, caption, badge } = img;
  return `<figure class="shot ${kind}">
          <a href="${file}"><img src="${file}" width="${w}" height="${h}" loading="lazy" alt="${esc(caption)}"></a>
          <figcaption><span class="badge ${badge.cls}">${badge.text}</span> ${inline(caption)}</figcaption>
        </figure>`;
}

export function renderHtml({ flashImage, remakeImage }) {
  const fl = f => {
    const isCapture = f.src.startsWith('reference/captures/');
    return { ...flashImage(f.src), caption: f.caption, badge: isCapture ? { cls: 'ruffle', text: 'Flash, Ruffle' } : { cls: 'composed', text: 'Flash, composed' } };
  };
  const rm = r => {
    const im = remakeImage(r.shot);
    if (!im) return null;
    const phone = im.w < 1000;
    return { ...im, caption: r.caption, badge: phone ? { cls: 'phone', text: 'Remake, phone' } : { cls: 'desktop', text: 'Remake, desktop' } };
  };
  // One comparison: the main Flash picture next to the main remake picture, then any further
  // pictures (composed screens, other devices, other pages) in a smaller grid below.
  const pair = (flash, remake, label) => {
    const f = flash.map(fl), r = remake.map(rm).filter(Boolean);
    const main = (img, kind, emptyText) => `<div class="col ${kind}">
          <h4>${kind === 'flash' ? 'Flash original (2009)' : 'Remake'}</h4>
          ${img ? figure(img, kind) : `<p class="none">${emptyText}</p>`}
        </div>`;
    const extras = [...f.slice(1).map(i => figure(i, 'flash')), ...r.slice(1).map(i => figure(i, 'remake'))];
    return `
      ${label ? `<h4 class="rowlabel">${esc(label)}</h4>` : ''}
      <div class="pair">
        ${main(f[0], 'flash', 'No counterpart in the original.')}
        ${main(r[0], 'remake', 'Not captured.')}
      </div>${extras.length ? `
      <div class="more">
        ${extras.join('\n        ')}
      </div>` : ''}`;
  };
  let count = 0;
  const sections = GALLERY.map(sec => {
    const entries = sec.entries.map(e => {
      count++;
      const rows = e.rows || [{ flash: e.flash || [], remake: e.remake || [] }];
      const isNew = rows.every(r => !r.flash.length);
      return `
    <article class="entry${isNew ? ' new' : ''}" id="${e.id}">
      <header>
        <h3><a href="#${e.id}">${esc(e.title)}</a>${isNew ? ' <span class="tag">New in the remake</span>' : ''}</h3>
        <p class="compare"><strong>${isNew ? 'Original:' : 'Compare:'}</strong> ${inline(e.compare)}</p>
        ${e.diff && e.diff.length ? `<div class="diff"><strong>${isNew ? 'Remake:' : 'Deliberate differences:'}</strong><ul>${e.diff.map(d => `<li>${inline(d)}</li>`).join('')}</ul></div>` : '<p class="diff none-diff"><strong>Deliberate differences:</strong> none beyond those in the section introduction.</p>'}
      </header>
      ${rows.map(r => pair(r.flash, r.remake, r.label)).join('\n')}
    </article>`;
    }).join('\n');
    return `
  <section id="${sec.id}">
    <h2>${esc(sec.title)}</h2>
    <p class="intro">${inline(sec.intro)}</p>
    ${entries}
  </section>`;
  }).join('\n');
  const toc = GALLERY.map(sec => `<li><a href="#${sec.id}">${esc(sec.title)}</a><ul>${sec.entries.map(e => `<li><a href="#${e.id}">${esc(e.title)}</a></li>`).join('')}</ul></li>`).join('\n      ');
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fidelity Gallery</title>
<meta name="description" content="Every screen of the Super Microbe World remake next to the 2009 Flash original.">
<style>
  :root {
    color-scheme: light dark;
    --bg: #f6f4ee; --surface: #ffffff; --surface-2: #efece3; --ink: #1d1a2e; --muted: #5d5872;
    --line: #dcd7c9; --accent: #c2410c; --link: #1d4ed8;
    --ruffle: #b45309; --composed: #7c3aed; --desktop: #047857; --phone: #0369a1; --new: #be185d;
    --shadow: 0 1px 2px rgba(20, 16, 40, .06), 0 4px 16px rgba(20, 16, 40, .06);
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --bg: #14121f; --surface: #1d1a2d; --surface-2: #26223a; --ink: #eeeaf7; --muted: #a9a3bf;
      --line: #35304c; --accent: #fb923c; --link: #93c5fd;
      --ruffle: #fbbf24; --composed: #c4b5fd; --desktop: #6ee7b7; --phone: #7dd3fc; --new: #f9a8d4;
      --shadow: 0 1px 2px rgba(0, 0, 0, .3), 0 4px 16px rgba(0, 0, 0, .25);
    }
  }
  :root[data-theme="dark"] {
    --bg: #14121f; --surface: #1d1a2d; --surface-2: #26223a; --ink: #eeeaf7; --muted: #a9a3bf;
    --line: #35304c; --accent: #fb923c; --link: #93c5fd;
    --ruffle: #fbbf24; --composed: #c4b5fd; --desktop: #6ee7b7; --phone: #7dd3fc; --new: #f9a8d4;
    --shadow: 0 1px 2px rgba(0, 0, 0, .3), 0 4px 16px rgba(0, 0, 0, .25);
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  a { color: var(--link); }
  code { font: .9em ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; background: var(--surface-2); padding: .05em .3em; border-radius: 4px; }
  .wrap { max-width: 1320px; margin: 0 auto; padding: 0 16px 64px; }
  .top { padding: 40px 0 8px; }
  .top h1 { font-size: clamp(1.7rem, 3.2vw, 2.4rem); line-height: 1.15; margin: 0 0 8px; letter-spacing: -.01em; }
  .top .lede { max-width: 72ch; color: var(--muted); margin: 0 0 16px; }
  .legend { display: flex; flex-wrap: wrap; gap: 8px 16px; margin: 16px 0; padding: 0; list-style: none; font-size: .9rem; color: var(--muted); }
  .badge { display: inline-block; font-size: .72rem; font-weight: 650; letter-spacing: .02em; padding: 1px 8px; border-radius: 999px; border: 1px solid currentColor; white-space: nowrap; vertical-align: 1px; }
  .badge.ruffle { color: var(--ruffle); } .badge.composed { color: var(--composed); } .badge.desktop { color: var(--desktop); } .badge.phone { color: var(--phone); }
  nav.toc { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 12px 20px; box-shadow: var(--shadow); margin: 8px 0 32px; }
  nav.toc > ul { columns: 3 260px; column-gap: 32px; margin: 0; padding: 0; list-style: none; }
  nav.toc > ul > li { break-inside: avoid; margin: 0 0 14px; padding-top: 4px; font-weight: 650; }
  nav.toc ul ul { list-style: none; padding: 0; margin: 4px 0 0; font-weight: 400; font-size: .9rem; }
  nav.toc a { text-decoration: none; } nav.toc a:hover { text-decoration: underline; }
  section { margin-top: 48px; }
  section > h2 { font-size: 1.6rem; margin: 0 0 4px; border-bottom: 2px solid var(--accent); padding-bottom: 6px; }
  section > .intro { max-width: 90ch; color: var(--muted); }
  .entry { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 20px; margin: 20px 0; box-shadow: var(--shadow); scroll-margin-top: 12px; }
  .entry h3 { margin: 0 0 8px; font-size: 1.2rem; }
  .entry h3 a { color: inherit; text-decoration: none; }
  .entry h3 a:hover { text-decoration: underline; }
  .tag { font-size: .72rem; font-weight: 650; color: var(--new); border: 1px solid currentColor; border-radius: 999px; padding: 1px 8px; vertical-align: 3px; }
  .compare, .diff { margin: 6px 0; max-width: 100ch; }
  .diff ul { margin: 4px 0 0; padding-left: 20px; }
  .diff li { margin: 2px 0; }
  .none-diff { color: var(--muted); }
  .rowlabel { margin: 18px 0 0; font-size: .95rem; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 12px; }
  .col h4 { margin: 0 0 8px; font-size: .8rem; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); }
  .col { min-width: 0; }
  .more { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 16px; margin-top: 16px; padding-top: 14px; border-top: 1px dashed var(--line); }
  .more .shot figcaption { font-size: .8rem; }
  .shot { margin: 0; }
  .shot img { display: block; width: 100%; height: auto; border-radius: 8px; border: 1px solid var(--line); background: #000; }
  .shot figcaption { font-size: .85rem; color: var(--muted); margin-top: 6px; }
  .none { color: var(--muted); font-style: italic; margin: 0; padding: 24px; border: 1px dashed var(--line); border-radius: 8px; text-align: center; }
  footer { margin-top: 56px; padding-top: 16px; border-top: 1px solid var(--line); color: var(--muted); font-size: .92rem; }
  footer h2 { color: var(--ink); font-size: 1.1rem; }
  @media (max-width: 760px) { .pair { grid-template-columns: 1fr; } .entry { padding: 14px; } nav.toc > ul { columns: 1; } }
</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    <h1>Super Microbe World: fidelity gallery</h1>
    <p class="lede">Every screen of the browser remake next to the 2009 Flash original it recreates (the e-Bug Junior Game by David Farrell). Each pair says what should match and lists the differences that are deliberate, with a link to the decision in the design notes. ${count} comparisons in all; click any picture to open it at full size.</p>
    <ul class="legend">
      <li><span class="badge ruffle">Flash, Ruffle</span> the original SWFs running in Ruffle (<code>reference/captures</code>)</li>
      <li><span class="badge composed">Flash, composed</span> the same screen drawn from the original SWFs, without text or logos (<code>screenshots/reference</code>)</li>
      <li><span class="badge desktop">Remake, desktop</span> 1280 x 720, keyboard</li>
      <li><span class="badge phone">Remake, phone</span> 915 x 412 landscape, touch</li>
    </ul>
  </header>
  <nav class="toc" aria-label="Contents">
    <ul>
      ${toc}
    </ul>
  </nav>
${sections}
  <footer>
    <h2>About these pictures</h2>
    <ul>
      <li><strong>Ruffle captures</strong> were made by <code>tools/ruffle/journey.cjs</code> (see <a href="../../reference/captures/index.md">reference/captures/index.md</a> and <code>reference/analysis/flash-ruffle.md</code>). Ruffle substitutes Noto Sans for the Arial and Verdana the original took from the player's computer, so treat their typography as layout only (<a href="../NOTES.md#${NOTES.get('8.6')}">NOTES 8.6</a>). The e-Bug logos visible in them are the original's; the remake removes them (<a href="../NOTES.md#${NOTES.get('11.2')}">NOTES 11.2</a>).</li>
      <li><strong>Composed screens</strong> come from <code>tools/swf-sheet/compose.mjs</code>: every element is a Ruffle render of the original symbol and every position comes from the SWFs, with dynamic text, logos and animation phase left out (<a href="reference/index.md">screenshots/reference/index.md</a>).</li>
      <li><strong>Remake screenshots</strong> are taken by <code>tools/build-gallery.mjs</code> from the game in <code>web/</code>, driven through real key presses and touch taps with the engine stepped tick by tick (<code>?manual=1</code>), so they are the same on every run. Regenerate with <code>node tools/build-gallery.mjs</code> (<code>--only &lt;id&gt;</code> for one session, <code>--html-only</code> for this page).</li>
      <li>The older level 1 study, with the touch and keyboard layouts side by side, is in <a href="level1-compare.md">level1-compare.md</a>.</li>
      <li>Not shown: the preloader (the remake loads per area with a progress bar instead), the language chooser on first run, and the Flash-era prototypes in the capture set (level editor, older platformer and fridge game builds), which the remake does not recreate.</li>
    </ul>
  </footer>
</div>
</body>
</html>
`;
}
