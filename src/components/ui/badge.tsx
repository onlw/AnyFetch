import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-brand-500/10 text-brand-700 border border-brand-500/20",
        success: "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20",
        warning: "bg-amber-500/10 text-amber-700 border border-amber-500/20",
        error: "bg-red-500/10 text-red-700 border border-red-500/20",
        secondary: "bg-slate-100 text-slate-600 border border-slate-200",
        audio: "bg-purple-500/10 text-purple-700 border border-purple-500/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
