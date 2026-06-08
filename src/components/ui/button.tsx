import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:pointer-events-none disabled:opacity-40 select-none cursor-default",
  {
    variants: {
      variant: {
        default:
          "bg-brand-600 text-white hover:bg-brand-500 active:scale-[0.97] shadow-sm",
        secondary:
          "bg-slate-100 text-slate-700 hover:bg-slate-200/80 hover:text-slate-900 active:scale-[0.97]",
        ghost:
          "text-slate-500 hover:text-slate-800 hover:bg-slate-100 active:scale-[0.97]",
        destructive:
          "bg-red-50 text-red-600 hover:bg-red-100 active:scale-[0.97]",
        outline:
          "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-800 active:scale-[0.97]",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-7 px-3 text-xs",
        lg: "h-11 px-6 text-base",
        icon: "h-9 w-9",
        "icon-sm": "h-7 w-7",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
