import { useState, useEffect } from "react";
import { Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SLACountdownProps {
  deadline: string | Date | null | undefined;
  status?: string;
  compact?: boolean;
  className?: string;
}

function formatDuration(ms: number): string {
  if (ms <= 0) return "تجاوز الوقت";
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 48) return `${Math.floor(hours / 24)} أيام`;
  if (hours > 0) return `${hours}س ${minutes}د`;
  return `${minutes} دقيقة`;
}

function getSLAState(ms: number): 'safe' | 'warning' | 'critical' | 'breached' {
  if (ms <= 0) return 'breached';
  if (ms < 3600000) return 'critical';
  if (ms < 14400000) return 'warning';
  return 'safe';
}

export function SLACountdown({ deadline, status, compact = false, className }: SLACountdownProps) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!deadline || status === 'resolved' || status === 'closed') {
      setRemaining(null);
      return;
    }
    const deadlineMs = new Date(deadline).getTime();
    const calc = () => setRemaining(deadlineMs - Date.now());
    calc();
    const interval = setInterval(calc, 30000);
    return () => clearInterval(interval);
  }, [deadline, status]);

  if (!deadline) return null;
  if (status === 'resolved' || status === 'closed') {
    return compact ? null : (
      <span className={cn("inline-flex items-center gap-1 text-xs text-emerald-400", className)}>
        <CheckCircle2 className="w-3 h-3" />
        <span>محلولة</span>
      </span>
    );
  }
  if (remaining === null) return null;

  const state = getSLAState(remaining);
  const label = formatDuration(remaining);

  const stateConfig = {
    safe: { cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", icon: <Clock className="w-3 h-3" /> },
    warning: { cls: "text-amber-400 bg-amber-500/10 border-amber-500/20", icon: <Clock className="w-3 h-3 animate-pulse" /> },
    critical: { cls: "text-red-400 bg-red-500/10 border-red-500/20", icon: <AlertTriangle className="w-3 h-3 animate-bounce" /> },
    breached: { cls: "text-red-500 bg-red-500/15 border-red-500/30", icon: <AlertTriangle className="w-3 h-3" /> },
  }[state];

  if (compact) {
    return (
      <span className={cn(
        "inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border",
        stateConfig.cls, className
      )} data-testid="sla-countdown-compact">
        {stateConfig.icon}
        {state === 'breached' ? 'متأخر' : label}
      </span>
    );
  }

  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-lg border",
      stateConfig.cls, className
    )} data-testid="sla-countdown">
      {stateConfig.icon}
      <span className="font-mono tabular-nums">
        {state === 'breached' ? `تجاوز الـ SLA` : `متبقي: ${label}`}
      </span>
    </div>
  );
}

export function SLAProgressBar({ deadline, className }: { deadline: string | Date | null | undefined; className?: string }) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [total, setTotal] = useState<number>(0);

  useEffect(() => {
    if (!deadline) return;
    const deadlineMs = new Date(deadline).getTime();
    const estimate = 8 * 3600000;
    setTotal(estimate);
    const calc = () => setRemaining(deadlineMs - Date.now());
    calc();
    const interval = setInterval(calc, 30000);
    return () => clearInterval(interval);
  }, [deadline]);

  if (!deadline || remaining === null) return null;
  const progress = Math.max(0, Math.min(100, (remaining / total) * 100));
  const state = getSLAState(remaining);

  const barColor = {
    safe: 'bg-emerald-500',
    warning: 'bg-amber-500',
    critical: 'bg-red-500',
    breached: 'bg-red-600',
  }[state];

  return (
    <div className={cn("w-full", className)} data-testid="sla-progress-bar">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px] text-muted-foreground">SLA</span>
        <SLACountdown deadline={deadline} compact />
      </div>
      <div className="h-1 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-1000", barColor)}
          style={{ width: `${state === 'breached' ? 100 : progress}%` }}
        />
      </div>
    </div>
  );
}
