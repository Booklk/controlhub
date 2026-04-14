import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { exportToPDF } from '@/lib/exports';
import DashboardLayout from '@/components/DashboardLayout';
import { itDirectorNavGroups } from '@/lib/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  FileDown, RefreshCw, Calendar, BarChart3, Users, Ticket,
  CheckCircle, AlertTriangle, FolderKanban, Shield, Lightbulb,
  Building2, TrendingUp, Clock, Gauge,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────
interface KPISummary {
  totalEmployees: number;
  openTickets: number;
  completedTasks: number;
  activeProjects: number;
  slaCompliance: number;
  overallHealth: number;
}

interface ReportSection {
  title: string;
  content: string;
  highlights?: string[];
}

interface Recommendation {
  id: number;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: string;
  impact?: string;
}

interface GeneratedReport {
  id: number;
  title: string;
  period: string;
  generatedAt: string;
  sections: ReportSection[];
  summary?: string;
}

// ─── Helpers ───────────────────────────────────────────────────
function priorityBadge(p: string) {
  const map: Record<string, { label: string; className: string }> = {
    high: { label: 'مرتفعة', className: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
    medium: { label: 'متوسطة', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    low: { label: 'منخفضة', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  };
  const cfg = map[p] || map.medium;
  return <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>;
}

function rateColor(v: number): string {
  if (v >= 80) return 'text-emerald-400';
  if (v >= 60) return 'text-amber-400';
  return 'text-rose-400';
}

const PERIOD_OPTIONS = [
  { value: 'weekly', label: 'أسبوعي' },
  { value: 'monthly', label: 'شهري' },
  { value: 'quarterly', label: 'ربع سنوي' },
  { value: 'yearly', label: 'سنوي' },
];

// ─── Component ─────────────────────────────────────────────────
export default function ExecutiveSummaryPage() {
  const [period, setPeriod] = useState('monthly');
  const today = new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });

  // KPI summary data
  const { data: kpiData, isLoading: kpiLoading } = useQuery<KPISummary>({
    queryKey: ['/api/data-warehouse/executive-summary'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/data-warehouse/executive-summary');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Smart recommendations
  const { data: recommendations, isLoading: recsLoading } = useQuery<Recommendation[]>({
    queryKey: ['/api/smart/recommendations'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/smart/recommendations');
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  // Generate report mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/reports/generate', {
        reportType: 'executive_summary',
        period,
      });
      return res.json() as Promise<GeneratedReport>;
    },
  });

  const report = generateMutation.data;

  // Export handler
  function handleExportPDF() {
    const sections = report?.sections || [];
    exportToPDF({
      title: 'الملخص التنفيذي - نادي سباقات الخيل',
      subtitle: `الفترة: ${PERIOD_OPTIONS.find(p => p.value === period)?.label || period} | ${today}`,
      filename: 'executive-summary',
      orientation: 'portrait',
      columns: [
        { header: 'القسم', key: 'section' },
        { header: 'التفاصيل', key: 'detail' },
      ],
      data: sections.flatMap(s => [
        { section: s.title, detail: s.content },
        ...(s.highlights || []).map(h => ({ section: '', detail: `- ${h}` })),
      ]),
      summaryStats: kpiData ? [
        { label: 'الموظفين', value: kpiData.totalEmployees },
        { label: 'التذاكر المفتوحة', value: kpiData.openTickets },
        { label: 'المهام المكتملة', value: kpiData.completedTasks },
        { label: 'المشاريع النشطة', value: kpiData.activeProjects },
        { label: 'SLA', value: `${kpiData.slaCompliance}%` },
        { label: 'الصحة العامة', value: `${kpiData.overallHealth}%` },
      ] : [],
    });
  }

  // ─── KPI row items ──────────────────────────────────────────
  const kpiItems = kpiData ? [
    { icon: Users, label: 'إجمالي الموظفين', value: kpiData.totalEmployees, color: 'text-blue-400' },
    { icon: Ticket, label: 'التذاكر المفتوحة', value: kpiData.openTickets, color: 'text-amber-400' },
    { icon: CheckCircle, label: 'المهام المكتملة', value: kpiData.completedTasks, color: 'text-emerald-400' },
    { icon: FolderKanban, label: 'المشاريع النشطة', value: kpiData.activeProjects, color: 'text-purple-400' },
    { icon: Shield, label: 'امتثال SLA', value: `${kpiData.slaCompliance}%`, color: rateColor(kpiData.slaCompliance) },
    { icon: Gauge, label: 'الصحة العامة', value: `${kpiData.overallHealth}%`, color: rateColor(kpiData.overallHealth) },
  ] : [];

  return (
    <DashboardLayout title="الملخص التنفيذي" portalName="مدير تقنية المعلومات" navGroups={itDirectorNavGroups}>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">الملخص التنفيذي</h1>
            <p className="text-sm text-white/50 mt-1 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {today}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-36 border-[hsl(43_74%_49%)]/30 bg-[hsl(222_47%_13%)] text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="gold"
              className="gap-2"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
              إنشاء التقرير
            </Button>
          </div>
        </div>

        {/* ── Organization header ────────────────────────────── */}
        <Card className="border-[hsl(43_74%_49%)]/30 bg-gradient-to-l from-[hsl(222_47%_13%)] to-[hsl(222_47%_16%)] backdrop-blur overflow-hidden">
          <CardContent className="py-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-[hsl(43_74%_49%)]/10 border border-[hsl(43_74%_49%)]/20">
                <Building2 className="w-8 h-8 text-[hsl(43_74%_49%)]" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">نادي سباقات الخيل</h2>
                <p className="text-sm text-white/50">إدارة تقنية المعلومات - الملخص التنفيذي</p>
              </div>
            </div>
            <Badge variant="outline" className="border-[hsl(43_74%_49%)]/40 text-[hsl(43_74%_49%)]">
              {PERIOD_OPTIONS.find(p => p.value === period)?.label}
            </Badge>
          </CardContent>
        </Card>

        {/* ── KPI Summary Row ────────────────────────────────── */}
        {kpiLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="h-24 rounded-xl bg-white/5" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {kpiItems.map((item, idx) => (
              <Card key={idx} className="border-[hsl(43_74%_49%)]/15 bg-[hsl(222_47%_13%)]/80 backdrop-blur">
                <CardContent className="py-4 px-3 text-center">
                  <item.icon className={`w-6 h-6 mx-auto mb-2 ${item.color}`} />
                  <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                  <p className="text-[11px] text-white/40 mt-1">{item.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* ── Generated Report ───────────────────────────────── */}
        {generateMutation.isPending && (
          <Card className="border-[hsl(43_74%_49%)]/20 bg-[hsl(222_47%_13%)]/80 backdrop-blur">
            <CardContent className="py-12 text-center">
              <RefreshCw className="w-8 h-8 text-[hsl(43_74%_49%)] animate-spin mx-auto mb-4" />
              <p className="text-white/60">جارٍ إنشاء الملخص التنفيذي...</p>
            </CardContent>
          </Card>
        )}

        {generateMutation.isError && (
          <Card className="border-rose-500/30 bg-[hsl(222_47%_13%)]/80 backdrop-blur">
            <CardContent className="py-6 text-center">
              <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto mb-3" />
              <p className="text-rose-400 font-medium">حدث خطأ أثناء إنشاء التقرير</p>
              <p className="text-white/40 text-sm mt-1">يرجى المحاولة مرة أخرى</p>
            </CardContent>
          </Card>
        )}

        {report && (
          <div className="space-y-4">
            {/* Report header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">{report.title || 'الملخص التنفيذي'}</h3>
                {report.generatedAt && (
                  <p className="text-xs text-white/40 mt-1">
                    تم الإنشاء: {new Date(report.generatedAt).toLocaleString('ar-SA')}
                  </p>
                )}
              </div>
              <Button variant="outline" size="sm" className="gap-2 border-[hsl(43_74%_49%)]/30 text-white hover:bg-[hsl(43_74%_49%)]/10" onClick={handleExportPDF}>
                <FileDown className="w-4 h-4" />
                تصدير PDF
              </Button>
            </div>

            {/* Report summary */}
            {report.summary && (
              <Card className="border-[hsl(43_74%_49%)]/20 bg-[hsl(222_47%_13%)]/80 backdrop-blur">
                <CardContent className="py-4">
                  <p className="text-white/80 leading-relaxed">{report.summary}</p>
                </CardContent>
              </Card>
            )}

            {/* Report sections */}
            {report.sections?.map((section, idx) => (
              <Card key={idx} className="border-[hsl(43_74%_49%)]/15 bg-[hsl(222_47%_13%)]/80 backdrop-blur">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[hsl(43_74%_49%)]" />
                    {section.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-white/70 leading-relaxed">{section.content}</p>
                  {section.highlights && section.highlights.length > 0 && (
                    <ul className="space-y-1.5">
                      {section.highlights.map((h, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-white/60">
                          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          {h}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* ── Recommendations ────────────────────────────────── */}
        <Card className="border-[hsl(43_74%_49%)]/20 bg-[hsl(222_47%_13%)]/80 backdrop-blur">
          <CardHeader className="pb-3">
            <CardTitle className="text-white flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-[hsl(43_74%_49%)]" />
              التوصيات والمقترحات
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-16 rounded-lg bg-white/5" />
                ))}
              </div>
            ) : recommendations && recommendations.length > 0 ? (
              <div className="space-y-3">
                {recommendations.map(rec => (
                  <div key={rec.id} className="p-4 rounded-lg bg-white/5 border border-white/5 hover:border-[hsl(43_74%_49%)]/20 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-semibold text-white">{rec.title}</h4>
                          {priorityBadge(rec.priority)}
                          {rec.category && (
                            <Badge variant="outline" className="border-white/10 text-white/40 text-[10px]">
                              {rec.category}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-white/50">{rec.description}</p>
                        {rec.impact && (
                          <p className="text-xs text-[hsl(43_74%_49%)]/70 mt-1 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            الأثر المتوقع: {rec.impact}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Lightbulb className="w-8 h-8 text-white/20 mx-auto mb-3" />
                <p className="text-white/40 text-sm">لا توجد توصيات حالياً</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Print-ready footer ─────────────────────────────── */}
        <div className="text-center py-4 border-t border-white/5">
          <p className="text-xs text-white/20">
            Control Hub - JCSA | الملخص التنفيذي | {today}
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
