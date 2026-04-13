import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingDown, TrendingUp, Timer, Rocket, BarChart3 } from "lucide-react";
import { AnimatedNumber } from "@/components/AnimatedNumber";

interface BurndownWeek {
  week: string;
  created: number;
  completed: number;
  remaining: number;
  velocity: number;
}

interface BurndownData {
  weeks: BurndownWeek[];
  avgVelocity: number;
  totalRemaining: number;
  estimatedWeeks: number | null;
}

interface Props {
  data: BurndownData | undefined;
  isLoading: boolean;
}

export default function BurndownChart({ data, isLoading }: Props) {
  const chartPoints = useMemo(() => {
    if (!data?.weeks?.length) return null;
    const maxVal = Math.max(...data.weeks.map(w => Math.max(w.remaining, w.created, w.completed)), 1);
    const width = 100;
    const height = 100;
    const padding = 5;
    const usableW = width - padding * 2;
    const usableH = height - padding * 2;
    const step = usableW / Math.max(data.weeks.length - 1, 1);

    const remainingPath = data.weeks.map((w, i) => {
      const x = padding + i * step;
      const y = padding + usableH - (w.remaining / maxVal) * usableH;
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    }).join(' ');

    const completedPath = data.weeks.map((w, i) => {
      const x = padding + i * step;
      const y = padding + usableH - (w.completed / maxVal) * usableH;
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    }).join(' ');

    const createdPath = data.weeks.map((w, i) => {
      const x = padding + i * step;
      const y = padding + usableH - (w.created / maxVal) * usableH;
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    }).join(' ');

    const areaPath = remainingPath + ` L${padding + (data.weeks.length - 1) * step},${padding + usableH} L${padding},${padding + usableH} Z`;

    return { remainingPath, completedPath, createdPath, areaPath, maxVal, step, padding, usableH, usableW, height, width };
  }, [data]);

  if (isLoading) {
    return (
      <div className="space-y-4 p-4" data-testid="burndown-loading">
        <div className="h-48 bg-card/50 border border-white/5 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!data?.weeks?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground" data-testid="burndown-empty">
        <BarChart3 className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-lg font-medium">لا توجد بيانات كافية</p>
        <p className="text-sm opacity-60">أنشئ مهام وأكمل بعضها لرؤية مخطط الاحتراق</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6" data-testid="burndown-chart">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-violet-500/10 to-violet-600/5 border-violet-500/10">
          <CardContent className="p-4 text-center">
            <Rocket className="w-5 h-5 text-violet-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-violet-300"><AnimatedNumber value={data.avgVelocity} /></p>
            <p className="text-[11px] text-violet-400/60">سرعة أسبوعية</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-sky-500/10 to-sky-600/5 border-sky-500/10">
          <CardContent className="p-4 text-center">
            <TrendingDown className="w-5 h-5 text-sky-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-sky-300"><AnimatedNumber value={data.totalRemaining} /></p>
            <p className="text-[11px] text-sky-400/60">مهام متبقية</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/10">
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-emerald-300">
              <AnimatedNumber value={data.weeks.reduce((s, w) => s + w.completed, 0)} />
            </p>
            <p className="text-[11px] text-emerald-400/60">مُنجزة (8 أسابيع)</p>
          </CardContent>
        </Card>
        <Card className={`bg-gradient-to-br ${data.estimatedWeeks !== null ? 'from-amber-500/10 to-amber-600/5 border-amber-500/10' : 'from-slate-500/10 to-slate-600/5 border-slate-500/10'}`}>
          <CardContent className="p-4 text-center">
            <Timer className={`w-5 h-5 mx-auto mb-1 ${data.estimatedWeeks !== null ? 'text-amber-400' : 'text-slate-400'}`} />
            <p className={`text-2xl font-bold ${data.estimatedWeeks !== null ? 'text-amber-300' : 'text-slate-300'}`}>
              {data.estimatedWeeks !== null ? `${data.estimatedWeeks} أسابيع` : '—'}
            </p>
            <p className="text-[11px] text-muted-foreground/60">التقدير المتوقع للإنهاء</p>
          </CardContent>
        </Card>
      </div>

      {chartPoints && (
        <Card className="bg-card/80 border-white/5 overflow-hidden">
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              مخطط الاحتراق — آخر 8 أسابيع
            </h3>
            <div className="relative aspect-[2.5/1]">
              <svg viewBox={`0 0 ${chartPoints.width} ${chartPoints.height}`} className="w-full h-full" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="burndownGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(250 70% 60%)" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="hsl(250 70% 60%)" stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                <path d={chartPoints.areaPath} fill="url(#burndownGrad)" />
                <path d={chartPoints.remainingPath} fill="none" stroke="hsl(250 70% 60%)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d={chartPoints.completedPath} fill="none" stroke="hsl(142 70% 45%)" strokeWidth="1.5" strokeDasharray="4 2" strokeLinecap="round" />
                <path d={chartPoints.createdPath} fill="none" stroke="hsl(38 90% 55%)" strokeWidth="1.5" strokeDasharray="2 2" strokeLinecap="round" />
                {data.weeks.map((w, i) => {
                  const x = chartPoints.padding + i * chartPoints.step;
                  const y = chartPoints.padding + chartPoints.usableH - (w.remaining / chartPoints.maxVal) * chartPoints.usableH;
                  return <circle key={i} cx={x} cy={y} r="2.5" fill="hsl(250 70% 60%)" className="drop-shadow" />;
                })}
              </svg>
            </div>
            <div className="flex justify-between mt-2 text-[9px] text-muted-foreground/50 px-1">
              {data.weeks.map((w, i) => <span key={i}>{w.week}</span>)}
            </div>
            <div className="flex items-center gap-5 mt-3 text-[10px] text-muted-foreground/70 justify-center">
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-violet-500 rounded" />المتبقية</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-emerald-500 rounded border-dashed" />المُنجزة</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-amber-500 rounded" />الجديدة</span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-2">
        {data.weeks.slice().reverse().map((week, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-card/40 border border-white/5 hover:bg-card/60 transition-colors">
            <span className="text-xs font-medium text-muted-foreground w-20 shrink-0">{week.week}</span>
            <div className="flex-1 grid grid-cols-3 gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-xs">{week.created} جديدة</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-xs">{week.completed} مُنجزة</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-violet-500" />
                <span className="text-xs">{week.remaining} متبقية</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
