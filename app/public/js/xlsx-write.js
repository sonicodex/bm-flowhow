/* Minimal .xlsx writer (SPEC §6: the template and the export; phase 5.6).
   No DOM, no dependencies; runs in the browser, in Workers and in Node 18+.

   It writes what xlsx.js reads back: one or more sheets of text cells, every
   cell an inline string (so Excel never turns "1.10" into a number or
   "1-2" into a date), a bold, frozen header row, column widths and, when
   asked, a drop-down list on a column. The zip entries are stored
   uncompressed with a fixed date, so the same grid gives the same bytes. */

/**
 * @typedef {{ name: string, rows: string[][], widths?: number[],
 *   lists?: { col: number, values: string[], title: string, message: string }[] }} SheetSpec
 */

var CRC_TABLE = (function () {
  var t = new Uint32Array(256);
  for (var n = 0; n < 256; n++) {
    var c = n;
    for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** @param {Uint8Array} bytes */
function crc32(bytes) {
  var c = 0xffffffff;
  for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* ---------- zip (stored entries) ---------- */

// 1980-01-01 00:00, the earliest DOS date: fixed, so the output is repeatable.
var DOS_TIME = 0, DOS_DATE = (0 << 9) | (1 << 5) | 1;

/** @param {{ name: string, text: string }[]} files @returns {Uint8Array} */
function zip(files) {
  var enc = new TextEncoder();
  /** @type {Uint8Array[]} */
  var parts = [];
  /** @type {Uint8Array[]} */
  var central = [];
  var offset = 0;
  files.forEach(function (f) {
    var name = enc.encode(f.name);
    var data = enc.encode(f.text);
    var crc = crc32(data);
    var local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true); // version needed
    local.setUint16(6, 0x0800, true); // UTF-8 names
    local.setUint16(8, 0, true); // stored
    local.setUint16(10, DOS_TIME, true);
    local.setUint16(12, DOS_DATE, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    var dir = new DataView(new ArrayBuffer(46));
    dir.setUint32(0, 0x02014b50, true);
    dir.setUint16(4, 20, true); // version made by
    dir.setUint16(6, 20, true);
    dir.setUint16(8, 0x0800, true);
    dir.setUint16(10, 0, true);
    dir.setUint16(12, DOS_TIME, true);
    dir.setUint16(14, DOS_DATE, true);
    dir.setUint32(16, crc, true);
    dir.setUint32(20, data.length, true);
    dir.setUint32(24, data.length, true);
    dir.setUint16(28, name.length, true);
    dir.setUint32(42, offset, true);
    parts.push(new Uint8Array(local.buffer), name, data);
    central.push(new Uint8Array(dir.buffer), name);
    offset += 30 + name.length + data.length;
  });
  var dirSize = central.reduce(function (n, b) { return n + b.length; }, 0);
  var end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, dirSize, true);
  end.setUint32(16, offset, true);
  var all = parts.concat(central, [new Uint8Array(end.buffer)]);
  var out = new Uint8Array(all.reduce(function (n, b) { return n + b.length; }, 0));
  var p = 0;
  all.forEach(function (b) { out.set(b, p); p += b.length; });
  return out;
}

/* ---------- xml ---------- */

/** Text for an XML text node or attribute. Characters XML cannot carry
    (control characters other than tab and line breaks) are dropped. */
/** @param {string} s */
function esc(s) {
  return String(s)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[/** @type {'&'} */ (c)]; });
}

/** @param {number} i zero-based @returns {string} A, B, … Z, AA, … */
function colName(i) {
  var s = '';
  for (var n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

var NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
var REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
var PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
var HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

/** Rows that a list applies to: the template's rows, and some room after the export's. */
var LIST_ROWS = 1000;

/** @param {SheetSpec} sheet */
function sheetXml(sheet) {
  var width = sheet.rows.reduce(function (n, r) { return Math.max(n, r.length); }, 1);
  var height = Math.max(sheet.rows.length, 1);
  var out = HEAD + '<worksheet xmlns="' + NS + '" xmlns:r="' + REL_NS + '">';
  out += '<dimension ref="A1:' + colName(width - 1) + height + '"/>';
  out += '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
    '<selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>';
  out += '<sheetFormatPr defaultRowHeight="15"/>';
  if (sheet.widths && sheet.widths.length) {
    out += '<cols>' + sheet.widths.map(function (w, i) {
      return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>';
    }).join('') + '</cols>';
  }
  out += '<sheetData>';
  sheet.rows.forEach(function (row, r) {
    out += '<row r="' + (r + 1) + '">';
    row.forEach(function (value, c) {
      var text = String(value == null ? '' : value);
      if (text === '') return;
      var space = /^\s|\s$/.test(text) ? ' xml:space="preserve"' : '';
      out += '<c r="' + colName(c) + (r + 1) + '" s="' + (r === 0 ? 1 : 2) + '" t="inlineStr"><is><t' + space + '>' + esc(text) + '</t></is></c>';
    });
    out += '</row>';
  });
  out += '</sheetData>';
  if (sheet.lists && sheet.lists.length) {
    out += '<dataValidations count="' + sheet.lists.length + '">' + sheet.lists.map(function (l) {
      var ref = colName(l.col) + '2:' + colName(l.col) + Math.max(LIST_ROWS, sheet.rows.length + 200);
      return '<dataValidation type="list" allowBlank="1" showErrorMessage="1" errorTitle="' + esc(l.title) + '" error="' + esc(l.message) + '" sqref="' + ref + '">' +
        '<formula1>' + esc('"' + l.values.join(',') + '"') + '</formula1></dataValidation>';
    }).join('') + '</dataValidations>';
  }
  return out + '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>';
}

// Style 1: the header (bold, wrapped). Style 2: a cell (wrapped, top aligned).
var STYLES = HEAD + '<styleSheet xmlns="' + NS + '">' +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts>' +
  '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>';

/**
 * A workbook with the given sheets, as the bytes of an .xlsx file.
 * @param {SheetSpec[]} sheets
 * @returns {Uint8Array}
 */
export function writeWorkbook(sheets) {
  var files = [
    {
      name: '[Content_Types].xml',
      text: HEAD + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        sheets.map(function (_, i) {
          return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
        }).join('') + '</Types>',
    },
    {
      name: '_rels/.rels',
      text: HEAD + '<Relationships xmlns="' + PKG_REL + '"><Relationship Id="rId1" Type="' + REL_NS + '/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    },
    {
      name: 'xl/workbook.xml',
      text: HEAD + '<workbook xmlns="' + NS + '" xmlns:r="' + REL_NS + '"><bookViews><workbookView/></bookViews><sheets>' +
        sheets.map(function (s, i) { return '<sheet name="' + esc(s.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('') +
        '</sheets></workbook>',
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      text: HEAD + '<Relationships xmlns="' + PKG_REL + '">' +
        sheets.map(function (_, i) {
          return '<Relationship Id="rId' + (i + 1) + '" Type="' + REL_NS + '/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>';
        }).join('') +
        '<Relationship Id="rId' + (sheets.length + 1) + '" Type="' + REL_NS + '/styles" Target="styles.xml"/></Relationships>',
    },
    { name: 'xl/styles.xml', text: STYLES },
  ];
  sheets.forEach(function (s, i) { files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', text: sheetXml(s) }); });
  return zip(files);
}
