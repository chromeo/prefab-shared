import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// Engraved plates as a vector PDF: one page per plate, at finished size, with real text the
// engraver's software can import. Email filters (Microsoft 365) hold SVG attachments, so this is
// the artwork the engraver receives. Originally the transformer app's label PDF (REV 7.5.0).
//
// A plate is described in points (72 per inch), measured from the top-left corner:
//   { widthPt, heightPt, background: "#000000", foreground: "#ffffff", outlined?: boolean,
//     marginPt?: number, rows: [{ text, fontSize, baseline }] }
// `baseline` is the distance from the top of the plate to the text baseline. Each row is
// centered across the plate and shrunk if it would run past the side margins.

const color = (hex) => rgb(...[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255));

// The built-in Helvetica covers Latin text only. Δ (as in 240Δ/120V or 480:208Δ) is drawn as a
// triangle; any other character it can't draw becomes "?" rather than failing the whole file.
const DELTA = "Δ";
const drawable = (font, text) =>
  [...String(text)]
    .map((ch) => {
      if (ch === DELTA) return ch;
      try {
        font.encodeText(ch);
        return ch;
      } catch {
        return "?";
      }
    })
    .join("");
const deltaWidth = (size) => 0.62 * size;
const lineWidth = (font, text, size) =>
  text
    .split(DELTA)
    .reduce((w, part, i) => w + font.widthOfTextAtSize(part, size) + (i ? deltaWidth(size) : 0), 0);

const drawPlate = (pdf, font, plate) => {
  const { widthPt: width, heightPt: height, marginPt = 21.6 } = plate;
  const page = pdf.addPage([width, height]);
  const ink = color(plate.foreground);
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: color(plate.background),
    // A white plate gets a thin outline so its edge shows on white paper.
    ...(plate.outlined ? { borderColor: rgb(0, 0, 0), borderWidth: 0.75 } : {}),
  });
  for (const row of plate.rows) {
    if (!row.text) continue;
    const text = drawable(font, row.text);
    let size = row.fontSize;
    const fit = (width - 2 * marginPt) / lineWidth(font, text, size);
    if (fit < 1) size *= fit;
    const baseline = height - row.baseline;
    let x = (width - lineWidth(font, text, size)) / 2;
    text.split(DELTA).forEach((part, i) => {
      if (i) {
        // Δ: an outlined triangle the height of a capital letter.
        const w = deltaWidth(size),
          cap = 0.716 * size,
          inset = 0.06 * size;
        page.drawSvgPath(`M ${inset} 0 L ${w / 2} ${-cap} L ${w - inset} 0 Z`, {
          x,
          y: baseline,
          borderColor: ink,
          borderWidth: 0.08 * size,
        });
        x += w;
      }
      page.drawText(part, { x, y: baseline, size, font, color: ink });
      x += font.widthOfTextAtSize(part, size);
    });
  }
};

/**
 * All plates in one PDF, one page each, in the order given. Returns the file as a Uint8Array.
 * `meta`: { title, subject, creator } for the PDF's document properties.
 */
export const buildPlatesPdf = async (plates, meta = {}) => {
  const pdf = await PDFDocument.create();
  if (meta.title) pdf.setTitle(meta.title);
  if (meta.subject) pdf.setSubject(meta.subject);
  pdf.setCreator(meta.creator || "Mastercraft prefab form");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const plate of plates) drawPlate(pdf, font, plate);
  return pdf.save();
};
