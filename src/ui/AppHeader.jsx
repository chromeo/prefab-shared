import { MCE_LOGO, PREFAB_EMAIL, PREFAB_WEB } from "../logo.js";

// The text with an optional line break at the first `at`: after it (side 1) or before it (0).
const breakable = (text, at, side) => {
  const i = text.indexOf(at) + side;
  return i < side ? (
    text
  ) : (
    <>
      {text.slice(0, i)}
      <wbr />
      {text.slice(i)}
    </>
  );
};

/**
 * App title, intro and the Mastercraft logo/contact block (from the panelboard app).
 * Phones: a centered letterhead above the title — logo full width, then email and web address
 * (side by side, or one per line when they don't fit), then the version, and a hairline.
 * Nothing runs off the screen with large text or zoom. Wider screens: title left, logo above
 * contact on the right, capped at 45%.
 *   title    "Panelboard Prefab"
 *   intro    one sentence under the title (optional)
 *   version  e.g. "v10.26.0 · 7db1567"
 * Class names brand-block, brand-logo, brand-contact and web-form-intro are kept for app CSS.
 */
export function AppHeader({ title, intro, version }) {
  return (
    <header className="mb-6 border-b-2 border-slate-900 pb-5 sm:mb-7">
      <div className="flex flex-col-reverse gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
          {intro && (
            <p className="web-form-intro mt-2 text-sm text-slate-500 sm:text-base">{intro}</p>
          )}
        </div>
        <div className="brand-block min-w-0 border-b border-slate-200 pb-3 text-center text-xs text-slate-500 sm:max-w-[45%] sm:flex-none sm:border-0 sm:pb-0 sm:text-right">
          <img
            src={MCE_LOGO}
            alt="Mastercraft Electric Inc."
            className="brand-logo mx-auto block w-full max-w-[300px] object-contain sm:ml-auto sm:mr-0 sm:w-[310px] sm:max-w-full"
          />
          <div className="brand-contact mt-2 flex flex-wrap justify-center gap-x-4 leading-5 [overflow-wrap:anywhere] sm:block">
            <a className="block min-w-0 hover:underline" href={`mailto:${PREFAB_EMAIL}`}>
              {breakable(PREFAB_EMAIL, "@", 1)}
            </a>
            <a className="block min-w-0 hover:underline" href={`https://${PREFAB_WEB}`}>
              {breakable(PREFAB_WEB, "/", 0)}
            </a>
          </div>
          {version && <div className="mt-1 text-[11px]">{version}</div>}
        </div>
      </div>
    </header>
  );
}
