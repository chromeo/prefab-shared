# prefab-shared

Code shared by the Mastercraft prefab request apps (panelboard, transformer, conduit). A fix made
here once reaches every app that upgrades, instead of being found and fixed in each copy.

## What's in it

**Files** (`@mastercraft/prefab-shared`, or `/pdf`, `/xlsx`, `/zip`, `/base64`): plain JavaScript
with no browser-only APIs, so they work in the page, in Netlify functions and in tests.

| Import                                              | What it does                                                                                                                                                                      |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `buildPlatesPdf(plates, meta)`                      | Engraved plates as a vector PDF, one page per plate at finished size, real text (Δ drawn as a triangle). This is what the engraver receives; Microsoft 365 holds SVG attachments. |
| `buildXlsx({ sheetName, rows, widths, landscape })` | A one-sheet styled `.xlsx` (engraving orders and similar).                                                                                                                        |
| `zipBytes(files)`                                   | A ZIP of `{ name, text }` / `{ name, bytes }` files.                                                                                                                              |
| `toBase64(bytes or file)`                           | Base64 for email attachments.                                                                                                                                                     |

**Screen pieces** (`@mastercraft/prefab-shared/ui`, React 18, Tailwind classes) and
**styles** (`@mastercraft/prefab-shared/styles.css`):

| Import                                                                                      | What it does                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Section({ n, title, status, id, defaultOpen, accordionMode, accordionTick, attemptTick })` | Collapsible form section: number badge, title, ✓ Complete / ⚠ Needs info badge, framed body. Expand all / Collapse all apply on each `accordionTick`; a section that appears later starts open. Reopens on each `attemptTick` while it needs attention. |
| `Notice({ notice, close })`                                                                 | Bottom-of-screen message with an optional action (Undo). `notice`: `{ text, tone, action? }`.                                                                                                                                                           |
| `ConfirmDialog({ title, choices, close, children })`                                        | In-app replacement for `confirm()`.                                                                                                                                                                                                                     |
| `AppHeader({ title, intro, version })`                                                      | Title, intro and the Mastercraft logo/contact block. On phones the logo and contact share a line above the title and the email breaks only after its @, so nothing runs off the screen with large text or zoom.                                         |
| `ScrollTopButton()`                                                                         | "Back to top" arrow, shown after scrolling about a screen.                                                                                                                                                                                              |
| `ProjectActions({ draftCount, openDrafts, newRequest })`                                    | Drafts (with a count) and New request under the header. Word and Print belong in Review & Send.                                                                                                                                                         |
| `SectionControls({ expandAll, collapseAll })`                                               | "* Required" and Expand all                                                                                                                                                                                                                             | Collapse all above the first section. |
| `PhoneReviewBar({ label, onReview })`                                                       | Phones only: Review & Send pinned to the bottom. Give the page `pb-24 sm:pb-…` so it doesn't cover the last field.                                                                                                                                      |
| `styles.css`                                                                                | `.field`, `.section-label`, `.section-number`, `.section-card`, `.table-input`, `.btn-primary`, `.btn-secondary`, 16px fields on phones, `.no-print`.                                                                                                   |

**Branding** (`@mastercraft/prefab-shared/logo`): `MCE_LOGO` (the logo as a base64 JPEG for the
screen, print and Word), `dataUrlBytes(MCE_LOGO)` for Word's image bytes, `PREFAB_EMAIL` and
`PREFAB_WEB`.

## Using it in an app

```json
"dependencies": {
  "@mastercraft/prefab-shared": "git+https://github.com/chromeo/prefab-shared.git#v1.2.0"
}
```

```js
import { buildPlatesPdf, buildXlsx } from "@mastercraft/prefab-shared";
import { Section, Notice } from "@mastercraft/prefab-shared/ui";
```

Each app pins a version tag, so a change here never reaches an app until that app upgrades.

The screen pieces ship as JSX source styled with Tailwind, so an app that uses them needs three
one-time settings:

```js
// tailwind.config.js — so the classes they use are generated
content: ["./index.html", "./src/**/*.{js,jsx}", "./node_modules/@mastercraft/prefab-shared/src/**/*.{js,jsx}"],

// vite.config.js — so Vitest compiles the JSX like the app's own files
test: { server: { deps: { inline: [/@mastercraft\/prefab-shared/] } } },
```

```css
/* index.css — first line */
@import "@mastercraft/prefab-shared/styles.css";
```

## Making a change

Two app sessions may want to change this library while the apps are developed side by side, so:

1. **One change at a time.** Before starting, run `git ls-remote --heads origin`. If someone
   else's `wip/…` branch is there, wait for it to be tagged. Otherwise push your own claim,
   `wip/<app>-<topic>` (e.g. `wip/transformer-shared-ui`).
2. Change the code and its tests here; `npm test` must pass. Start from the best existing
   version in the apps rather than writing a new one.
3. Bump `version` in `package.json` (1.0.1 for fixes, 1.1.0 for additions, 2.0.0 if an app
   would have to change how it calls something). Note what changed below.
4. Commit, then check the commit is there (`git log -1`) before tagging it with the same
   version (`v1.1.0`) on `main`. Push both and delete your `wip/` branch. The next session can
   start. A tag must never point at a commit without the change; if one does, delete it at once
   (`git push origin :refs/tags/vX.Y.Z`) before any app installs it.
5. **Apps upgrade deliberately.** Each app changes its `#v…`, runs `npm install` and its tests,
   and ships as usual. An addition only one app needs doesn't make the others upgrade.

## Changes

- **1.3.1** — Fix: the 16px phone fields (stops iOS zooming into a field) never took effect in
  1.1.0–1.3.0. That rule sat outside an `@layer`, so it landed at the top of each app's built
  CSS and the 14px field rule overrode it. Every rule in `styles.css` is now inside
  `@layer components`, and a test keeps it that way. Upgrade to get the fix; nothing else to
  change in the app.
- **1.3.0** — `ProjectActions`, `SectionControls` and `PhoneReviewBar`: panelboard's toolbar,
  section controls and phone Review & Send bar. Icons are inline, so no icon library is needed.
- **1.2.1** — `AppHeader` on phones is a centered letterhead: logo full width, then email and
  web address (tappable links, one per line when they don't fit), then the version and a
  hairline above the title. Wider screens unchanged.
- **1.2.0** — `AppHeader`: panelboard's header, fixed for phones (its logo block was `shrink-0`
  and ran off the screen with large text or Safari zoom). `/logo`: the Mastercraft logo and the
  prefab shop contact, which each app had its own copy of.
- **1.1.0** — Screen pieces and styles from the panelboard app: `Section`, `Notice`,
  `ConfirmDialog`, `ScrollTopButton`, `styles.css`. `Section` differs from panelboard's copy:
  Expand/Collapse all no longer collapses a section that appears afterwards; new `attemptTick`
  (reopen on each Review & Send attempt), `id` (scroll target) and badge-less use (no `n`); the
  chevron is inline SVG, so `lucide-react` isn't needed.
- **1.0.0** — `buildPlatesPdf`, `buildXlsx`, `zipBytes`, `toBase64`.

## What belongs here

Code that does the same job in every app: file formats (PDF, Excel, ZIP), email sending and its
safeguards, drafts and autosave, and shared screen pieces. App-specific rules (label wording,
transformer calculations, validation) stay in each app.
