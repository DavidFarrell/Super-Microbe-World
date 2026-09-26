// Quiz rules, as pure functions with no browser dependencies (the Playwright spec imports this
// file in Node to cross-check the scene). Source: GameShow.as receiveAnswer() (:205-301),
// pickCpuResponse() (:304-329), changeScore() (:331-343); NOTES 6.5 and 6.6.
//
// Answer values (Question.as:8-10): 1 correct, 0 "don't know", -1 wrong. Buttons are always
// Agree (0), Don't Know (1), Disagree (2); only answers[i].value matters (1 right, 0 don't know,
// -1 wrong).
export const ANSWER_WRONG = -1;
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

// Host intro lines as spoken (NOTES 6.8 and 10.2 #65, #66; web/NOTES-gameshow-decisions.md G8,
// G9). The two 2009 data defects are corrected in the data by tools/convert-text.mjs (counted
// per-language corrections): English "Ready ?" in rounds 1 and 2, and the Polish points line in the
// Portuguese rounds 1 and 2. What stays here is a guard: English intro lines lose any space before
// "?" or "!" (English only: French "Prêt ?" and "Allons-y !" are correct French spacing).
export function normaliseIntro(code, lines) {
  return (lines || []).map(line => (code === 'en' ? String(line).replace(/\s+([?!])/g, '$1') : String(line)));
}

// Board button labels for a language: the most common label at each position across all its
// questions (the original buttons had fixed text; the first question of rounds 3-5 in every
// translated file keeps the English "Disagree", which this vote masks).
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
