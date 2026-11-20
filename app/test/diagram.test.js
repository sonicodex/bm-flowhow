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

  // Phase 6.14 (SPEC §7): a badge never falls outside the diagram.
  it('grows the canvas so the badges of a step at the edge are never cut', () => {
    const L = layoutFlow(APERTURA);
    const p8 = L.nodes.find((n) => n.id === 'P8');
    const box = (svg) => svg.match(/viewBox="(-?[\d.]+) (-?[\d.]+) ([\d.]+) ([\d.]+)" width="([\d.]+)" height="([\d.]+)"/).slice(1).map(Number);
    // Without badges, the layout's own size.
    assert.deepStrictEqual(box(draw(APERTURA, 2)), [0, 0, L.width, L.height, L.width, L.height]);
    // A long value on the left of P8, the leftmost column: the canvas starts before it.
    const svg = renderDiagram(L, { name: APERTURA.name, colour: 2 }, {
      state: () => '', walked: () => true,
      badges: { id: 'P8', items: [{ category: 'Responsable', index: 0, value: 'Dirección comercial y ventas' }] },
    });
    const [x, y, w, h, width, height] = box(svg);
    const rect = svg.match(/<g class="badge c1">.*?<rect x="(-?[\d.]+)" y="(-?[\d.]+)" width="(\d+)"/);
    const left = p8.x - p8.w / 2 + Number(rect[1]);
    assert(left < 0, 'the badge would be cut without room');
    assert(x <= left && x + w >= L.width && y === 0 && h === L.height);
    assert.strictEqual(width, w);
    assert.strictEqual(height, h);
  });

  // Owner's decision after 6.14: a badge never covers a parallel connector.
  it('raises the badges on the side of a parallel connector above it', () => {
    const L = layoutFlow(APERTURA);
    const items = [{ category: 'Responsable', index: 0, value: 'SAC' }, { category: 'Herramienta', index: 1, value: 'WP' }];
    const rects = (id) => {
      const svg = renderDiagram(L, { name: APERTURA.name, colour: 2 }, { state: () => '', walked: () => true, badges: { id, items } });
      return [...svg.matchAll(/<g class="badge (c\d)">.*?<rect x="(-?[\d.]+)" y="(-?[\d.]+)" width="\d+" height="(\d+)"/g)].map((m) => ({ slot: m[1], x: Number(m[2]), y: Number(m[3]), h: Number(m[4]) }));
    };
    const node = (id) => L.nodes.find((n) => n.id === id);
    const centre = node('P8').h / 2;
    // P8: connector on the right only. «WP» (right) sits above the line; «SAC» (left) stays centred.
    const [sac, wp] = rects('P8');
    assert(wp.x > 0 && wp.y + wp.h <= centre - 6, 'right badge above the connector');
    assert.strictEqual(sac.y, centre - sac.h / 2);
    // P28, between two: both sides raised.
    for (const r of rects('P28')) assert(r.y + r.h <= centre - 6);
    // A step that is not parallel: centred, as before.
    for (const r of rects('P3')) assert.strictEqual(r.y, centre - r.h / 2);
  });

  // Phase 6.15 (SPEC §7): link steps name where they lead; with access, in the overview, they are links.
  it('gives link steps a tooltip naming the other flow, and makes them links only with an address', () => {
    const L = layoutFlow(APERTURA);
    // Phase 6.17: the app's own tooltip (data-tip), not the browser's <title>.
    const p13 = (svg) => svg.match(/(<a [^>]*>)?<g class="node t-link[^"]*" data-id="P13" data-tip="([^"]*)"[^>]*>(<title>)?/);
    // Without access: the tooltip, no link, and the diagram stays a picture.
    let svg = renderDiagram(L, { name: APERTURA.name, colour: 2 }, undefined, { P13: { name: 'Instalaciones' } });
    assert.deepStrictEqual([p13(svg)[1], unesc(p13(svg)[2]), p13(svg)[3]], [undefined, 'Lleva al flujo «Instalaciones»', undefined]);
    assert.match(svg, /role="img"/);
    // With access: a real link to the other flow's overview, named for assistive technology.
    svg = renderDiagram(L, { name: APERTURA.name, colour: 2 }, undefined, { P13: { name: 'Instalaciones', href: '/flows/1' } });
    assert.strictEqual(unesc(p13(svg)[1]), '<a class="node-link" href="/flows/1" aria-label="Enlace: Instalaciones. Lleva al flujo «Instalaciones»">');
    assert.match(svg, /role="group"/);
    assert.strictEqual(svg.match(/<a /g).length, 1);
    // Where every step is a button (free review), never a link inside one;
    // the button's name says where it leads.
    svg = renderDiagram(L, { name: APERTURA.name, colour: 2 }, { state: () => '', walked: () => true, clickable: true }, { P13: { name: 'Instalaciones', href: '/flows/1' } });
    assert.doesNotMatch(svg, /<a /);
    assert.strictEqual(unesc(p13(svg)[2]), 'Lleva al flujo «Instalaciones»');
    assert.match(unesc(svg), /data-id="P13"[^>]*aria-label="Enlace: Instalaciones\. Lleva al flujo «Instalaciones»"/);
    // Other steps keep their title as the browser's tooltip, and no data-tip.
    assert.match(draw(APERTURA, 2), /data-id="P3" transform="[^"]*"><title>[^<]+<\/title>/);
  });

  // Phase 6.20 (SPEC §7): the branch is chosen on the diagram.
  it('makes the steps a decision leads to into targets, and marks the edges and labels of its branches', () => {
    const L = layoutFlow(APERTURA);
    const branches = {
      decision: 'P6',
      targets: { P7: { exit: 0, name: 'Rama «Externa»: ¿El proveedor es la litografía?', taken: false }, P13: { exit: 1, name: 'Rama «Interna»: Instalaciones, ya recorrida', taken: true } },
    };
    const svg = unesc(renderDiagram(L, { name: APERTURA.name, colour: 2 }, { state: () => '', walked: () => false, branches }));
    // Each target is a button with its branch and its name; nothing else is.
    assert.match(svg, /<g class="node t-decision target" data-id="P7" transform="[^"]*" tabindex="0" role="button" data-branch="0" aria-label="Rama «Externa»: ¿El proveedor es la litografía\?">/);
    assert.match(svg, /<g class="node t-link target taken" data-id="P13" transform="[^"]*" tabindex="0" role="button" data-branch="1" aria-label="Rama «Interna»: Instalaciones, ya recorrida">/);
    assert.strictEqual(svg.match(/role="button"/g).length, 2);
    assert.match(svg, /role="group"/);
    // The decision's edges to them, and their labels, can be lit; the arrow to swap to is named.
    const edges = [...svg.matchAll(/<path class="edge soft"[^>]*data-branch-to="(P\d+)" data-arrow-rest="url\(#arrow-soft\d+\)" data-arrow-lit="url\(#arrow-\d+\)"\/>/g)].map((m) => m[1]);
    assert.deepStrictEqual(edges.sort(), ['P13', 'P7']);
    const labels = [...svg.matchAll(/<text class="edge-label soft"[^>]*data-branch-to="(P\d+)">([^<]*)<\/text>/g)].map((m) => `${m[1]}:${m[2]}`);
    assert.deepStrictEqual(labels.sort(), ['P13:Interna', 'P7:Externa']);
    // Edges of other decisions are not branches here.
    assert.strictEqual(svg.match(/data-branch-to=/g).length, 4);
    // Twins (P34: «Sí» and «No» to P35): one target.
    const twins = unesc(renderDiagram(L, { name: APERTURA.name, colour: 2 }, { state: () => '', walked: () => false, branches: { decision: 'P34', targets: { P35: { exit: 0, name: 'Rama «Sí» o «No»: Entregar con acta', taken: false } } } }));
    assert.strictEqual(twins.match(/role="button"/g).length, 1);
    assert.strictEqual(twins.match(/<path [^>]*data-branch-to="P35"/g).length >= 1, true);
    // Without branches, no targets and a picture.
    assert.doesNotMatch(draw(APERTURA, 2), /target|data-branch/);
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

  it('gives badges the category slot, repeats the four slots from the fifth category, and shows long values whole', () => {
    const items = [0, 1, 2, 3, 4].map((index) => ({ category: `Cat ${index + 1}`, index, value: index === 4 ? 'Planeación de Producción' : `v${index + 1}` }));
    const svg = renderDiagram(layoutFlow(APERTURA), { name: APERTURA.name, colour: 2 }, { state: () => '', walked: () => true, badges: { id: 'P1', items } });
    // Odd categories (1st, 3rd, 5th) on the left of the step, even ones on the right.
    const found = [...svg.matchAll(/<g class="badge (c\d)"><title>Cat (\d)[^<]*<\/title><rect x="(-?[\d.]+)"/g)]
      .map((m) => [m[2], m[1], Number(m[3]) < 0 ? 'left' : 'right'])
      .sort();
    assert.deepStrictEqual(found, [['1', 'c1', 'left'], ['2', 'c2', 'right'], ['3', 'c3', 'left'], ['4', 'c4', 'right'], ['5', 'c1', 'left']]);
    // SPEC §7: whole, never cut with an ellipsis, in a badge as wide as it needs.
    const long = svg.match(/<title>Cat 5: Planeación de Producción<\/title><rect [^>]*width="(\d+)"[^>]*\/><text [^>]*>Planeación de Producción<\/text>/);
    assert(long, 'the value whole');
    assert(Number(long[1]) >= 'Planeación de Producción'.length * 7);
    // (Step titles may be wrapped with an ellipsis; the badges, drawn last, never.)
    assert.doesNotMatch(svg.slice(svg.indexOf('<g class="badges')), /…/);
  });

  // SPEC §7: badges that do not fit beside the step go under it, whole.
  it('puts the badges under the step, in rows, when beside it they would pass the room', () => {
    const L = layoutFlow(APERTURA);
    const p3 = L.nodes.find((n) => n.id === 'P3');
    const items = [
      { category: 'Responsable', index: 0, value: 'Jefe de Instalaciones y Mantenimiento' },
      { category: 'Herramienta', index: 1, value: 'Planeación de Producción' },
    ];
    const draw = (room) => renderDiagram(L, { name: APERTURA.name, colour: 2 }, { state: () => '', walked: () => true, badges: { id: 'P3', items, room } });
    const rects = (svg) => [...svg.matchAll(/<g class="badge c\d">.*?<rect x="(-?[\d.]+)" y="(-?[\d.]+)" width="(\d+)"/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]), w: Number(m[3]) }));
    // Plenty of room: beside it, as before.
    const side = draw(Infinity);
    assert.match(side, /<g class="badges" data-box=/);
    assert(rects(side).every((r) => r.y < p3.h));
    // Narrow: under the step, each row no wider than the room, centred on it.
    const under = draw(p3.w + 40);
    assert.match(under, /<g class="badges below" data-box=/);
    const rs = rects(under);
    assert(rs.every((r) => r.y >= p3.h), 'under the step');
    assert.strictEqual(new Set(rs.map((r) => r.y)).size, 2, 'one row each: together they pass the room');
    for (const r of rs) assert(Math.abs(r.x + r.w / 2 - p3.w / 2) < 1, 'centred');
    // The box the frame reads holds them, and the canvas grows for them.
    const box = under.match(/data-box="([^"]+)"/)[1].split(' ').map(Number);
    const top = p3.y - p3.h / 2;
    assert(box[3] >= top + Math.max(...rs.map((r) => r.y)) + 24);
    assert.doesNotMatch(under.slice(under.indexOf('<g class="badges')), /…/);
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
