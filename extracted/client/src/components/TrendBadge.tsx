import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrendBadgeProps {
  current: number;
  previous: number;
  higherIsBetter?: boolean;
  suffix?: string;
  className?: string;
  size?: "sm" | "md";
}

export function TrendBadge({
  current,
  previous,
  higherIsBetter = true,
  suffix = "%",
  className,
  size = "sm",
}: TrendBadgeProps) {
  if (previous === 0 && current === 0) return null;

  const diff = previous > 0 ? ((current - previous) / previous) * 100 : 0;
  const absDiff = Math.abs(diff);
  const isUp = diff > 0;
  const isFlat = absDiff < 0.5;

  const isPositive = isFlat ? null : (higherIsBetter ? isUp : !isUp);

  const colorClass = isFlat
    ? "text-muted-foreground/60 bg-muted/30"
    : isPositive
      ? "text-emerald-400 bg-emerald-500/10"
      : "text-red-400 bg-red-500/10";

  const Icon = isFlat ? Minus : isUp ? TrendingUp : TrendingDown;

  const textSize = size === "sm" ? "text-[10px]" : "text-xs";
  const iconSize = size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5";

  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-medium",
      colorClass, textSize, className
    )} data-testid="trend-badge">
      <Icon className={iconSize} />
      {isFlat ? "ثابت" : `${absDiff.toFixed(1)}${suffix}`}
    </span>
  );
}

interface TrendStatProps {
  label: string;
  current: number;
  previous?: number;
  higherIsBetter?: boolean;
  unit?: string;
  suffix?: string;
  icon?: React.ReactNode;
  className?: string;
  valueClassName?: string;
}

export function TrendStat({
  label,
  current,
  previous,
  higherIsBetter = true,
  unit = "",
  suffix = "",
  icon,
  className,
  valueClassName,
}: TrendStatProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-xs text-white/60 flex items-center gap-1.5">
        {icon}{label}
      </p>
      <div className="flex items-end gap-2">
        <p className={cn("text-2xl font-bold text-white", valueClassName)} data-testid={`trend-stat-${label}`}>
          {current}{unit}
          {suffix && <span className="text-xs text-white/60 font-normal mr-0.5">{suffix}</span>}
        </p>
        {previous !== undefined && previous !== null && (
          <TrendBadge
            current={current}
            previous={previous}
            higherIsBetter={higherIsBetter}
            className="mb-0.5"
          />
        )}
      </div>
      {previous !== undefined && previous !== null && (
        <p className="text-[10px] text-white/50">
          السابق: {previous}{unit}
        </p>
      )}
    </div>
  );
}
