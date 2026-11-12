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

let seq = 0;

/**
 * The diagram as SVG markup.
 * @param {DiagramLayout} layout
 * @param {{ name: string, colour: number }} flow  colour: palette slot 1-12
 * @returns {string}
 */
export function renderDiagram(layout, flow) {
  const slot = Number.isInteger(flow.colour) && flow.colour >= 1 && flow.colour <= FLOW_COLOURS ? flow.colour : 1;
  const name = `Diagrama del flujo ${flow.name}`;
  if (!layout.nodes.length) return `<p class="muted">Este flujo todavía no tiene pasos.</p>`;
  const arrow = `arrow-${++seq}`;
  let out = `<svg xmlns="http://www.w3.org/2000/svg" class="diagram flow-${slot}" viewBox="0 0 ${layout.width} ${layout.height}" width="${layout.width}" height="${layout.height}" role="img" aria-label="${esc(name)}">`;
  out += `<defs><marker id="${arrow}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path class="edge-arrow" d="M0 0L10 5L0 10z"/></marker></defs>`;
  for (const e of layout.edges) out += `<path class="edge" d="${edgePath(e.points)}" marker-end="url(#${arrow})"/>`;
  for (const e of layout.edges) {
    if (e.label && e.labelAt) out += `<text class="edge-label" x="${num(e.labelAt.x)}" y="${num(e.labelAt.y)}" text-anchor="${esc(e.labelAt.anchor)}">${esc(e.label)}</text>`;
  }
  for (const n of layout.nodes) {
    out += `<g class="node t-${esc(n.type)}" data-id="${esc(n.id)}" transform="translate(${num(n.x - n.w / 2)} ${num(n.y - n.h / 2)})">`;
    out += `<title>${esc(n.title)}</title>${shape(n)}${icon(n)}${label(n)}</g>`;
  }
  return out + '</svg>';
}
