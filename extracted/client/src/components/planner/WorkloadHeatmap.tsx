import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle2, Flame, Shield, Zap } from "lucide-react";
import { AnimatedNumber } from "@/components/AnimatedNumber";

interface WorkloadMember {
  name: string;
  total: number;
  urgent: number;
  overdue: number;
  dueThisWeek: number;
  dueNextWeek: number;
  noDate: number;
  byPriority: Record<string, number>;
  healthScore: number;
}

interface Props {
  data: { members: WorkloadMember[] } | undefined;
  isLoading: boolean;
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2);
}

function getHealthColor(score: number) {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-yellow-400';
  if (score >= 40) return 'text-orange-400';
  return 'text-red-400';
}

function getHealthBg(score: number) {
  if (score >= 80) return 'bg-emerald-500/10 border-emerald-500/20';
  if (score >= 60) return 'bg-yellow-500/10 border-yellow-500/20';
  if (score >= 40) return 'bg-orange-500/10 border-orange-500/20';
  return 'bg-red-500/10 border-red-500/20';
}

function getLoadLevel(total: number) {
  if (total <= 3) return { label: 'خفيف', color: 'bg-emerald-500', barColor: 'bg-emerald-500' };
  if (total <= 6) return { label: 'معتدل', color: 'bg-blue-500', barColor: 'bg-blue-500' };
  if (total <= 10) return { label: 'مرتفع', color: 'bg-amber-500', barColor: 'bg-amber-500' };
  return { label: 'مفرط', color: 'bg-red-500', barColor: 'bg-red-500' };
}

function HealthRing({ score, size = 48 }: { score: number; size?: number }) {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#eab308' : score >= 40 ? '#f97316' : '#ef4444';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="currentColor" className="text-white/5" strokeWidth="3" />
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" className="transition-all duration-1000" />
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${getHealthColor(score)}`}>
        {score}
      </span>
    </div>
  );
}

export default function WorkloadHeatmap({ data, isLoading }: Props) {
  const summary = useMemo(() => {
    if (!data?.members?.length) return null;
    const totalTasks = data.members.reduce((s, m) => s + m.total, 0);
    const totalOverdue = data.members.reduce((s, m) => s + m.overdue, 0);
    const avgHealth = Math.round(data.members.reduce((s, m) => s + m.healthScore, 0) / data.members.length);
    const overloaded = data.members.filter(m => m.total > 8).length;
    return { totalTasks, totalOverdue, avgHealth, overloaded, memberCount: data.members.length };
  }, [data]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4" data-testid="workload-loading">
        {[1,2,3,4,5,6].map(i => (
          <Card key={i} className="bg-card/50 border-white/5 animate-pulse">
            <CardContent className="p-4 h-32" />
          </Card>
        ))}
      </div>
    );
  }

  if (!data?.members?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground" data-testid="workload-empty">
        <Shield className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-lg font-medium">لا توجد بيانات أعباء عمل</p>
        <p className="text-sm opacity-60">أنشئ مهام وعيّنها للفريق لرؤية توزيع الأعباء</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6" data-testid="workload-heatmap">
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/10">
            <CardContent className="p-4 text-center">
              <Zap className="w-5 h-5 text-blue-400 mx-auto mb-1" />
              <p className="text-2xl font-bold text-blue-300"><AnimatedNumber value={summary.totalTasks} /></p>
              <p className="text-[11px] text-blue-400/60">مهام نشطة</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/10">
            <CardContent className="p-4 text-center">
              <AlertTriangle className="w-5 h-5 text-red-400 mx-auto mb-1" />
              <p className="text-2xl font-bold text-red-300"><AnimatedNumber value={summary.totalOverdue} /></p>
              <p className="text-[11px] text-red-400/60">متأخرة</p>
            </CardContent>
          </Card>
          <Card className={`bg-gradient-to-br ${summary.avgHealth >= 70 ? 'from-emerald-500/10 to-emerald-600/5 border-emerald-500/10' : 'from-orange-500/10 to-orange-600/5 border-orange-500/10'}`}>
            <CardContent className="p-4 text-center">
              <CheckCircle2 className={`w-5 h-5 mx-auto mb-1 ${summary.avgHealth >= 70 ? 'text-emerald-400' : 'text-orange-400'}`} />
              <p className={`text-2xl font-bold ${summary.avgHealth >= 70 ? 'text-emerald-300' : 'text-orange-300'}`}>{summary.avgHealth}%</p>
              <p className={`text-[11px] ${summary.avgHealth >= 70 ? 'text-emerald-400/60' : 'text-orange-400/60'}`}>صحة الفريق</p>
            </CardContent>
          </Card>
          <Card className={`bg-gradient-to-br ${summary.overloaded > 0 ? 'from-amber-500/10 to-amber-600/5 border-amber-500/10' : 'from-slate-500/10 to-slate-600/5 border-slate-500/10'}`}>
            <CardContent className="p-4 text-center">
              <Flame className={`w-5 h-5 mx-auto mb-1 ${summary.overloaded > 0 ? 'text-amber-400' : 'text-slate-400'}`} />
              <p className={`text-2xl font-bold ${summary.overloaded > 0 ? 'text-amber-300' : 'text-slate-300'}`}>{summary.overloaded}</p>
              <p className="text-[11px] text-muted-foreground/60">عضو بحمل مفرط</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {data.members.map((member) => {
          const load = getLoadLevel(member.total);
          const maxTasks = Math.max(...data.members.map(m => m.total), 1);
          return (
            <Card key={member.name} className={`border ${getHealthBg(member.healthScore)} hover:border-primary/20 transition-all duration-300`} data-testid={`workload-member-${member.name}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <HealthRing score={member.healthScore} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Avatar className="w-7 h-7 border border-white/10">
                        <AvatarFallback className="text-[10px] bg-primary/20 text-primary font-bold">{getInitials(member.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{member.name}</p>
                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${load.color}/10 border-current`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${load.color} ml-1`} />{load.label}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <span className="text-xl font-bold text-foreground/80">{member.total}</span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>حجم العمل</span>
                    <span>{Math.round((member.total / maxTasks) * 100)}%</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${load.barColor} transition-all duration-700`}
                      style={{ width: `${Math.min(100, (member.total / maxTasks) * 100)}%` }} />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  {member.overdue > 0 && (
                    <div className="bg-red-500/10 rounded-md p-1.5">
                      <p className="text-xs font-bold text-red-400">{member.overdue}</p>
                      <p className="text-[9px] text-red-400/60">متأخرة</p>
                    </div>
                  )}
                  {member.dueThisWeek > 0 && (
                    <div className="bg-amber-500/10 rounded-md p-1.5">
                      <p className="text-xs font-bold text-amber-400">{member.dueThisWeek}</p>
                      <p className="text-[9px] text-amber-400/60">هذا الأسبوع</p>
                    </div>
                  )}
                  {member.urgent > 0 && (
                    <div className="bg-orange-500/10 rounded-md p-1.5">
                      <p className="text-xs font-bold text-orange-400">{member.urgent}</p>
                      <p className="text-[9px] text-orange-400/60">عاجلة</p>
                    </div>
                  )}
                  {member.overdue === 0 && member.dueThisWeek === 0 && member.urgent === 0 && (
                    <div className="col-span-3 bg-emerald-500/10 rounded-md p-1.5">
                      <p className="text-[10px] text-emerald-400">✓ لا يوجد ضغط — أداء ممتاز</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
