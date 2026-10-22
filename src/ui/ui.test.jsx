// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MCE_LOGO, dataUrlBytes } from "../logo.js";
import {
  AppHeader,
  ConfirmDialog,
  Notice,
  PhoneReviewBar,
  ProjectActions,
  ScrollTopButton,
  Section,
  SectionControls,
} from "./index.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root, host;
const render = (el) => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(el));
};
const rerender = (el) => act(() => root.render(el));
const body = () => host.querySelector("section > div");
const bodyOpen = () => body().dataset.open === "true";
const toggle = () => act(() => host.querySelector("section > button").click());
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
});

describe("Section", () => {
  it("shows the number badge, title and status", () => {
    const html = renderToStaticMarkup(
      <Section n="4A" title="Primary Raceway" status="complete" id="primary">
        body
      </Section>,
    );
    expect(html).toContain('id="section-primary"');
    expect(html).toContain('class="section-number');
    expect(html).toContain(">4A<");
    expect(html).toContain("Primary Raceway");
    expect(html).toContain("Complete");
    expect(renderToStaticMarkup(<Section title="No number" />)).not.toContain("section-number");
  });

  it("Expand all / Collapse all apply on each tick, but not to a section that appears later", () => {
    const s = (props) => <Section n="1" title="T" {...props} />;
    render(s({ accordionMode: "closed", accordionTick: 3 }));
    expect(bodyOpen()).toBe(true); // mounted after Collapse all: starts open
    rerender(s({ accordionMode: "closed", accordionTick: 4 }));
    expect(bodyOpen()).toBe(false);
    rerender(s({ accordionMode: "open", accordionTick: 5 }));
    expect(bodyOpen()).toBe(true);
  });

  it("reopens on every Review & Send attempt while it needs attention", () => {
    const s = (attemptTick) => (
      <Section n="1" title="T" status="warning" attemptTick={attemptTick} />
    );
    render(s(1));
    expect(bodyOpen()).toBe(true);
    toggle();
    expect(bodyOpen()).toBe(false);
    rerender(s(2));
    expect(bodyOpen()).toBe(true);
  });
});

describe("Section, guided", () => {
  it("opens and closes on each command, for a Next button or Tab out of a finished section", () => {
    const s = (command) => <Section n="2" title="T" defaultOpen={false} command={command} />;
    render(s(null));
    expect(bodyOpen()).toBe(false);
    rerender(s({ open: true, tick: 1 }));
    expect(bodyOpen()).toBe(true);
    rerender(s({ open: false, tick: 2 }));
    expect(bodyOpen()).toBe(false);
    rerender(s(null)); // no command for this section: it stays as it is
    expect(bodyOpen()).toBe(false);
  });

  it("a closed section can't be tabbed into or read out, and slides rather than snapping", () => {
    render(
      <Section n="2" title="T" defaultOpen={false}>
        <input />
      </Section>,
    );
    expect(body().getAttribute("inert")).toBe("");
    expect(body().getAttribute("aria-hidden")).toBe("true");
    expect(body().className).toContain("grid-rows-[0fr]");
    expect(body().className).toContain("transition-[grid-template-rows]");
    expect(body().className).toContain("motion-reduce:transition-none");
    toggle();
    expect(body().hasAttribute("inert")).toBe(false);
    expect(body().className).toContain("grid-rows-[1fr]");
  });
});

describe("Notice, ConfirmDialog, ScrollTopButton", () => {
  it("Notice shows text and its action, and renders nothing without a notice", () => {
    const run = vi.fn();
    render(
      <Notice
        notice={{ text: "Deleted", tone: "success", action: { label: "Undo", run } }}
        close={() => {}}
      />,
    );
    expect(host.textContent).toContain("Deleted");
    act(() => [...host.querySelectorAll("button")].find((b) => b.textContent === "Undo").click());
    expect(run).toHaveBeenCalled();
    expect(renderToStaticMarkup(<Notice notice={null} close={() => {}} />)).toBe("");
  });

  it("ConfirmDialog runs the chosen action and closes", () => {
    const run = vi.fn(),
      close = vi.fn();
    render(
      <ConfirmDialog title="Start over?" choices={[{ label: "Blank form", run }]} close={close}>
        <p>Body</p>
      </ConfirmDialog>,
    );
    act(() =>
      [...host.querySelectorAll("button")].find((b) => b.textContent === "Blank form").click(),
    );
    expect(close).toHaveBeenCalled();
    expect(run).toHaveBeenCalled();
  });

  it("ScrollTopButton starts hidden", () => {
    expect(renderToStaticMarkup(<ScrollTopButton />)).toContain('aria-hidden="true"');
  });
});

describe("AppHeader", () => {
  const html = renderToStaticMarkup(
    <AppHeader
      title="Transformer Prefab"
      intro="Select the services."
      version="v7.6.1 · abc1234"
    />,
  );
  it("shows the title, intro, logo, contact and version", () => {
    const text = html.replace(/<wbr\/>/g, "");
    for (const t of [
      "Transformer Prefab",
      "Select the services.",
      "prefab@mastercraftinc.com",
      "mastercraftinc.com/prefab",
      "v7.6.1 · abc1234",
    ])
      expect(text).toContain(t);
    expect(html).toContain('alt="Mastercraft Electric Inc."');
  });

  // The logo block used to be shrink-0 and ran off phone screens with large text or zoom.
  it("lets the logo block shrink and wrap on narrow screens", () => {
    const brand = html.match(/class="(brand-block[^"]*)"/)[1];
    expect(brand).not.toMatch(/(^| )shrink-0/);
    expect(brand).toContain("min-w-0");
    expect(html).toContain("flex-col-reverse");
    expect(html).toContain("[overflow-wrap:anywhere]");
    expect(html.match(/class="(brand-logo[^"]*)"/)[1]).toContain("max-w-[300px]");
  });

  it("the logo is a JPEG", () => {
    const bytes = dataUrlBytes(MCE_LOGO);
    expect([bytes[0], bytes[1]]).toEqual([0xff, 0xd8]);
  });
});

describe("AppHeader line breaks", () => {
  it("breaks the email only after the @ and the web address only before /prefab", () => {
    const html = renderToStaticMarkup(<AppHeader title="T" />);
    expect(html).toContain("prefab@<wbr/>mastercraftinc.com");
    expect(html).toContain("mastercraftinc.com<wbr/>/prefab");
  });
});

describe("AppHeader on phones", () => {
  const html = renderToStaticMarkup(<AppHeader title="T" version="v1" />);
  it("is a centered letterhead with a hairline above the title", () => {
    const brand = html.match(/class="(brand-block[^"]*)"/)[1];
    expect(brand).toContain("text-center");
    expect(brand).toContain("border-b");
    expect(brand).toContain("sm:text-right");
  });

  it("the email and web address can be tapped", () => {
    expect(html).toContain('href="mailto:prefab@mastercraftinc.com"');
    expect(html).toContain('href="https://mastercraftinc.com/prefab"');
  });
});

describe("ProjectActions, SectionControls, PhoneReviewBar", () => {
  const click = (text) =>
    act(() =>
      [...host.querySelectorAll("button")].find((b) => b.textContent.includes(text)).click(),
    );

  it("ProjectActions has only Drafts (with a count) and New request", () => {
    const openDrafts = vi.fn(),
      newRequest = vi.fn();
    render(<ProjectActions draftCount={3} openDrafts={openDrafts} newRequest={newRequest} />);
    expect([...host.querySelectorAll("button")].map((b) => b.textContent)).toEqual([
      "Drafts3",
      "New request",
    ]);
    click("Drafts");
    click("New request");
    expect(openDrafts).toHaveBeenCalled();
    expect(newRequest).toHaveBeenCalled();
    expect(renderToStaticMarkup(<ProjectActions />)).not.toContain("rounded-full");
  });

  it("SectionControls expands and collapses", () => {
    const expandAll = vi.fn(),
      collapseAll = vi.fn();
    render(<SectionControls expandAll={expandAll} collapseAll={collapseAll} />);
    expect(host.textContent).toContain("* Required");
    click("Expand all");
    click("Collapse all");
    expect(expandAll).toHaveBeenCalled();
    expect(collapseAll).toHaveBeenCalled();
  });

  it("PhoneReviewBar shows on phones only and opens Review & Send", () => {
    const onReview = vi.fn();
    render(<PhoneReviewBar label="Job 24-118" onReview={onReview} />);
    expect(host.firstChild.className).toContain("sm:hidden");
    expect(host.firstChild.className).toContain("no-print");
    expect(host.textContent).toContain("Job 24-118");
    click("Review & Send");
    expect(onReview).toHaveBeenCalled();
  });
});
