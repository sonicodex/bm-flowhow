// The layout adapter (phase 2.2): what the SVG renderer receives.
import assert from 'node:assert';
import { describe, it } from 'vitest';
import C from '../public/js/core.js';
import { layoutFlow } from '../public/js/diagram-layout.js';
import instalaciones from '../../reference/Flujo_Instalaciones.grid.json';
import apertura from '../../reference/Flujo_Apertura_OT.grid.json';

const flowOf = (grid, name) => {
  const d = C.gridToDraft(grid, () => 1);
  return C.compile({ name, categories: d.categories, steps: d.steps });
};
const FLOWS = { 'Apertura de OT': flowOf(apertura, 'Apertura de OT'), Instalaciones: flowOf(instalaciones, 'Instalaciones') };
const exitsOf = (flow) => flow.steps.flatMap((s) => s.exits.map((e) => `${s.id}→${e.to}:${e.label}`)).sort();

// Writes points back as the path layout() drew, so the renderer can
// reproduce the prototype exactly.
const toPath = (points) => points.map((p, i) => {
  const f = (q) => `${q.x} ${q.y}`;
  if (i === 0) return `M${f(p)}`;
  if (!p.c) return ` L${f(p)}`;
  return p.c.length === 2 ? ` C${f(p.c[0])} ${f(p.c[1])} ${f(p)}` : ` Q${f(p.c[0])} ${f(p)}`;
}).join('');

describe('layoutFlow on the reference flows', () => {
  for (const [name, flow] of Object.entries(FLOWS)) {
    it(`${name}: one edge per exit, every node once, no overlaps`, () => {
      const L = layoutFlow(flow);
      assert.deepStrictEqual(L.edges.map((e) => `${e.from}→${e.to}:${e.label}`).sort(), exitsOf(flow));
      assert.deepStrictEqual(L.nodes.map((n) => n.id).sort(), flow.steps.map((s) => s.id).sort());
      for (const a of L.nodes) {
        assert.ok(a.x - a.w / 2 >= 0 && a.x + a.w / 2 <= L.width && a.y - a.h / 2 >= 0 && a.y + a.h / 2 <= L.height, `${a.id} outside`);
        for (const b of L.nodes) {
          if (a === b) continue;
          assert.ok(Math.abs(a.x - b.x) >= (a.w + b.w) / 2 || Math.abs(a.y - b.y) >= (a.h + b.h) / 2, `${a.id} overlaps ${b.id}`);
        }
      }
    });

    it(`${name}: the same flow gives the same layout`, () => {
      assert.deepStrictEqual(layoutFlow(flow), layoutFlow(flow));
    });

    it(`${name}: points rebuild exactly the path layout() drew`, () => {
      const L = layoutFlow(flow);
      const drawn = C.layout(flow, { padX: 96 }).edges.map((e) => e.d.replace(/(\d)\.0\b/g, '$1'));
      assert.deepStrictEqual(L.edges.map((e) => toPath(e.points)), drawn);
    });

    it(`${name}: every edge starts at its source and ends at its target, labels where they go`, () => {
      const L = layoutFlow(flow);
      const node = new Map(L.nodes.map((n) => [n.id, n]));
      const touches = (p, n) => Math.abs(p.x - n.x) <= n.w / 2 + 0.1 && Math.abs(p.y - n.y) <= n.h / 2 + 0.1;
      for (const e of L.edges) {
        const [first, last] = [e.points[0], e.points[e.points.length - 1]];
        // Back edges too run from source to target, so the arrow lands on the target.
        const [a, b] = [node.get(e.from), node.get(e.to)];
        assert.ok(touches(first, a) && touches(last, b), `${e.from}→${e.to}`);
        assert.strictEqual(e.labelAt === null, !e.label);
      }
    });
  }

  it('draws both branches of Apertura de OT P34 to P35, each with its label (Sí left of No)', () => {
    const L = layoutFlow(FLOWS['Apertura de OT']);
    const p34 = L.edges.filter((e) => e.from === 'P34');
    assert.deepStrictEqual(p34.map((e) => [e.to, e.label]), [['P35', 'Sí'], ['P35', 'No']]);
    const [si, no] = p34;
    assert.ok(si.points[0].x < no.points[0].x && si.labelAt.x < no.labelAt.x);
    assert.notDeepStrictEqual(si.points, no.points);
  });

  it('draws the cycle of Apertura de OT (P32 back to P31) as a back edge', () => {
    const back = layoutFlow(FLOWS['Apertura de OT']).edges.filter((e) => e.back);
    assert.deepStrictEqual(back.map((e) => `${e.from}→${e.to}`), ['P32→P31']);
  });
});

describe('layoutFlow on other documents', () => {
  it('lays out a subflow step like any other step', () => {
    const f = C.compile({ name: 'x', categories: [], steps: [
      { id: 'A', type: 'start', title: 'a', exits: 'B' },
      { id: 'B', type: 'subflow', ref: 2, title: 'b', exits: 'C' },
      { id: 'C', type: 'end', title: 'c', exits: '' },
    ] });
    assert.deepStrictEqual(layoutFlow(f).nodes.map((n) => n.type), ['start', 'subflow', 'end']);
  });

  it('returns an empty layout for a flow without steps', () => {
    assert.deepStrictEqual(layoutFlow({ steps: [] }), { width: 0, height: 0, nodes: [], edges: [] });
  });
});
