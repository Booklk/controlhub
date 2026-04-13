import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 transition-all duration-200",
  {
    variants: {
      variant: {
        default:
          "bg-amber-500 text-slate-900 shadow-lg shadow-amber-500/25 hover:bg-amber-400 hover:shadow-xl hover:shadow-amber-500/30 active:scale-[0.98]",
        destructive:
          "bg-red-600 text-white shadow-lg shadow-red-600/25 hover:bg-red-500 hover:shadow-xl",
        outline:
          "border-2 border-slate-600 text-slate-200 bg-transparent hover:border-amber-500/50 hover:text-white hover:bg-slate-800/50",
        secondary: 
          "bg-slate-700 text-slate-200 border border-slate-600 hover:bg-slate-600 hover:text-white",
        ghost: 
          "text-slate-300 hover:text-white hover:bg-slate-800/50",
        gold: 
          "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-900 shadow-lg shadow-amber-500/30 hover:from-amber-400 hover:to-amber-500 hover:shadow-xl hover:shadow-amber-500/40 active:scale-[0.98] font-bold",
        goldOutline: 
          "border-2 border-amber-500 text-amber-500 bg-transparent hover:bg-amber-500/10 hover:text-amber-400",
        navy: 
          "bg-gradient-to-r from-slate-800 to-slate-900 text-white border border-slate-700 shadow-lg shadow-slate-900/50 hover:from-slate-700 hover:to-slate-800 font-bold",
        navyOutline: 
          "border-2 border-slate-700 text-slate-300 bg-transparent hover:bg-slate-800/50 hover:text-white hover:border-slate-600",
      },
      size: {
        default: "min-h-11 px-6 py-2.5",
        sm: "min-h-9 rounded-md px-4 text-xs",
        lg: "min-h-12 rounded-lg px-10 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
