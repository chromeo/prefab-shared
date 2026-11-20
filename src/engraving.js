import { buildXlsx, STYLES, XLSX_TYPE } from "./xlsx.js";

export { XLSX_TYPE };

// Engraved phenolic plates and the engraver's order form (Impact Engraving's layout).
// From the panelboard app (src/lib/label.js and src/lib/engraverOrder.js, REV 10.30.0), made
// independent of its form: each app decides the words on its plates; this file lays them out,
// draws them and writes the order.
//
// A plate's options: { color, adhesive, bevel, holes }, color one of LABEL_COLORS.

export const COMPANY = "Mastercraft Electric Inc.";
export const LABEL_COLORS = [
  "Black — white lettering",
  "Red — white lettering",
  "White — black lettering",
];
export const DEFAULT_PLATE = { color: LABEL_COLORS[0], adhesive: true, bevel: true, holes: false };
export const LINE_SIZES = ['3/8"', '1/4"']; // line 1, other lines

/** Background / lettering colors for a plate color. */
export const labelColors = (color = "") => {
  const white = color.startsWith("White"),
    red = color.startsWith("Red");
  return {
    background: red ? "#b91c1c" : white ? "#ffffff" : "#000000",
    lettering: white ? "#000000" : "#ffffff",
    outlined: white,
  };
};

/**
 * Plate size and line layout in points (72/inch): 3/8" first line, 1/4" the rest, at least
 * 4" × 2". Each row's `y` is the middle of its line, from the top.
 */
export const labelGeometry = (lines) => {
  const useLines = lines.length ? lines : ["DESIGNATION"];
  const PT = 72,
    firstFont = 27,
    bodyFont = 18,
    firstLine = 34,
    bodyLine = 24,
    marginX = 24,
    marginY = 18;
  const estimatedWidths = useLines.map(
    (line, i) => String(line).length * (i === 0 ? firstFont : bodyFont) * 0.61,
  );
  const widthPt = Math.max(4 * PT, Math.ceil(Math.max(...estimatedWidths) + marginX * 2));
  const textHeight = useLines.reduce((sum, _, i) => sum + (i === 0 ? firstLine : bodyLine), 0);
  const heightPt = Math.max(2 * PT, Math.ceil(textHeight + marginY * 2));
  let cursorY = (heightPt - textHeight) / 2;
  const rows = useLines.map((text, i) => {
    const fontSize = i === 0 ? firstFont : bodyFont,
      lineHeight = i === 0 ? firstLine : bodyLine,
      y = cursorY + lineHeight / 2;
    cursorY += lineHeight;
    return { text, fontSize, y };
  });
  return { widthPt, heightPt, widthIn: widthPt / PT, heightIn: heightPt / PT, rows };
};

/** A plate as a standalone SVG sized in inches, for on-screen previews only (never send SVG). */
export const makeLabelSvg = (color, lines) => {
  const safe = (v) =>
    String(v || "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c],
    );
  const { widthPt, heightPt, widthIn, heightIn, rows } = labelGeometry(lines);
  const { background, lettering, outlined } = labelColors(color);
  const nodes = rows
    .map(
      ({ text, fontSize, y }) =>
        `<text x="${(widthPt / 2).toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" fill="${lettering}">${safe(text)}</text>`,
    )
    .join("\n  ");
  const border = outlined
    ? `\n  <rect x="0.5" y="0.5" width="${(widthPt - 1).toFixed(1)}" height="${(heightPt - 1).toFixed(1)}" fill="none" stroke="#000000" stroke-width="1"/>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${widthIn.toFixed(2)}in" height="${heightIn.toFixed(2)}in" viewBox="0 0 ${widthPt} ${heightPt}">\n  <rect x="0" y="0" width="${widthPt}" height="${heightPt}" fill="${background}"/>${border}\n  ${nodes}\n</svg>`;
};

// labelGeometry centers each line; its baseline sits ~0.35 em below the middle.
const BASELINE = 0.35;

/** One plate the way buildPlatesPdf draws it: points, from the top-left, at finished size. */
export const pdfPlate = (color, lines) => {
  const g = labelGeometry(lines);
  const { background, lettering, outlined } = labelColors(color);
  return {
    widthPt: g.widthPt,
    heightPt: g.heightPt,
    background,
    foreground: lettering,
    outlined,
    marginPt: 24,
    rows: g.rows.map((r) => ({
      text: r.text,
      fontSize: r.fontSize,
      baseline: r.y + BASELINE * r.fontSize,
    })),
  };
};

// ---- the order form ----------------------------------------------------------------------

/** "Black — white lettering" → "white text on black" */
export const colorText = (color = "") => {
  const [plate, lettering = ""] = color.split(" — ");
  const text = lettering.replace(/\s*lettering$/i, "").toLowerCase();
  return plate && text ? `${text} text on ${plate.toLowerCase()}` : color;
};
export const plateOptionsText = (o) =>
  [
    o.adhesive ? "adhesive back" : "no adhesive",
    o.bevel ? "beveled edges" : "square edges",
    o.holes ? "(2) holes" : "no holes",
  ].join(", ");
/** The spec line plates are grouped under on the order form. */
export const engraverSpec = (o) =>
  `Size to fit, ${colorText(o.color)}, ${plateOptionsText(o)}, Arial font, line 1 ${LINE_SIZES[0]} text, other lines ${LINE_SIZES[1]} text`;

/**
 * Plates grouped by spec, in order; identical plates become one row with a quantity.
 * plates: [{ lines, options, name? }] → [{ spec, rows: [{ qty, lines, name }] }]
 */
export const groupPlates = (plates) => {
  const groups = new Map();
  for (const { lines, options, name = "" } of plates) {
    const spec = engraverSpec(options);
    if (!groups.has(spec)) groups.set(spec, { spec, rows: [] });
    const rows = groups.get(spec).rows;
    const same = rows.find((r) => r.lines.join("\n") === lines.join("\n"));
    if (same) same.qty += 1;
    else rows.push({ qty: 1, lines, name });
  }
  return [...groups.values()];
};

const S = STYLES; // plain, bold, head (column heading), cell (bordered), title, highlight

/**
 * The order form's rows (also handy for tests).
 * header: { date, contact, phone, shipTo, po, job, company? }
 */
export const engraverRows = (groups, header) => {
  const company = header.company || COMPANY;
  const maxLines = Math.max(8, ...groups.flatMap((g) => g.rows.map((r) => r.lines.length)));
  const lineHeads = Array.from({ length: maxLines }, (_, i) => [
    `LINE ${i + 1}   TEXT - ${LINE_SIZES[i ? 1 : 0]}`,
    S.head,
  ]);
  const rows = [
    [
      ["", 0],
      [`Engraving order — ${company}`, S.title],
    ],
    [["", 0], [`Date: ${header.date}`], ["", 0], ["", 0], [`Contact name: ${header.contact}`]],
    [["", 0], [`Company: ${company}`], ["", 0], ["", 0], [`Contact number: ${header.phone}`]],
    [["", 0], [`Ship to address: ${header.shipTo}`], ["", 0], ["", 0], [`PO Number: ${header.po}`]],
    [["", 0], [`Job: ${header.job}`]],
    [],
    [
      ["", 0],
      ["INSTRUCTIONS", S.bold],
    ],
    [
      ["", 0],
      [
        "Plates with the same size, text and color are grouped together. Size each plate to fit its text.",
      ],
    ],
    [
      ["", 0],
      ['A blank line is entered as "XX". A PDF with every plate at finished size is attached.'],
    ],
  ];
  for (const g of groups) {
    rows.push([]);
    rows.push([
      ["", 0],
      [g.spec, S.highlight],
    ]);
    rows.push([["QTY", S.head], ...lineHeads]);
    for (const r of g.rows)
      rows.push([
        [r.qty, S.cell],
        ...Array.from({ length: maxLines }, (_, i) => [r.lines[i] ?? "", S.cell]),
      ]);
  }
  return { rows, columns: maxLines + 1 };
};

/** The order form as .xlsx bytes. */
export const buildEngraverXlsx = (groups, header) => {
  const { rows, columns } = engraverRows(groups, header);
  return buildXlsx({
    sheetName: "Engraving order",
    rows,
    widths: [7, ...Array.from({ length: columns - 1 }, (_, i) => (i < 5 ? 28 : 16))],
    landscape: true,
  });
};
