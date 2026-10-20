import { describe, expect, it } from "vitest";
import { megabytes, receiveUpload, UPLOAD_LIMITS, uploadInParts } from "./upload.js";

// In-memory stand-in for a Netlify Blobs store.
const memoryStore = () => {
  const blobs = new Map();
  return {
    blobs,
    set: async (key, data) => void blobs.set(key, data.slice(0)),
    get: async (key) => (blobs.has(key) ? blobs.get(key) : null),
    delete: async (key) => void blobs.delete(key),
  };
};

// A small part size keeps the test files small; the logic is the same at 4 MB.
const LIMITS = { partBytes: 10, fileBytes: 40 };
const fileOf = (size) => new Blob([Uint8Array.from({ length: size }, (_, i) => i % 251)]);

// An upload function like an app's: finished files are kept under "pending/file-N".
const uploadFunction = (store) => {
  const finished = [];
  const handler = async (request) => {
    const { bytes, response } = await receiveUpload(request, store, LIMITS);
    if (response) return response;
    finished.push(bytes);
    return Response.json({ ok: true, key: `pending/file-${finished.length}` });
  };
  return { handler, finished };
};
const postTo =
  (handler, calls = []) =>
  (headers, body) => {
    calls.push(headers);
    return handler(new Request("http://x/api/upload", { method: "POST", headers, body }));
  };

describe("uploading in parts", () => {
  it("sends a small file in one request, exactly as before", async () => {
    const store = memoryStore();
    const { handler, finished } = uploadFunction(store);
    const calls = [];
    const r = await uploadInParts(fileOf(10), postTo(handler, calls), LIMITS);
    expect((await r.json()).key).toBe("pending/file-1");
    expect(calls).toEqual([{}]);
    expect(finished[0].byteLength).toBe(10);
  });

  it("sends a larger file in parts and gets back the same bytes, with nothing left over", async () => {
    const store = memoryStore();
    const { handler, finished } = uploadFunction(store);
    const calls = [];
    const progress = [];
    const file = fileOf(35);
    const r = await uploadInParts(file, postTo(handler, calls), {
      ...LIMITS,
      onPart: (part, parts) => progress.push(`${part}/${parts}`),
    });
    expect(r.ok).toBe(true);
    expect(progress).toEqual(["1/4", "2/4", "3/4", "4/4"]);
    expect(calls[0]).not.toHaveProperty("X-Upload-Id");
    expect(calls[3]["X-Upload-Id"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(finished).toHaveLength(1);
    expect([...new Uint8Array(finished[0])]).toEqual([...new Uint8Array(await file.arrayBuffer())]);
    expect(store.blobs.size).toBe(0); // the parts are removed once joined
  });

  it("stops at the first part that fails and hands that response back unread", async () => {
    let n = 0;
    const r = await uploadInParts(
      fileOf(35),
      async () => (++n === 2 ? Response.json({ error: "Nope" }, { status: 429 }) : okPart()),
      LIMITS,
    );
    expect(n).toBe(2);
    expect(r.status).toBe(429);
    expect((await r.json()).error).toBe("Nope");
  });
});
const okPart = () => Response.json({ ok: true, uploadId: crypto.randomUUID(), part: 1 });

describe("the function's checks", () => {
  const part = (headers, size = 10) =>
    new Request("http://x", { method: "POST", headers, body: new Uint8Array(size) });

  it("refuses a file over the size limit before storing anything", async () => {
    const store = memoryStore();
    const { response } = await receiveUpload(
      part({ "X-Upload-Part": "1", "X-Upload-Parts": "5" }),
      store,
      LIMITS,
    );
    expect(response.status).toBe(413);
    expect((await response.json()).error).toBe(
      `Each attachment must be ${megabytes(40)} or smaller.`,
    );
    expect(store.blobs.size).toBe(0);
  });

  it("refuses a request bigger than one part, an empty one, and bad part numbers", async () => {
    const store = memoryStore();
    expect((await receiveUpload(part({}, 11), store, LIMITS)).response.status).toBe(413);
    expect((await receiveUpload(part({}, 0), store, LIMITS)).response.status).toBe(400);
    for (const headers of [
      { "X-Upload-Part": "3", "X-Upload-Parts": "2" },
      { "X-Upload-Part": "0", "X-Upload-Parts": "2" },
      { "X-Upload-Part": "1", "X-Upload-Parts": "two" },
      { "X-Upload-Part": "2", "X-Upload-Parts": "2", "X-Upload-Id": "../../secret" },
    ])
      expect((await receiveUpload(part(headers), store, LIMITS)).response.status).toBe(400);
    // An early part must be full size, so the pieces can only fit together one way.
    const short = part({ "X-Upload-Part": "1", "X-Upload-Parts": "2" }, 5);
    expect((await receiveUpload(short, store, LIMITS)).response.status).toBe(400);
    expect(store.blobs.size).toBe(0);
  });

  it("says the upload was interrupted when an earlier part is missing", async () => {
    const store = memoryStore();
    const id = crypto.randomUUID();
    const { response } = await receiveUpload(
      part({ "X-Upload-Part": "2", "X-Upload-Parts": "2", "X-Upload-Id": id }),
      store,
      LIMITS,
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/interrupted/);
  });

  it("allows 20 MB files and 25 MB per email by default", () => {
    expect(megabytes(UPLOAD_LIMITS.fileBytes)).toBe("20 MB");
    expect(megabytes(UPLOAD_LIMITS.totalBytes)).toBe("25 MB");
    expect(UPLOAD_LIMITS.partBytes).toBe(4 * 1024 * 1024);
  });
});
