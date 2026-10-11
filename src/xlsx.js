import { zipBytes } from "./zip.js";

// A one-sheet .xlsx with a handful of styles, written directly as XML (no spreadsheet library).
// Originally the panelboard app's engraving order (REV 10.19.0).
//
// rows: one array per spreadsheet row; each cell is [value, style] (style optional). Numbers
// stay numbers; null / "" leaves the cell empty (but still styled, e.g. a bordered blank).
// widths: column widths in Excel's character units, from column A.

export const STYLES = { plain: 0, bold: 1, head: 2, cell: 3, title: 4, highlight: 5 };

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFD9E1F2"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/></patternFill></fill></fills>
<borders count="2"><border/><border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/></border></borders>
<cellStyleXfs count="1"><xf/></cellStyleXfs>
<cellXfs count="6"><xf/><xf fontId="1" applyFont="1"/><xf fontId="1" fillId="2" borderId="1" applyFont="1" applyFill="1" applyBorder="1"/><xf borderId="1" applyBorder="1"/><xf fontId="2" applyFont="1"/><xf fontId="1" fillId="3" applyFont="1" applyFill="1"/></cellXfs>
</styleSheet>`;

const xml = (s) =>
  String(s ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
// 0 → A … 25 → Z, 26 → AA.
export const columnName = (i) =>
  (i >= 26 ? columnName(Math.floor(i / 26) - 1) : "") + String.fromCharCode(65 + (i % 26));

const styleId = (s) => (typeof s === "number" ? s : (STYLES[s] ?? 0));

const sheetXml = (rows, widths, landscape) => {
  const body = rows
    .map((cells = [], r) => {
      const cs = cells
        .map(([v, s] = [], c) => {
          const ref = `${columnName(c)}${r + 1}`,
            id = styleId(s);
          if (v === null || v === undefined || v === "")
            return id ? `<c r="${ref}" s="${id}"/>` : "";
          return typeof v === "number"
            ? `<c r="${ref}" s="${id}"><v>${v}</v></c>`
            : `<c r="${ref}" s="${id}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
        })
        .join("");
      return `<row r="${r + 1}">${cs}</row>`;
    })
    .join("");
  const cols = widths
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>${cols ? `<cols>${cols}</cols>` : ""}<sheetData>${body}</sheetData><pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup orientation="${landscape ? "landscape" : "portrait"}" fitToWidth="1" fitToHeight="0"/></worksheet>`;
};

/** The workbook as .xlsx bytes (a Uint8Array). */
export const buildXlsx = ({ sheetName = "Sheet1", rows, widths = [], landscape = false }) =>
  zipBytes([
    {
      name: "[Content_Types].xml",
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    },
    {
      name: "_rels/.rels",
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xml(sheetName).slice(0, 31)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    { name: "xl/styles.xml", text: STYLES_XML },
    { name: "xl/worksheets/sheet1.xml", text: sheetXml(rows, widths, landscape) },
  ]);

export const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
