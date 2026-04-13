import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[100px] w-full rounded-lg px-4 py-3 text-base transition-all duration-200",
        "bg-slate-800/80 border-2 border-slate-600/50",
        "text-white placeholder:text-slate-400",
        "hover:border-amber-500/50 hover:bg-slate-800",
        "focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:bg-slate-900",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "resize-none",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
