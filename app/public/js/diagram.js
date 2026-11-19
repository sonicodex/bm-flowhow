// The SVG renderer of the diagram (phase 2.3). It reads only what
// diagram-layout.js returns. It writes geometry (positions, sizes, path
// data) and class names; every colour, type size, stroke and radius comes
// from app.css, through theme.css tokens. Step titles are real <text>.
import Core from './core.js';

/** @typedef {import('./diagram-layout.js').DiagramLayout} DiagramLayout */
/** @typedef {import('./diagram-layout.js').LayoutNode} LayoutNode */
/** @typedef {import('./diagram-layout.js').EdgePoint} EdgePoint */

export const FLOW_COLOURS = 12;

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const num = (n) => String(Math.round(n * 10) / 10);
const pt = (p) => `${num(p.x)} ${num(p.y)}`;

// Icon shapes of app/public/icons/hold_on.svg and link.svg (geometry only;
// they take their fill from app.css), as the prototype draws them.
const ICONS = {
  wait: ['0 0 19.5 19.5', '<path d="M9.75,19.5C4.37,19.5,0,15.13,0,9.75S4.37,0,9.75,0s9.75,4.37,9.75,9.75-4.37,9.75-9.75,9.75ZM9.75,1.5C5.2,1.5,1.5,5.2,1.5,9.75s3.7,8.25,8.25,8.25,8.25-3.7,8.25-8.25S14.3,1.5,9.75,1.5Z"/><polygon points="12.93 12.77 9 10.15 9 5.35 10.5 5.35 10.5 9.35 13.77 11.53 12.93 12.77"/>'],
  link: ['0 0 13.28 13.28', '<rect x="-1.96" y="6" width="16.97" height="1.5" transform="translate(-2.86 6.59) rotate(-45)"/><polygon points="13.28 7.75 11.78 7.75 11.78 1.5 5.53 1.5 5.53 0 13.28 0 13.28 7.75"/>'],
};

/** @param {EdgePoint[]} points */
function edgePath(points) {
  return points.map((p, i) => {
    if (i === 0) return `M${pt(p)}`;
    if (!p.c) return ` L${pt(p)}`;
    return p.c.length === 2 ? ` C${pt(p.c[0])} ${pt(p.c[1])} ${pt(p)}` : ` Q${pt(p.c[0])} ${pt(p)}`;
  }).join('');
}

// The outline of a step. Shapes are geometry; the rounded corners of an
// activity are the --radius token (CSS rx), the ends of start and end steps
// are half circles of the node's own height.
/** @param {LayoutNode} n */
function shape(n) {
  const { w, h } = n;
  if (n.type === 'decision') {
    const c = 16;
    return `<polygon class="node-shape" points="${[c, 0, w - c, 0, w, h / 2, w - c, h, c, h, 0, h / 2].map(num).join(' ')}"/>`;
  }
  if (n.type === 'start' || n.type === 'end') {
    const r = h / 2;
    return `<path class="node-shape" d="M${num(r)} 0 H${num(w - r)} A${num(r)} ${num(r)} 0 0 1 ${num(w - r)} ${num(h)} H${num(r)} A${num(r)} ${num(r)} 0 0 1 ${num(r)} 0 Z"/>`;
  }
  return `<rect class="node-shape" width="${num(w)}" height="${num(h)}"/>`;
}

/** @param {LayoutNode} n */
function icon(n) {
  const at = n.type === 'wait' ? { name: 'wait', x: 12, size: 16 } : n.type === 'link' ? { name: 'link', x: n.w - 28, size: 12 } : null;
  if (!at) return '';
  const [box, body] = ICONS[at.name];
  return `<svg class="node-icon" aria-hidden="true" x="${num(at.x)}" y="${num(n.h / 2 - at.size / 2)}" width="${at.size}" height="${at.size}" viewBox="${box}">${body}</svg>`;
}

// Titles wrap as in the prototype: two lines, narrower beside an icon. Lines
// are spaced in em, so they follow the type size app.css sets.
/** @param {LayoutNode} n */
function label(n) {
  const narrow = n.type === 'wait' || n.type === 'link' || n.type === 'subflow';
  const lines = Core.wrapTitle(n.title || '(sin título)', narrow ? 19 : 22);
  const first = -(lines.length - 1) * 0.6;
  const spans = lines.map((t, i) => `<tspan x="${num(n.w / 2)}" dy="${i === 0 ? first : 1.2}em">${esc(t)}</tspan>`).join('');
  return `<text class="node-text" x="${num(n.w / 2)}" y="${num(n.h / 2)}">${spans}</text>`;
}

// Tag badges beside the active step (SPEC §7): odd categories on the left,
// even ones on the right, as in the prototype. Each badge carries its
// category slot, `c1`…`c4` (theme.css --color-cat-N); with more than four
// categories the slots repeat, so the fifth looks like the first.
export const CATEGORY_SLOTS = 4;
const BADGE = { h: 24, gap: 4, overlap: 10, maxChars: 16, charW: 7.4, padX: 22 };

// Clear space between a parallel connector and the badges raised above it.
const CONNECTOR_CLEAR = 6;

/**
 * `blocked`: the sides where a parallel connector leaves the step (6.12).
 * Badges on such a side are stacked above the connector, not across it.
 * @param {LayoutNode} n
 * @param {{ category: string, index: number, value: string }[]} items
 * @param {[boolean, boolean]} [blocked]  left, right
 */
function badges(n, items, blocked = [false, false]) {
  const sides = [[], []];
  for (const b of items) sides[b.index % 2].push(b);
  const left = n.x - n.w / 2, top = n.y - n.h / 2;
  // Where the badges reach, in the diagram's coordinates, so the canvas can
  // make room for them (SPEC §7; phase 6.14).
  const box = { x0: left, y0: top, x1: left + n.w, y1: top + n.h };
  let out = `<g class="badges" transform="translate(${num(left)} ${num(top)})">`;
  sides.forEach((list, side) => {
    list.forEach((b, i) => {
      const text = b.value.length > BADGE.maxChars ? `${b.value.slice(0, BADGE.maxChars - 1)}…` : b.value;
      const w = Math.round(text.length * BADGE.charW + BADGE.padX);
      const x = side === 0 ? -w + BADGE.overlap : n.w - BADGE.overlap;
      const m = list.length;
      const y = blocked[side]
        ? n.h / 2 - CONNECTOR_CLEAR - (m - i) * BADGE.h - (m - 1 - i) * BADGE.gap
        : n.h / 2 + (i - (m - 1) / 2) * (BADGE.h + BADGE.gap) - BADGE.h / 2;
      box.x0 = Math.min(box.x0, left + x);
      box.x1 = Math.max(box.x1, left + x + w);
      box.y0 = Math.min(box.y0, top + y);
      box.y1 = Math.max(box.y1, top + y + BADGE.h);
      out += `<g class="badge c${(b.index % CATEGORY_SLOTS) + 1}"><title>${esc(`${b.category}: ${b.value}`)}</title>`;
      out += `<rect x="${num(x)}" y="${num(y)}" width="${w}" height="${BADGE.h}"/>`;
      out += `<text x="${num(x + w / 2)}" y="${num(y + BADGE.h / 2)}">${esc(text)}</text></g>`;
    });
  });
  return { svg: out + '</g>', box };
}

// Parallel branches (SPEC §7, Layout; phase 6.12): neighbouring steps of a
// group are joined side to side by a straight double-headed connector, so
// they read as alternatives, not a sequence. Drawn wherever the diagram
// is, under the steps. In the tour it goes soft until both steps are seen.
const PARALLEL_GAP = 4;
const parallelMarkers = (id, tour) =>
  ['', ...(tour ? ['soft'] : [])]
    .map((kind) => ['end', 'start'].map((side) => `<marker id="par-${side}-${kind}${id}" viewBox="0 0 10 10" refX="${side === 'end' ? 9 : 1}" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path class="edge-arrow${kind ? ` ${kind}` : ''}" d="M0 0L10 5L0 10z"/></marker>`).join(''))
    .join('');

/**
 * @param {DiagramLayout} layout
 * @param {number} id
 * @param {((a: string, b: string) => boolean) | null} seen  both steps seen, during the tour
 */
function parallels(layout, id, seen) {
  const at = new Map(layout.nodes.map((n) => [n.id, n]));
  let out = '';
  for (const group of layout.parallel || []) {
    for (let i = 1; i < group.length; i++) {
      const a = at.get(group[i - 1]);
      const b = at.get(group[i]);
      if (!a || !b) continue;
      const from = { x: a.x + a.w / 2 + PARALLEL_GAP, y: a.y };
      const to = { x: b.x - b.w / 2 - PARALLEL_GAP, y: b.y };
      if (to.x <= from.x) continue;
      const kind = seen && !(seen(a.id, b.id)) ? 'soft' : '';
      out += `<path class="parallel${kind ? ' soft' : ''}" d="M${pt(from)} L${pt(to)}" marker-start="url(#par-start-${kind}${id})" marker-end="url(#par-end-${kind}${id})"><title>Opciones alternativas</title></path>`;
    }
  }
  return out;
}

let seq = 0;

/**
 * The tour's marks on the diagram (phase 3.3), and the free review's (phase
 * 6.6). `state` gives each step its classes: `current`, `visited` or `dim`
 * in the tour; `selected`, `hit` or `dim` in the review. `walked` tells the
 * edges already walked from the rest. `badges` are the tags of the active
 * step. `clickable`: every step is a button that selects it (free review).
 * @typedef {{ state: (id: string) => string, walked: (from: string, to: string) => boolean,
 *   badges?: { id: string, items: { category: string, index: number, value: string }[] },
 *   clickable?: boolean }} TourMarks
 */

/**
 * The diagram as SVG markup.
 * @param {DiagramLayout} layout
 * @param {{ name: string, colour: number }} flow  colour: palette slot 1-12
 * @param {TourMarks} [tour]  only during the tour
 * @returns {string}
 */
export function renderDiagram(layout, flow, tour) {
  const slot = Number.isInteger(flow.colour) && flow.colour >= 1 && flow.colour <= FLOW_COLOURS ? flow.colour : 1;
  const name = `Diagrama del flujo ${flow.name}`;
  if (!layout.nodes.length) return `<p class="muted">Este flujo todavía no tiene pasos.</p>`;
  const id = ++seq;
  const marker = (kind) => `<marker id="arrow-${kind}${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path class="edge-arrow${kind ? ` ${kind}` : ''}" d="M0 0L10 5L0 10z"/></marker>`;
  const walked = (e) => !tour || tour.walked(e.from, e.to);
  const kind = (e) => (walked(e) ? '' : 'soft');
  const clickable = !!(tour && tour.clickable);
  // The active step's badges, drawn last; the canvas grows to hold them,
  // so none is cut by the edge (SPEC §7; phase 6.14).
  const active = tour && tour.badges && layout.nodes.find((n) => n.id === tour.badges.id);
  // A parallel step's badges stay clear of its connectors (owner's decision after 6.14).
  const group = active ? (layout.parallel || []).find((g) => g.includes(active.id)) : null;
  const blocked = /** @type {[boolean, boolean]} */ (group ? [group.indexOf(active.id) > 0, group.indexOf(active.id) < group.length - 1] : [false, false]);
  const tags = active && tour.badges.items.length ? badges(active, tour.badges.items, blocked) : null;
  const MARGIN = 4;
  const vx = tags ? Math.min(0, Math.floor(tags.box.x0 - MARGIN)) : 0;
  const vy = tags ? Math.min(0, Math.floor(tags.box.y0 - MARGIN)) : 0;
  const vw = (tags ? Math.max(layout.width, Math.ceil(tags.box.x1 + MARGIN)) : layout.width) - vx;
  const vh = (tags ? Math.max(layout.height, Math.ceil(tags.box.y1 + MARGIN)) : layout.height) - vy;
  // A picture, unless its steps are buttons: inside role="img" they would
  // be hidden from assistive technology.
  let out = `<svg xmlns="http://www.w3.org/2000/svg" class="diagram flow-${slot}${tour ? ' touring' : ''}" viewBox="${vx} ${vy} ${vw} ${vh}" width="${vw}" height="${vh}" role="${clickable ? 'group' : 'img'}" aria-label="${esc(name)}">`;
  out += `<defs>${marker('')}${tour ? marker('soft') : ''}${parallelMarkers(id, !!tour)}</defs>`;
  for (const e of layout.edges) out += `<path class="edge${walked(e) ? '' : ' soft'}" d="${edgePath(e.points)}" marker-end="url(#arrow-${kind(e)}${id})"/>`;
  for (const e of layout.edges) {
    if (e.label && e.labelAt) out += `<text class="edge-label${walked(e) ? '' : ' soft'}" x="${num(e.labelAt.x)}" y="${num(e.labelAt.y)}" text-anchor="${esc(e.labelAt.anchor)}">${esc(e.label)}</text>`;
  }
  out += parallels(layout, id, tour ? (a, b) => tour.walked(a, b) || tour.walked(b, a) : null);
  for (const n of layout.nodes) {
    const state = tour ? tour.state(n.id) : '';
    const button = clickable
      ? ` tabindex="0" role="button" aria-label="${esc(`${Core.TYPE_LABELS[n.type] || n.type}: ${n.title || '(sin título)'}`)}"${/\bselected\b/.test(state) ? ' aria-pressed="true"' : ' aria-pressed="false"'}`
      : '';
    out += `<g class="node t-${esc(n.type)}${state ? ` ${esc(state)}` : ''}${clickable ? ' clickable' : ''}" data-id="${esc(n.id)}" transform="translate(${num(n.x - n.w / 2)} ${num(n.y - n.h / 2)})"${button}>`;
    out += `<title>${esc(n.title)}</title>${shape(n)}${icon(n)}${label(n)}</g>`;
  }
  if (tags) out += tags.svg;
  return out + '</svg>';
}
