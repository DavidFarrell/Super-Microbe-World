// Content checks (no browser needed; everything is read from disk as the game serves it):
//   (a) every quiz file (web/data/quiz/<code>.json: the host's introduction and the five quiz
//       rounds) parses, has 5 rounds with 4, 4, 2, 5 and 6 questions (checked against the live
//       build's XML in Assets/Resources/TextFiles/quiz/), three answers per question whose values
//       are -1, 0 and 1 once each, no empty strings apart from the one the live data has, and no
//       question that is really a host line (a round intro line or a blind-round notice);
//   (b) every i18n key the code names (t('...') / tp('...') literals, key-shaped string literals
//       such as button label tables, and the fixed prefixes of computed keys) exists in the
//       English tables, and no key is defined twice with different text;
//   (c) every level JSON parses and builds a running PlatformGame; the play order and rounds agree;
//   (d) every atlas file named by web/data/atlas/index.json exists and matches its sheet JSON;
//   (e) precache.json and sw.js carry the current build hash (otherwise returning players' service
//       workers never reinstall and keep serving the old build offline).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PlatformGame } from '../js/platformer/game.js';

const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const readJson = (ctx, rel) => JSON.parse(fs.readFileSync(path.join(ctx.web, rel), 'utf8'));

// The live 2009 build's quiz files (one per language and round) and the codes the port uses.
const XML_DIR = 'Assets/Resources/TextFiles/quiz';
const xmlCode = code => (code === 'en' ? 'en_en' : code);
const QUESTIONS = [4, 4, 2, 5, 6];
// Words of the host's blind-round and bonus notices in the 11 languages (blind, cega, a ciegas,
// ignote, ślepych, aveugle, τυφλ-, naslepo, bonus): none belongs in a question.
const NOTICE = /blind|cega|ciega|cieca|ignot|ślep|slep|aveugle|τυφλ|bonus|bónus|bonifica/i;

// All .js files under web/js.
function jsFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) jsFiles(p, out); else if (p.endsWith('.js')) out.push(p);
  }
  return out;
}

// Every string in a JSON value with its path.
function strings(v, at = '', out = []) {
  if (typeof v === 'string') out.push([at, v]);
  else if (Array.isArray(v)) v.forEach((x, i) => strings(x, `${at}[${i}]`, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) strings(x, `${at}.${k}`, out);
  return out;
}

export const tests = [
  {
    name: '(a) quiz and host-introduction files: 11 languages, 5 rounds of 4/4/2/5/6 questions, three valid answers each, no empty text',
    async run(ctx) {
      const manifest = readJson(ctx, 'data/lang/manifest.json');
      const files = fs.readdirSync(path.join(ctx.web, 'data/quiz')).filter(f => f.endsWith('.json')).sort();
      assert(JSON.stringify(files.map(f => f.replace('.json', '')).sort()) === JSON.stringify([...manifest.languages].sort()),
        `quiz files ${files} do not match the offered languages ${manifest.languages}`);
      const english = readJson(ctx, 'data/quiz/en.json');
      for (const f of files) {
        const code = f.replace('.json', '');
        let q;
        try { q = readJson(ctx, `data/quiz/${f}`); } catch (e) { throw new Error(`${f}: does not parse: ${e.message}`); }
        assert(q.code === code, `${f}: code ${q.code}`);
        // The host's introduction: 10 lines like the live build's en_en_introductions.xml. Line 3
        // is empty in the live data ("Excellent!" in build A) and never shown (NOTES 2.4 and the
        // section 3 table; web/NOTES-flow-decisions.md), so it is the one empty string allowed.
        assert(Array.isArray(q.intro) && q.intro.length === english.intro.length, `${f}: ${q.intro && q.intro.length} intro lines, English has ${english.intro.length}`);
        assert(q.intro[3] === '', `${f}: intro line 3 is "${q.intro[3]}"; the live data leaves it empty`);
        const empty = strings(q).filter(([at, s]) => !s.trim() && at !== '.intro[3]');
        assert(empty.length === 0, `${f}: empty strings at ${empty.map(([at]) => at).join(', ')}`);
        assert(Array.isArray(q.rounds) && q.rounds.length === 5, `${f}: ${q.rounds && q.rounds.length} rounds`);
        const intros = new Set(q.rounds.flatMap(r => [...((r.intro && r.intro.blind) || []), ...((r.intro && r.intro.normal) || [])]));
        q.rounds.forEach((r, i) => {
          const where = `${f} round ${i + 1}`;
          assert(r.round === i + 1, `${where}: numbered ${r.round}`);
          assert(typeof r.name === 'string' && r.name.trim(), `${where}: no name`);
          assert(Array.isArray(r.intro.blind) && r.intro.blind.length > 0 && Array.isArray(r.intro.normal) && r.intro.normal.length > 0, `${where}: missing blind or normal intro lines`);
          assert(r.questions.length === QUESTIONS[i], `${where}: ${r.questions.length} questions, expected ${QUESTIONS[i]}`);
          // Cross-check with the live build's XML for this language and round.
          const xml = fs.readFileSync(path.join(ctx.root, XML_DIR, `${xmlCode(code)}_gameshow_round${i + 1}.xml`), 'utf8');
          const inXml = (xml.match(/<question\s+id=/g) || []).length;
          assert(inXml === r.questions.length, `${where}: ${r.questions.length} questions, the live XML has ${inXml}`);
          r.questions.forEach((x, n) => {
            const qw = `${where} question ${n + 1}`;
            assert(typeof x.text === 'string' && x.text.trim(), `${qw}: no text`);
            assert(x.score === 10 && x.value === 1, `${qw}: score ${x.score}, value ${x.value}`);
            assert(Array.isArray(x.answers) && x.answers.length === 3, `${qw}: ${x.answers && x.answers.length} answers`);
            const values = x.answers.map(a => a.value);
            assert(JSON.stringify([...values].sort()) === '[-1,0,1]', `${qw}: answer values ${values}`);
            // Agree / Don't Know / Disagree: the middle answer is always the safe one, and the
            // values match the English file's (the translations reuse its answer keys).
            assert(values[1] === 0, `${qw}: the middle answer is worth ${values[1]}, not 0 (Don't Know)`);
            assert(JSON.stringify(values) === JSON.stringify(english.rounds[i].questions[n].answers.map(a => a.value)), `${qw}: answer values ${values} differ from English`);
            for (const a of x.answers) assert(typeof a.label === 'string' && a.label.trim(), `${qw}: an empty answer label`);
            // A question is a statement to agree or disagree with, never a line of the host's:
            // not a round intro line, and not a blind-round or bonus notice in any language
            // (the 2009 Portuguese round 4 question 3 was "Como é uma pergunta cega, só saberás
            // o resultado no final.", NOTES 10.2 #87).
            assert(!intros.has(x.text), `${qw}: "${x.text}" is a round intro line`);
            assert(!NOTICE.test(x.text), `${qw}: "${x.text}" reads like a host notice, not a question`);
          });
        });
      }
      ctx.log(`${files.length} quiz files, ${QUESTIONS.reduce((a, b) => a + b)} questions each`);
    },
  },
  {
    name: '(b) i18n: every key the code uses exists in the English tables; no key defined twice with different text',
    async run(ctx) {
      const manifest = readJson(ctx, 'data/lang/manifest.json');
      const tables = [['en.json', readJson(ctx, 'data/lang/en.json')], ...manifest.namespaces.map(ns => [`en/${ns}.json`, readJson(ctx, `data/lang/en/${ns}.json`)])];
      const en = {};
      const clashes = [];
      for (const [file, table] of tables) {
        for (const [k, v] of Object.entries(table)) {
          if (k.startsWith('_')) continue;
          assert(typeof v === 'string', `${file}: ${k} is not a string`);
          if (k in en && en[k].text !== v) clashes.push(`${k} (${en[k].file} vs ${file})`);
          en[k] = { text: v, file };
        }
      }
      assert(clashes.length === 0, `keys defined twice with different text: ${clashes.join(', ')}`);
      const keys = Object.keys(en);
      const heads = new Set(keys.map(k => k.split('.')[0]));
      const hasPrefix = p => keys.some(k => k.startsWith(p));
      const missing = new Set();
      let literals = 0, keyShaped = 0, prefixes = 0;
      for (const file of jsFiles(path.join(ctx.web, 'js'))) {
        const src = fs.readFileSync(file, 'utf8');
        const rel = path.relative(ctx.web, file);
        // 1. t('key') and tp('key') with a whole literal key.
        for (const m of src.matchAll(/\b(t|tp)\(\s*(['"])([^'"\n]+)\2\s*[,)]/g)) {
          literals++;
          if (!(m[3] in en)) missing.add(`${m[3]} (${rel}, ${m[1]}())`);
        }
        // 2. Key-shaped literals anywhere (label tables, ternaries inside t()), for the
        //    namespaces the tables use; a literal ending in '.' is a prefix.
        for (const m of src.matchAll(/(['"`])([a-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_-]+)+\.?)\1/g)) {
          const k = m[2];
          if (!heads.has(k.split('.')[0]) || /\.(m?js|json|webp|png|css|html|woff2)$/.test(k)) continue;
          keyShaped++;
          const ok = k.endsWith('.') ? hasPrefix(k) : k in en || hasPrefix(k + '.');
          if (!ok) missing.add(`${k} (${rel})`);
        }
        // 3. Computed keys: the fixed part before the first ${...} or '+' must start some key.
        for (const m of src.matchAll(/\b(t|tp)\(\s*(?:`([^`$]*)\$\{|(['"])([^'"\n]*)\3\s*\+)/g)) {
          const p = m[2] ?? m[4];
          prefixes++;
          if (!hasPrefix(p)) missing.add(`${p}* (${rel}, computed)`);
        }
      }
      assert(literals > 150, `only ${literals} t('...') literals found; the pattern no longer matches the code`);
      assert(missing.size === 0, `keys used in web/js but missing from the English tables:\n${[...missing].join('\n')}`);
      ctx.log(`${literals} t()/tp() literals, ${keyShaped} key-shaped literals, ${prefixes} computed prefixes; ${keys.length} English keys in ${tables.length} files`);
    },
  },
  {
    name: '(c) levels: every level JSON parses and runs; play order, rounds and next links agree',
    async run(ctx) {
      const dir = path.join(ctx.web, 'data/levels');
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
      const parsed = {};
      for (const f of files) {
        try { parsed[f] = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { throw new Error(`${f}: does not parse: ${e.message}`); }
      }
      assert(parsed['tile_definitions.json'] && parsed['tile_definitions.json'].definitions, 'tile_definitions.json has no definitions');
      const index = parsed['index.json'];
      const levels = files.filter(f => /^alpha_level\d+\.json$/.test(f)).map(f => f.replace('.json', ''));
      assert(levels.length === 11, `${levels.length} level files`);
      for (const id of levels) {
        const L = parsed[`${id}.json`];
        assert(L.name === id && Array.isArray(L.tiles) && Array.isArray(L.entities) && L.palette && L.goals.length === 1, `${id}: malformed`);
        const game = new PlatformGame(L);
        game.start();
        for (let i = 0; i < 20; i++) game.step({});
        assert(game.state === 'play' && game.stepCount === 20, `${id}: the game did not run (state ${game.state}, step ${game.stepCount})`);
        assert(index.levels[id], `${id}: not in index.json`);
      }
      for (const id of index.order) assert(levels.includes(id), `index.json order names ${id}, which has no file`);
      const inRounds = index.rounds.flatMap(r => r.levels);
      assert(JSON.stringify(inRounds) === JSON.stringify(index.order), `rounds ${inRounds} do not follow the play order ${index.order}`);
      assert(index.rounds.length === 5 && index.rounds.filter(r => r.kind === 'kitchen').length === 1 && index.rounds[3].kind === 'kitchen', 'round 4 is not the kitchen');
      // Each level's next= attribute: the following level in its round, or "exit" at the round's end.
      for (const r of index.rounds) {
        r.levels.forEach((id, i) => {
          const want = i < r.levels.length - 1 ? r.levels[i + 1] : 'exit';
          assert(index.levels[id].next === want && parsed[`${id}.json`].next === want, `${id}: next ${index.levels[id].next} / ${parsed[`${id}.json`].next}, expected ${want}`);
        });
      }
      ctx.log(`${files.length} files; ${levels.length} levels build and run`);
    },
  },
  {
    name: '(d) atlases: every file index.json names exists and matches its sheet JSON; symbols and sets resolve',
    async run(ctx) {
      const dir = path.join(ctx.web, 'data/atlas');
      const index = readJson(ctx, 'data/atlas/index.json');
      const referenced = new Set(['index.json']);
      let bytes = 0, images = 0;
      for (const [id, a] of Object.entries(index.atlases)) {
        assert(fs.existsSync(path.join(dir, a.json)), `${id}: ${a.json} is missing`);
        referenced.add(a.json);
        const sheet = JSON.parse(fs.readFileSync(path.join(dir, a.json), 'utf8'));
        assert(sheet.format === 'smw-atlas/1', `${id}: format ${sheet.format}`);
        assert(JSON.stringify(sheet.images) === JSON.stringify(a.images) && a.images.length > 0, `${id}: images ${sheet.images} vs index ${a.images}`);
        for (const img of a.images) {
          const p = path.join(dir, img);
          assert(fs.existsSync(p), `${id}: ${img} is missing`);
          const head = fs.readFileSync(p).subarray(0, 12);
          assert(head.toString('latin1', 0, 4) === 'RIFF' && head.toString('latin1', 8, 12) === 'WEBP', `${id}: ${img} is not a WebP file`);
          referenced.add(img);
          bytes += fs.statSync(p).size;
          images++;
        }
        for (const s of a.symbols) assert(sheet.symbols[s], `${id}: symbol ${s} is not in ${a.json}`);
      }
      for (const [s, id] of Object.entries(index.symbols)) {
        assert(index.atlases[id], `symbol ${s} points to atlas ${id}, which is not in the index`);
        assert(index.atlases[id].symbols.includes(s), `symbol ${s} is not listed by atlas ${id}`);
      }
      for (const [set, ids] of Object.entries(index.sets)) for (const id of ids) assert(index.atlases[id], `set ${set} names atlas ${id}, which is not in the index`);
      const orphans = fs.readdirSync(dir).filter(f => !referenced.has(f));
      if (orphans.length) ctx.log(`files in data/atlas/ that index.json does not name (not downloaded by the game): ${orphans.join(', ')}`);
      ctx.log(`${Object.keys(index.atlases).length} atlases, ${images} sheets, ${(bytes / 1048576).toFixed(2)} MiB of WebP, ${Object.keys(index.symbols).length} symbols, ${Object.keys(index.sets).length} sets`);
    },
  },
  {
    name: '(e) precache.json and sw.js carry the current build hash',
    async run(ctx) {
      // Same file walk and hash as tools/build-precache.mjs.
      const SKIP = [/^tests\//, /^screenshots\//, /^precache\.json$/, /\.md$/, /\.map$/, /(^|\/)\./, /^artifact\//, /\.png$/, /-512\.png$/];
      const KEEP_PNG = [/^icons\/icon-(180|192)\.png$/];
      const all = [];
      (function walk(dir) {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          const abs = path.join(dir, e.name);
          const rel = path.relative(ctx.web, abs).split(path.sep).join('/');
          if (e.isDirectory()) { walk(abs); continue; }
          if (SKIP.some(r => r.test(rel)) && !KEEP_PNG.some(r => r.test(rel))) continue;
          all.push(rel);
        }
      })(ctx.web);
      all.sort();
      const hash = crypto.createHash('sha256');
      for (const f of all) if (f !== 'sw.js') hash.update(f).update(fs.readFileSync(path.join(ctx.web, f)));
      const version = hash.digest('hex').slice(0, 12);
      const pre = readJson(ctx, 'precache.json');
      const stamped = /const BUILD = '([^']*)';/.exec(fs.readFileSync(path.join(ctx.web, 'sw.js'), 'utf8'))?.[1];
      const fix = 'run: node tools/build-precache.mjs';
      assert(pre.version === version, `precache.json is stale (version ${pre.version}, files hash to ${version}); ${fix}`);
      assert(stamped === version, `sw.js BUILD is ${stamped}, files hash to ${version}; ${fix}`);
      const listed = new Set([...pre.files, ...pre.lazy]);
      const unlisted = all.filter(f => !listed.has(f));
      assert(unlisted.length === 0, `runtime files missing from precache.json: ${unlisted.join(', ')}; ${fix}`);
      for (const f of listed) if (f !== './') assert(fs.existsSync(path.join(ctx.web, f)), `precache.json lists ${f}, which does not exist`);
      ctx.log(`build ${version}: ${pre.files.length} files at install, ${pre.lazy.length} on first use`);
    },
  },
];
