import { useEffect, useState } from "react";

// "Back to top" arrow, shown only after scrolling down about a screen.
export function ScrollTopButton() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const update = () => setShow(window.scrollY > window.innerHeight * 0.8);
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  return (
    <button
      type="button"
      title="Back to top"
      aria-label="Back to top"
      aria-hidden={!show}
      tabIndex={show ? 0 : -1}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={`fixed bottom-20 right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-slate-950 text-xl font-bold text-white shadow-lg transition-all duration-200 hover:bg-slate-700 sm:bottom-6 sm:right-6 ${show ? "opacity-100" : "pointer-events-none translate-y-3 opacity-0"}`}
    >
      ↑
    </button>
  );
}
