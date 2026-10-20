// Uploading attachments larger than one Netlify function request can carry.
//
// A function request is capped at about 6 MB, and a binary body grows by a third on the way in,
// so one request can safely carry 4 MB. A bigger file goes in 4 MB parts, one after another; the
// upload function keeps each part, and joins them when the last arrives. The person filling out
// the form sees nothing different. A file of 4 MB or less is still one request, as before.
//
// Page:     const r = await uploadInParts(file, (headers, body) => fetch(url, { …, headers, body }))
// Function: const { bytes, response } = await receiveUpload(request, store)
//           if (response) return response;  // an error, or "part saved, send the next"
//           …store `bytes` as the finished file…

/** Upload limits shared by the page and the functions. */
export const UPLOAD_LIMITS = {
  partBytes: 4 * 1024 * 1024, // one request
  fileBytes: 20 * 1024 * 1024, // one file
  // Every attachment in one email. Resend accepts 40 MB, but Microsoft 365 mailboxes refuse
  // messages over 36 MB by default, and attachments grow by a third inside an email.
  totalBytes: 25 * 1024 * 1024,
};

const MB = 1024 * 1024;
/** "20 MB" for messages. */
export const megabytes = (bytes) => `${Math.round((bytes / MB) * 10) / 10} MB`;

// Headers the page sends with each part.
const PART = "x-upload-part"; // 1, 2, … (1-based)
const PARTS = "x-upload-parts"; // how many parts the file has
const ID = "x-upload-id"; // given by the function after part 1

/**
 * Page side. Sends `file` (a File or Blob) in parts. `post(headers, body)` makes one request and
 * returns the Response; add the app's own headers (type, name) there. Returns the last Response
 * (the finished file's), or the first one that failed, unread, so the app handles it as before.
 * `onPart(part, parts)` is called before each part.
 */
export const uploadInParts = async (
  file,
  post,
  { partBytes = UPLOAD_LIMITS.partBytes, onPart = () => {} } = {},
) => {
  const parts = Math.max(1, Math.ceil(file.size / partBytes));
  if (parts === 1) {
    onPart(1, 1);
    return post({}, file);
  }
  let id = "";
  for (let part = 1; part <= parts; part++) {
    onPart(part, parts);
    const headers = {
      "X-Upload-Part": String(part),
      "X-Upload-Parts": String(parts),
      ...(id ? { "X-Upload-Id": id } : {}),
    };
    const r = await post(headers, file.slice((part - 1) * partBytes, part * partBytes));
    if (!r.ok || part === parts) return r;
    if (part === 1) {
      id = String((await r.json().catch(() => ({}))).uploadId || "");
      if (!id) return r;
    }
  }
};

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
const ID_FORMAT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const whole = (value) => (/^\d{1,3}$/.test(String(value)) ? Number(value) : NaN);

/**
 * Function side. Reads one upload request: a whole file, or one part of a larger one.
 *   store   where parts wait (a Netlify Blobs store: set, get, delete)
 *   prefix  key prefix for the parts; use the same one the app's cleanup accepts
 * Returns { bytes } (a Uint8Array) once the file is complete, or { response } to return as-is:
 * an error, or, for a part before the last, { ok, uploadId, part }.
 */
export const receiveUpload = async (
  request,
  store,
  {
    prefix = "pending/",
    partBytes = UPLOAD_LIMITS.partBytes,
    fileBytes = UPLOAD_LIMITS.fileBytes,
  } = {},
) => {
  const tooBig = () => ({
    response: json(413, { error: `Each attachment must be ${megabytes(fileBytes)} or smaller.` }),
  });
  const headers = request.headers;
  const parts = headers.has(PARTS) ? whole(headers.get(PARTS)) : 1;
  const part = headers.has(PART) ? whole(headers.get(PART)) : 1;
  if (!(parts >= 1 && part >= 1 && part <= parts))
    return { response: json(400, { error: "Invalid upload." }) };
  if ((parts - 1) * partBytes >= fileBytes) return tooBig();

  // The page never sends more than one part per request; anything bigger isn't from the page.
  const oversize = { response: json(413, { error: "The upload is too large for one request." }) };
  if (Number(headers.get("content-length") || 0) > partBytes) return oversize;
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (!bytes.length) return { response: json(400, { error: "The uploaded file is empty." }) };
  if (bytes.length > partBytes) return oversize;
  if (parts === 1) return { bytes };

  // A part before the last must be full size, so the parts can only add up one way.
  if (part < parts && bytes.length !== partBytes)
    return { response: json(400, { error: "Invalid upload." }) };
  const id = part === 1 ? crypto.randomUUID() : String(headers.get(ID) || "");
  if (!ID_FORMAT.test(id)) return { response: json(400, { error: "Invalid upload." }) };
  const key = (n) => `${prefix}part-${id}-${n}`;
  if (part < parts) {
    await store.set(key(part), bytes);
    return { response: json(200, { ok: true, uploadId: id, part }) };
  }

  // The last part: join the earlier ones to it, then remove them.
  const earlier = [];
  for (let n = 1; n < parts; n++) {
    const data = await store.get(key(n), { type: "arrayBuffer", consistency: "strong" });
    if (!data) {
      await Promise.allSettled(earlier.map((_, i) => store.delete(key(i + 1))));
      return {
        response: json(400, { error: "The upload was interrupted. Try sending again." }),
      };
    }
    earlier.push(new Uint8Array(data));
  }
  await Promise.allSettled(earlier.map((_, i) => store.delete(key(i + 1))));
  const size = earlier.reduce((n, x) => n + x.length, bytes.length);
  if (size > fileBytes) return tooBig();
  const file = new Uint8Array(size);
  let at = 0;
  for (const chunk of [...earlier, bytes]) {
    file.set(chunk, at);
    at += chunk.length;
  }
  return { bytes: file };
};
