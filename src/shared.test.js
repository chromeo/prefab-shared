import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildPlatesPdf, buildXlsx, columnName, toBase64, zipBytes } from "./index.js";

const plate = (rows, extra = {}) => ({
  widthPt: 288,
  heightPt: 144,
  background: "#000000",
  foreground: "#ffffff",
  rows,
  ...extra,
});
const load = async (plates, meta) =>
  PDFDocument.load(await buildPlatesPdf(plates, meta), { updateMetadata: false });
const text = (bytes) => new TextDecoder().decode(bytes);

describe("buildPlatesPdf", () => {
  it("makes one page per plate, each at its finished size", async () => {
    const pdf = await load(
      [
        plate([{ text: "PANEL 1H1", fontSize: 27, baseline: 50 }]),
        plate([{ text: "CAUTION", fontSize: 27, baseline: 50 }], { widthPt: 360, heightPt: 216 }),
      ],
      { title: "25135GD labels", subject: "Engraved phenolic" },
    );
    expect(pdf.getPageCount()).toBe(2);
    expect(pdf.getPage(0).getSize()).toEqual({ width: 288, height: 144 });
    expect(pdf.getPage(1).getSize()).toEqual({ width: 360, height: 216 });
    expect(pdf.getTitle()).toBe("25135GD labels");
    expect(pdf.getSubject()).toBe("Engraved phenolic");
  });

  it("draws Δ and characters Helvetica lacks without failing", async () => {
    const pdf = await load([
      plate([
        { text: "PANEL 1D1", fontSize: 27, baseline: 40 },
        { text: "240Δ/120V 3Ø 4W 200A", fontSize: 18, baseline: 70 },
        { text: "T5 → 北", fontSize: 18, baseline: 95 },
      ]),
    ]);
    expect(pdf.getPageCount()).toBe(1);
  });

  it("fits long lines and outlines white plates", async () => {
    const long = "FEEDS PANELS LA-2, LB-2 AND THE LIGHTING CONTROL PANEL ON FLOOR 2";
    const pdf = await load([
      plate([{ text: long, fontSize: 18, baseline: 70 }], {
        background: "#ffffff",
        foreground: "#000000",
        outlined: true,
      }),
    ]);
    expect(pdf.getPageCount()).toBe(1);
  });

  it("is a real PDF and survives base64 for email", async () => {
    const bytes = await buildPlatesPdf([plate([{ text: "PANEL A", fontSize: 27, baseline: 50 }])]);
    expect(text(bytes.slice(0, 5))).toBe("%PDF-");
    expect(atob(toBase64(bytes)).slice(0, 5)).toBe("%PDF-");
  });
});

describe("zipBytes", () => {
  it("stores text and binary files under their names", () => {
    const bytes = zipBytes([
      { name: "a.txt", text: "hello" },
      { name: "dir/b.bin", bytes: new Uint8Array([1, 2, 3]) },
    ]);
    expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const s = text(bytes);
    expect(s).toContain("a.txt");
    expect(s).toContain("hello");
    expect(s).toContain("dir/b.bin");
  });
});

describe("buildXlsx", () => {
  it("writes the workbook parts with text, numbers and styles", () => {
    const s = text(
      buildXlsx({
        sheetName: "Engraving order",
        rows: [
          [
            ["QTY", "head"],
            ["LINE 1", "head"],
          ],
          [
            [1, "cell"],
            ["PANEL <A> & B", "cell"],
          ],
          [],
        ],
        widths: [7, 28],
        landscape: true,
      }),
    );
    for (const part of [
      "[Content_Types].xml",
      "xl/workbook.xml",
      "xl/styles.xml",
      "xl/worksheets/sheet1.xml",
    ])
      expect(s).toContain(part);
    expect(s).toContain('<c r="A2" s="3"><v>1</v></c>');
    expect(s).toContain("PANEL &lt;A&gt; &amp; B");
    expect(s).toContain('name="Engraving order"');
    expect(s).toContain('orientation="landscape"');
  });

  it("names columns past Z", () => {
    expect([0, 25, 26, 27, 51, 52].map(columnName)).toEqual(["A", "Z", "AA", "AB", "AZ", "BA"]);
  });
});
