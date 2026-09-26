// Quiz rules, as pure functions with no browser dependencies (the Playwright spec imports this
// file in Node to cross-check the scene). Source: GameShow.as receiveAnswer() (:205-301),
// pickCpuResponse() (:304-329), changeScore() (:331-343); NOTES 6.5 and 6.6.
//
// Answer values (Question.as:8-10): 1 correct, 0 "don't know", -1 wrong. Buttons are always
// Agree (0), Don't Know (1), Disagree (2); only answers[i].value matters.
export const ANSWER_WRONG = -1;
export const ANSWER_DUNNO = 0;
export const ANSWER_CORRECT = 1;
export const MAX_SCORE = 9999;          // four LCD digits (GameShow.as:371-386)

// Points after the player answers with value v on a question worth `score`:
//   correct: player + score; wrong: the opponent + floor(score / 2); don't know: nothing.
export function scorePlayerAnswer(v, score, { player, cpu }) {
  if (v === ANSWER_CORRECT) return { player: player + score, cpu };
  if (v === ANSWER_WRONG) return { player, cpu: cpu + Math.floor(score / 2) };
  return { player, cpu };
}

// Points after the CPU answers with value v: the mirror image.
export function scoreCpuAnswer(v, score, { player, cpu }) {
  if (v === ANSWER_CORRECT) return { player, cpu: cpu + score };
  if (v === ANSWER_WRONG) return { player: player + Math.floor(score / 2), cpu };
  return { player, cpu };
}

// The CPU picks one of the three buttons uniformly, whatever the question
// (Math.floor(Math.random() * 3), GameShow.as:308). `rng` is the seeded gameplay stream.
export function cpuChoice(rng) {
  return Math.min(2, Math.floor(rng.next() * 3));
}

export const verdictKey = v => (v === ANSWER_CORRECT ? 'correct' : v === ANSWER_WRONG ? 'wrong' : 'safe');

// Host and contestant reactions (GameShow.as:247-273 and :312-322).
export const PLAYER_REACTION = { 1: { host: 'excited', kid: 'happy' }, 0: { host: 'serious', kid: 'neutral' }, [-1]: { host: 'disappointed', kid: 'disappointed' } };
export const CPU_REACTION = { 1: 'happy', 0: 'neutral', [-1]: 'disappointed' };
// Blind rounds: the player's avatar plays one of these at random (GameShow.as:220-228; the
// original asked for "confident", a label that does not exist; the timeline has "condifent").
export const BLIND_REACTIONS = ['neutral', 'cautious', 'condifent'];

// Blind intro lines promising "a great bonus later" (never implemented) are dropped (NOTES 11.9
// #2). They sit at the same position in all 11 languages: round 1 line 3, round 2 line 2.
export const BONUS_LINES = { 1: [2], 2: [1] };

export function blindIntro(round, lines) {
  const drop = BONUS_LINES[round] || [];
  return lines.filter((_, i) => !drop.includes(i));
}

// Host intro lines as spoken (NOTES 6.8 and web/NOTES-gameshow-decisions.md G8, G9):
//   en: the live en_en text has "Ready ?" (rounds 1 and 2); NOTES 6.8 normalises the spacing to
//       "Ready?". Only English: French "Prêt ?" and "Allons-y !" are correct French spacing.
//   por_por: rounds 1 and 2 carry the Polish points line from the 2009 XML
//       (por_por_gameshow_round1.xml, _round2.xml). It is replaced by the Portuguese translator's
//       own points line from rounds 3 to 5 without "Lembra-te que" ("Remember"), which says the
//       same as the English line. Matched on the exact text, so it stops applying once the data
//       is fixed (web/requests/gameshow.md #3).
export const INTRO_OVERRIDES = {
  por_por: {
    'Za prawidłową odpowiedź otrzymasz 10 punktów, ale jeśli odpowiesz źle, wtedy punkty otrzymuje przeciwnik.':
      'Ganhas 10 pontos por cada resposta certa. Se estiver errada o outro jogador é que ganha.',
  },
};

export function normaliseIntro(code, lines) {
  const over = INTRO_OVERRIDES[code] || {};
  return (lines || []).map(line => {
    let s = Object.prototype.hasOwnProperty.call(over, line) ? over[line] : String(line);
    if (code === 'en') s = s.replace(/\s+([?!])/g, '$1');
    return s;
  });
}

// Board button labels for a language: the most common label at each position across all its
// questions (the original buttons had fixed text; one cz_cz answer label is left in English).
export function buttonLabels(quiz) {
  const counts = [new Map(), new Map(), new Map()];
  for (const r of quiz.rounds || []) {
    for (const q of r.questions || []) {
      (q.answers || []).forEach((a, i) => {
        if (i > 2) return;
        const l = String(a.label || '').trim();
        if (l) counts[i].set(l, (counts[i].get(l) || 0) + 1);
      });
    }
  }
  const fallback = ['Agree', "Don't Know", 'Disagree'];
  return counts.map((m, i) => {
    let best = null, n = 0;
    for (const [l, c] of m) if (c > n) { best = l; n = c; }
    return best || fallback[i];
  });
}
