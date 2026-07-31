import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

// Modeled on button.tsx's cva+cn convention (NOT the current shadcn CLI,
// which now targets Base UI — see 01-RESEARCH.md Alternatives Considered).
// Colors per 01-UI-SPEC.md: amber = new reply, emerald = awaiting reply,
// slate = closed. `font-semibold` follows the two-weight type budget.
// `file` (04-UI-SPEC.md §4) is a neutral, non-semantic pill shape for the
// attachment chip shell — deliberately distinct from the three status-pill
// colors above (a chip's state is never color-only, per the project's
// existing "color never carries meaning alone" rule).
const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
  {
    variants: {
      variant: {
        "new-reply": "bg-amber-100 text-amber-800",
        "awaiting-reply": "bg-emerald-100 text-emerald-800",
        closed: "bg-slate-100 text-slate-600",
        file: "border border-border bg-muted text-foreground",
      },
    },
    defaultVariants: { variant: "closed" },
  }
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant,
  ...props
}) => <span className={cn(badgeVariants({ variant }), className)} {...props} />;

export { badgeVariants };
