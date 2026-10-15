// The form's toolbar pieces (from the panelboard app). Word, Print and file downloads live in
// Review & Send, where the request is finished; before that you only need Drafts and New request.

const icon = (d) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {d}
  </svg>
);
const FOLDER_OPEN = icon(
  <path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2" />,
);
const FILE_PLUS = icon(
  <>
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    <path d="M9 15h6" />
    <path d="M12 18v-6" />
  </>,
);

const button =
  "inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm transition hover:bg-slate-50";

/**
 * Drafts and New request, under the header.
 *   draftCount  shown as a badge on Drafts when above 0
 *   openDrafts  opens the app's draft picker
 *   newRequest  starts over (the app asks first)
 */
export function ProjectActions({ draftCount = 0, openDrafts, newRequest }) {
  return (
    <div className="no-print mb-6 flex flex-wrap gap-2 sm:mb-7">
      <button type="button" className={button} onClick={openDrafts}>
        {FOLDER_OPEN}
        Drafts
        {draftCount > 0 && (
          <span className="rounded-full bg-slate-100 px-2 text-xs font-semibold text-slate-600">
            {draftCount}
          </span>
        )}
      </button>
      <button type="button" className={button} onClick={newRequest}>
        {FILE_PLUS}
        New request
      </button>
    </div>
  );
}

/** "* Required" on the left, Expand all | Collapse all on the right, above the first section. */
export function SectionControls({ expandAll, collapseAll }) {
  return (
    <div className="no-print mb-2 flex items-center justify-between gap-2 text-sm text-slate-600">
      <span>
        <b className="text-red-600">*</b> Required
      </span>
      <span className="flex gap-2 font-semibold">
        <button type="button" className="hover:text-slate-900" onClick={expandAll}>
          Expand all
        </button>
        <span className="text-slate-300" aria-hidden="true">
          |
        </span>
        <button type="button" className="hover:text-slate-900" onClick={collapseAll}>
          Collapse all
        </button>
      </span>
    </div>
  );
}

/**
 * Phones only: Review & Send pinned to the bottom of the screen, within thumb reach. The page
 * needs bottom padding on phones (pb-24 sm:pb-*) so the bar doesn't cover the last field.
 *   label     text on the left, e.g. "Job 24-118" or "3 items to fix"
 *   onReview  opens Review & Send
 */
export function PhoneReviewBar({ label, onReview }) {
  return (
    <div className="no-print fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 border-t border-slate-200 bg-white/95 px-3 py-2.5 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur sm:hidden">
      <span className="min-w-0 flex-1 truncate text-xs text-slate-600">{label}</span>
      <button
        type="button"
        className="shrink-0 rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-bold text-white"
        onClick={onReview}
      >
        Review &amp; Send
      </button>
    </div>
  );
}
