// Level goals: port of reference/Junior_Game/src/ebug/junior/Goal.as. Pure.
import { E, G } from './constants.js';
import { ev } from './entities.js';

export class Goal {
  constructor(goalType, microbeType, required) {
    this.goalType = goalType;
    this.microbeType = microbeType;
    this.required = required;
    this.achieved = 0;
    this.goalId = 0;
  }

  // Goal.as:35-41 used ==, so two counted events in one step could skip past `required` and
  // deadlock the level (bug 5). The port uses >=.
  isGoalMet() { return this.achieved >= this.required; }

  // Goal.as:43-168. Returns [MODIFY_GOAL_STATUS] when the event counts, else [].
  updateGoal(e) {
    const t = e.target;
    let counts = false;
    switch (e.type) {
      case E.BE_PHOTOGRAPHED:
        if (this.goalType === G.PHOTOGRAPH_SPECIFIC) counts = t.type === this.microbeType;
        else if (this.goalType === G.PHOTOGRAPH_GOOD) counts = !!t.isGood;
        else if (this.goalType === G.PHOTOGRAPH_ANY) counts = true;
        break; // PHOTOGRAPH_BAD is unimplemented in the original
      case E.BE_KILLED:
        // KILL_ALL counts bad microbes whatever microbeType says; PHOTOGRAPH_GOOD also counts a
        // good microbe's death (both faithful). The second KILL_ALL case was unreachable.
        if (this.goalType === G.KILL_ALL) counts = !!t.isBad;
        else if (this.goalType === G.PHOTOGRAPH_GOOD) counts = !!t.isGood;
        break;
      case E.MILK_GLASS_EVENT_TURN_TO_YOGURT:
        counts = this.goalType === G.YOGURT;
        break;
      case E.EXPLODE_ANTIBIOTIC:
        counts = this.goalType === G.ANTIBIOTIC;
        break;
      default: break;
    }
    if (!counts) return [];
    this.achieved++;
    return [ev(E.MODIFY_GOAL_STATUS, null, [this.goalId, true])];
  }
}
