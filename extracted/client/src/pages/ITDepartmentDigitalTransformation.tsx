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
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Smartphone,
  Globe,
  Cloud,
  Activity,
  CheckCircle2,
  Clock,
  Plus,
  Settings,
  RefreshCw,
  Users,
  BarChart3,
  Ticket,
  FolderKanban,
  Zap,
  Target,
  TrendingUp,
  Inbox,
  PlayCircle,
  Eye,
  FileCheck2,
  BookOpen,
  FileText,
  FileDown,
  FileSpreadsheet,
  AppWindow,
  ClipboardList,
  Layers,
  Server,
  Wifi,
  WifiOff,
} from "lucide-react";
import { DIGITAL_TRANSFORMATION_DEPT_ID, digitalTransformationNavGroups } from "@/lib/navigation";
import { WelcomeBanner } from '@/components/WelcomeBanner';
import MyDayWidget from '@/components/MyDayWidget';
import { SmartDailyOps } from '@/components/SmartDailyOps';
import { QuickNotes } from '@/components/QuickNotes';
import { SmartBookmarks } from '@/components/SmartBookmarks';

const DEPARTMENT_ID = DIGITAL_TRANSFORMATION_DEPT_ID;

export { DEPARTMENT_ID as DIGITAL_TRANSFORMATION_DEPT_ID };

function StatCardSkeleton() {
  return (
    <Card className="stat-card-enhanced">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
          <Skeleton className="h-12 w-12 rounded-lg" />
        </div>
        <Skeleton className="h-2 w-full mt-3" />
      </CardContent>
    </Card>
  );
}

function InitiativesSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-2 flex-1" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ITDepartmentDigitalTransformation() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [selectedProject, setSelectedProject] = useState<any>(null);

  const { data: dashboardData, isLoading: dashboardLoading, dataUpdatedAt: dashboardUpdatedAt } = useQuery<{
    initiatives: { total: number; active: number; completed: number; planning: number; avgProgress: number };
    applications: { total: number; active: number };
    tickets: { total: number; open: number };
    projects: { total: number; active: number };
    tasks: { total: number; pending: number; completed?: number; overdue?: number; completionRate?: number };
    cloud?: { total: number; active: number };
    staff?: { total: number };
    referrals?: { total: number; active: number };
  }>({
    queryKey: ['/api/dashboard/digital-transformation'],
    refetchInterval: 2 * 60 * 1000,
    staleTime: 60 * 1000,
  });

  const { data: projects = [], isLoading: projectsLoading, refetch: refetchProjects } = useQuery<any[]>({
    queryKey: [`/api/it-projects?itDepartmentId=${DEPARTMENT_ID}`],
    refetchInterval: 3 * 60 * 1000,
  });

  const { data: tickets = [] } = useQuery<any[]>({
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

  const updateTaskStatus = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: number; status: string }) => {
      return apiRequest('PUT', `/api/tasks/${taskId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/it-department/${DEPARTMENT_ID}`] });
      toast({ title: 'تم تحديث حالة المهمة بنجاح' });
      setSelectedTask(null);
    },
    onError: () => {
      toast({ title: 'فشل تحديث حالة المهمة', variant: 'destructive' });
    },
  });

  const isLoading = projectsLoading || tasksLoading;

  const pendingTasks = incomingTasks.filter((t: any) => t.status === 'pending' || t.status === 'assigned');

  const cloudTotal = dashboardData?.cloud?.total ?? externalSystems.length;
  const cloudActiveCount = dashboardData?.cloud?.active ?? externalSystems.filter((s: any) => s.status === 'active').length;
  const cloudUsagePercent = cloudTotal > 0
    ? Math.round((cloudActiveCount / cloudTotal) * 100)
    : 0;
  const digitalMaturity = dashboardData
    ? Math.round(
        ((dashboardData.initiatives.avgProgress || 0) * 0.5) +
        ((dashboardData.initiatives.total > 0
          ? (dashboardData.initiatives.completed / dashboardData.initiatives.total) * 100
          : 0) * 0.3) +
        ((dashboardData.applications.total > 0
          ? (dashboardData.applications.active / dashboardData.applications.total) * 100
          : 0) * 0.2)
      )
    : 0;

  const stats = {
    activeInitiatives: dashboardData?.initiatives?.active ?? 0,
    completedProjects: projects.filter((p: any) => p.status === 'completed').length,
    inProgressProjects: projects.filter((p: any) => ['development', 'testing', 'deployment'].includes(p.status)).length,
    digitalMaturity,
    openTickets: dashboardData?.tickets?.open ?? tickets.filter((t: any) => t.status === 'open').length,
    cloudServices: cloudTotal,
    cloudUsagePercent,
    pendingTasksCount: pendingTasks.length,
  };

  const handleRefresh = () => {
    refetchProjects();
    toast({ title: 'جاري تحديث البيانات...' });
  };

  const handleExportPDF = () => {
    const data = projects.map((p: any) => ({
      name: p.name || p.title || '',
      status: formatStatus(p.status || ''),
      progress: `${p.progress || 0}%`,
      priority: formatPriority(p.priority || ''),
      startDate: p.startDate ? new Date(p.startDate).toLocaleDateString('ar-SA') : '',
    }));
    const columns = [
      { header: 'المشروع', key: 'name' },
      { header: 'الحالة', key: 'status' },
      { header: 'التقدم', key: 'progress' },
      { header: 'الأولوية', key: 'priority' },
      { header: 'تاريخ البدء', key: 'startDate' },
    ];
    exportToPDF({ data, columns, title: 'تقرير التحول الرقمي', filename: 'digital-transformation-report', orientation: 'landscape' });
  };

  const handleExportExcel = () => {
    const data = projects.map((p: any) => ({
      name: p.name || p.title || '',
      status: formatStatus(p.status || ''),
      progress: `${p.progress || 0}%`,
      priority: formatPriority(p.priority || ''),
      startDate: p.startDate ? new Date(p.startDate).toLocaleDateString('ar-SA') : '',
    }));
    const columns = [
      { header: 'المشروع', key: 'name' },
      { header: 'الحالة', key: 'status' },
      { header: 'التقدم', key: 'progress' },
      { header: 'الأولوية', key: 'priority' },
      { header: 'تاريخ البدء', key: 'startDate' },
    ];
    exportToExcel({ data, columns, title: 'تقرير التحول الرقمي', filename: 'digital-transformation-report' });
  };

  return (
    <DashboardLayout 
      title="إدارة التحول الرقمي" 
      subtitle="إدارة التحول الرقمي والابتكار"
      navGroups={digitalTransformationNavGroups}
      portalName="التحول الرقمي"
    >
      <div className="space-y-6">
        <WelcomeBanner
          userName={user?.name || ''}
          portalName="التحول الرقمي"
          portal="digital_transformation"
          stats={{
            openTickets: dashboardData?.tickets?.open || 0,
            activeProjects: dashboardData?.projects?.active || 0,
          }}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <SmartDailyOps
              portal="digital_transformation"
              portalLabel="التحول الرقمي"
              onNavigate={setLocation}
              ticketsPath="/department/digital-transformation/tickets"
              tasksPath="/department/digital-transformation/tasks"
              referralsPath="/department/digital-transformation/referrals"
            />
          </div>
          <MyDayWidget portal="digital_transformation" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SmartBookmarks portal="digital_transformation" onNavigate={setLocation} />
          <QuickNotes portal="digital_transformation" />
        </div>
        <div className="flex items-center justify-between animate-fadeInUp">
          <div>
            <h1 className="text-2xl font-bold text-foreground">مرحباً، {user?.name}</h1>
            <div className="flex items-center gap-2">
              <p className="text-muted-foreground text-sm">لوحة تحكم إدارة التحول الرقمي</p>
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
            <Button className="btn-gold" size="sm" onClick={() => setLocation('/department/digital-transformation/initiatives')} data-testid="button-new-initiative">
              <Plus className="w-4 h-4 ml-2" />
              مبادرة جديدة
            </Button>
          </div>
        </div>

        {dashboardLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => <StatCardSkeleton key={i} />)}
          </div>
        ) : dashboardData ? (
          <div className="space-y-4" data-testid="dashboard-overview-section">
            <h2 className="text-lg font-bold text-foreground" data-testid="text-overview-title">نظرة عامة على التحول الرقمي</h2>
            {/* ── نظرة عامة: كل بار مرتبط بالبيانات الحقيقية ── */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {(() => {
                const initTotal = dashboardData.initiatives.total || 1;
                const appTotal = dashboardData.applications.total || 1;
                const overview = [
                  { label: 'إجمالي المبادرات', value: dashboardData.initiatives.total, bar: 100, stripe: 'bg-primary/30', iconBg: 'bg-primary/10', valueColor: 'text-foreground', icon: Layers, testId: 'card-total-initiatives', sub: `${dashboardData.initiatives.active} نشطة · ${dashboardData.initiatives.planning} تخطيط` },
                  { label: 'المبادرات النشطة', value: dashboardData.initiatives.active, bar: Math.round((dashboardData.initiatives.active / initTotal) * 100), stripe: 'bg-amber-400/70', iconBg: 'bg-amber-400/15', valueColor: 'hub-stat-gold', icon: Zap, testId: 'card-active-initiatives', sub: `${Math.round((dashboardData.initiatives.active / initTotal) * 100)}% من الإجمالي` },
                  { label: 'المبادرات المكتملة', value: dashboardData.initiatives.completed, bar: Math.round((dashboardData.initiatives.completed / initTotal) * 100), stripe: 'bg-emerald-500', iconBg: 'bg-emerald-500/15', valueColor: 'text-emerald-400', icon: CheckCircle2, testId: 'card-completed-initiatives', sub: `${Math.round((dashboardData.initiatives.completed / initTotal) * 100)}% معدل الإنجاز` },
                  { label: 'إجمالي التطبيقات', value: dashboardData.applications.total, bar: 100, stripe: 'bg-violet-400/60', iconBg: 'bg-violet-500/10', valueColor: 'text-violet-400', icon: AppWindow, testId: 'card-total-applications', sub: `${dashboardData.applications.active} نشط` },
                  { label: 'التطبيقات النشطة', value: dashboardData.applications.active, bar: Math.round((dashboardData.applications.active / appTotal) * 100), stripe: 'bg-primary/50', iconBg: 'bg-primary/10', valueColor: 'text-foreground', icon: Activity, testId: 'card-active-applications', sub: `${Math.round((dashboardData.applications.active / appTotal) * 100)}% من الكل` },
                ];
                return overview.map(({ label, value, bar, stripe, iconBg, valueColor, icon: Icon, testId, sub }) => (
                  <Card key={testId} className="hub-card hub-card-hover relative overflow-hidden" data-testid={testId}>
                    <div className={`absolute inset-y-0 right-0 w-[3px] rounded-l-sm ${stripe}`} />
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <p className="text-xs text-muted-foreground font-medium leading-tight">{label}</p>
                        <div className={`p-2 rounded-lg ${iconBg}`}>
                          <Icon className={`w-4 h-4 ${valueColor}`} />
                        </div>
                      </div>
                      <p className={`text-3xl font-bold hub-stat-number ${valueColor}`} data-testid={`value-${testId}`}>{value}</p>
                      <div className="mt-3 h-1.5 bg-border/30 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-700 ${stripe}`} style={{ width: `${bar}%` }} />
                      </div>
                      <p className="text-[10px] text-muted-foreground/50 mt-1">{sub}</p>
                    </CardContent>
                  </Card>
                ));
              })()}
            </div>

            <Card className="card-premium" data-testid="card-progress-meter">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4 mb-2">
                  <span className="text-sm font-medium">متوسط تقدم المبادرات</span>
                  <Badge className="hub-badge-gold-solid" data-testid="badge-avg-progress">{dashboardData.initiatives.avgProgress}%</Badge>
                </div>
                <Progress value={dashboardData.initiatives.avgProgress} className="h-3" data-testid="progress-avg" />
              </CardContent>
            </Card>

            {/* ── البطاقات القابلة للنقر: كل بار مرتبط بمقام حقيقي ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* التذاكر المفتوحة: البار = مفتوحة ÷ إجمالي التذاكر */}
              <Card className="hub-card hub-card-hover relative overflow-hidden cursor-pointer" data-testid="card-open-tickets" onClick={() => setLocation('/department/digital-transformation/tickets')}>
                <div className="absolute inset-y-0 right-0 w-[3px] bg-blue-400" />
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <p className="text-xs text-muted-foreground font-medium">التذاكر المفتوحة</p>
                    <div className="p-2 bg-blue-500/10 rounded-lg"><Ticket className="w-4 h-4 text-blue-400" /></div>
                  </div>
                  <p className="text-3xl font-bold hub-stat-number text-blue-400" data-testid="value-open-tickets">{dashboardData.tickets.open}</p>
                  <div className="mt-3 h-1.5 bg-border/30 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-400 rounded-full transition-all duration-700"
                      style={{ width: `${dashboardData.tickets.total > 0 ? Math.round((dashboardData.tickets.open / dashboardData.tickets.total) * 100) : 0}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground/50 mt-1">{dashboardData.tickets.total > 0 ? Math.round((dashboardData.tickets.open / dashboardData.tickets.total) * 100) : 0}% من {dashboardData.tickets.total} تذكرة</p>
                </CardContent>
              </Card>

              {/* المشاريع النشطة: البار = نشطة ÷ إجمالي المشاريع */}
              <Card className="hub-card hub-card-hover relative overflow-hidden cursor-pointer" data-testid="card-active-projects" onClick={() => setLocation('/department/digital-transformation/initiatives')}>
                <div className="absolute inset-y-0 right-0 w-[3px] bg-amber-400/70" />
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <p className="text-xs text-muted-foreground font-medium">المشاريع النشطة</p>
                    <div className="p-2 bg-amber-400/15 rounded-lg"><FolderKanban className="w-4 h-4 hub-stat-gold" /></div>
                  </div>
                  <p className="text-3xl font-bold hub-stat-number hub-stat-gold" data-testid="value-active-projects">{dashboardData.projects.active}</p>
                  <div className="mt-3 h-1.5 bg-border/30 rounded-full overflow-hidden">
                    {/* البار = نشطة ÷ إجمالي المشاريع */}
                    <div className="h-full bg-amber-400 rounded-full transition-all duration-700"
                      style={{ width: `${dashboardData.projects.total > 0 ? Math.round((dashboardData.projects.active / dashboardData.projects.total) * 100) : 0}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground/50 mt-1">{dashboardData.projects.total > 0 ? Math.round((dashboardData.projects.active / dashboardData.projects.total) * 100) : 0}% من {dashboardData.projects.total} مشروع</p>
                </CardContent>
              </Card>

              {/* المهام المعلقة: البار = معلقة ÷ إجمالي المهام */}
              <Card className="hub-card hub-card-hover relative overflow-hidden cursor-pointer" data-testid="card-pending-tasks" onClick={() => setLocation('/department/digital-transformation/tasks')}>
                <div className={`absolute inset-y-0 right-0 w-[3px] ${dashboardData.tasks.pending > 5 ? 'bg-red-400/70' : 'bg-primary/40'}`} />
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <p className="text-xs text-muted-foreground font-medium">المهام المعلقة</p>
                    <div className={`p-2 rounded-lg ${dashboardData.tasks.pending > 5 ? 'bg-red-500/10' : 'bg-primary/10'}`}>
                      <ClipboardList className={`w-4 h-4 ${dashboardData.tasks.pending > 5 ? 'text-red-400' : 'text-foreground'}`} />
                    </div>
                  </div>
                  <p className={`text-3xl font-bold hub-stat-number ${dashboardData.tasks.pending > 5 ? 'text-red-400' : 'text-foreground'}`} data-testid="value-pending-tasks">{dashboardData.tasks.pending}</p>
                  <div className="mt-3 h-1.5 bg-border/30 rounded-full overflow-hidden">
                    {/* البار = معلقة ÷ إجمالي المهام */}
                    <div className={`h-full rounded-full transition-all duration-700 ${dashboardData.tasks.pending > 5 ? 'bg-red-400' : 'bg-primary/60'}`}
                      style={{ width: `${dashboardData.tasks.total > 0 ? Math.round((dashboardData.tasks.pending / dashboardData.tasks.total) * 100) : 0}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground/50 mt-1">{dashboardData.tasks.total > 0 ? Math.round((dashboardData.tasks.pending / dashboardData.tasks.total) * 100) : 0}% من {dashboardData.tasks.total} مهمة</p>
                  {(dashboardData.tasks.completionRate ?? 0) > 0 && (
                    <div className="mt-2 pt-2 border-t border-border/20">
                      <div className="flex justify-between text-[10px] text-muted-foreground/50 mb-1">
                        <span>معدل الإنجاز</span>
                        <span>{dashboardData.tasks.completionRate}%</span>
                      </div>
                      <Progress value={dashboardData.tasks.completionRate ?? 0} className="h-1" data-testid="progress-task-completion" />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {(dashboardData.staff?.total || dashboardData.referrals?.total) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dashboardData.staff && dashboardData.staff.total > 0 && (
                  <Card className="hub-card hub-card-hover relative overflow-hidden" data-testid="card-staff-total">
                    <div className="absolute inset-y-0 right-0 w-[3px] bg-primary/30" />
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <p className="text-xs text-muted-foreground font-medium">عدد الموظفين</p>
                        <div className="p-2 bg-primary/10 rounded-lg"><Users className="w-4 h-4 text-foreground" /></div>
                      </div>
                      <p className="text-3xl font-bold hub-stat-number text-foreground">{dashboardData.staff.total}</p>
                    </CardContent>
                  </Card>
                )}
                {dashboardData.referrals && dashboardData.referrals.total > 0 && (
                  <Card className="hub-card hub-card-hover relative overflow-hidden" data-testid="card-referrals">
                    <div className="absolute inset-y-0 right-0 w-[3px] bg-amber-400/70" />
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <p className="text-xs text-muted-foreground font-medium">الإحالات</p>
                        <div className="p-2 bg-amber-400/15 rounded-lg"><Globe className="w-4 h-4 hub-stat-gold" /></div>
                      </div>
                      <p className="text-3xl font-bold hub-stat-number hub-stat-gold">{dashboardData.referrals.total}</p>
                      <p className="text-[10px] text-muted-foreground/50 mt-1">{dashboardData.referrals.active} نشطة</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {isLoading ? (
            <>{[1, 2, 3, 4].map(i => <StatCardSkeleton key={i} />)}</>
          ) : (
            <>
              {/* المبادرات النشطة: البار = متوسط تقدم المبادرات (avgProgress من البيانات الحقيقية) */}
              <Card className="hub-card hub-card-hover relative overflow-hidden animate-fadeInUp stagger-1">
                <div className="absolute inset-y-0 right-0 w-[3px] bg-primary/40" />
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <p className="text-xs text-muted-foreground font-medium">المبادرات النشطة</p>
                    <div className="p-2 bg-primary/10 rounded-lg"><Zap className="w-4 h-4 text-foreground" /></div>
                  </div>
                  <p className="text-3xl font-bold hub-stat-number text-foreground">{stats.activeInitiatives}</p>
                  <div className="mt-3 h-1.5 bg-border/30 rounded-full overflow-hidden">
                    {/* البار = متوسط التقدم الكلي للمبادرات (0-100) */}
                    <div className="h-full bg-primary/60 rounded-full transition-all duration-700"
                      style={{ width: `${dashboardData?.initiatives?.avgProgress ?? 0}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground/50 mt-1">متوسط التقدم: {dashboardData?.initiatives?.avgProgress ?? 0}%</p>
                </CardContent>
              </Card>

              {/* مشاريع منجزة: البار = منجزة ÷ إجمالي المشاريع × 100 */}
              <Card className="hub-card hub-card-hover relative overflow-hidden animate-fadeInUp stagger-2">
                <div className="absolute inset-y-0 right-0 w-[3px] bg-emerald-500" />
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <p className="text-xs text-muted-foreground font-medium">مشاريع منجزة</p>
                    <div className="p-2 bg-emerald-500/15 rounded-lg"><CheckCircle2 className="w-4 h-4 text-emerald-400" /></div>
                  </div>
                  <p className="text-3xl font-bold hub-stat-number text-emerald-400">{stats.completedProjects}</p>
                  <div className="mt-3 h-1.5 bg-border/30 rounded-full overflow-hidden">
                    {/* البار = منجزة ÷ إجمالي المشاريع */}
                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                      style={{ width: `${(dashboardData?.projects?.total ?? 0) > 0 ? Math.round((stats.completedProjects / (dashboardData?.projects?.total ?? 1)) * 100) : 0}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground/50 mt-1">{(dashboardData?.projects?.total ?? 0) > 0 ? Math.round((stats.completedProjects / (dashboardData?.projects?.total ?? 1)) * 100) : 0}% معدل الإنجاز</p>
                </CardContent>
              </Card>

              {/* النضج الرقمي: البار = نسبة النضج المحسوبة (0-100) مباشرة */}
              <Card className="hub-card hub-card-hover relative overflow-hidden animate-fadeInUp stagger-3">
                <div className="absolute inset-y-0 right-0 w-[3px] bg-amber-400/70" />
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <p className="text-xs text-muted-foreground font-medium">النضج الرقمي</p>
                    <div className="p-2 bg-amber-400/15 rounded-lg"><TrendingUp className="w-4 h-4 hub-stat-gold" /></div>
                  </div>
                  <p className="text-3xl font-bold hub-stat-number hub-stat-gold">{stats.digitalMaturity}%</p>
                  <div className="mt-3 h-1.5 bg-border/30 rounded-full overflow-hidden">
                    {/* البار = نسبة النضج الرقمي (0-100) */}
                    <div className="h-full bg-amber-400 rounded-full transition-all duration-700"
                      style={{ width: `${stats.digitalMaturity}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground/50 mt-1">{stats.digitalMaturity >= 80 ? 'مستوى متقدم ✓' : stats.digitalMaturity >= 50 ? 'مستوى متوسط' : 'يحتاج تطوير'}</p>
                </CardContent>
              </Card>

              {/* الخدمات السحابية: البار = نسبة النشطة (cloudUsagePercent محسوب من البيانات) */}
              <Card className="hub-card hub-card-hover relative overflow-hidden animate-fadeInUp stagger-4">
                <div className="absolute inset-y-0 right-0 w-[3px] bg-violet-400/60" />
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <p className="text-xs text-muted-foreground font-medium">الخدمات السحابية</p>
                    <div className="p-2 bg-violet-500/10 rounded-lg"><Cloud className="w-4 h-4 text-violet-400" /></div>
                  </div>
                  <p className="text-3xl font-bold hub-stat-number text-violet-400">{stats.cloudServices}</p>
                  <div className="mt-3 h-1.5 bg-border/30 rounded-full overflow-hidden">
                    {/* البار = cloudUsagePercent (نسبة النشطة من الكل) */}
                    <div className="h-full bg-violet-400 rounded-full transition-all duration-700"
                      style={{ width: `${stats.cloudUsagePercent}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground/50 mt-1">{cloudActiveCount} نشطة · {stats.cloudUsagePercent}%</p>
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
              <CardDescription>المهام المعينة لإدارة التحول الرقمي والتي تنتظر المعالجة</CardDescription>
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
                    className="btn-navy w-full" 
                    onClick={() => setLocation('/department/digital-transformation/tasks')}
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
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 hub-stat-gold" />
                المبادرات الرقمية
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <InitiativesSkeleton />
              ) : projects.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FolderKanban className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p>لا توجد مبادرات مسجلة</p>
                  <Button size="sm" className="btn-gold mt-3" onClick={() => setLocation('/department/digital-transformation/initiatives')} data-testid="button-add-initiative-empty">
                    <Plus className="w-4 h-4 ml-2" />
                    إضافة مبادرة جديدة
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {projects.slice(0, 6).map((project: any, index: number) => (
                    <div 
                      key={project.id} 
                      className={`flex items-center gap-4 p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer animate-fadeInUp stagger-${Math.min(index + 1, 5)}`} 
                      data-testid={`initiative-${project.id}`}
                      onClick={() => setSelectedProject(project)}
                    >
                      <div className="hub-icon-gold">
                        <Zap className="w-5 h-5 hub-stat-gold" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{project.nameAr || project.nameEn}</span>
                          <Badge variant={['development','testing','deployment'].includes(project.status) ? 'default' : 'secondary'}>
                            {project.status === 'development' ? 'تطوير' : project.status === 'testing' ? 'اختبار' : project.status === 'deployment' ? 'نشر' : project.status === 'planning' ? 'تخطيط' : project.status === 'completed' ? 'مكتمل' : project.status === 'maintenance' ? 'صيانة' : project.status === 'on_hold' ? 'متوقف' : project.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress value={project.progress || 0} className="flex-1 h-2" />
                          <span className="text-sm font-medium min-w-[40px]">{project.progress || 0}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="card-premium card-glow animate-fadeInUp stagger-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 hub-stat-gold" />
                الإجراءات السريعة
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="btn-navy w-full justify-start gap-2" onClick={() => setLocation('/department/digital-transformation/initiatives')} data-testid="nav-initiatives">
                <Zap className="w-4 h-4" />
                إدارة المبادرات
              </Button>
              <Button className="btn-navy w-full justify-start gap-2" onClick={() => setLocation('/department/digital-transformation/projects')} data-testid="nav-projects">
                <FolderKanban className="w-4 h-4" />
                المشاريع
              </Button>
              <Button className="btn-navy w-full justify-start gap-2" onClick={() => setLocation('/department/digital-transformation/applications')} data-testid="nav-apps">
                <Smartphone className="w-4 h-4" />
                التطبيقات
              </Button>
              <Button className="btn-navy w-full justify-start gap-2" onClick={() => setLocation('/department/digital-transformation/cloud')} data-testid="nav-cloud">
                <Cloud className="w-4 h-4" />
                الخدمات السحابية
              </Button>
              <Button className="btn-navy w-full justify-start gap-2" onClick={() => setLocation('/department/digital-transformation/kpis')} data-testid="nav-kpis">
                <Target className="w-4 h-4" />
                مؤشرات الأداء
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="card-premium card-glow animate-fadeInUp stagger-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderKanban className="w-5 h-5 text-foreground" />
                المشاريع الجارية
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { name: 'تطوير تطبيق الموظفين', progress: 70, team: 4 },
                  { name: 'منصة التحليلات الذكية', progress: 45, team: 3 },
                  { name: 'بوابة الموردين', progress: 30, team: 2 },
                ].map((project, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-sm">{project.name}</span>
                      <div className="flex items-center gap-2">
                        <Users className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{project.team}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={project.progress} className="flex-1 h-2" />
                      <span className="text-xs font-medium min-w-[32px]">{project.progress}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="card-premium card-glow animate-fadeInUp stagger-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 hub-stat-gold" />
                مؤشرات الأداء الرئيسية
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(() => {
                  const ini = dashboardData?.initiatives;
                  const completionRate = ini && ini.total > 0 ? Math.round((ini.completed / ini.total) * 100) : 0;
                  const activeRate = ini && ini.total > 0 ? Math.round((ini.active / ini.total) * 100) : 0;
                  return [
                    { label: 'معدل إنجاز المبادرات', value: `${completionRate}%`, variant: 'gold' as const },
                    { label: 'المبادرات النشطة', value: `${ini?.active || 0}`, variant: 'outline' as const },
                    { label: 'إجمالي التطبيقات', value: `${dashboardData?.applications?.total || 0}`, variant: 'secondary' as const },
                    { label: 'التذاكر المفتوحة', value: `${dashboardData?.tickets?.open || 0}`, variant: 'outline' as const },
                  ].map((kpi, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <span className="text-sm">{kpi.label}</span>
                      <Badge className={kpi.variant === 'gold' ? 'hub-badge-gold-solid' : ''} variant={kpi.variant === 'gold' ? 'default' : kpi.variant}>{kpi.value}</Badge>
                    </div>
                  ));
                })()}
                <div className="mt-4 pt-4 border-t">
                  <div className="flex justify-between text-xs mb-2">
                    <span>متوسط تقدم المبادرات</span>
                    <span>{dashboardData?.initiatives?.avgProgress || 0}%</span>
                  </div>
                  <Progress value={dashboardData?.initiatives?.avgProgress || 0} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {externalSystems.length > 0 && (
          <Card className="hub-card" data-testid="card-connected-systems-digital">
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

      <Dialog open={!!selectedProject} onOpenChange={() => setSelectedProject(null)}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 hub-stat-gold" />
              تفاصيل المبادرة
            </DialogTitle>
          </DialogHeader>
          {selectedProject && (
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">اسم المبادرة (عربي)</Label>
                <p className="font-medium text-lg">{selectedProject.nameAr || 'غير محدد'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">اسم المبادرة (إنجليزي)</Label>
                <p className="font-medium">{selectedProject.nameEn || selectedProject.name || 'غير محدد'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">الوصف</Label>
                <p className="text-sm">{selectedProject.description || 'لا يوجد وصف'}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">الحالة</Label>
                  <div className="mt-1">
                    <Badge variant={['development','testing','deployment'].includes(selectedProject.status) ? 'default' : 'secondary'}>
                      {selectedProject.status === 'development' ? 'تطوير' : selectedProject.status === 'testing' ? 'اختبار' : selectedProject.status === 'deployment' ? 'نشر' : selectedProject.status === 'planning' ? 'تخطيط' : selectedProject.status === 'completed' ? 'مكتمل' : selectedProject.status === 'maintenance' ? 'صيانة' : selectedProject.status === 'on_hold' ? 'متوقف' : selectedProject.status || 'غير محدد'}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">التقدم</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Progress value={selectedProject.progress || 0} className="flex-1 h-2" />
                    <span className="text-sm font-medium">{selectedProject.progress || 0}%</span>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">الأولوية</Label>
                  <div className="mt-1">
                    <Badge variant={['high','critical','urgent'].includes(selectedProject.priority) ? 'destructive' : 'secondary'}>
                      {selectedProject.priority === 'urgent' ? 'عاجل' : selectedProject.priority === 'critical' ? 'حرج' : selectedProject.priority === 'high' ? 'عالي' : selectedProject.priority === 'low' ? 'منخفض' : 'متوسط'}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">تاريخ البدء</Label>
                  <p className="text-sm">{selectedProject.startDate ? new Date(selectedProject.startDate).toLocaleDateString('ar-SA') : 'غير محدد'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">تاريخ الانتهاء</Label>
                  <p className="text-sm">{selectedProject.endDate ? new Date(selectedProject.endDate).toLocaleDateString('ar-SA') : 'غير محدد'}</p>
                </div>
                {selectedProject.budget && (
                  <div>
                    <Label className="text-muted-foreground">الميزانية</Label>
                    <p className="text-sm">{selectedProject.budget}</p>
                  </div>
                )}
              </div>
              {selectedProject.objectives && (
                <div>
                  <Label className="text-muted-foreground">الأهداف</Label>
                  <p className="text-sm">{selectedProject.objectives}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedProject(null)} data-testid="button-close-project">إغلاق</Button>
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
            <Button className="btn-navy" onClick={() => setSelectedTask(null)} data-testid="button-close-task-dialog">إغلاق</Button>
            {selectedTask?.status === 'pending' || selectedTask?.status === 'assigned' ? (
              <Button 
                className="btn-gold"
                onClick={() => updateTaskStatus.mutate({ taskId: selectedTask.id, status: 'in_progress' })}
                disabled={updateTaskStatus.isPending}
              >
                <PlayCircle className="w-4 h-4 ml-1" />
                بدء العمل
              </Button>
            ) : selectedTask?.status === 'in_progress' ? (
              <Button 
                className="btn-gold"
                onClick={() => updateTaskStatus.mutate({ taskId: selectedTask.id, status: 'completed' })}
                disabled={updateTaskStatus.isPending}
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
