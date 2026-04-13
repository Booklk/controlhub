import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "whitespace-nowrap inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2" +
  " hover-elevate" ,
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow-xs",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow-xs",
        outline: " border [border-color:var(--badge-outline)] shadow-xs",
        gold: "border-[hsl(43_74%_49%)]/30 bg-[hsl(43_74%_49%)]/15 text-[hsl(43_74%_35%)] dark:text-[hsl(43_74%_60%)]",
        goldSolid: "border-[hsl(43_74%_40%)] bg-[hsl(43_74%_49%)] text-[hsl(222_47%_11%)]",
        navy: "border-[hsl(222_47%_11%)]/30 bg-[hsl(222_47%_11%)]/10 text-[hsl(222_47%_11%)] dark:text-white",
        navySolid: "border-[hsl(222_47%_20%)] bg-[hsl(222_47%_11%)] text-white",
        success: "border-[hsl(43_74%_49%)]/30 bg-[hsl(43_74%_49%)]/10 text-[hsl(43_74%_35%)]",
        pending: "border-[hsl(222_47%_11%)]/20 bg-[hsl(222_47%_11%)]/5 text-[hsl(222_47%_30%)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants }
