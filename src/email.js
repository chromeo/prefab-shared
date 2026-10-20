// Safety checks for the apps' "send the request" Netlify functions (server side only).
// The forms are public, with no sign-in, so anything a request contains may come from a bot or
// someone skipping the page. These checks are the same in every app; each app's function still
// decides what the email says (ideally building it from the form data itself, not from HTML the
// page sends).
import { UPLOAD_LIMITS } from "./upload.js";

/** A JSON response for a Netlify function. */
export const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

// Limits. A full work order is a few thousand characters; a label batch's JSON is well under
// 1 MB even with 50 labels.
export const LIMITS = {
  bodyBytes: 2 * 1024 * 1024, // the whole request, before parsing
  subject: 250,
  text: 200_000, // characters in an email body (text or HTML)
  attachmentBytes: UPLOAD_LIMITS.totalBytes, // all attachments together (see upload.js)
};

/** One-line header value: no line breaks (which could inject extra headers). */
export const cleanHeader = (value, fallback = "") =>
  String(value || fallback)
    .replace(/[\r\n]/g, " ")
    .trim();

/** A safe attachment file name: letters, digits, . _ - ( ) and spaces; keeps the extension. */
export const cleanFilename = (value, fallback = "attachment") =>
  String(value || fallback)
    .replace(/[\\/\0\r\n]/g, "-")
    .replace(/[^a-zA-Z0-9._ ()-]/g, "-")
    .slice(0, 180) || fallback;

/**
 * Reads the request's JSON body with a size cap. Returns { payload } or { response } (an error
 * response to return as-is): wrong method, empty or oversized body, not JSON, not an object.
 */
export const readJsonRequest = async (request, { maxBytes = LIMITS.bodyBytes } = {}) => {
  if (request.method !== "POST") return { response: json(405, { error: "Method not allowed." }) };
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > maxBytes) return { response: json(413, { error: "The request is too large." }) };
  let text;
  try {
    text = await request.text();
  } catch {
    return { response: json(400, { error: "Invalid request body." }) };
  }
  if (new TextEncoder().encode(text).length > maxBytes)
    return { response: json(413, { error: "The request is too large." }) };
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    return { response: json(400, { error: "Invalid request body." }) };
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    return { response: json(400, { error: "Invalid request body." }) };
  return { payload };
};

/**
 * Spam trap: the form has a hidden "website" field people never see or fill in; bots that fill
 * every field do. When it's filled, answer as if sent (so the bot doesn't retry) and send
 * nothing.
 */
export const isSpamTrap = (payload) => !!String(payload?.website ?? "").trim();
export const spamTrapResponse = () => json(200, { ok: true, id: "" });

/** "a.com, B.com" → ["a.com", "b.com"]; defaults to mastercraftinc.com. */
export const allowedDomains = (setting = "") =>
  String(setting || "mastercraftinc.com")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);

const EMAIL = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;

/**
 * Who gets a copy of the request, and where shop replies go. Only addresses on the allowed
 * domains are copied: the form is public, so copying any address would let anyone use it to
 * send mail. `outside` decides what happens to any other address:
 *   "ignore" (default) send anyway, without the copy; replies go to `fallbackReplyTo`
 *   "reject"           refuse the request, with `error` to show the requester
 * Returns { requester, copied, replyTo, error? }. `copied` is "" when no copy goes out (also when
 * the requester is the recipient).
 */
export const requesterCopy = ({
  requesterEmail,
  domains,
  to,
  fallbackReplyTo,
  outside = "ignore",
}) => {
  const requester = cleanHeader(requesterEmail).toLowerCase().slice(0, 200);
  const ok = EMAIL.test(requester) && domains.includes(requester.split("@")[1]);
  if (requester && !ok && outside === "reject")
    return {
      requester,
      copied: "",
      replyTo: fallbackReplyTo,
      error: `Copies go to company addresses only (@${domains.join(", @")}).`,
    };
  return {
    requester,
    copied: ok && requester !== String(to || "").toLowerCase() ? requester : "",
    replyTo: ok ? requester : fallbackReplyTo,
  };
};

// What a file's first bytes say it is, regardless of its name or declared type.
const SIGNATURES = [
  ["pdf", [0x25, 0x50, 0x44, 0x46, 0x2d]], // %PDF-
  ["zip", [0x50, 0x4b, 0x03, 0x04]], // also .xlsx and .docx
  ["png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  ["jpeg", [0xff, 0xd8, 0xff]],
  ["gif", [0x47, 0x49, 0x46, 0x38]],
];
export const sniffFileType = (bytes) => {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  for (const [type, sig] of SIGNATURES) if (sig.every((x, i) => b[i] === x)) return type;
  // WebP: "RIFF" .... "WEBP"
  if (
    String.fromCharCode(...b.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...b.slice(8, 12)) === "WEBP"
  )
    return "webp";
  return "";
};

// Content types for the file types the apps attach.
const CONTENT_TYPES = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  png: "image/png",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

/**
 * An attachment for Resend, if its bytes really are one of `allowed` (e.g. ["pdf", "png"]).
 * An .xlsx is a ZIP inside, so "xlsx" accepts a ZIP named .xlsx. Never SVG: Microsoft 365 holds
 * mail with SVG attachments. Returns { attachment } or { error }.
 */
export const checkedAttachment = ({ filename, bytes, allowed }) => {
  const name = cleanFilename(filename);
  const sniffed = sniffFileType(bytes);
  const type =
    sniffed === "zip" && /\.xlsx$/i.test(name) ? "xlsx" : sniffed === "zip" ? "" : sniffed;
  if (!type || !allowed.includes(type))
    return { error: `${name} isn't an accepted file type (${allowed.join(", ")}).` };
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return {
    attachment: {
      filename: name,
      content: Buffer.from(b).toString("base64"),
      content_type: CONTENT_TYPES[type],
    },
  };
};

/**
 * Sends `email` (Resend's JSON: from, to, subject, text, html, attachments…). Returns
 * { ok: true, id } or { ok: false, status, error } with a message fit to show the requester,
 * including when Resend can't be reached at all.
 */
export const sendViaResend = async ({ apiKey, email, fetchImpl = fetch }) => {
  let response;
  try {
    response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(email),
    });
  } catch (error) {
    console.error("Resend unreachable:", error);
    return {
      ok: false,
      status: 502,
      error: "The email service could not be reached. Try again shortly.",
    };
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Resend error:", result);
    return {
      ok: false,
      status: 502,
      error: result.message || "The email service rejected the email.",
    };
  }
  return { ok: true, id: result.id || "" };
};
