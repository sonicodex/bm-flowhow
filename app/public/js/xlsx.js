/* Minimal .xlsx reader: one sheet, as rows of text cells. No DOM, no
   dependencies; runs in the browser, in Workers and in Node 18+.

   It reads only what a step grid needs: text and plain numbers. Anything it
   does not understand (formulas without a stored value, dates, booleans,
   error cells, merged cells, encryption, unusual zip features) makes it
   fail with an XlsxError instead of guessing. Every message tells the user
   the way out: copy the cells in Excel and paste them. */

var PASTE_INSTEAD = 'Abre el archivo en Excel, copia las celdas de la hoja y pégalas en el cuadro de pegado.';

export class XlsxError extends Error {
  constructor(reason) {
    super('No se pudo leer el archivo: ' + reason + ' ' + PASTE_INSTEAD);
    this.name = 'XlsxError';
    this.reason = reason;
  }
}

function fail(reason) { throw new XlsxError(reason); }

/* ---------- zip ---------- */

function u16(b, o) { return b[o] | (b[o + 1] << 8); }
function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }

var CRC_TABLE = (function () {
  var t = new Uint32Array(256);
  for (var n = 0; n < 256; n++) {
    var c = n;
    for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  var c = 0xffffffff;
  for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* The central directory, found from the end-of-central-directory record. */
function zipEntries(b) {
  if (b.length < 22 || u32(b, 0) !== 0x04034b50) fail('no es un archivo .xlsx (tampoco sirven .xls, .csv ni .ods).');
  var eocd = -1;
  for (var i = b.length - 22; i >= Math.max(0, b.length - 22 - 0xffff); i--) {
    if (u32(b, i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd === -1) fail('el archivo está incompleto o dañado.');
  var count = u16(b, eocd + 10);
  var offset = u32(b, eocd + 16);
  if (count === 0xffff || offset === 0xffffffff) fail('usa un formato de compresión (ZIP64) que este lector no maneja.');
  var entries = new Map();
  var p = offset;
  for (var n = 0; n < count; n++) {
    if (u32(b, p) !== 0x02014b50) fail('el archivo está dañado.');
    var flags = u16(b, p + 8);
    var nameLen = u16(b, p + 28), extraLen = u16(b, p + 30), commentLen = u16(b, p + 32);
    var name = new TextDecoder().decode(b.subarray(p + 46, p + 46 + nameLen));
    entries.set(name, {
      encrypted: (flags & 1) === 1, method: u16(b, p + 10), crc: u32(b, p + 16),
      size: u32(b, p + 20), rawSize: u32(b, p + 24), local: u32(b, p + 42)
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function inflate(data) {
  var stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readEntry(b, entries, name, optional) {
  var e = entries.get(name);
  if (!e) { if (optional) return null; fail('le falta una parte interna (' + name + ').'); }
  if (e.encrypted) fail('está protegido con contraseña.');
  if (u32(b, e.local) !== 0x04034b50) fail('el archivo está dañado.');
  var start = e.local + 30 + u16(b, e.local + 26) + u16(b, e.local + 28);
  var data = b.subarray(start, start + e.size);
  var out;
  if (e.method === 0) out = data;
  else if (e.method === 8) {
    try { out = await inflate(data); } catch (err) { fail('el archivo está dañado.'); }
  } else fail('usa un método de compresión que este lector no maneja.');
  if (out.length !== e.rawSize || crc32(out) !== e.crc) fail('el archivo está dañado.');
  return new TextDecoder('utf-8', { fatal: true }).decode(out);
}

/* ---------- xml ---------- */

// Elements may carry a namespace prefix (<x:c>): writers differ.
var P = '(?:[A-Za-z_][\\w.-]*:)?';

function attrs(tag) {
  var out = {};
  var re = /([A-Za-z_][\w.:-]*)\s*=\s*("([^"]*)"|'([^']*)')/g, m;
  while ((m = re.exec(tag))) out[m[1]] = decode(m[3] != null ? m[3] : m[4]);
  return out;
}

function decode(s) {
  if (s.indexOf('<![CDATA[') !== -1) fail('trae un formato de texto (CDATA) que este lector no maneja.');
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|amp|lt|gt|quot|apos);/g, function (_, e) {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[e];
  });
}

// OOXML escapes some characters inside strings as _xHHHH_ (e.g. _x000D_).
function unescapeX(s) {
  return s.replace(/_x([0-9A-Fa-f]{4})_/g, function (_, h) { return String.fromCharCode(parseInt(h, 16)); });
}

/* Text of a string item: all its <t> runs, without phonetic hints (<rPh>). */
function textOf(xml) {
  var clean = xml.replace(new RegExp('<' + P + 'rPh\\b[\\s\\S]*?</' + P + 'rPh>', 'g'), '');
  var out = '', re = new RegExp('<' + P + 't\\b[^>]*?(?:/>|>([\\s\\S]*?)</' + P + 't>)', 'g'), m;
  while ((m = re.exec(clean))) out += unescapeX(decode(m[1] || ''));
  return out;
}

function relsOf(xml) {
  var out = {}, re = new RegExp('<' + P + 'Relationship\\b[^>]*>', 'g'), m;
  while ((m = re.exec(xml))) { var a = attrs(m[0]); out[a.Id] = { target: a.Target, type: a.Type || '' }; }
  return out;
}

function resolvePath(base, target) {
  if (target[0] === '/') return target.slice(1);
  var parts = base.split('/'); parts.pop();
  target.split('/').forEach(function (seg) { if (seg === '..') parts.pop(); else if (seg !== '.') parts.push(seg); });
  return parts.join('/');
}

function relsPath(part) {
  var i = part.lastIndexOf('/');
  return part.slice(0, i + 1) + '_rels/' + part.slice(i + 1) + '.rels';
}

/* ---------- styles: tell dates apart from plain numbers ---------- */

var DATE_FORMAT_IDS = [14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58];

function isDateCode(code) {
  var bare = code.replace(/"[^"]*"|\[[^\]]*\]|\\./g, '');
  return /[dmyhs]/i.test(bare);
}

function dateStyles(xml) {
  var dates = [];
  if (!xml) return dates;
  var custom = {}, re = new RegExp('<' + P + 'numFmt\\b[^>]*>', 'g'), m;
  while ((m = re.exec(xml))) { var a = attrs(m[0]); custom[a.numFmtId] = a.formatCode || ''; }
  var xfs = new RegExp('<' + P + 'cellXfs\\b[\\s\\S]*?</' + P + 'cellXfs>').exec(xml);
  if (!xfs) return dates;
  var xre = new RegExp('<' + P + 'xf\\b[^>]*>', 'g'), i = 0;
  while ((m = xre.exec(xfs[0]))) {
    var id = Number(attrs(m[0]).numFmtId || 0);
    if (DATE_FORMAT_IDS.indexOf(id) !== -1 || (custom[id] != null && isDateCode(custom[id]))) dates.push(i);
    i++;
  }
  return dates;
}

/* ---------- sheet ---------- */

function colIndex(ref) {
  var letters = /^[A-Z]+/.exec(ref);
  if (!letters) fail('trae una referencia de celda que no se entiende (' + ref + ').');
  var n = 0;
  for (var i = 0; i < letters[0].length; i++) n = n * 26 + (letters[0].charCodeAt(i) - 64);
  return n - 1;
}

function readRows(xml, shared, dateStyleIds) {
  if (new RegExp('<' + P + 'mergeCell\\b').test(xml)) fail('la hoja tiene celdas combinadas; sepáralas antes.');
  var data = new RegExp('<' + P + 'sheetData\\b[^>]*?(?:/>|>([\\s\\S]*?)</' + P + 'sheetData>)').exec(xml);
  if (!data) fail('la hoja no tiene datos.');
  var rows = [];
  var rowRe = new RegExp('<' + P + 'row\\b([^>]*?)(?:/>|>([\\s\\S]*?)</' + P + 'row>)', 'g'), rm, nextRow = 0;
  while ((rm = rowRe.exec(data[1] || ''))) {
    var ra = attrs(rm[1]);
    var r = ra.r ? Number(ra.r) - 1 : nextRow;
    nextRow = r + 1;
    var cells = [];
    var cellRe = new RegExp('<' + P + 'c\\b([^>]*?)(?:/>|>([\\s\\S]*?)</' + P + 'c>)', 'g'), cm, nextCol = 0;
    while ((cm = cellRe.exec(rm[2] || ''))) {
      var a = attrs(cm[1]);
      var ref = a.r || '';
      var c = ref ? colIndex(ref) : nextCol;
      nextCol = c + 1;
      var body = cm[2] || '';
      var v = new RegExp('<' + P + 'v\\b[^>]*>([\\s\\S]*?)</' + P + 'v>').exec(body);
      var value = v ? decode(v[1]) : null;
      var hasFormula = new RegExp('<' + P + 'f\\b').test(body);
      var where = ref || ('fila ' + (r + 1));
      var t = a.t || 'n';
      var text;
      if (t === 's') {
        if (value === null || !/^\d+$/.test(value) || Number(value) >= shared.length) fail('la celda ' + where + ' apunta a un texto que no existe.');
        text = shared[Number(value)];
      } else if (t === 'inlineStr') {
        text = textOf(body);
      } else if (t === 'str') {
        if (value === null) fail('la celda ' + where + ' tiene una fórmula sin resultado guardado.');
        text = unescapeX(value);
      } else if (t === 'n') {
        if (value === null) { if (hasFormula) fail('la celda ' + where + ' tiene una fórmula sin resultado guardado.'); text = ''; }
        else if (dateStyleIds.indexOf(Number(a.s || 0)) !== -1) fail('la celda ' + where + ' tiene una fecha u hora; escríbela como texto.');
        else text = value;
      } else if (t === 'b') fail('la celda ' + where + ' tiene un valor verdadero/falso; escríbelo como texto.');
      else if (t === 'e') fail('la celda ' + where + ' tiene un error de Excel (' + (value || '') + ').');
      else if (t === 'd') fail('la celda ' + where + ' tiene una fecha u hora; escríbela como texto.');
      else fail('la celda ' + where + ' tiene un tipo de dato desconocido («' + t + '»).');
      cells[c] = text;
    }
    for (var k = 0; k < cells.length; k++) if (cells[k] === undefined) cells[k] = '';
    rows[r] = cells;
  }
  for (var j = 0; j < rows.length; j++) if (rows[j] === undefined) rows[j] = [];
  return rows;
}

/* Reads the sheet called `sheetName` as rows of text cells (row 1 first).
   `bytes` is an ArrayBuffer or Uint8Array with the .xlsx file. */
export async function readSheet(bytes, sheetName) {
  var b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  var entries = zipEntries(b);
  var root = relsOf(await readEntry(b, entries, '_rels/.rels'));
  var wbRel = Object.values(root).find(function (r) { return /\/officeDocument$/.test(r.type); });
  if (!wbRel) fail('no es un libro de Excel.');
  var wbPath = resolvePath('', wbRel.target);
  var wb = await readEntry(b, entries, wbPath);
  var wbRels = relsOf(await readEntry(b, entries, relsPath(wbPath)));

  var sheets = [], sre = new RegExp('<' + P + 'sheet\\b[^>]*>', 'g'), m;
  while ((m = sre.exec(wb))) sheets.push(attrs(m[0]));
  var want = String(sheetName).trim().toLowerCase();
  var sheet = sheets.find(function (s) { return String(s.name || '').trim().toLowerCase() === want; });
  if (!sheet) fail('no tiene una hoja llamada «' + sheetName + '» (tiene: ' + sheets.map(function (s) { return s.name; }).join(', ') + ').');
  // The relationship id is r:id, whatever prefix the writer gave its namespace.
  var idKey = Object.keys(sheet).find(function (k) { return /:id$/.test(k); });
  var rel = idKey ? wbRels[sheet[idKey]] : null;
  if (!rel) fail('la hoja «' + sheetName + '» no se encuentra dentro del archivo.');

  var shared = [];
  var ssRel = Object.values(wbRels).find(function (r) { return /\/sharedStrings$/.test(r.type); });
  if (ssRel) {
    var ss = await readEntry(b, entries, resolvePath(wbPath, ssRel.target));
    var sire = new RegExp('<' + P + 'si\\b[^>]*?(?:/>|>([\\s\\S]*?)</' + P + 'si>)', 'g');
    while ((m = sire.exec(ss))) shared.push(textOf(m[1] || ''));
  }
  var stRel = Object.values(wbRels).find(function (r) { return /\/styles$/.test(r.type); });
  var styles = stRel ? await readEntry(b, entries, resolvePath(wbPath, stRel.target), true) : null;

  var sheetXml = await readEntry(b, entries, resolvePath(wbPath, rel.target));
  return readRows(sheetXml, shared, dateStyles(styles));
}
