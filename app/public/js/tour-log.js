// The tour log (phase 3.2). The Tour engine in core.js keeps its state in
// memory; this module rebuilds it from the log, so the server can check every
// action and a tour survives a reload. Shared by the server and the browser.
//
// One log row per action, taken at the step the tour stood on:
//   - choose: a branch of a decision (a step with several exits); or, on a
//             step of a parallel decision, the next sibling step to open
//             (phase 6.23), with the decision's exit index;
//   - skip:   "Ir a lo que falta por visitar" at a decision;
//   - next:   any other step.
// `exit` is the index of the exit followed, and null when the tour did not
// leave through an exit: a skip, or a return from a dead end or an endless
// cycle. The engine decides that return, so `next` needs no index from the
// user; it is recorded to make the log readable on its own.
// "Anterior" only moves the view back over steps already walked. It is not
// an action and is never logged. But choosing a different branch on a
// decision "Anterior" came back to is (phase 3.6): its row carries `back`,
// the trail position of that decision, and replaying it goes back there
// first. Choosing there the branch chosen before only moves the view, so it
// is not an action either.
import Core from './core.js';

/** @typedef {import('./core.js').Flow} Flow */
/** @typedef {{ step: string, exit: number | null, back?: number | null }} LogRow */
/** @typedef {{ at: string, action: 'next' | 'skip' | 'choose', exit?: number, back?: number }} Action */
/** @typedef {{ ok: true, row: LogRow } | { ok: false }} Applied */

/**
 * Applies one action to the tour, if it is valid where the tour stands.
 * `at` is the step the user saw, so an action from a stale page is refused.
 * @param {any} tour a Core.Tour
 * @param {Action} action
 * @returns {Applied}
 */
export function apply(tour, action) {
  if (action.back !== undefined) return applyBack(tour, action);
  if (!tour.atEnd()) return { ok: false };
  const at = tour.current().id;
  if (action.at !== at) return { ok: false };
  const decision = tour.exitsOf(at).length > 1;
  if (action.action === 'choose') {
    const i = action.exit;
    if (!Number.isInteger(i)) return { ok: false };
    if (!decision) {
      if (!tour.openSibling(i).moved) return { ok: false };
      return { ok: true, row: { step: at, exit: /** @type {number} */ (i) } };
    }
    if (!tour.choose(i).moved) return { ok: false };
    return { ok: true, row: { step: at, exit: /** @type {number} */ (i) } };
  }
  if (action.action === 'skip') {
    if (!tour.canSkip() || !tour.skip().moved) return { ok: false };
    return { ok: true, row: { step: at, exit: null } };
  }
  if (action.action === 'next') {
    if (decision) return { ok: false };
    const before = tour.trail.length;
    const result = tour.next();
    if (!result.moved || tour.trail.length !== before + 1) return { ok: false };
    // Followed its one exit, or returned (a note says why).
    return { ok: true, row: { step: at, exit: tour.current().note ? null : 0 } };
  }
  return { ok: false };
}

/**
 * A different branch on a decision left behind, at trail position `back`.
 * @param {any} tour a Core.Tour
 * @param {Action} action
 * @returns {Applied}
 */
function applyBack(tour, action) {
  const { back, exit: i } = action;
  if (action.action !== 'choose' || !Number.isInteger(back) || !Number.isInteger(i)) return { ok: false };
  const b = /** @type {number} */ (back);
  const entry = tour.trail[b];
  if (b < 0 || b >= tour.trail.length - 1 || entry.id !== action.at) return { ok: false };
  if (tour.exitsOf(entry.id).length < 2 || !tour.exitsOf(entry.id)[/** @type {number} */ (i)] || entry.chose === i) return { ok: false };
  const view = tour.pos;
  tour.pos = b;
  if (!tour.choose(i).moved) { tour.pos = view; return { ok: false }; }
  return { ok: true, row: { step: entry.id, exit: /** @type {number} */ (i), back: b } };
}

/**
 * Rebuilds the tour by replaying its log. Returns null if the log does not
 * replay exactly: a row the engine refuses, or one whose exit differs.
 * @param {Flow} flow
 * @param {LogRow[]} rows
 * @returns {any} a Core.Tour, or null
 */
export function replay(flow, rows) {
  const tour = new Core.Tour(flow);
  for (const row of rows) {
    if (row.back !== undefined && row.back !== null) {
      if (row.exit === null || !applyBack(tour, { at: row.step, action: 'choose', exit: row.exit, back: row.back }).ok) return null;
      continue;
    }
    const decision = tour.atEnd() && tour.exitsOf(tour.current().id).length > 1;
    // On a sibling step with others to open, "Siguiente" does not move: the row opened one (6.23).
    const sibling = !decision && row.exit !== null && tour.siblings();
    /** @type {Action} */
    const action = sibling
      ? { at: row.step, action: 'choose', exit: row.exit }
      : !decision
      ? { at: row.step, action: 'next' }
      : row.exit === null
        ? { at: row.step, action: 'skip' }
        : { at: row.step, action: 'choose', exit: row.exit };
    const applied = apply(tour, action);
    if (!applied.ok || applied.row.exit !== row.exit) return null;
  }
  return tour;
}
