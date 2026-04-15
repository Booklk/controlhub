import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, Clock, CheckCircle2, Ticket, ClipboardList,
  ChevronDown, ChevronUp, ArrowRight, Flame, Target, RefreshCw,
  Calendar, Star, TrendingUp, Zap, ArrowLeftRight, Bell, BellRing,
  CheckSquare, XCircle, Eye, User, Building2, Timer, ShieldAlert,
  Play, RotateCcw, Filter
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface SmartDailyOpsProps {
  portal: string;
  portalLabel: string;
  onNavigate?: (path: string) => void;
  ticketsPath?: string;
  tasksPath?: string;
  referralsPath?: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'text-red-500',
  urgent: 'text-red-500',
  high: 'text-orange-400',
  medium: 'text-yellow-400',
  low: 'text-blue-400',
};
const PRIORITY_LABELS: Record<string, string> = {
  critical: 'حرج', urgent: 'عاجل', high: 'عالي', medium: 'متوسط', low: 'منخفض',
};
const URGENCY_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  unacknowledged: { label: 'لم يُستلم', color: 'text-yellow-400', icon: <BellRing className="w-3 h-3" /> },
  escalated: { label: 'مُصعَّد', color: 'text-red-400', icon: <ShieldAlert className="w-3 h-3" /> },
  sla_breach: { label: 'خرق SLA', color: 'text-orange-400', icon: <Timer className="w-3 h-3" /> },
};

const STATUS_TASK_LABELS: Record<string, string> = {
  pending: 'في الانتظار', assigned: 'مُسند', open: 'مفتوح',
  in_progress: 'جارٍ', review: 'مراجعة', completed: 'مكتمل',
};

export function SmartDailyOps({
  portal, portalLabel, onNavigate, ticketsPath, tasksPath, referralsPath
}: SmartDailyOpsProps) {
  const [expanded, setExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'referrals' | 'mytasks'>('overview');
  const { toast } = useToast();

  const { data: dailyOps, isLoading, refetch, dataUpdatedAt } = useQuery<any>({
    queryKey: ['/api/daily-ops', portal],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/daily-ops/${portal}`);
      return res.json();
    },
    refetchInterval: 8 * 60 * 1000,
    staleTime: 4 * 60 * 1000,
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async (id: number) => { const res = await apiRequest('POST', `/api/it-referrals/${id}/acknowledge`, { note: 'تم تأكيد الاستلام' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/daily-ops', portal] });
      queryClient.invalidateQueries({ queryKey: ['/api/it-referrals'] });
      toast({ title: 'تم تأكيد استلام الإحالة' });
    },
    onError: (error: Error) => toast({ description: error.message, title: 'تعذّر تأكيد الاستلام', variant: 'destructive' }),
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest('PUT', `/api/tasks/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/daily-ops', portal] });
      toast({ title: 'تم تحديث حالة المهمة' });
    },
    onError: (error: Error) => toast({ description: error.message, title: 'تعذّر تحديث الحالة', variant: 'destructive' }),
  });

  const minutesSinceUpdate = useMemo(() => {
    if (!dataUpdatedAt) return 0;
    return Math.floor((Date.now() - dataUpdatedAt) / 60000);
  }, [dataUpdatedAt, dailyOps]);

  if (isLoading || !dailyOps) {
    return (
      <Card className="mb-4">
        <CardHeader className="pb-0 pt-3 px-4 flex flex-row items-center justify-between gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-6 w-6 rounded-full" />
        </CardHeader>
        <CardContent className="pt-3 pb-3 px-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-md bg-muted/30">
                <Skeleton className="w-4 h-4 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-5 w-8" />
                  <Skeleton className="h-2.5 w-16" />
                </div>
              </div>
            ))}
          </div>
          <Skeleton className="h-10 w-full rounded-md" />
          {[1, 2].map(i => <Skeleton key={i} className="h-9 w-full rounded-md" />)}
        </CardContent>
      </Card>
    );
  }

  const { tickets, tasks: taskData, myWork, referrals, performance, completedToday } = dailyOps;
  const urgentTotal = (tickets?.urgent || 0) + (taskData?.overdue || 0);
  const refUrgentTotal = (referrals?.unacknowledged || 0) + (referrals?.escalated || 0) + (referrals?.breachedSla || 0);
  const totalUrgent = urgentTotal + refUrgentTotal;
  const hasUrgent = totalUrgent > 0;

  const score = performance?.overallScore || 0;
  const totalActive = taskData?.active || 0;
  const completed = completedToday || 0;
  const totalGoal = totalActive + completed;
  const goalProgress = totalGoal > 0 ? Math.round((completed / totalGoal) * 100) : 0;

  const getMotivation = (s: number) => {
    if (s >= 90) return { text: 'أداء استثنائي!', icon: <Star className="w-3.5 h-3.5 text-yellow-500" />, color: 'text-emerald-500' };
    if (s >= 70) return { text: 'أداء ممتاز!', icon: <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />, color: 'text-emerald-500' };
    if (s >= 50) return { text: 'في المسار', icon: <Target className="w-3.5 h-3.5 text-blue-500" />, color: 'text-blue-500' };
    return { text: 'يحتاج تركيز', icon: <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />, color: 'text-orange-500' };
  };
  const motivation = getMotivation(score);

  const lastRefresh = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <Card className="mb-4 overflow-visible" data-testid="daily-work-engine">
      <CardHeader className="pb-0 pt-3 px-4 flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Zap className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="text-sm font-semibold text-foreground">محرك العمل اليومي</span>
          {hasUrgent && (
            <Badge variant="destructive" className="text-[10px] px-1.5 animate-pulse">
              {totalUrgent} يتطلب إجراءً
            </Badge>
          )}
          {lastRefresh && (
            <span className="text-[10px] text-muted-foreground/50 hidden sm:inline">{lastRefresh}</span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <Button size="icon" variant="ghost" onClick={() => refetch()} data-testid="button-refresh-ops" className="h-7 w-7">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => setExpanded(!expanded)} data-testid="button-toggle-ops" className="h-7 w-7">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </CardHeader>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardContent className="pt-2 pb-3 px-4 space-y-3">
              {/* KPI Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <KpiCell
                  icon={<Ticket className="w-3.5 h-3.5 text-blue-500" />}
                  label="تذاكر مفتوحة"
                  value={tickets?.open || 0}
                  alert={tickets?.urgent > 0}
                  testId="text-open-tickets"
                  onClick={() => ticketsPath && onNavigate?.(ticketsPath)}
                />
                <KpiCell
                  icon={<ClipboardList className="w-3.5 h-3.5 text-purple-500" />}
                  label="مهام نشطة"
                  value={taskData?.active || 0}
                  testId="text-active-tasks"
                  onClick={() => tasksPath && onNavigate?.(tasksPath)}
                />
                <KpiCell
                  icon={<ArrowLeftRight className="w-3.5 h-3.5 text-amber-500" />}
                  label="إحالات واردة"
                  value={referrals?.pending || 0}
                  alert={refUrgentTotal > 0}
                  alertCount={refUrgentTotal}
                  testId="text-incoming-referrals"
                  onClick={() => referralsPath && onNavigate?.(referralsPath)}
                />
                <KpiCell
                  icon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                  label="مكتمل اليوم"
                  value={completedToday || 0}
                  valueColor={(completedToday || 0) > 0 ? 'text-emerald-500' : undefined}
                  testId="text-completed-today"
                />
              </div>

              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)}>
                <TabsList className="w-full h-8 text-xs grid grid-cols-3">
                  <TabsTrigger value="overview" className="text-[11px] gap-1" data-testid="tab-overview">
                    <Eye className="w-3 h-3" />
                    نظرة عامة
                  </TabsTrigger>
                  <TabsTrigger value="referrals" className="text-[11px] gap-1 relative" data-testid="tab-referrals">
                    <ArrowLeftRight className="w-3 h-3" />
                    الإحالات
                    {refUrgentTotal > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full text-[8px] text-white flex items-center justify-center font-bold">
                        {refUrgentTotal}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="mytasks" className="text-[11px] gap-1 relative" data-testid="tab-mytasks">
                    <User className="w-3 h-3" />
                    مهامي
                    {(myWork?.overdue || 0) > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-orange-500 rounded-full text-[8px] text-white flex items-center justify-center font-bold">
                        {myWork.overdue}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* OVERVIEW TAB */}
              {activeTab === 'overview' && (
                <div className="space-y-2.5">
                  {/* Daily Progress */}
                  <div className="flex items-center gap-3 p-2.5 rounded-md bg-muted/20 border border-muted/40">
                    <Target className="w-4 h-4 text-indigo-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-medium">هدف اليوم: {completed}/{totalGoal}</span>
                        <span className="text-xs tabular-nums font-semibold text-indigo-500">{goalProgress}%</span>
                      </div>
                      <Progress value={goalProgress} className="h-1.5" />
                    </div>
                    <div className={`flex items-center gap-1 shrink-0 text-xs font-medium ${motivation.color}`}>
                      {motivation.icon}
                      <span className="hidden sm:inline">{motivation.text}</span>
                    </div>
                  </div>

                  {/* Dept Performance */}
                  <div className="flex items-center gap-3 p-2.5 rounded-md bg-muted/30">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-xs text-muted-foreground shrink-0">أداء الإدارة</span>
                      <Progress value={score} className="h-1.5 flex-1 max-w-[100px]" />
                      <span className={`text-xs font-semibold tabular-nums ${score >= 80 ? 'text-emerald-500' : score >= 60 ? 'text-yellow-500' : 'text-red-500'}`}>
                        {score}%
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60">
                      <span>تذاكر {performance?.ticketResolutionRate || 0}%</span>
                      <span>مهام {performance?.taskCompletionRate || 0}%</span>
                      <span>إحالات {performance?.referralResponseRate || 0}%</span>
                    </div>
                  </div>

                  {/* Urgent items quick list */}
                  {totalUrgent > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5 text-red-500" />
                        <span className="text-xs font-semibold">يتطلب إجراءً فورياً</span>
                        <Badge variant="destructive" className="text-[10px] px-1.5">{totalUrgent}</Badge>
                      </div>
                      <div className="space-y-1">
                        {tickets?.urgentList?.slice(0, 3).map((t: any) => (
                          <div
                            key={`t-${t.id}`}
                            className="flex items-center justify-between py-1.5 px-2 rounded-md bg-red-500/5 border border-red-500/15 text-xs cursor-pointer hover:bg-red-500/10 transition-colors"
                            onClick={() => ticketsPath && onNavigate?.(ticketsPath)}
                            data-testid={`urgent-ticket-${t.id}`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Ticket className="w-3 h-3 text-red-500 shrink-0" />
                              <span className="truncate">{t.title}</span>
                            </div>
                            <Badge className="text-[10px] shrink-0 bg-red-500/20 text-red-400 border-red-500/30">
                              {PRIORITY_LABELS[t.priority] || t.priority}
                            </Badge>
                          </div>
                        ))}
                        {referrals?.urgentList?.slice(0, 2).map((r: any) => (
                          <div
                            key={`r-${r.id}`}
                            className="flex items-center justify-between py-1.5 px-2 rounded-md bg-amber-500/5 border border-amber-500/15 text-xs cursor-pointer hover:bg-amber-500/10 transition-colors"
                            onClick={() => referralsPath && onNavigate?.(referralsPath)}
                            data-testid={`urgent-referral-${r.id}`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <ArrowLeftRight className="w-3 h-3 text-amber-500 shrink-0" />
                              <span className="truncate">{r.title}</span>
                              <span className="text-muted-foreground/50 shrink-0 text-[10px]">{r.referralNumber}</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {URGENCY_LABELS[r.urgencyReason] && (
                                <span className={`flex items-center gap-0.5 ${URGENCY_LABELS[r.urgencyReason].color}`}>
                                  {URGENCY_LABELS[r.urgencyReason].icon}
                                  <span className="text-[10px]">{URGENCY_LABELS[r.urgencyReason].label}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                        {taskData?.overdueList?.slice(0, 2).map((t: any) => (
                          <div
                            key={`m-${t.id}`}
                            className="flex items-center justify-between py-1.5 px-2 rounded-md bg-orange-500/5 border border-orange-500/15 text-xs cursor-pointer hover:bg-orange-500/10 transition-colors"
                            onClick={() => tasksPath && onNavigate?.(tasksPath)}
                            data-testid={`overdue-task-${t.id}`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Clock className="w-3 h-3 text-orange-500 shrink-0" />
                              <span className="truncate">{t.title}</span>
                            </div>
                            <span className="text-orange-400 shrink-0 text-[10px] font-medium">متأخر</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {totalUrgent === 0 && (
                    <div className="flex items-center gap-2 p-2.5 rounded-md bg-emerald-500/5 border border-emerald-500/15 text-xs text-emerald-500">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>لا توجد بنود عاجلة — الإدارة تعمل بشكل مثالي</span>
                    </div>
                  )}

                  {/* Quick nav buttons */}
                  <div className="flex items-center gap-2 flex-wrap pt-0.5">
                    {ticketsPath && (
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => onNavigate?.(ticketsPath)} data-testid="button-go-tickets">
                        <Ticket className="w-3 h-3" />التذاكر
                        <ArrowRight className="w-3 h-3" />
                      </Button>
                    )}
                    {tasksPath && (
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => onNavigate?.(tasksPath)} data-testid="button-go-tasks">
                        <ClipboardList className="w-3 h-3" />المهام
                        <ArrowRight className="w-3 h-3" />
                      </Button>
                    )}
                    {referralsPath && (
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => onNavigate?.(referralsPath)} data-testid="button-go-referrals">
                        <ArrowLeftRight className="w-3 h-3" />الإحالات
                        <ArrowRight className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* REFERRALS TAB */}
              {activeTab === 'referrals' && (
                <div className="space-y-2">
                  {/* Summary chips */}
                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    <span className="px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">
                      {referrals?.unacknowledged || 0} لم تُستلم
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400">
                      {referrals?.acknowledgedAwaitingAction || 0} بانتظار القرار
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400">
                      {referrals?.active || 0} نشطة
                    </span>
                    {(referrals?.breachedSla || 0) > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400">
                        {referrals.breachedSla} خرق SLA
                      </span>
                    )}
                  </div>

                  {/* Urgent referrals with actions */}
                  {referrals?.urgentList?.length > 0 ? (
                    <div className="space-y-1.5">
                      <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                        <BellRing className="w-3 h-3 text-amber-500" />
                        إحالات تتطلب إجراءً فورياً
                      </p>
                      {referrals.urgentList.map((r: any) => (
                        <ReferralActionCard
                          key={r.id}
                          referral={r}
                          onAcknowledge={() => acknowledgeMutation.mutate(r.id)}
                          onNavigate={() => referralsPath && onNavigate?.(referralsPath)}
                          isPending={acknowledgeMutation.isPending}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-3 rounded-md bg-emerald-500/5 border border-emerald-500/15 text-xs text-emerald-500">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>جميع الإحالات الواردة تمت معالجتها</span>
                    </div>
                  )}

                  {referralsPath && (
                    <Button variant="outline" size="sm" className="w-full h-7 text-xs gap-1" onClick={() => onNavigate?.(referralsPath)} data-testid="button-all-referrals">
                      <ArrowLeftRight className="w-3 h-3" />
                      إدارة جميع الإحالات
                      <ArrowRight className="w-3 h-3 mr-auto" />
                    </Button>
                  )}
                </div>
              )}

              {/* MY TASKS TAB */}
              {activeTab === 'mytasks' && (
                <div className="space-y-2">
                  {/* Summary chips */}
                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    <span className="px-2 py-0.5 rounded-full bg-muted/40 border border-muted/60 text-foreground">
                      {myWork?.total || 0} مهمة نشطة
                    </span>
                    {(myWork?.overdue || 0) > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400">
                        {myWork.overdue} متأخرة
                      </span>
                    )}
                    {(myWork?.dueToday || 0) > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">
                        {myWork.dueToday} مستحقة اليوم
                      </span>
                    )}
                  </div>

                  {/* My task list */}
                  {myWork?.list?.length > 0 ? (
                    <div className="space-y-1.5">
                      {myWork.list.map((t: any) => (
                        <MyTaskCard
                          key={t.id}
                          task={t}
                          onStatusChange={(status) => updateTaskMutation.mutate({ id: t.id, status })}
                          onNavigate={() => tasksPath && onNavigate?.(tasksPath)}
                          isPending={updateTaskMutation.isPending}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-3 rounded-md bg-emerald-500/5 border border-emerald-500/15 text-xs text-emerald-500">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>لا توجد مهام مسندة لك حالياً</span>
                    </div>
                  )}

                  {tasksPath && (
                    <Button variant="outline" size="sm" className="w-full h-7 text-xs gap-1" onClick={() => onNavigate?.(tasksPath)} data-testid="button-all-tasks">
                      <ClipboardList className="w-3 h-3" />
                      إدارة جميع المهام
                      <ArrowRight className="w-3 h-3 mr-auto" />
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

function ReferralActionCard({ referral, onAcknowledge, onNavigate, isPending }: {
  referral: any;
  onAcknowledge: () => void;
  onNavigate: () => void;
  isPending: boolean;
}) {
  const urgency = URGENCY_LABELS[referral.urgencyReason] || URGENCY_LABELS['unacknowledged'];
  const isUnack = referral.urgencyReason === 'unacknowledged';
  const hoursStr = referral.hoursElapsed > 0 ? `منذ ${referral.hoursElapsed}س` : '';

  return (
    <div
      className={`rounded-md border text-xs p-2.5 space-y-1.5 ${
        referral.urgencyReason === 'escalated' ? 'bg-red-500/5 border-red-500/20' :
        referral.urgencyReason === 'sla_breach' ? 'bg-orange-500/5 border-orange-500/20' :
        'bg-amber-500/5 border-amber-500/20'
      }`}
      data-testid={`referral-card-${referral.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <ArrowLeftRight className="w-3 h-3 text-amber-500 shrink-0" />
          <span className="font-medium truncate">{referral.title}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className={`flex items-center gap-0.5 ${urgency.color} text-[10px]`}>
            {urgency.icon}
            {urgency.label}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-muted-foreground text-[10px]">
          <span className="flex items-center gap-0.5">
            <Building2 className="w-2.5 h-2.5" />
            {referral.fromDepartmentName}
          </span>
          {hoursStr && (
            <span className="flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" />
              {hoursStr}
            </span>
          )}
          <span className={`font-medium ${PRIORITY_COLORS[referral.priority] || ''}`}>
            {PRIORITY_LABELS[referral.priority] || referral.priority}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {isUnack && !referral.acknowledgedAt && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px] px-2 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
              onClick={(e) => { e.stopPropagation(); onAcknowledge(); }}
              disabled={isPending}
              data-testid={`button-acknowledge-${referral.id}`}
            >
              <Bell className="w-2.5 h-2.5 ml-0.5" />
              استلام
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[10px] px-2"
            onClick={onNavigate}
            data-testid={`button-view-referral-${referral.id}`}
          >
            <Eye className="w-2.5 h-2.5 ml-0.5" />
            عرض
          </Button>
        </div>
      </div>
    </div>
  );
}

function MyTaskCard({ task, onStatusChange, onNavigate, isPending }: {
  task: any;
  onStatusChange: (status: string) => void;
  onNavigate: () => void;
  isPending: boolean;
}) {
  const nextStatus = task.status === 'pending' || task.status === 'assigned' ? 'in_progress' :
    task.status === 'in_progress' ? 'review' :
    task.status === 'review' ? 'completed' : null;

  const nextStatusLabel = nextStatus === 'in_progress' ? 'ابدأ' :
    nextStatus === 'review' ? 'للمراجعة' :
    nextStatus === 'completed' ? 'أكمل' : null;

  const borderClass = task.isOverdue ? 'bg-red-500/5 border-red-500/20' :
    task.isDueToday ? 'bg-amber-500/5 border-amber-500/20' :
    'bg-muted/10 border-muted/30';

  return (
    <div
      className={`rounded-md border text-xs p-2.5 space-y-1.5 ${borderClass}`}
      data-testid={`my-task-card-${task.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {task.isOverdue ? (
            <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />
          ) : task.isDueToday ? (
            <Calendar className="w-3 h-3 text-amber-500 shrink-0" />
          ) : (
            <ClipboardList className="w-3 h-3 text-muted-foreground shrink-0" />
          )}
          <span className="font-medium truncate">{task.title}</span>
        </div>
        <span className={`text-[10px] shrink-0 font-medium ${PRIORITY_COLORS[task.priority] || 'text-muted-foreground'}`}>
          {PRIORITY_LABELS[task.priority] || ''}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-muted-foreground text-[10px]">
          <span className="px-1.5 py-0.5 rounded bg-muted/40">
            {STATUS_TASK_LABELS[task.status] || task.status}
          </span>
          {task.isOverdue && <span className="text-red-400 font-medium">متأخرة!</span>}
          {task.isDueToday && !task.isOverdue && <span className="text-amber-400 font-medium">اليوم</span>}
        </div>
        <div className="flex items-center gap-1">
          {nextStatus && nextStatusLabel && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px] px-2"
              onClick={(e) => { e.stopPropagation(); onStatusChange(nextStatus); }}
              disabled={isPending}
              data-testid={`button-task-advance-${task.id}`}
            >
              <Play className="w-2.5 h-2.5 ml-0.5" />
              {nextStatusLabel}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[10px] px-2"
            onClick={onNavigate}
            data-testid={`button-view-task-${task.id}`}
          >
            <Eye className="w-2.5 h-2.5 ml-0.5" />
            عرض
          </Button>
        </div>
      </div>
    </div>
  );
}

function KpiCell({ icon, label, value, valueColor, alert, alertCount, testId, onClick }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  valueColor?: string;
  alert?: boolean;
  alertCount?: number;
  testId: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={`relative flex items-center gap-2.5 p-2.5 rounded-md bg-muted/30 ${onClick ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''} ${alert ? 'border border-red-500/20' : ''}`}
      onClick={onClick}
      data-testid={`kpi-cell-${testId}`}
    >
      {alert && alertCount && alertCount > 0 && (
        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold z-10">
          {alertCount > 9 ? '9+' : alertCount}
        </span>
      )}
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0">
        <span className={`text-lg font-bold tabular-nums leading-none ${valueColor || 'text-foreground'}`} data-testid={testId}>
          {value}
        </span>
        <p className="text-[10px] text-muted-foreground/60 mt-0.5 truncate">{label}</p>
      </div>
    </div>
  );
}
