import { useEffect, useId, useRef, useState } from "react";

const Chevron = ({ open }) => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={`shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

/**
 * Collapsible form section: number badge, title, ✓ Complete / ⚠ Needs info badge (text hidden
 * on phones), and a framed body. From the panelboard app.
 *   n              badge text ("1", "4A")
 *   status         "complete" | "warning" | null
 *   accordionMode  "open" | "closed" — applied each time accordionTick changes (Expand all /
 *                  Collapse all). A section that appears later starts at defaultOpen.
 *   attemptTick    bump on every Review & Send attempt: a section that needs attention reopens,
 *                  even if it was closed by hand.
 *   id             optional; the <section> gets id="section-<id>" for scrolling to it.
 */
export function Section({
  n,
  title,
  status,
  children,
  id,
  defaultOpen = true,
  accordionMode,
  accordionTick,
  attemptTick,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current && accordionMode) setOpen(accordionMode === "open");
    mounted.current = true;
  }, [accordionTick]);
  useEffect(() => {
    if (status === "warning") setOpen(true);
  }, [status, attemptTick]);
  return (
    <section
      id={id ? `section-${id}` : undefined}
      data-section-status={status || ""}
      className="mb-3 scroll-mt-4 sm:mb-4"
    >
      <button
        type="button"
        className={`flex w-full items-center gap-2.5 rounded-lg px-1 py-1.5 text-left hover:bg-slate-50 sm:gap-3 sm:py-2 ${status === "warning" ? "bg-amber-50" : ""}`}
        onClick={() => setOpen((x) => !x)}
        aria-expanded={open}
        aria-controls={bodyId}
      >
        {n && (
          <span className="section-number !h-7 !w-7 !text-xs sm:!h-8 sm:!w-8 sm:!text-sm">{n}</span>
        )}
        <h2 className="flex-1 text-base font-bold leading-tight sm:text-xl">{title}</h2>
        {status === "complete" && (
          <span
            className="shrink-0 rounded-full bg-green-100 px-2 py-1 text-xs font-bold text-green-800"
            title="Complete"
          >
            ✓<span className="hidden sm:inline"> Complete</span>
          </span>
        )}
        {status === "warning" && (
          <span
            className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-900"
            title="Needs info"
          >
            ⚠<span className="hidden sm:inline"> Needs info</span>
          </span>
        )}
        <Chevron open={open} />
      </button>
      <div
        id={bodyId}
        className={`${open ? "block" : "hidden"} rounded-lg border border-slate-200 p-3 sm:p-4`}
      >
        {children}
      </div>
    </section>
  );
}
