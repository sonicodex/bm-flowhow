// The template and the export (phase 5.6): what xlsx-write.js writes, the
// reader (xlsx.js) reads back as the same grid.
import { describe, expect, it } from 'vitest';
import Core from '../public/js/core.js';
import { exportName, exportXlsx, gridFromXlsx, gridToTable, SHEET, templateXlsx } from '../public/js/import-form.js';
import { readSheet } from '../public/js/xlsx.js';
import { writeWorkbook } from '../public/js/xlsx-write.js';
import instalaciones from '../../reference/Flujo_Instalaciones.grid.json';
import apertura from '../../reference/Flujo_Apertura_OT.grid.json';

const row = (id, type, extra = {}) => ({ id, type, ref: '', contact: '', title: 't' + id, description: '', tags: {}, exits: '', depends_on: '', ...extra });
// The round trip keeps the connections; the Salidas cell comes back written
// with commas (SPEC §5), whatever separator it had. The reference files keep
// their pipes on purpose: the old format still comes in.
// The export always writes Contacto (SPEC §5), so a grid written before it
// existed comes back with an empty one on every row.
const connections = (grid) => ({ ...grid, rows: grid.rows.map((r) => ({ ...r, contact: r.contact ?? '', exits: Core.parseExits(r.exits) })) });
const back = async (grid) => {
  const read = await gridFromXlsx(exportXlsx(grid));
  expect(read.errors).toEqual([]);
  return read.grid;
};
const unzipText = (bytes, name) => {
  // Stored entries: the file's text is in the bytes as it is.
  const all = new TextDecoder().decode(bytes);
  // The local header's name is followed by the data itself.
  const at = all.indexOf(name + '<?xml') + name.length;
  return all.slice(at, all.indexOf('PK', at));
};

describe('export → import, round trip', () => {
  it('gives back both reference flows exactly', async () => {
    for (const grid of [instalaciones, apertura]) {
      expect(grid.rows.every((r) => r.depends_on === '')).toBe(true);
      expect(grid.rows.some((r) => r.exits.includes('|'))).toBe(true);
      const read = await back(grid);
      expect(connections(read)).toEqual(connections(grid));
      // Written with commas only.
      expect(read.rows.some((r) => /[|;]/.test(r.exits))).toBe(false);
      expect(read.rows.find((r) => r.exits.includes(':'))?.exits).toMatch(/^[^,]+:[^,]+, [^,]+:[^,]+$/);
    }
  });

  it('keeps text Excel would otherwise change, and many columns', async () => {
    const categories = Array.from({ length: 30 }, (_, i) => `Categoría ${i + 1}`);
    const tags = Object.fromEntries(categories.map((c, i) => [c, i % 2 ? '' : `v${i}, «otro»`]));
    const grid = {
      categories,
      rows: [
        row('P1', 'start', { title: '1.10', description: 'Línea uno\nLínea dos — 1-2 & <b>"x"</b> 🚚', tags, exits: 'P2' }),
        row('P2', 'decision', { title: '=SUMA(A1)', exits: 'Sí:P3, No:P4', tags: { ...tags, 'Categoría 1': '' } }),
        row('P3', 'link', { ref: 'Apertura de OT', contact: 'Jefe de instalación', tags: Object.fromEntries(categories.map((c) => [c, ''])) }),
        row('P4', 'end', { title: 'Fin', tags: Object.fromEntries(categories.map((c) => [c, ''])) }),
      ],
    };
    expect(await back(grid)).toEqual(grid);
  });

  it('writes "Salidas" only: "Depende de" is already in the exits', async () => {
    const grid = { categories: [], rows: [row('P1', 'start', { exits: 'P2' }), row('P2', 'end', { depends_on: 'P1' })] };
    expect(gridToTable(grid)[0]).toEqual(['ID', 'Tipo', 'Flujo', 'Contacto', 'Título', 'Descripción', 'Salidas']);
    expect((await back(grid)).rows[1].depends_on).toBe('');
  });

  it('writes the types by their Spanish name, and keeps an unknown one as typed', () => {
    const table = gridToTable({ categories: [], rows: [row('P1', 'wait'), row('P2', 'Tarea')] });
    expect(table.slice(1).map((r) => r[1])).toEqual(['Espera', 'Tarea']);
  });

  it('drops characters XML cannot carry', async () => {
    const grid = { categories: [], rows: [row('P1', 'end', { title: 'a\u0001b\u0008c' })] };
    expect((await back(grid)).rows[0].title).toBe('abc');
  });
});

describe('the template', () => {
  it('has the headers, every category as a column, and no steps', async () => {
    const rows = await readSheet(templateXlsx(['Responsable', 'Herramienta']), SHEET);
    expect(rows).toEqual([['ID', 'Tipo', 'Flujo', 'Contacto', 'Título', 'Descripción', 'Responsable', 'Herramienta', 'Salidas']]);
  });

  it('freezes the header and offers the types as a list in the Tipo column', () => {
    const xml = unzipText(templateXlsx([]), 'xl/worksheets/sheet1.xml');
    expect(xml).toContain('<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>');
    expect(xml).toContain('sqref="B2:B1000"><formula1>&quot;Inicio,Actividad,Decisión,Espera,Subflujo,Enlace,Fin&quot;</formula1>');
  });
});

describe('writeWorkbook', () => {
  it('gives the same bytes for the same sheets', () => {
    const sheets = [{ name: 'Flujo', rows: [['ID'], ['P1']] }];
    expect(writeWorkbook(sheets)).toEqual(writeWorkbook(sheets));
  });

  it('writes several sheets, each readable by name', async () => {
    const bytes = writeWorkbook([{ name: 'Flujo', rows: [['ID', 'Título']] }, { name: 'Otra & más', rows: [['x']] }]);
    expect(await readSheet(bytes, 'Otra & más')).toEqual([['x']]);
    expect(await readSheet(bytes, 'Flujo')).toEqual([['ID', 'Título']]);
  });

  // The users' passwords (phase 7.2): notes above the header, bold and on
  // one line; the panes freeze below the header.
  it('writes notes above a header that is not the first row', async () => {
    const rows = [['Nota uno'], ['Nota dos'], [], ['Usuario', 'Contraseña'], ['ana', 'abcd-efgh-jkmn']];
    const bytes = writeWorkbook([{ name: 'Contraseñas', rows, head: 3 }]);
    const xml = unzipText(bytes, 'xl/worksheets/sheet1.xml');
    expect(xml).toContain('<pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/>');
    expect(xml).toContain('<c r="A1" s="3" t="inlineStr"><is><t>Nota uno</t></is></c>');
    expect(xml).toContain('<c r="A4" s="1" t="inlineStr"><is><t>Usuario</t></is></c>');
    expect(xml).toContain('<c r="B5" s="2" t="inlineStr"><is><t>abcd-efgh-jkmn</t></is></c>');
    expect(await readSheet(bytes, 'Contraseñas')).toEqual([['Nota uno'], ['Nota dos'], [], ['Usuario', 'Contraseña'], ['ana', 'abcd-efgh-jkmn']]);
  });
});

describe('exportName', () => {
  it('is "Flujo_" and the name, without characters a file name cannot hold', () => {
    expect(exportName('Apertura de OT')).toBe('Flujo_Apertura_de_OT.xlsx');
    expect(exportName('Compras / Ventas: 2026?')).toBe('Flujo_Compras_Ventas_2026.xlsx');
    expect(exportName(' / ')).toBe('Flujo_sin_nombre.xlsx');
  });
});
