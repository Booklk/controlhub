import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { exportToPDF, exportToExcel, formatStatus} from '@/lib/exports';
import DashboardLayout from "@/components/DashboardLayout";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Server,
  Network,
  HardDrive,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Plus,
  RefreshCw,
  Wifi,
  Monitor,
  Wrench,
  Ticket,
  FolderKanban,
  Inbox,
  Clock,
  Eye,
  PlayCircle,
  FileDown,
  FileSpreadsheet,
  ListChecks,
  ArrowLeft,
} from "lucide-react";
import { INFRASTRUCTURE_DEPT_ID, infrastructureNavGroups } from "@/lib/navigation";
import { WelcomeBanner } from '@/components/WelcomeBanner';
import MyDayWidget from '@/components/MyDayWidget';
import { SmartDailyOps } from '@/components/SmartDailyOps';
import { QuickNotes } from '@/components/QuickNotes';
import { SmartBookmarks } from '@/components/SmartBookmarks';

const DEPARTMENT_ID = INFRASTRUCTURE_DEPT_ID;

export { DEPARTMENT_ID as INFRASTRUCTURE_DEPT_ID };

interface InfrastructureDashboard {
  servers: { total: number; online: number; offline: number; maintenance: number };
  networks: { total: number; active: number };
  storage: { total: number; totalCapacityGB: number; usedCapacityGB: number; usagePercent: number };
  monitoring: { activeAlerts: number; critical: number; warning: number };
  tickets: { total: number; open: number };
  projects: { total: number; active: number };
  tasks: { total: number; pending: number };
}

function StatCardSkeleton() {
  return (
    <Card className="hub-card">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24 bg-white/10" />
            <Skeleton className="h-8 w-16 bg-white/10" />
          </div>
          <Skeleton className="h-12 w-12 rounded-lg bg-white/10" />
        </div>
        <Skeleton className="h-2 w-full mt-3 bg-white/10" />
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="hub-card">
          <CardContent className="p-6">
            <Skeleton className="h-6 w-40 mb-4 bg-white/10" />
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full bg-white/10" />)}
            </div>
          </CardContent>
        </Card>
        <Card className="hub-card">
          <CardContent className="p-6">
            <Skeleton className="h-6 w-40 mb-4 bg-white/10" />
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full bg-white/10" />)}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ITDepartmentInfrastructure() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isAddServerOpen, setIsAddServerOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [selectedSystem, setSelectedSystem] = useState<any>(null);
  const [serverForm, setServerForm] = useState({ nameAr: '', assetType: 'server', location: '' });

  const { data: dashboardData, isLoading: dashboardLoading, refetch: refetchDashboard, dataUpdatedAt: dashboardUpdatedAt } = useQuery<InfrastructureDashboard>({
    queryKey: ['/api/dashboard/infrastructure'],
    refetchInterval: 2 * 60 * 1000,
    staleTime: 60 * 1000,
  });

  const { data: systems = [], isLoading: systemsLoading, refetch: refetchSystems } = useQuery<any[]>({
    queryKey: [`/api/external-systems?departmentId=${DEPARTMENT_ID}`],
    refetchInterval: 3 * 60 * 1000,
  });

  const { data: tickets = [], isLoading: ticketsLoading } = useQuery<any[]>({
    queryKey: [`/api/it-tickets?departmentId=${DEPARTMENT_ID}`],
    refetchInterval: 2 * 60 * 1000,
  });

  const { data: incomingTasks = [], isLoading: tasksLoading } = useQuery<any[]>({
    queryKey: [`/api/tasks/it-department/${DEPARTMENT_ID}`],
    refetchInterval: 2 * 60 * 1000,
  });

  const addServerMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/it-assets', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/infrastructure'] });
      toast({ title: 'تم إضافة السيرفر بنجاح' });
      setIsAddServerOpen(false);
      setServerForm({ nameAr: '', assetType: 'server', location: '' });
    },
    onError: () => {
      toast({ title: 'حدث خطأ في إضافة السيرفر', variant: 'destructive' });
    }
  });

  const updateTaskStatus = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: number; status: string }) => {
      return apiRequest('PUT', `/api/tasks/${taskId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/it-department/${DEPARTMENT_ID}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/infrastructure'] });
      toast({ title: 'تم تحديث حالة المهمة بنجاح' });
      setSelectedTask(null);
    },
    onError: () => {
      toast({ title: 'فشل تحديث حالة المهمة', variant: 'destructive' });
    },
  });

  const isLoading = dashboardLoading || systemsLoading || ticketsLoading || tasksLoading;

  const pendingTasks = incomingTasks.filter((t: any) => t.status === 'pending' || t.status === 'assigned');

  const srv = dashboardData?.servers ?? { total: 0, online: 0, offline: 0, maintenance: 0 };
  const net = dashboardData?.networks ?? { total: 0, active: 0 };
  const stor = dashboardData?.storage ?? { total: 0, totalCapacityGB: 0, usedCapacityGB: 0, usagePercent: 0 };
  const mon = dashboardData?.monitoring ?? { activeAlerts: 0, critical: 0, warning: 0 };
  const tix = dashboardData?.tickets ?? { total: 0, open: 0 };
  const proj = dashboardData?.projects ?? { total: 0, active: 0 };
  const tsk = dashboardData?.tasks ?? { total: 0, pending: 0 };

  const handleRefresh = () => {
    refetchDashboard();
    refetchSystems();
    toast({ title: 'جاري تحديث البيانات...' });
  };

  const handleExportPDF = () => {
    const data = systems.map((s: any) => ({
      name: s.name || '',
      status: formatStatus(s.status || ''),
      healthStatus: s.healthStatus || '',
      ipAddress: s.ipAddress || '',
      type: s.type || '',
    }));
    const columns = [
      { header: 'اسم النظام', key: 'name' },
      { header: 'الحالة', key: 'status' },
      { header: 'الصحة', key: 'healthStatus' },
      { header: 'عنوان IP', key: 'ipAddress' },
      { header: 'النوع', key: 'type' },
    ];
    exportToPDF({ data, columns, title: 'تقرير البنية التحتية', filename: 'infrastructure-report', orientation: 'landscape' });
  };

  const handleExportExcel = () => {
    const data = systems.map((s: any) => ({
      name: s.name || '',
      status: formatStatus(s.status || ''),
      healthStatus: s.healthStatus || '',
      ipAddress: s.ipAddress || '',
      type: s.type || '',
    }));
    const columns = [
      { header: 'اسم النظام', key: 'name' },
      { header: 'الحالة', key: 'status' },
      { header: 'الصحة', key: 'healthStatus' },
      { header: 'عنوان IP', key: 'ipAddress' },
      { header: 'النوع', key: 'type' },
    ];
    exportToExcel({ data, columns, title: 'تقرير البنية التحتية', filename: 'infrastructure-report' });
  };

  return (
    <DashboardLayout
      title="إدارة البنية التحتية"
      subtitle="إدارة الخوادم والشبكات والتخزين"
      navGroups={infrastructureNavGroups}
      portalName="البنية التحتية"
    >
      <div className="space-y-6">
        <WelcomeBanner
          userName={user?.name || ''}
          portalName="البنية التحتية"
          portal="infrastructure"
          stats={{
            openTickets: dashboardData?.tickets?.open || 0,
            downServers: dashboardData?.servers?.offline || 0,
            activeProjects: dashboardData?.projects?.active || 0,
          }}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <SmartDailyOps
              portal="infrastructure"
              portalLabel="البنية التحتية"
              onNavigate={setLocation}
              ticketsPath="/department/infrastructure/tickets"
              tasksPath="/department/infrastructure/tasks"
              referralsPath="/department/infrastructure/referrals"
            />
          </div>
          <MyDayWidget portal="infrastructure" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SmartBookmarks portal="infrastructure" onNavigate={setLocation} />
          <QuickNotes portal="infrastructure" />
        </div>
        <div className="flex items-center justify-between flex-wrap gap-2 animate-fadeInUp">
          <div>
            <h1 className="text-2xl font-bold text-white" data-testid="text-welcome">مرحبا، {user?.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-white/60 text-sm" data-testid="text-subtitle">لوحة تحكم إدارة البنية التحتية</p>
              {dashboardUpdatedAt > 0 && (
                <span className="flex items-center gap-1 text-[10px] text-white/30 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                  <Activity className="w-2.5 h-2.5" />
                  تحديث تلقائي · آخر تحديث {new Date(dashboardUpdatedAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
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
            <Button className="btn-gold" size="sm" onClick={() => setIsAddServerOpen(true)} data-testid="button-add-server">
              <Plus className="w-4 h-4 ml-2" />
              إضافة سيرفر
            </Button>
          </div>
        </div>

        {isLoading ? (
          <DashboardSkeleton />
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="grid-server-status">
              {/* Total servers */}
              <Card className="hub-card hub-card-hover relative overflow-hidden">
                <div className="absolute inset-y-0 right-0 w-[3px] bg-white/20" />
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <p className="text-xs text-white/55 font-medium">إجمالي الخوادم</p>
                    <div className="p-2 bg-white/10 rounded-lg">
                      <Server className="w-4 h-4 text-white/70" />
                    </div>
                  </div>
                  <AnimatedNumber value={srv.total} className="text-3xl font-bold text-white hub-stat-number" data-testid="stat-servers-total" />
                  <div className="mt-3 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-white/30 rounded-full transition-all duration-700" style={{ width: `${srv.total > 0 ? 100 : 0}%` }} />
                  </div>
                  <p className="text-[10px] text-white/35 mt-1">{srv.online} متصل · {srv.offline} مقطوع</p>
                </CardContent>
              </Card>

              {/* Online */}
              <Card className="hub-card hub-card-hover relative overflow-hidden">
                <div className="absolute inset-y-0 right-0 w-[3px] bg-emerald-500" />
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <p className="text-xs text-white/55 font-medium">متصل ويعمل</p>
                    <div className="p-2 bg-emerald-500/20 rounded-lg">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    </div>
                  </div>
                  <AnimatedNumber value={srv.online} className="text-3xl font-bold text-emerald-400 hub-stat-number" data-testid="stat-servers-online" />
                  <div className="mt-3 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${srv.total > 0 ? (srv.online / srv.total) * 100 : 0}%` }} />
                  </div>
                  <p className="text-[10px] text-white/35 mt-1">{srv.total > 0 ? Math.round((srv.online / srv.total) * 100) : 0}% من الإجمالي</p>
                </CardContent>
              </Card>

              {/* Offline */}
              <Card className={`hub-card hub-card-hover relative overflow-hidden ${srv.offline > 0 ? 'hub-critical-pulse' : ''}`}>
                <div className={`absolute inset-y-0 right-0 w-[3px] ${srv.offline > 0 ? 'bg-red-500' : 'bg-white/10'}`} />
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <p className="text-xs text-white/55 font-medium">غير متصل</p>
                    <div className={`p-2 rounded-lg ${srv.offline > 0 ? 'bg-red-500/20' : 'bg-white/10'}`}>
                      <AlertTriangle className={`w-4 h-4 ${srv.offline > 0 ? 'text-red-400' : 'text-white/40'}`} />
                    </div>
                  </div>
                  <AnimatedNumber value={srv.offline} className={`text-3xl font-bold hub-stat-number ${srv.offline > 0 ? 'text-red-400' : 'text-white/40'}`} data-testid="stat-servers-offline" />
                  <div className="mt-3 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${srv.offline > 0 ? 'bg-red-500' : 'bg-white/10'}`} style={{ width: `${srv.total > 0 ? (srv.offline / srv.total) * 100 : 0}%` }} />
                  </div>
                  <p className="text-[10px] text-white/35 mt-1">{srv.offline > 0 ? 'يحتاج تدخل' : 'جميعها متصلة ✓'}</p>
                </CardContent>
              </Card>

              {/* Maintenance */}
              <Card className="hub-card hub-card-hover relative overflow-hidden">
                <div className="absolute inset-y-0 right-0 w-[3px] bg-amber-400/60" />
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <p className="text-xs text-white/55 font-medium">تحت الصيانة</p>
                    <div className="hub-icon-gold p-2 rounded-lg">
                      <Wrench className="w-4 h-4 hub-stat-gold" />
                    </div>
                  </div>
                  <AnimatedNumber value={srv.maintenance} className="text-3xl font-bold hub-stat-gold hub-stat-number" data-testid="stat-servers-maintenance" />
                  <div className="mt-3 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400/60 rounded-full transition-all duration-700" style={{ width: `${srv.total > 0 ? (srv.maintenance / srv.total) * 100 : 0}%` }} />
                  </div>
                  <p className="text-[10px] text-white/35 mt-1">إجمالي التخزين: {stor.usagePercent}% مستخدم</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="hub-card" data-testid="card-network-storage">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Network className="w-5 h-5 hub-stat-gold" />
                    الشبكات والتخزين
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex items-center gap-4 p-3 bg-white/5 rounded-lg">
                    <div className="hub-icon-gold">
                      <Wifi className="w-5 h-5 hub-stat-gold" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-white/60">أجهزة الشبكة</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xl font-bold text-white" data-testid="stat-network-total">{net.total}</span>
                        <span className="text-white/40">/</span>
                        <span className="text-lg text-emerald-400" data-testid="stat-network-active">{net.active} نشط</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-white/5 rounded-lg">
                    <div className="flex items-center gap-4 mb-3">
                      <div className="hub-icon-gold">
                        <HardDrive className="w-5 h-5 hub-stat-gold" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-white/60">سعة التخزين</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xl font-bold text-white" data-testid="stat-storage-used">{stor.usedCapacityGB} GB</span>
                          <span className="text-white/40">من</span>
                          <span className="text-sm text-white/60" data-testid="stat-storage-total">{stor.totalCapacityGB} GB</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-white/50 mb-1">
                        <span>مستخدم</span>
                        <span data-testid="stat-storage-percent">{stor.usagePercent}%</span>
                      </div>
                      <Progress value={stor.usagePercent} className="h-2" data-testid="progress-storage" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hub-card" data-testid="card-monitoring-alerts">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Activity className="w-5 h-5 hub-stat-gold" />
                    تنبيهات المراقبة
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={() => setLocation('/department/infrastructure/monitoring')} data-testid="nav-monitoring-link">
                    المراقبة
                    <ArrowLeft className="w-4 h-4 mr-1" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center py-4">
                    <p className="text-4xl font-bold text-white" data-testid="stat-alerts-active">{mon.activeAlerts}</p>
                    <p className="text-sm text-white/60 mt-1">تنبيه نشط</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-center">
                      <p className="text-2xl font-bold text-red-400" data-testid="stat-alerts-critical">{mon.critical}</p>
                      <p className="text-xs text-red-400/80 mt-1">حرج</p>
                    </div>
                    <div className="p-3 bg-[hsl(43_74%_49%)]/10 border border-[hsl(43_74%_49%)]/20 rounded-lg text-center">
                      <p className="text-2xl font-bold hub-stat-gold" data-testid="stat-alerts-warning">{mon.warning}</p>
                      <p className="text-xs text-[hsl(43_74%_49%)]/80 mt-1">تحذير</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="hub-card" data-testid="card-department-operations">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="flex items-center gap-2 text-white">
                  <FolderKanban className="w-5 h-5 hub-stat-gold" />
                  عمليات الإدارة
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div
                    className="p-4 bg-white/5 rounded-lg hover-elevate cursor-pointer"
                    onClick={() => setLocation('/department/infrastructure/tickets')}
                    data-testid="nav-ops-tickets"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="hub-icon-gold">
                        <Ticket className="w-5 h-5 hub-stat-gold" />
                      </div>
                      <div>
                        <p className="text-sm text-white/60">التذاكر المفتوحة</p>
                        <p className="text-2xl font-bold text-white" data-testid="stat-tickets-open">{tix.open}</p>
                      </div>
                    </div>
                    <p className="text-xs text-white/40">من أصل {tix.total} تذكرة</p>
                  </div>

                  <div
                    className="p-4 bg-white/5 rounded-lg hover-elevate cursor-pointer"
                    onClick={() => setLocation('/department/infrastructure/projects')}
                    data-testid="nav-ops-projects"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-emerald-500/20 rounded-lg">
                        <FolderKanban className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm text-white/60">المشاريع النشطة</p>
                        <p className="text-2xl font-bold text-white" data-testid="stat-projects-active">{proj.active}</p>
                      </div>
                    </div>
                    <p className="text-xs text-white/40">من أصل {proj.total} مشروع</p>
                  </div>

                  <div
                    className="p-4 bg-white/5 rounded-lg hover-elevate cursor-pointer"
                    onClick={() => setLocation('/department/infrastructure/tasks')}
                    data-testid="nav-ops-tasks"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-[hsl(222_47%_11%)]/40 rounded-lg">
                        <ListChecks className="w-5 h-5 text-white/80" />
                      </div>
                      <div>
                        <p className="text-sm text-white/60">مهام معلقة</p>
                        <p className="text-2xl font-bold text-white" data-testid="stat-tasks-pending">{tsk.pending}</p>
                      </div>
                    </div>
                    <p className="text-xs text-white/40">من أصل {tsk.total} مهمة</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {pendingTasks.length > 0 && (
              <Card className="hub-card hub-card-gold" data-testid="card-incoming-tasks">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Inbox className="w-5 h-5 hub-stat-gold" />
                    المهام الواردة من مدير تقنية المعلومات
                    <Badge className="mr-2 bg-[hsl(43_74%_49%)] text-muted-foreground">{pendingTasks.length} جديدة</Badge>
                  </CardTitle>
                  <CardDescription className="text-white/50">المهام المعينة لإدارة البنية التحتية والتي تنتظر المعالجة</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {pendingTasks.slice(0, 5).map((task: any) => (
                      <div
                        key={task.id}
                        className="flex items-center gap-4 p-4 bg-[hsl(43_74%_49%)]/5 border border-[hsl(43_74%_49%)]/20 rounded-lg hover-elevate cursor-pointer"
                        onClick={() => setSelectedTask(task)}
                        data-testid={`incoming-task-${task.id}`}
                      >
                        <div className="hub-icon-gold">
                          <Inbox className="w-5 h-5 hub-stat-gold" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-medium text-white">{task.title}</span>
                            <Badge variant={['high','critical','urgent'].includes(task.priority) ? 'destructive' : 'secondary'}>
                              {task.priority === 'urgent' ? 'عاجل' : task.priority === 'critical' ? 'حرج' : task.priority === 'high' ? 'عالي' : task.priority === 'medium' ? 'متوسط' : 'منخفض'}
                            </Badge>
                          </div>
                          <p className="text-sm text-white/50 line-clamp-1">{task.description}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-white/40">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              تاريخ الاستحقاق: {task.dueDate ? new Date(task.dueDate).toLocaleDateString('ar-SA') : 'غير محدد'}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setSelectedTask(task); }} data-testid={`view-task-${task.id}`}>
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
                        className="w-full"
                        variant="outline"
                        onClick={() => setLocation('/department/infrastructure/tasks')}
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
              <Card className="lg:col-span-2 hub-card" data-testid="card-servers-list">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Server className="w-5 h-5 hub-stat-gold" />
                    حالة السيرفرات
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={() => setLocation('/department/infrastructure/servers')} data-testid="nav-servers-link">
                    عرض الكل
                  </Button>
                </CardHeader>
                <CardContent>
                  {systems.length === 0 ? (
                    <div className="text-center py-8 text-white/50">
                      <Server className="w-12 h-12 mx-auto mb-3 text-white/45" />
                      <p>لا توجد أنظمة مسجلة</p>
                      <Button className="btn-gold mt-3" size="sm" onClick={() => setIsAddServerOpen(true)} data-testid="button-add-system">
                        <Plus className="w-4 h-4 ml-2" />
                        إضافة نظام جديد
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {systems.slice(0, 6).map((system: any) => (
                        <div
                          key={system.id}
                          className="flex items-center gap-4 p-3 bg-white/5 rounded-lg hover-elevate cursor-pointer"
                          data-testid={`server-${system.id}`}
                          onClick={() => setSelectedSystem(system)}
                        >
                          <div className={`p-2 rounded-lg ${system.healthStatus === 'online' ? 'bg-emerald-500/20' : 'bg-white/10'}`}>
                            <Server className={`w-5 h-5 ${system.healthStatus === 'online' ? 'text-emerald-400' : 'text-white/60'}`} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between flex-wrap gap-1 mb-1">
                              <span className="font-medium text-white">{system.nameAr || system.name}</span>
                              <Badge variant={system.healthStatus === 'online' ? 'default' : 'secondary'}>
                                {system.healthStatus === 'online' ? 'متصل' : system.healthStatus === 'offline' ? 'غير متصل' : 'صيانة'}
                              </Badge>
                            </div>
                            <p className="text-xs text-white/40">{system.description}</p>
                            <div className="flex items-center gap-3 mt-2 text-xs text-white/40 flex-wrap">
                              <span>{system.ipAddress}:{system.port}</span>
                              <Badge variant="outline" className="text-xs">{system.criticality === 'critical' ? 'حرج' : system.criticality === 'high' ? 'عالي' : 'متوسط'}</Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="hub-card" data-testid="card-quick-actions">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Activity className="w-5 h-5 hub-stat-gold" />
                    الإجراءات السريعة
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button className="w-full justify-start gap-2" variant="outline" onClick={() => setLocation('/department/infrastructure/servers')} data-testid="nav-servers">
                    <Server className="w-4 h-4" />
                    إدارة السيرفرات
                  </Button>
                  <Button className="w-full justify-start gap-2" variant="outline" onClick={() => setLocation('/department/infrastructure/network')} data-testid="nav-network">
                    <Network className="w-4 h-4" />
                    إدارة الشبكات
                  </Button>
                  <Button className="w-full justify-start gap-2" variant="outline" onClick={() => setLocation('/department/infrastructure/storage')} data-testid="nav-storage">
                    <HardDrive className="w-4 h-4" />
                    إدارة التخزين
                  </Button>
                  <Button className="w-full justify-start gap-2" variant="outline" onClick={() => setLocation('/department/infrastructure/monitoring')} data-testid="nav-monitoring">
                    <Monitor className="w-4 h-4" />
                    لوحة المراقبة
                  </Button>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>

      <Dialog open={isAddServerOpen} onOpenChange={setIsAddServerOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة سيرفر جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>اسم السيرفر</Label>
              <Input placeholder="SRV-NEW-01" value={serverForm.nameAr} onChange={e => setServerForm(f => ({ ...f, nameAr: e.target.value }))} data-testid="input-server-name" />
            </div>
            <div>
              <Label>النوع</Label>
              <Select value={serverForm.assetType} onValueChange={v => setServerForm(f => ({ ...f, assetType: v }))}>
                <SelectTrigger data-testid="select-server-type">
                  <SelectValue placeholder="اختر النوع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="server">إنتاج</SelectItem>
                  <SelectItem value="database">قاعدة بيانات</SelectItem>
                  <SelectItem value="backup">نسخ احتياطي</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>عنوان IP / الموقع</Label>
              <Input placeholder="10.0.1.x" value={serverForm.location} onChange={e => setServerForm(f => ({ ...f, location: e.target.value }))} data-testid="input-server-ip" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddServerOpen(false)} data-testid="button-cancel-server">إلغاء</Button>
            <Button className="btn-gold" disabled={!serverForm.nameAr.trim() || addServerMutation.isPending} onClick={() => addServerMutation.mutate({ nameAr: serverForm.nameAr, assetType: serverForm.assetType, location: serverForm.location, assetCode: `SRV-${Date.now()}`, status: 'active', assignedDepartmentId: DEPARTMENT_ID, dataClassification: 'restricted' })} data-testid="button-confirm-add-server">
              {addServerMutation.isPending ? 'جاري الإضافة...' : 'إضافة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedSystem} onOpenChange={() => setSelectedSystem(null)}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Server className="w-5 h-5 hub-stat-gold" />
              تفاصيل النظام
            </DialogTitle>
          </DialogHeader>
          {selectedSystem && (
            <div className="space-y-4">
              <div>
                <Label className="text-white/60">اسم النظام (عربي)</Label>
                <p className="font-medium text-lg text-white">{selectedSystem.nameAr || 'غير محدد'}</p>
              </div>
              <div>
                <Label className="text-white/60">اسم النظام (إنجليزي)</Label>
                <p className="font-medium text-white">{selectedSystem.name || 'غير محدد'}</p>
              </div>
              <div>
                <Label className="text-white/60">الوصف</Label>
                <p className="text-sm text-white/80">{selectedSystem.description || 'لا يوجد وصف'}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-white/60">الحالة</Label>
                  <div className="mt-1">
                    <Badge variant={selectedSystem.status === 'active' ? 'default' : 'secondary'}>
                      {selectedSystem.status === 'active' ? 'نشط' : selectedSystem.status === 'inactive' ? 'غير نشط' : selectedSystem.status || 'غير محدد'}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-white/60">حالة الاتصال</Label>
                  <div className="mt-1">
                    <Badge variant={selectedSystem.healthStatus === 'online' ? 'default' : 'destructive'}>
                      {selectedSystem.healthStatus === 'online' ? 'متصل' : selectedSystem.healthStatus === 'offline' ? 'غير متصل' : 'صيانة'}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-white/60">النوع</Label>
                  <p className="text-sm text-white/80">{selectedSystem.type || 'غير محدد'}</p>
                </div>
                <div>
                  <Label className="text-white/60">الأهمية</Label>
                  <div className="mt-1">
                    <Badge variant="outline">
                      {selectedSystem.criticality === 'critical' ? 'حرج' : selectedSystem.criticality === 'high' ? 'عالي' : 'متوسط'}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-white/60">عنوان IP</Label>
                  <p className="text-sm text-white/80">{selectedSystem.ipAddress || 'غير محدد'}</p>
                </div>
                <div>
                  <Label className="text-white/60">المنفذ</Label>
                  <p className="text-sm text-white/80">{selectedSystem.port || 'غير محدد'}</p>
                </div>
              </div>
              {selectedSystem.url && (
                <div>
                  <Label className="text-white/60">الرابط</Label>
                  <p className="text-sm text-white/80 break-all">{selectedSystem.url}</p>
                </div>
              )}
              {selectedSystem.vendor && (
                <div>
                  <Label className="text-white/60">المورد</Label>
                  <p className="text-sm text-white/80">{selectedSystem.vendor}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedSystem(null)} data-testid="button-close-system">إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
        <DialogContent className="max-w-lg" dir="rtl">
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
            <Button variant="outline" onClick={() => setSelectedTask(null)} data-testid="button-close-task">إغلاق</Button>
            {selectedTask?.status === 'pending' || selectedTask?.status === 'assigned' ? (
              <Button
                className="btn-gold"
                onClick={() => updateTaskStatus.mutate({ taskId: selectedTask.id, status: 'in_progress' })}
                disabled={updateTaskStatus.isPending}
                data-testid="button-start-task-dialog"
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
