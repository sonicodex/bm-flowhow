// The flow viewer (phase 2.4, overview only). The server embeds the latest
// release as JSON; the layout is computed here, in the browser (SPEC §9),
// and drawn as SVG into the diagram card.
import { layoutFlow } from './diagram-layout.js';
import { renderDiagram } from './diagram.js';

const data = document.getElementById('flow-data');
const box = document.getElementById('diagram');
if (data && box) {
  const { name, colour, flow } = JSON.parse(data.textContent);
  box.innerHTML = renderDiagram(layoutFlow(flow), { name, colour });
}
