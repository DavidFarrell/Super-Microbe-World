// Converts the live 2009 quiz and host-introduction XML (11 languages, as deployed; copied into
// the Unity repo under Assets/Resources/TextFiles) into one JSON file per language:
//   web/data/quiz/<code>.json = { code, source, name, intro: [statement], rounds: [{ round, name,
//     intro: { blind: [..], normal: [..] }, questions: [{ text, score, value, answers: [{ label, value }] }] }] }
// Answer values: 1 correct, -1 wrong, 0 neutral ("don't know"). The original parser read answers by
// position, so the <lable>/<statment> typos are accepted here too.
// Branding: "e-Bug" becomes "Super Microbe World" (NOTES.md 11.9 #11); every replacement is counted.
// Per-language corrections of known 2009 data defects (CORRECTIONS below): each replaces one exact
// sentence and must match exactly the expected number of times, or the conversion fails, so a
// correction can never silently stop applying or spread (NOTES.md 10.2 #65, #66, #87).
// Also updates web/data/lang/manifest.json with the language list.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(ROOT, 'Assets/Resources/TextFiles');
const OUT = path.join(ROOT, 'web/data/quiz');

const LANGS = [
  ['en_en', 'en', 'English'],
  ['bg_fl', 'bg_fl', 'Nederlands (België)'],
  ['bg_fr', 'bg_fr', 'Français (Belgique)'],
  ['cz_cz', 'cz_cz', 'Čeština'],
  ['dk_dk', 'dk_dk', 'Dansk'],
  ['fr_fr', 'fr_fr', 'Français'],
  ['gk_gk', 'gk_gk', 'Ελληνικά'],
  ['it_it', 'it_it', 'Italiano'],
  ['pl_pl', 'pl_pl', 'Polski'],
  ['por_por', 'por_por', 'Português'],
  ['sp_sp', 'sp_sp', 'Español'],
];

let brandReplacements = 0;
const decode = s => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ').trim();
const brand = s => s.replace(/e-?Bug/gi, () => { brandReplacements++; return 'Super Microbe World'; });
const text = s => brand(decode(s));
const all = (xml, tags) => [...xml.matchAll(new RegExp(`<(${tags})\\b[^>]*>([\\s\\S]*?)</\\1>`, 'g'))].map(m => m[2]);
const one = (xml, tags) => all(xml, tags)[0];

// Documented per-language corrections: { language code: [{ from, to, count, why }] }, applied to
// every converted string of that language (intro lines, questions, labels) after branding.
const CORRECTIONS = {
  // por_por_gameshow_round1.xml and _round2.xml carry the Polish points line in the sighted
  // intro (rounds[0].intro.normal[2], rounds[1].intro.normal[1]). Replaced by the Portuguese
  // translator's own points line from rounds 3 to 5 without "Lembra-te que" ("Remember"), which
  // says the same as the English line. pl_pl has the sentence legitimately and is untouched.
  por_por: [{
    from: 'Za prawidłową odpowiedź otrzymasz 10 punktów, ale jeśli odpowiesz źle, wtedy punkty otrzymuje przeciwnik.',
    to: 'Ganhas 10 pontos por cada resposta certa. Se estiver errada o outro jogador é que ganha.',
    count: 2, why: 'Polish points line in the Portuguese round 1 and 2 intros',
  }, {
    // por_por_gameshow_round4.xml question id 2 (round 4 question 3) holds the blind-round
    // notice ("As this is a blind question, you'll only find out the result at the end.") where
    // the question should be; its answer values are those of the English "It is safe to put
    // opened tins in the fridge." (disagree is right). Replaced by a Portuguese rendering of
    // that question in the translator's register ("frigorífico", as in questions 2 and 5);
    // a native-speaker check is a follow-up, as for the brand line (NOTES.md 10.2 #87, 11.9 #11).
    from: 'Como é uma pergunta cega, só saberás o resultado no final.',
    to: 'É seguro guardar latas abertas no frigorífico.',
    count: 1, why: 'blind notice in place of the opened-tins question, round 4 question 3',
  }],
  // en_en_gameshow_round1.xml and _round2.xml: "Ready ?" (rounds 3 to 5 have "Ready?"; NOTES.md
  // 6.8). French "Prêt ?" is correct French spacing and is not touched.
  en: [{ from: 'Ready ?', to: 'Ready?', count: 2, why: 'space before the question mark in the English round 1 and 2 intros' }],
};

function correct(code, data) {
  for (const c of CORRECTIONS[code] || []) {
    let n = 0;
    const fix = s => (s === c.from ? (n++, c.to) : s);
    data.intro = data.intro.map(fix);
    for (const r of data.rounds) {
      r.name = fix(r.name);
      r.intro.blind = r.intro.blind.map(fix);
      r.intro.normal = r.intro.normal.map(fix);
      for (const q of r.questions) { q.text = fix(q.text); for (const a of q.answers) a.label = fix(a.label); }
    }
    if (n !== c.count) throw new Error(`${code}: correction "${c.why}" matched ${n} time(s), expected ${c.count}`);
    corrections.push(`${code}: ${c.why} (${n})`);
  }
}
const corrections = [];

function readXml(file) {
  return fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
}

function parseRound(xml, n) {
  const introXml = one(xml, 'intro_text') || '';
  return {
    round: n,
    name: text(one(xml, 'name') || ''),
    intro: {
      blind: all(one(introXml, 'blind') || '', 'statement|statment').map(text),
      normal: all(one(introXml, 'normal') || '', 'statement|statment').map(text),
    },
    questions: all(one(xml, 'questions') || '', 'question').map(q => ({
      text: text(one(q, 'text') || ''),
      score: Number(one(q, 'score') ?? 10),
      value: Number(one(q, 'value') ?? 1),
      answers: all(one(q, 'answers') || '', 'answer').map(a => ({
        label: text(one(a, 'label|lable') || ''),
        value: Number(one(a, 'value') ?? 0),
      })),
    })),
  };
}

fs.mkdirSync(OUT, { recursive: true });
const summary = [];
for (const [xmlCode, code, name] of LANGS) {
  const rounds = [];
  for (let n = 1; n <= 5; n++) {
    const f = path.join(SRC, 'quiz', `${xmlCode}_gameshow_round${n}.xml`);
    if (!fs.existsSync(f)) throw new Error(`missing ${f}`);
    rounds.push(parseRound(readXml(f), n));
  }
  const convFile = path.join(SRC, 'conversations', `${xmlCode}_introductions.xml`);
  const intro = fs.existsSync(convFile) ? all(readXml(convFile), 'statement|statment').map(text) : [];
  const data = { code, source: `${xmlCode}_gameshow_round1-5.xml + ${xmlCode}_introductions.xml (live 2009 build)`, name, intro, rounds };
  correct(code, data);
  for (const r of rounds) for (const q of r.questions) {
    if (q.answers.length !== 3) throw new Error(`${code} round ${r.round}: question has ${q.answers.length} answers`);
  }
  fs.writeFileSync(path.join(OUT, `${code}.json`), JSON.stringify(data, null, 1) + '\n');
  summary.push(`${code.padEnd(8)} ${name.padEnd(22)} rounds ${rounds.map(r => r.questions.length).join('/')}  intro ${intro.length}`);
}

const manifestPath = path.join(ROOT, 'web/data/lang/manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.languages = LANGS.map(l => l[1]);
manifest.names = Object.fromEntries(LANGS.map(l => [l[1], l[2]]));
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

console.log(summary.join('\n'));
console.log(`brand replacements: ${brandReplacements}`);
console.log(`corrections: ${corrections.join('; ') || 'none'}`);
