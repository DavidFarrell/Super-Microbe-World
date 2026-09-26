// Game flow controller: the port of GameController.as. It owns the player, the CPU opponent's
// score and the round structure, and moves between scenes through the callbacks described in
// js/flow/contract.md. Round order (live 2009 build, no blind round):
//   splash -> cutscene (host, avatar, details) -> for each round: shrinking zone -> the action
//   (a chain of platform levels, or the kitchen game) -> that round's game-show quiz -> ... -> ending.
// Progress is saved after every completed step so the game can be continued later.
import { loadJson } from '../core/assets.js';
import { load, save } from '../core/save.js';

const SAVE_KEY = 'progress';

export function createFlow(app) {
  let rounds = null;

  const blank = () => ({ avatar: 'harry', nickname: '', age: null, score: 0, cpuScore: 0, round: 0, step: 'cutscene', unlocked: ['alpha_level1'], completed: [] });
  const state = { ...blank(), ...load(SAVE_KEY, {}) };
  const persist = () => save(SAVE_KEY, state);

  async function roundTable() {
    if (!rounds) {
      const index = await loadJson('data/levels/index.json');
      rounds = index.rounds.map((r, i) => ({
        number: i + 1,
        kind: r.kind,
        levels: r.kind === 'kitchen' ? [0, 1, 2, 3] : r.levels,
      }));
    }
    return rounds;
  }

  function unlock(id) { if (!state.unlocked.includes(id)) state.unlocked.push(id); }

  const flow = {
    state,
    hasSave: () => state.step !== 'cutscene' || state.round > 0,

    newGame() {
      Object.assign(state, blank());
      persist();
      app.scenes.go('cutscene', {
        onComplete: ({ avatar, nickname, age }) => {
          Object.assign(state, { avatar: avatar === 'amy' ? 'amy' : 'harry', nickname: nickname || '', age: age ?? null, step: 'shrink' });
          persist();
          flow.startRound(0);
        },
      }, { style: 'fade' });
    },

    continueGame() { flow.startRound(state.round, state.step); },

    async startRound(index, from = 'shrink') {
      const table = await roundTable();
      if (index >= table.length) return flow.finish();
      const round = table[index];
      state.round = index;
      state.step = from;
      persist();
      if (from === 'shrink') {
        app.scenes.go('shrink', { avatar: state.avatar, round: round.number, onComplete: () => flow.playAction(index, 0) }, { style: 'iris' });
      } else if (from === 'quiz') {
        flow.playQuiz(index);
      } else {
        flow.playAction(index, 0);
      }
    },

    async playAction(index, part) {
      const round = (await roundTable())[index];
      state.step = 'action'; persist();
      if (part >= round.levels.length) return flow.playQuiz(index);
      const id = round.levels[part];
      const onDone = result => {
        if (result && typeof result.score === 'number') state.score = result.score;
        const key = round.kind === 'kitchen' ? `kitchen${id}` : id;
        if (!state.completed.includes(key)) state.completed.push(key);
        const nextId = round.levels[part + 1];
        if (nextId != null) unlock(round.kind === 'kitchen' ? `kitchen${nextId}` : nextId);
        persist();
        flow.playAction(index, part + 1);
      };
      const common = { avatar: state.avatar, score: state.score, onComplete: onDone, onQuit: () => app.scenes.go('splash') };
      if (round.kind === 'kitchen') app.scenes.go('kitchen', { level: id, ...common }, { style: 'iris' });
      else app.scenes.go('platform', { level: id, ...common, onGameOver: () => flow.playAction(index, 0) }, { style: 'iris' });
    },

    async playQuiz(index) {
      const round = (await roundTable())[index];
      state.step = 'quiz'; persist();
      app.scenes.go('gameshow', {
        round: round.number, avatar: state.avatar, nickname: state.nickname,
        playerScore: state.score, cpuScore: state.cpuScore,
        onComplete: ({ playerScore, cpuScore }) => {
          state.score = playerScore; state.cpuScore = cpuScore;
          const table = rounds;
          if (index + 1 < table.length) {
            const nextRound = table[index + 1];
            unlock(nextRound.kind === 'kitchen' ? 'kitchen0' : nextRound.levels[0]);
          }
          state.round = index + 1; state.step = 'shrink'; persist();
          flow.startRound(index + 1);
        },
        onQuit: () => app.scenes.go('splash'),
      }, { style: 'fade' });
    },

    finish() {
      state.step = 'ending'; persist();
      app.scenes.go('ending', { playerScore: state.score, cpuScore: state.cpuScore, avatar: state.avatar, nickname: state.nickname }, { style: 'fade' });
    },

    resetProgress() { Object.assign(state, blank()); persist(); },
  };
  return flow;
}
