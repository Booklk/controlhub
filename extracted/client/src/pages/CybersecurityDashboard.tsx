import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { exportToPDF, exportToExcel, formatStatus } from '@/lib/exports';
import DashboardLayout from '@/components/DashboardLayout';
import { WelcomeBanner } from '@/components/WelcomeBanner';
import MyDayWidget from '@/components/MyDayWidget';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { CYBERSECURITY_DEPT_ID, cybersecurityNavGroups } from '@/lib/navigation';
import { SmartDailyOps } from '@/components/SmartDailyOps';
import { QuickNotes } from '@/components/QuickNotes';
import { SmartBookmarks } from '@/components/SmartBookmarks';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Shield, AlertTriangle, Bug, Activity, Eye, Clock, CheckCircle,
  Inbox, PlayCircle, FileDown, FileSpreadsheet, Server, Wifi, WifiOff
} from 'lucide-react';

const DEPARTMENT_ID = CYBERSECURITY_DEPT_ID;
const COLORS = ['hsl(43 74% 49%)', 'hsl(222 47% 25%)', 'hsl(199 89% 48%)', 'hsl(142 76% 36%)', 'hsl(0 84% 60%)'];
const tooltipStyle = { backgroundColor: 'hsl(222 47% 11%)', border: '1px solid hsl(43 74% 49% / 0.3)', borderRadius: '10px', color: '#fff', fontSize: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', padding: '8px 12px' };

const threatTypeLabels: Record<string, string> = {
  intrusion: 'محاولة اختراق', ddos: 'هجوم DDoS', malware: 'برمجيات خبيثة',
  phishing: 'تصيد إلكتروني', suspicious_activity: 'نشاط مشبوه',
};

interface CybersecurityStats {
  totalVulnerabilities: number; criticalVulnerabilities: number;
  activeThreats: number; resolvedThreats: number;
  avgResolutionTime: number; threatsByType: Record<string, number>;
  securityScore?: number;
  incidentResponseTime?: number;
  openVulnerabilities?: number;
  resolvedVulnerabilities?: number;
}

function PostureScore({ score }: { score: number }) {
  const r = 52, c = 2 * Math.PI * r;
  const color = score >= 70 ? 'hsl(142 76% 36%)' : score >= 40 ? 'hsl(43 74% 49%)' : 'hsl(0 84% 60%)';
  return (
    <div className="flex flex-col items-center" data-testid="security-posture-score">
      <svg width="120" height="120" viewBox="0 0 130 130">
        <circle cx="65" cy="65" r={r} fill="none" stroke="hsl(222 47% 20%)" strokeWidth="10" opacity="0.3" />
        <circle cx="65" cy="65" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (score / 100) * c} transform="rotate(-90 65 65)"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
        <text x="65" y="60" textAnchor="middle" style={{ fontSize: '28px', fontWeight: 700, fill: color }}>{score}</text>
        <text x="65" y="80" textAnchor="middle" style={{ fontSize: '11px', fill: 'hsl(222 47% 60%)' }}>من 100</text>
      </svg>
      <p className="text-xs text-muted-foreground mt-1">الوضع الأمني</p>
    </div>
  );
}

function getSeverityBadge(severity: string) {
  const s: Record<string, string> = {
    critical: 'bg-red-500/20 text-red-300 border-red-500/30',
    high: 'hub-badge-gold',
    medium: 'hub-badge-navy',
    low: 'hub-badge-gold opacity-70',
  };
  const l: Record<string, string> = { critical: 'حرج', high: 'عالي', medium: 'متوسط', low: 'منخفض' };
  return <Badge className={s[severity] || s.medium}>{l[severity] || severity}</Badge>;
}

export default function CybersecurityDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedTask, setSelectedTask] = useState<any>(null);

  const { data: stats = null, isLoading: statsLoading, error: statsError, dataUpdatedAt: dashboardUpdatedAt } = useQuery<CybersecurityStats>({
    queryKey: ['/api/dashboard/cybersecurity'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/dashboard/cybersecurity');
      if (!res.ok) throw new Error('Failed to load stats');
      return res.json();
    },
    refetchInterval: 2 * 60 * 1000,
    staleTime: 60 * 1000,
  });

  const { data: threats = [] } = useQuery<any[]>({
    queryKey: ['/api/security/threats/active'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/security/threats/active');
      return res.ok ? res.json() : [];
    },
    refetchInterval: 2 * 60 * 1000,
  });

  const { data: vulnerabilities = [] } = useQuery<any[]>({
    queryKey: ['/api/security/vulnerabilities/critical'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/security/vulnerabilities/critical');
      return res.ok ? res.json() : [];
    },
  });

  const { data: externalSystems = [] } = useQuery<any[]>({
    queryKey: ['/api/external-systems'],
  });

  const { data: incomingTasks = [] } = useQuery<any[]>({
    queryKey: [`/api/tasks/it-department/${DEPARTMENT_ID}`],
  });

  const updateTaskStatus = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: number; status: string }) =>
      apiRequest('PUT', `/api/tasks/${taskId}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/it-department/${DEPARTMENT_ID}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/cybersecurity'] });
      toast({ title: 'تم تحديث حالة المهمة بنجاح' });
      setSelectedTask(null);
    },
    onError: (error: Error) => toast({ description: error.message, title: 'فشل تحديث حالة المهمة', variant: 'destructive' }),
  });

  const pendingTasks = incomingTasks.filter((t: any) => t.status === 'pending' || t.status === 'assigned');
  const loading = statsLoading;
  const error = statsError ? 'حدث خطأ أثناء تحميل بيانات لوحة المعلومات' : null;

  const score = stats
    ? (stats.securityScore != null
        ? Math.max(0, Math.min(100, stats.securityScore))
        : Math.max(0, Math.min(100, 100 - (stats.criticalVulnerabilities * 20 + stats.activeThreats * 10))))
    : 0;
  const chartData = stats?.threatsByType
    ? Object.entries(stats.threatsByType).map(([t, v]) => ({ name: t, value: v, label: threatTypeLabels[t] || t }))
    : [];

  const makeExportData = () => ({
    data: threats.map((t: any) => ({
      title: t.title || t.name || '', type: t.type || '', severity: t.severity || '',
      detectedAt: t.detectedAt ? new Date(t.detectedAt).toLocaleDateString('ar-SA') : '',
      status: formatStatus(t.status || ''),
    })),
    columns: [
      { header: 'التهديد', key: 'title' }, { header: 'النوع', key: 'type' },
      { header: 'الخطورة', key: 'severity' }, { header: 'تاريخ الاكتشاف', key: 'detectedAt' },
      { header: 'الحالة', key: 'status' },
    ],
  });

  if (loading) {
    return (
      <DashboardLayout title="لوحة الأمن السيبراني" subtitle="مراقبة التهديدات والثغرات الأمنية"
        navGroups={cybersecurityNavGroups} portalName="إدارة الأمن السيبراني">
        <div className="p-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
          <Skeleton className="h-64" />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout title="لوحة الأمن السيبراني" subtitle="مراقبة التهديدات والثغرات الأمنية"
        navGroups={cybersecurityNavGroups} portalName="إدارة الأمن السيبراني">
        <div className="p-6">
          <Card className="hub-card">
            <CardContent className="p-6 text-center">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-destructive" />
              <p className="text-lg font-medium text-destructive">{error}</p>
              <p className="text-sm text-muted-foreground mt-2">يرجى المحاولة مرة أخرى لاحقاً</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="لوحة الأمن السيبراني" subtitle="مراقبة التهديدات والثغرات الأمنية"
      navGroups={cybersecurityNavGroups} portalName="إدارة الأمن السيبراني">
      <div className="space-y-6">
        <WelcomeBanner
          userName={user?.name || ''}
          portalName="الأمن السيبراني"
          portal="cybersecurity"
          stats={{
            openTickets: stats?.activeThreats || 0,
            criticalVulns: stats?.criticalVulnerabilities || 0,
            openIncidents: stats?.activeThreats || 0,
          }}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <SmartDailyOps
              portal="cybersecurity"
              portalLabel="الأمن السيبراني"
              onNavigate={setLocation}
              ticketsPath="/department/cybersecurity/tickets"
              referralsPath="/department/cybersecurity/referrals"
              tasksPath="/department/cybersecurity/tasks"
            />
          </div>
          <MyDayWidget portal="cybersecurity" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SmartBookmarks portal="cybersecurity" onNavigate={setLocation} />
          <QuickNotes portal="cybersecurity" />
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            {dashboardUpdatedAt > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-white/30 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                ⟳ تحديث تلقائي · آخر تحديث {new Date(dashboardUpdatedAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { const d = makeExportData(); exportToPDF({ ...d, title: 'تقرير الأمن السيبراني', filename: 'cybersecurity-report', orientation: 'landscape' }); }} data-testid="button-export-pdf">
              <FileDown className="w-4 h-4 ml-2" />PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => { const d = makeExportData(); exportToExcel({ ...d, title: 'تقرير الأمن السيبراني', filename: 'cybersecurity-report' }); }} data-testid="button-export-excel">
              <FileSpreadsheet className="w-4 h-4 ml-2" />Excel
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { id: 'stat-critical', label: 'ثغرات حرجة', value: stats?.criticalVulnerabilities || 0, total: stats?.totalVulnerabilities || 0, sub: `من إجمالي ${stats?.totalVulnerabilities || 0}`, stripe: stats?.criticalVulnerabilities ? 'bg-red-500' : 'bg-amber-400/70', iconBg: stats?.criticalVulnerabilities ? 'bg-red-500/15' : 'bg-amber-400/15', color: stats?.criticalVulnerabilities ? 'hsl(0 84% 60%)' : 'hsl(43 74% 49%)', barColor: stats?.criticalVulnerabilities ? 'bg-red-500' : 'bg-amber-400', urgent: (stats?.criticalVulnerabilities || 0) > 0, Icon: Bug },
            { id: 'stat-threats', label: 'تهديدات نشطة', value: stats?.activeThreats || 0, total: (stats?.activeThreats || 0) + (stats?.resolvedThreats || 0), sub: 'تحتاج معالجة', stripe: 'bg-amber-400/70', iconBg: 'bg-amber-400/15', color: 'hsl(43 74% 49%)', barColor: 'bg-amber-400', urgent: false, Icon: AlertTriangle },
            { id: 'stat-resolved', label: 'تهديدات محلولة', value: stats?.resolvedThreats || 0, total: (stats?.activeThreats || 0) + (stats?.resolvedThreats || 0), sub: 'تم الحل', stripe: 'bg-emerald-500', iconBg: 'bg-emerald-500/15', color: 'hsl(142 76% 36%)', barColor: 'bg-emerald-500', urgent: false, Icon: CheckCircle },
            { id: 'stat-resolution-time', label: stats?.incidentResponseTime != null ? 'وقت الاستجابة للحوادث' : 'متوسط وقت الحل', value: stats?.incidentResponseTime ?? stats?.avgResolutionTime ?? 0, total: 72, sub: stats?.incidentResponseTime != null ? 'دقيقة للاستجابة' : 'ساعة للمعالجة', stripe: 'bg-primary/40', iconBg: 'bg-primary/15', color: 'hsl(222 47% 70%)', barColor: 'bg-primary/60', urgent: false, Icon: Clock },
          ].map(({ id, label, value, total, sub, stripe, iconBg, color, barColor, urgent, Icon }) => (
            <Card key={id} className={`hub-card hub-card-hover relative overflow-hidden ${urgent ? 'hub-critical-pulse' : ''}`} data-testid={id}>
              <div className={`absolute inset-y-0 right-0 w-[3px] rounded-l-sm ${stripe}`} />
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <p className="text-xs text-white/55 font-medium">{label}</p>
                  <div className={`p-2 rounded-lg ${iconBg}`}>
                    <Icon className="w-4 h-4" style={{ color }} />
                  </div>
                </div>
                <AnimatedNumber value={typeof value === 'number' ? value : 0} loading={loading} className="text-3xl font-bold hub-stat-number" style={{ color }} />
                <div className="mt-3 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${total > 0 ? Math.min((typeof value === 'number' ? value : 0) / total * 100, 100) : 0}%` }} />
                </div>
                <p className="text-[10px] text-white/35 mt-1">{sub}</p>
              </CardContent>
            </Card>
          ))}
          <Card className="hub-card hub-card-gold" data-testid="stat-posture-score">
            <CardContent className="p-5 flex items-center justify-center">
              {loading ? <p className="text-muted-foreground">...</p> : <PostureScore score={score} />}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="hub-card" data-testid="card-threat-pie">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-white/80">
                <Shield className="w-5 h-5 hub-stat-gold" />توزيع التهديدات
              </CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length ? (
                <div data-testid="threat-pie-chart">
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={chartData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value" nameKey="label">
                        {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v, 'العدد']} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap justify-center gap-3 mt-2">
                    {chartData.map((e, i) => (
                      <div key={e.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />{e.label}
                      </div>
                    ))}
                  </div>
                </div>
              ) : <p className="text-center text-sm text-muted-foreground py-4">لا توجد بيانات</p>}
            </CardContent>
          </Card>

          <Card className="hub-card" data-testid="card-threat-bar">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-white/80">
                <Activity className="w-5 h-5 hub-stat-gold" />التهديدات حسب النوع
              </CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length ? (
                <div data-testid="threat-distribution-chart">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="label" type="category" width={100} tick={{ fontSize: 12, fill: 'hsl(222 47% 60%)' }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v, 'العدد']} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={28}>
                        {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="text-center text-sm text-muted-foreground py-4">لا توجد بيانات</p>}
            </CardContent>
          </Card>
        </div>

        {pendingTasks.length > 0 && (
          <Card className="hub-card hub-card-gold">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white/90">
                <Inbox className="w-5 h-5 hub-stat-gold" />
                المهام الواردة من مدير تقنية المعلومات
                <Badge className="mr-2 hub-badge-gold-solid">{pendingTasks.length} جديدة</Badge>
              </CardTitle>
              <CardDescription className="text-muted-foreground">المهام المعينة لإدارة الأمن السيبراني والتي تنتظر المعالجة</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pendingTasks.slice(0, 5).map((task: any) => (
                  <div key={task.id} className="flex items-center gap-4 p-4 rounded-lg border hub-card-gold hover-elevate cursor-pointer"
                    onClick={() => setSelectedTask(task)} data-testid={`incoming-task-${task.id}`}>
                    <div className="p-2 rounded-lg hub-icon-gold">
                      <Inbox className="w-5 h-5 hub-stat-gold" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-medium text-white/90">{task.title}</span>
                        <Badge variant={['high','critical','urgent'].includes(task.priority) ? 'destructive' : 'secondary'}>
                          {task.priority === 'urgent' ? 'عاجل' : task.priority === 'critical' ? 'حرج' : task.priority === 'high' ? 'عالي' : task.priority === 'medium' ? 'متوسط' : 'منخفض'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">{task.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-white/50">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />تاريخ الاستحقاق: {task.dueDate ? new Date(task.dueDate).toLocaleDateString('ar-SA') : 'غير محدد'}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="btn-navy" onClick={(e) => { e.stopPropagation(); setSelectedTask(task); }} data-testid={`view-task-${task.id}`}>
                        <Eye className="w-4 h-4 ml-1" />عرض
                      </Button>
                      <Button size="sm" className="btn-gold" disabled={updateTaskStatus.isPending}
                        onClick={(e) => { e.stopPropagation(); updateTaskStatus.mutate({ taskId: task.id, status: 'in_progress' }); }}
                        data-testid={`start-task-${task.id}`}>
                        <PlayCircle className="w-4 h-4 ml-1" />بدء العمل
                      </Button>
                    </div>
                  </div>
                ))}
                {pendingTasks.length > 5 && (
                  <Button className="btn-navy w-full" onClick={() => setLocation('/department/cybersecurity/tasks')} data-testid="view-all-tasks">
                    عرض جميع المهام ({pendingTasks.length})
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="hub-card">
          <CardHeader>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="text-lg flex items-center gap-2 text-white/90">
                  <AlertTriangle className="w-5 h-5 hub-stat-gold" />التهديدات النشطة
                </CardTitle>
                <CardDescription className="text-muted-foreground">تهديدات تحتاج اهتمام فوري</CardDescription>
              </div>
              <Button className="btn-navy" size="sm" onClick={() => setLocation('/department/cybersecurity/threats')} data-testid="button-view-all-threats">عرض الكل</Button>
            </div>
          </CardHeader>
          <CardContent>
            {threats.length === 0 && !loading ? (
              <div className="text-center py-8 text-muted-foreground">
                <Shield className="w-12 h-12 mx-auto mb-2 hub-stat-gold" /><p>لا توجد تهديدات نشطة حالياً</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="threats-table">
                  <thead><tr className="border-b hub-table-head">
                    <th className="hub-th">التهديد</th><th className="hub-th">النوع</th><th className="hub-th">الخطورة</th><th className="hub-th">المصدر</th><th className="hub-th">تاريخ الاكتشاف</th>
                  </tr></thead>
                  <tbody>
                    {threats.map((t, i) => (
                      <tr key={t.id || i} className="border-b transition-colors hub-table-row" data-testid={`threat-item-${i}`}>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-md" style={{ backgroundColor: t.severity === 'critical' ? 'hsla(0 84% 60% / 0.15)' : 'hsla(43 74% 49% / 0.1)' }}>
                              <AlertTriangle className="w-4 h-4" style={{ color: t.severity === 'critical' ? 'hsl(0 84% 60%)' : 'hsl(43 74% 49%)' }} />
                            </div>
                            <span className="font-medium text-white/90">{t.title}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-white/60">{threatTypeLabels[t.threatType] || t.threatType}</td>
                        <td className="py-3 px-4">{getSeverityBadge(t.severity)}</td>
                        <td className="py-3 px-4">{t.sourceIp ? <span className="text-xs font-mono text-muted-foreground" dir="ltr">{t.sourceIp}</span> : <span className="text-xs text-white/40">-</span>}</td>
                        <td className="py-3 px-4 text-xs text-muted-foreground">{new Date(t.detectedAt).toLocaleDateString('ar-SA')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="hub-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-white/90">
                <Bug className="w-5 h-5" style={{ color: 'hsl(0 84% 60%)' }} />الثغرات الحرجة
              </CardTitle>
            </CardHeader>
            <CardContent>
              {vulnerabilities.length === 0 && !loading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mx-auto mb-2" style={{ color: 'hsl(142 76% 36%)' }} /><p>لا توجد ثغرات حرجة</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="vulnerabilities-table">
                    <thead><tr className="border-b hub-table-head">
                      <th className="hub-th">الثغرة</th><th className="hub-th">المعرف</th><th className="hub-th">الخطورة</th>
                    </tr></thead>
                    <tbody>
                      {vulnerabilities.slice(0, 5).map((v, i) => (
                        <tr key={v.id || i} className="border-b transition-colors hub-table-row" data-testid={`vuln-item-${i}`}>
                          <td className="py-3 px-4 font-medium text-white/90">{v.title}</td>
                          <td className="py-3 px-4">{v.cveId ? <span className="text-xs font-mono text-muted-foreground" dir="ltr">{v.cveId}</span> : <span className="text-xs text-white/40">-</span>}</td>
                          <td className="py-3 px-4">{getSeverityBadge(v.severity)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="hub-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-white/90">
                <Activity className="w-5 h-5 hub-stat-gold" />ملخص الوضع الأمني
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3" data-testid="security-summary">
                {[
                  { l: 'إجمالي الثغرات', v: stats?.totalVulnerabilities || 0, c: 'hsl(43 74% 49%)' },
                  { l: 'الثغرات الحرجة', v: stats?.criticalVulnerabilities || 0, c: stats?.criticalVulnerabilities ? 'hsl(0 84% 60%)' : 'hsl(142 76% 36%)' },
                  { l: 'التهديدات النشطة', v: stats?.activeThreats || 0, c: 'hsl(43 74% 49%)' },
                  { l: 'نقاط الوضع الأمني', v: `${score}/100`, c: score >= 70 ? 'hsl(142 76% 36%)' : score >= 40 ? 'hsl(43 74% 49%)' : 'hsl(0 84% 60%)' },
                ].map(({ l, v, c }) => (
                  <div key={l} className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'hsla(222 47% 20% / 0.3)' }}>
                    <span className="text-sm text-white/60">{l}</span>
                    <span className="text-lg font-bold" style={{ color: c }}>{v}</span>
                  </div>
                ))}
                {(stats?.openVulnerabilities != null || stats?.resolvedVulnerabilities != null) && (
                  <div className="p-3 rounded-lg" style={{ backgroundColor: 'hsla(222 47% 20% / 0.3)' }} data-testid="vulnerability-trend">
                    <p className="text-sm text-white/60 mb-2">اتجاه الثغرات (مفتوحة مقابل محلولة)</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex justify-between text-xs text-white/40 mb-1">
                          <span>مفتوحة: {stats?.openVulnerabilities ?? 0}</span>
                          <span>محلولة: {stats?.resolvedVulnerabilities ?? 0}</span>
                        </div>
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden flex">
                          {(() => {
                            const open = stats?.openVulnerabilities ?? 0;
                            const resolved = stats?.resolvedVulnerabilities ?? 0;
                            const total = open + resolved;
                            if (total === 0) return null;
                            return (
                              <>
                                <div className="h-full bg-red-400 transition-all duration-700" style={{ width: `${(open / total) * 100}%` }} />
                                <div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: `${(resolved / total) * 100}%` }} />
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {externalSystems.length > 0 && (
          <Card className="hub-card" data-testid="card-connected-systems">
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

      <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Inbox className="w-5 h-5 hub-stat-gold" />تفاصيل المهمة
            </DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4">
              <div><Label className="text-muted-foreground">عنوان المهمة</Label><p className="font-medium text-lg">{selectedTask.title}</p></div>
              <div><Label className="text-muted-foreground">الوصف</Label><p className="text-sm">{selectedTask.description || 'لا يوجد وصف'}</p></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="text-muted-foreground">الأولوية</Label>
                  <Badge variant={['high','critical','urgent'].includes(selectedTask.priority) ? 'destructive' : 'secondary'}>
                    {selectedTask.priority === 'urgent' ? 'عاجل' : selectedTask.priority === 'critical' ? 'حرج' : selectedTask.priority === 'high' ? 'عالي' : selectedTask.priority === 'medium' ? 'متوسط' : 'منخفض'}
                  </Badge></div>
                <div><Label className="text-muted-foreground">الحالة</Label>
                  <Badge variant="outline">{selectedTask.status === 'pending' ? 'قيد الانتظار' : selectedTask.status === 'in_progress' ? 'قيد التنفيذ' : selectedTask.status === 'completed' ? 'مكتملة' : selectedTask.status}</Badge></div>
                <div><Label className="text-muted-foreground">تاريخ الاستحقاق</Label><p className="text-sm">{selectedTask.dueDate ? new Date(selectedTask.dueDate).toLocaleDateString('ar-SA') : 'غير محدد'}</p></div>
                <div><Label className="text-muted-foreground">تاريخ الإنشاء</Label><p className="text-sm">{selectedTask.createdAt ? new Date(selectedTask.createdAt).toLocaleDateString('ar-SA') : 'غير محدد'}</p></div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button className="btn-navy" onClick={() => setSelectedTask(null)} data-testid="button-close-task-dialog">إغلاق</Button>
            {selectedTask?.status === 'pending' || selectedTask?.status === 'assigned' ? (
              <Button className="btn-gold" disabled={updateTaskStatus.isPending}
                onClick={() => updateTaskStatus.mutate({ taskId: selectedTask.id, status: 'in_progress' })} data-testid="button-start-task-dialog">
                <PlayCircle className="w-4 h-4 ml-1" />بدء العمل
              </Button>
            ) : selectedTask?.status === 'in_progress' ? (
              <Button className="btn-gold" disabled={updateTaskStatus.isPending}
                onClick={() => updateTaskStatus.mutate({ taskId: selectedTask.id, status: 'completed' })} data-testid="button-complete-task-dialog">
                <CheckCircle className="w-4 h-4 ml-1" />إكمال المهمة
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
