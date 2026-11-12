// Test cases of the rules module, moved from reference/core.test.js.
// Every original line is kept as it was; only the first line (require
// becomes import) and the it() wrappers are new. One it() per commented
// block of the original; "no repeats" was an empty block and stays empty.
// Phase 1.1 gave the example's link step (P6) its target flow, "fact", so
// three lines pass it: validate(f, refs), the paste round trip and the lib
// of "subflow refs".
import assert from 'node:assert';
import { afterAll, it } from 'vitest';
import C from '../public/js/core.js';
const f=C.compile(C.EXAMPLE);
it("example flow validates with no errors", () => {
assert.deepStrictEqual(C.validate(f,{selfId:'main',lib:id=>({sub1:{name:'S',published:C.compile(C.EXAMPLE_SUB)},fact:{name:'Facturación',published:null}}[id]||null)}),[]);
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
it("Sí first: dead end returns to the decision, then the loop", () => {
// Sí first: dead end returns to the decision; after No the loop is walked and the tour can finish at the decision
{const w=new C.Tour(f);w.next();w.next();w.choose(0);w.next();w.next();let r=w.next();assert(r.returned&&w.current().id==='P3'&&w.current().note.endAt==='P7');
 w.choose(1);assert(w.current().id==='P4'&&w.complete()&&!w.canFinish());w.next();w.next();assert(w.current().id==='P3'&&w.canFinish());console.log('Sí-first trail',w.trail.map(x=>x.id).join(' '));}
});
it("pure cycle without decisions never hangs", () => {
// pure cycle without decisions never hangs
{const cyc=C.compile({name:'c',categories:[],steps:[{id:'A',type:'start',title:'a',exits:'B'},{id:'B',type:'activity',title:'b',exits:'C'},{id:'C',type:'activity',title:'c',exits:'A'}]});const w=run(cyc,()=>0);assert(w.complete()&&w.canFinish());}
});
it("paste: TSV round trip compiles to the same flow", () => {
// paste
const tsv=C.toTSV(C.EXAMPLE,id=>({sub1:'Alistamiento de pedido',fact:'Facturación'}[id]||''));const p=C.parseTable(tsv,n=>({'Alistamiento de pedido':'sub1','Facturación':'fact'}[n]||null));assert.deepStrictEqual(p.errors,[]);assert.deepStrictEqual(C.compile({name:C.EXAMPLE.name,objective:C.EXAMPLE.objective,categories:p.categories,steps:p.steps}),f);
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
{const lib=id=>({main:{name:'M',published:f},sub1:{name:'S',published:C.compile(C.EXAMPLE_SUB)},draft:{name:'D',published:null},fact:{name:'Facturación',published:null}}[id]||null);
 assert.deepStrictEqual(C.validateRefs(f,'main',lib),[]);assert.deepStrictEqual(C.validate(C.compile(C.EXAMPLE_SUB)),[]);
 const mk=ref=>C.compile({name:'x',categories:[],steps:[{id:'A',type:'start',title:'a',exits:'B'},{id:'B',type:'subflow',ref,title:'b',exits:'C'},{id:'C',type:'end',title:'c',exits:''}]});
 console.log(['','zzz','self','draft','main'].map(r=>C.validateRefs(mk(r),r==='self'?'self':'sub1',lib).map(e=>e.message)));}
});
it("every branch must be taken, even when all steps are visited", () => {
// every branch must be taken, even when all steps are already visited
{const sub=C.compile(C.EXAMPLE_SUB);const w=new C.Tour(sub);w.next();w.next();w.choose(0);w.next();assert(w.current().id==='A5'&&w.visited.size===5&&!w.complete()&&!w.canFinish());
 const r=w.next();assert(r.returned&&w.current().id==='A3');assert(w.options()[0].taken&&!w.options()[1].taken);w.choose(1);assert(w.current().id==='A5'&&w.complete()&&w.canFinish());}
});
afterAll(() => {
console.log('OK');
});
