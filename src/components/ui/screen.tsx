import { Button } from "./button";
import { ChevronLeftIcon } from "@radix-ui/react-icons";
import { AllHTMLAttributes, FC, MouseEventHandler } from "react";

import { cn } from "@/lib/utils";

type ScreenProps = AllHTMLAttributes<HTMLDivElement>;

type ScreenHeaderProps = AllHTMLAttributes<HTMLDivElement> & {
  onBack?: MouseEventHandler<HTMLButtonElement>;
};

type ScreenTitleProps = AllHTMLAttributes<HTMLHeadingElement>;

type ScreenContentProps = AllHTMLAttributes<HTMLDivElement>;

export const Screen: FC<ScreenProps> = ({ children, className, ...props }) => {
  return (
    <div
      {...props}
      className={cn("flex fixed inset-0 flex-col bg-slate-50", className)}
    >
      {children}
    </div>
  );
};

export const ScreenHeader: FC<ScreenHeaderProps> = ({
  children,
  className,
  onBack,
  ...props
}) => {
  return (
    <div
      {...props}
      className={cn(
        "flex gap-4 justify-between items-center px-3 py-2 bg-white shadow backdrop-blur max-h-18 min-h-12",
        className
      )}
    >
      {onBack && (
        <div className="flex-1">
          <Button onClick={onBack} size="icon">
            <ChevronLeftIcon className="size-6" />
          </Button>
        </div>
      )}
      <div className="line-clamp-2 flex-[2] text-center">{children}</div>
      {onBack && <div className="flex-1" />}
    </div>
  );
};

export const ScreenTitle: FC<ScreenTitleProps> = ({
  children,
  className,
  ...props
}) => {
  return (
    <h3 {...props} className={cn("font-medium", className)}>
      {children}
    </h3>
  );
};

export const ScreenContent: FC<ScreenContentProps> = ({
  children,
  className,
  ...props
}) => {
  return (
    <div {...props} className={cn("overflow-y-auto flex-1", className)}>
      {children}
    </div>
  );
};
