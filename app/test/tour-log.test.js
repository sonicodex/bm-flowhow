// The tour log (phase 3.2, rewinds in 3.6): every action applied through
// tour-log.js, on random flows with random rewinds, replays to the same tour.
import assert from 'node:assert';
import { it } from 'vitest';
import C from '../public/js/core.js';
import { apply, replay } from '../public/js/tour-log.js';

const state = (t) => JSON.stringify([t.trail.map((x) => [x.id, x.note || null]), [...t.visited].sort(), [...t.taken].sort(), t.path, t.starts, t.stale]);

it("random flows, random rewinds: the log replays to the same tour, and a bad rewind is refused", () => {
  let seed = 23; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  let backs = 0;
  for (let k = 0; k < 1500; k++) {
    const n = 2 + Math.floor(rnd() * 14); const steps = [];
    for (let i = 0; i < n; i++) { const ex = []; const m = Math.floor(rnd() * 4); for (let j = 0; j < m; j++) ex.push('L' + j + ':S' + Math.floor(rnd() * n)); steps.push({ id: 'S' + i, type: i === 0 ? 'start' : 'activity', title: 'P' + i, exits: ex.join('|'), tags: {} }); }
    const flow = C.compile({ name: 'r', categories: [], steps });
    const t = new C.Tour(flow);
    const rows = [];
    for (let g = 0; g < 400 && !t.canFinish(); g++) {
      const at = t.current().id;
      let action;
      if (rnd() < 0.15 && t.trail.length > 1) {
        const b = Math.floor(rnd() * (t.trail.length - 1));
        const e = t.trail[b];
        const exits = t.exitsOf(e.id).length;
        if (exits < 2) {
          // Not a decision: refused, nothing changes.
          const before = state(t);
          assert(!apply(t, { at: e.id, action: 'choose', exit: 0, back: b }).ok);
          assert.strictEqual(state(t), before);
          continue;
        }
        action = { at: e.id, action: 'choose', exit: Math.floor(rnd() * exits), back: b };
        if (e.chose === action.exit) continue; // only a view move, never sent
        backs++;
      } else if (t.canSkip()) action = { at, action: 'skip' };
      else if (t.exitsOf(at).length > 1) action = { at, action: 'choose', exit: Math.floor(rnd() * t.exitsOf(at).length) };
      else action = { at, action: 'next' };
      const r = apply(t, action);
      if (!r.ok) break; // the end of a flow with nowhere to go
      rows.push(r.row);
    }
    const again = replay(flow, rows);
    assert(again, 'replay ' + k);
    assert.strictEqual(state(again), state(t), 'state ' + k);
    // A rewind past the end, or to the wrong step, is refused.
    assert(!apply(again, { at: again.current().id, action: 'choose', exit: 0, back: again.trail.length - 1 }).ok);
  }
  assert(backs > 500);
});
