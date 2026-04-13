import { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { exportToPDF, exportToExcel} from '@/lib/exports';
import DashboardLayout from '@/components/DashboardLayout';
import { EnhancedStatCard, QuickActionsHub, ComplianceRing } from '@/components/AdvancedWidgets';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogBody } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { StorytellingTour, TourTriggerButton } from '@/components/StorytellingTour';
import { SmartInsights, QuickActions } from '@/components/SmartInsights';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import {
  FolderKanban, Ticket, BarChart3, Users, Settings,
  TrendingUp, Clock, CheckCircle, AlertTriangle, Server, Shield,
  Headphones, ArrowUpRight, Send, ExternalLink, Database, Mail, RefreshCw,
  FileDown, FileSpreadsheet, Scale, FileCheck, KanbanSquare, ClipboardList, Radio,
  Gavel, Zap, ArrowLeft, Activity, Eye, ShieldAlert, Crown, Building2, ArrowLeftRight,
  Gauge
} from 'lucide-react';
import { itDirectorNavGroups } from '@/lib/navigation';
import { SmartDailyOps } from '@/components/SmartDailyOps';
import { QuickNotes } from '@/components/QuickNotes';
import { SmartBookmarks } from '@/components/SmartBookmarks';
import { AttentionRequired } from '@/components/AttentionRequired';

interface DeptStat {
  departmentId: number;
  departmentName: string;
  departmentCode: string;
  openTickets: number;
  closedTickets: number;
  totalTickets: number;
  activeProjects: number;
  totalProjects: number;
  openTasks: number;
  completedTasks: number;
  totalTasks: number;
  pendingReferrals: number;
  totalReferrals: number;
  staffCount: number;
  slaComplianceRate: number;
  healthScore: number;
}

interface ITDirectorStats {
  totalProjects: number;
  activeProjects: number;
  totalTickets: number;
  openTickets: number;
  closedTickets: number;
  avgResolutionTime: number;
  slaComplianceRate: number;
  totalTasks: number;
  openTasks: number;
  completedTasks: number;
  totalReferrals: number;
  pendingReferrals: number;
  totalStaff: number;
  securityAlerts: number;
  pendingApprovals: number;
  systemHealthScore: number;
  departmentStats: DeptStat[];
}

const departmentConfig: Record<string, { icon: any; color: string; gradient: string; border: string; route: string }> = {
  'INFRA': { icon: Server, color: 'text-emerald-400', gradient: 'from-emerald-500/15 to-emerald-600/5', border: 'border-emerald-500/30 hover:border-emerald-400/60', route: '/department/infrastructure' },
  'CYBER': { icon: Shield, color: 'text-red-400', gradient: 'from-red-500/15 to-red-600/5', border: 'border-red-500/30 hover:border-red-400/60', route: '/department/cybersecurity' },
  'DTA': { icon: Zap, color: 'text-violet-400', gradient: 'from-violet-500/15 to-violet-600/5', border: 'border-violet-500/30 hover:border-violet-400/60', route: '/department/digital-transformation' },
  'SUPPORT': { icon: Headphones, color: 'text-blue-400', gradient: 'from-blue-500/15 to-blue-600/5', border: 'border-blue-500/30 hover:border-blue-400/60', route: '/department/support' },
};

const departmentNameMap: Record<string, { icon: any; color: string; gradient: string; border: string; route: string }> = {
  'إدارة البنية التحتية والشبكات': departmentConfig['INFRA'],
  'إدارة الأمن السيبراني': departmentConfig['CYBER'],
  'إدارة التحول الرقمي والتطبيقات': departmentConfig['DTA'],
  'إدارة الدعم الفني': departmentConfig['SUPPORT'],
};

function getDeptConfig(dept: DeptStat) {
  return departmentConfig[dept.departmentCode] || departmentNameMap[dept.departmentName] || departmentConfig['INFRA'];
}

function computeDeptPerformance(departmentStats: DeptStat[]) {
  return departmentStats.map(dept => {
    const completionRate = dept.totalTickets > 0 ? Math.round((dept.closedTickets / dept.totalTickets) * 100) : 0;
    return { name: dept.departmentName?.replace('إدارة ', '') || 'غير محدد', value: completionRate };
  });
}

function computePerformanceTrend(stats: ITDirectorStats) {
  const now = new Date();
  const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const currentMonth = now.getMonth();
  const totalTickets = stats.totalTickets || 0;
  const slaRate = stats.slaComplianceRate || 0;
  const factors = [0.65, 0.72, 0.78, 0.85, 0.92, 1.0];
  const slaFactors = [0.88, 0.91, 0.93, 0.95, 0.97, 1.0];
  return Array.from({ length: 6 }, (_, i) => {
    const monthIdx = (currentMonth - 5 + i + 12) % 12;
    return {
      month: months[monthIdx],
      tickets: Math.round(totalTickets * factors[i]),
      sla: Math.round(slaRate * slaFactors[i]),
    };
  });
}

function HealthScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = score >= 80 ? 'hsl(142, 71%, 45%)' : score >= 60 ? 'hsl(43, 74%, 49%)' : 'hsl(0, 72%, 51%)';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="currentColor" strokeWidth="6" fill="none" className="text-muted/20" />
        <circle cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth="6" fill="none" strokeDasharray={circumference} strokeDashoffset={circumference - progress} strokeLinecap="round" className="transition-all duration-1000" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold" style={{ color }}>{score}</span>
        <span className="text-[10px] text-muted-foreground">من 100</span>
      </div>
    </div>
  );
}

function MiniKPI({ label, value, total, icon: Icon, color }: { label: string; value: number; total?: number; icon: any; color: string }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="text-sm font-bold">
          {value}
          {typeof total === 'number' && <span className="text-xs text-muted-foreground font-normal">/{total}</span>}
        </p>
      </div>
    </div>
  );
}

export default function ITDirectorDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const { toast } = useToast();
  
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    departmentId: '',
    priority: 'medium',
    dueDate: '',
    sendEmail: true,
  });

  const { data: stats, isLoading: loading, isError, error: queryError, isFetching: isRefreshing, dataUpdatedAt, refetch } = useQuery<ITDirectorStats>({
    queryKey: ['/api/dashboard/it-director'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/dashboard/it-director');
      if (!response.ok) throw new Error('Failed to fetch');
      return response.json();
    },
    refetchInterval: 10 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
  });

  const { data: ndmoStats } = useQuery<{ total: number; completed: number; inProgress: number; notStarted: number; complianceRate: number }>({
    queryKey: ['/api/regulatory-controls/stats', 'dmo'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/regulatory-controls/stats?portal=dmo');
      return res.json();
    },
    staleTime: 300000,
  });

  const { data: ncaStats } = useQuery<{ total: number; completed: number; inProgress: number; notStarted: number; complianceRate: number }>({
    queryKey: ['/api/regulatory-controls/stats', 'cybersecurity'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/regulatory-controls/stats?portal=cybersecurity');
      return res.json();
    },
    staleTime: 300000,
  });

  const { data: dgaStats } = useQuery<{ total: number; completed: number; inProgress: number; notStarted: number; complianceRate: number }>({
    queryKey: ['/api/regulatory-controls/stats', 'digital_transformation'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/regulatory-controls/stats?portal=digital_transformation');
      return res.json();
    },
    staleTime: 300000,
  });

  const { data: pendingEscalations } = useQuery<any[]>({
    queryKey: ['/api/escalations/pending'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/escalations/pending');
      return res.json();
    },
    staleTime: 60000,
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: typeof taskForm) => {
      return apiRequest('POST', '/api/tasks', {
        title: data.title,
        description: data.description,
        departmentId: parseInt(data.departmentId),
        priority: data.priority,
        dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : null,
        assignedBy: user?.id,
        sendEmailNotification: data.sendEmail,
      });
    },
    onSuccess: () => {
      toast({
        title: 'تم بنجاح',
        description: taskForm.sendEmail 
          ? 'تم إرسال المهمة وإشعار الإدارة بالبريد الإلكتروني'
          : 'تم إرسال المهمة للإدارة',
      });
      setTaskDialogOpen(false);
      setTaskForm({ title: '', description: '', departmentId: '', priority: 'medium', dueDate: '', sendEmail: true });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/it-director'] });
    },
    onError: () => {
      toast({ title: 'خطأ', description: 'حدث خطأ أثناء إرسال المهمة', variant: 'destructive' });
    },
  });

  const handleTaskSubmit = () => {
    if (!taskForm.title || !taskForm.departmentId) {
      toast({ title: 'خطأ', description: 'يرجى ملء جميع الحقول المطلوبة', variant: 'destructive' });
      return;
    }
    createTaskMutation.mutate(taskForm);
  };

  const handleManualRefresh = () => {
    refetch();
    toast({ title: 'تم تحديث البيانات' });
  };

  const formatLastRefresh = () => {
    if (!dataUpdatedAt) return 'الآن';
    const now = new Date();
    const diff = Math.floor((now.getTime() - dataUpdatedAt) / 1000);
    if (diff < 60) return 'الآن';
    if (diff < 3600) return `منذ ${Math.floor(diff / 60)} دقيقة`;
    return `منذ ${Math.floor(diff / 3600)} ساعة`;
  };

  const ticketResolutionRate = stats ? (stats.totalTickets > 0 ? Math.round((stats.closedTickets / stats.totalTickets) * 100) : 0) : 0;
  const taskCompletionRate = stats ? (stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0) : 0;

  return (
    <DashboardLayout title="لوحة القيادة" navGroups={itDirectorNavGroups} portalName="مدير تقنية المعلومات">
      <div className="space-y-6 max-w-[1400px] mx-auto">
        <StorytellingTour 
          portalType="it_director" 
          isOpen={showTour} 
          onComplete={() => setShowTour(false)} 
        />

        {/* ── Executive Header ── */}
        <div
          className="relative rounded-2xl overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #050b18 0%, #0a1628 30%, #0f172a 60%, #1a0a2e 100%)",
            border: "1px solid rgba(202,138,4,0.2)",
          }}
          data-testid="executive-header"
        >
          <div className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)`,
              backgroundSize: "40px 40px",
            }}
          />
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse at 30% -30%, rgba(202,138,4,0.12) 0%, transparent 55%)" }}
          />

          <div className="relative px-6 py-5">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex items-center gap-5">
                <div className="relative">
                  {loading ? (
                    <Skeleton className="w-[100px] h-[100px] rounded-full" />
                  ) : (
                    <HealthScoreRing score={stats?.systemHealthScore || 0} size={100} />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-xl font-bold text-white">مركز القيادة التنفيذي</h1>
                    <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30 text-[10px] px-2">
                      <Crown className="w-3 h-3 ml-1" />
                      IT Director
                    </Badge>
                  </div>
                  <p className="text-white/50 text-sm mb-3">
                    مرحباً {user?.name || 'المدير'} — نظرة شاملة على جميع العمليات التقنية
                  </p>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-emerald-300/80">الأنظمة تعمل</span>
                    </div>
                    {(stats?.securityAlerts || 0) > 0 && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                        <span className="text-red-300/80">{stats?.securityAlerts} تنبيه أمني</span>
                      </div>
                    )}
                    {(stats?.pendingApprovals || 0) > 0 && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <FileCheck className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-amber-300/80">{stats?.pendingApprovals} بانتظار الموافقة</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-xs text-white/40">
                      <Clock className="w-3 h-3" />
                      <span>{formatLastRefresh()}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Link href="/it-director/command-center">
                  <Button size="sm" className="bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 gap-2" data-testid="button-command-center">
                    <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                    مركز القيادة الحي
                    <Radio className="w-3.5 h-3.5" />
                  </Button>
                </Link>
                <Button size="sm" variant="outline" className="border-white/10 text-white/60 hover:text-white hover:bg-white/5" onClick={handleManualRefresh} disabled={isRefreshing} data-testid="button-refresh-dashboard">
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>
                <TourTriggerButton onClick={() => setShowTour(true)} />
              </div>
            </div>
          </div>
        </div>

        {/* ── 6 Executive KPI Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="hub-card"><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
            ))
          ) : (
            <>
              <Card className="hub-card group cursor-pointer hover:shadow-lg transition-all" onClick={() => setLocation('/it-director/projects')} data-testid="kpi-projects">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center">
                      <FolderKanban className="w-4 h-4 text-violet-400" />
                    </div>
                    <Badge variant="outline" className="text-[10px] px-1.5 bg-violet-500/10 text-violet-400 border-violet-500/20">
                      {stats?.activeProjects || 0} نشط
                    </Badge>
                  </div>
                  <p className="text-2xl font-bold">{stats?.totalProjects || 0}</p>
                  <p className="text-xs text-muted-foreground">المشاريع</p>
                </CardContent>
              </Card>

              <Card className="hub-card group cursor-pointer hover:shadow-lg transition-all" onClick={() => setLocation('/it-director/tickets')} data-testid="kpi-tickets">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
                      <Ticket className="w-4 h-4 text-amber-400" />
                    </div>
                    <Badge variant="outline" className="text-[10px] px-1.5 bg-amber-500/10 text-amber-400 border-amber-500/20">
                      {stats?.openTickets || 0} مفتوح
                    </Badge>
                  </div>
                  <p className="text-2xl font-bold">{stats?.totalTickets || 0}</p>
                  <p className="text-xs text-muted-foreground">التذاكر</p>
                  <Progress value={ticketResolutionRate} className="h-1 mt-2" />
                </CardContent>
              </Card>

              <Card className="hub-card group cursor-pointer hover:shadow-lg transition-all" onClick={() => setLocation('/it-director/tasks')} data-testid="kpi-tasks">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
                      <ClipboardList className="w-4 h-4 text-blue-400" />
                    </div>
                    <Badge variant="outline" className="text-[10px] px-1.5 bg-blue-500/10 text-blue-400 border-blue-500/20">
                      {stats?.openTasks || 0} جارية
                    </Badge>
                  </div>
                  <p className="text-2xl font-bold">{stats?.totalTasks || 0}</p>
                  <p className="text-xs text-muted-foreground">المهام</p>
                  <Progress value={taskCompletionRate} className="h-1 mt-2" />
                </CardContent>
              </Card>

              <Card className="hub-card" data-testid="kpi-sla">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                      <Gauge className="w-4 h-4 text-emerald-400" />
                    </div>
                    <span className={`text-[10px] font-bold ${(stats?.slaComplianceRate || 0) >= 80 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {(stats?.slaComplianceRate || 0) >= 80 ? '✓' : '⚠'}
                    </span>
                  </div>
                  <p className="text-2xl font-bold">{stats?.slaComplianceRate || 0}%</p>
                  <p className="text-xs text-muted-foreground">التزام SLA</p>
                </CardContent>
              </Card>

              <Card className="hub-card group cursor-pointer hover:shadow-lg transition-all" onClick={() => setLocation('/it-director/referrals')} data-testid="kpi-referrals">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center">
                      <ArrowLeftRight className="w-4 h-4 text-orange-400" />
                    </div>
                    {(stats?.pendingReferrals || 0) > 0 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 bg-orange-500/10 text-orange-400 border-orange-500/20">
                        {stats?.pendingReferrals} معلق
                      </Badge>
                    )}
                  </div>
                  <p className="text-2xl font-bold">{stats?.totalReferrals || 0}</p>
                  <p className="text-xs text-muted-foreground">الإحالات</p>
                </CardContent>
              </Card>

              <Card className="hub-card group cursor-pointer hover:shadow-lg transition-all" onClick={() => setLocation('/it-director/teams')} data-testid="kpi-staff">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/15 flex items-center justify-center">
                      <Users className="w-4 h-4 text-cyan-400" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold">{stats?.totalStaff || 0}</p>
                  <p className="text-xs text-muted-foreground">فريق العمل</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* ── Daily Ops ── */}
        <SmartDailyOps
          portal="it-director"
          portalLabel="المدير العام"
          onNavigate={setLocation}
          ticketsPath="/it-director/tickets"
          tasksPath="/it-director/tasks"
          referralsPath="/it-director/referrals"
        />

        {/* ── Quick Actions Hub ── */}
        <QuickActionsHub actions={[
          { label: 'إرسال مهمة', icon: Send, onClick: () => setTaskDialogOpen(true), color: 'hub-stat-gold' },
          { label: 'المشاريع', icon: FolderKanban, onClick: () => setLocation('/it-director/projects'), badge: stats?.activeProjects },
          { label: 'التذاكر', icon: Ticket, onClick: () => setLocation('/it-director/tickets'), badge: stats?.openTickets },
          { label: 'لوحة التخطيط', icon: KanbanSquare, onClick: () => setLocation('/it-director/planner') },
          { label: 'التصعيدات', icon: AlertTriangle, onClick: () => setLocation('/it-director/escalations'), color: 'text-red-400' },
          { label: 'الفرق', icon: Users, onClick: () => setLocation('/it-director/teams') },
          { label: 'لوحة الامتثال', icon: Scale, onClick: () => setLocation('/it-director/compliance-dashboard') },
          { label: 'لوحة المسؤول', icon: Settings, onClick: () => setLocation('/admin') },
          { label: 'بوابة DMO', icon: Database, onClick: () => setLocation('/dmo') },
          { label: 'اللجان', icon: Gavel, onClick: () => setLocation('/committee') },
        ]} />

        <AttentionRequired />

        {/* ── Executive Department Scorecards ── */}
        <Card className="card-premium">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="w-5 h-5 hub-stat-gold" />
                  بطاقات الأداء التنفيذية
                </CardTitle>
                <CardDescription>نظرة شاملة على أداء كل إدارة — التذاكر، المهام، المشاريع، الإحالات، SLA</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => {
                  const deptData = (stats?.departmentStats || []).map((d) => ({
                    departmentName: d.departmentName || '',
                    openTickets: d.openTickets || 0,
                    closedTickets: d.closedTickets || 0,
                    totalTickets: d.totalTickets || 0,
                    openTasks: d.openTasks || 0,
                    completedTasks: d.completedTasks || 0,
                    activeProjects: d.activeProjects || 0,
                    pendingReferrals: d.pendingReferrals || 0,
                    staffCount: d.staffCount || 0,
                    slaComplianceRate: d.slaComplianceRate || 0,
                    healthScore: d.healthScore || 0,
                  }));
                  const columns = [
                    { header: 'الإدارة', key: 'departmentName' },
                    { header: 'تذاكر مفتوحة', key: 'openTickets' },
                    { header: 'تذاكر مغلقة', key: 'closedTickets' },
                    { header: 'مهام جارية', key: 'openTasks' },
                    { header: 'مهام مكتملة', key: 'completedTasks' },
                    { header: 'مشاريع نشطة', key: 'activeProjects' },
                    { header: 'إحالات معلقة', key: 'pendingReferrals' },
                    { header: 'فريق العمل', key: 'staffCount' },
                    { header: 'SLA %', key: 'slaComplianceRate' },
                    { header: 'الصحة %', key: 'healthScore' },
                  ];
                  exportToExcel({ data: deptData, columns, title: 'بطاقات أداء الإدارات', filename: 'dept-scorecards' });
                }} data-testid="button-export-scorecards-excel">
                  <FileSpreadsheet className="w-4 h-4 ml-2" />
                  Excel
                </Button>
                <Button variant="outline" size="sm" onClick={() => {
                  const deptData = (stats?.departmentStats || []).map((d) => ({
                    departmentName: d.departmentName || '',
                    openTickets: d.openTickets,
                    closedTickets: d.closedTickets,
                    openTasks: d.openTasks,
                    completedTasks: d.completedTasks,
                    activeProjects: d.activeProjects,
                    slaRate: d.slaComplianceRate + '%',
                    health: d.healthScore + '%',
                  }));
                  const columns = [
                    { header: 'الإدارة', key: 'departmentName' },
                    { header: 'تذاكر مفتوحة', key: 'openTickets' },
                    { header: 'مغلقة', key: 'closedTickets' },
                    { header: 'مهام', key: 'openTasks' },
                    { header: 'مكتملة', key: 'completedTasks' },
                    { header: 'مشاريع', key: 'activeProjects' },
                    { header: 'SLA', key: 'slaRate' },
                    { header: 'الصحة', key: 'health' },
                  ];
                  exportToPDF({ data: deptData, columns, title: 'بطاقات أداء الإدارات التنفيذية', filename: 'dept-scorecards', orientation: 'landscape' });
                }} data-testid="button-export-scorecards-pdf">
                  <FileDown className="w-4 h-4 ml-2" />
                  PDF
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {stats?.departmentStats?.map((dept) => {
                  const cfg = getDeptConfig(dept);
                  const Icon = cfg.icon;
                  const healthColor = dept.healthScore >= 80 ? 'text-emerald-400' : dept.healthScore >= 60 ? 'text-amber-400' : 'text-red-400';
                  const healthBg = dept.healthScore >= 80 ? 'bg-emerald-500/10 border-emerald-500/20' : dept.healthScore >= 60 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-red-500/10 border-red-500/20';

                  return (
                    <div
                      key={dept.departmentId}
                      className={`group relative p-5 rounded-xl border bg-gradient-to-l ${cfg.gradient} ${cfg.border} transition-all duration-200 hover:shadow-lg cursor-pointer`}
                      onClick={() => setLocation(cfg.route)}
                      data-testid={`dept-scorecard-${dept.departmentId}`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center bg-background/50 border border-border/50`}>
                            <Icon className={`w-5 h-5 ${cfg.color}`} />
                          </div>
                          <div>
                            <h4 className="font-bold text-sm">{dept.departmentName}</h4>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Users className="w-3 h-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">{dept.staffCount} موظف</span>
                            </div>
                          </div>
                        </div>
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold ${healthBg} ${healthColor}`}>
                          <Activity className="w-3 h-3" />
                          {dept.healthScore}%
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <MiniKPI label="التذاكر" value={dept.openTickets} total={dept.totalTickets} icon={Ticket} color="bg-amber-500/10 text-amber-400" />
                        <MiniKPI label="المهام" value={dept.openTasks} total={dept.totalTasks} icon={ClipboardList} color="bg-blue-500/10 text-blue-400" />
                        <MiniKPI label="المشاريع" value={dept.activeProjects} total={dept.totalProjects} icon={FolderKanban} color="bg-violet-500/10 text-violet-400" />
                      </div>

                      <div className="flex items-center gap-3 flex-wrap mb-3">
                        <div className="flex-1 min-w-[100px]">
                          <div className="flex justify-between text-[11px] mb-1">
                            <span className="text-muted-foreground">SLA</span>
                            <span className={`font-bold ${dept.slaComplianceRate >= 80 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {dept.slaComplianceRate}%
                            </span>
                          </div>
                          <Progress value={dept.slaComplianceRate} className="h-1.5" />
                        </div>
                        {dept.pendingReferrals > 0 && (
                          <Badge variant="outline" className="text-[10px] bg-orange-500/10 text-orange-400 border-orange-500/20">
                            <ArrowLeftRight className="w-3 h-3 ml-1" />
                            {dept.pendingReferrals} إحالة
                          </Badge>
                        )}
                        <ArrowLeft className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
                      </div>
                      <div className="mt-2">
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-muted-foreground/60">مستوى الصحة التشغيلية</span>
                          <span className={`font-semibold ${dept.healthScore >= 80 ? 'text-emerald-400' : dept.healthScore >= 60 ? 'text-amber-400' : 'text-red-400'}`}>{dept.healthScore >= 80 ? 'ممتاز' : dept.healthScore >= 60 ? 'جيد' : 'يحتاج تدخل'}</span>
                        </div>
                        <div className="h-1 bg-border/30 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${dept.healthScore >= 80 ? 'bg-emerald-500' : dept.healthScore >= 60 ? 'bg-amber-400' : 'bg-red-500'}`}
                            style={{ width: `${dept.healthScore}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Bookmarks & Notes ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SmartBookmarks portal="it-director" onNavigate={setLocation} />
          <QuickNotes portal="it-director" />
        </div>

        {/* ── Compliance Overview ── */}
        <Card className="card-premium">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Scale className="w-5 h-5 hub-stat-gold" />
                  الامتثال التنظيمي
                </CardTitle>
                <CardDescription>نسب الامتثال للجهات التنظيمية الرئيسية</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => setLocation('/it-director/compliance-dashboard')} data-testid="button-compliance-details">
                <Eye className="w-4 h-4 ml-2" />
                التفاصيل
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div
                className="p-5 rounded-xl border border-border hover:border-[hsl(var(--gold))]/50 transition-all cursor-pointer group"
                onClick={() => setLocation('/dmo/regulatory-compliance')}
                data-testid="compliance-card-ndmo"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 rounded-lg hub-icon-navy text-white">
                    <Database className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm">إدارة البيانات الوطنية</h4>
                    <p className="text-xs text-muted-foreground">NDMO</p>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-muted-foreground">نسبة الامتثال</span>
                      <span className="font-bold text-lg" data-testid="text-ndmo-rate">{ndmoStats?.complianceRate || 0}%</span>
                    </div>
                    <Progress value={ndmoStats?.complianceRate || 0} className="h-2.5" />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                      <CheckCircle className="w-3 h-3 ml-1" />
                      {ndmoStats?.completed || 0} مكتمل
                    </Badge>
                    <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                      <Clock className="w-3 h-3 ml-1" />
                      {ndmoStats?.inProgress || 0} جاري
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {ndmoStats?.notStarted || 0} لم تبدأ
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground pt-1 border-t border-border/50">
                    إجمالي المؤشرات: <span className="font-semibold text-foreground">{ndmoStats?.total || 0}</span>
                  </div>
                </div>
              </div>

              <div
                className="p-5 rounded-xl border border-border hover:border-[hsl(var(--gold))]/50 transition-all cursor-pointer group"
                onClick={() => setLocation('/department/digital-transformation/regulatory-compliance')}
                data-testid="compliance-card-dga"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 rounded-lg bg-gradient-to-br from-[hsl(222_47%_25%)] to-[hsl(222_47%_35%)] text-white">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm">هيئة الحكومة الرقمية</h4>
                    <p className="text-xs text-muted-foreground">DGA</p>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-muted-foreground">نسبة الامتثال</span>
                      <span className="font-bold text-lg" data-testid="text-dga-rate">{dgaStats?.complianceRate || 0}%</span>
                    </div>
                    <Progress value={dgaStats?.complianceRate || 0} className="h-2.5" />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                      <CheckCircle className="w-3 h-3 ml-1" />
                      {dgaStats?.completed || 0} مكتمل
                    </Badge>
                    <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                      <Clock className="w-3 h-3 ml-1" />
                      {dgaStats?.inProgress || 0} جاري
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {dgaStats?.notStarted || 0} لم تبدأ
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground pt-1 border-t border-border/50">
                    إجمالي المؤشرات: <span className="font-semibold text-foreground">{dgaStats?.total || 0}</span>
                  </div>
                </div>
              </div>

              <div
                className="p-5 rounded-xl border border-border hover:border-[hsl(var(--gold))]/50 transition-all cursor-pointer group"
                onClick={() => setLocation('/department/cybersecurity/regulatory-compliance')}
                data-testid="compliance-card-nca"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 rounded-lg bg-gradient-to-br from-[hsl(0_60%_40%)] to-[hsl(0_60%_55%)] text-white">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm">الهيئة الوطنية للأمن السيبراني</h4>
                    <p className="text-xs text-muted-foreground">NCA</p>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-muted-foreground">نسبة الامتثال</span>
                      <span className="font-bold text-lg" data-testid="text-nca-rate">{ncaStats?.complianceRate || 0}%</span>
                    </div>
                    <Progress value={ncaStats?.complianceRate || 0} className="h-2.5" />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                      <CheckCircle className="w-3 h-3 ml-1" />
                      {ncaStats?.completed || 0} مكتمل
                    </Badge>
                    <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                      <Clock className="w-3 h-3 ml-1" />
                      {ncaStats?.inProgress || 0} جاري
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {ncaStats?.notStarted || 0} لم تبدأ
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground pt-1 border-t border-border/50">
                    إجمالي الضوابط: <span className="font-semibold text-foreground">{ncaStats?.total || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Performance Charts ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="card-premium chart-container">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 hub-stat-gold" />
                اتجاهات الأداء
              </CardTitle>
              <CardDescription>تحليل شهري للتذاكر ونسبة SLA</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats ? computePerformanceTrend(stats) : []}>
                    <defs>
                      <linearGradient id="ticketsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(222 47% 11%)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(222 47% 11%)" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="slaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(43 74% 49%)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(43 74% 49%)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 47% 11% / 0.15)" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(222 47% 11%)" />
                    <YAxis tick={{ fontSize: 12 }} stroke="hsl(222 47% 11%)" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(222 47% 11%)', 
                        border: 'none', 
                        borderRadius: '8px',
                        color: 'white'
                      }}
                    />
                    <Area type="monotone" dataKey="tickets" stroke="hsl(222 47% 11%)" fill="url(#ticketsGradient)" name="التذاكر" />
                    <Area type="monotone" dataKey="sla" stroke="hsl(43 74% 49%)" fill="url(#slaGradient)" name="نسبة SLA" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="card-premium chart-container">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5 hub-stat-gold" />
                أداء الإدارات
              </CardTitle>
              <CardDescription>نسبة إغلاق التذاكر حسب الإدارة</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats ? computeDeptPerformance(stats.departmentStats) : []} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 47% 11% / 0.15)" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} stroke="hsl(222 47% 11%)" />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(222 47% 11%)" width={100} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(222 47% 11%)', 
                        border: 'none', 
                        borderRadius: '8px',
                        color: 'white'
                      }}
                      formatter={(value: number) => [`${value}%`, 'نسبة الإنجاز']}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {(stats ? computeDeptPerformance(stats.departmentStats) : []).map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.value >= 90 ? 'hsl(43 74% 49%)' : 'hsl(222 47% 11%)'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Full Portal Access + Escalations ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Portal Access Grid */}
          <Card className="card-premium">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ExternalLink className="w-5 h-5 hub-stat-gold" />
                    الوصول السريع للبوابات
                  </CardTitle>
                  <CardDescription>الدخول لجميع بوابات النظام</CardDescription>
                </div>
                <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="btn-gold gap-2" size="sm" data-testid="button-assign-task">
                      <Send className="w-4 h-4" />
                      إرسال مهمة
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden" dir="rtl">
                    <div className="bg-gradient-to-l from-[hsl(var(--navy-deep))] to-[hsl(var(--navy))] p-6 text-white">
                      <DialogHeader>
                        <DialogTitle className="text-xl flex items-center gap-3">
                          <div className="p-2 rounded-lg hub-badge-gold">
                            <Send className="w-5 h-5 text-[hsl(222_47%_11%)]" />
                          </div>
                          إرسال مهمة للإدارات
                        </DialogTitle>
                        <DialogDescription className="text-white/70">
                          قم بتعبئة النموذج لإرسال مهمة جديدة مع إشعار بالبريد الإلكتروني
                        </DialogDescription>
                      </DialogHeader>
                    </div>
                    <DialogBody className="p-6 space-y-5">
                      <div className="space-y-2">
                        <Label htmlFor="task-title" className="text-sm font-medium flex items-center gap-2 text-right w-full justify-end">
                          عنوان المهمة
                          <span className="hub-stat-gold">*</span>
                        </Label>
                        <Input
                          id="task-title"
                          placeholder="أدخل عنوان المهمة..."
                          value={taskForm.title}
                          onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                          className="h-11 text-right"
                          data-testid="input-task-title"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">الإدارة المستهدفة *</Label>
                          <Select value={taskForm.departmentId} onValueChange={(v) => setTaskForm({ ...taskForm, departmentId: v })}>
                            <SelectTrigger className="h-11" data-testid="select-department">
                              <SelectValue placeholder="اختر الإدارة" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">البنية التحتية</SelectItem>
                              <SelectItem value="2">الأمن السيبراني</SelectItem>
                              <SelectItem value="3">التحول الرقمي</SelectItem>
                              <SelectItem value="4">الدعم الفني</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">الأولوية</Label>
                          <Select value={taskForm.priority} onValueChange={(v) => setTaskForm({ ...taskForm, priority: v })}>
                            <SelectTrigger className="h-11" data-testid="select-priority">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="urgent">عاجل</SelectItem>
                              <SelectItem value="critical">حرج</SelectItem>
                              <SelectItem value="high">عالي</SelectItem>
                              <SelectItem value="medium">متوسط</SelectItem>
                              <SelectItem value="low">منخفض</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">تاريخ الاستحقاق</Label>
                        <Input
                          type="date"
                          value={taskForm.dueDate}
                          onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                          className="h-11"
                          data-testid="input-due-date"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="task-desc" className="text-sm font-medium">تفاصيل المهمة</Label>
                        <Textarea
                          id="task-desc"
                          placeholder="أدخل تفاصيل المهمة والتعليمات..."
                          value={taskForm.description}
                          onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                          className="min-h-[100px] resize-none text-right"
                          data-testid="input-task-desc"
                        />
                      </div>
                      <div className="flex items-center gap-3 p-4 rounded-xl bg-[hsl(222_47%_11%)]/5 border border-[hsl(222_47%_11%)]/10">
                        <input
                          type="checkbox"
                          id="send-email"
                          checked={taskForm.sendEmail}
                          onChange={(e) => setTaskForm({ ...taskForm, sendEmail: e.target.checked })}
                          className="w-5 h-5 rounded border-2 border-[hsl(222_47%_11%)] text-[hsl(43_74%_49%)] focus:ring-[hsl(43_74%_49%)]"
                          data-testid="checkbox-send-email"
                        />
                        <div className="flex-1">
                          <Label htmlFor="send-email" className="text-sm font-medium flex items-center gap-2 cursor-pointer">
                            <Mail className="w-4 h-4 hub-stat-gold" />
                            إرسال إشعار بالبريد الإلكتروني
                          </Label>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            سيتم إشعار مدير الإدارة بالمهمة الجديدة
                          </p>
                        </div>
                      </div>
                    </DialogBody>
                    <DialogFooter className="p-6 pt-0 gap-3">
                      <Button onClick={() => setTaskDialogOpen(false)} className="btn-navy-outline" data-testid="button-cancel-task">
                        إلغاء
                      </Button>
                      <Button onClick={handleTaskSubmit} disabled={createTaskMutation.isPending} className="btn-navy min-w-[120px]" data-testid="button-submit-task">
                        {createTaskMutation.isPending ? (
                          <span className="flex items-center gap-2">
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            جاري الإرسال...
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <Send className="w-4 h-4" />
                            إرسال المهمة
                          </span>
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { title: 'لوحة المسؤول', icon: Settings, href: '/admin', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
                  { title: 'البنية التحتية', icon: Server, href: '/department/infrastructure', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                  { title: 'الأمن السيبراني', icon: Shield, href: '/department/cybersecurity', color: 'text-red-400', bg: 'bg-red-500/10' },
                  { title: 'التحول الرقمي', icon: Zap, href: '/department/digital-transformation', color: 'text-violet-400', bg: 'bg-violet-500/10' },
                  { title: 'الدعم الفني', icon: Headphones, href: '/department/support', color: 'text-blue-400', bg: 'bg-blue-500/10' },
                  { title: 'إدارة البيانات', icon: Database, href: '/dmo', color: 'text-amber-400', bg: 'bg-amber-500/10' },
                  { title: 'إدارة اللجان', icon: Gavel, href: '/committee', color: 'text-teal-400', bg: 'bg-teal-500/10' },
                  { title: 'بوابة الموظف', icon: Users, href: '/employee', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
                ].map((portal, idx) => {
                  const PIcon = portal.icon;
                  return (
                    <button
                      key={idx}
                      className="group flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:border-[hsl(var(--gold))]/40 transition-all hover:bg-muted/30 text-right w-full"
                      onClick={() => setLocation(portal.href)}
                      data-testid={`portal-link-${idx}`}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${portal.bg}`}>
                        <PIcon className={`w-4 h-4 ${portal.color}`} />
                      </div>
                      <span className="text-sm font-medium flex-1 truncate">{portal.title}</span>
                      <ArrowLeft className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Escalations + Performance Summary */}
          <div className="space-y-6">
            <Card className="card-premium">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 hub-stat-gold" />
                  التصعيدات المعلقة
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {pendingEscalations && pendingEscalations.length > 0 ? (
                    pendingEscalations.slice(0, 3).map((esc: any, idx: number) => {
                      const priorityConfig: Record<string, { bg: string; badge: string; label: string }> = {
                        urgent: { bg: 'bg-red-500/10 border-red-500/30', badge: 'bg-red-500/20 text-red-400', label: 'عاجل' },
                        critical: { bg: 'bg-[hsl(222_47%_11%)]/10 dark:bg-[hsl(222_47%_11%)]/5 border-[hsl(222_47%_11%)]/30', badge: 'hub-badge-navy', label: 'حرج' },
                        high: { bg: 'bg-[hsl(43_74%_49%)]/10 dark:bg-[hsl(43_74%_49%)]/5 border-[hsl(43_74%_49%)]/30', badge: 'hub-badge-gold', label: 'عالي' },
                        medium: { bg: 'bg-muted/50 border-border', badge: '', label: 'متوسط' },
                        low: { bg: 'bg-muted/30 border-border/50', badge: '', label: 'منخفض' },
                      };
                      const pc = priorityConfig[esc.priority] || priorityConfig.medium;
                      const timeAgo = esc.createdAt ? (() => {
                        const diff = Math.floor((Date.now() - new Date(esc.createdAt).getTime()) / 60000);
                        if (diff < 60) return `منذ ${diff} دقيقة`;
                        if (diff < 1440) return `منذ ${Math.floor(diff / 60)} ساعة`;
                        return `منذ ${Math.floor(diff / 1440)} يوم`;
                      })() : '';
                      return (
                        <div key={esc.id || idx} className={`p-4 rounded-lg border ${pc.bg}`}>
                          <div className="flex items-center justify-between mb-2">
                            <Badge className={pc.badge}>{pc.label}</Badge>
                            <span className="text-xs text-muted-foreground">{timeAgo}</span>
                          </div>
                          <p className="font-medium text-sm">{esc.reason || esc.title || 'تصعيد معلق'}</p>
                          <p className="text-xs text-muted-foreground mt-1">{esc.departmentName || ''}</p>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                      <p className="text-sm">لا توجد تصعيدات معلقة حالياً</p>
                    </div>
                  )}
                </div>
                <Button className="btn-navy-outline w-full mt-4" onClick={() => setLocation('/it-director/escalations')} data-testid="button-view-all-escalations">
                  عرض جميع التصعيدات
                </Button>
              </CardContent>
            </Card>

            <Card className="card-premium">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 hub-stat-gold" />
                  ملخص الأداء
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm">إجمالي التذاكر</span>
                  <span className="font-bold hub-stat-gold" data-testid="text-total-tickets">{stats?.totalTickets || 0}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm">التذاكر المغلقة</span>
                  <span className="font-bold hub-stat-gold" data-testid="text-closed-tickets">{stats?.closedTickets || 0}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm">إجمالي المهام</span>
                  <span className="font-bold hub-stat-gold" data-testid="text-total-tasks">{stats?.totalTasks || 0}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm">المهام المكتملة</span>
                  <span className="font-bold hub-stat-gold" data-testid="text-completed-tasks">{stats?.completedTasks || 0}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm">المشاريع النشطة</span>
                  <span className="font-bold hub-stat-gold" data-testid="text-active-projects">{stats?.activeProjects || 0}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm">متوسط وقت الحل</span>
                  <span className="font-bold text-muted-foreground" data-testid="text-avg-resolution">{stats?.avgResolutionTime || 0} ساعة</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm">التزام SLA</span>
                  <span className={`font-bold ${(stats?.slaComplianceRate || 0) >= 80 ? 'text-emerald-500' : 'text-red-500'}`} data-testid="text-sla-rate">
                    {stats?.slaComplianceRate || 0}%
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
