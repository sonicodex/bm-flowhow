// The tour log (phase 3.2). The Tour engine in core.js keeps its state in
// memory; this module rebuilds it from the log, so the server can check every
// action and a tour survives a reload. Shared by the server and the browser.
//
// One log row per action, taken at the step the tour stood on:
//   - choose: a branch of a decision (a step with several exits);
//   - skip:   "Ir a lo que falta por visitar" at a decision;
//   - next:   any other step.
// `exit` is the index of the exit followed, and null when the tour did not
// leave through an exit: a skip, or a return from a dead end or an endless
// cycle. The engine decides that return, so `next` needs no index from the
// user; it is recorded to make the log readable on its own.
// "Anterior" only moves the view back over steps already walked. It is not
// an action and is never logged.
import Core from './core.js';

/** @typedef {import('./core.js').Flow} Flow */
/** @typedef {{ step: string, exit: number | null }} LogRow */
/** @typedef {{ at: string, action: 'next' | 'skip' | 'choose', exit?: number }} Action */
/** @typedef {{ ok: true, row: LogRow } | { ok: false }} Applied */

/**
 * Applies one action to the tour, if it is valid where the tour stands.
 * `at` is the step the user saw, so an action from a stale page is refused.
 * @param {any} tour a Core.Tour
 * @param {Action} action
 * @returns {Applied}
 */
export function apply(tour, action) {
  if (!tour.atEnd()) return { ok: false };
  const at = tour.current().id;
  if (action.at !== at) return { ok: false };
  const decision = tour.exitsOf(at).length > 1;
  if (action.action === 'choose') {
    const i = action.exit;
    if (!decision || !Number.isInteger(i) || !tour.choose(i).moved) return { ok: false };
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
 * Rebuilds the tour by replaying its log. Returns null if the log does not
 * replay exactly: a row the engine refuses, or one whose exit differs.
 * @param {Flow} flow
 * @param {LogRow[]} rows
 * @returns {any} a Core.Tour, or null
 */
export function replay(flow, rows) {
  const tour = new Core.Tour(flow);
  for (const row of rows) {
    const decision = tour.atEnd() && tour.exitsOf(tour.current().id).length > 1;
    /** @type {Action} */
    const action = !decision
      ? { at: row.step, action: 'next' }
      : row.exit === null
        ? { at: row.step, action: 'skip' }
        : { at: row.step, action: 'choose', exit: row.exit };
    const applied = apply(tour, action);
    if (!applied.ok || applied.row.exit !== row.exit) return null;
  }
  return tour;
}
