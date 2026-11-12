// Builds small .xlsx files (stored, uncompressed zip) for the reader's tests.
const enc = new TextEncoder();

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
const crc32 = (b) => { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

export function zip(files, { encrypted = false, badCrc = false } = {}) {
  const parts = [], central = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const data = enc.encode(text), nameB = enc.encode(name);
    const crc = crc32(data) ^ (badCrc ? 1 : 0);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(6, encrypted ? 1 : 0, true);
    local.setUint32(14, crc, true); local.setUint32(18, data.length, true); local.setUint32(22, data.length, true);
    local.setUint16(26, nameB.length, true);
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true); cd.setUint16(8, encrypted ? 1 : 0, true);
    cd.setUint32(16, crc, true); cd.setUint32(20, data.length, true); cd.setUint32(24, data.length, true);
    cd.setUint16(28, nameB.length, true); cd.setUint32(42, offset, true);
    parts.push(new Uint8Array(local.buffer), nameB, data);
    central.push(new Uint8Array(cd.buffer), nameB);
    offset += 30 + nameB.length + data.length;
  }
  const cdSize = central.reduce((n, p) => n + p.length, 0);
  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true); eocd.setUint16(8, central.length / 2, true); eocd.setUint16(10, central.length / 2, true);
  eocd.setUint32(12, cdSize, true); eocd.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(eocd.buffer)];
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let o = 0; for (const p of all) { out.set(p, o); o += p.length; }
  return out;
}

const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

// `sheetData` is the inside of <sheetData>; `extra` goes after it (e.g. mergeCells).
export function xlsx({ sheetData, extra = '', sharedStrings = null, styles = null, sheetName = 'Flujo', zipOptions } = {}) {
  const files = {
    '_rels/.rels': `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<workbook ${NS}><sheets><sheet name="${sheetName}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/>`
      + (sharedStrings ? `<Relationship Id="rId2" Type="${REL}/sharedStrings" Target="sharedStrings.xml"/>` : '')
      + (styles ? `<Relationship Id="rId3" Type="${REL}/styles" Target="styles.xml"/>` : '') + '</Relationships>',
    'xl/worksheets/sheet1.xml': `<worksheet ${NS}><sheetData>${sheetData}</sheetData>${extra}</worksheet>`,
  };
  if (sharedStrings) files['xl/sharedStrings.xml'] = `<sst ${NS}>${sharedStrings}</sst>`;
  if (styles) files['xl/styles.xml'] = `<styleSheet ${NS}>${styles}</styleSheet>`;
  return zip(files, zipOptions);
}
