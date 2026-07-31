import * as React from "react";

import { Toaster as Sonner } from "sonner";

// Modeled on badge.tsx's plain functional-component/cn-free shadcn-primitive
// convention — no default export, named `Toaster` export only.
//
// Deviates from the shadcn CLI's generated wrapper (04-RESEARCH.md
// §sonner Toast Under CRA): the theme-context dependency the CLI pulls in
// is stripped entirely and `theme` is hardcoded to "light" per CLAUDE.md's
// "her zaman açık tema" (always-light theme) project constraint — there is
// no theme toggle anywhere in this codebase.
//
// Placement/sizing per 04-UI-SPEC.md §7: `position="top-center"`, offset
// below the fixed header (`--panel-header-height` + `--panel-inset` ≈ 64px)
// so it never overlaps ScreenHeader or the bottom-pinned composer. Width
// clamped to the 372px panel. Destructive/error toasts reuse the existing
// inline-alert color language (`border-destructive/30`) rather than
// inventing new toast chrome. `closeButton` keeps a visible dismiss
// affordance — never relies purely on auto-dismiss.
type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = (props: ToasterProps) => (
  <Sonner
    theme="light"
    position="top-center"
    offset="calc(var(--panel-header-height) + var(--panel-inset))"
    closeButton
    className="toaster group"
    toastOptions={{
      classNames: {
        toast:
          "group toast w-[calc(100%-2rem)] max-w-[340px] group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
        description: "group-[.toast]:text-muted-foreground",
        error: "group-[.toast]:border-destructive/30",
        actionButton:
          "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
        cancelButton:
          "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
      },
    }}
    {...props}
  />
);

export { Toaster };
