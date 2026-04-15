import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { exportToPDF, exportToExcel, formatStatus, formatPriority } from '@/lib/exports';
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Headphones,
  Clock,
  CheckCircle2,
  Plus,
  Settings,
  RefreshCw,
  Users,
  BarChart3,
  Ticket,
  Timer,
  Star,
  TrendingUp,
  BookOpen,
  Inbox,
  PlayCircle,
  Eye,
  Globe,
  FileCheck2,
  FileText,
  FileDown,
  FileSpreadsheet,
  AlertTriangle,
  Shield,
  ClipboardList,
  XCircle,
  Server,
  Wifi,
  WifiOff,
} from "lucide-react";
import { SUPPORT_DEPT_ID, supportNavGroups } from "@/lib/navigation";
import { WelcomeBanner } from '@/components/WelcomeBanner';
import MyDayWidget from '@/components/MyDayWidget';
import { SmartDailyOps } from '@/components/SmartDailyOps';
import { QuickNotes } from '@/components/QuickNotes';
import { SmartBookmarks } from '@/components/SmartBookmarks';

const DEPARTMENT_ID = SUPPORT_DEPT_ID;

export { DEPARTMENT_ID as SUPPORT_DEPT_ID };

function StatCardSkeleton() {
  return (
    <Card className="stat-card-enhanced">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-8 w-16" /></div>
          <Skeleton className="h-12 w-12 rounded-lg" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function ITDepartmentSupport() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [ticketForm, setTicketForm] = useState({ title: '', category: 'technical', priority: 'medium', description: '' });

  const { data: dashboardData, isLoading: dashboardLoading, dataUpdatedAt: dashboardUpdatedAt } = useQuery<{
    tickets: { total: number; open: number; inProgress: number; resolved: number; closed: number; highPriority: number; avgResolutionHours: number; resolutionRate: number; slaBreaches?: number };
    sla: { total: number; active: number };
    satisfaction: { totalResponses: number; avgRating: number };
    tasks: { total: number; pending: number; completed?: number; overdue?: number; completionRate?: number };
    escalations: { total: number; pending: number };
    agents: { total: number };
    referrals?: { total: number; active: number };
  }>({
    queryKey: ['/api/dashboard/support'],
    refetchInterval: 2 * 60 * 1000,
    staleTime: 60 * 1000,
  });

  const { data: tickets = [], isLoading: ticketsLoading, refetch } = useQuery<any[]>({
    queryKey: [`/api/it-tickets?departmentId=${DEPARTMENT_ID}`],
    refetchInterval: 2 * 60 * 1000,
  });

  const { data: externalSystems = [] } = useQuery<any[]>({
    queryKey: ['/api/external-systems'],
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: incomingTasks = [], isLoading: tasksLoading } = useQuery<any[]>({
    queryKey: [`/api/tasks/it-department/${DEPARTMENT_ID}`],
    refetchInterval: 2 * 60 * 1000,
  });

  const createTicketMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/it-tickets', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/it-tickets?departmentId=${DEPARTMENT_ID}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/support'] });
      toast({ title: 'تم إنشاء التذكرة بنجاح' });
      setIsNewTicketOpen(false);
      setTicketForm({ title: '', category: 'technical', priority: 'medium', description: '' });
    },
    onError: (error: Error) => {
      toast({ title: 'حدث خطأ في إنشاء التذكرة', description: error.message, variant: 'destructive' });
    }
  });

  const updateTaskStatus = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: number; status: string }) => {
      const res = await apiRequest('PUT', `/api/tasks/${taskId}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/it-department/${DEPARTMENT_ID}`] });
      toast({ title: 'تم تحديث حالة المهمة بنجاح' });
      setSelectedTask(null);
    },
    onError: (error: Error) => {
      toast({ title: 'فشل تحديث حالة المهمة', description: error.message, variant: 'destructive' });
    },
  });

  const isLoading = ticketsLoading || tasksLoading || dashboardLoading;

  const pendingTasks = incomingTasks.filter((t: any) => t.status === 'pending' || t.status === 'assigned');

  const avgResHours = dashboardData?.tickets?.avgResolutionHours ?? 0;
  const avgResponseTimeLabel = avgResHours === 0
    ? 'غير محدد'
    : avgResHours < 1
      ? `${Math.round(avgResHours * 60)} دقيقة`
      : avgResHours < 24
        ? `${avgResHours.toFixed(1)} ساعة`
        : `${(avgResHours / 24).toFixed(1)} يوم`;

  const stats = {
    openTickets: dashboardData?.tickets?.open ?? tickets.filter((t: any) => t.status === 'open').length,
    inProgressTickets: dashboardData?.tickets?.inProgress ?? tickets.filter((t: any) => t.status === 'in_progress').length,
    resolvedToday: dashboardData?.tickets?.resolved ?? tickets.filter((t: any) => t.status === 'resolved').length,
    avgResponseTime: avgResponseTimeLabel,
    customerSatisfaction: dashboardData?.satisfaction?.avgRating ?? 0,
    totalAgents: dashboardData?.agents?.total ?? 0,
    resolutionRate: dashboardData?.tickets?.resolutionRate ?? 0,
    pendingTasksCount: pendingTasks.length,
  };

  const handleRefresh = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['/api/dashboard/support'] });
    toast({ title: 'جاري تحديث البيانات...' });
  };

  const handleExportPDF = () => {
    const data = tickets.map((t: any) => ({
      title: t.title || '',
      status: formatStatus(t.status || ''),
      priority: formatPriority(t.priority || ''),
      type: t.type || t.category || '',
      createdAt: t.createdAt ? new Date(t.createdAt).toLocaleDateString('ar-SA') : '',
    }));
    const columns = [
      { header: 'التذكرة', key: 'title' },
      { header: 'الحالة', key: 'status' },
      { header: 'الأولوية', key: 'priority' },
      { header: 'النوع', key: 'type' },
      { header: 'التاريخ', key: 'createdAt' },
    ];
    exportToPDF({ data, columns, title: 'تقرير الدعم الفني', filename: 'support-report', orientation: 'landscape' });
  };

  const handleExportExcel = () => {
    const data = tickets.map((t: any) => ({
      title: t.title || '',
      status: formatStatus(t.status || ''),
      priority: formatPriority(t.priority || ''),
      type: t.type || t.category || '',
      createdAt: t.createdAt ? new Date(t.createdAt).toLocaleDateString('ar-SA') : '',
    }));
    const columns = [
      { header: 'التذكرة', key: 'title' },
      { header: 'الحالة', key: 'status' },
      { header: 'الأولوية', key: 'priority' },
      { header: 'النوع', key: 'type' },
      { header: 'التاريخ', key: 'createdAt' },
    ];
    exportToExcel({ data, columns, title: 'تقرير الدعم الفني', filename: 'support-report' });
  };

  return (
    <DashboardLayout 
      title="إدارة الدعم الفني" 
      subtitle="إدارة الدعم الفني والمساعدة"
      navGroups={supportNavGroups}
      portalName="الدعم الفني"
    >
      <div className="space-y-6">
        <WelcomeBanner
          userName={user?.name || ''}
          portalName="الدعم الفني"
          portal="support"
          stats={{
            openTickets: dashboardData?.tickets?.open || 0,
            slaBreaches: dashboardData?.tickets?.highPriority || 0,
            pendingReferrals: dashboardData?.escalations?.pending || 0,
          }}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <SmartDailyOps
              portal="support"
              portalLabel="الدعم الفني"
              onNavigate={setLocation}
              ticketsPath="/department/support/tickets"
              referralsPath="/department/support/referrals"
              tasksPath="/department/support/tasks"
            />
          </div>
          <MyDayWidget portal="support" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SmartBookmarks portal="support" onNavigate={setLocation} />
          <QuickNotes portal="support" />
        </div>
        <div className="flex items-center justify-between animate-fadeInUp">
          <div>
            <h1 className="text-2xl font-bold text-foreground">مرحباً، {user?.name}</h1>
            <div className="flex items-center gap-2">
              <p className="text-muted-foreground text-sm">لوحة تحكم إدارة الدعم الفني</p>
              {dashboardUpdatedAt > 0 && (
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground/50 bg-muted/40 px-2 py-0.5 rounded-full border border-border/30">
                  ⟳ آخر تحديث {new Date(dashboardUpdatedAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportPDF} data-testid="button-export-pdf">
              <FileDown className="w-4 h-4 ml-2" />
              PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportExcel} data-testid="button-export-excel">
              <FileSpreadsheet className="w-4 h-4 ml-2" />
              Excel
            </Button>
            <Button className="btn-navy" size="sm" onClick={handleRefresh} data-testid="button-refresh">
              <RefreshCw className="w-4 h-4 ml-2" />
              تحديث
            </Button>
            <Button className="btn-gold" size="sm" onClick={() => setIsNewTicketOpen(true)} data-testid="button-new-ticket">
              <Plus className="w-4 h-4 ml-2" />
              تذكرة جديدة
            </Button>
          </div>
        </div>

        {dashboardLoading ? (
          <div className="space-y-4 animate-fadeInUp">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[1,2,3,4,5,6].map((i) => <StatCardSkeleton key={i} />)}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </div>
          </div>
        ) : dashboardData ? (
          <div className="space-y-4 animate-fadeInUp" data-testid="dashboard-summary-section">
            {/* ── خط أنابيب التذاكر - كل بار = نسبة من الإجمالي ── */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="ticket-pipeline-row">
              {(() => {
                const total = dashboardData.tickets.total || 1;
                const pct = (n: number) => Math.round((n / total) * 100);
                const pipeline = [
                  { label: 'إجمالي التذاكر', value: dashboardData.tickets.total, bar: 100, stripe: 'bg-primary/30', iconBg: 'bg-primary/10', valueColor: 'text-foreground', icon: Ticket, testId: 'stat-tickets-total', sub: `الكل` },
                  { label: 'مفتوحة', value: dashboardData.tickets.open, bar: pct(dashboardData.tickets.open), stripe: 'bg-blue-400', iconBg: 'bg-blue-500/10', valueColor: 'text-blue-400', icon: Inbox, testId: 'stat-tickets-open', sub: `${pct(dashboardData.tickets.open)}% من الكل` },
                  { label: 'قيد المعالجة', value: dashboardData.tickets.inProgress, bar: pct(dashboardData.tickets.inProgress), stripe: 'bg-amber-400/70', iconBg: 'bg-amber-400/15', valueColor: 'hub-stat-gold', icon: Clock, testId: 'stat-tickets-inprogress', sub: `${pct(dashboardData.tickets.inProgress)}% من الكل` },
                  { label: 'تم الحل', value: dashboardData.tickets.resolved, bar: pct(dashboardData.tickets.resolved), stripe: 'bg-emerald-500', iconBg: 'bg-emerald-500/15', valueColor: 'text-emerald-400', icon: CheckCircle2, testId: 'stat-tickets-resolved', sub: `${pct(dashboardData.tickets.resolved)}% من الكل` },
                  { label: 'مغلقة', value: dashboardData.tickets.closed, bar: pct(dashboardData.tickets.closed), stripe: 'bg-muted-foreground/30', iconBg: 'bg-muted/30', valueColor: 'text-muted-foreground', icon: XCircle, testId: 'stat-tickets-closed', sub: `${pct(dashboardData.tickets.closed)}% من الكل` },
                  { label: 'أولوية عالية', value: dashboardData.tickets.highPriority, bar: dashboardData.tickets.open > 0 ? Math.round((dashboardData.tickets.highPriority / dashboardData.tickets.open) * 100) : 0, stripe: dashboardData.tickets.highPriority > 0 ? 'bg-red-500' : 'bg-muted/30', iconBg: dashboardData.tickets.highPriority > 0 ? 'bg-red-500/10' : 'bg-muted/30', valueColor: dashboardData.tickets.highPriority > 0 ? 'text-red-400' : 'text-muted-foreground', icon: AlertTriangle, testId: 'stat-tickets-highpriority', sub: `${dashboardData.tickets.open > 0 ? Math.round((dashboardData.tickets.highPriority / dashboardData.tickets.open) * 100) : 0}% من المفتوحة` },
                ];
                return pipeline.map(({ label, value, bar, stripe, iconBg, valueColor, icon: Icon, testId, sub }) => (
                  <Card key={testId} className={`hub-card hub-card-hover relative overflow-hidden ${testId === 'stat-tickets-highpriority' && value > 0 ? 'hub-critical-pulse' : ''}`} data-testid={testId}>
                    <div className={`absolute inset-y-0 right-0 w-[3px] rounded-l-sm ${stripe}`} />
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between gap-1 mb-2">
                        <p className="text-[10px] text-muted-foreground font-medium leading-tight">{label}</p>
                        <div className={`p-1.5 rounded-md ${iconBg}`}>
                          <Icon className={`w-3 h-3 ${valueColor}`} />
                        </div>
                      </div>
                      <p className={`text-2xl font-bold hub-stat-number ${valueColor}`}>{value}</p>
                      <div className="mt-2 h-1 bg-border/30 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-700 ${stripe}`} style={{ width: `${bar}%` }} />
                      </div>
                      <p className="text-[9px] text-muted-foreground/50 mt-1">{sub}</p>
                    </CardContent>
                  </Card>
                ));
              })()}
            </div>

            {/* ── المقاييس الرئيسية - كل بار مرتبط بالبيانات الصحيحة ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-testid="key-metrics-row">
              {/* متوسط وقت الحل: البار يعكس الجودة — أقل ساعات = بار أطول (الهدف 24 ساعة) */}
              <Card className="hub-card hub-card-hover relative overflow-hidden" data-testid="metric-avg-resolution">
                <div className="absolute inset-y-0 right-0 w-[3px] bg-primary/40" />
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <p className="text-xs text-muted-foreground font-medium">متوسط وقت الحل</p>
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Timer className="w-4 h-4 text-foreground" />
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <p className="text-3xl font-bold hub-stat-number text-foreground">{dashboardData.tickets.avgResolutionHours}</p>
                    <span className="text-sm text-muted-foreground">ساعة</span>
                  </div>
                  <div className="mt-3 h-1.5 bg-border/30 rounded-full overflow-hidden">
                    {/* الهدف 24 ساعة: بار يُظهر كفاءة الحل — كلما انخفض الوقت كلما امتلأ البار */}
                    <div className="h-full bg-primary/60 rounded-full transition-all duration-700"
                      style={{ width: `${Math.max(0, 100 - Math.min((dashboardData.tickets.avgResolutionHours / 24) * 100, 100))}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground/50 mt-1">
                    {dashboardData.tickets.avgResolutionHours <= 8 ? 'ممتاز ✓' : dashboardData.tickets.avgResolutionHours <= 24 ? 'ضمن الهدف' : 'يتجاوز 24 ساعة'}
                  </p>
                </CardContent>
              </Card>

              {/* التزام SLA: البار = نسبة الاتفاقيات النشطة من الإجمالي */}
              <Card className="hub-card hub-card-hover relative overflow-hidden" data-testid="metric-sla-compliance">
                <div className={`absolute inset-y-0 right-0 w-[3px] ${dashboardData.sla.total > 0 && (dashboardData.sla.active / dashboardData.sla.total) >= 0.8 ? 'bg-emerald-500' : 'bg-amber-400/70'}`} />
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <p className="text-xs text-muted-foreground font-medium">التزام اتفاقيات SLA</p>
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Shield className="w-4 h-4 text-foreground" />
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <p className="text-3xl font-bold hub-stat-number text-foreground">{dashboardData.sla.active}</p>
                    <span className="text-sm text-muted-foreground">/ {dashboardData.sla.total}</span>
                  </div>
                  <div className="mt-3 h-1.5 bg-border/30 rounded-full overflow-hidden">
                    {/* البار = SLA نشطة ÷ SLA إجمالية */}
                    <div className={`h-full rounded-full transition-all duration-700 ${dashboardData.sla.total > 0 && (dashboardData.sla.active / dashboardData.sla.total) >= 0.8 ? 'bg-emerald-500' : 'bg-amber-400'}`}
                      style={{ width: `${dashboardData.sla.total > 0 ? Math.round((dashboardData.sla.active / dashboardData.sla.total) * 100) : 0}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground/50 mt-1">
                    {dashboardData.sla.total > 0 ? `${Math.round((dashboardData.sla.active / dashboardData.sla.total) * 100)}% معدل الالتزام` : 'لا توجد اتفاقيات'}
                  </p>
                </CardContent>
              </Card>

              {/* رضا العملاء: البار = التقييم من 5 */}
              <Card className="hub-card hub-card-hover relative overflow-hidden" data-testid="metric-satisfaction">
                <div className="absolute inset-y-0 right-0 w-[3px] bg-amber-400/70" />
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <p className="text-xs text-muted-foreground font-medium">رضا العملاء</p>
                    <div className="p-2 bg-amber-400/15 rounded-lg">
                      <Star className="w-4 h-4 hub-stat-gold" />
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <p className="text-3xl font-bold hub-stat-number hub-stat-gold">{dashboardData.satisfaction.avgRating.toFixed(1)}</p>
                    <span className="text-sm text-muted-foreground">/ 5</span>
                  </div>
                  <div className="flex items-center gap-0.5 mt-2">
                    {[1,2,3,4,5].map((s) => (
                      <Star key={s} className={`w-3 h-3 ${s <= Math.round(dashboardData.satisfaction.avgRating) ? 'hub-stat-gold fill-[hsl(43_74%_49%)]' : 'text-muted-foreground/20'}`} />
                    ))}
                  </div>
                  <div className="mt-2 h-1.5 bg-border/30 rounded-full overflow-hidden">
                    {/* البار = التقييم ÷ 5 × 100 */}
                    <div className="h-full bg-amber-400 rounded-full transition-all duration-700"
                      style={{ width: `${(dashboardData.satisfaction.avgRating / 5) * 100}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground/50 mt-1">{dashboardData.satisfaction.totalResponses} تقييم</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dashboardData.escalations.pending > 0 && (
                <Card className="border-destructive/30 bg-destructive/5" data-testid="escalations-alert">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-destructive/10 rounded-lg">
                        <AlertTriangle className="w-5 h-5 text-destructive" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-destructive">تصعيدات تنتظر المعالجة</p>
                        <p className="text-sm text-muted-foreground">
                          {dashboardData.escalations.pending} تصعيد معلق من اصل {dashboardData.escalations.total}
                        </p>
                      </div>
                      <Badge variant="destructive" data-testid="badge-escalations-count">{dashboardData.escalations.pending}</Badge>
                    </div>
                  </CardContent>
                </Card>
              )}
              {(dashboardData.tickets.slaBreaches ?? 0) > 0 && (
                <Card className="border-destructive/30 bg-destructive/5" data-testid="sla-breaches-alert">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-destructive/10 rounded-lg">
                        <Shield className="w-5 h-5 text-destructive" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-destructive">انتهاكات SLA</p>
                        <p className="text-sm text-muted-foreground">
                          {dashboardData.tickets.slaBreaches} تذكرة تجاوزت اتفاقية مستوى الخدمة
                        </p>
                      </div>
                      <Badge variant="destructive" data-testid="badge-sla-breaches">{dashboardData.tickets.slaBreaches}</Badge>
                    </div>
                  </CardContent>
                </Card>
              )}
              <Card className="stat-card-enhanced" data-testid="department-tasks-card">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="hub-icon-navy">
                      <ClipboardList className="w-5 h-5 text-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">مهام الادارة</p>
                      <div className="flex items-baseline gap-1">
                        <p className="text-2xl font-bold text-foreground">{dashboardData.tasks.pending}</p>
                        <span className="text-sm text-muted-foreground">معلقة من {dashboardData.tasks.total}</span>
                      </div>
                      {(dashboardData.tasks.completionRate ?? 0) > 0 && (
                        <div className="mt-2">
                          <div className="flex justify-between text-[10px] text-muted-foreground/60 mb-1">
                            <span>معدل الإنجاز</span>
                            <span>{dashboardData.tasks.completionRate}%</span>
                          </div>
                          <Progress value={dashboardData.tasks.completionRate ?? 0} className="h-1.5" data-testid="progress-task-completion" />
                        </div>
                      )}
                      {((dashboardData.tasks.completed ?? 0) > 0 || (dashboardData.tasks.overdue ?? 0) > 0) && (
                        <div className="flex items-center gap-3 mt-1.5 text-[10px]">
                          {(dashboardData.tasks.completed ?? 0) > 0 && (
                            <span className="text-emerald-500">{dashboardData.tasks.completed} مكتملة</span>
                          )}
                          {(dashboardData.tasks.overdue ?? 0) > 0 && (
                            <span className="text-destructive">{dashboardData.tasks.overdue} متأخرة</span>
                          )}
                        </div>
                      )}
                    </div>
                    <Progress value={dashboardData.tasks.total > 0 ? ((dashboardData.tasks.total - dashboardData.tasks.pending) / dashboardData.tasks.total) * 100 : 0} className="w-20 h-2" />
                  </div>
                </CardContent>
              </Card>
              {dashboardData.referrals && dashboardData.referrals.total > 0 && (
                <Card className="stat-card-enhanced" data-testid="referrals-card">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="hub-icon-navy">
                        <Globe className="w-5 h-5 text-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground">الإحالات</p>
                        <div className="flex items-baseline gap-1">
                          <p className="text-2xl font-bold text-foreground">{dashboardData.referrals.total}</p>
                          <span className="text-sm text-muted-foreground">{dashboardData.referrals.active} نشطة</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {isLoading ? (
            <>{[1,2,3,4].map((i) => <StatCardSkeleton key={i} />)}</>
          ) : (
            <>
              {/* تذاكر مفتوحة: البار = مفتوحة ÷ إجمالي × 100 */}
              <Card className="hub-card hub-card-hover relative overflow-hidden animate-fadeInUp stagger-1" data-testid="stat2-open-tickets">
                <div className="absolute inset-y-0 right-0 w-[3px] bg-blue-400" />
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <p className="text-xs text-muted-foreground font-medium">تذاكر مفتوحة</p>
                    <div className="p-2 bg-blue-500/10 rounded-lg"><Ticket className="w-4 h-4 text-blue-400" /></div>
                  </div>
                  <p className="text-3xl font-bold hub-stat-number text-blue-400">{stats.openTickets}</p>
                  <div className="mt-3 h-1.5 bg-border/30 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-400 rounded-full transition-all duration-700"
                      style={{ width: `${(dashboardData?.tickets?.total ?? 0) > 0 ? Math.round((stats.openTickets / (dashboardData?.tickets?.total ?? 1)) * 100) : 0}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground/50 mt-1">{(dashboardData?.tickets?.total ?? 0) > 0 ? Math.round((stats.openTickets / (dashboardData?.tickets?.total ?? 1)) * 100) : 0}% من الإجمالي</p>
                </CardContent>
              </Card>

              {/* قيد المعالجة: البار = inProgress ÷ إجمالي × 100 */}
              <Card className="hub-card hub-card-hover relative overflow-hidden animate-fadeInUp stagger-2" data-testid="stat2-inprogress-tickets">
                <div className="absolute inset-y-0 right-0 w-[3px] bg-amber-400/70" />
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <p className="text-xs text-muted-foreground font-medium">قيد المعالجة</p>
                    <div className="p-2 bg-amber-400/15 rounded-lg"><Clock className="w-4 h-4 hub-stat-gold" /></div>
                  </div>
                  <p className="text-3xl font-bold hub-stat-number hub-stat-gold">{stats.inProgressTickets}</p>
                  <div className="mt-3 h-1.5 bg-border/30 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full transition-all duration-700"
                      style={{ width: `${(dashboardData?.tickets?.total ?? 0) > 0 ? Math.round((stats.inProgressTickets / (dashboardData?.tickets?.total ?? 1)) * 100) : 0}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground/50 mt-1">{(dashboardData?.tickets?.total ?? 0) > 0 ? Math.round((stats.inProgressTickets / (dashboardData?.tickets?.total ?? 1)) * 100) : 0}% من الإجمالي</p>
                </CardContent>
              </Card>

              {/* تم الحل: البار = resolved ÷ إجمالي × 100 */}
              <Card className="hub-card hub-card-hover relative overflow-hidden animate-fadeInUp stagger-3" data-testid="stat2-resolved-tickets">
                <div className="absolute inset-y-0 right-0 w-[3px] bg-emerald-500" />
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <p className="text-xs text-muted-foreground font-medium">تم الحل</p>
                    <div className="p-2 bg-emerald-500/15 rounded-lg"><CheckCircle2 className="w-4 h-4 text-emerald-400" /></div>
                  </div>
                  <p className="text-3xl font-bold hub-stat-number text-emerald-400">{stats.resolvedToday}</p>
                  <div className="mt-3 h-1.5 bg-border/30 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                      style={{ width: `${(dashboardData?.tickets?.total ?? 0) > 0 ? Math.round((stats.resolvedToday / (dashboardData?.tickets?.total ?? 1)) * 100) : 0}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground/50 mt-1">معدل الحل: {stats.resolutionRate}%</p>
                </CardContent>
              </Card>

              {/* رضا العملاء: البار = avgRating ÷ 5 × 100 */}
              <Card className="hub-card hub-card-hover relative overflow-hidden animate-fadeInUp stagger-4" data-testid="stat2-satisfaction">
                <div className="absolute inset-y-0 right-0 w-[3px] bg-amber-400/70" />
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <p className="text-xs text-muted-foreground font-medium">رضا العملاء</p>
                    <div className="p-2 bg-amber-400/15 rounded-lg"><Star className="w-4 h-4 hub-stat-gold" /></div>
                  </div>
                  <div className="flex items-center gap-1">
                    <p className="text-3xl font-bold hub-stat-number hub-stat-gold">{stats.customerSatisfaction.toFixed ? stats.customerSatisfaction.toFixed(1) : stats.customerSatisfaction}</p>
                    <span className="text-sm text-muted-foreground">/ 5</span>
                  </div>
                  <div className="mt-3 h-1.5 bg-border/30 rounded-full overflow-hidden">
                    {/* البار = التقييم ÷ 5 × 100 (القيمة القصوى 5 نجوم) */}
                    <div className="h-full bg-amber-400 rounded-full transition-all duration-700"
                      style={{ width: `${(stats.customerSatisfaction / 5) * 100}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground/50 mt-1">{stats.totalAgents} وكيل دعم نشط</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {pendingTasks.length > 0 && (
          <Card className="card-premium pl-4 animate-fadeInUp stagger-5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Inbox className="w-5 h-5 hub-stat-gold" />
                المهام الواردة من مدير تقنية المعلومات
                <Badge className="mr-2 hub-badge-gold-solid">{pendingTasks.length} جديدة</Badge>
              </CardTitle>
              <CardDescription>المهام المعينة لإدارة الدعم الفني والتي تنتظر المعالجة</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pendingTasks.slice(0, 5).map((task: any, index: number) => (
                  <div 
                    key={task.id} 
                    className={`flex items-center gap-4 p-4 bg-[hsl(43_74%_49%)]/5 border border-[hsl(43_74%_49%)]/20 rounded-lg hover-elevate cursor-pointer animate-fadeInUp stagger-${Math.min(index + 1, 5)}`}
                    onClick={() => setSelectedTask(task)}
                    data-testid={`incoming-task-${task.id}`}
                  >
                    <div className="hub-icon-gold">
                      <Inbox className="w-5 h-5 hub-stat-gold" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{task.title}</span>
                        <Badge variant={['high','critical','urgent'].includes(task.priority) ? 'destructive' : 'secondary'}>
                          {task.priority === 'urgent' ? 'عاجل' : task.priority === 'critical' ? 'حرج' : task.priority === 'high' ? 'عالي' : task.priority === 'medium' ? 'متوسط' : 'منخفض'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">{task.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          تاريخ الاستحقاق: {task.dueDate ? new Date(task.dueDate).toLocaleDateString('ar-SA') : 'غير محدد'}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="btn-navy" onClick={(e) => { e.stopPropagation(); setSelectedTask(task); }} data-testid={`view-task-${task.id}`}>
                        <Eye className="w-4 h-4 ml-1" />
                        عرض
                      </Button>
                      <Button 
                        size="sm" 
                        className="btn-gold"
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          updateTaskStatus.mutate({ taskId: task.id, status: 'in_progress' }); 
                        }}
                        disabled={updateTaskStatus.isPending}
                        data-testid={`start-task-${task.id}`}
                      >
                        <PlayCircle className="w-4 h-4 ml-1" />
                        بدء العمل
                      </Button>
                    </div>
                  </div>
                ))}
                {pendingTasks.length > 5 && (
                  <Button 
                    className="w-full btn-navy" 
                    onClick={() => setLocation('/department/support/tasks')}
                    data-testid="view-all-tasks"
                  >
                    عرض جميع المهام ({pendingTasks.length})
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 card-premium card-glow animate-fadeInUp stagger-1">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Ticket className="w-5 h-5 hub-stat-gold" />
                    أحدث التذاكر
                  </CardTitle>
                  <CardDescription>تذاكر تحتاج إلى اهتمام</CardDescription>
                </div>
                <Button className="btn-navy" size="sm" onClick={() => setLocation('/department/support/tickets')} data-testid="nav-all-tickets">
                  عرض الكل
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg"><Skeleton className="h-10 w-10 rounded-lg" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-40" /><Skeleton className="h-3 w-24" /></div></div>)}</div>
              ) : (
                <div className="space-y-3">
                  {tickets.slice(0, 5).map((ticket: any, index: number) => (
                    <div key={ticket.id} className={`flex items-center gap-4 p-3 bg-muted/30 rounded-lg hover-elevate cursor-pointer animate-fadeInUp stagger-${Math.min(index + 1, 5)}`} data-testid={`ticket-${ticket.id}`} onClick={() => setSelectedTicket(ticket)}>
                      <div className={`p-2 rounded-lg ${
                        ['high','critical','urgent'].includes(ticket.priority) ? 'bg-[hsl(222_47%_11%)]/10' : 
                        'bg-[hsl(43_74%_49%)]/10'
                      }`}>
                        <Ticket className={`w-5 h-5 ${
                          ['high','critical','urgent'].includes(ticket.priority) ? 'text-foreground' : 
                          'hub-stat-gold'
                        }`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{ticket.title}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant={
                              ticket.status === 'open' ? 'destructive' : 
                              ticket.status === 'in_progress' ? 'secondary' : 'default'
                            }>
                              {ticket.status === 'open' ? 'جديد' : 
                               ticket.status === 'in_progress' ? 'قيد المعالجة' : 'مغلق'}
                            </Badge>
                            <Badge variant="outline">
                              {ticket.priority === 'high' ? 'عالي' : 
                               ticket.priority === 'medium' ? 'متوسط' : 'منخفض'}
                            </Badge>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">{ticket.type || 'عام'}</p>
                      </div>
                    </div>
                  ))}
                  {tickets.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle2 className="w-12 h-12 mx-auto mb-3 hub-stat-gold" />
                      <p>لا توجد تذاكر مفتوحة</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="card-premium card-glow animate-fadeInUp stagger-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Headphones className="w-5 h-5 hub-stat-gold" />
                الإجراءات السريعة
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full justify-start gap-2 btn-navy" onClick={() => setLocation('/department/support/tickets')} data-testid="nav-tickets">
                <Ticket className="w-4 h-4" />
                إدارة التذاكر
              </Button>
              <Button className="w-full justify-start gap-2 btn-navy" onClick={() => setLocation('/department/support/knowledge-base')} data-testid="nav-knowledge">
                <BookOpen className="w-4 h-4" />
                قاعدة المعرفة
              </Button>
              <Button className="w-full justify-start gap-2 btn-navy" onClick={() => setLocation('/department/support/tickets')} data-testid="nav-reports">
                <TrendingUp className="w-4 h-4" />
                التقارير والإحصاءات
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="card-premium card-glow animate-fadeInUp stagger-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Timer className="w-5 h-5 text-foreground" />
                أداء الفريق
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">{[1,2,3].map((i) => <div key={i} className="flex justify-between items-center"><Skeleton className="h-4 w-32" /><Skeleton className="h-5 w-20 rounded-full" /></div>)}</div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center"><span className="text-sm">متوسط وقت الاستجابة</span><Badge variant="outline" className="hub-stat-gold">{stats.avgResponseTime}</Badge></div>
                  <div className="flex justify-between items-center"><span className="text-sm">التذاكر المحلولة</span><Badge variant="default">{stats.resolvedToday}</Badge></div>
                  <div className="flex justify-between items-center"><span className="text-sm">رضا العملاء</span><div className="flex items-center gap-1">{[1,2,3,4,5].map((s) => <Star key={s} className={`w-4 h-4 ${s <= Math.floor(stats.customerSatisfaction) ? 'hub-stat-gold fill-[hsl(43_74%_49%)]' : 'text-gray-300'}`} />)}</div></div>
                  <div className="flex justify-between items-center"><span className="text-sm">موظفو الدعم النشطون</span><Badge variant="secondary">{stats.totalAgents}</Badge></div>
                  <div className="mt-4 pt-4 border-t"><div className="flex justify-between text-xs mb-2"><span>معدل الإنجاز</span><span>{stats.resolutionRate}%</span></div><Progress value={stats.resolutionRate} className="h-2" /></div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="card-premium card-glow animate-fadeInUp stagger-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 hub-stat-gold" />
                فريق الدعم
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="flex items-center gap-3 p-3 border-b last:border-0"><Skeleton className="h-2 w-2 rounded-full" /><div className="flex-1 space-y-1"><Skeleton className="h-4 w-24" /><Skeleton className="h-3 w-16" /></div></div>)}</div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">يتم تحميل بيانات الفريق من النظام</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {externalSystems.length > 0 && (
          <Card className="hub-card" data-testid="card-connected-systems-support">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="flex items-center gap-2 text-white">
                <Server className="w-5 h-5 hub-stat-gold" />
                الأنظمة المتصلة بالإدارة
              </CardTitle>
              <Badge className="hub-badge-info">{externalSystems.length} نظام</Badge>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {externalSystems.slice(0, 6).map((sys: any) => (
                  <div key={sys.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/10" data-testid={`ext-system-${sys.id}`}>
                    <div className={`p-2 rounded-lg ${sys.healthStatus === 'online' ? 'bg-emerald-500/20' : sys.healthStatus === 'offline' ? 'bg-red-500/20' : 'bg-white/10'}`}>
                      {sys.healthStatus === 'online' ? <Wifi className="w-4 h-4 text-emerald-400" /> : <WifiOff className="w-4 h-4 text-white/40" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{sys.nameAr || sys.name}</p>
                      <p className="text-xs text-white/50">{sys.systemType || sys.category}</p>
                    </div>
                    <Badge className={sys.status === 'active' ? 'hub-badge-success' : 'hub-badge-neutral'} style={{ fontSize: '10px' }}>
                      {sys.status === 'active' ? 'نشط' : 'غير نشط'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={isNewTicketOpen} onOpenChange={setIsNewTicketOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>تذكرة دعم جديدة</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>العنوان</Label>
              <Input placeholder="أدخل عنوان التذكرة" value={ticketForm.title} onChange={e => setTicketForm(f => ({ ...f, title: e.target.value }))} data-testid="input-ticket-title" />
            </div>
            <div>
              <Label>النوع</Label>
              <Select value={ticketForm.category} onValueChange={v => setTicketForm(f => ({ ...f, category: v }))}>
                <SelectTrigger data-testid="select-ticket-type">
                  <SelectValue placeholder="اختر نوع التذكرة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="technical">مشكلة تقنية</SelectItem>
                  <SelectItem value="access">طلب صلاحيات</SelectItem>
                  <SelectItem value="hardware">معدات</SelectItem>
                  <SelectItem value="software">برمجيات</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>الأولوية</Label>
              <Select value={ticketForm.priority} onValueChange={v => setTicketForm(f => ({ ...f, priority: v }))}>
                <SelectTrigger data-testid="select-ticket-priority">
                  <SelectValue placeholder="اختر الأولوية" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgent">عاجلة</SelectItem>
                  <SelectItem value="low">منخفضة</SelectItem>
                  <SelectItem value="medium">متوسطة</SelectItem>
                  <SelectItem value="high">عالية</SelectItem>
                  <SelectItem value="critical">حرجة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>الوصف</Label>
              <Textarea placeholder="اشرح المشكلة بالتفصيل" value={ticketForm.description} onChange={e => setTicketForm(f => ({ ...f, description: e.target.value }))} data-testid="textarea-ticket-description" />
            </div>
          </div>
          <DialogFooter>
            <Button className="btn-navy" onClick={() => setIsNewTicketOpen(false)} data-testid="button-cancel-ticket">إلغاء</Button>
            <Button className="btn-gold" disabled={!ticketForm.title.trim() || createTicketMutation.isPending} onClick={() => createTicketMutation.mutate({ title: ticketForm.title, category: ticketForm.category, priority: ticketForm.priority, description: ticketForm.description, departmentId: DEPARTMENT_ID })} data-testid="button-create-ticket">
              {createTicketMutation.isPending ? 'جاري الإنشاء...' : 'إنشاء'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ticket className="w-5 h-5 hub-stat-gold" />
              تفاصيل التذكرة
            </DialogTitle>
          </DialogHeader>
          {selectedTicket && (
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">عنوان التذكرة</Label>
                <p className="font-medium text-lg">{selectedTicket.title || 'غير محدد'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">الوصف</Label>
                <p className="text-sm">{selectedTicket.description || 'لا يوجد وصف'}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">الحالة</Label>
                  <div className="mt-1">
                    <Badge variant={selectedTicket.status === 'open' ? 'destructive' : selectedTicket.status === 'in_progress' ? 'secondary' : 'default'}>
                      {selectedTicket.status === 'open' ? 'جديد' : selectedTicket.status === 'in_progress' ? 'قيد المعالجة' : selectedTicket.status === 'resolved' ? 'تم الحل' : 'مغلق'}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">الأولوية</Label>
                  <div className="mt-1">
                    <Badge variant={['high','critical','urgent'].includes(selectedTicket.priority) ? 'destructive' : 'secondary'}>
                      {selectedTicket.priority === 'urgent' ? 'عاجل' : selectedTicket.priority === 'critical' ? 'حرج' : selectedTicket.priority === 'high' ? 'عالي' : selectedTicket.priority === 'medium' ? 'متوسط' : 'منخفض'}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">النوع</Label>
                  <p className="text-sm">{selectedTicket.type || selectedTicket.category || 'عام'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">تاريخ الإنشاء</Label>
                  <p className="text-sm">{selectedTicket.createdAt ? new Date(selectedTicket.createdAt).toLocaleDateString('ar-SA') : 'غير محدد'}</p>
                </div>
                {selectedTicket.assignedTo && (
                  <div>
                    <Label className="text-muted-foreground">معين إلى</Label>
                    <p className="text-sm">{selectedTicket.assignedTo}</p>
                  </div>
                )}
                {selectedTicket.resolvedAt && (
                  <div>
                    <Label className="text-muted-foreground">تاريخ الحل</Label>
                    <p className="text-sm">{new Date(selectedTicket.resolvedAt).toLocaleDateString('ar-SA')}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTicket(null)} data-testid="button-close-ticket">إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Inbox className="w-5 h-5 hub-stat-gold" />
              تفاصيل المهمة
            </DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">عنوان المهمة</Label>
                <p className="font-medium text-lg">{selectedTask.title}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">الوصف</Label>
                <p className="text-sm">{selectedTask.description || 'لا يوجد وصف'}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">الأولوية</Label>
                  <Badge variant={['high','critical','urgent'].includes(selectedTask.priority) ? 'destructive' : 'secondary'}>
                    {selectedTask.priority === 'urgent' ? 'عاجل' : selectedTask.priority === 'critical' ? 'حرج' : selectedTask.priority === 'high' ? 'عالي' : selectedTask.priority === 'medium' ? 'متوسط' : 'منخفض'}
                  </Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">الحالة</Label>
                  <Badge variant="outline">
                    {selectedTask.status === 'pending' ? 'قيد الانتظار' : 
                     selectedTask.status === 'in_progress' ? 'قيد التنفيذ' : 
                     selectedTask.status === 'completed' ? 'مكتملة' : selectedTask.status}
                  </Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">تاريخ الاستحقاق</Label>
                  <p className="text-sm">{selectedTask.dueDate ? new Date(selectedTask.dueDate).toLocaleDateString('ar-SA') : 'غير محدد'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">تاريخ الإنشاء</Label>
                  <p className="text-sm">{selectedTask.createdAt ? new Date(selectedTask.createdAt).toLocaleDateString('ar-SA') : 'غير محدد'}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button className="btn-navy" onClick={() => setSelectedTask(null)} data-testid="button-close-task">إغلاق</Button>
            {selectedTask?.status === 'pending' || selectedTask?.status === 'assigned' ? (
              <Button 
                className="btn-gold"
                onClick={() => updateTaskStatus.mutate({ taskId: selectedTask.id, status: 'in_progress' })}
                disabled={updateTaskStatus.isPending}
                data-testid="button-start-task-details"
              >
                <PlayCircle className="w-4 h-4 ml-1" />
                بدء العمل
              </Button>
            ) : selectedTask?.status === 'in_progress' ? (
              <Button 
                className="btn-gold"
                onClick={() => updateTaskStatus.mutate({ taskId: selectedTask.id, status: 'completed' })}
                disabled={updateTaskStatus.isPending}
                data-testid="button-complete-task"
              >
                <CheckCircle2 className="w-4 h-4 ml-1" />
                إكمال المهمة
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
