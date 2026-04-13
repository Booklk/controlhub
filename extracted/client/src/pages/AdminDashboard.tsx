import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import DashboardLayout from '@/components/DashboardLayout';
import { SmartDailyOps } from '@/components/SmartDailyOps';
import { SmartBookmarks } from '@/components/SmartBookmarks';
import { QuickNotes } from '@/components/QuickNotes';
import { GovernanceScoreCard } from '@/components/GovernanceScoreCard';
import { WelcomeBanner } from '@/components/WelcomeBanner';
import { EnhancedStatCard, RiskHeatMap, LiveActivityFeed, ComplianceRing, QuickActionsHub } from '@/components/AdvancedWidgets';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users, Shield, Database, FileCheck,
  Activity, AlertTriangle, Clock, TrendingUp, Server, FileDown, FileSpreadsheet,
  Ticket, ScrollText, MonitorCog
} from 'lucide-react';
import { exportToPDF, exportToExcel} from '@/lib/exports';
import { adminNavGroups } from '@/lib/navigation';
import { AttentionRequired } from '@/components/AttentionRequired';

interface DashboardStats {
  totalUsers: number;
  totalDomains: number;
  totalRequirements: number;
  complianceRate: number;
  pendingEvidences: number;
  openTickets: number;
  activeThreats: number;
  pendingEscalations: number;
  trends?: {
    userTrend: number;
    userTrendDirection: 'up' | 'down' | 'neutral';
    userSparkline: number[];
    ticketTrend: number;
    ticketTrendDirection: 'up' | 'down' | 'neutral';
    ticketSparkline: number[];
  };
}

interface ChartData {
  auditLogsByType: { type: string; count: number }[];
  userActivityData: { month: string; logins: number; newUsers: number }[];
}

interface GovernanceData {
  overallScore: number;
  complianceRate: number;
  securityScore: number;
  operationalScore: number;
  riskScore: number;
  metrics: {
    totalTickets: number;
    closedTickets: number;
    slaBreaches: number;
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
    todayActivities: number;
  };
  recentActivities: Array<{
    id: number;
    user: string;
    action: string;
    target: string;
    time: string;
    type: string;
    portal: string;
  }>;
  riskMatrix: Array<{ likelihood: number; impact: number; count: number }>;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="hub-chart-tooltip">
        <p className="text-white/50 font-medium mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-white/80">
            {entry.name}: <span className="text-white font-semibold tabular-nums">{entry.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const BarCustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="hub-chart-tooltip">
        <p className="text-white/50 font-medium mb-1">{label}</p>
        <p className="text-white/80">
          العدد: <span className="text-white font-semibold tabular-nums">{payload[0].value}</span>
        </p>
      </div>
    );
  }
  return null;
};

function StatCardSkeleton() {
  return (
    <Card className="hub-card">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
          <Skeleton className="h-12 w-12 rounded-xl" />
        </div>
      </CardContent>
    </Card>
  );
}

function ChartSkeleton() {
  return (
    <div className="h-[300px] w-full flex items-center justify-center">
      <div className="space-y-4 w-full px-4">
        <div className="flex justify-between items-end h-48 gap-2">
          {[55, 80, 65, 95, 75, 60].map((h, i) => (
            <Skeleton key={i} className="flex-1" style={{ height: `${h}%` }} />
          ))}
        </div>
        <Skeleton className="h-4 w-full" />
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats'],
    staleTime: 3 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });

  const { data: sessions = [] } = useQuery<any[]>({
    queryKey: ['/api/sessions'],
    staleTime: 3 * 60 * 1000,
  });

  const { data: auditLogs = [] } = useQuery<any[]>({
    queryKey: ['/api/audit-logs'],
    select: (d: any) => (Array.isArray(d) ? d : d?.logs || []),
    staleTime: 2 * 60 * 1000,
  });

  const { data: externalSystems = [] } = useQuery<any[]>({
    queryKey: ['/api/external-systems'],
    staleTime: 5 * 60 * 1000,
  });

  const { data: chartData, isLoading: chartsLoading } = useQuery<ChartData>({
    queryKey: ['/api/dashboard/admin-charts'],
    staleTime: 10 * 60 * 1000,
  });

  const { data: governanceData } = useQuery<GovernanceData>({
    queryKey: ['/api/governance/score'],
    refetchInterval: 15 * 60 * 1000,
    staleTime: 10 * 60 * 1000,
  });

  const loading = statsLoading || chartsLoading;

  const activeSessions = Array.isArray(sessions) ? sessions.filter((s: any) => s.isActive).length : 0;
  const today = new Date().toDateString();
  const todayLogs = Array.isArray(auditLogs) ? auditLogs.filter((l: any) => new Date(l.createdAt).toDateString() === today).length : 0;
  const connectedSystems = Array.isArray(externalSystems) ? externalSystems.filter((s: any) => s.status === 'active' || s.status === 'connected').length : 0;
  const disconnectedSystems = Array.isArray(externalSystems) ? externalSystems.filter((s: any) => s.status === 'inactive' || s.status === 'disconnected').length : 0;
  const integrationWarnings = Array.isArray(externalSystems) ? externalSystems.filter((s: any) => s.status === 'warning').length : 0;
  const lastSyncSystem = Array.isArray(externalSystems) ? externalSystems.find((s: any) => s.lastSyncAt) : null;
  const lastSync = lastSyncSystem ? new Date(lastSyncSystem.lastSyncAt).toLocaleTimeString('ar-SA') : '--';

  const quickActions = [
    { label: 'إدارة المستخدمين', icon: Users, onClick: () => setLocation('/admin/users'), color: 'hub-stat-gold' },
    { label: 'سجل التدقيق', icon: ScrollText, onClick: () => setLocation('/admin/audit'), color: 'text-sky-400' },
    { label: 'الجلسات النشطة', icon: MonitorCog, onClick: () => setLocation('/admin/sessions'), badge: activeSessions },
    { label: 'التصعيدات', icon: AlertTriangle, onClick: () => setLocation('/admin/escalations'), badge: stats?.pendingEscalations, color: 'text-red-400' },
    { label: 'الأنظمة الخارجية', icon: Server, onClick: () => setLocation('/admin/systems-status') },
    { label: 'التقارير', icon: FileDown, onClick: () => setLocation('/admin/reports') },
  ];

  const handleExportPDF = () => {
    const dashboardData = [
      { title: 'إجمالي المستخدمين', value: String(stats?.totalUsers || 0), description: 'المستخدمين المسجلين' },
      { title: 'التذاكر المفتوحة', value: String(stats?.openTickets || 0), description: 'بانتظار المعالجة' },
      { title: 'التهديدات النشطة', value: String(stats?.activeThreats || 0), description: 'تهديدات أمنية' },
      { title: 'التصعيدات المعلقة', value: String(stats?.pendingEscalations || 0), description: 'بانتظار الإجراء' },
    ];
    exportToPDF({
      title: 'لوحة التحكم الرئيسية',
      subtitle: 'Control Hub - JCSA',
      columns: [
        { header: 'المؤشر', key: 'title', width: 40 },
        { header: 'القيمة', key: 'value', width: 25 },
        { header: 'الوصف', key: 'description', width: 40 },
      ],
      data: dashboardData,
      filename: `admin-dashboard-${new Date().toISOString().split('T')[0]}`,
      orientation: 'landscape',
    });
  };

  const handleExportExcel = () => {
    const dashboardData = [
      { title: 'إجمالي المستخدمين', value: String(stats?.totalUsers || 0), description: 'المستخدمين المسجلين' },
      { title: 'التذاكر المفتوحة', value: String(stats?.openTickets || 0), description: 'بانتظار المعالجة' },
      { title: 'التهديدات النشطة', value: String(stats?.activeThreats || 0), description: 'تهديدات أمنية' },
      { title: 'التصعيدات المعلقة', value: String(stats?.pendingEscalations || 0), description: 'بانتظار الإجراء' },
    ];
    exportToExcel({
      title: 'لوحة التحكم الرئيسية',
      columns: [
        { header: 'المؤشر', key: 'title' },
        { header: 'القيمة', key: 'value' },
        { header: 'الوصف', key: 'description' },
      ],
      data: dashboardData,
      filename: `admin-dashboard-${new Date().toISOString().split('T')[0]}`,
    });
  };

  return (
    <DashboardLayout
      title="لوحة التحكم الرئيسية"
      subtitle="مركز التحكم - نادي سباقات الخيل"
      navGroups={adminNavGroups}
      portalName="بوابة مدير النظام"
    >
      <div className="space-y-6">
        <WelcomeBanner
          userName={user?.name || 'مشرف النظام'}
          portalName="بوابة مدير النظام"
          portal="admin"
          stats={{
            pendingTasks: governanceData?.metrics?.totalTasks ? governanceData.metrics.totalTasks - governanceData.metrics.completedTasks : 0,
            openTickets: stats?.openTickets || 0,
            completedToday: governanceData?.metrics?.todayActivities || todayLogs,
            overdueItems: governanceData?.metrics?.overdueTasks || 0,
            slaBreaches: governanceData?.metrics?.slaBreaches || 0,
            activeProjects: 0,
          }}
        />

        <QuickActionsHub actions={quickActions} />

        {/* Attention Required Agile Widget */}
        <AttentionRequired />

        <SmartDailyOps
          portal="admin"
          portalLabel="مدير النظام"
          onNavigate={setLocation}
          ticketsPath="/admin/escalations"
          tasksPath="/admin/escalations"
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SmartBookmarks portal="admin" onNavigate={setLocation} />
          <QuickNotes portal="admin" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            {governanceData ? (
              <GovernanceScoreCard
                complianceRate={governanceData.complianceRate}
                securityScore={governanceData.securityScore}
                operationalScore={governanceData.operationalScore}
                riskScore={governanceData.riskScore}
              />
            ) : (
              <Card className="hub-card">
                <CardContent className="p-8">
                  <div className="flex items-center gap-4">
                    <Skeleton className="w-40 h-40 rounded-full" />
                    <div className="flex-1 space-y-4">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-3/4" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="lg:col-span-2">
            <Card className="hub-card h-full">
              <CardHeader className="pb-3 pt-4 px-5">
                <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                  <div className="hub-icon-gold hub-icon-sm">
                    <FileCheck className="w-3.5 h-3.5" />
                  </div>
                  نسب الامتثال
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <div className="flex items-center justify-around">
                  <ComplianceRing label="PDPL" value={governanceData?.complianceRate || 0} color="#22c55e" icon={Shield} size={90} />
                  <ComplianceRing label="NDMO" value={governanceData?.securityScore || 0} color="#c9a227" icon={Database} size={90} />
                  <ComplianceRing label="SLA" value={governanceData?.operationalScore || 0} color="#38bdf8" icon={Clock} size={90} />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex items-center gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={handleExportPDF} data-testid="button-export-pdf">
            <FileDown className="w-4 h-4 ml-2" />
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel} data-testid="button-export-excel">
            <FileSpreadsheet className="w-4 h-4 ml-2" />
            Excel
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="system-overview-section">
          {loading ? (
            [...Array(4)].map((_, index) => <StatCardSkeleton key={index} />)
          ) : (
            <>
              <EnhancedStatCard
                title="إجمالي المستخدمين"
                value={stats?.totalUsers || 0}
                icon={Users}
                color="hub-stat-gold"
                bgColor="hub-badge-gold"
                description="المستخدمين المسجلين في النظام"
                trend={stats?.trends ? { value: stats.trends.userTrend, direction: stats.trends.userTrendDirection } : { value: 0, direction: 'neutral' }}
                sparklineData={stats?.trends?.userSparkline}
                delay={0}
                onClick={() => setLocation('/admin/users')}
              />
              <EnhancedStatCard
                title="التذاكر المفتوحة"
                value={stats?.openTickets || 0}
                icon={Ticket}
                color="text-sky-400"
                bgColor="bg-sky-500/10"
                description="تذاكر بانتظار المعالجة"
                trend={stats?.trends ? { value: stats.trends.ticketTrend, direction: stats.trends.ticketTrendDirection } : { value: 0, direction: 'neutral' }}
                sparklineData={stats?.trends?.ticketSparkline}
                delay={0.1}
                onClick={() => setLocation('/admin/escalations')}
              />
              <EnhancedStatCard
                title="التهديدات النشطة"
                value={stats?.activeThreats || 0}
                icon={AlertTriangle}
                color="text-red-400"
                bgColor="bg-red-500/10"
                description="تهديدات أمنية نشطة"
                trend={{ value: 0, direction: 'neutral' }}
                delay={0.2}
                onClick={() => setLocation('/department/cybersecurity/threats')}
              />
              <EnhancedStatCard
                title="التصعيدات المعلقة"
                value={stats?.pendingEscalations || 0}
                icon={TrendingUp}
                color="hub-stat-gold"
                bgColor="hub-badge-gold"
                description="تصعيدات بانتظار الإجراء"
                delay={0.3}
                onClick={() => setLocation('/admin/escalations')}
              />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <LiveActivityFeed
              activities={governanceData?.recentActivities?.map(a => ({ ...a, type: a.type as any })) || []}
            />
          </div>
          <RiskHeatMap data={governanceData?.riskMatrix} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="hub-card hub-card-gold">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5 hub-stat-gold" />
                نشاط المستخدمين
              </CardTitle>
              <CardDescription>تسجيلات الدخول والمستخدمين الجدد شهرياً</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <ChartSkeleton />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData?.userActivityData || []} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorLogins" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(43 74% 49%)" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="hsl(43 74% 49%)" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorNewUsers" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(222 47% 60%)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(222 47% 60%)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="month" stroke="rgba(255,255,255,0.35)" fontSize={11} tickLine={false} />
                    <YAxis stroke="rgba(255,255,255,0.35)" fontSize={11} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="logins" stroke="hsl(43 74% 49%)" strokeWidth={2.5} fillOpacity={1} fill="url(#colorLogins)" name="تسجيلات الدخول" />
                    <Area type="monotone" dataKey="newUsers" stroke="hsl(222 47% 60%)" strokeWidth={2} fillOpacity={1} fill="url(#colorNewUsers)" name="مستخدمين جدد" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="hub-card hub-card-gold">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileCheck className="w-5 h-5 hub-stat-gold" />
                سجلات التدقيق حسب النوع
              </CardTitle>
              <CardDescription>توزيع العمليات في سجلات التدقيق</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <ChartSkeleton />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData?.auditLogsByType || []} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="type" stroke="rgba(255,255,255,0.35)" fontSize={11} tickLine={false} />
                    <YAxis stroke="rgba(255,255,255,0.35)" fontSize={11} tickLine={false} />
                    <Tooltip content={<BarCustomTooltip />} />
                    <Bar dataKey="count" fill="hsl(43 74% 49%)" radius={[6, 6, 0, 0]} maxBarSize={50} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="hub-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Server className="w-5 h-5 hub-stat-gold" />
                  حالة الأنظمة الخارجية
                </CardTitle>
                <CardDescription>مراقبة حالة الربط مع الأنظمة والسيرفرات الخارجية</CardDescription>
              </div>
              <Button 
                className="btn-navy"
                size="sm" 
                onClick={() => setLocation('/admin/systems-status')}
                data-testid="button-view-systems-status"
              >
                عرض التفاصيل
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {loading ? (
                [...Array(4)].map((_, index) => (
                  <div key={index} className="p-4 rounded-lg border-2 bg-muted/50">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-lg" />
                      <div className="space-y-2">
                        <Skeleton className="h-6 w-12" />
                        <Skeleton className="h-4 w-20" />
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <>
                  {[
                    { title: 'أنظمة متصلة', value: connectedSystems, icon: <Server className="w-5 h-5" />, status: 'connected' },
                    { title: 'أنظمة غير متصلة', value: disconnectedSystems, icon: <AlertTriangle className="w-5 h-5" />, status: 'disconnected' },
                    { title: 'تحذيرات الربط', value: integrationWarnings, icon: <Clock className="w-5 h-5" />, status: 'warning' },
                    { title: 'آخر مزامنة', value: lastSync, icon: <Activity className="w-5 h-5" />, status: 'info' },
                  ].map((system, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        system.status === 'connected' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                        system.status === 'disconnected' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                        system.status === 'warning' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                        'bg-sky-500/10 border-sky-500/20 text-sky-400'
                      }`}
                      data-testid={`system-status-${system.status}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                          {system.icon}
                        </div>
                        <div>
                          <p className="text-xl font-bold text-white tabular-nums">{system.value}</p>
                          <p className="text-xs text-white/50">{system.title}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
