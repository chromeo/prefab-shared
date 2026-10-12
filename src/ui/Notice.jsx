import { useEffect } from "react";

const TONES = {
  success: "border-green-600 bg-green-50 text-green-900",
  info: "border-slate-400 bg-white text-slate-900",
  warn: "border-amber-500 bg-amber-50 text-amber-950",
  error: "border-red-600 bg-red-50 text-red-900",
};
// Seconds a notice stays up; warnings and errors stay until closed or replaced.
const HIDE_AFTER = { success: 7, info: 12 };

// Feedback for every action, pinned to the bottom of the screen so it's seen wherever the
// action was clicked. `notice`: { text, tone, action?: { label, run } }.
export function Notice({ notice, close }) {
  useEffect(() => {
    const seconds = notice && HIDE_AFTER[notice.tone];
    if (!seconds) return;
    const t = setTimeout(close, (notice.action ? seconds + 5 : seconds) * 1000);
    return () => clearTimeout(t);
  }, [notice, close]);
  if (!notice) return null;
  const urgent = notice.tone === "warn" || notice.tone === "error";
  return (
    <div className="no-print pointer-events-none fixed inset-x-0 bottom-16 z-[60] flex justify-center px-3 sm:bottom-6">
      <div
        role={urgent ? "alert" : "status"}
        className={`pointer-events-auto flex w-full max-w-xl items-start gap-3 rounded-xl border-l-4 p-3 text-sm shadow-lg ring-1 ring-black/5 ${TONES[notice.tone] || TONES.info}`}
      >
        <p className="flex-1 pt-0.5">{notice.text}</p>
        {notice.action && (
          <button
            type="button"
            className="shrink-0 rounded-lg border border-current px-3 py-1 font-bold"
            onClick={() => {
              close();
              notice.action.run();
            }}
          >
            {notice.action.label}
          </button>
        )}
        <button
          type="button"
          aria-label="Dismiss"
          className="h-7 w-7 shrink-0 rounded-lg opacity-70 hover:bg-black/5 hover:opacity-100"
          onClick={close}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
