// Subflows laid into their parent's graph (SPEC §7, stage 2; phase 10.1):
// core.js expand(), scopeFlow() and stepCount(), and the Tour over the
// expanded graph. The example flow's P5 is a subflow box of EXAMPLE_SUB.
import assert from 'node:assert';
import { it } from 'vitest';
import C from '../public/js/core.js';

const parent = C.compile(C.EXAMPLE);
const sub = C.compile(C.EXAMPLE_SUB);
const lib = (id) => ({ 2: { name: 'Alistar', published: sub }, 3: { name: 'Facturación', published: null } }[id] || null);

// Walks a tour to its end, taking the first or the last option offered (as core.test.js).
function run(flow, pick) {
  const t = new C.Tour(flow);
  for (let guard = 0; guard < 5000; guard++) {
    if (t.canFinish()) break;
    if (t.canSkip()) { t.skip(); continue; }
    let r = t.next();
    if (r.needSibling) { const ks = t.siblings().exits; r = t.openSibling(ks[pick(ks.length)]); }
    if (r.needChoice) {
      const all = t.options().filter((x) => t.holdsBack(x.index) === null);
      const o = all.filter((x) => !x.taken);
      const from = o.length ? o : all;
      r = t.choose(from[pick(from.length)].index);
    }
    if (r.done) break;
  }
  return t;
}

it('expand: the subflow sits inside its box, with a return step that takes the box exits', () => {
  const e = C.expand(parent, lib);
  const box = parent.steps.find((s) => s.type === 'subflow');
  const ids = e.steps.map((s) => s.id);
  for (const s of sub.steps) assert(ids.includes(`${box.id}/${s.id}`), s.id);
  const back = e.steps.find((s) => s.id === `${box.id}/`);
  assert.strictEqual(back.returns, box.id);
  assert.deepStrictEqual(back.exits, box.exits);
  const start = sub.steps.find((s) => s.type === 'start');
  assert.deepStrictEqual(e.steps.find((s) => s.id === box.id).exits, [{ label: '', to: `${box.id}/${start.id}` }]);
  for (const s of e.steps.filter((x) => x.scope === `${box.id}/`)) assert(s.exits.length > 0, `${s.id} leads somewhere`);
  assert.deepStrictEqual(e.subflows, { [`${box.id}/`]: { id: 2, name: 'Alistar', parent: '', box: box.id } });
  assert.strictEqual(C.stepCount(e), parent.steps.length + sub.steps.length);
});

it('expand: a flow without subflow boxes, or one whose subflow is unpublished, missing or a cycle', () => {
  const plain = { ...parent, steps: parent.steps.filter((s) => s.type !== 'subflow') };
  assert.strictEqual(C.expand(plain, lib), plain);
  assert.strictEqual(C.stepCount(C.expand(parent, () => null)), parent.steps.length);
  assert.strictEqual(C.stepCount(C.expand(parent, () => ({ name: 'x', published: null }))), parent.steps.length);
  // A subflow that contains itself (publishing refuses it) is entered once, never again.
  const selfish = { ...sub, steps: sub.steps.map((s, i) => (i === 1 ? { ...s, type: 'subflow', ref: 2 } : s)) };
  const e = C.expand(parent, (id) => (id === 2 ? { name: 'Alistar', published: selfish } : null));
  assert.strictEqual(C.stepCount(e), parent.steps.length + sub.steps.length);
});

it('scopeFlow: each scope is drawn as its own flow, with expanded ids', () => {
  const e = C.expand(parent, lib);
  const box = parent.steps.find((s) => s.type === 'subflow');
  const root = C.scopeFlow(e, '');
  assert.deepStrictEqual(root.steps.map((s) => [s.id, s.exits]), parent.steps.map((s) => [s.id, s.exits]));
  const inner = C.scopeFlow(e, `${box.id}/`);
  assert.strictEqual(inner.name, 'Alistar');
  assert.deepStrictEqual(inner.steps.map((s) => s.id), sub.steps.map((s) => `${box.id}/${s.id}`));
  assert.deepStrictEqual(inner.steps.map((s) => s.exits.map((x) => x.to)), sub.steps.map((s) => s.exits.map((x) => `${box.id}/${x.to}`)));
  assert.strictEqual(C.scopeFlow(parent, ''), parent);
});

it('tour: entering is mandatory and the whole subflow is walked before the parent goes on', () => {
  const e = C.expand(parent, lib);
  const box = parent.steps.find((s) => s.type === 'subflow');
  for (const pick of [() => 0, (n) => n - 1]) {
    const t = run(e, pick);
    assert(t.canFinish(), 'the tour completes');
    assert.strictEqual([...t.visited].filter((id) => !e.steps.find((s) => s.id === id).returns).length, C.stepCount(e));
    const trail = t.trail.map((x) => x.id);
    const enter = trail.indexOf(box.id), leave = trail.indexOf(`${box.id}/`);
    assert(enter >= 0 && leave > enter);
    // In between, only the subflow's steps; every one of them.
    const inside = trail.slice(enter + 1, leave);
    assert(inside.every((id) => id.startsWith(`${box.id}/`)), inside.join(' '));
    assert.strictEqual(new Set(inside).size, sub.steps.length);
  }
});
