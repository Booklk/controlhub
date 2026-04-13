import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-lg px-4 py-3 text-base transition-all duration-200",
          "bg-slate-800/80 border-2 border-slate-600/50",
          "text-white placeholder:text-slate-400",
          "hover:border-amber-500/50 hover:bg-slate-800",
          "focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:bg-slate-900",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-white",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
