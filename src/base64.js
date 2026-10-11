// Base64 for email attachments. Accepts a Uint8Array or { bytes } / { text } file objects.
export const toBase64 = (input) => {
  const bytes =
    input instanceof Uint8Array ? input : input.bytes || new TextEncoder().encode(input.text);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
