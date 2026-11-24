import * as React from "react";
import { cn } from "@/lib/utils";

export type CardTone =
  | 'navy'
  | 'sales'
  | 'blue'
  | 'received'
  | 'green'
  | 'due'
  | 'rose'
  | 'warning'
  | 'amber'
  | 'orange'
  | 'profit'
  | 'purple'
  | 'indigo'
  | 'neutral'
  | 'slate';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  noPadding?: boolean;
  tone?: CardTone;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, noPadding, tone, ...props }, ref) => (
    <div
      ref={ref}
      data-card-tone={tone}
      className={cn(
        "rounded-2xl border border-slate-200 bg-white text-slate-950 shadow-xs",
        noPadding ? "p-0" : "",
        className
      )}
      {...props}
    />
  )
);
Card.displayName = "Card";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-5 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

export { Card, CardContent };
export default Card;

