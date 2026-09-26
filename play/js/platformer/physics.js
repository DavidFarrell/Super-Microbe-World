// Port of ebug.ParticleSystem (reference/Junior_Game/src/ebug/ParticleSystem.as): a
// Jakobsen-style Verlet particle system on axis-aligned boxes, with the original's integration
// order, rounding, speed clamp and collision resolution order. Pure: no DOM, safe in node.
//
// Two documented bugs are fixed by default and can be switched off for comparison tests
// (flash-platformer.md section 2.7 and section 10):
//   fixes.staticBroadphase  The static loop indexed the bounding-ball and exemption arrays with
//                           the position in the local candidate list (ParticleSystem.as:583,586),
//                           so big tiles were partly soft. Fixed: plain AABB test, real indices.
//   fixes.skipDeadBodies    Killed / ignored bodies still pushed others when they were the outer
//                           ("current") body (ParticleSystem.as:409,433-435). Fixed: skipped both ways.
//   fixes.internalEdges     The smaller-penetration rule pushed bodies sideways at the seams between
//                           flush tiles (a floor kicked a coasting player forward or caught it when
//                           moving left). Fixed: an x push into a flush neighbour resolves in y.
import { TILE, S, T } from './constants.js';
import { add, sub, mul, round3 } from './vec.js';

const AXIS_X = 0; // ParticleSystem.AXIS_X: penetration along the x axis => push in y
const AXIS_Y = 1;

// ebug.EntityBox: position is the top-left corner (EntityBox.as, Entity.as:52-64).
export class Body {
  constructor(x, y, w, h) {
    this.position = { x, y };
    this.previousPosition = { x, y };
    this.width = w;
    this.height = h;
    this.centreOffset = { x: w * 0.5, y: h * 0.5 }; // faces[2][0].multiply(0.5)
    this.bottomRightOffset = { x: w, y: h };
    this.centre = null;
    this.force = { x: 0, y: 0 };
    this.gravityExcempt = false;
    this.physicsExcempt = false;
    this.isDynamic = false;
    this.isColiding = false;
    this.theParent = null;   // owning game entity
    this.index = -1;         // index in the dynamic or static list
    // Port addition, read only by the player's coyote time: true when the last step pushed
    // this body upwards (standing on something) or clamped it to the world floor.
    this.supported = false;
  }

  // Entity.teleport: previousPosition = position, position = p, so velocity becomes zero.
  teleport(x, y) {
    this.previousPosition.x = this.position.x;
    this.previousPosition.y = this.position.y;
    this.position.x = x;
    this.position.y = y;
  }
}

const isDeadState = owner => owner && (owner.state === S.BE_KILLED || owner.state === S.IGNORE);

export class ParticleSystem {
  /**
   * @param {object} o
   * @param {number} o.deltaMs      step length (PlatformGame passes 30)
   * @param {number} o.iterations   constraint iterations (1)
   * @param {{x,y}} o.gravity       (0, 3000)
   * @param {number} o.drag         0.95
   * @param {{x,y}} o.worldMin / worldMax
   * @param {(ev) => void} o.emit   receives COLLIDE events {target, other, change}
   */
  constructor({ deltaMs = 30, iterations = 1, gravity = { x: 0, y: 3000 }, drag = 0.95, worldMin = { x: 0, y: 0 },
    worldMax = { x: 800, y: 450 }, constrainSpeeds = true, emit = () => {}, fixes = {} } = {}) {
    this.timeInterval = deltaMs / 1000;
    this.numIterations = iterations;
    this.gravity = { x: gravity.x, y: gravity.y };
    this.drag = drag;
    this.worldMin = worldMin;
    this.worldMax = worldMax;
    this.maxChange = { x: 9999999, y: 9999999 };
    this.constrainSpeeds = constrainSpeeds;
    this.emit = emit;
    this.fixes = { staticBroadphase: true, skipDeadBodies: true, internalEdges: true, ...fixes };
    this.dynamicEntities = [];
    this.dynamicBoundingBalls = [];
    this.staticEntities = [];
    this.staticBoundingBalls = [];
    this.exemptDynamic = [];    // excemptionMatrix[i][DYNAMIC]: Set of dynamic indices
    this.exemptStatic = [];     // excemptionMatrix[i][STATIC]: Set of static indices
    this.levelTileArray = new Map(); // "row,col" -> static index (anchor cells only)
    this.hasCollided = [];
  }

  /**
   * ParticleSystem.createBoxParticle (ParticleSystem.as:187-239). Returns the index in the
   * dynamic or static list, or null when the clip does not exist (w == null), as the original
   * returned null for a failed attachMovie.
   */
  createBox(x, y, w, h, { dynamic = false, force = null, gravityExcempt = false, maxChangeExcempt = false } = {}) {
    if (w == null || h == null) return null;
    const box = new Body(x, y, w, h);
    box.force = force ? { x: force.x, y: force.y } : { x: 0, y: 0 };
    if (gravityExcempt) box.gravityExcempt = true;
    box.isDynamic = dynamic;
    const radius = Math.round(Math.sqrt(w * w + h * h) / 2);
    let index;
    if (dynamic) {
      this.dynamicEntities.push(box);
      this.dynamicBoundingBalls.push(radius);
      index = this.dynamicEntities.length - 1;
      this.exemptDynamic[index] = new Set();
      this.exemptStatic[index] = new Set();
    } else {
      this.staticEntities.push(box);
      this.staticBoundingBalls.push(radius);
      index = this.staticEntities.length - 1;
      // levelTileArray[y/50][x/50] = index: only whole cells are ever looked up again. The
      // original array was sized 9 x 16 from the default bounds, silently dropping rows >= 9
      // (bug 27); the map here has no such limit.
      const r = y / TILE, c = x / TILE;
      if (Number.isInteger(r) && Number.isInteger(c)) this.levelTileArray.set(r + ',' + c, index);
    }
    box.index = index;
    if (!maxChangeExcempt) {
      if (Math.ceil(w / 2) < this.maxChange.x) this.maxChange.x = w / 2;
      if (Math.ceil(h / 2) < this.maxChange.y) this.maxChange.y = h / 2;
    }
    return index;
  }

  exempt(dynIndex, otherIndex, otherIsDynamic) {
    (otherIsDynamic ? this.exemptDynamic : this.exemptStatic)[dynIndex].add(otherIndex);
  }

  removeDynamic(index) {
    this.dynamicEntities[index] = null;
    this.dynamicBoundingBalls[index] = null;
  }

  // ParticleSystem.timeStep (ParticleSystem.as:290-305)
  timeStep() {
    this.hasCollided = [];
    for (const e of this.dynamicEntities) if (e) e.supported = false;
    this.accumulateForces();
    this.verlet();
    this.satisfyConstraints();
  }

  // ParticleSystem.as:361-379. Gravity-exempt bodies lose their force here; friction acts on
  // the force only. Runs for physics-exempt bodies too, so their force keeps accumulating.
  accumulateForces() {
    for (const e of this.dynamicEntities) {
      if (!e) continue;
      let f = { x: 0, y: 0 };
      if (e.gravityExcempt === false) f = add(e.force, this.gravity);
      f.x = Math.abs(f.x) > 10 ? 0.9 * f.x : 0.8 * f.x;
      e.force = f;
    }
  }

  // ParticleSystem.as:317-355
  verlet() {
    const dt2 = this.timeInterval * this.timeInterval;
    const mc = this.maxChange;
    for (const e of this.dynamicEntities) {
      if (!e || e.physicsExcempt) continue;
      const tmp = { x: e.position.x, y: e.position.y };
      const change = mul(sub(e.position, e.previousPosition), this.drag);
      const forceChange = mul(e.force, dt2);
      let np = add(e.position, change);
      np = add(np, forceChange);
      if (this.constrainSpeeds) {
        let fc = sub(np, tmp);
        if (Math.abs(fc.x) > mc.x) {
          np.x = fc.x < 0 ? tmp.x - mc.x : tmp.x + mc.x;
          fc = sub(np, tmp);
        }
        if (Math.abs(fc.y) > mc.y) np.y = fc.y < 0 ? tmp.y - mc.y : tmp.y + mc.y;
      }
      e.position = np;
      e.previousPosition = tmp;
      e.force = { x: 0, y: 0 };
    }
  }

  // ParticleSystem.as:392-657
  satisfyConstraints() {
    const dyn = this.dynamicEntities, balls = this.dynamicBoundingBalls;
    const fx = this.fixes;
    for (let it = 0; it < this.numIterations; it++) {
      for (let a = 0; a < dyn.length; a++) {
        const A = dyn[a];
        if (!A) continue;
        if (!this.hasCollided[a]) this.hasCollided[a] = [];
        const ownerA = A.theParent;
        if (!(ownerA.isOnScreen || A.physicsExcempt)) continue;
        if (fx.skipDeadBodies && (isDeadState(ownerA) || ownerA.removed)) continue;
        A.isColiding = false;
        A.centre = add(A.position, A.centreOffset); // not refreshed after dynamic pushes (faithful)

        // ---- dynamic vs dynamic: both move half the separation
        for (let b = 0; b < dyn.length; b++) {
          const B = dyn[b];
          if (!B || a === b) continue;
          const lo = a < b ? a : b, hi = a < b ? b : a;
          if (this.hasCollided[lo] && this.hasCollided[lo][hi] === true) continue;
          if (this.exemptDynamic[a] && this.exemptDynamic[a].has(b)) continue;
          const ownerB = B.theParent;
          if (ownerB.type === T.BULLET && ownerB.state === BULLET_STATE_DEAD) continue;
          if (ownerB.state === S.BE_KILLED || ownerB.state === S.IGNORE) continue;
          if (fx.skipDeadBodies && ownerB.removed) continue;
          B.centre = add(B.position, B.centreOffset);
          const delta = sub(B.centre, A.centre);
          const restLength = balls[a] + balls[b];
          if (Math.sqrt(delta.x * delta.x + delta.y * delta.y) >= restLength) continue;
          const change = this._penetration(A, B, delta);
          if (!change) continue;
          A.isColiding = true;
          const half = mul(change, 0.5);
          A.position = add(A.position, half);
          B.position = sub(B.position, half);
          if (half.y < 0) A.supported = true;
          if (half.y > 0) B.supported = true;
          if (it === 0) {
            if (!this.hasCollided[lo]) this.hasCollided[lo] = [];
            this.hasCollided[lo][hi] = true;
            this.emit({ type: 'collide', target: ownerA, other: ownerB, change: half });
            if (ownerA.type !== T.BULLET) this.emit({ type: 'collide', target: ownerB, other: ownerA, change: mul(change, -0.5) });
          }
        }

        // ---- dynamic vs static: only the dynamic body moves. Candidates are the anchor cells
        // in a window 4 cells up/left of the body (multi-cell tiles), in row-major order.
        const myRow = Math.floor(A.position.y / TILE), myCol = Math.floor(A.position.x / TILE);
        const maxRow = myRow + Math.ceil(A.height / TILE), maxCol = myCol + Math.ceil(A.width / TILE);
        const test = [];
        for (let r = myRow - 4; r <= maxRow; r++) {
          for (let c = myCol - 4; c <= maxCol; c++) {
            const idx = this.levelTileArray.get(r + ',' + c);
            if (idx !== undefined && this.staticEntities[idx]) test.push(this.staticEntities[idx]);
          }
        }
        for (let k = 0; k < test.length; k++) {
          const St = test[k];
          if (St.physicsExcempt) continue;
          if (fx.staticBroadphase) {
            if (this.exemptStatic[a] && this.exemptStatic[a].has(St.index)) continue;
          } else if (this.exemptStatic[a] && this.exemptStatic[a].has(k)) continue; // original: local index
          St.centre = add(St.position, St.centreOffset);
          const delta = sub(St.centre, A.centre);
          if (!fx.staticBroadphase) {
            const restLength = balls[a] + (this.staticBoundingBalls[k] ?? 0); // original: local index k
            if (!(Math.sqrt(delta.x * delta.x + delta.y * delta.y) < restLength)) continue;
          }
          let change = this._penetration(A, St, delta);
          if (!change) continue;
          // A sideways push out of a tile into a flush neighbour is a seam artefact: resolve it
          // vertically instead, so a floor built from tiles behaves like one surface.
          if (fx.internalEdges && change.x !== 0 && this._flushNeighbour(test, St, change.x > 0)) {
            const pen = (A.height + St.height) / 2 - Math.abs(delta.y);
            change = { x: 0, y: (delta.y >= 0 ? -1 : 1) * pen };
          }
          A.isColiding = true;
          A.position = add(A.position, change);
          A.centre = add(A.position, A.centreOffset);
          if (change.y < 0) A.supported = true;
        }
      }

      // (stick constraints: none are created by the platformer)

      // ---- world bounds last, so they win (ParticleSystem.as:645-655)
      const wMin = this.worldMin, wMax = this.worldMax;
      for (const e of dyn) {
        if (!e || e.physicsExcempt) continue;
        const maxX = wMax.x - e.bottomRightOffset.x, maxY = wMax.y - e.bottomRightOffset.y;
        let x = e.position.x > wMin.x ? e.position.x : wMin.x;
        let y = e.position.y > wMin.y ? e.position.y : wMin.y;
        x = x < maxX ? x : maxX;
        if (!(y < maxY)) { y = maxY; e.supported = true; }
        e.position = { x, y };
      }
    }
  }

  // Is there a solid tile flush against St on the given side whose top is at or above St's top?
  _flushNeighbour(candidates, St, right) {
    const edge = right ? St.position.x + St.width : St.position.x;
    for (const N of candidates) {
      if (N === St || N.physicsExcempt) continue;
      const nEdge = right ? N.position.x : N.position.x + N.width;
      if (Math.abs(nEdge - edge) < 1e-6 && N.position.y <= St.position.y + 1e-6 && N.position.y + N.height > St.position.y) return true;
    }
    return false;
  }

  // Box vs box penetration (ParticleSystem.as:457-510). Returns the change vector for the
  // current body, or null if the boxes do not overlap. The smaller penetration axis wins.
  _penetration(A, B, delta) {
    const signY = delta.x >= 0 ? -1 : 1;
    const signX = delta.y >= 0 ? -1 : 1;
    const restLengthX = (A.width + B.width) / 2;
    const restLengthY = (A.height + B.height) / 2;
    const penetrationX = restLengthY - Math.abs(delta.y); // along y
    const penetrationY = restLengthX - Math.abs(delta.x); // along x
    if (!(penetrationX > 0) || !(penetrationY > 0)) return null;
    const axis = penetrationX < penetrationY ? AXIS_X : AXIS_Y;
    return axis === AXIS_Y ? { x: signY * penetrationY, y: 0 } : { x: 0, y: signX * penetrationX };
  }
}

// BulletEntity.BULLET_STATE_DEAD (never set by the original, kept for the exclusion test).
export const BULLET_STATE_DEAD = 102;

// Exposed for tests.
export { round3 };
