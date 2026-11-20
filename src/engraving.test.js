import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildPlatesPdf } from "./platesPdf.js";
import {
  DEFAULT_PLATE,
  LABEL_COLORS,
  buildEngraverXlsx,
  colorText,
  engraverRows,
  engraverSpec,
  groupPlates,
  labelColors,
  labelGeometry,
  makeLabelSvg,
  pdfPlate,
} from "./engraving.js";

const lines = ["MAIN SERVICE", "480Y/277V 3PH", "SERVICE DISCONNECT", "FAULT CURRENT: 24,057A"];
const header = {
  date: "11/20/2026",
  contact: "Gary",
  phone: "(360) 555-0100",
  shipTo: "123 Main St, Everett WA",
  po: "26-1042-3-1090",
  job: "26-1042 · Kapta service",
};

describe("plates", () => {
  it("are at least 4 by 2 inches and grow with the text", () => {
    const small = labelGeometry(["A"]);
    expect([small.widthIn, small.heightIn]).toEqual([4, 2]);
    const long = labelGeometry([...lines, "AVAILABLE FAULT CURRENT: 24,057A AT 480V"]);
    expect(long.widthIn).toBeGreaterThan(4);
    expect(long.rows[0].fontSize).toBe(27); // 3/8" first line
    expect(long.rows[1].fontSize).toBe(18); // 1/4" the rest
  });

  it("use the three phenolic colors", () => {
    expect(labelColors(LABEL_COLORS[0])).toMatchObject({
      background: "#000000",
      lettering: "#ffffff",
    });
    expect(labelColors(LABEL_COLORS[1]).background).toBe("#b91c1c");
    expect(labelColors(LABEL_COLORS[2])).toMatchObject({ lettering: "#000000", outlined: true });
  });

  it("preview as SVG with the text escaped", () => {
    const svg = makeLabelSvg(DEFAULT_PLATE.color, ["PANEL <A&B>"]);
    expect(svg).toContain("PANEL &lt;A&amp;B&gt;");
    expect(svg).toContain('width="4.00in"');
  });

  it("draw in the plates PDF at finished size", async () => {
    const plate = pdfPlate(DEFAULT_PLATE.color, lines);
    const doc = await PDFDocument.load(await buildPlatesPdf([plate, plate]));
    expect(doc.getPageCount()).toBe(2);
    expect(doc.getPage(0).getSize()).toEqual({ width: plate.widthPt, height: plate.heightPt });
  });
});

describe("the order form", () => {
  it("describes the plate options in one spec line", () => {
    expect(colorText("Red — white lettering")).toBe("white text on red");
    expect(engraverSpec(DEFAULT_PLATE)).toBe(
      'Size to fit, white text on black, adhesive back, beveled edges, no holes, Arial font, line 1 3/8" text, other lines 1/4" text',
    );
  });

  it("groups plates by spec and counts identical ones", () => {
    const red = { ...DEFAULT_PLATE, color: LABEL_COLORS[1] };
    const groups = groupPlates([
      { lines, options: DEFAULT_PLATE, name: "Main" },
      { lines: ["PANEL A"], options: DEFAULT_PLATE },
      { lines: ["PANEL A"], options: DEFAULT_PLATE },
      { lines: ["PANEL B"], options: red },
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].rows.map((r) => [r.lines[0], r.qty])).toEqual([
      ["MAIN SERVICE", 1],
      ["PANEL A", 2],
    ]);
    expect(groups[1].spec).toContain("white text on red");
  });

  it("has the header, each spec, and a QTY row per plate with LINE 1–8", () => {
    const { rows, columns } = engraverRows(
      groupPlates([{ lines, options: DEFAULT_PLATE }]),
      header,
    );
    const text = rows.flat().map((c) => c?.[0]);
    expect(text).toContain("Engraving order — Mastercraft Electric Inc.");
    expect(text).toContain("Contact name: Gary");
    expect(text).toContain("PO Number: 26-1042-3-1090");
    expect(text).toContain("Ship to address: 123 Main St, Everett WA");
    expect(text).toContain('LINE 1   TEXT - 3/8"');
    expect(columns).toBe(9);
    const last = rows.at(-1).map((c) => c[0]);
    expect(last.slice(0, 5)).toEqual([1, ...lines]);
  });

  it("is a real .xlsx (a ZIP)", () => {
    const bytes = buildEngraverXlsx(groupPlates([{ lines, options: DEFAULT_PLATE }]), header);
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe("PK");
  });
});
