import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import DashboardLayout from '@/components/DashboardLayout';
import { SmartDailyOps } from '@/components/SmartDailyOps';
import { SmartBookmarks } from '@/components/SmartBookmarks';
import { QuickNotes } from '@/components/QuickNotes';
import { GovernanceScoreCard } from '@/components/GovernanceScoreCard';
import { WelcomeBanner } from '@/components/WelcomeBanner';
import { EnhancedStatCard, RiskHeatMap, ComplianceRing, QuickActionsHub } from '@/components/AdvancedWidgets';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users, Shield, Database, FileCheck,
  Activity, AlertTriangle, Clock, TrendingUp, Server, FileDown, FileSpreadsheet,
  Ticket, ScrollText, MonitorCog, RefreshCw
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
  const [lastUpdated] = useState(() => new Date());

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
        {/* Last Updated + Critical Alert Indicator */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-[11px] text-white/40">
            <RefreshCw className="w-3 h-3" />
            <span>آخر تحديث: {lastUpdated.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          {(stats?.activeThreats ?? 0) > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/25 critical-alert-pulse">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              <span className="text-[11px] font-semibold text-red-400">
                {stats?.activeThreats} تهديد نشط يتطلب انتباهاً فورياً
              </span>
            </div>
          )}
        </div>
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

        {/* ── Quick Stats Row ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-gradient-to-l from-sky-500/5 to-transparent">
            <div className="w-11 h-11 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
              <ScrollText className="w-5 h-5 text-sky-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white/50">سجلات التدقيق اليوم</p>
              <p className="text-2xl font-black text-white tabular-nums">{todayLogs}</p>
            </div>
            <div className="text-[10px] text-sky-400/70 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20">اليوم</div>
          </div>
          <div className="flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-gradient-to-l from-emerald-500/5 to-transparent">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white/50">حالة النظام</p>
              <p className="text-lg font-bold text-emerald-400 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                يعمل بشكل طبيعي
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-gradient-to-l from-amber-500/5 to-transparent">
            <div className="w-11 h-11 rounded-xl hub-badge-gold flex items-center justify-center shrink-0">
              <MonitorCog className="w-5 h-5 text-[hsl(222_47%_11%)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white/50">الجلسات النشطة</p>
              <p className="text-2xl font-black text-white tabular-nums">{activeSessions}</p>
            </div>
            <button onClick={() => setLocation('/admin/sessions')} className="text-[10px] hub-stat-gold hover:underline">التفاصيل</button>
          </div>
        </div>

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
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                  <div className="hub-icon-gold hub-icon-sm">
                    <FileCheck className="w-3.5 h-3.5" />
                  </div>
                  نسب الامتثال التنظيمي
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <div className="flex items-center justify-around mb-4">
                  <ComplianceRing label="PDPL" value={governanceData?.complianceRate || 0} color="#22c55e" icon={Shield} size={100} />
                  <ComplianceRing label="NDMO" value={governanceData?.securityScore || 0} color="#c9a227" icon={Database} size={100} />
                  <ComplianceRing label="SLA" value={governanceData?.operationalScore || 0} color="#38bdf8" icon={Clock} size={100} />
                </div>
                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/[0.06]">
                  <div className="text-center">
                    <p className="text-lg font-black text-emerald-400 tabular-nums">{governanceData?.complianceRate || 0}%</p>
                    <p className="text-[10px] text-white/40">حماية البيانات</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-black hub-stat-gold tabular-nums">{governanceData?.securityScore || 0}%</p>
                    <p className="text-[10px] text-white/40">إدارة البيانات</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-black text-sky-400 tabular-nums">{governanceData?.operationalScore || 0}%</p>
                    <p className="text-[10px] text-white/40">اتفاقية الخدمة</p>
                  </div>
                </div>
                {(() => {
                  const avg = Math.round(((governanceData?.complianceRate || 0) + (governanceData?.securityScore || 0) + (governanceData?.operationalScore || 0)) / 3);
                  const avgColor = avg >= 80 ? 'text-emerald-400' : avg >= 60 ? 'text-amber-400' : 'text-red-400';
                  return (
                    <div className="mt-3 flex items-center justify-center gap-2 py-2 rounded-lg bg-white/[0.03]">
                      <span className="text-[11px] text-white/50">المعدل العام:</span>
                      <span className={`text-sm font-bold ${avgColor} tabular-nums`}>{avg}%</span>
                    </div>
                  );
                })()}
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
            <Card className="hub-card">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-bold text-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-sky-500/15 flex items-center justify-center">
                      <Activity className="w-3.5 h-3.5 text-sky-400" />
                    </div>
                    آخر الأنشطة
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] text-white/60 font-normal">مباشر</span>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                {governanceData?.recentActivities && governanceData.recentActivities.length > 0 ? (
                  <div className="relative">
                    {/* Timeline vertical line */}
                    <div className="absolute right-[15px] top-2 bottom-2 w-px bg-gradient-to-b from-white/10 via-white/5 to-transparent" />
                    <div className="space-y-1">
                      {governanceData.recentActivities.slice(0, 8).map((activity, i) => {
                        const typeColors: Record<string, { dot: string; bg: string; text: string }> = {
                          create: { dot: 'bg-emerald-400', bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
                          update: { dot: 'bg-sky-400', bg: 'bg-sky-500/10', text: 'text-sky-400' },
                          delete: { dot: 'bg-red-400', bg: 'bg-red-500/10', text: 'text-red-400' },
                          login: { dot: 'bg-[hsl(var(--accent))]', bg: 'bg-[hsl(var(--accent))]/10', text: 'hub-stat-gold' },
                          complete: { dot: 'bg-emerald-400', bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
                          comment: { dot: 'bg-purple-400', bg: 'bg-purple-500/10', text: 'text-purple-400' },
                        };
                        const colors = typeColors[activity.type] || typeColors.update;
                        return (
                          <div key={activity.id || i} className="flex items-start gap-3 py-2.5 pr-0 hover:bg-white/[0.02] rounded-lg transition-colors relative">
                            {/* Timeline dot */}
                            <div className="relative z-10 shrink-0 w-[30px] flex justify-center pt-1">
                              <div className={`w-3 h-3 rounded-full ${colors.dot} ring-4 ring-[hsl(222_47%_11%)]`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-semibold text-white">{activity.user}</span>
                                <span className={`text-[10px] ${colors.text}`}>{activity.action}</span>
                                <span className="text-xs text-white/70 truncate">{activity.target}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-white/30">{activity.time}</span>
                                {activity.portal && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-white/40">{activity.portal}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Activity className="w-8 h-8 mx-auto mb-2 text-white/20" />
                    <p className="text-sm text-white/40">لا توجد أنشطة حديثة</p>
                  </div>
                )}
              </CardContent>
            </Card>
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
              <div className="flex items-center gap-4">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Server className="w-5 h-5 hub-stat-gold" />
                    حالة الأنظمة الخارجية
                  </CardTitle>
                  <CardDescription>مراقبة حالة الربط مع الأنظمة والسيرفرات الخارجية</CardDescription>
                </div>
                {/* Prominent connected/disconnected summary pill */}
                {!loading && (
                  <div className="flex items-center gap-2 mr-4">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-sm font-bold text-emerald-400 tabular-nums">{connectedSystems}</span>
                      <span className="text-[10px] text-emerald-400/70">متصل</span>
                    </div>
                    {disconnectedSystems > 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/25">
                        <span className="w-2 h-2 rounded-full bg-red-400" />
                        <span className="text-sm font-bold text-red-400 tabular-nums">{disconnectedSystems}</span>
                        <span className="text-[10px] text-red-400/70">غير متصل</span>
                      </div>
                    )}
                  </div>
                )}
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
            {/* Overall health bar */}
            {!loading && (externalSystems.length > 0) && (
              <div className="mb-4 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <div className="flex items-center justify-between text-[11px] mb-2">
                  <span className="text-white/50">صحة الربط الإجمالية</span>
                  <span className="font-bold tabular-nums" style={{ color: connectedSystems / externalSystems.length >= 0.8 ? '#34d399' : connectedSystems / externalSystems.length >= 0.5 ? '#fbbf24' : '#f87171' }}>
                    {Math.round((connectedSystems / externalSystems.length) * 100)}%
                  </span>
                </div>
                <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.round((connectedSystems / externalSystems.length) * 100)}%`,
                      backgroundColor: connectedSystems / externalSystems.length >= 0.8 ? '#34d399' : connectedSystems / externalSystems.length >= 0.5 ? '#fbbf24' : '#f87171',
                    }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2 text-[10px] text-white/30">
                  <span>{connectedSystems} من {externalSystems.length} نظام متصل</span>
                  <span>آخر مزامنة: {lastSync}</span>
                </div>
              </div>
            )}
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
        <style>{`
          @keyframes criticalPulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.6; }
          }
          .critical-alert-pulse {
            animation: criticalPulse 2s ease-in-out infinite;
          }
        `}</style>
      </div>
    </DashboardLayout>
  );
}
