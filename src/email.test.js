import { describe, expect, it, vi } from "vitest";
import {
  allowedDomains,
  checkedAttachment,
  cleanHeader,
  isSpamTrap,
  LIMITS,
  readJsonRequest,
  requesterCopy,
  sendViaResend,
  sniffFileType,
} from "./email.js";

const post = (body, headers = {}) =>
  new Request("http://localhost/api/prefab-send", { method: "POST", body, headers });
const bytes = (...b) => new Uint8Array(b);
const PDF = new TextEncoder().encode("%PDF-1.7\n…");
const ZIP = bytes(0x50, 0x4b, 0x03, 0x04, 0, 0);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0);
const SVG = new TextEncoder().encode('<?xml version="1.0"?><svg/>');

describe("readJsonRequest", () => {
  it("returns the payload of a JSON POST", async () => {
    expect(await readJsonRequest(post('{"a":1}'))).toEqual({ payload: { a: 1 } });
  });

  it("refuses other methods, junk, empty and non-object bodies", async () => {
    const status = async (req) => (await readJsonRequest(req)).response?.status;
    expect(await status(new Request("http://localhost/x"))).toBe(405);
    expect(await status(post("not json"))).toBe(400);
    expect(await status(post(""))).toBe(400);
    expect(await status(post("null"))).toBe(400);
    expect(await status(post("[1,2]"))).toBe(400);
    expect(await status(post('"text"'))).toBe(400);
  });

  it("refuses oversized bodies, declared or actual", async () => {
    const status = async (req, o) => (await readJsonRequest(req, o)).response?.status;
    expect(await status(post("{}", { "content-length": String(LIMITS.bodyBytes + 1) }))).toBe(413);
    expect(await status(post(JSON.stringify({ x: "y".repeat(200) })), { maxBytes: 100 })).toBe(413);
  });
});

describe("spam trap", () => {
  it("is set off only by a filled-in website field", () => {
    expect(isSpamTrap({ website: "http://spam.example" })).toBe(true);
    expect(isSpamTrap({ website: "  " })).toBe(false);
    expect(isSpamTrap({})).toBe(false);
  });
});

describe("requesterCopy", () => {
  const domains = allowedDomains("mastercraftinc.com, Partner.com");
  const base = {
    domains,
    to: "prefab@mastercraftinc.com",
    fallbackReplyTo: "prefab@mastercraftinc.com",
  };

  it("copies company and partner addresses, and replies go to them", () => {
    expect(requesterCopy({ ...base, requesterEmail: "Pat.Lee@MastercraftInc.com" })).toEqual({
      requester: "pat.lee@mastercraftinc.com",
      copied: "pat.lee@mastercraftinc.com",
      replyTo: "pat.lee@mastercraftinc.com",
    });
    expect(requesterCopy({ ...base, requesterEmail: "gc@partner.com" }).copied).toBe(
      "gc@partner.com",
    );
  });

  it("by default sends without a copy for outside addresses (panelboard's rule)", () => {
    expect(requesterCopy({ ...base, requesterEmail: "someone@gmail.com" })).toEqual({
      requester: "someone@gmail.com",
      copied: "",
      replyTo: "prefab@mastercraftinc.com",
    });
  });

  it("can refuse outside addresses instead (transformer's rule)", () => {
    const r = requesterCopy({ ...base, requesterEmail: "someone@gmail.com", outside: "reject" });
    expect(r.error).toBe(
      "Copies go to company addresses only (@mastercraftinc.com, @partner.com).",
    );
  });

  it("doesn't copy the recipient to themselves, and ignores header tricks", () => {
    expect(requesterCopy({ ...base, requesterEmail: "prefab@mastercraftinc.com" }).copied).toBe("");
    const sneaky = requesterCopy({
      ...base,
      requesterEmail: "a@mastercraftinc.com\r\nBcc: x@evil.com",
    });
    expect(sneaky.copied).toBe("");
    expect(cleanHeader("a\r\nb")).toBe("a  b");
  });
});

describe("attachments", () => {
  it("knows files by their first bytes, not their names", () => {
    expect([PDF, ZIP, PNG, bytes(0xff, 0xd8, 0xff, 0xe0), SVG, bytes()].map(sniffFileType)).toEqual(
      ["pdf", "zip", "png", "jpeg", "", ""],
    );
  });

  it("accepts a file whose bytes match an allowed type", () => {
    const { attachment } = checkedAttachment({
      filename: "labels.pdf",
      bytes: PDF,
      allowed: ["pdf"],
    });
    expect(attachment).toMatchObject({ filename: "labels.pdf", content_type: "application/pdf" });
    expect(atob(attachment.content).startsWith("%PDF-")).toBe(true);
    expect(
      checkedAttachment({ filename: "order.xlsx", bytes: ZIP, allowed: ["xlsx"] }).attachment
        .content_type,
    ).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  });

  it("refuses disguised files, SVG and plain ZIPs", () => {
    expect(
      checkedAttachment({ filename: "labels.pdf", bytes: SVG, allowed: ["pdf"] }).error,
    ).toMatch(/isn't an accepted file type/);
    expect(
      checkedAttachment({ filename: "x.pdf", bytes: PNG, allowed: ["pdf"] }).error,
    ).toBeTruthy();
    expect(
      checkedAttachment({ filename: "art.zip", bytes: ZIP, allowed: ["xlsx", "pdf"] }).error,
    ).toBeTruthy();
  });
});

describe("sendViaResend", () => {
  const email = { from: "a@b.c", to: ["d@e.f"], subject: "s", text: "t" };
  const reply = (status, body) => async () => new Response(JSON.stringify(body), { status });

  it("returns the message id when Resend accepts it", async () => {
    expect(
      await sendViaResend({ apiKey: "k", email, fetchImpl: reply(200, { id: "msg-1" }) }),
    ).toEqual({ ok: true, id: "msg-1" });
  });

  it("explains a rejection, or a service that can't be reached", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      await sendViaResend({ apiKey: "k", email, fetchImpl: reply(422, { message: "Bad from" }) }),
    ).toEqual({ ok: false, status: 502, error: "Bad from" });
    const down = async () => {
      throw new TypeError("fetch failed");
    };
    expect(await sendViaResend({ apiKey: "k", email, fetchImpl: down })).toEqual({
      ok: false,
      status: 502,
      error: "The email service could not be reached. Try again shortly.",
    });
  });
});
