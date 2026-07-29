import { act } from "react";
import { Root, createRoot } from "react-dom/client";

import { Button } from "@/components/ui/button";
import {
  Screen,
  ScreenContent,
  ScreenHeader,
  ScreenTitle,
} from "@/components/ui/screen";

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("shared inbox shell", () => {
  it("uses one semantic 48px header with labelled leading and trailing actions", () => {
    act(() => {
      root.render(
        <Screen>
          <ScreenHeader
            title={<ScreenTitle>Yeni Görüşme</ScreenTitle>}
            subtitle="Alıcı · Konu"
            onBack={jest.fn()}
            backLabel="Görüşme listesine dön"
            trailing={<Button aria-label="Görüşme seçenekleri">Menü</Button>}
          />
          <ScreenContent>İçerik</ScreenContent>
        </Screen>
      );
    });

    const header = container.querySelector("header");
    expect(header?.className).toContain("h-[var(--panel-header-height)]");
    expect(header?.textContent).toContain("Yeni Görüşme");
    expect(header?.textContent).toContain("Alıcı · Konu");
    expect(
      container.querySelector('[aria-label="Görüşme listesine dön"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[aria-label="Görüşme seçenekleri"]')
    ).not.toBeNull();
  });

  it("keeps shell content width-safe and every button variant at least 44px", () => {
    act(() => {
      root.render(
        <Screen data-testid="screen">
          <ScreenHeader title="Yan Görüşmeler" />
          <ScreenContent data-testid="content">
            <Button>Gönder</Button>
            <Button size="sm">Tekrar dene</Button>
            <Button size="icon" aria-label="Menü" />
          </ScreenContent>
        </Screen>
      );
    });

    expect(
      container.querySelector('[data-testid="screen"]')?.className
    ).toContain("overflow-hidden");
    expect(
      container.querySelector('[data-testid="content"]')?.className
    ).toContain("overflow-x-hidden");
    container.querySelectorAll("button").forEach((button) => {
      expect(button.className).toContain("min-h-[var(--interactive-target)]");
      expect(button.className).toContain("focus-visible:ring-2");
    });
  });
});
