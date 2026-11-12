/* Core logic: parsing, validation, layout and tour engine. No DOM access. */
var Core = (function () {
  'use strict';

  var TYPES = ['start', 'activity', 'decision', 'wait', 'subflow', 'link', 'end'];
  var TYPE_LABELS = { start: 'Inicio', activity: 'Actividad', decision: 'Decisión', wait: 'Espera', subflow: 'Subflujo', link: 'Enlace', end: 'Fin' };
  var TYPE_ALIASES = {
    inicio: 'start', start: 'start', actividad: 'activity', activity: 'activity',
    decision: 'decision', espera: 'wait', wait: 'wait', subflujo: 'subflow', subflow: 'subflow', enlace: 'link', link: 'link', fin: 'end', end: 'end'
  };

  var EXAMPLE = {
    name: 'Despacho de pedidos',
    objective: 'Atender el pedido de un cliente desde la solicitud hasta el cierre.',
    categories: ['Responsable', 'Herramienta'],
    steps: [
      { id: 'P1', type: 'start', title: 'Recibir solicitud', description: 'Llega el pedido del cliente.', tags: { Responsable: 'Ventas', Herramienta: 'Correo' }, exits: 'P2' },
      { id: 'P2', type: 'activity', title: 'Revisar inventario', description: 'Se consulta si hay existencias.', tags: { Responsable: 'Almacén', Herramienta: 'ERP' }, exits: 'P3' },
      { id: 'P3', type: 'decision', title: '¿Hay existencias?', description: 'Define si se compra o se despacha.', tags: { Responsable: 'Almacén', Herramienta: 'ERP' }, exits: 'Sí:P5 | No:P4' },
      { id: 'P4', type: 'activity', title: 'Comprar material', description: 'Se genera la orden de compra.', tags: { Responsable: 'Compras', Herramienta: 'ERP, Correo' }, exits: 'P2' },
      { id: 'P5', type: 'subflow', ref: 'sub1', title: 'Alistar y despachar', description: 'Se alista el pedido y se entrega al transporte. Tiene su propio flujo.', tags: { Responsable: 'Almacén, Ventas', Herramienta: '' }, exits: 'P6' },
      { id: 'P6', type: 'link', title: 'Flujo: Facturación', description: 'Continúa en otro flujo.', tags: { Responsable: '', Herramienta: '' }, exits: 'P7' },
      { id: 'P7', type: 'end', title: 'Pedido cerrado', description: '', tags: { Responsable: '', Herramienta: '' }, exits: '' }
    ]
  };

  var EXAMPLE_SUB = {
    name: 'Alistamiento de pedido',
    objective: 'Preparar un pedido y entregarlo al transporte. Lo usan varios flujos.',
    categories: ['Responsable', 'Herramienta'],
    steps: [
      { id: 'A1', type: 'start', title: 'Recibir orden de despacho', description: 'Llega la orden con los productos a alistar.', tags: { Responsable: 'Almacén', Herramienta: 'ERP' }, exits: 'A2' },
      { id: 'A2', type: 'activity', title: 'Separar productos', description: 'Se toman los productos de su ubicación.', tags: { Responsable: 'Almacén', Herramienta: '' }, exits: 'A3' },
      { id: 'A3', type: 'decision', title: '¿Requiere embalaje especial?', description: 'Depende del tipo de producto y del destino.', tags: { Responsable: 'Almacén', Herramienta: '' }, exits: 'Sí:A4 | No:A5' },
      { id: 'A4', type: 'activity', title: 'Embalar', description: 'Se protege el producto para el viaje.', tags: { Responsable: 'Almacén', Herramienta: '' }, exits: 'A5' },
      { id: 'A5', type: 'end', title: 'Entregar al transporte', description: 'El pedido sale con su guía.', tags: { Responsable: 'Almacén, Ventas', Herramienta: 'Correo' }, exits: '' }
    ]
  };

  function norm(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
  }

  function parseExits(text) {
    return String(text || '').split(/[|;]/).map(function (p) { return p.trim(); }).filter(Boolean).map(function (p) {
      var i = p.lastIndexOf(':');
      if (i === -1) return { label: '', to: p };
      return { label: p.slice(0, i).trim(), to: p.slice(i + 1).trim() };
    });
  }

  function formatExits(exits) {
    return exits.map(function (e) { return e.label ? e.label + ':' + e.to : e.to; }).join(' | ');
  }

  /* "Depends on" is the incoming view of the same connections that "exits" stores. */
  function predecessorsText(draft, id) {
    id = String(id || '').trim();
    if (!id) return '';
    var out = [];
    draft.steps.forEach(function (s) {
      var sid = String(s.id || '').trim();
      parseExits(s.exits).forEach(function (e) { if (e.to === id && sid) out.push({ label: e.label, to: sid }); });
    });
    return formatExits(out);
  }

  /* Rewrites the predecessors' exits so that exactly the listed steps lead to the step in `row`. */
  function applyDependsOn(draft, row, text) {
    var target = draft.steps[row]; var res = { unknown: [], noId: false };
    var id = target ? String(target.id || '').trim() : '';
    if (!id) { res.noId = true; return res; }
    var wanted = new Map();
    parseExits(text).forEach(function (w) { if (w.to !== id) wanted.set(w.to, w.label); });
    var known = new Set(draft.steps.map(function (s) { return String(s.id || '').trim(); }));
    wanted.forEach(function (_, pid) { if (!known.has(pid)) res.unknown.push(pid); });
    if (res.unknown.length) return res; // nothing is changed when an ID is wrong
    draft.steps.forEach(function (s) {
      var sid = String(s.id || '').trim();
      var exits = parseExits(s.exits); var has = false;
      exits = exits.filter(function (e) {
        if (e.to !== id) return true;
        if (!wanted.has(sid)) return false;
        has = true; if (wanted.get(sid)) e.label = wanted.get(sid);
        return true;
      });
      if (wanted.has(sid) && !has && sid) exits.push({ label: wanted.get(sid), to: id });
      s.exits = formatExits(exits);
    });
    return res;
  }

  function parseTags(text) {
    return String(text || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  }

  /* Turns the editable draft (raw strings) into the structured flow. */
  function compile(draft) {
    var cats = (draft.categories || []).slice();
    return {
      name: String(draft.name || '').trim(),
      objective: String(draft.objective || '').trim(),
      categories: cats,
      steps: (draft.steps || []).map(function (s) {
        var tags = {};
        cats.forEach(function (c) { tags[c] = parseTags(s.tags && s.tags[c]); });
        return {
          id: String(s.id || '').trim(), type: s.type, title: String(s.title || '').trim(),
          description: String(s.description || '').trim(), tags: tags, exits: parseExits(s.exits),
          ref: s.type === 'subflow' ? String(s.ref || '') : ''
        };
      })
    };
  }

  function validate(flow) {
    var errors = [];
    var ids = new Map();
    var ref = function (s, i) { return s.id ? 'Paso ' + s.id : 'Fila ' + (i + 1); };
    if (!flow.name) errors.push({ row: null, message: 'El flujo no tiene nombre.' });
    if (!flow.steps.length) errors.push({ row: null, message: 'El flujo no tiene pasos.' });
    flow.steps.forEach(function (s, i) {
      if (!s.id) errors.push({ row: i, message: 'Fila ' + (i + 1) + ': falta el ID.' });
      else if (ids.has(s.id)) errors.push({ row: i, message: 'Fila ' + (i + 1) + ': el ID «' + s.id + '» está repetido.' });
      else ids.set(s.id, s);
      if (!s.title) errors.push({ row: i, message: ref(s, i) + ': falta el título.' });
      if (TYPES.indexOf(s.type) === -1) errors.push({ row: i, message: ref(s, i) + ': el tipo no es válido.' });
    });
    flow.steps.forEach(function (s, i) {
      s.exits.forEach(function (e) {
        if (!ids.has(e.to)) errors.push({ row: i, message: ref(s, i) + ': la salida apunta a «' + e.to + '», que no existe.' });
      });
      if (s.type === 'decision') {
        if (s.exits.length < 2) errors.push({ row: i, message: ref(s, i) + ': una decisión necesita al menos dos salidas.' });
        if (s.exits.some(function (e) { return !e.label; })) errors.push({ row: i, message: ref(s, i) + ': cada salida de una decisión necesita rótulo (ej. Sí:P5 | No:P4).' });
      }
      if (s.type !== 'end' && s.exits.length === 0) errors.push({ row: i, message: ref(s, i) + ': no tiene salida y no es de tipo Fin.' });
    });
    var starts = flow.steps.filter(function (s) { return s.type === 'start' && s.id; });
    if (flow.steps.length && !starts.length) errors.push({ row: null, message: 'El flujo no tiene ningún paso de tipo Inicio.' });
    var seen = new Set();
    var stack = starts.map(function (s) { return s.id; });
    while (stack.length) {
      var id = stack.pop();
      if (seen.has(id) || !ids.has(id)) continue;
      seen.add(id);
      ids.get(id).exits.forEach(function (e) { stack.push(e.to); });
    }
    if (starts.length) {
      flow.steps.forEach(function (s, i) {
        if (s.id && ids.get(s.id) === s && !seen.has(s.id)) errors.push({ row: i, message: ref(s, i) + ': no es alcanzable desde ningún inicio.' });
      });
    }
    return errors;
  }

  /* Checks subflow references. `lib(id)` returns { name, published } for a flow, or null. */
  function validateRefs(flow, selfId, lib) {
    var errors = [];
    var reaches = function (from, seen) {
      if (from === selfId) return true;
      if (seen.has(from)) return false;
      seen.add(from);
      var f = lib(from);
      if (!f || !f.published) return false;
      return f.published.steps.some(function (s) { return s.type === 'subflow' && s.ref && reaches(s.ref, seen); });
    };
    flow.steps.forEach(function (s, i) {
      if (s.type !== 'subflow') return;
      var ref = s.id ? 'Paso ' + s.id : 'Fila ' + (i + 1);
      var f = s.ref ? lib(s.ref) : null;
      if (!s.ref) errors.push({ row: i, message: ref + ': elige cuál es el subflujo.' });
      else if (!f) errors.push({ row: i, message: ref + ': el subflujo ya no existe.' });
      else if (s.ref === selfId) errors.push({ row: i, message: ref + ': un flujo no puede ser subflujo de sí mismo.' });
      else if (!f.published) errors.push({ row: i, message: ref + ': el subflujo «' + f.name + '» aún no está publicado.' });
      else if (reaches(s.ref, new Set())) errors.push({ row: i, message: ref + ': «' + f.name + '» ya contiene este flujo; no pueden incluirse mutuamente.' });
    });
    return errors;
  }

  /* Parses cells pasted from a spreadsheet (tab separated, header row first). */
  function parseTable(text, resolveFlow) {
    var out = { steps: [], categories: [], errors: [] };
    var lines = String(text || '').split(/\r?\n/).filter(function (l) { return l.trim() !== ''; });
    if (!lines.length) { out.errors.push('No hay nada pegado.'); return out; }
    var head = lines[0].split('\t').map(function (h) { return h.trim(); });
    var col = { id: -1, type: -1, title: -1, description: -1, exits: -1, dep: -1, ref: -1 };
    var cats = [];
    head.forEach(function (h, i) {
      var n = norm(h);
      if (n === 'id') col.id = i;
      else if (n === 'tipo' || n === 'type') col.type = i;
      else if (n === 'titulo' || n === 'title') col.title = i;
      else if (n === 'descripcion' || n === 'description') col.description = i;
      else if (n === 'salidas' || n === 'exits') col.exits = i;
      else if (n === 'depende de' || n === 'depends on') col.dep = i;
      else if (n === 'subflujo' || n === 'subflow') col.ref = i;
      else if (h) cats.push({ name: h, i: i });
    });
    if (col.id === -1 || col.title === -1) {
      out.errors.push('La primera fila debe traer los encabezados. Como mínimo: ID y Título.');
      return out;
    }
    out.categories = cats.map(function (c) { return c.name; });
    lines.slice(1).forEach(function (line, r) {
      var cells = line.split('\t');
      var get = function (i) { return i === -1 || cells[i] == null ? '' : cells[i].trim(); };
      var rawType = get(col.type);
      var type = TYPE_ALIASES[norm(rawType)];
      if (!type) {
        out.errors.push('Fila ' + (r + 2) + ': tipo «' + rawType + '» no reconocido; se dejó como Actividad.');
        type = 'activity';
      }
      var tags = {};
      cats.forEach(function (c) { tags[c.name] = get(c.i); });
      var step = { id: get(col.id), type: type, title: get(col.title), description: get(col.description), tags: tags, exits: get(col.exits) };
      var refName = get(col.ref);
      if (type === 'subflow' && refName) {
        var rid = resolveFlow ? resolveFlow(refName) : null;
        if (rid) step.ref = rid; else out.errors.push('Fila ' + (r + 2) + ': no existe un flujo llamado «' + refName + '».');
      }
      out.steps.push(step);
    });
    if (col.dep !== -1) {
      var tmp = { steps: out.steps };
      lines.slice(1).forEach(function (line, r) {
        var dep = (line.split('\t')[col.dep] || '').trim();
        if (!dep) return;
        // Union with the exits already declared: keep existing predecessors, add the listed ones.
        var merged = [predecessorsText(tmp, out.steps[r].id), dep].filter(Boolean).join(' | ');
        applyDependsOn(tmp, r, merged).unknown.forEach(function (u) {
          out.errors.push('Fila ' + (r + 2) + ': depende de «' + u + '», que no existe.');
        });
      });
    }
    if (!out.steps.length) out.errors.push('Solo llegó la fila de encabezados.');
    return out;
  }

  function toTSV(draft, flowName) {
    var cats = draft.categories || [];
    var clean = function (v) { return String(v == null ? '' : v).replace(/[\t\r\n]+/g, ' '); };
    var rows = [['ID', 'Tipo', 'Subflujo', 'Título', 'Descripción'].concat(cats, ['Salidas'])];
    draft.steps.forEach(function (s) {
      rows.push([s.id, TYPE_LABELS[s.type] || '', s.type === 'subflow' && s.ref && flowName ? flowName(s.ref) || '' : '', s.title, s.description].concat(cats.map(function (c) { return (s.tags && s.tags[c]) || ''; }), [s.exits]).map(clean));
    });
    return rows.map(function (r) { return r.join('\t'); }).join('\n');
  }

  function wrapTitle(title, maxChars, maxLines) {
    maxChars = maxChars || 22; maxLines = maxLines || 2;
    var words = String(title || '').split(/\s+/).filter(Boolean);
    var lines = []; var cur = '';
    words.forEach(function (w) {
      if (!cur) cur = w;
      else if ((cur + ' ' + w).length <= maxChars) cur += ' ' + w;
      else { lines.push(cur); cur = w; }
    });
    if (cur) lines.push(cur);
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      lines[maxLines - 1] = lines[maxLines - 1].slice(0, maxChars - 1).replace(/\s+$/, '') + '…';
    }
    return lines.map(function (l) { return l.length > maxChars + 2 ? l.slice(0, maxChars) + '…' : l; });
  }

  /* Layered top-down layout. Returns node boxes and edge paths; nothing is stored. */
  function layout(flow, o) {
    o = o || {};
    var W = o.nodeW || 188, H = o.nodeH || 56, GX = o.gapX || 40, GY = o.gapY || 60, DW = 24, M = o.margin || 28;
    var seenIds = new Set(); var steps = [];
    flow.steps.forEach(function (s) { if (s.id && !seenIds.has(s.id)) { seenIds.add(s.id); steps.push(s); } });
    if (!steps.length) return { width: 0, height: 0, nodes: [], edges: [] };

    var edges = [];
    steps.forEach(function (s) {
      s.exits.forEach(function (e) {
        if (seenIds.has(e.to) && e.to !== s.id && !edges.some(function (x) { return x.from === s.id && x.to === e.to; })) {
          edges.push({ from: s.id, to: e.to, label: e.label || '' });
        }
      });
    });

    // 1. Mark back edges so the rest of the pipeline works on a DAG.
    var out = new Map(steps.map(function (s) { return [s.id, []]; }));
    edges.forEach(function (e) { out.get(e.from).push(e); });
    var color = new Map();
    var dfs = function (u) {
      color.set(u, 1);
      out.get(u).forEach(function (e) {
        var c = color.get(e.to) || 0;
        if (c === 1) e.back = true; else if (c === 0) dfs(e.to);
      });
      color.set(u, 2);
    };
    steps.filter(function (s) { return s.type === 'start'; }).concat(steps).forEach(function (s) { if (!color.get(s.id)) dfs(s.id); });

    // 2. Longest-path layering.
    var indeg = new Map(steps.map(function (s) { return [s.id, 0]; }));
    var dagOut = new Map(steps.map(function (s) { return [s.id, []]; }));
    edges.forEach(function (e) {
      e.u = e.back ? e.to : e.from; e.v = e.back ? e.from : e.to;
      dagOut.get(e.u).push(e); indeg.set(e.v, indeg.get(e.v) + 1);
    });
    var layer = new Map(steps.map(function (s) { return [s.id, 0]; }));
    var q = steps.filter(function (s) { return indeg.get(s.id) === 0; }).map(function (s) { return s.id; });
    while (q.length) {
      var u0 = q.shift();
      dagOut.get(u0).forEach(function (e) {
        layer.set(e.v, Math.max(layer.get(e.v), layer.get(u0) + 1));
        indeg.set(e.v, indeg.get(e.v) - 1);
        if (indeg.get(e.v) === 0) q.push(e.v);
      });
    }

    // 3. Dummy nodes for edges spanning several layers.
    var N = new Map();
    steps.forEach(function (s) { N.set(s.id, { key: s.id, layer: layer.get(s.id), w: W, step: s }); });
    var up = new Map(), down = new Map();
    var push = function (m, k, v) { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
    var dn = 0;
    edges.forEach(function (e) {
      e.chain = []; var prev = e.u;
      for (var L = layer.get(e.u) + 1; L < layer.get(e.v); L++) {
        var k = '~' + (dn++);
        N.set(k, { key: k, layer: L, w: DW, dummy: true });
        e.chain.push(k); push(down, prev, k); push(up, k, prev); prev = k;
      }
      push(down, prev, e.v); push(up, e.v, prev);
    });

    // 4. Order inside layers: DFS seed, then barycenter sweeps keeping the best.
    var nL = 0; N.forEach(function (n) { nL = Math.max(nL, n.layer + 1); });
    var layers = []; for (var i = 0; i < nL; i++) layers.push([]);
    var placed = new Set();
    var visit = function (k) {
      if (placed.has(k)) return; placed.add(k);
      layers[N.get(k).layer].push(k);
      (down.get(k) || []).forEach(visit);
    };
    steps.forEach(function (s) { if (N.get(s.id).layer === 0) visit(s.id); });
    N.forEach(function (_, k) { visit(k); });

    var positions = function () { var p = new Map(); layers.forEach(function (l) { l.forEach(function (k, i) { p.set(k, i); }); }); return p; };
    var crossings = function () {
      var p = positions(); var c = 0;
      for (var L = 0; L < nL - 1; L++) {
        var segs = [];
        layers[L].forEach(function (a) { (down.get(a) || []).forEach(function (b) { segs.push([p.get(a), p.get(b)]); }); });
        for (var i = 0; i < segs.length; i++) for (var j = i + 1; j < segs.length; j++) {
          if ((segs[i][0] - segs[j][0]) * (segs[i][1] - segs[j][1]) < 0) c++;
        }
      }
      return c;
    };
    var sortBy = function (L, nb) {
      var p = positions(); var bc = new Map();
      layers[L].forEach(function (k, i) {
        var ns = nb.get(k) || [];
        bc.set(k, ns.length ? ns.reduce(function (a, n) { return a + p.get(n); }, 0) / ns.length : i);
      });
      layers[L] = layers[L].map(function (k, i) { return [k, i]; })
        .sort(function (a, b) { return bc.get(a[0]) - bc.get(b[0]) || a[1] - b[1]; })
        .map(function (a) { return a[0]; });
    };
    var best = layers.map(function (l) { return l.slice(); }); var bestC = crossings();
    for (var it = 0; it < 8 && bestC > 0; it++) {
      if (it % 2 === 0) { for (var L1 = 1; L1 < nL; L1++) sortBy(L1, up); }
      else { for (var L2 = nL - 2; L2 >= 0; L2--) sortBy(L2, down); }
      var c = crossings();
      if (c < bestC) { bestC = c; best = layers.map(function (l) { return l.slice(); }); }
    }
    layers = best;

    // 5. Coordinates: pack, then pull each layer toward its neighbours.
    layers.forEach(function (l) {
      var x = 0;
      l.forEach(function (k) { var n = N.get(k); n.x = x + n.w / 2; x += n.w + GX; });
      var shift = (x - GX) / 2;
      l.forEach(function (k) { N.get(k).x -= shift; });
    });
    var place = function (L, nb) {
      var l = layers[L];
      var want = l.map(function (k) {
        var ns = nb.get(k) || [];
        return ns.length ? ns.reduce(function (a, n) { return a + N.get(n).x; }, 0) / ns.length : null;
      });
      if (want.every(function (w) { return w === null; })) return;
      var xs = [];
      l.forEach(function (k, i) {
        var n = N.get(k); var x = want[i] === null ? n.x : want[i];
        if (i > 0) { var p = N.get(l[i - 1]); var min = xs[i - 1] + (p.w + n.w) / 2 + GX; if (x < min) x = min; }
        xs.push(x);
      });
      var err = 0, cnt = 0;
      l.forEach(function (k, i) { if (want[i] !== null) { err += want[i] - xs[i]; cnt++; } });
      var sh = cnt ? err / cnt : 0;
      l.forEach(function (k, i) { N.get(k).x = xs[i] + sh; });
    };
    for (var r = 0; r < 2; r++) {
      for (var La = 1; La < nL; La++) place(La, up);
      for (var Lb = nL - 2; Lb >= 0; Lb--) place(Lb, down);
    }
    for (var Lc = 1; Lc < nL; Lc++) place(Lc, up);

    var minLeft = Infinity, maxRight = -Infinity;
    N.forEach(function (n) { minLeft = Math.min(minLeft, n.x - n.w / 2); maxRight = Math.max(maxRight, n.x + n.w / 2); });
    var shortBack = edges.some(function (e) { return e.back && !e.chain.length; });
    var PX = o.padX != null ? o.padX : M;
    N.forEach(function (n) { n.x = n.x - minLeft + PX; n.y = M + n.layer * (H + GY) + H / 2; });
    var width = maxRight - minLeft + 2 * PX + (shortBack ? 64 : 0);
    var height = 2 * M + nL * H + (nL - 1) * GY;

    // 6. Ports and paths.
    var R = function (k) { return N.get(k); };
    var botMap = new Map(), topMap = new Map();
    edges.forEach(function (e) {
      if (e.back) return;
      var pts = [e.u].concat(e.chain, [e.v]);
      push(botMap, e.u, { e: e, nx: R(pts[1]).x });
      push(topMap, e.v, { e: e, nx: R(pts[pts.length - 2]).x });
    });
    var spread = function (m, prop) {
      m.forEach(function (arr) {
        arr.sort(function (a, b) { return a.nx - b.nx; });
        var step = arr.length > 1 ? Math.min(40, (W - 56) / (arr.length - 1)) : 0;
        arr.forEach(function (a, i) { a.e[prop] = (i - (arr.length - 1) / 2) * step; });
      });
    };
    spread(botMap, 'po'); spread(topMap, 'pi');
    var f = function (n) { return Math.round(n * 10) / 10; };
    // Picks the side of a node a back edge attaches to: toward the dummy, or away from the node's other neighbours when the dummy sits above/below it.
    var sideOf = function (x, node, nb) {
      if (Math.abs(x - node.x) >= W / 4) return x >= node.x ? 1 : -1;
      var ns = (nb.get(node.key) || []).filter(function (k) { return !N.get(k).dummy; });
      if (!ns.length) return 1;
      var mean = ns.reduce(function (a, k) { return a + N.get(k).x; }, 0) / ns.length;
      return mean <= node.x ? 1 : -1;
    };

    edges.forEach(function (e) {
      var u = R(e.u), v = R(e.v); var ch = e.chain.map(R); var d;
      if (!e.back) {
        var p = { x: u.x + e.po, y: u.y + H / 2 }; var first = p;
        d = 'M' + f(p.x) + ' ' + f(p.y);
        var seq = ch.map(function (c) { return { x: c.x, y: c.y - H / 2, through: c.y + H / 2 }; });
        seq.push({ x: v.x + e.pi, y: v.y - H / 2 });
        seq.forEach(function (t) {
          var dy = (t.y - p.y) / 2;
          d += ' C' + f(p.x) + ' ' + f(p.y + dy) + ' ' + f(t.x) + ' ' + f(t.y - dy) + ' ' + f(t.x) + ' ' + f(t.y);
          if (t.through !== undefined) { d += ' L' + f(t.x) + ' ' + f(t.through); p = { x: t.x, y: t.through }; } else p = t;
        });
        var dir = seq[0].x - first.x; var mx = (first.x + seq[0].x) / 2, my = (first.y + seq[0].y) / 2;
        e.lp = Math.abs(dir) < 2 ? { x: mx + 8, y: my + 4, anchor: 'start' }
          : { x: mx + (dir < 0 ? -8 : 8), y: my - 8, anchor: dir < 0 ? 'end' : 'start' };
      } else if (!ch.length) {
        var X = Math.max(u.x, v.x) + W / 2 + 52;
        d = 'M' + f(v.x + W / 2) + ' ' + f(v.y) + ' C' + f(X) + ' ' + f(v.y) + ' ' + f(X) + ' ' + f(u.y) + ' ' + f(u.x + W / 2) + ' ' + f(u.y);
        e.lp = { x: v.x + W / 2 + 8, y: v.y + 17, anchor: 'start' };
      } else {
        var rev = ch.slice().reverse();
        var d0 = rev[0];
        if (Math.abs(d0.x - v.x) < W / 2 + 18) {
          var cx = v.x + sideOf(d0.x, v, up) * (W / 2 - 22); var ys = v.y - H / 2, ye = d0.y + H / 2, dyA = (ye - ys) / 2;
          d = 'M' + f(cx) + ' ' + f(ys) + ' C' + f(cx) + ' ' + f(ys + dyA) + ' ' + f(d0.x) + ' ' + f(ye - dyA) + ' ' + f(d0.x) + ' ' + f(ye);
          e.lp = { x: cx + 8, y: ys - 10, anchor: 'start' };
        } else {
          var s1 = d0.x >= v.x ? 1 : -1; var sx = v.x + s1 * W / 2;
          d = 'M' + f(sx) + ' ' + f(v.y) + ' Q' + f(d0.x) + ' ' + f(v.y) + ' ' + f(d0.x) + ' ' + f(d0.y + H / 2);
          e.lp = { x: sx + s1 * 10, y: v.y - 8, anchor: s1 > 0 ? 'start' : 'end' };
        }
        rev.forEach(function (cN, i) {
          d += ' L' + f(cN.x) + ' ' + f(cN.y - H / 2);
          var nx = rev[i + 1];
          if (nx) {
            var y0 = cN.y - H / 2, y1 = nx.y + H / 2, dy = (y1 - y0) / 2;
            d += ' C' + f(cN.x) + ' ' + f(y0 + dy) + ' ' + f(nx.x) + ' ' + f(y1 - dy) + ' ' + f(nx.x) + ' ' + f(y1);
          }
        });
        var last = rev[rev.length - 1];
        if (Math.abs(last.x - u.x) < W / 2 + 18) {
          var tx = u.x + sideOf(last.x, u, down) * (W / 2 - 22); var yA = last.y - H / 2, yB = u.y + H / 2, dyB = (yB - yA) / 2;
          d += ' C' + f(last.x) + ' ' + f(yA + dyB) + ' ' + f(tx) + ' ' + f(yB - dyB) + ' ' + f(tx) + ' ' + f(yB);
        } else {
          var s2 = last.x >= u.x ? 1 : -1;
          d += ' Q' + f(last.x) + ' ' + f(u.y) + ' ' + f(u.x + s2 * W / 2) + ' ' + f(u.y);
        }
      }
      e.d = d;
    });

    return {
      width: Math.ceil(width), height: Math.ceil(height),
      nodes: steps.map(function (s) { var n = N.get(s.id); return { id: s.id, x: n.x, y: n.y, w: W, h: H, step: s }; }),
      edges: edges.map(function (e) { return { from: e.from, to: e.to, label: e.label, d: e.d, lp: e.lp, back: !!e.back }; })
    };
  }

  /* Tour engine: one step at a time, always following the flow.
     - A step with one exit leads to the next step, even if it was already visited (loops are walked).
     - A step with several exits waits for the user to choose a branch; visited branches can be repeated.
     - A branch ends only at a dead end (an end step or a step without exits). The tour then returns to
       the nearest decision that still has an unvisited branch. */
  function Tour(flow) {
    var self = this;
    this.byId = new Map();
    flow.steps.forEach(function (s) { if (s.id && !self.byId.has(s.id)) self.byId.set(s.id, s); });
    this.ids = Array.from(this.byId.keys());
    var starts = this.ids.filter(function (id) { return self.byId.get(id).type === 'start'; });
    var first = starts.length ? starts : [this.ids[0]];
    this.visited = new Set(); this.trail = []; this.pos = -1;
    this.path = [];     // steps walked since the start, cut back when the tour returns to a decision
    this.taken = new Set(); // branches already chosen, as 'stepId#exitIndex'
    this.stale = 0;     // consecutive moves onto already visited steps without a choice (guards endless cycles)
    this.starts = first.slice(1);
    this._goto(first[0], null);
  }
  Tour.prototype.exitsOf = function (id) {
    var self = this;
    return this.byId.get(id).exits.filter(function (e) { return self.byId.has(e.to) && e.to !== id; });
  };
  Tour.prototype.current = function () { return this.trail[this.pos]; };
  Tour.prototype.step = function () { return this.byId.get(this.current().id); };
  Tour.prototype.atEnd = function () { return this.pos === this.trail.length - 1; };
  /* Complete = every step visited and every branch of every decision taken at least once. */
  Tour.prototype.complete = function () {
    var self = this;
    if (this.visited.size !== this.ids.length) return false;
    return this.ids.every(function (id) { return self.exitsOf(id).length < 2 || !self._hasOpen(id); });
  };
  Tour.prototype._goto = function (id, note) {
    this.stale = this.visited.has(id) ? this.stale + 1 : 0;
    this.visited.add(id); this.path.push(id);
    this.trail.push({ id: id, note: note }); this.pos = this.trail.length - 1;
  };
  Tour.prototype._hasOpen = function (id) {
    var self = this;
    var ex = this.exitsOf(id);
    if (ex.length < 2) return ex.some(function (e) { return !self.visited.has(e.to); });
    return ex.some(function (_, i) { return !self.taken.has(id + '#' + i); });
  };
  Tour.prototype._stuck = function () { return this.stale >= this.ids.length; };
  Tour.prototype._return = function (reason) {
    var self = this;
    for (var i = this.path.length - 2; i >= 0; i--) {
      var id = this.path[i];
      if (this.exitsOf(id).length > 1 && this._hasOpen(id)) {
        this.path.length = i; reason.returned = true;
        this._goto(id, reason); this.stale = 0;
        return { moved: true, returned: true };
      }
    }
    var next = null;
    while (this.starts.length && next === null) { var s = this.starts.shift(); if (!this.visited.has(s)) next = s; }
    if (next === null) { var rest = this.ids.filter(function (x) { return !self.visited.has(x); }); if (rest.length) next = rest[0]; }
    if (next === null) return { done: true };
    this.path = []; reason.jump = true;
    this._goto(next, reason);
    return { moved: true };
  };
  Tour.prototype.options = function () {
    var self = this;
    return this.exitsOf(this.current().id).map(function (e, i) {
      return { index: i, label: e.label, to: e.to, title: self.byId.get(e.to).title, visited: self.visited.has(e.to), taken: self.taken.has(self.current().id + '#' + i) };
    });
  };
  Tour.prototype.needsChoice = function () {
    return this.atEnd() && this.exitsOf(this.current().id).length > 1;
  };
  /* True when the tour may be finished here: everything visited and the flow has nowhere new to go. */
  Tour.prototype.canFinish = function () {
    if (!this.atEnd() || !this.complete()) return false;
    return this.exitsOf(this.current().id).length !== 1 || this._stuck();
  };
  /* At a decision whose branches are all visited while other parts are still pending. */
  Tour.prototype.canSkip = function () {
    var id = this.current().id;
    return this.atEnd() && !this.complete() && this.exitsOf(id).length > 1 && !this._hasOpen(id);
  };
  Tour.prototype.skip = function () { return this._return({ skipped: true }); };
  Tour.prototype.choose = function (i) {
    if (!this.atEnd()) return { moved: false };
    var e = this.exitsOf(this.current().id)[i];
    if (!e) return { moved: false };
    this.taken.add(this.current().id + '#' + i);
    this._goto(e.to, null); this.stale = 0;
    return { moved: true };
  };
  Tour.prototype.next = function () {
    if (!this.atEnd()) { this.pos++; return { moved: true }; }
    var cur = this.current().id; var ex = this.exitsOf(cur);
    if (!ex.length) return this._return({ endAt: cur });
    if (ex.length > 1) return { needChoice: true };
    if (this._stuck()) return this._return({ loopTo: ex[0].to, from: cur });
    this._goto(ex[0].to, null);
    return { moved: true };
  };
  Tour.prototype.prev = function () { if (this.pos > 0) { this.pos--; return true; } return false; };

  return {
    TYPES: TYPES, TYPE_LABELS: TYPE_LABELS, EXAMPLE: EXAMPLE, EXAMPLE_SUB: EXAMPLE_SUB, validateRefs: validateRefs, norm: norm, parseExits: parseExits, parseTags: parseTags, formatExits: formatExits, predecessorsText: predecessorsText, applyDependsOn: applyDependsOn,
    compile: compile, validate: validate, parseTable: parseTable, toTSV: toTSV, wrapTitle: wrapTitle, layout: layout, Tour: Tour
  };
})();
if (typeof module !== 'undefined') module.exports = Core;
