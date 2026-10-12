// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialog, Notice, ScrollTopButton, Section } from "./index.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root, host;
const render = (el) => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(el));
};
const rerender = (el) => act(() => root.render(el));
const bodyOpen = () => !host.querySelector("section > div").className.includes("hidden");
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
