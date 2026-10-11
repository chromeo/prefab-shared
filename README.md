# prefab-shared

Code shared by the Mastercraft prefab request apps (panelboard, transformer, conduit). A fix made
here once reaches every app that upgrades, instead of being found and fixed in each copy.

## What's in it

| Import                                              | What it does                                                                                                                                                                      |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `buildPlatesPdf(plates, meta)`                      | Engraved plates as a vector PDF, one page per plate at finished size, real text (Δ drawn as a triangle). This is what the engraver receives; Microsoft 365 holds SVG attachments. |
| `buildXlsx({ sheetName, rows, widths, landscape })` | A one-sheet styled `.xlsx` (engraving orders and similar).                                                                                                                        |
| `zipBytes(files)`                                   | A ZIP of `{ name, text }` / `{ name, bytes }` files.                                                                                                                              |
| `toBase64(bytes or file)`                           | Base64 for email attachments.                                                                                                                                                     |

Everything is plain JavaScript with no browser-only APIs, so it works in the page, in Netlify
functions and in tests.

## Using it in an app

```json
"dependencies": {
  "@mastercraft/prefab-shared": "github:chromeo/prefab-shared#v1.0.0"
}
```

```js
import { buildPlatesPdf, buildXlsx } from "@mastercraft/prefab-shared";
```

Each app pins a version tag, so a change here never reaches an app until that app upgrades.

## Making a change

1. Change the code and its tests here; `npm test` must pass.
2. Bump `version` in `package.json` (1.0.1 for fixes, 1.1.0 for additions, 2.0.0 if an app
   would have to change how it calls something).
3. Commit, then tag the commit with the same version (`v1.1.0`) and push the tag.
4. In each app, change the `#v…` in its `package.json`, run `npm install`, run its tests, and
   ship as usual.

## What belongs here

Code that does the same job in every app: file formats (PDF, Excel, ZIP), email sending and its
safeguards, drafts and autosave, and shared screen pieces. App-specific rules (label wording,
transformer calculations, validation) stay in each app.
