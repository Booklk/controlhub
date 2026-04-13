import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sun, AlertTriangle, Clock, CheckCircle2, Ticket,
  ChevronLeft, Target, Users, TrendingUp, Flame,
  Calendar, Star, Shield, Server, Database, Headphones,
  ArrowRight, Briefcase, FileText, Zap
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MyDayData {
  stats: {
    overdue: number; dueToday: number; upcoming: number;
    completedToday: number; openTickets: number;
    pendingApprovals: number; productivity: number;
    openIncidents?: number; downServers?: number;
    pendingDSR?: number; slaBreaches?: number;
    activeProjects?: number; criticalTickets?: number;
    pendingReferrals?: number; criticalVulns?: number;
  };
  overdueTasks: any[]; dueTodayTasks: any[];
  upcomingTasks: any[]; myTickets: any[];
  pendingApprovals: any[];
}

interface MyDayWidgetProps {
  portal?: string;
  className?: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'text-red-300', critical: 'text-red-400', high: 'text-orange-400',
  medium: 'text-amber-400', low: 'text-slate-400',
};

const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'عاجلة', critical: 'حرجة', high: 'عالية', medium: 'متوسطة', low: 'منخفضة',
};

const PORTAL_FOCUS: Record<string, { icon: any; label: string; color: string; statKey: string }> = {
  cybersecurity: { icon: Shield, label: 'حوادث أمنية', color: 'text-red-400', statKey: 'openIncidents' },
  infrastructure: { icon: Server, label: 'خوادم متوقفة', color: 'text-red-400', statKey: 'downServers' },
  dmo: { icon: Database, label: 'طلبات DSR', color: 'text-purple-400', statKey: 'pendingDSR' },
  support: { icon: Headphones, label: 'تذاكر SLA حرجة', color: 'text-orange-400', statKey: 'slaBreaches' },
  digital_transformation: { icon: Briefcase, label: 'مشاريع نشطة', color: 'text-indigo-400', statKey: 'activeProjects' },
};

const PORTAL_MOTIVATIONS: Record<string, string[]> = {
  cybersecurity: ['حماية المنظمة تبدأ منك', 'خط الدفاع الأول يعتمد عليك', 'أمن المعلومات في يديك'],
  infrastructure: ['البنية التحتية أساس العمل', 'استقرار الأنظمة مسؤوليتك', 'خوادمنا تعتمد عليك'],
  dmo: ['البيانات ثروة النادي', 'حوكمة البيانات تبني الثقة', 'الامتثال يحمي المنظمة'],
  support: ['رضا المستخدم هدفنا', 'كل تذكرة فرصة لخدمة أفضل', 'الاستجابة السريعة مفتاح النجاح'],
  digital_transformation: ['الابتكار يقود المستقبل', 'التحول الرقمي رحلة مستمرة', 'كل مشروع خطوة للأمام'],
  it_director: ['القيادة الفعالة تصنع الفرق', 'رؤيتك الشاملة تقود الأقسام', 'الإشراف الذكي يحقق النتائج'],
  admin: ['النظام يعمل بكفاءة بفضلك', 'إدارتك تحافظ على الاستقرار', 'التحكم الشامل بين يديك'],
  committee: ['قراراتك تشكّل المستقبل', 'صوتك يحدث فرقاً', 'اللجنة تعتمد على حكمتك'],
};

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'صباح الخير';
  if (h < 17) return 'مساء الخير';
  return 'مساء النور';
}

function getProductivityLabel(pct: number): string {
  if (pct >= 80) return 'ممتاز';
  if (pct >= 60) return 'جيد';
  if (pct >= 40) return 'مقبول';
  if (pct > 0) return 'ابدأ يومك';
  return 'لا توجد مهام لليوم';
}

function getMotivation(portal: string): string {
  const msgs = PORTAL_MOTIVATIONS[portal] || PORTAL_MOTIVATIONS.admin;
  return msgs[Math.floor(Math.random() * msgs.length)];
}

export default function MyDayWidget({ portal = '', className }: MyDayWidgetProps) {
  const [, setLocation] = useLocation();
  const { data, isLoading } = useQuery<MyDayData>({
    queryKey: ['/api/my-day'],
    refetchInterval: 10 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
  });

  const getPortalBase = (p: string) => {
    if (p === 'it_director') return '/it-director';
    if (p === 'infrastructure') return '/department/infrastructure';
    if (p === 'cybersecurity') return '/department/cybersecurity';
    if (p === 'digital_transformation') return '/department/digital-transformation';
    if (p === 'support') return '/department/support';
    if (p === 'dmo') return '/dmo';
    if (p === 'employee') return '/employee';
    return '/admin';
  };
  const base = getPortalBase(portal);
  const plannerUrl = `${base}/planner`;
  const ticketsUrl = `${base}/tickets`;

  if (isLoading) {
    return (
      <Card className={cn("border-border/50", className)}>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const { stats, overdueTasks, dueTodayTasks, myTickets, pendingApprovals } = data;
  const today = new Date().toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long' });
  const portalFocus = PORTAL_FOCUS[portal];

  const accentColor = portal === 'cybersecurity' ? 'from-red-500' :
    portal === 'infrastructure' ? 'from-green-500' :
    portal === 'dmo' ? 'from-teal-500' :
    portal === 'support' ? 'from-orange-500' :
    portal === 'digital_transformation' ? 'from-indigo-500' :
    'from-[hsl(43_74%_49%)]';

  return (
    <Card className={cn("border-border/50 bg-card/50 overflow-hidden", className)} data-testid="my-day-widget">
      <div className={cn("h-0.5 bg-gradient-to-l via-amber-400 to-transparent", accentColor)} />
      <CardHeader className="pb-3 pt-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Sun className="w-4 h-4 text-amber-400" />
              <CardTitle className="text-sm font-semibold text-foreground">{getGreeting()}</CardTitle>
            </div>
            <p className="text-[11px] text-muted-foreground">{today}</p>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5 italic">{getMotivation(portal)}</p>
          </div>
          {stats.productivity > 0 && (
            <div className="text-center">
              <div className={cn(
                "text-lg font-bold tabular-nums",
                stats.productivity >= 80 ? 'text-emerald-400' :
                stats.productivity >= 50 ? 'text-amber-400' : 'text-slate-400'
              )}>
                {stats.productivity}%
              </div>
              <div className="text-[9px] text-muted-foreground">{getProductivityLabel(stats.productivity)}</div>
            </div>
          )}
        </div>
        {stats.completedToday > 0 && (
          <div className="mt-2">
            <div className="flex justify-between items-center mb-1 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> إنجاز اليوم</span>
              <span>{stats.completedToday} مهمة منجزة</span>
            </div>
            <Progress value={stats.productivity} className="h-1" />
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        <div className={cn("grid gap-2", portalFocus ? "grid-cols-4" : "grid-cols-3")}>
          {[
            { label: 'متأخرة', value: stats.overdue, color: stats.overdue > 0 ? 'text-red-400' : 'text-muted-foreground', bg: stats.overdue > 0 ? 'bg-red-500/10' : 'bg-muted/30', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
            { label: 'اليوم', value: stats.dueToday, color: stats.dueToday > 0 ? 'text-amber-400' : 'text-muted-foreground', bg: stats.dueToday > 0 ? 'bg-amber-500/10' : 'bg-muted/30', icon: <Target className="w-3.5 h-3.5" /> },
            { label: 'تذاكر', value: stats.openTickets, color: stats.openTickets > 0 ? 'text-blue-400' : 'text-muted-foreground', bg: 'bg-muted/30', icon: <Ticket className="w-3.5 h-3.5" /> },
          ].map(({ label, value, color, bg, icon }) => (
            <div key={label} className={cn("rounded-lg p-2 text-center", bg)}>
              <div className={cn("flex justify-center mb-1", color)}>{icon}</div>
              <div className={cn("text-lg font-bold tabular-nums leading-none", color)}>{value}</div>
              <div className="text-[9px] text-muted-foreground mt-0.5">{label}</div>
            </div>
          ))}
          {portalFocus && (
            <div className="rounded-lg p-2 text-center bg-muted/30">
              <div className={cn("flex justify-center mb-1", portalFocus.color)}>
                <portalFocus.icon className="w-3.5 h-3.5" />
              </div>
              <div className={cn("text-lg font-bold tabular-nums leading-none", portalFocus.color)}>
                {(stats as any)[portalFocus.statKey] || 0}
              </div>
              <div className="text-[9px] text-muted-foreground mt-0.5">{portalFocus.label}</div>
            </div>
          )}
        </div>

        {overdueTasks.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Flame className="w-3.5 h-3.5 text-red-400" />
              <span className="text-xs font-medium text-red-400">مهام متأخرة ({overdueTasks.length})</span>
            </div>
            <div className="space-y-1">
              {overdueTasks.slice(0, 3).map(task => (
                <div key={task.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-red-500/5 border border-red-500/10 cursor-pointer hover:bg-red-500/10 transition-colors"
                  onClick={() => setLocation(plannerUrl)}
                  data-testid={`my-day-overdue-${task.id}`}
                >
                  <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
                  <span className="text-xs truncate flex-1">{task.title}</span>
                  {task.priority && (
                    <span className={cn("text-[9px] font-medium shrink-0", PRIORITY_COLORS[task.priority])}>
                      {PRIORITY_LABELS[task.priority] || task.priority}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {dueTodayTasks.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Star className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-medium text-amber-400">مهام اليوم ({dueTodayTasks.length})</span>
            </div>
            <div className="space-y-1">
              {dueTodayTasks.slice(0, 3).map(task => (
                <div key={task.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-amber-500/5 border border-amber-500/10 cursor-pointer hover:bg-amber-500/10 transition-colors"
                  onClick={() => setLocation(plannerUrl)}
                  data-testid={`my-day-today-${task.id}`}
                >
                  <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                  <span className="text-xs truncate flex-1">{task.title}</span>
                  {task.priority && (
                    <span className={cn("text-[9px] font-medium shrink-0", PRIORITY_COLORS[task.priority])}>
                      {PRIORITY_LABELS[task.priority] || task.priority}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {myTickets.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Ticket className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xs font-medium text-blue-400">تذاكري المفتوحة ({myTickets.length})</span>
            </div>
            <div className="space-y-1">
              {myTickets.slice(0, 2).map(ticket => (
                <div key={ticket.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-blue-500/5 border border-blue-500/10 cursor-pointer hover:bg-blue-500/10 transition-colors"
                  onClick={() => setLocation(ticketsUrl)}
                  data-testid={`my-day-ticket-${ticket.id}`}
                >
                  <Ticket className="w-3 h-3 text-blue-400 shrink-0" />
                  <span className="text-xs truncate flex-1">#{ticket.id} {ticket.title}</span>
                  <span className={cn("text-[9px] font-medium shrink-0", PRIORITY_COLORS[ticket.priority || 'medium'])}>
                    {PRIORITY_LABELS[ticket.priority || 'medium']}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {pendingApprovals.length > 0 && (
          <div className="flex items-center gap-2 px-2 py-2 rounded-md bg-purple-500/10 border border-purple-500/20 cursor-pointer hover:bg-purple-500/15 transition-colors"
            onClick={() => setLocation(plannerUrl)}
            data-testid="my-day-approvals"
          >
            <Users className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span className="text-xs text-purple-300">
              {pendingApprovals.length} {pendingApprovals.length === 1 ? 'مهمة تنتظر موافقتك' : 'مهام تنتظر موافقتك'}
            </span>
            <ChevronLeft className="w-3.5 h-3.5 text-purple-400 mr-auto" />
          </div>
        )}

        {stats.overdue === 0 && stats.dueToday === 0 && stats.openTickets === 0 && stats.pendingApprovals === 0 && (
          <div className="text-center py-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-70" />
            <p className="text-xs text-muted-foreground">يومك خالٍ من المهام المتأخرة</p>
            <p className="text-[10px] text-muted-foreground/50 mt-0.5">عمل ممتاز!</p>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button size="sm" variant="outline" className="flex-1 h-7 text-xs"
            onClick={() => setLocation(plannerUrl)}
            data-testid="my-day-goto-planner">
            <Calendar className="w-3 h-3 ml-1" />
            لوحة المهام
          </Button>
          {stats.openTickets > 0 && (
            <Button size="sm" variant="outline" className="flex-1 h-7 text-xs"
              onClick={() => setLocation(ticketsUrl)}
              data-testid="my-day-goto-tickets">
              <Ticket className="w-3 h-3 ml-1" />
              تذاكري
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
