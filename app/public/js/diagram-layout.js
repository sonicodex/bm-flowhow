// The only door to the layout engine (phase 2.2). The SVG renderer reads
// what this returns and nothing else, so changing the engine changes only
// this file. Today the engine is layout() from core.js, the prototype's.
import Core from './core.js';

/**
 * A point of an edge. `c` holds the control points of the curve that ends
 * here: two for a cubic curve, one for a quadratic one; none for a line.
 * @typedef {{ x: number, y: number, c?: { x: number, y: number }[] }} EdgePoint
 */

/**
 * `x`, `y` are the centre of the node.
 * @typedef {{ id: string, x: number, y: number, w: number, h: number,
 *   type: string, title: string }} LayoutNode
 */

/**
 * `labelAt` is where the branch label is anchored (null without a label);
 * `anchor` is the text anchor: start, middle or end.
 * @typedef {{ from: string, to: string, label: string, back: boolean,
 *   points: EdgePoint[],
 *   labelAt: { x: number, y: number, anchor: string } | null }} LayoutEdge
 */

/** @typedef {{ width: number, height: number, nodes: LayoutNode[], edges: LayoutEdge[] }} DiagramLayout */

// The prototype lays out with a wider side margin, so loops and side labels fit.
const OPTIONS = { padX: 96 };

/**
 * Reads the SVG path layout() writes (M, L, C and Q commands, absolute
 * coordinates) into points.
 * @param {string} d
 * @returns {EdgePoint[]}
 */
function pathToPoints(d) {
  const tokens = d.match(/[MLCQ]|-?\d+(?:\.\d+)?/g) || [];
  /** @type {EdgePoint[]} */
  const points = [];
  let i = 0;
  const num = () => Number(tokens[i++]);
  const pt = () => ({ x: num(), y: num() });
  while (i < tokens.length) {
    const cmd = tokens[i++];
    if (cmd === 'M' || cmd === 'L') points.push(pt());
    else if (cmd === 'C') { const c1 = pt(), c2 = pt(); points.push({ ...pt(), c: [c1, c2] }); }
    else if (cmd === 'Q') { const c1 = pt(); points.push({ ...pt(), c: [c1] }); }
    else throw new Error(`diagram-layout: unexpected path command «${cmd}» in ${d}`);
  }
  return points;
}

/**
 * Lays out a compiled flow (core.js compile(), or the server's
 * documentToFlow()) for the diagram.
 * @param {{ steps: { id: string, type: string, title: string, exits: { label: string, to: string }[] }[] }} flow
 * @returns {DiagramLayout}
 */
export function layoutFlow(flow) {
  const L = Core.layout(flow, OPTIONS);
  return {
    width: L.width,
    height: L.height,
    nodes: L.nodes.map((n) => ({ id: n.id, x: n.x, y: n.y, w: n.w, h: n.h, type: n.step.type, title: n.step.title })),
    edges: L.edges.map((e) => ({
      from: e.from,
      to: e.to,
      label: e.label,
      back: e.back,
      points: pathToPoints(e.d),
      labelAt: e.label ? { x: e.lp.x, y: e.lp.y, anchor: e.lp.anchor } : null,
    })),
  };
}
