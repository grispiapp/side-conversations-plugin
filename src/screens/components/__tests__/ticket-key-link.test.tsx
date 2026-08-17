import { ReactElement, act } from "react";
import { Root, createRoot } from "react-dom/client";

import { ParentKeyChip } from "../parent-key-chip";
import { TicketKeyLink } from "../ticket-key-link";

import { buildAgentTicketUrl } from "@/grispi/client/environment";

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

function render(ui: ReactElement): void {
  act(() => {
    root.render(ui);
  });
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

// Cheap role-query helper — this repo's other component tests query the DOM
// directly rather than pulling in @testing-library/react (attachment-chip
// test's established pattern).
function queryAllByRole(role: string): Element[] {
  return Array.from(container.querySelectorAll(`[role="${role}"]`)).concat(
    role === "link"
      ? Array.from(container.querySelectorAll("a[href]"))
      : []
  );
}

describe("TicketKeyLink", () => {
  it("renders an <a> whose href equals buildAgentTicketUrl's own output", () => {
    render(
      <TicketKeyLink
        tenantId="gsocial-test"
        environment="preprod"
        ticketKey="TICKET-597"
      />
    );

    const link = container.querySelector("a");
    expect(link).not.toBeNull();
    expect(link!.getAttribute("href")).toBe(
      buildAgentTicketUrl("gsocial-test", "preprod", "TICKET-597")
    );
  });

  it("opens in a new tab safely: target=_blank, rel=noopener noreferrer", () => {
    render(
      <TicketKeyLink
        tenantId="gsocial-test"
        environment="preprod"
        ticketKey="TICKET-597"
      />
    );

    const link = container.querySelector("a")!;
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("has the locked aria-label pattern containing the key", () => {
    render(
      <TicketKeyLink
        tenantId="gsocial-test"
        environment="prod"
        ticketKey="TICKET-597"
      />
    );

    const link = container.querySelector("a")!;
    expect(link.getAttribute("aria-label")).toBe(
      "TICKET-597 talebini yeni sekmede aç"
    );
  });

  it("renders the FULL ticket key as visible text, not just the numeric fragment", () => {
    render(
      <TicketKeyLink
        tenantId="gsocial-test"
        environment="preprod"
        ticketKey="TICKET-597"
      />
    );

    expect(container.textContent).toContain("TICKET-597");
  });

  it("the external-link icon is aria-hidden (never part of the accessible name)", () => {
    render(
      <TicketKeyLink
        tenantId="gsocial-test"
        environment="preprod"
        ticketKey="TICKET-597"
      />
    );

    const svg = container.querySelector("a svg");
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("ParentKeyChip", () => {
  it("never renders a link-role or button-role element", () => {
    render(<ParentKeyChip parentKey="TICKET-100" />);

    expect(queryAllByRole("link")).toHaveLength(0);
    expect(queryAllByRole("button")).toHaveLength(0);
  });

  it("renders no href attribute anywhere in its output", () => {
    render(<ParentKeyChip parentKey="TICKET-100" />);

    expect(container.querySelector("[href]")).toBeNull();
  });

  it("visible content carries both the 'üst talep' label and the key (color is never the only signal)", () => {
    render(<ParentKeyChip parentKey="TICKET-100" />);

    expect(container.textContent).toContain("üst talep");
    expect(container.textContent).toContain("TICKET-100");
  });

  it("default and compact sizes render the identical text content", () => {
    render(<ParentKeyChip parentKey="TICKET-100" size="default" />);
    const defaultText = container.textContent;

    render(<ParentKeyChip parentKey="TICKET-100" size="compact" />);
    const compactText = container.textContent;

    expect(compactText).toBe(defaultText);
  });
});
