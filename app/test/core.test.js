// Test cases of the rules module, moved from reference/core.test.js.
// Every original line is kept as it was; only the first line (require
// becomes import) and the it() wrappers are new. One it() per commented
// block of the original; "no repeats" was an empty block and stays empty.
// Phase 1.1 gave the example's link step (P6) its target flow, so three lines
// pass it: validate(f, refs), the paste round trip and the lib of "subflow
// refs". Phase 1.2.6 made flow ids numeric, as stored (main 1, the subflow 2,
// Facturación 3, the draft 4), in those lines and in the printed refs case.
// Phase 3.5 (SPEC §7, branches that meet again are walked together) changed
// what two cases expect: "Sí first" and "every branch must be taken". Their
// original lines are kept as comments above the new ones, and the case they
// guarded (every step visited, a branch not taken) has a flow of its own.
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
// Sí first: dead end returns to the decision; after No the loop is walked and the tour can finish at the decision
// {const w=new C.Tour(f);w.next();w.next();w.choose(0);w.next();w.next();let r=w.next();assert(r.returned&&w.current().id==='P3'&&w.current().note.endAt==='P7');
//  w.choose(1);assert(w.current().id==='P4'&&w.complete()&&!w.canFinish());w.next();w.next();assert(w.current().id==='P3'&&w.canFinish());console.log('Sí-first trail',w.trail.map(x=>x.id).join(' '));}
// Phase 3.5: «Sí» goes straight to P5, where «No» (through the loop) meets it, so it goes back to P3 first.
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
{const d=JSON.parse(JSON.stringify(C.EXAMPLE));assert.strictEqual(C.predecessorsText(d,'P2'),'P1 | P4');assert.strictEqual(C.predecessorsText(d,'P5'),'Sí:P3');
 d.steps.push({id:'P8',type:'end',title:'Nuevo',description:'',tags:{},exits:''});let r=C.applyDependsOn(d,7,'P5 | Tal vez:P3 | ZZ');assert.deepStrictEqual(r.unknown,['ZZ']);assert.strictEqual(d.steps[4].exits,'P6');r=C.applyDependsOn(d,7,'P5 | Tal vez:P3');
 assert.strictEqual(d.steps[4].exits,'P6 | P8');assert.strictEqual(d.steps[2].exits,'Sí:P5 | No:P4 | Tal vez:P8');assert.strictEqual(C.predecessorsText(d,'P8'),'Tal vez:P3 | P5');
 C.applyDependsOn(d,7,'P5');assert.strictEqual(d.steps[2].exits,'Sí:P5 | No:P4');C.applyDependsOn(d,7,'');assert.strictEqual(d.steps[4].exits,'P6');
 const p2=C.parseTable('ID\tTipo\tTítulo\tDepende de\tSalidas\nA\tInicio\tUno\t\t\nB\tDecisión\tDos\tA\t\nC\tFin\tTres\tSí:B\t\nD\tFin\tCuatro\tNo:B\t');assert.deepStrictEqual(p2.errors,[]);assert.strictEqual(p2.steps[0].exits,'B');assert.strictEqual(p2.steps[1].exits,'Sí:C | No:D');assert.deepStrictEqual(C.validate(C.compile({name:'x',categories:[],steps:p2.steps})),[]);}
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
// {const sub=C.compile(C.EXAMPLE_SUB);const w=new C.Tour(sub);w.next();w.next();w.choose(0);w.next();assert(w.current().id==='A5'&&w.visited.size===5&&!w.complete()&&!w.canFinish());
//  const r=w.next();assert(r.returned&&w.current().id==='A3');assert(w.options()[0].taken&&!w.options()[1].taken);w.choose(1);assert(w.current().id==='A5'&&w.complete()&&w.canFinish());}
// Phase 3.5: in the subflow both branches meet at A5, so A5 waits for «No».
{const sub=C.compile(C.EXAMPLE_SUB);const w=new C.Tour(sub);w.next();w.next();w.choose(0);const r=w.next();assert(r.returned&&w.current().id==='A3'&&w.current().note.joinAt==='A5'&&!w.visited.has('A5'));
 assert(w.options()[0].taken&&!w.options()[1].taken);w.choose(1);assert(w.current().id==='A5'&&w.complete()&&w.canFinish());}
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
  const rows = [['S', 'start', 'D'], ['D', 'decision', 'A:X | B:Y | C:Z'], ['X', 'activity', 'M'], ['Y', 'activity', 'M'], ['Z', 'end', ''], ['M', 'activity', 'E'], ['E', 'end', '']];
  let w = new C.Tour(flowOf(rows));
  w.next(); w.choose(0);
  let r = w.next();
  assert(r.returned && w.current().id === 'D' && w.current().note.joinAt === 'M' && !w.visited.has('M'));
  w.choose(1); w.next(); w.next();
  r = w.next();
  assert(r.returned && w.current().id === 'D' && w.current().note.endAt === 'E');
  w.choose(2);
  assert(w.current().id === 'Z' && w.canFinish());
  assert.strictEqual(ids(w), 'S D X D Y M E D Z');
  // The dead branch first: its return is explained, then the two that meet.
  w = new C.Tour(flowOf(rows));
  w.next(); w.choose(2);
  r = w.next();
  assert(r.returned && w.current().note.endAt === 'Z');
  w.choose(0); w.next(); w.choose(1); w.next(); w.next();
  assert(w.current().id === 'E' && w.canFinish());
  assert.strictEqual(ids(w), 'S D Z D X D Y M E');
  assert(once(w, 'M') && once(w, 'E'));
});

it("a branch straight to the meeting point goes back to the decision, with the note said once", () => {
  // Instalaciones P17: «No» goes straight to P21, «Sí» walks P18 to P20 first.
  const w = new C.Tour(flowOf([['S', 'start', 'D'], ['D', 'decision', 'Sí:A | No:M'], ['A', 'activity', 'B'], ['B', 'activity', 'M'], ['M', 'activity', 'E'], ['E', 'end', '']]));
  w.next();
  let r = w.choose(1);
  assert(r.returned && w.current().id === 'D' && w.current().note.direct === 'M' && !w.current().note.quiet);
  assert(w.options()[1].taken && !w.options()[0].taken);
  w.choose(1);
  assert(w.current().id === 'D' && w.current().note.quiet);
  w.choose(0); w.next(); w.next(); w.next();
  assert(w.current().id === 'E' && w.canFinish() && once(w, 'M'));
  assert.strictEqual(ids(w), 'S D D D A B M E');
  // Twins: the first branch goes back, the second one enters.
  const t = new C.Tour(flowOf([['S', 'start', 'D'], ['D', 'decision', 'Sí:M | No:M'], ['M', 'end', '']]));
  t.next(); t.choose(0);
  assert(t.current().id === 'D' && t.current().note.direct === 'M');
  t.choose(1);
  assert(t.current().id === 'M' && t.canFinish() && once(t, 'M'));
});

it("nested decisions: the inner one closes at its meeting point, then the outer one at its own", () => {
  // Apertura P7 inside P6: P7 meets at P10, P6 at P25.
  const w = new C.Tour(flowOf([['S', 'start', 'D1'], ['D1', 'decision', 'a:D2 | b:Y'], ['D2', 'decision', 'c:P | d:Q'], ['P', 'activity', 'R'], ['Q', 'activity', 'R'], ['R', 'activity', 'M'], ['Y', 'activity', 'M'], ['M', 'activity', 'E'], ['E', 'end', '']]));
  assert.deepStrictEqual([w.meet.get('D1'), w.meet.get('D2')], [['M', 'M'], ['R', 'R']]);
  w.next(); w.choose(0); w.choose(0);
  let r = w.next();
  assert(r.returned && w.current().id === 'D2' && w.current().note.joinAt === 'R');
  w.choose(1); w.next();
  r = w.next();
  assert(r.returned && w.current().id === 'D1' && w.current().note.joinAt === 'M');
  w.choose(1); w.next(); w.next();
  assert(w.current().id === 'E' && w.canFinish());
  assert.strictEqual(ids(w), 'S D1 D2 P D2 Q R D1 Y M E');
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

afterAll(() => {
console.log('OK');
});
