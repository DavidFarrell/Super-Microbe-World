#!/usr/bin/env node
// Extracts every translatable string table of the Flash e-Bug Junior Game into
// reference/analysis/translations.json as { lang: { key: string } }.
//
// Sources (see reference/analysis/flash-flow.md, section 5, for provenance):
//   1. Assets/Resources/TextFiles/{quiz,conversations}/<lang>_*.xml in the Unity repo.
//      These 11 language sets were generated from the live Flash Translations.as by
//      OutputXMLFilesMovie.fla (reference/docs/junior-game-documentation.md:1984-2118).
//      The Unity copies of alpha_gameshow_round*.xml are ignored (round 4 is French).
//   2. reference/Junior_Game/levels/alpha_gameshow_round{1..5}.xml and
//      levels/conversations/en_en_introductions.xml: the 2009 English build ("alpha").
//   3. English UI strings hard-coded in the 2009 ActionScript and SWF timelines
//      (listed below with path:line or SWF sprite/frame citations).
//   4. The few live Translations.as entries quoted in the documentation
//      (junior-game-documentation.md:1946-1960).
//   5. Optionally, a real Translations.as if one is ever found:
//        node tools/extract-translations.mjs --translations path/to/Translations.as
//      Lines like  translationText['cz_cz'][12] = "...";  become key "translations.12"
//      and, where  public static var STRING_X : Number = 12;  exists, also "STRING_X".
//
// XML is read positionally, exactly as GameShowQuestionLoader.parseRound and
// CutSceneXMLParser.parseXML do, so the <statment> and <lable> typos are harmless.
//
// Usage: node tools/extract-translations.mjs [--out file] [--translations file]

import fs from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const args = process.argv.slice(2);
const argVal = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const OUT = path.resolve(argVal('--out') || path.join(REPO, 'reference/analysis/translations.json'));
const TRANSLATIONS_AS = argVal('--translations');
const UNITY_TEXT = path.join(REPO, 'Assets/Resources/TextFiles');
const FLASH_LEVELS = path.join(REPO, 'reference/Junior_Game/levels');

// ---------------------------------------------------------------- tiny XML parser
function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (m, e) => {
    const l = e.toLowerCase();
    if (l[0] === '#') return String.fromCodePoint(l[1] === 'x' ? parseInt(l.slice(2), 16) : parseInt(l.slice(1), 10));
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }[l];
  });
}
function parseXml(src) {
  src = src.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const root = { name: '#document', attrs: {}, children: [] };
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<\/([^\s>]+)\s*>|<([^\s>\/]+)((?:\s+[^\s=>\/]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(src))) {
    const top = stack[stack.length - 1];
    if (m[1] !== undefined) top.children.push({ text: m[1] });
    else if (m[2]) { if (stack.length > 1) stack.pop(); }
    else if (m[3]) {
      const attrs = {};
      for (const a of (m[4] || '').matchAll(/([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[a[1]] = decodeEntities(a[2] ?? a[3]);
      const el = { name: m[3], attrs, children: [] };
      top.children.push(el);
      if (!m[5]) stack.push(el);
    } else if (m[6] !== undefined) top.children.push({ text: decodeEntities(m[6]) });
  }
  return root;
}
// Flash XML with ignoreWhite = true drops whitespace-only text nodes.
const kids = (el) => (el?.children || []).filter((c) => c.name || (c.text !== undefined && c.text.trim() !== ''));
const elems = (el) => (el?.children || []).filter((c) => c.name);
// firstChild.nodeValue: the text of the first child node, or undefined when empty.
const firstText = (el) => { const k = kids(el)[0]; return k && k.text !== undefined ? k.text : undefined; };
const docElement = (doc) => elems(doc)[0];

// ---------------------------------------------------------------- readers (positional)
function readRound(file) {
  const r = docElement(parseXml(fs.readFileSync(file, 'utf8')));
  const c = elems(r); // 0 name, 1 round_id, 2 next_round, 3 intro_text, 4 questions
  const intro = elems(c[3]);
  const out = {
    name: firstText(c[0]),
    roundId: firstText(c[1]),
    next: firstText(c[2]),
    blind: elems(intro[0]).map(firstText),
    normal: elems(intro[1]).map(firstText),
    questions: elems(c[4]).map((q) => {
      const qc = elems(q); // 0 type, 1 score, 2 value, 3 text, 4 answers
      return {
        id: q.attrs.id,
        type: firstText(qc[0]),
        score: firstText(qc[1]),
        value: firstText(qc[2]),
        text: firstText(qc[3]),
        answers: elems(qc[4]).map((a) => { const ac = elems(a); return { label: firstText(ac[0]), value: firstText(ac[1]) }; }),
      };
    }),
  };
  return out;
}
function readConversation(file) {
  const r = docElement(parseXml(fs.readFileSync(file, 'utf8')));
  return elems(r).map(firstText);
}

function addRoundKeys(table, n, round) {
  const p = `quiz.round${n}.`;
  table[p + 'name'] = round.name ?? '';
  round.blind.forEach((s, i) => { table[`${p}blind.${i}`] = s ?? ''; });
  round.normal.forEach((s, i) => { table[`${p}normal.${i}`] = s ?? ''; });
  round.questions.forEach((q, i) => {
    table[`${p}q${i}.text`] = q.text ?? '';
    q.answers.forEach((a, j) => { table[`${p}q${i}.answer.${j}.label`] = a.label ?? ''; });
  });
}
function mostCommon(list) {
  const counts = new Map();
  for (const v of list) if (v !== undefined) counts.set(v, (counts.get(v) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}
function addAnswerLabelKeys(table, rounds) {
  const byIndex = [[], [], []];
  for (const r of rounds) for (const q of r.questions) q.answers.forEach((a, j) => byIndex[j]?.push(a.label));
  const [agree, dunno, disagree] = byIndex.map(mostCommon);
  if (agree !== undefined) table['ui.agree'] = agree;
  if (dunno !== undefined) table['ui.dontKnow'] = dunno;
  if (disagree !== undefined) table['ui.disagree'] = disagree;
}

const result = {};
const report = { languages: [], integrity: [] };

// ---------------------------------------------------------------- 1. live language XML (Unity copy)
const quizDir = path.join(UNITY_TEXT, 'quiz');
const convDir = path.join(UNITY_TEXT, 'conversations');
const langs = [...new Set(fs.readdirSync(quizDir).map((f) => f.match(/^([a-z]+_[a-z]+)_gameshow_round\d\.xml$/)?.[1]).filter(Boolean))]
  .filter((l) => l !== 'alpha').sort((a, b) => (a === 'en_en' ? -1 : b === 'en_en' ? 1 : a.localeCompare(b)));
const liveRounds = {};
for (const lang of langs) {
  const t = {};
  const conv = path.join(convDir, `${lang}_introductions.xml`);
  if (fs.existsSync(conv)) readConversation(conv).forEach((s, i) => { t[`conversation.${i}`] = s ?? ''; });
  const rounds = [];
  for (let n = 1; n <= 5; n++) {
    const f = path.join(quizDir, `${lang}_gameshow_round${n}.xml`);
    if (!fs.existsSync(f)) continue;
    const r = readRound(f);
    rounds.push(r);
    addRoundKeys(t, n, r);
  }
  addAnswerLabelKeys(t, rounds);
  liveRounds[lang] = rounds;
  result[lang] = t;
  report.languages.push(lang);
}

// Integrity check: answer values, scores and question counts versus en_en.
const ref = liveRounds.en_en;
if (ref) {
  for (const lang of langs) {
    liveRounds[lang].forEach((r, ri) => {
      const rr = ref[ri];
      if (r.questions.length !== rr.questions.length) report.integrity.push(`${lang} round${ri + 1}: ${r.questions.length} questions vs en_en ${rr.questions.length}`);
      if (r.blind.length !== rr.blind.length || r.normal.length !== rr.normal.length) report.integrity.push(`${lang} round${ri + 1}: blind/normal statements ${r.blind.length}/${r.normal.length} vs en_en ${rr.blind.length}/${rr.normal.length}`);
      if (r.next.replace(lang, 'xx') !== rr.next.replace('en_en', 'xx')) report.integrity.push(`${lang} round${ri + 1}: next_round ${r.next}`);
      r.questions.forEach((q, qi) => {
        const rq = rr.questions[qi];
        if (!rq) return;
        const v = q.answers.map((a) => a.value).join(','), rv = rq.answers.map((a) => a.value).join(',');
        if (v !== rv) report.integrity.push(`${lang} round${ri + 1} q${qi}: answer values [${v}] vs en_en [${rv}]`);
        if (q.score !== rq.score) report.integrity.push(`${lang} round${ri + 1} q${qi}: score ${q.score} vs ${rq.score}`);
      });
    });
  }
}

// ---------------------------------------------------------------- 2. the 2009 build ("alpha")
{
  const t = {};
  readConversation(path.join(FLASH_LEVELS, 'conversations/en_en_introductions.xml')).forEach((s, i) => { t[`conversation.${i}`] = s ?? ''; });
  const rounds = [];
  for (let n = 1; n <= 5; n++) { const r = readRound(path.join(FLASH_LEVELS, `alpha_gameshow_round${n}.xml`)); rounds.push(r); addRoundKeys(t, n, r); }
  addAnswerLabelKeys(t, rounds);
  result.alpha = t;
}

// ---------------------------------------------------------------- 3. hard-coded English UI strings (2009 build)
const kitchenGameAs = fs.readFileSync(path.join(REPO, 'reference/Junior_Game/src/ebug/junior/fridge/KitchenGame.as'), 'utf8');
const camel = (s) => s.replace(/[^A-Za-z0-9]+(.)?/g, (m, c) => (c ? c.toUpperCase() : '')).replace(/^./, (c) => c.toLowerCase());
const outro = {};
// populateOutroStrings, KitchenGame.as:1163-1202 (the commented copies at 204-225 and 316-336 are skipped)
const popStart = kitchenGameAs.indexOf('function populateOutroStrings');
const popEnd = kitchenGameAs.indexOf('function populateValidLocations');
for (const m of kitchenGameAs.slice(popStart, popEnd).matchAll(/outroStrings\["([^"]+)"\]\s*=\s*"((?:[^"\\]|\\.)*)";/g)) outro[`kitchen.outro.${camel(m[1])}`] = m[2];

const UI_EN = {
  // loading screen: GameController.as:60 ("Looding" typo), GameController.as:80, AssetLibrary (compiled into movies/e-Bug Junior Game.swf, sprite 103)
  'loader.loadingWord': 'Looding',
  'loader.initialText': 'loading...',
  'loader.kitchenLoadingWord': 'Loading', // KitchenGame.as:112
  // splash: movies/splash.swf DefineEditText 3 (button label) and 23
  'splash.newGame': 'New Game',
  'splash.tuning': 'Tuning',
  // cutscene: movies/cutscene_introduction.swf frame 30 static button text
  'cutscene.submit': 'Submit',
  // game show: GameShow.as
  'gameshow.hostName': 'Gameshow Host', // GameShow.as:150
  'gameshow.questionNumber': 'Question number ', // GameShow.as:179
  'gameshow.boardHeading': 'Question ', // GameShow.as:185
  'gameshow.boardPoints': ' Points', // GameShow.as:187
  'gameshow.youChose': ', you chose ', // GameShow.as:207 (prefixed by player nickname)
  'gameshow.choiceAgree': 'Agree.', // GameShow.as:209
  'gameshow.choiceDontKnow': "Don't Know.", // GameShow.as:211
  'gameshow.choiceDisagree': 'Disagree.', // GameShow.as:213
  'gameshow.blindNotice': "\nBecause this is a Blind question round, you'll find out how you did later.", // GameShow.as:217
  'gameshow.thisIsThe': '\nThis is the....', // GameShow.as:246
  'gameshow.wrongAnswer': 'WRONG answer!', // GameShow.as:250, 314
  'gameshow.safeAnswer': 'SAFE answer.', // GameShow.as:259, 318
  'gameshow.correctAnswer': 'CORRECT answer.', // GameShow.as:265, 320
  'gameshow.cpuYouChoseThe': ', you chose the ', // GameShow.as:307 (prefixed by CPU name)
  'gameshow.stepRightThisWay': 'Step right this way and prepare to enter the world of microbes!', // GameShow.as:289
  'gameshow.wellDoneYouBeat': 'Well done! You beat ', // GameShow.as:453 (followed by cpu.nickname)
  'gameshow.thankYouForPlaying': '.  Thank you for playing.  To play again, reload this web page.', // GameShow.as:453
  'gameshow.youLost': "At the end of the game, I'm sorry to say you lost.  Thank you for playing.  To play again, reload this web page.", // GameShow.as:455
  // question board static button text: movies/eBugGameShow.swf DefineText 68, 73, 75 (sprite 77 "question_board")
  'board.agree': 'Agree',
  'board.dontKnow': "Don't Know",
  'board.disagree': 'Disagree',
  // platform game end-of-round page: GameController.as:286-295, movies/summary_page.swf
  'summary.youDied': 'You Died!',
  'summary.outOfTime': 'You ran out of time.',
  'summary.clickToTryAgain': 'click to try again',
  'summary.heading': 'Things to remember', // summary_page.swf DefineEditText 5 (overwritten at run time)
  'summary.click': 'Click', // summary_page.swf DefineText 12
  // kitchen outro static texts: movies/kitchen_game_outro.swf DefineEditText 11, 48, 84 and DefineText 6
  'kitchen.outroStatic.itemsPlacedCorrectly': 'Items Placed Correctly',
  'kitchen.outroStatic.itemsPlacedIncorrectly': 'Items Placed Incorrectly',
  'kitchen.outroStatic.thingsToRemember': 'Things to remember',
  'kitchen.outroStatic.click': 'Click',
  'kitchen.introStatic.click': 'Click', // kitchen_game_intro_level_N.swf DefineText 8
};
// Kitchen level intro screens: strings.push(...) in frame 1 ("init") of each movies/kitchen_game_intro_level_N.swf
const KITCHEN_INTROS = [
  [ // kitchen_game_intro_level_0.swf
    'In this mini-game, you have to put away the shopping.',
    "Sounds simple, doesn't it?",
    'But be careful!',
    'You need to put things in the right place.',
    'Here are the rules:',
    'Vegetables go in the bottom drawer of the fridge.',
    'Drinks and Yogurt go in the fridge door.',
    'On the next screen, click on the correct place in the fridge to put away the spring onion.',
    'Wrong!  Try again.',
    'Excellent, well done.',
    'Try to put away 10 things before the timer runs out.',
    "Click the button when you're ready to start the level...",
  ],
  [ // kitchen_game_intro_level_1.swf
    'Level 2',
    'This time, you also have to put away fruit, tins and bread.',
    'Remember, vegetables go in the bottom drawers in the fridge.',
    'Liquids like milk, yogurt and juice go in the fridge door.',
    'There are some new things this time.',
    'If you see fruit, put it in the fruit bowl.',
    'Tins and bread go in the cupboard.',
    "One more thing - if you start to sneeze, click on the tissues quick! Otherwise, you'll cover the food in harmful microbes.",
    'Click on the button when ready to start.',
  ],
  [ // kitchen_game_intro_level_2.swf
    'Level 3',
    'Things are about to get tricky...',
    'This time, you also have to put away meat.',
    'Meat should always be kept away from vegetables to prevent microbes from spreading.',
    'Click on the cling film to cover meat before putting it in the fridge.',
    'Cooked meat has to have its own shelf.',
    'Raw meat needs to have a solid shelf.  So put the raw meat on the bottom shelf, above the fridge drawers.',
    'Also, if you find cheese, it goes on the top or middle shelf.  ',
    'Ready?',
  ],
  [ // kitchen_game_intro_level_3.swf
    'Level 4',
    "Let's see what you can do.",
    'You know all the rules now. ',
    'Can you put away all the food correctly?',
    'You have 45 seconds this time.',
    'You have to put away 20 items.',
    'Ready?',
  ],
];
const kitchenIntro = {};
KITCHEN_INTROS.forEach((list, lvl) => list.forEach((s, i) => { kitchenIntro[`kitchen.intro${lvl}.${i}`] = s; }));

// EBugStrings.as: an unused 2008 prototype string table (case N: return "...").
const ebugStrings = {};
{
  const src = fs.readFileSync(path.join(REPO, 'reference/Junior_Game/src/ebug/EBugStrings.as'), 'utf8');
  for (const m of src.matchAll(/case\s+(\d+):\s*return\s+"((?:[^"\\]|\\.)*)";/g)) if (m[2] !== '') ebugStrings[`ebugStrings.${m[1]}`] = m[2];
}

Object.assign(result.alpha, UI_EN, outro, kitchenIntro, ebugStrings);
// en_en: the live build's XML plus the 2009 English UI strings as the only English UI source.
for (const [k, v] of Object.entries({ ...UI_EN, ...outro, ...kitchenIntro })) if (!(k in result.en_en)) result.en_en[k] = v;

// ---------------------------------------------------------------- 4. live Translations.as entries quoted in the documentation
// junior-game-documentation.md:1946-1947 and 1956-1957 (indices 0 and 1; 2-4 duplicate conversation.0-2)
Object.assign(result.en_en, { 'ui.languageName': 'English ', 'ui.newGame': 'New Game' });
if (result.cz_cz) Object.assign(result.cz_cz, { 'ui.languageName': 'cz_cz', 'ui.newGame': 'Nová hra' });

// ---------------------------------------------------------------- 5. optional real Translations.as
if (TRANSLATIONS_AS) {
  const src = fs.readFileSync(TRANSLATIONS_AS, 'utf8');
  const names = {};
  for (const m of src.matchAll(/static\s+var\s+(STRING_[A-Z0-9_]+)\s*:\s*Number\s*=\s*(\d+)\s*;/g)) names[m[2]] = m[1];
  for (const m of src.matchAll(/translationText\s*\[\s*['"]([a-z]+_[a-z]+)['"]\s*\]\s*\[\s*(\d+)\s*\]\s*=\s*"((?:[^"\\]|\\.)*)"\s*;/g)) {
    const [, lang, idx, raw] = m;
    const s = JSON.parse('"' + raw.replace(/\n/g, '\\n') + '"');
    (result[lang] ||= {})[`translations.${idx}`] = s;
    if (names[idx]) result[lang][names[idx]] = s;
  }
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n');
const counts = Object.fromEntries(Object.entries(result).map(([l, t]) => [l, Object.keys(t).length]));
console.log(JSON.stringify({ out: path.relative(REPO, OUT), keys: counts, integrity: report.integrity }, null, 1));
