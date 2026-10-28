# prefab-shared — notes for Claude

The library the three prefab apps share. README.md lists every export and the change log; read it
before changing anything.

- Work from `main`. **This repo is the exception to "never push to main":** releases are tagged
  commits on `main`, made under the wip-branch rule below. The `dev` and `claude-md` branches are
  leftovers and aren't used.
- No Netlify site and no deploy cost here; a change reaches an app only when that app upgrades.
- Plain JS files must work in the browser, in Netlify functions and in tests (no browser-only
  APIs). Screen pieces in `src/ui/` are React 18 with Tailwind classes.

## Every change (definition of done)

1. `git pull`, then `git ls-remote --heads origin`: if a `wip/…` branch exists, another session
   has the turn; wait. Otherwise claim it: `git push origin HEAD:refs/heads/wip/<app>-<topic>`.
2. Start from the best existing version in an app; change the code and its tests (`npm test`).
3. Code changes: bump `package.json` (patch fix, minor addition, major when an app must change how
   it calls something), add a README "Changes" entry, and update README's export tables. Docs-only
   changes don't bump the version or get a tag.
4. Commit; check `git show --stat HEAD` holds the change, then `git tag vX.Y.Z`. Run the release
   steps with `set -e`. Push `main` and the tag, then delete the wip branch.
5. Tell Gary what each app needs to adopt it (pin, any call changes, any CLAUDE.md shared-rule
   text). Don't edit an app's repo from here or from another app's session.
6. If the change alters the shared rules below, change them in all four repos' CLAUDE.md: here,
   and give Gary the exact text for the app sessions.

## Lessons (learned the hard way)

- A failed step in a multi-line release script once let a later line tag the previous commit.
  `set -e`, and check the commit before tagging; delete a wrong tag at once
  (`git push origin :refs/tags/vX.Y.Z`) before any app installs it.
- `styles.css` rules must sit inside `@layer components`: one outside a layer lands at the top of
  the app's built CSS, where the app's own rules override it (the iOS 16px fix silently failed in
  1.1.0–1.3.0). `styles.test.js` enforces it.
- Netlify Blobs stores an ArrayBuffer (or string/Blob) as-is; pass `.buffer`, not a Uint8Array.
- React 18 doesn't know `inert`: pass `inert=""` (a string) when closed, `undefined` when open.
- `Section` tests read `data-open` on the body, not a `hidden` class (since 1.6.0 it slides).
- Apps ship this as JSX source: each app needs the Tailwind `content` path and Vitest
  `deps.inline` (README "Using it in an app"), or classes go missing / tests fail to compile.
- npm rewrites the `git+https` spec to `github:`; apps restore the spelling after installing.

## Shared rules for the prefab repos

This section is the same in all four repos (panelboard-prefab, transformer-prefab-form,
conduit-prefab, prefab-shared). Change it in all four together.

### The repos and the machines

- Apps, each its own Netlify site: `chromeo/panelboard-prefab`, `chromeo/transformer-prefab-form`,
  `chromeo/conduit-prefab`. Library: `chromeo/prefab-shared` (not on Netlify).
- Gary works on a Mac and a Windows PC. GitHub is the source of truth: `git pull` before starting,
  and push everything worth keeping. Claude sessions on either machine read this file, so put
  standing decisions here, not in chat.
- The `gh` CLI is installed and signed in on the Mac only. On the PC, give GitHub compare links
  (`https://github.com/chromeo/<repo>/compare/<base>...<branch>?expand=1`).

### Branches, deploys and cost

- **Never push or merge to `main` in an app repo.** Branch from `dev`, open a PR into `dev`. Gary
  merges every PR himself.
- Merging into `dev` builds a free branch deploy at `https://dev--<site>.netlify.app` (e.g.
  `dev--conduitprefab`, `dev--panelboardprefab`). Check it on desktop and iPhone there.
- A release is one PR `dev` → `main`, **at most once a day, and only on days something changed**.
  Each production deploy costs 15 of the account's 1,000 monthly Netlify credits, shared by every
  site (66 deploys paused all sites on 2026-10-16). Branch deploys and Deploy Previews are free.
- Don't use Netlify's **Trigger deploy** to test: it rebuilds production. Each site has a build hook
  for `dev` (Project configuration → Build hooks) for rebuilding `dev` after a settings change. A
  hook's branch is set when it's created (type the branch name; the list only shows built branches).
- Emails from `dev` and previews are real. `PREFAB_TO_EMAIL` is set per deploy context: Gary's
  address for branch deploys and previews, the shop for production. Test sends only from `dev`.
- Netlify bakes environment variables in at build time: a changed setting needs a rebuild.
  `RESEND_API_KEY` is marked secret (unreadable once saved); the other `PREFAB_*` settings aren't,
  because their default values appear in the code and the secret scanner would fail the build.
- Bump the app's `REV` (`src/config/constants.js`) every round and add a README "Changes" entry.

### prefab-shared

- Apps pin a tag: `"@mastercraft/prefab-shared": "git+https://github.com/chromeo/prefab-shared.git#vX.Y.Z"`.
  Upgrade with `npm install "git+https://github.com/chromeo/prefab-shared.git#vX.Y.Z"`; plain
  `npm install` keeps the locked version, and npm rewrites the spec to `github:…`, so change it
  back to the `git+https` spelling. Use `npm ci` after pulling.
- It ships JSX source (React 18 peer). Apps need: Tailwind `content` includes
  `./node_modules/@mastercraft/prefab-shared/src/**/*.{js,jsx}`; Vite
  `test.server.deps.inline: [/@mastercraft\/prefab-shared/]`; first line of `index.css`
  `@import "@mastercraft/prefab-shared/styles.css";`.
- **One session changes the library at a time.** Before starting, `git ls-remote --heads origin`:
  if a `wip/…` branch exists, wait. Claim with `git push origin HEAD:refs/heads/wip/<app>-<topic>`.
  Start from the best existing version in an app, add tests (`npm test` must pass), bump
  `package.json` (patch fix, minor addition, major when an app must change how it calls something)
  and add a README "Changes" entry. Commit, check `git show --stat HEAD`, then tag `vX.Y.Z` on
  `main`, push `main` and the tag, delete the wip branch. Run release steps with `set -e`; if a tag
  ever lands on the wrong commit, delete it at once (`git push origin :refs/tags/vX.Y.Z`).
- Apps upgrade deliberately, each in its own PR. An addition one app needs doesn't force the others
  to upgrade. Don't change another app's repo from an app's session; say what it needs instead.

### Stack and code

- React 18, Vite 6, Tailwind 3, Vitest 3, Prettier (`printWidth: 100`), Netlify Functions v2
  (`export const config = { path: "/api/…", rateLimit }`), Resend for email.
- Layout: `src/config/constants.js`, `data/`, `lib/` (pure logic + `.test.js`), `outputs/` (Word,
  PDF, send), `components/`, `sections/` (one file per numbered form section).
- One builder makes the work order; Review, print, Word and both email parts read from it.
  Snapshot-test the plain-text email. Under Vitest the build ID is `"test"` (set in
  `vite.config.js`), or the commit ends up in snapshots.
- `netlify.toml` builds with `npm test && npm run build`, so a failing test stops the deploy.
  `[functions] node_bundler = "esbuild"` when a function imports app code from `src/`.
- Comments are short and plain and say why. UI text is for electricians, not developers.

### Shared UX

- Page frame: white edge to edge on phones (`bg-white`), a rounded white card on `sm:bg-slate-100`
  above that; `pb-24` on phones for the bottom bar.
- Top of the form: AppHeader → ProjectActions (Drafts, New request; Word and Print live in Review &
  Send) → SectionControls → numbered Sections. Only Section 1 is open on load, and a section
  that appears later (a service was ticked) starts closed. Each section ends with **Next: …**,
  which closes it and opens the next; Tab out of a finished section does the same. Sections
  slide open and closed over 0.2 s (`Section` `command`, prefab-shared 1.6.0). Review & Send
  reopens sections that need info.
- Project Information, two columns on phones and three on desktop: Job name, Job number, Phase
  code, Cost code or PO #, Ordered by, Phone, Your email (for a copy), Date ordered, Date needed.
- Phones: PhoneReviewBar pinned at the bottom; the in-page Review & Send button hides below `sm`.
- Attachments: PDFs and photos, 12 files, 20 MB each, 25 MB total (prefab-shared 1.5.0 `/upload`:
  files over 4 MB go in 4 MB parts), uploaded one at a time to `/api/prefab-upload` (Netlify
  Blobs); the send function attaches and deletes them.

### Email rules (learned the hard way)

- Never attach an SVG: Microsoft 365 silently drops the whole email. Label art goes as a vector
  PDF (`buildPlatesPdf`).
- The forms are public. The page sends form **data**; the send function builds the email itself
  and uses prefab-shared's `/email` helpers: `readJsonRequest`, `isSpamTrap` (hidden `website`
  field), `requesterCopy` (company domains only), `checkedAttachment` (checks the file's bytes),
  `sendViaResend`.
- Send the upload's file name URL-encoded in `X-Prefab-Filename`. Browsers refuse header values
  outside Latin-1, and a Mac screenshot's name has a narrow space (U+202F) before "PM": unencoded,
  `fetch` throws and the page says "Couldn't reach the server".
