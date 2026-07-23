import { FC, HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export const Skeleton: FC<HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => <div className={cn("animate-pulse rounded-md bg-slate-200", className)} {...props} />;
