import { Button } from "./button";
import { ChevronLeftIcon } from "@radix-ui/react-icons";
import {
  AllHTMLAttributes,
  FC,
  HTMLAttributes,
  MouseEventHandler,
  ReactNode,
} from "react";

import { cn } from "@/lib/utils";

type ScreenProps = AllHTMLAttributes<HTMLDivElement>;

type ScreenHeaderProps = Omit<HTMLAttributes<HTMLElement>, "title"> & {
  title?: ReactNode;
  subtitle?: ReactNode;
  onBack?: MouseEventHandler<HTMLButtonElement>;
  backLabel?: string;
  trailing?: ReactNode;
};

type ScreenTitleProps = AllHTMLAttributes<HTMLHeadingElement>;

type ScreenContentProps = AllHTMLAttributes<HTMLDivElement>;

export const Screen: FC<ScreenProps> = ({ children, className, ...props }) => {
  return (
    <div
      {...props}
      className={cn(
        "fixed inset-0 flex min-h-0 min-w-0 flex-col overflow-hidden bg-background",
        className
      )}
    >
      {children}
    </div>
  );
};

export const ScreenHeader: FC<ScreenHeaderProps> = ({
  children,
  className,
  title,
  subtitle,
  onBack,
  backLabel = "Geri dön",
  trailing,
  ...props
}) => {
  const resolvedTitle = title ?? children;

  return (
    <header
      {...props}
      className={cn(
        "flex h-[var(--panel-header-height)] max-h-[var(--panel-header-height)] min-h-[var(--panel-header-height)] min-w-0 items-center border-b border-border bg-card px-2",
        className
      )}
    >
      {onBack && (
        <Button
          type="button"
          onClick={onBack}
          size="header"
          variant="ghost"
          aria-label={backLabel}
          className="mr-1 shrink-0"
        >
          <ChevronLeftIcon className="size-5" aria-hidden="true" />
        </Button>
      )}
      <div className={cn("min-w-0 flex-1", !onBack && "pl-2")}>
        <div className="min-w-0 truncate text-left leading-5">{resolvedTitle}</div>
        {subtitle !== undefined && (
          <div className="min-w-0 truncate text-left text-xs text-muted-foreground">
            {subtitle}
          </div>
        )}
      </div>
      {trailing !== undefined && (
        <div className="ml-2 flex shrink-0 items-center">{trailing}</div>
      )}
    </header>
  );
};

export const ScreenTitle: FC<ScreenTitleProps> = ({
  children,
  className,
  ...props
}) => {
  return (
    <h1
      {...props}
      className={cn("truncate text-base font-semibold leading-5", className)}
    >
      {children}
    </h1>
  );
};

export const ScreenContent: FC<ScreenContentProps> = ({
  children,
  className,
  ...props
}) => {
  return (
    <div
      {...props}
      className={cn(
        "min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden",
        className
      )}
    >
      {children}
    </div>
  );
};
