import { useEffect, useRef } from "react";

// In-app replacement for the browser's confirm() box. `choices`: [{ label, run, tone }],
// listed left to right; tone "danger" is red, "primary" dark. Escape or Cancel closes.
export function ConfirmDialog({ title, children, choices, close }) {
  const cancel = useRef(null);
  useEffect(() => {
    cancel.current?.focus();
    const onKey = (e) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);
  const style = {
    danger: "bg-red-700 text-white hover:bg-red-800",
    primary: "bg-slate-900 text-white hover:bg-slate-700",
  };
  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <h2 id="confirm-title" className="text-lg font-bold">
          {title}
        </h2>
        <div className="mt-2 space-y-2 text-sm text-slate-700">{children}</div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            ref={cancel}
            type="button"
            className="rounded-lg border px-4 py-2 font-semibold hover:bg-slate-50"
            onClick={close}
          >
            Cancel
          </button>
          {choices.map(({ label, run, tone }) => (
            <button
              key={label}
              type="button"
              className={`rounded-lg px-4 py-2 font-semibold ${style[tone] || "border hover:bg-slate-50"}`}
              onClick={() => {
                close();
                run();
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
