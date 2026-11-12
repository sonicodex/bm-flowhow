// The .xlsx reader (phase 1.2), against the three reference files and
// against small files built to hit each case it must refuse.
import assert from 'node:assert';
import { env } from 'cloudflare:test';
import { describe, it } from 'vitest';
import C from '../public/js/core.js';
import { readSheet, XlsxError } from '../public/js/xlsx.js';
import instalaciones from '../../reference/Flujo_Instalaciones.grid.json';
import apertura from '../../reference/Flujo_Apertura_OT.grid.json';
import { xlsx } from './xlsx-fixture.js';

const file = (name) => Uint8Array.from(atob(env.XLSX_FIXTURES[name]), (c) => c.charCodeAt(0));
const PASTE = 'Abre el archivo en Excel, copia las celdas de la hoja y pégalas en el cuadro de pegado.';
const header = '<row r="1"><c r="A1" t="inlineStr"><is><t>ID</t></is></c><c r="B1" t="inlineStr"><is><t>Título</t></is></c></row>';

async function refuses(bytes, reason) {
  await assert.rejects(readSheet(bytes, 'Flujo'), (e) => {
    assert.ok(e instanceof XlsxError, 'expected an XlsxError, got ' + e);
    assert.strictEqual(e.reason, reason);
    assert.strictEqual(e.message, 'No se pudo leer el archivo: ' + reason + ' ' + PASTE);
    return true;
  });
}

describe('reference files', () => {
  it('Instalaciones written by openpyxl (inline strings) gives the committed grid', async () => {
    assert.deepStrictEqual(C.tableToGrid(await readSheet(file('Flujo_Instalaciones.xlsx'), 'Flujo')), { grid: instalaciones, errors: [] });
  });

  it('Instalaciones re-saved with a shared-strings table gives the same grid', async () => {
    const resaved = await readSheet(file('Flujo_Instalaciones.resaved.xlsx'), 'Flujo');
    assert.deepStrictEqual(resaved, await readSheet(file('Flujo_Instalaciones.xlsx'), 'Flujo'));
    assert.deepStrictEqual(C.tableToGrid(resaved), { grid: instalaciones, errors: [] });
  });

  it('Apertura de OT gives the committed grid', async () => {
    assert.deepStrictEqual(C.tableToGrid(await readSheet(file('Flujo_Apertura_OT.xlsx'), 'Flujo')), { grid: apertura, errors: [] });
  });

  it('reads another sheet by name and refuses a sheet that is not there', async () => {
    const dudas = await readSheet(file('Flujo_Instalaciones.resaved.xlsx'), 'Dudas');
    assert.ok(dudas.length > 1);
    await assert.rejects(readSheet(file('Flujo_Instalaciones.xlsx'), 'Pasos'), (e) =>
      e instanceof XlsxError && e.reason === 'no tiene una hoja llamada «Pasos» (tiene: Flujo, Dudas, Ficha).');
  });
});

describe('what the reader understands', () => {
  it('shared strings with rich-text runs, without phonetic hints, and escapes', async () => {
    const rows = await readSheet(xlsx({
      sharedStrings: '<si><t>ID</t></si><si><r><t>Ti</t></r><r><rPr><b/></rPr><t>tulo</t></r><rPh><t>x</t></rPh></si><si><t>A &amp; B_x000D_</t></si>',
      sheetData: '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="B2" t="s"><v>2</v></c></row>',
    }), 'Flujo');
    assert.deepStrictEqual(rows, [['ID', 'Titulo'], ['', 'A & B\r']]);
  });

  it('plain numbers as text, cached formula strings, empty rows and cells without r', async () => {
    const rows = await readSheet(xlsx({
      sheetData: header + '<row r="3"><c><v>7</v></c><c t="str"><f>A3&amp;"x"</f><v>7x</v></c></row>',
    }), 'Flujo');
    assert.deepStrictEqual(rows, [['ID', 'Título'], [], ['7', '7x']]);
  });

  it('namespace-prefixed elements', async () => {
    const rows = await readSheet(xlsx({ sheetData: '<x:row r="1"><x:c r="A1" t="inlineStr"><x:is><x:t>ID</x:t></x:is></x:c></x:row>' }), 'Flujo');
    assert.deepStrictEqual(rows, [['ID']]);
  });
});

describe('what the reader refuses, saying to paste instead', () => {
  it('a file that is not an .xlsx', async () => {
    await refuses(new TextEncoder().encode('ID\tTítulo\nP1\tUno'), 'no es un archivo .xlsx (tampoco sirven .xls, .csv ni .ods).');
  });

  it('a damaged file', async () => {
    await refuses(xlsx({ sheetData: header, zipOptions: { badCrc: true } }), 'el archivo está dañado.');
    await refuses(file('Flujo_Instalaciones.xlsx').subarray(0, 4000), 'el archivo está incompleto o dañado.');
  });

  it('a password-protected file', async () => {
    await refuses(xlsx({ sheetData: header, zipOptions: { encrypted: true } }), 'está protegido con contraseña.');
  });

  it('a formula without a stored result', async () => {
    await refuses(xlsx({ sheetData: header + '<row r="2"><c r="A2"><f>1+1</f></c></row>' }), 'la celda A2 tiene una fórmula sin resultado guardado.');
    await refuses(xlsx({ sheetData: header + '<row r="2"><c r="A2" t="str"><f>A1</f></c></row>' }), 'la celda A2 tiene una fórmula sin resultado guardado.');
  });

  it('dates, booleans and error cells', async () => {
    const styles = '<cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="14"/></cellXfs>';
    await refuses(xlsx({ styles, sheetData: header + '<row r="2"><c r="A2" s="1"><v>45000</v></c></row>' }), 'la celda A2 tiene una fecha u hora; escríbela como texto.');
    const custom = '<numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="164"/></cellXfs>';
    await refuses(xlsx({ styles: custom, sheetData: header + '<row r="2"><c r="B2" s="1"><v>45000</v></c></row>' }), 'la celda B2 tiene una fecha u hora; escríbela como texto.');
    await refuses(xlsx({ sheetData: header + '<row r="2"><c r="A2" t="b"><v>1</v></c></row>' }), 'la celda A2 tiene un valor verdadero/falso; escríbelo como texto.');
    await refuses(xlsx({ sheetData: header + '<row r="2"><c r="A2" t="e"><v>#N/A</v></c></row>' }), 'la celda A2 tiene un error de Excel (#N/A).');
  });

  it('merged cells', async () => {
    await refuses(xlsx({ sheetData: header, extra: '<mergeCells count="1"><mergeCell ref="A2:A3"/></mergeCells>' }), 'la hoja tiene celdas combinadas; sepáralas antes.');
  });

  it('a shared-string index that does not exist', async () => {
    await refuses(xlsx({ sharedStrings: '<si><t>ID</t></si>', sheetData: '<row r="1"><c r="A1" t="s"><v>3</v></c></row>' }), 'la celda A1 apunta a un texto que no existe.');
  });
});
