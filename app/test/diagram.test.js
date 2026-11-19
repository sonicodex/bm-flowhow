// The SVG renderer (phase 2.3).
import assert from 'node:assert';
import { env } from 'cloudflare:test';
import { describe, it } from 'vitest';
import C from '../public/js/core.js';
import { layoutFlow } from '../public/js/diagram-layout.js';
import { renderDiagram } from '../public/js/diagram.js';
import instalaciones from '../../reference/Flujo_Instalaciones.grid.json';
import apertura from '../../reference/Flujo_Apertura_OT.grid.json';

const flowOf = (grid, name) => {
  const d = C.gridToDraft(grid, () => 1);
  return C.compile({ name, categories: d.categories, steps: d.steps });
};
const APERTURA = flowOf(apertura, 'Apertura de OT');
const INSTALACIONES = flowOf(instalaciones, 'Instalaciones');
const draw = (flow, colour) => renderDiagram(layoutFlow(flow), { name: flow.name, colour });
const unesc = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

describe('renderDiagram', () => {
  it('paints each flow with its own palette slot', () => {
    assert.match(draw(INSTALACIONES, 1), /^<svg [^>]*class="diagram flow-1"/);
    assert.match(draw(APERTURA, 2), /^<svg [^>]*class="diagram flow-2"/);
    // The same flow with another slot differs only in that class.
    // Marker ids carry a per-diagram number (phase 6.12 added the parallel connector's).
    const ids = (svg) => svg.replace(/(arrow-|par-(?:start|end)-(?:soft)?)\d+/g, '$1');
    assert.strictEqual(ids(draw(APERTURA, 2)), ids(draw(APERTURA, 7).replace('flow-7', 'flow-2')));
  });

  it('writes no colour, type size, stroke or radius: those come from app.css', () => {
    for (const svg of [draw(APERTURA, 2), draw(INSTALACIONES, 1)]) {
      assert.doesNotMatch(svg, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i, 'colour literal');
      assert.doesNotMatch(svg, / (style|fill|stroke|stroke-width|stroke-dasharray|font-size|font-family|font-weight|rx|ry|opacity)="/, 'presentation attribute');
    }
  });

  it('writes every step title as real text, in the same lines as the prototype', () => {
    const svg = draw(APERTURA, 2);
    for (const s of APERTURA.steps) {
      const lines = C.wrapTitle(s.title, s.type === 'link' ? 19 : 22);
      const node = svg.match(new RegExp(`<g class="node t-${s.type}" data-id="${s.id}"[^>]*>(.*?)</g>`))[1];
      const text = node.match(/<text class="node-text"[^>]*>(.*?)<\/text>/)[1];
      assert.deepStrictEqual([...text.matchAll(/<tspan[^>]*>(.*?)<\/tspan>/g)].map((m) => unesc(m[1])), lines, s.id);
      // The whole title, also when the box shortens it.
      assert.strictEqual(unesc(node.match(/<title>(.*?)<\/title>/)[1]), s.title);
    }
  });

  it('draws one path per edge, with its branch labels', () => {
    const svg = draw(APERTURA, 2);
    const L = layoutFlow(APERTURA);
    assert.strictEqual((svg.match(/<path class="edge"/g) || []).length, L.edges.length);
    const labels = [...svg.matchAll(/<text class="edge-label"[^>]*>(.*?)<\/text>/g)].map((m) => unesc(m[1]));
    assert.deepStrictEqual(labels.sort(), L.edges.filter((e) => e.label).map((e) => e.label).sort());
    assert.strictEqual(labels.filter((l) => l === 'No').length, 2); // P31 and P34
  });

  it('marks link steps (dashed in app.css) and draws subflow steps like activities', () => {
    assert.match(draw(APERTURA, 2), /<g class="node t-link" data-id="P13"/);
    const f = C.compile({ name: 'x', categories: [], steps: [
      { id: 'A', type: 'start', title: 'a', exits: 'B' },
      { id: 'B', type: 'subflow', ref: 2, title: 'b', exits: 'C' },
      { id: 'C', type: 'end', title: 'c <&> "d"', exits: '' },
    ] });
    const svg = draw(f, 3);
    assert.match(svg, /<g class="node t-subflow" data-id="B"[^>]*><title>b<\/title><rect class="node-shape"/);
    assert.match(svg, /c &lt;&amp;&gt; &quot;d&quot;/);
  });

  // Phase 6.12 (SPEC §7, Layout).
  it('joins the steps of parallel branches with a double-headed connector, everywhere', () => {
    const L = layoutFlow(APERTURA);
    const at = (id) => L.nodes.find((n) => n.id === id);
    const connectors = (svg) => [...svg.matchAll(/<path class="parallel( soft)?" d="M([\d.]+) ([\d.]+) L([\d.]+) ([\d.]+)" marker-start="url\(#par-start-(soft)?\d+\)" marker-end="url\(#par-end-(soft)?\d+\)"><title>Opciones alternativas<\/title><\/path>/g)];
    // The overview: P8↔P9, P27↔P28, P28↔P29, from side to side.
    const plain = connectors(draw(APERTURA, 2));
    assert.strictEqual(plain.length, 3);
    const [p8p9] = plain;
    assert.strictEqual(Number(p8p9[2]), at('P8').x + at('P8').w / 2 + 4);
    assert.strictEqual(Number(p8p9[4]), at('P9').x - at('P9').w / 2 - 4);
    assert.strictEqual(Number(p8p9[3]), at('P8').y);
    assert(plain.every((m) => !m[1]));
    // The tour: soft until both steps are seen.
    const seen = new Set(['P8', 'P9']);
    const touring = connectors(renderDiagram(L, { name: APERTURA.name, colour: 2 }, { state: () => '', walked: (a, b) => seen.has(a) && seen.has(b) }));
    assert.deepStrictEqual(touring.map((m) => [m[1] || '', m[6] || '', m[7] || '']), [['', '', ''], [' soft', 'soft', 'soft'], [' soft', 'soft', 'soft']]);
    // Drawn under the steps.
    const svg = draw(APERTURA, 2);
    assert(svg.indexOf('class="parallel"') < svg.indexOf('<g class="node'));
  });

  it('marks the tour on the diagram: current, visited and dimmed steps, walked edges, badges', () => {
    const visited = new Set(['P1', 'P2', 'P3']);
    const svg = renderDiagram(layoutFlow(APERTURA), { name: APERTURA.name, colour: 2 }, {
      state: (id) => (id === 'P3' ? 'current' : visited.has(id) ? 'visited' : 'dim'),
      walked: (from, to) => visited.has(from) && visited.has(to),
      badges: { id: 'P3', items: [{ category: 'Responsable', index: 0, value: 'Diseño' }, { category: 'Herramienta', index: 1, value: 'TC' }] },
    });
    assert.match(svg, /class="diagram flow-2 touring"/);
    assert.match(svg, /<g class="node t-activity current" data-id="P3"/);
    assert.match(svg, /<g class="node t-activity visited" data-id="P2"/);
    assert.match(svg, /<g class="node t-activity dim" data-id="P4"/);
    const edges = [...svg.matchAll(/<path class="edge( soft)?" [^>]*marker-end="url\(#arrow-(soft)?\d+\)"/g)];
    assert.strictEqual(edges.length, layoutFlow(APERTURA).edges.length);
    assert.strictEqual(edges.filter((m) => !m[1]).length, 2); // P1→P2, P2→P3
    for (const m of edges) assert.strictEqual(m[1], m[2] && ' soft'); // soft edges get the soft arrow
    assert.match(svg, /<g class="badge c1"><title>Responsable: Diseño<\/title><rect [^>]*\/><text [^>]*>Diseño<\/text><\/g>/);
    assert.match(svg, /<g class="badge c2"><title>Herramienta: TC<\/title>/);
    assert.doesNotMatch(svg, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i, 'colour literal');
    assert.doesNotMatch(svg, / (style|fill|stroke|stroke-width|stroke-dasharray|font-size|font-family|font-weight|rx|ry|opacity|filter)="/, 'presentation attribute');
  });

  it('gives badges the category slot, repeats the four slots from the fifth category, and shortens long values', () => {
    const items = [0, 1, 2, 3, 4].map((index) => ({ category: `Cat ${index + 1}`, index, value: index === 4 ? 'Planeación de Producción' : `v${index + 1}` }));
    const svg = renderDiagram(layoutFlow(APERTURA), { name: APERTURA.name, colour: 2 }, { state: () => '', walked: () => true, badges: { id: 'P1', items } });
    // Odd categories (1st, 3rd, 5th) on the left of the step, even ones on the right.
    const found = [...svg.matchAll(/<g class="badge (c\d)"><title>Cat (\d)[^<]*<\/title><rect x="(-?[\d.]+)"/g)]
      .map((m) => [m[2], m[1], Number(m[3]) < 0 ? 'left' : 'right'])
      .sort();
    assert.deepStrictEqual(found, [['1', 'c1', 'left'], ['2', 'c2', 'right'], ['3', 'c3', 'left'], ['4', 'c4', 'right'], ['5', 'c1', 'left']]);
    assert.match(svg, /<title>Cat 5: Planeación de Producción<\/title><rect [^>]*\/><text [^>]*>Planeación de P…<\/text>/);
  });

  it('falls back to the first slot for an unknown colour, and draws nothing without steps', () => {
    assert.match(draw(INSTALACIONES, 99), /class="diagram flow-1"/);
    assert.strictEqual(renderDiagram(layoutFlow({ steps: [] }), { name: 'x', colour: 1 }), '<p class="muted">Este flujo todavía no tiene pasos.</p>');
  });
});

describe('app.css flow colours', () => {
  const theme = env.CSS_FILES['theme.css'];
  const appCss = env.CSS_FILES['app.css'];
  const palette = Object.fromEntries([...theme.matchAll(/--flow-(\d+):\s*(#[0-9A-Fa-f]{6})/g)].map((m) => [m[1], m[2]]));
  const token = (name) => theme.match(new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6})`))[1];
  const lum = (hex) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

  it('has one rule per palette slot, with the text colour that contrasts more', () => {
    assert.strictEqual(Object.keys(palette).length, 12);
    const light = token('--color-on-primary'), dark = token('--color-text');
    for (const [slot, hex] of Object.entries(palette)) {
      const rule = appCss.match(new RegExp(`\\.flow-${slot} \\{ --flow: var\\(--flow-${slot}\\); --flow-on: var\\((--[a-z-]+)\\); \\}`));
      assert.ok(rule, `no rule for slot ${slot}`);
      const want = contrast(hex, light) >= contrast(hex, dark) ? '--color-on-primary' : '--color-text';
      assert.strictEqual(rule[1], want, `slot ${slot} (${hex})`);
    }
  });

  it('darkens the flow colour with the --flow-shade-mix token', () => {
    assert.match(theme, /--flow-shade-mix:\s*\d+%/);
    assert.match(appCss, /--flow-strong: color-mix\(in srgb, var\(--flow\) var\(--flow-shade-mix\), var\(--color-text\)\);/);
  });

  it('uses no literal colour, size or radius in the diagram styles', () => {
    const diagram = appCss.slice(appCss.indexOf('/* ---- Diagram'), appCss.indexOf('/* ---- Flow viewer')).replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(diagram, /#[0-9a-f]{3,8}\b|rgba?\(|\d+px|\b(white|black)\b/i);
  });
});

describe('icons (SPEC §9)', () => {
  const fills = (svg) => [...svg.matchAll(/fill:\s*([^;]+);/g)].map((m) => m[1].trim());

  it('the six single-colour icons take the colour of the text around them', () => {
    for (const name of ['link', 'close', 'back', 'subprocess', 'hold_on', 'zoom']) {
      assert.deepStrictEqual(fills(env.ICON_FILES[name]), ['currentColor'], name);
    }
  });

  it('the four status icons keep their own colour', () => {
    for (const name of ['pending', 'in_progress', 'done', 'alert']) {
      const f = fills(env.ICON_FILES[name]);
      assert.ok(f.length && f.every((v) => /^#[0-9a-f]{6}$/i.test(v)), name);
    }
  });
});
