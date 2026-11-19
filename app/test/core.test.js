// Test cases of the rules module, moved from reference/core.test.js.
// Every original line is kept as it was; only the first line (require
// becomes import) and the it() wrappers are new. One it() per commented
// block of the original; "no repeats" was an empty block and stays empty.
// Phase 1.1 gave the example's link step (P6) its target flow, so three lines
// pass it: validate(f, refs), the paste round trip and the lib of "subflow
// refs". Phase 1.2.6 made flow ids numeric, as stored (main 1, the subflow 2,
// Facturación 3, the draft 4), in those lines and in the printed refs case.
// Phase 3.5 (SPEC §7, branches that meet again are walked together) changed
// what two cases expect, because the rule changed: "Sí first" and "every
// branch must be taken" (see DECISIONS.md). The case the second guarded
// (every step visited, a branch not taken) has a flow of its own. Phase 3.6
// (one-step branches are walked one after another) changed the subflow case
// again. Phase 6.11 (the rule looks at the decision's shape, not at the order
// picked) rewrote three cases: "nested decisions", "a one-step branch and a
// path of its own" and "Instalaciones P17".
import assert from 'node:assert';
import { afterAll, it } from 'vitest';
import C from '../public/js/core.js';
const f=C.compile(C.EXAMPLE);
it("example flow validates with no errors", () => {
assert.deepStrictEqual(C.validate(f,{selfId:1,lib:id=>({2:{name:'S',published:C.compile(C.EXAMPLE_SUB)},3:{name:'Facturación',published:null}}[id]||null)}),[]);
});
// overlap check
function overlaps(L){for(const a of L.nodes)for(const b of L.nodes){if(a!==b&&a.y===b.y&&Math.abs(a.x-b.x)<a.w)return true;if(!isFinite(a.x)||!isFinite(a.y))return true;}return L.edges.some(e=>!e.d||/NaN|undefined/.test(e.d));}
it("example layout has no overlapping nodes", () => {
const L=C.layout(f);
console.log(L.width,L.height);L.nodes.forEach(n=>console.log(n.id,Math.round(n.x),Math.round(n.y)));
L.edges.forEach(e=>console.log(e.from,'->',e.to,e.back?'(back)':'',e.label,e.d));
assert(!overlaps(L));
});
// tour: always first option
function run(flow,pick){const t=new C.Tour(flow);let guard=0;while(guard++<5000){if(t.canFinish())break;if(t.canSkip()){t.skip();continue;}let r=t.next();if(r.needChoice){const all=t.options();const o=all.filter(x=>!x.taken);const from=o.length?o:all;r=t.choose(from[pick(from.length)].index);}if(r.done)break;}return t;}
it("tour: always the first or the last option completes", () => {
let t=run(f,()=>0);assert(t.complete());t=run(f,n=>n-1);assert(t.complete());
});
// no repeats

it("validation errors (prints the messages)", () => {
// validation errors
const bad=C.compile({name:'x',categories:[],steps:[{id:'A',type:'activity',title:'a',exits:'B'},{id:'B',type:'decision',title:'b',exits:'A'},{id:'C',type:'activity',title:'',exits:'Z'},{id:'A',type:'end',title:'dup',exits:''}]});
console.log(C.validate(bad).map(e=>e.message));
});
it("random graphs: no overlaps, tours complete and never hang", () => {
// random graphs
let seed=7;const rnd=()=>(seed=(seed*1103515245+12345)%2147483648)/2147483648;
for(let k=0;k<400;k++){const n=2+Math.floor(rnd()*14);const steps=[];for(let i=0;i<n;i++){const ex=[];const m=Math.floor(rnd()*3);for(let j=0;j<m;j++)ex.push('L'+j+':S'+Math.floor(rnd()*n));steps.push({id:'S'+i,type:i===0?'start':(rnd()<.1?'start':'activity'),title:'Paso '+i,exits:ex.join('|'),tags:{}});}
 const fl=C.compile({name:'r',categories:[],steps});const LL=C.layout(fl);assert(!overlaps(LL),'overlap '+k);const tt=run(fl,x=>Math.floor(rnd()*x));assert(tt.complete(),'incomplete '+k);
 const t2=new C.Tour(fl);for(let g=0;g<300;g++){let r=t2.next();if(r.needChoice){const o=t2.options();r=t2.choose(o[Math.floor(rnd()*o.length)].index);}if(r.done)break;}}
});
it("follow the flow: No first walks the loop back to the decision", () => {
// follow the flow: No first walks the loop back to the decision
{const w=new C.Tour(f);w.next();w.next();w.choose(1);assert(w.current().id==='P4');w.next();assert(w.current().id==='P2');w.next();assert(w.current().id==='P3'&&w.needsChoice()&&!w.canFinish());
 w.choose(0);w.next();w.next();assert(w.current().id==='P7'&&w.canFinish());console.log('No-first trail',w.trail.map(x=>x.id).join(' '));}
});
it("Sí first: back to the decision before the meeting point, then the loop, then on once", () => {
// «Sí» goes straight to P5, where «No» (through the loop) meets it, so it goes back to P3 first.
{const w=new C.Tour(f);w.next();w.next();let r=w.choose(0);assert(r.returned&&w.current().id==='P3'&&w.current().note.direct==='P5');
 w.choose(1);assert(w.current().id==='P4');w.next();w.next();assert(w.current().id==='P3'&&w.needsChoice()&&!w.canFinish());
 w.choose(0);assert(w.current().id==='P5');w.next();w.next();assert(w.current().id==='P7'&&w.canFinish());assert.strictEqual(w.trail.map(x=>x.id).join(' '),'P1 P2 P3 P3 P4 P2 P3 P5 P6 P7');}
});
it("pure cycle without decisions never hangs", () => {
// pure cycle without decisions never hangs
{const cyc=C.compile({name:'c',categories:[],steps:[{id:'A',type:'start',title:'a',exits:'B'},{id:'B',type:'activity',title:'b',exits:'C'},{id:'C',type:'activity',title:'c',exits:'A'}]});const w=run(cyc,()=>0);assert(w.complete()&&w.canFinish());}
});
it("paste: TSV round trip compiles to the same flow", () => {
// paste
const tsv=C.toTSV(C.EXAMPLE,id=>({2:'Alistamiento de pedido',3:'Facturación'}[id]||''));const p=C.parseTable(tsv,n=>({'Alistamiento de pedido':2,'Facturación':3}[n]||null));assert.deepStrictEqual(p.errors,[]);assert.deepStrictEqual(C.compile({name:C.EXAMPLE.name,objective:C.EXAMPLE.objective,categories:p.categories,steps:p.steps}),f);
console.log(C.wrapTitle('Coordinación de transporte y elementos adicionales requeridos'));
});
it("depends on: predecessors text and applyDependsOn", () => {
// depends on
{const d=JSON.parse(JSON.stringify(C.EXAMPLE));assert.strictEqual(C.predecessorsText(d,'P2'),'P1, P4');assert.strictEqual(C.predecessorsText(d,'P5'),'Sí:P3');
 d.steps.push({id:'P8',type:'end',title:'Nuevo',description:'',tags:{},exits:''});let r=C.applyDependsOn(d,7,'P5 | Tal vez:P3 | ZZ');assert.deepStrictEqual(r.unknown,['ZZ']);assert.strictEqual(d.steps[4].exits,'P6');r=C.applyDependsOn(d,7,'P5 | Tal vez:P3');
 assert.strictEqual(d.steps[4].exits,'P6, P8');assert.strictEqual(d.steps[2].exits,'Sí:P5, No:P4, Tal vez:P8');assert.strictEqual(C.predecessorsText(d,'P8'),'Tal vez:P3, P5');
 C.applyDependsOn(d,7,'P5');assert.strictEqual(d.steps[2].exits,'Sí:P5, No:P4');C.applyDependsOn(d,7,'');assert.strictEqual(d.steps[4].exits,'P6');
 const p2=C.parseTable('ID\tTipo\tTítulo\tDepende de\tSalidas\nA\tInicio\tUno\t\t\nB\tDecisión\tDos\tA\t\nC\tFin\tTres\tSí:B\t\nD\tFin\tCuatro\tNo:B\t');assert.deepStrictEqual(p2.errors,[]);assert.strictEqual(p2.steps[0].exits,'B');assert.strictEqual(p2.steps[1].exits,'Sí:C, No:D');assert.deepStrictEqual(C.validate(C.compile({name:'x',categories:[],steps:p2.steps})),[]);}
});
it("exits: written with a comma, read with a comma, a pipe or a semicolon (SPEC §5)", () => {
  const two = [{ label: 'Sí', to: 'P5' }, { label: 'No', to: 'P4' }];
  for (const text of ['Sí:P5, No:P4', 'Sí:P5 | No:P4', 'Sí:P5; No:P4', 'Sí:P5,No:P4', ' Sí : P5 | No:P4 , ']) assert.deepStrictEqual(C.parseExits(text), two, text);
  assert.deepStrictEqual(C.parseExits('P2 | P3, P4'), [{ label: '', to: 'P2' }, { label: '', to: 'P3' }, { label: '', to: 'P4' }]);
  assert.strictEqual(C.formatExits(two), 'Sí:P5, No:P4');
  assert.strictEqual(C.formatExits(C.parseExits('P2 | P3')), 'P2, P3');
});
it("subflow refs", () => {
// subflow refs
{const lib=id=>({1:{name:'M',published:f},2:{name:'S',published:C.compile(C.EXAMPLE_SUB)},4:{name:'D',published:null},3:{name:'Facturación',published:null}}[id]||null);
 assert.deepStrictEqual(C.validateRefs(f,1,lib),[]);assert.deepStrictEqual(C.validate(C.compile(C.EXAMPLE_SUB)),[]);
 const mk=ref=>C.compile({name:'x',categories:[],steps:[{id:'A',type:'start',title:'a',exits:'B'},{id:'B',type:'subflow',ref,title:'b',exits:'C'},{id:'C',type:'end',title:'c',exits:''}]});
 console.log([null,99,7,4,1].map(r=>C.validateRefs(mk(r),r===7?7:2,lib).map(e=>e.message)));}
});
it("every branch must be taken, even when all steps are visited", () => {
// every branch must be taken, even when all steps are already visited
// In the subflow both branches meet at A5: «Sí» is one step (A4), «No» goes straight there, so after A4
// the tour enters A5 and takes «No» on the way, saying so.
{const sub=C.compile(C.EXAMPLE_SUB);const w=new C.Tour(sub);w.next();w.next();w.choose(0);w.next();assert(w.current().id==='A5'&&w.current().note.alsoDirect==='A3');
 assert.deepStrictEqual(w.current().note.exits,[1]);assert(w.complete()&&w.canFinish());}
// Every step visited and a branch not taken: Y is reached first from its own start; D's branches never meet.
{const two=C.compile({name:'t',categories:[],steps:[{id:'S2',type:'start',title:'s2',exits:'Y'},{id:'S1',type:'start',title:'s1',exits:'D'},{id:'D',type:'decision',title:'d',exits:'a:X | b:Y'},{id:'X',type:'end',title:'x',exits:''},{id:'Y',type:'end',title:'y',exits:''}]});
 const w=new C.Tour(two);w.next();w.next();w.next();w.choose(0);const r=w.next();assert(r.returned&&w.current().id==='D'&&w.visited.size===5&&!w.complete()&&!w.canFinish());
 w.choose(1);assert(w.current().id==='Y'&&w.complete()&&w.canFinish());}
});

// Phase 3.5: branches that meet again are walked together (SPEC §7).
const flowOf = (rows) => C.compile({ name: 't', categories: [], steps: rows.map(([id, type, exits]) => ({ id, type, title: id, exits })) });
const ids = (w) => w.trail.map((x) => x.id).join(' ');
const once = (w, id) => w.trail.filter((x) => x.id === id).length === 1;

it("meeting points: post-dominators shared by two branches; a branch that only shares the end has none", () => {
  const w = new C.Tour(flowOf([['S', 'start', 'D'], ['D', 'decision', 'A:X | B:Y | C:Z'], ['X', 'activity', 'M'], ['Y', 'activity', 'M'], ['Z', 'end', ''], ['M', 'activity', 'E'], ['E', 'end', '']]));
  assert.deepStrictEqual(w.meet.get('D'), ['M', 'M', null]);
  // A loop back into the decision (EXAMPLE's P3) meets the other branch after the decision.
  assert.deepStrictEqual(new C.Tour(f).meet.get('P3'), ['P5', 'P5']);
  // Twin branches meet at their common target.
  assert.deepStrictEqual(new C.Tour(flowOf([['S', 'start', 'D'], ['D', 'decision', 'Sí:M | No:M'], ['M', 'end', '']])).meet.get('D'), ['M', 'M']);
});

it("one branch meets, one dies: the meeting point and what follows are walked once, in either order", () => {
  // A and B are paths of their own (two steps each), so the tour goes back to D between them.
  const rows = [['S', 'start', 'D'], ['D', 'decision', 'A:X | B:Y | C:Z'], ['X', 'activity', 'X2'], ['X2', 'activity', 'M'], ['Y', 'activity', 'Y2'], ['Y2', 'activity', 'M'], ['Z', 'end', ''], ['M', 'activity', 'E'], ['E', 'end', '']];
  let w = new C.Tour(flowOf(rows));
  w.next(); w.choose(0); w.next();
  let r = w.next();
  assert(r.returned && w.current().id === 'D' && w.current().note.joinAt === 'M' && !w.visited.has('M'));
  w.choose(1); w.next(); w.next(); w.next();
  r = w.next();
  assert(r.returned && w.current().id === 'D' && w.current().note.endAt === 'E');
  w.choose(2);
  assert(w.current().id === 'Z' && w.canFinish());
  assert.strictEqual(ids(w), 'S D X X2 D Y Y2 M E D Z');
  // The dead branch first: its return is explained, then the two that meet.
  w = new C.Tour(flowOf(rows));
  w.next(); w.choose(2);
  r = w.next();
  assert(r.returned && w.current().note.endAt === 'Z');
  w.choose(0); w.next(); w.next(); w.choose(1); w.next(); w.next(); w.next();
  assert(w.current().id === 'E' && w.canFinish());
  assert.strictEqual(ids(w), 'S D Z D X X2 D Y Y2 M E');
  assert(once(w, 'M') && once(w, 'E'));
});

it("a branch straight to the meeting point goes back to the decision, with its note every time", () => {
  // Instalaciones P17: «No» goes straight to P21, «Sí» walks P18 to P20 first.
  const w = new C.Tour(flowOf([['S', 'start', 'D'], ['D', 'decision', 'Sí:A | No:M'], ['A', 'activity', 'B'], ['B', 'activity', 'M'], ['M', 'activity', 'E'], ['E', 'end', '']]));
  w.next();
  let r = w.choose(1);
  assert(r.returned && w.current().id === 'D' && w.current().note.direct === 'M');
  assert(w.options()[1].taken && !w.options()[0].taken);
  // Chosen again: back again, with the same note.
  w.choose(1);
  assert(w.current().id === 'D' && w.current().note.direct === 'M');
  w.choose(0); w.next(); w.next(); w.next();
  assert(w.current().id === 'E' && w.canFinish() && once(w, 'M'));
  assert.strictEqual(ids(w), 'S D D D A B M E');
  // Twins (Apertura P34): both go straight there, so there is nothing to go back for. The first one
  // chosen enters, the other is taken on the way and the note says so.
  const t = new C.Tour(flowOf([['S', 'start', 'D'], ['D', 'decision', 'Sí:M | No:M'], ['M', 'end', '']]));
  t.next(); t.choose(0);
  assert(t.current().id === 'M' && t.current().note.alsoDirect === 'D' && t.canFinish() && once(t, 'M'));
  assert.deepStrictEqual(t.current().note.exits, [1]);
});

it("nested decisions: the inner one closes at its meeting point, then the outer one at its own", () => {
  // Apertura P7 inside P6: P7 meets at P10, P6 at P25. Here the inner D2 has a long and a short branch,
  // and the outer D1's branches are both long (one is the decision D2 itself).
  const w = new C.Tour(flowOf([['S', 'start', 'D1'], ['D1', 'decision', 'a:D2 | b:Y'], ['D2', 'decision', 'c:P | d:Q'], ['P', 'activity', 'P2'], ['P2', 'activity', 'R'], ['Q', 'activity', 'R'], ['R', 'activity', 'M'], ['Y', 'activity', 'Y2'], ['Y2', 'activity', 'M'], ['M', 'activity', 'E'], ['E', 'end', '']]));
  assert.deepStrictEqual([w.meet.get('D1'), w.meet.get('D2')], [['M', 'M'], ['R', 'R']]);
  assert.deepStrictEqual([w.reach.get('D1'), w.reach.get('D2')], [['long', 'long'], ['long', 'short']]);
  w.next(); w.choose(0); w.choose(0); w.next();
  // D2 has a long branch and a short one: not parallel, so back to D2 even though only Q is left.
  let r = w.next();
  assert(r.returned && w.current().id === 'D2' && w.current().note.joinAt === 'R');
  w.choose(1); w.next();
  r = w.next();
  assert(r.returned && w.current().id === 'D1' && w.current().note.joinAt === 'M');
  w.choose(1); w.next(); w.next(); w.next();
  assert(w.current().id === 'E' && w.canFinish());
  assert.strictEqual(ids(w), 'S D1 D2 P P2 D2 Q R D1 Y Y2 M E');
});

// Phase 3.6: one-step branches are walked one after another (SPEC §7).
it("one-step branches are walked one after another, the user picking the first (Apertura P26)", () => {
  const rows = [['S', 'start', 'D'], ['D', 'decision', 'a:A | b:B | c:C'], ['A', 'activity', 'M'], ['B', 'activity', 'M'], ['C', 'activity', 'M'], ['M', 'activity', 'E'], ['E', 'end', '']];
  const w = new C.Tour(flowOf(rows));
  assert.deepStrictEqual(w.reach.get('D'), ['short', 'short', 'short']);
  w.next();
  assert(w.needsChoice());
  w.choose(1);
  w.next();
  assert.deepStrictEqual([w.current().id, w.current().note], ['A', { alt: 'D', exit: 0, n: 2, total: 3 }]);
  w.next();
  assert.deepStrictEqual([w.current().id, w.current().note], ['C', { alt: 'D', exit: 2, n: 3, total: 3 }]);
  w.next(); w.next();
  assert(w.current().id === 'E' && w.canFinish());
  assert.strictEqual(ids(w), 'S D B A C M E');
});

it("a one-step branch and a path of its own: back to the decision, whichever is picked first", () => {
  const rows = [['S', 'start', 'D'], ['D', 'decision', 'corta:A | larga:L1'], ['A', 'activity', 'M'], ['L1', 'activity', 'L2'], ['L2', 'activity', 'M'], ['M', 'end', '']];
  // The short one first: the long one is left, a road of its own, so back to D.
  let w = new C.Tour(flowOf(rows));
  w.next(); w.choose(0);
  let r = w.next();
  assert(r.returned && w.current().id === 'D' && w.current().note.joinAt === 'M');
  w.choose(1); w.next(); w.next();
  assert.strictEqual(ids(w), 'S D A D L1 L2 M');
  // The long one first: back to D as well. The order picked never changes it (SPEC §7, phase 6.11).
  w = new C.Tour(flowOf(rows));
  w.next(); w.choose(1); w.next();
  r = w.next();
  assert(r.returned && w.current().id === 'D' && w.current().note.joinAt === 'M');
  w.choose(0); w.next();
  assert(w.current().id === 'M' && w.canFinish());
  assert.strictEqual(ids(w), 'S D L1 L2 D A M');
  assert(!w.parallel.has('D'));
});

it("a one-step branch is short only if its step is not a decision and leads to the meeting point", () => {
  // X is one step but a decision; W is one step that goes elsewhere first (W → V → M).
  const w = new C.Tour(flowOf([['S', 'start', 'D'], ['D', 'decision', 'a:X | b:W | c:A'], ['X', 'decision', 'p:M | q:M'], ['W', 'activity', 'V'], ['V', 'activity', 'M'], ['A', 'activity', 'M'], ['M', 'end', '']]));
  assert.deepStrictEqual(w.reach.get('D'), ['long', 'long', 'short']);
});

it("Instalaciones P17: back to the decision whichever is picked first; P11 (straight there and one step) is parallel", () => {
  const rows = [['S', 'start', 'D'], ['D', 'decision', 'Sí:A | No:M'], ['A', 'activity', 'B'], ['B', 'activity', 'C'], ['C', 'activity', 'M'], ['M', 'activity', 'E'], ['E', 'end', '']];
  let w = new C.Tour(flowOf(rows));
  w.next(); w.choose(1);
  assert(w.current().id === 'D' && w.current().note.direct === 'M');
  // «Sí» first: a path of its own, so back to D before M too, and «No» is chosen there.
  w = new C.Tour(flowOf(rows));
  w.next(); w.choose(0); w.next(); w.next();
  const r = w.next();
  assert(r.returned && w.current().id === 'D' && w.current().note.joinAt === 'M');
  w.choose(1);
  assert(w.current().id === 'M' && once(w, 'M'));
  w.next();
  assert(w.current().id === 'E' && w.canFinish());
  // Instalaciones P11: «Sí» straight there, «No» one step. Picking «Sí» walks «No» right away.
  w = new C.Tour(flowOf([['S', 'start', 'D'], ['D', 'decision', 'Sí:M | No:A'], ['A', 'activity', 'M'], ['M', 'end', '']]));
  w.next(); w.choose(0);
  assert.deepStrictEqual([w.current().id, w.current().note], ['A', { alt: 'D', exit: 1, n: 2, total: 2 }]);
  w.next();
  assert(w.current().id === 'M' && w.canFinish() && once(w, 'M'));
});

// Phase 3.6: "Anterior" can undo a choice (SPEC §7).
it("going back to a decision and picking another branch goes on from there; what was walked still counts", () => {
  const rows = [['S', 'start', 'D'], ['D', 'decision', 'a:A1 | b:B1'], ['A1', 'activity', 'A2'], ['A2', 'activity', 'M'], ['B1', 'activity', 'B2'], ['B2', 'activity', 'M'], ['M', 'end', '']];
  const w = new C.Tour(flowOf(rows));
  w.next(); w.choose(0); w.next();
  assert.strictEqual(w.current().id, 'A2');
  w.prev(); w.prev();
  assert(w.current().id === 'D' && w.canChoose() && !w.needsChoice());
  // The same branch only moves the view.
  w.choose(0);
  assert(w.current().id === 'A1' && w.trail.length === 4);
  w.prev();
  w.choose(1);
  assert.strictEqual(ids(w), 'S D B1');
  assert(w.visited.has('A1') && w.visited.has('A2') && w.taken.has('D#0') && w.visited.size === 5);
  w.next(); w.next();
  // Both taken: M is entered, nothing is left.
  assert(w.current().id === 'M' && w.canFinish());
  // A step that is not a decision cannot be chosen from.
  w.prev();
  assert(!w.canChoose() && !w.choose(0).moved);
});

it("going back past a jump to another start: the jump goes on to what is still unseen", () => {
  const w = new C.Tour(flowOf([['S1', 'start', 'D'], ['D', 'decision', 'a:X | b:Y'], ['X', 'end', ''], ['Y', 'end', ''], ['S2', 'start', 'Z'], ['Z', 'end', '']]));
  w.next(); w.choose(0); w.next(); w.choose(1); w.next();
  assert.deepStrictEqual([w.current().id, w.current().note.jump], ['S2', true]);
  // Back to D's first visit and pick «b»: Y, then a jump. S2 was seen, so it goes to Z.
  while (w.pos > 1) w.prev();
  w.choose(1);
  assert.strictEqual(ids(w), 'S1 D Y');
  w.next();
  assert.deepStrictEqual([w.current().id, w.current().note.jump], ['Z', true]);
  assert(w.canFinish());
});


it("branches that never meet keep the dead-end return (Instalaciones P5)", () => {
  const w = new C.Tour(flowOf([['S', 'start', 'D'], ['D', 'decision', 'Sí:Y | No:X'], ['X', 'end', ''], ['Y', 'activity', 'E'], ['E', 'end', '']]));
  assert.deepStrictEqual(w.meet.get('D'), [null, null]);
  w.next(); w.choose(1);
  const r = w.next();
  assert(r.returned && w.current().note.endAt === 'X');
  w.choose(0); w.next();
  assert(w.current().id === 'E' && w.canFinish());
  assert.strictEqual(ids(w), 'S D X D Y E');
});

// Phase 3.6: the random graphs again, now walked by someone who keeps going back with "Anterior" and
// picking another branch at random. Rewinding restores the saved state (path, pending starts, cycle
// counter), the same state the orphaned inner decision of phase 3.5 lived in.
function walkWithRewinds(flow, rnd) {
  const t = new C.Tour(flow);
  let seen = 0, rewinds = 0;
  for (let guard = 0; guard < 20000; guard++) {
    assert(t.visited.size >= seen, 'progress went backwards');
    seen = t.visited.size;
    if (t.atEnd() && t.canFinish()) break;
    if (rewinds < 40 && t.pos > 0 && rnd() < 0.15) {
      for (let k = 1 + Math.floor(rnd() * 4); k > 0 && t.prev(); k--);
      if (t.canChoose() && rnd() < 0.7) { rewinds++; t.choose(Math.floor(rnd() * t.exitsOf(t.current().id).length)); }
      continue;
    }
    if (!t.atEnd()) { t.next(); continue; }
    if (t.canSkip()) { t.skip(); continue; }
    let r = t.next();
    if (r.needChoice) { const all = t.options(); const o = all.filter((x) => !x.taken); const from = o.length ? o : all; r = t.choose(from[Math.floor(rnd() * from.length)].index); }
    if (r.done) break;
  }
  return t;
}
it("random graphs with rewinds: tours still complete, progress never goes backwards", () => {
  let seed = 11; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let k = 0; k < 2000; k++) {
    const n = 2 + Math.floor(rnd() * 16); const steps = [];
    for (let i = 0; i < n; i++) { const ex = []; const m = Math.floor(rnd() * 4); for (let j = 0; j < m; j++) ex.push('L' + j + ':S' + Math.floor(rnd() * n)); steps.push({ id: 'S' + i, type: i === 0 ? 'start' : (rnd() < .1 ? 'start' : 'activity'), title: 'Paso ' + i, exits: ex.join('|'), tags: {} }); }
    const t = walkWithRewinds(C.compile({ name: 'r', categories: [], steps }), rnd);
    assert(t.complete() && t.canFinish(), 'incomplete ' + k);
  }
});

// Phase 6.11 (SPEC §7): whether the tour goes back to a decision depends on the decision's shape alone.
// A parallel decision (every branch one step or none to the same meeting point) is walked without going
// back; any other decision with a meeting point always goes back to it. Checked on random graphs walked
// in random orders, rewinds included.
it("random graphs: the decision's shape alone decides whether the tour goes back to it", () => {
  let seed = 23; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  let parallel = 0, held = 0;
  for (let k = 0; k < 2000; k++) {
    const n = 3 + Math.floor(rnd() * 12); const steps = [];
    for (let i = 0; i < n; i++) {
      const ex = []; const m = Math.floor(rnd() * 4);
      // More one-step branches to a common step than chance alone would give.
      const target = 'S' + Math.floor(rnd() * n);
      for (let j = 0; j < m; j++) ex.push('L' + j + ':' + (rnd() < 0.4 ? target : 'S' + Math.floor(rnd() * n)));
      steps.push({ id: 'S' + i, type: i === 0 ? 'start' : 'activity', title: 'Paso ' + i, exits: ex.join('|'), tags: {} });
    }
    const t = walkWithRewinds(C.compile({ name: 'r', categories: [], steps }), rnd);
    for (const e of t.trail) {
      const note = e.note || {};
      if (note.alt || note.alsoDirect) { parallel++; assert(t.parallel.has(note.alt || note.alsoDirect), 'walked together, not parallel ' + k); }
      if ((note.joinAt || note.direct) && note.returned) {
        const d = e.id;
        // Held at a meeting point of d: never a parallel decision of that meeting point.
        if (t.parallel.get(d) === (note.joinAt || note.direct)) assert.fail('went back to a parallel decision ' + k);
        held++;
      }
    }
    assert(t.complete() && t.canFinish(), 'incomplete ' + k);
  }
  // Both cases happened, often.
  assert(parallel > 100 && held > 100, `parallel ${parallel}, held ${held}`);
});

afterAll(() => {
console.log('OK');
});
