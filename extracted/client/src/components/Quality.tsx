import type { LucideIcon } from "lucide-react";
import { Search, Plus, RefreshCw, TrendingUp, TrendingDown, Minus, Inbox, FileSearch, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ─── PageHeader ───────────────────────────────────────────────────────────────
interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  badges?: React.ReactNode;
  className?: string;
}

export function PageHeader({ icon: Icon, title, subtitle, actions, badges, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-start gap-4 mb-6", className)}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-11 h-11 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-accent" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-foreground leading-tight">{title}</h1>
            {badges}
          </div>
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5 leading-snug">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

// ─── KpiCard ──────────────────────────────────────────────────────────────────
interface KpiCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  color?: "navy" | "gold" | "success" | "danger" | "info" | "muted";
  trend?: "up" | "down" | "stable";
  trendLabel?: string;
  sublabel?: string;
  onClick?: () => void;
  active?: boolean;
  "data-testid"?: string;
}

const KPI_VARIANTS: Record<string, { wrapper: string; iconBox: string; iconColor: string; value: string; bar: string }> = {
  navy:    { wrapper: "border-primary/15 hover:border-primary/35 hover:shadow-[0_4px_20px_-4px_hsl(var(--primary)/0.18)]",          iconBox: "bg-primary/8 dark:bg-primary/20",    iconColor: "text-primary",              value: "text-primary",                          bar: "bg-primary/20" },
  gold:    { wrapper: "border-accent/20 hover:border-accent/45 hover:shadow-[0_4px_20px_-4px_hsl(var(--accent)/0.2)]",              iconBox: "bg-accent/10",                       iconColor: "text-accent",               value: "text-amber-700 dark:text-amber-400",    bar: "bg-accent/20" },
  success: { wrapper: "border-emerald-500/20 hover:border-emerald-500/40 hover:shadow-[0_4px_20px_-4px_rgba(16,185,129,0.15)]",     iconBox: "bg-emerald-500/10",                  iconColor: "text-emerald-600",          value: "text-emerald-700 dark:text-emerald-400",bar: "bg-emerald-500/20" },
  danger:  { wrapper: "border-red-500/20 hover:border-red-500/40 hover:shadow-[0_4px_20px_-4px_rgba(239,68,68,0.15)]",             iconBox: "bg-red-500/10",                      iconColor: "text-red-600",              value: "text-red-700 dark:text-red-400",        bar: "bg-red-500/20" },
  info:    { wrapper: "border-sky-500/20 hover:border-sky-500/40 hover:shadow-[0_4px_20px_-4px_rgba(14,165,233,0.15)]",            iconBox: "bg-sky-500/10",                      iconColor: "text-sky-600",              value: "text-sky-700 dark:text-sky-400",        bar: "bg-sky-500/20" },
  muted:   { wrapper: "border-border hover:border-muted-foreground/25",                                                             iconBox: "bg-muted",                           iconColor: "text-muted-foreground",     value: "text-muted-foreground",                 bar: "bg-muted" },
};

export function KpiCard({
  label, value, icon: Icon, color = "navy", trend, trendLabel, sublabel, onClick, active, "data-testid": testId,
}: KpiCardProps) {
  const v = KPI_VARIANTS[color];
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendCls = trend === "up" ? "text-emerald-600 dark:text-emerald-400" : trend === "down" ? "text-red-500 dark:text-red-400" : "text-muted-foreground";

  return (
    <div
      className={cn(
        "bg-card rounded-xl border p-4 flex flex-col gap-1.5 transition-all duration-200 group relative overflow-hidden",
        v.wrapper,
        active && "ring-2 ring-accent/40 border-accent/40 shadow-[0_0_0_3px_hsl(var(--accent)/0.12)]",
        onClick && "cursor-pointer hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] select-none"
      )}
      onClick={onClick}
      data-testid={testId}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={cn(
          "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200",
          v.iconBox,
          onClick && "group-hover:scale-110"
        )}>
          <Icon className={cn("w-4 h-4", v.iconColor)} />
        </div>
        <div className="flex items-center gap-1.5">
          {trend && (
            <span className={cn("flex items-center gap-0.5 text-[11px] font-medium", trendCls)}>
              <TrendIcon className="w-3 h-3" />
              {trendLabel}
            </span>
          )}
          {onClick && (
            <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:-translate-x-0.5" />
          )}
        </div>
      </div>
      <div className={cn("text-2xl font-bold tabular-nums leading-none mt-0.5", v.value)}>{value}</div>
      <div className="text-xs text-muted-foreground leading-tight">{label}</div>
      {sublabel && <div className="text-[11px] text-muted-foreground/70 leading-tight">{sublabel}</div>}
      {onClick && (
        <div className={cn(
          "absolute bottom-0 left-0 right-0 h-0.5 transition-all duration-300 scale-x-0 group-hover:scale-x-100 origin-right",
          v.bar
        )} />
      )}
    </div>
  );
}

// ─── FilterBar ────────────────────────────────────────────────────────────────
interface FilterBarProps {
  search?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  className?: string;
}

export function FilterBar({
  search, onSearchChange, searchPlaceholder = "بحث…", filters, actions, onRefresh, isRefreshing, className,
}: FilterBarProps) {
  return (
    <div className={cn("flex flex-col sm:flex-row gap-2 items-stretch sm:items-center mb-4 flex-wrap", className)}>
      {onSearchChange !== undefined && (
        <div className="relative flex-1 min-w-0 max-w-xs">
          <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="pr-8 h-9 text-sm bg-background"
            data-testid="input-search"
          />
        </div>
      )}
      {filters && <div className="flex items-center gap-2 flex-wrap">{filters}</div>}
      <div className="flex items-center gap-2 ms-auto flex-wrap">
        {actions}
        {onRefresh && (
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={isRefreshing} className="h-9 gap-1.5 text-xs" data-testid="btn-refresh">
            <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")} />
            <span className="hidden sm:inline">تحديث</span>
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────
interface EmptyStateProps {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  compact?: boolean;
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title = "لا توجد بيانات",
  description,
  action,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center text-center",
      compact ? "py-10 gap-3" : "py-20 gap-4",
      className
    )}>
      <div className={cn(
        "rounded-2xl bg-accent/8 border border-accent/15 flex items-center justify-center",
        compact ? "w-12 h-12" : "w-16 h-16"
      )}>
        <Icon className={cn("text-accent", compact ? "w-6 h-6" : "w-8 h-8")} />
      </div>
      <div className="max-w-xs space-y-1">
        <p className={cn("font-semibold text-foreground", compact ? "text-sm" : "text-base")}>{title}</p>
        {description && <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>}
      </div>
      {action}
    </div>
  );
}

// ─── SearchEmptyState — filtered empty state ──────────────────────────────────
export function SearchEmptyState({ query, onClear }: { query: string; onClear?: () => void }) {
  return (
    <EmptyState
      icon={FileSearch}
      title={`لا نتائج لـ "${query}"`}
      description="حاول البحث بكلمات مختلفة أو قم بمسح عوامل التصفية"
      action={onClear && (
        <Button variant="outline" size="sm" onClick={onClear} className="gap-1.5 text-xs">
          مسح البحث
        </Button>
      )}
      compact
    />
  );
}

// ─── TableSkeleton ───────────────────────────────────────────────────────────
interface TableSkeletonProps {
  rows?: number;
  cols?: number;
  className?: string;
}

export function TableSkeleton({ rows = 5, cols = 5, className }: TableSkeletonProps) {
  return (
    <div className={cn("space-y-0 overflow-hidden rounded-xl border border-border", className)}>
      <div className="flex items-center gap-4 px-4 py-3 bg-muted/50 border-b border-border">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className={cn("h-3.5 rounded", i === 0 ? "w-32" : i === cols - 1 ? "w-20 ms-auto" : "w-24")} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className={cn("flex items-center gap-4 px-4 py-3.5 border-b border-border/60 last:border-0", r % 2 === 1 && "bg-muted/20")}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={cn("h-4 rounded", c === 0 ? "w-40" : c === cols - 1 ? "w-16 ms-auto" : "w-28")} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── SectionCard — section wrapper ────────────────────────────────────────────
interface SectionCardProps {
  title?: string;
  subtitle?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  children: React.ReactNode;
  noPadding?: boolean;
  className?: string;
}

export function SectionCard({ title, subtitle, icon: Icon, actions, children, noPadding = false, className }: SectionCardProps) {
  return (
    <div className={cn("bg-card rounded-xl border border-border shadow-sm overflow-hidden", className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-border/60 bg-muted/30">
          <div className="flex items-center gap-2.5">
            {Icon && (
              <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                <Icon className="w-3.5 h-3.5 text-accent" />
              </div>
            )}
            <div>
              {title && <h3 className="text-sm font-semibold text-foreground">{title}</h3>}
              {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn(!noPadding && "p-5")}>{children}</div>
    </div>
  );
}

// ─── AddButton ───────────────────────────────────────────────────────────────
interface AddButtonProps {
  label?: string;
  onClick?: () => void;
  disabled?: boolean;
  "data-testid"?: string;
}

export function AddButton({ label = "إضافة", onClick, disabled, "data-testid": testId }: AddButtonProps) {
  return (
    <Button
      size="sm"
      className="h-9 gap-1.5 text-xs"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId || "btn-add"}
    >
      <Plus className="w-3.5 h-3.5" />
      {label}
    </Button>
  );
}

// ─── InlineStatus badge ──────────────────────────────────────────────────────
interface InlineStatusProps {
  status: string;
  config: Record<string, { label: string; style: string; icon?: LucideIcon }>;
  showIcon?: boolean;
}

export function InlineStatus({ status, config, showIcon = false }: InlineStatusProps) {
  const cfg = config[status] || { label: status, style: "bg-muted text-muted-foreground" };
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border", cfg.style)}>
      {showIcon && Icon && <Icon className="w-3 h-3" />}
      {cfg.label}
    </span>
  );
}

// ─── DataTableRow — semantic table row wrapper ───────────────────────────────
export function DataTable({
  headers,
  children,
  className,
}: {
  headers: { label: string; className?: string }[];
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-border shadow-sm", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 border-b border-border">
            {headers.map((h, i) => (
              <th
                key={i}
                className={cn(
                  "text-right px-4 py-3 text-xs font-semibold text-muted-foreground tracking-wide",
                  h.className
                )}
              >
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">{children}</tbody>
      </table>
    </div>
  );
}
