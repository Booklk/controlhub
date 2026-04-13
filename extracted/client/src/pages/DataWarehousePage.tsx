import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { dmoNavGroups } from "@/lib/navigation";
import { exportToPDF, exportToExcel } from "@/lib/exports";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart,
} from "recharts";
import {
  Database, BarChart3, TrendingUp, Shield, FileText, Users,
  Building2, CheckCircle, AlertTriangle, Globe, Lock, Eye,
  Activity, Target, Layers, FileDown, FileSpreadsheet,
  Server, GitMerge, PieChart as PieChartIcon, Zap, Clock,
  RefreshCw, Plug, Table2, Wifi, WifiOff, Play, History,
} from "lucide-react";

const COLORS = ['#c9a227', '#1e3a5f', '#2d4a6f', '#3d5a80', '#6366f1', '#059669'];
const HEALTH_COLORS: Record<string, string> = {
  excellent: 'text-emerald-400',
  good: 'text-amber-400',
  needs_improvement: 'text-red-400',
};

function getHealthLabel(score: number) {
  if (score >= 80) return { label: 'ممتاز', color: HEALTH_COLORS.excellent, bg: 'bg-emerald-500/20' };
  if (score >= 60) return { label: 'جيد', color: HEALTH_COLORS.good, bg: 'bg-amber-500/20' };
  return { label: 'يحتاج تحسين', color: HEALTH_COLORS.needs_improvement, bg: 'bg-red-500/20' };
}

function StatCard({ title, value, subtitle, icon: Icon, trend }: { title: string; value: string | number; subtitle?: string; icon: any; trend?: string }) {
  return (
    <Card className="card-premium">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1 hub-stat-gold">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className="p-2 rounded-lg bg-[hsl(43_74%_49%)]/10">
            <Icon className="w-5 h-5 hub-stat-gold" />
          </div>
        </div>
        {trend && (
          <div className="mt-2 flex items-center gap-1 text-xs">
            <TrendingUp className="w-3 h-3 text-emerald-400" />
            <span className="text-emerald-400">{trend}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DataWarehousePage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");

  const { data: summary, isLoading: summaryLoading } = useQuery<any>({
    queryKey: ["/api/data-warehouse/executive-summary"],
    staleTime: 3 * 60 * 1000,
  });

  const { data: deptAnalytics = [], isLoading: deptLoading } = useQuery<any[]>({
    queryKey: ["/api/data-warehouse/department-analytics"],
    staleTime: 3 * 60 * 1000,
  });

  const { data: trends, isLoading: trendsLoading } = useQuery<any>({
    queryKey: ["/api/data-warehouse/trends"],
    staleTime: 5 * 60 * 1000,
  });

  const { data: compliance, isLoading: complianceLoading } = useQuery<any>({
    queryKey: ["/api/data-warehouse/compliance-analytics"],
    staleTime: 5 * 60 * 1000,
  });

  const { data: quality, isLoading: qualityLoading } = useQuery<any>({
    queryKey: ["/api/data-warehouse/data-quality-summary"],
    staleTime: 5 * 60 * 1000,
  });

  const { data: externalSources = [] } = useQuery<any[]>({
    queryKey: ["/api/data-warehouse/external-sources"],
    staleTime: 3 * 60 * 1000,
  });

  const { data: sourcesSummary } = useQuery<any>({
    queryKey: ["/api/data-warehouse/sources-summary"],
    staleTime: 3 * 60 * 1000,
  });

  const { data: etlStatus = [] } = useQuery<any[]>({
    queryKey: ["/api/data-warehouse/etl/status"],
    staleTime: 60 * 1000,
  });

  const runETLMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/data-warehouse/etl/run");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: `تم تشغيل ETL بنجاح (${data.duration}ms)` });
      queryClient.invalidateQueries({ queryKey: ["/api/data-warehouse"] });
    },
    onError: (error: Error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const handleExportPDF = () => {
    if (!deptAnalytics.length) return;
    exportToPDF({
      title: 'تقرير مستودع البيانات التحليلي',
      subtitle: 'نادي سباقات الخيل - مركز التحكم',
      columns: [
        { header: 'الإدارة', key: 'name', width: 40 },
        { header: 'التذاكر', key: 'tickets', width: 15 },
        { header: 'المهام', key: 'tasks', width: 15 },
        { header: 'الإنجاز', key: 'completion', width: 15 },
        { header: 'الصحة', key: 'health', width: 15 },
      ],
      data: deptAnalytics.map((d: any) => ({
        name: d.name,
        tickets: `${d.tickets.open} مفتوحة / ${d.tickets.total}`,
        tasks: `${d.tasks.completed} / ${d.tasks.total}`,
        completion: `${d.tasks.completionRate}%`,
        health: `${d.healthScore}%`,
      })),
      filename: 'data-warehouse-report',
      orientation: 'landscape',
    });
  };

  const handleExportExcel = () => {
    if (!deptAnalytics.length) return;
    exportToExcel({
      title: 'تقرير مستودع البيانات التحليلي',
      columns: [
        { header: 'الإدارة', key: 'name', width: 35 },
        { header: 'الموظفين', key: 'staff', width: 12 },
        { header: 'التذاكر الكلية', key: 'totalTickets', width: 15 },
        { header: 'التذاكر المفتوحة', key: 'openTickets', width: 15 },
        { header: 'متوسط الحل (ساعات)', key: 'avgRes', width: 18 },
        { header: 'المهام الكلية', key: 'totalTasks', width: 15 },
        { header: 'نسبة الإنجاز', key: 'completion', width: 15 },
        { header: 'المتأخرة', key: 'overdue', width: 12 },
        { header: 'درجة الصحة', key: 'health', width: 15 },
      ],
      data: deptAnalytics.map((d: any) => ({
        name: d.name, staff: d.staffCount, totalTickets: d.tickets.total, openTickets: d.tickets.open,
        avgRes: d.tickets.avgResolutionHours, totalTasks: d.tasks.total, completion: `${d.tasks.completionRate}%`,
        overdue: d.tasks.overdue, health: `${d.healthScore}%`,
      })),
      filename: 'data-warehouse-report',
    });
  };

  const isLoading = summaryLoading || deptLoading;

  return (
    <DashboardLayout title="مستودع البيانات التحليلي" portalName="dmo" navGroups={dmoNavGroups}>
      <div className="space-y-6" dir="rtl">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[hsl(43_74%_49%)]/15">
              <Database className="w-6 h-6 hub-stat-gold" />
            </div>
            <div>
              <h1 className="text-xl font-bold">مستودع البيانات التحليلي</h1>
              <p className="text-sm text-muted-foreground">تحليلات شاملة من قاعدة بيانات المنصة - بيانات حقيقية</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-1.5">
              <FileDown className="w-4 h-4" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-1.5">
              <FileSpreadsheet className="w-4 h-4" /> Excel
            </Button>
          </div>
        </div>

        {/* KPI Row */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard title="المشاريع النشطة" value={summary?.overview?.activeProjects || 0} icon={Layers} subtitle={`من ${summary?.overview?.totalProjects || 0}`} />
            <StatCard title="التذاكر المفتوحة" value={summary?.overview?.openTickets || 0} icon={Activity} subtitle={`من ${summary?.overview?.totalTickets || 0}`} />
            <StatCard title="نسبة حل التذاكر" value={`${summary?.performance?.ticketResolutionRate || 0}%`} icon={CheckCircle} />
            <StatCard title="نسبة إنجاز المهام" value={`${summary?.performance?.taskCompletionRate || 0}%`} icon={Target} />
            <StatCard title="التزام SLA" value={`${summary?.performance?.slaComplianceRate || 0}%`} icon={Shield} />
            <StatCard title="المهام المتأخرة" value={summary?.overview?.overdueTasks || 0} icon={AlertTriangle} />
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
          <TabsList className="grid w-full grid-cols-6 bg-[hsl(222_47%_11%)]/50">
            <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
            <TabsTrigger value="departments">الإدارات</TabsTrigger>
            <TabsTrigger value="compliance">الامتثال</TabsTrigger>
            <TabsTrigger value="data-quality">جودة البيانات</TabsTrigger>
            <TabsTrigger value="external-sources">المصادر الخارجية</TabsTrigger>
            <TabsTrigger value="etl-log">سجل ETL</TabsTrigger>
          </TabsList>

          {/* ==================== نظرة عامة ==================== */}
          <TabsContent value="overview" className="space-y-6 mt-4">
            {/* Trends Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="card-premium">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 hub-stat-gold" />
                    اتجاه التذاكر (6 أشهر)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {trendsLoading ? <Skeleton className="h-48" /> : (
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={trends?.tickets || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#888' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#888' }} />
                        <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#fff' }} />
                        <Area type="monotone" dataKey="created" stroke="#c9a227" fill="#c9a227" fillOpacity={0.15} name="منشأة" />
                        <Area type="monotone" dataKey="resolved" stroke="#059669" fill="#059669" fillOpacity={0.15} name="محلولة" />
                        <Legend />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card className="card-premium">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 hub-stat-gold" />
                    اتجاه المهام (6 أشهر)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {trendsLoading ? <Skeleton className="h-48" /> : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={trends?.tasks || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#888' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#888' }} />
                        <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#fff' }} />
                        <Bar dataKey="created" fill="#1e3a5f" name="منشأة" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="resolved" fill="#c9a227" name="مكتملة" radius={[4, 4, 0, 0]} />
                        <Legend />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Performance Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard title="متوسط وقت الحل" value={`${summary?.performance?.avgResolutionHours || 0} ساعة`} icon={Clock} />
              <StatCard title="مخالفات SLA" value={summary?.performance?.slaBreaches || 0} icon={AlertTriangle} />
              <StatCard title="أصول البيانات" value={summary?.dataGovernance?.dataAssets || 0} icon={Database} />
              <StatCard title="الحوادث الأمنية النشطة" value={summary?.security?.activeIncidents || 0} icon={Shield} />
            </div>

            {/* Quick Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Card className="card-premium"><CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">النطاقات</p>
                <p className="text-xl font-bold hub-stat-gold">{summary?.compliance?.domains || 0}</p>
              </CardContent></Card>
              <Card className="card-premium"><CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">المتطلبات</p>
                <p className="text-xl font-bold hub-stat-gold">{summary?.compliance?.requirements || 0}</p>
              </CardContent></Card>
              <Card className="card-premium"><CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">تغطية الأدلة</p>
                <p className="text-xl font-bold hub-stat-gold">{summary?.compliance?.evidenceCoverage || 0}%</p>
              </CardContent></Card>
              <Card className="card-premium"><CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">قرارات اللجنة</p>
                <p className="text-xl font-bold hub-stat-gold">{summary?.committee?.decisions || 0}</p>
              </CardContent></Card>
              <Card className="card-premium"><CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">الموافقات النشطة</p>
                <p className="text-xl font-bold hub-stat-gold">{summary?.dataGovernance?.activeConsents || 0}</p>
              </CardContent></Card>
            </div>
          </TabsContent>

          {/* ==================== الإدارات ==================== */}
          <TabsContent value="departments" className="space-y-6 mt-4">
            {deptLoading ? (
              <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
            ) : (
              <>
                {/* Department Comparison Chart */}
                <Card className="card-premium">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Building2 className="w-4 h-4 hub-stat-gold" />
                      مقارنة أداء الإدارات
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={deptAnalytics} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis type="number" tick={{ fontSize: 11, fill: '#888' }} />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#888' }} width={120} />
                        <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#fff' }} />
                        <Bar dataKey="healthScore" fill="#c9a227" name="درجة الصحة" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Department Cards */}
                <div className="space-y-3">
                  {deptAnalytics.map((dept: any) => {
                    const health = getHealthLabel(dept.healthScore);
                    return (
                      <Card key={dept.id} className="card-premium">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-[hsl(43_74%_49%)]/10">
                                <Building2 className="w-5 h-5 hub-stat-gold" />
                              </div>
                              <div>
                                <h3 className="font-semibold">{dept.name}</h3>
                                <p className="text-xs text-muted-foreground">{dept.staffCount} موظف · {dept.code}</p>
                              </div>
                            </div>
                            <Badge className={`${health.bg} ${health.color} border-0`}>
                              {dept.healthScore}% - {health.label}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                            <div>
                              <p className="text-lg font-bold">{dept.tickets.total}</p>
                              <p className="text-xs text-muted-foreground">تذاكر</p>
                              <p className="text-xs hub-stat-gold">{dept.tickets.open} مفتوحة</p>
                            </div>
                            <div>
                              <p className="text-lg font-bold">{dept.tasks.completionRate}%</p>
                              <p className="text-xs text-muted-foreground">إنجاز المهام</p>
                              <Progress value={dept.tasks.completionRate} className="h-1.5 mt-1" />
                            </div>
                            <div>
                              <p className="text-lg font-bold">{dept.tickets.avgResolutionHours}h</p>
                              <p className="text-xs text-muted-foreground">متوسط الحل</p>
                            </div>
                            <div>
                              <p className="text-lg font-bold">{dept.projects.total}</p>
                              <p className="text-xs text-muted-foreground">مشاريع</p>
                              <p className="text-xs text-emerald-400">{dept.projects.completed} مكتملة</p>
                            </div>
                            <div>
                              <p className="text-lg font-bold">{dept.tasks.overdue}</p>
                              <p className="text-xs text-muted-foreground">متأخرة</p>
                              {dept.tickets.slaBreaches > 0 && (
                                <p className="text-xs text-red-400">{dept.tickets.slaBreaches} مخالفة SLA</p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
          </TabsContent>

          {/* ==================== الامتثال ==================== */}
          <TabsContent value="compliance" className="space-y-6 mt-4">
            {complianceLoading ? (
              <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
            ) : (
              <>
                {/* PDPL + DSR Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatCard title="سجلات الموافقة" value={compliance?.pdpl?.totalConsents || 0} icon={CheckCircle} subtitle={`${compliance?.pdpl?.activeConsents || 0} نشطة`} />
                  <StatCard title="طلبات حقوق البيانات" value={compliance?.dsr?.total || 0} icon={Users} subtitle={`${compliance?.dsr?.pending || 0} معلقة`} />
                  <StatCard title="متوسط معالجة DSR" value={`${compliance?.dsr?.avgResolutionDays || 0} يوم`} icon={Clock} />
                  <StatCard title="الموافقات المسحوبة" value={compliance?.pdpl?.withdrawnConsents || 0} icon={AlertTriangle} />
                </div>

                {/* Domain Compliance Breakdown */}
                <Card className="card-premium">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Globe className="w-4 h-4 hub-stat-gold" />
                      امتثال النطاقات NDMO
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {(compliance?.domainBreakdown || []).map((domain: any) => (
                        <div key={domain.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors">
                          <div className="w-10 text-center">
                            <Badge variant="outline" className="text-xs">{domain.code}</Badge>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-sm font-medium truncate">{domain.name}</p>
                              <span className="text-xs text-muted-foreground">{domain.requirements} متطلب</span>
                            </div>
                            <Progress value={domain.complianceRate} className="h-1.5" />
                          </div>
                          <div className="w-14 text-left">
                            <span className={`text-sm font-bold ${domain.complianceRate >= 80 ? 'text-emerald-400' : domain.complianceRate >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                              {domain.complianceRate}%
                            </span>
                          </div>
                          <div className="w-20 text-left text-xs text-muted-foreground">
                            {domain.approvedEvidences}/{domain.evidences} دليل
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Compliance Pie Chart */}
                {compliance?.domainBreakdown?.length > 0 && (
                  <Card className="card-premium">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <PieChartIcon className="w-4 h-4 hub-stat-gold" />
                        توزيع حالة الامتثال
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'ممتثل', value: compliance.domainBreakdown.reduce((s: number, d: any) => s + d.compliant, 0) },
                              { name: 'جزئي', value: compliance.domainBreakdown.reduce((s: number, d: any) => s + d.partial, 0) },
                              { name: 'غير ممتثل', value: compliance.domainBreakdown.reduce((s: number, d: any) => s + d.nonCompliant, 0) },
                            ].filter(d => d.value > 0)}
                            cx="50%" cy="50%" outerRadius={80} innerRadius={40}
                            dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                            <Cell fill="#059669" />
                            <Cell fill="#c9a227" />
                            <Cell fill="#ef4444" />
                          </Pie>
                          <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#fff' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          {/* ==================== جودة البيانات ==================== */}
          <TabsContent value="data-quality" className="space-y-6 mt-4">
            {qualityLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
            ) : (
              <>
                {/* Assets Overview */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatCard title="أصول البيانات" value={quality?.assets?.total || 0} icon={Database} />
                  <StatCard title="الجداول المكتشفة" value={quality?.catalog?.discoveredTables || 0} icon={Server} />
                  <StatCard title="الأعمدة المكتشفة" value={quality?.catalog?.discoveredColumns || 0} icon={Layers} />
                  <StatCard title="تدفقات البيانات" value={quality?.catalog?.dataFlows || 0} icon={GitMerge} />
                </div>

                {/* Classification Breakdown */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card className="card-premium">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Lock className="w-4 h-4 hub-stat-gold" />
                        تصنيف أصول البيانات
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'سري للغاية', value: quality?.assets?.byClassification?.topSecret || 0 },
                              { name: 'سري', value: quality?.assets?.byClassification?.confidential || 0 },
                              { name: 'مقيد', value: quality?.assets?.byClassification?.restricted || 0 },
                              { name: 'عام', value: quality?.assets?.byClassification?.public || 0 },
                            ].filter(d => d.value > 0)}
                            cx="50%" cy="50%" outerRadius={70} innerRadius={35} dataKey="value"
                            label={({ name, value }) => `${name}: ${value}`}
                          >
                            <Cell fill="#ef4444" />
                            <Cell fill="#c9a227" />
                            <Cell fill="#3d5a80" />
                            <Cell fill="#059669" />
                          </Pie>
                          <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#fff' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card className="card-premium">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Eye className="w-4 h-4 hub-stat-gold" />
                        نظرة على الكتالوج
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">اتصالات قواعد البيانات</span>
                        <span className="font-bold">{quality?.catalog?.connections || 0}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">الاتصالات النشطة</span>
                        <span className="font-bold text-emerald-400">{quality?.catalog?.activeConnections || 0}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">سجلات التتبع (Lineage)</span>
                        <span className="font-bold">{quality?.catalog?.lineageRecords || 0}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">مصطلحات القاموس</span>
                        <span className="font-bold">{quality?.catalog?.dictionaryTerms || 0}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">المخاطر العالية/الحرجة</span>
                        <span className="font-bold text-red-400">{quality?.risks?.highCritical || 0}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">اتفاقيات البيانات النشطة</span>
                        <span className="font-bold text-emerald-400">{quality?.agreements?.active || 0}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>

          {/* ==================== المصادر الخارجية ==================== */}
          <TabsContent value="external-sources" className="space-y-6 mt-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              <StatCard title="إجمالي المصادر" value={sourcesSummary?.totalSources || externalSources.length || 0} icon={Plug} />
              <StatCard title="متصل اليوم" value={sourcesSummary?.connectedToday || externalSources.filter((s: any) => s.status === 'connected').length || 0} icon={Wifi} />
              <StatCard title="فشل اليوم" value={sourcesSummary?.failedToday || externalSources.filter((s: any) => s.status === 'error' || s.status === 'disconnected').length || 0} icon={WifiOff} />
              <StatCard title="الجداول الخارجية" value={sourcesSummary?.totalExternalTables || 0} icon={Table2} />
              <StatCard title="إجمالي السجلات" value={sourcesSummary?.totalRows?.toLocaleString() || 0} icon={Database} />
            </div>

            {/* ETL Manual Run Button */}
            <div className="flex items-center gap-3">
              <Button
                onClick={() => runETLMutation.mutate()}
                disabled={runETLMutation.isPending}
                className="gap-2 bg-[hsl(43_74%_49%)] hover:bg-[hsl(43_74%_42%)] text-black font-semibold"
              >
                {runETLMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                تشغيل ETL يدوياً
              </Button>
              {runETLMutation.isPending && (
                <span className="text-sm text-muted-foreground">جاري التشغيل...</span>
              )}
            </div>

            {/* Source List */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Server className="w-4 h-4 hub-stat-gold" />
                المصادر المتصلة
              </h3>
              {externalSources.length === 0 ? (
                <Card className="card-premium">
                  <CardContent className="p-8 text-center text-muted-foreground">
                    <Plug className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p>لا توجد مصادر خارجية مسجلة</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {externalSources.map((source: any, idx: number) => {
                    const isConnected = source.status === 'connected';
                    const isError = source.status === 'error';
                    return (
                      <Card key={source.id || idx} className="card-premium">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-[hsl(43_74%_49%)]/10">
                                <Database className="w-5 h-5 hub-stat-gold" />
                              </div>
                              <div>
                                <h4 className="font-semibold">{source.name}</h4>
                                <p className="text-xs text-muted-foreground">{source.host || source.connectionString || '—'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">{source.type || source.dbType || 'Unknown'}</Badge>
                              <Badge className={`text-xs border-0 ${isConnected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                {isConnected ? 'متصل' : isError ? 'خطأ' : 'غير متصل'}
                              </Badge>
                            </div>
                          </div>

                          <div className="grid grid-cols-4 gap-3 text-center">
                            <div>
                              <p className="text-lg font-bold">{source.tablesCount ?? source.tables ?? '—'}</p>
                              <p className="text-xs text-muted-foreground">جداول</p>
                            </div>
                            <div>
                              <p className="text-lg font-bold">{source.rowsCount?.toLocaleString() ?? source.rows?.toLocaleString() ?? '—'}</p>
                              <p className="text-xs text-muted-foreground">سجلات</p>
                            </div>
                            <div>
                              <p className="text-lg font-bold">{source.columnsCount ?? source.columns ?? '—'}</p>
                              <p className="text-xs text-muted-foreground">أعمدة</p>
                            </div>
                            <div>
                              <p className="text-lg font-bold">{source.responseTime ? `${source.responseTime}ms` : '—'}</p>
                              <p className="text-xs text-muted-foreground">وقت الاستجابة</p>
                            </div>
                          </div>

                          {source.lastSync && (
                            <div className="mt-3 pt-2 border-t border-white/5 flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              آخر مزامنة: {new Date(source.lastSync).toLocaleString('ar-SA')}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ETL History (last 10 runs) */}
            {etlStatus.length > 0 && (
              <Card className="card-premium">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <History className="w-4 h-4 hub-stat-gold" />
                    آخر عمليات ETL
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10 text-muted-foreground">
                          <th className="text-right py-2 px-3">التشغيل</th>
                          <th className="text-right py-2 px-3">الحالة</th>
                          <th className="text-right py-2 px-3">المدة</th>
                          <th className="text-right py-2 px-3">السجلات</th>
                          <th className="text-right py-2 px-3">التاريخ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {etlStatus.slice(0, 10).map((run: any, idx: number) => (
                          <tr key={run.id || idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                            <td className="py-2 px-3 font-medium">#{run.id || idx + 1}</td>
                            <td className="py-2 px-3">
                              <Badge className={`text-xs border-0 ${run.status === 'success' || run.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : run.status === 'running' || run.status === 'in_progress' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
                                {run.status === 'success' || run.status === 'completed' ? 'ناجح' : run.status === 'running' || run.status === 'in_progress' ? 'جاري' : 'فشل'}
                              </Badge>
                            </td>
                            <td className="py-2 px-3">{run.duration ? `${run.duration}ms` : '—'}</td>
                            <td className="py-2 px-3">{run.recordsProcessed?.toLocaleString() ?? run.records?.toLocaleString() ?? '—'}</td>
                            <td className="py-2 px-3 text-muted-foreground">{run.startedAt || run.timestamp ? new Date(run.startedAt || run.timestamp).toLocaleString('ar-SA') : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ==================== سجل ETL ==================== */}
          <TabsContent value="etl-log" className="space-y-6 mt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <GitMerge className="w-4 h-4 hub-stat-gold" />
                سجل عمليات ETL الكامل
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => runETLMutation.mutate()}
                disabled={runETLMutation.isPending}
                className="gap-1.5"
              >
                {runETLMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                تشغيل ETL يدوياً
              </Button>
            </div>

            {etlStatus.length === 0 ? (
              <Card className="card-premium">
                <CardContent className="p-8 text-center text-muted-foreground">
                  <History className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p>لا توجد عمليات ETL مسجلة</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="card-premium">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10 text-muted-foreground bg-[hsl(222_47%_11%)]/30">
                          <th className="text-right py-3 px-4">#</th>
                          <th className="text-right py-3 px-4">الحالة</th>
                          <th className="text-right py-3 px-4">النوع</th>
                          <th className="text-right py-3 px-4">المدة (ms)</th>
                          <th className="text-right py-3 px-4">السجلات المعالجة</th>
                          <th className="text-right py-3 px-4">الأخطاء</th>
                          <th className="text-right py-3 px-4">وقت البدء</th>
                          <th className="text-right py-3 px-4">وقت الانتهاء</th>
                        </tr>
                      </thead>
                      <tbody>
                        {etlStatus.map((run: any, idx: number) => (
                          <tr key={run.id || idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                            <td className="py-3 px-4 font-medium">{run.id || idx + 1}</td>
                            <td className="py-3 px-4">
                              <Badge className={`text-xs border-0 ${run.status === 'success' || run.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : run.status === 'running' || run.status === 'in_progress' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
                                {run.status === 'success' || run.status === 'completed' ? 'ناجح' : run.status === 'running' || run.status === 'in_progress' ? 'جاري' : 'فشل'}
                              </Badge>
                            </td>
                            <td className="py-3 px-4">{run.type || run.pipeline || 'عام'}</td>
                            <td className="py-3 px-4">{run.duration?.toLocaleString() ?? '—'}</td>
                            <td className="py-3 px-4">{run.recordsProcessed?.toLocaleString() ?? run.records?.toLocaleString() ?? '—'}</td>
                            <td className="py-3 px-4">
                              {(run.errors || run.errorCount) ? (
                                <span className="text-red-400">{run.errors || run.errorCount}</span>
                              ) : (
                                <span className="text-emerald-400">0</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-muted-foreground text-xs">{run.startedAt || run.timestamp ? new Date(run.startedAt || run.timestamp).toLocaleString('ar-SA') : '—'}</td>
                            <td className="py-3 px-4 text-muted-foreground text-xs">{run.completedAt || run.endTime ? new Date(run.completedAt || run.endTime).toLocaleString('ar-SA') : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ETL Summary Stats */}
            {etlStatus.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard
                  title="إجمالي العمليات"
                  value={etlStatus.length}
                  icon={Activity}
                />
                <StatCard
                  title="العمليات الناجحة"
                  value={etlStatus.filter((r: any) => r.status === 'success' || r.status === 'completed').length}
                  icon={CheckCircle}
                />
                <StatCard
                  title="العمليات الفاشلة"
                  value={etlStatus.filter((r: any) => r.status === 'failed' || r.status === 'error').length}
                  icon={AlertTriangle}
                />
                <StatCard
                  title="متوسط المدة"
                  value={`${Math.round(etlStatus.reduce((sum: number, r: any) => sum + (r.duration || 0), 0) / etlStatus.length)}ms`}
                  icon={Clock}
                />
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
