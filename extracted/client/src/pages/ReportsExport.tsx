import { useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import DashboardLayout from '@/components/DashboardLayout';
import { adminNavGroups } from '@/lib/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { PageHeader, KpiCard } from '@/components/Quality';
import {
  Download, FileSpreadsheet, UserCheck, Ticket, FolderKanban,
  ClipboardCheck, Server, Database, Calendar, Loader2,
  ListChecks, Shield, ShieldAlert, Bug, AlertTriangle,
  HardDrive, Network, Archive, Monitor,
  Lightbulb, AppWindow, Cloud,
  ArrowUpFromLine, Truck, FileBarChart,
  Gavel, Users2, BookOpen, BarChart3, Handshake, LayoutGrid,
  FileText, Filter
} from 'lucide-react';

type ExportFormat = 'xlsx' | 'pdf';

interface ReportType {
  id: string;
  title: string;
  description: string;
  icon: JSX.Element;
  endpoint: string;
  filename: string;
  category: string;
}

interface ReportTemplate {
  id: string;
  label: string;
  description: string;
  icon: JSX.Element;
  reportIds: string[];
}

const GOLD = 'hub-badge-gold';
const NAVY = 'hub-badge-navy';

const reportTemplates: ReportTemplate[] = [
  {
    id: 'weekly-ops',
    label: 'التقرير التشغيلي الأسبوعي',
    description: 'تذاكر + مهام + تصعيدات + SLA',
    icon: <Calendar className="w-5 h-5" />,
    reportIds: ['tickets', 'tasks', 'escalations', 'sla', 'weekly-report'],
  },
  {
    id: 'security-posture',
    label: 'الوضع الأمني الشامل',
    description: 'بلاغات + ثغرات + تهديدات + امتثال',
    icon: <Shield className="w-5 h-5" />,
    reportIds: ['security-incidents', 'vulnerabilities', 'threats', 'compliance'],
  },
  {
    id: 'infra-health',
    label: 'صحة البنية التحتية',
    description: 'خوادم + شبكات + تخزين + أصول',
    icon: <Server className="w-5 h-5" />,
    reportIds: ['servers', 'networks', 'storage', 'it-assets'],
  },
  {
    id: 'data-governance',
    label: 'حوكمة البيانات',
    description: 'أصول + قاموس + مخاطر + اتفاقيات',
    icon: <Database className="w-5 h-5" />,
    reportIds: ['data-assets', 'data-dictionary', 'data-risks', 'data-agreements', 'data-stewards'],
  },
];

interface CategoryInfo {
  id: string;
  label: string;
  icon: JSX.Element;
}

const categories: CategoryInfo[] = [
  { id: 'all', label: 'الكل', icon: <LayoutGrid className="w-4 h-4" /> },
  { id: 'admin', label: 'الادارة', icon: <UserCheck className="w-4 h-4" /> },
  { id: 'it', label: 'تقنية المعلومات', icon: <Monitor className="w-4 h-4" /> },
  { id: 'cybersecurity', label: 'الامن السيبراني', icon: <Shield className="w-4 h-4" /> },
  { id: 'infrastructure', label: 'البنية التحتية', icon: <Server className="w-4 h-4" /> },
  { id: 'dmo', label: 'حوكمة البيانات', icon: <Database className="w-4 h-4" /> },
  { id: 'digital', label: 'التحول الرقمي', icon: <Lightbulb className="w-4 h-4" /> },
  { id: 'committee', label: 'اللجان', icon: <Users2 className="w-4 h-4" /> },
  { id: 'support', label: 'الدعم الفني', icon: <Ticket className="w-4 h-4" /> },
];

const reports: ReportType[] = [
  {
    id: 'users',
    title: 'تقرير المستخدمين',
    description: 'قائمة جميع المستخدمين مع معلوماتهم وادوارهم',
    icon: <UserCheck className="w-6 h-6" />,
    endpoint: '/api/export/users',
    filename: 'المستخدمين',
    category: 'admin',
  },
  {
    id: 'audit-logs',
    title: 'سجلات التدقيق',
    description: 'سجل جميع العمليات والانشطة في النظام',
    icon: <ClipboardCheck className="w-6 h-6" />,
    endpoint: '/api/export/audit-logs',
    filename: 'سجلات-التدقيق',
    category: 'admin',
  },
  {
    id: 'tasks',
    title: 'تقرير المهام',
    description: 'جميع المهام وحالتها واولوياتها عبر البوابات',
    icon: <ListChecks className="w-6 h-6" />,
    endpoint: '/api/export/tasks',
    filename: 'المهام',
    category: 'admin',
  },
  {
    id: 'compliance',
    title: 'تقرير الامتثال',
    description: 'تقرير شامل عن مستوى الامتثال للمعايير',
    icon: <FileBarChart className="w-6 h-6" />,
    endpoint: '/api/export/compliance',
    filename: 'تقرير-الامتثال',
    category: 'admin',
  },
  {
    id: 'kpis',
    title: 'مؤشرات الاداء',
    description: 'جميع مؤشرات الاداء وقيمها الفعلية والمستهدفة',
    icon: <BarChart3 className="w-6 h-6" />,
    endpoint: '/api/export/kpis',
    filename: 'مؤشرات-الاداء',
    category: 'admin',
  },
  {
    id: 'tickets',
    title: 'تقرير التذاكر',
    description: 'جميع تذاكر الدعم الفني وحالتها',
    icon: <Ticket className="w-6 h-6" />,
    endpoint: '/api/export/tickets',
    filename: 'التذاكر',
    category: 'it',
  },
  {
    id: 'projects',
    title: 'تقرير المشاريع',
    description: 'جميع المشاريع التقنية وتقدمها',
    icon: <FolderKanban className="w-6 h-6" />,
    endpoint: '/api/export/projects',
    filename: 'المشاريع',
    category: 'it',
  },
  {
    id: 'it-referrals',
    title: 'تقرير الإحالات البينية',
    description: 'جميع الإحالات بين الإدارات مع بيانات SLA والأولويات والتصعيدات',
    icon: <ArrowUpFromLine className="w-6 h-6" />,
    endpoint: '/api/export/it-referrals',
    filename: 'الإحالات-البينية',
    category: 'it',
  },
  {
    id: 'security-incidents',
    title: 'البلاغات الامنية',
    description: 'جميع البلاغات الامنية وخطورتها وحالتها',
    icon: <ShieldAlert className="w-6 h-6" />,
    endpoint: '/api/export/security-incidents',
    filename: 'البلاغات-الامنية',
    category: 'cybersecurity',
  },
  {
    id: 'vulnerabilities',
    title: 'الثغرات الامنية',
    description: 'جميع الثغرات المكتشفة والانظمة المتاثرة',
    icon: <Bug className="w-6 h-6" />,
    endpoint: '/api/export/vulnerabilities',
    filename: 'الثغرات-الامنية',
    category: 'cybersecurity',
  },
  {
    id: 'threats',
    title: 'التهديدات الامنية',
    description: 'سجل التهديدات الامنية وانواعها وخطورتها',
    icon: <AlertTriangle className="w-6 h-6" />,
    endpoint: '/api/export/threats',
    filename: 'التهديدات-الامنية',
    category: 'cybersecurity',
  },
  {
    id: 'servers',
    title: 'تقرير الخوادم',
    description: 'جميع الخوادم وانظمة التشغيل وحالتها',
    icon: <Server className="w-6 h-6" />,
    endpoint: '/api/export/servers',
    filename: 'الخوادم',
    category: 'infrastructure',
  },
  {
    id: 'networks',
    title: 'تقرير الشبكات',
    description: 'جميع الشبكات وانواعها ونطاقاتها',
    icon: <Network className="w-6 h-6" />,
    endpoint: '/api/export/networks',
    filename: 'الشبكات',
    category: 'infrastructure',
  },
  {
    id: 'storage',
    title: 'تقرير التخزين',
    description: 'وحدات التخزين وسعتها واستخدامها',
    icon: <HardDrive className="w-6 h-6" />,
    endpoint: '/api/export/storage',
    filename: 'التخزين',
    category: 'infrastructure',
  },
  {
    id: 'it-assets',
    title: 'اصول تقنية المعلومات',
    description: 'جميع الاصول التقنية والاجهزة ومعلوماتها',
    icon: <Archive className="w-6 h-6" />,
    endpoint: '/api/export/it-assets',
    filename: 'اصول-تقنية-المعلومات',
    category: 'infrastructure',
  },
  {
    id: 'data-assets',
    title: 'الاصول البيانية',
    description: 'جميع اصول البيانات وتصنيفاتها وملاكها',
    icon: <Database className="w-6 h-6" />,
    endpoint: '/api/export/data-assets',
    filename: 'الاصول-البيانية',
    category: 'dmo',
  },
  {
    id: 'data-dictionary',
    title: 'قاموس البيانات',
    description: 'المصطلحات والتعريفات وانواع البيانات',
    icon: <BookOpen className="w-6 h-6" />,
    endpoint: '/api/export/data-dictionary',
    filename: 'قاموس-البيانات',
    category: 'dmo',
  },
  {
    id: 'data-risks',
    title: 'سجل المخاطر',
    description: 'مخاطر البيانات ومستوياتها وخطط التخفيف',
    icon: <AlertTriangle className="w-6 h-6" />,
    endpoint: '/api/export/data-risks',
    filename: 'سجل-المخاطر',
    category: 'dmo',
  },
  {
    id: 'data-agreements',
    title: 'اتفاقيات مشاركة البيانات',
    description: 'جميع اتفاقيات مشاركة البيانات مع الجهات',
    icon: <Handshake className="w-6 h-6" />,
    endpoint: '/api/export/data-agreements',
    filename: 'اتفاقيات-مشاركة-البيانات',
    category: 'dmo',
  },
  {
    id: 'data-stewards',
    title: 'ممثلو بيانات الاعمال',
    description: 'قائمة ممثلي البيانات وادوارهم واداراتهم',
    icon: <Users2 className="w-6 h-6" />,
    endpoint: '/api/export/data-stewards',
    filename: 'ممثلو-البيانات',
    category: 'dmo',
  },
  {
    id: 'digital-initiatives',
    title: 'مبادرات التحول الرقمي',
    description: 'جميع المبادرات الرقمية وتقدمها وحالتها',
    icon: <Lightbulb className="w-6 h-6" />,
    endpoint: '/api/export/digital-initiatives',
    filename: 'مبادرات-التحول-الرقمي',
    category: 'digital',
  },
  {
    id: 'digital-applications',
    title: 'التطبيقات الرقمية',
    description: 'جميع التطبيقات الرقمية ومنصاتها وموردوها',
    icon: <AppWindow className="w-6 h-6" />,
    endpoint: '/api/export/digital-applications',
    filename: 'التطبيقات-الرقمية',
    category: 'digital',
  },
  {
    id: 'cloud-services',
    title: 'الخدمات السحابية',
    description: 'جميع الخدمات السحابية ومزوديها وتكاليفها',
    icon: <Cloud className="w-6 h-6" />,
    endpoint: '/api/export/cloud-services',
    filename: 'الخدمات-السحابية',
    category: 'digital',
  },
  {
    id: 'committee-decisions',
    title: 'قرارات اللجان',
    description: 'جميع القرارات المتخذة واولوياتها وحالتها',
    icon: <Gavel className="w-6 h-6" />,
    endpoint: '/api/export/committee-decisions',
    filename: 'قرارات-اللجان',
    category: 'committee',
  },
  {
    id: 'committee-meetings',
    title: 'اجتماعات اللجان',
    description: 'جميع الاجتماعات ومواعيدها ومواقعها',
    icon: <Calendar className="w-6 h-6" />,
    endpoint: '/api/export/committee-meetings',
    filename: 'اجتماعات-اللجان',
    category: 'committee',
  },
  {
    id: 'escalations',
    title: 'التصعيدات',
    description: 'جميع التصعيدات واسبابها واولوياتها',
    icon: <ArrowUpFromLine className="w-6 h-6" />,
    endpoint: '/api/export/escalations',
    filename: 'التصعيدات',
    category: 'support',
  },
  {
    id: 'vendors',
    title: 'الموردون',
    description: 'جميع الموردين وبياناتهم وتقييماتهم',
    icon: <Truck className="w-6 h-6" />,
    endpoint: '/api/export/vendors',
    filename: 'الموردون',
    category: 'support',
  },
  {
    id: 'sla',
    title: 'اتفاقيات مستوى الخدمة',
    description: 'اتفاقيات SLA والقيم المستهدفة والفعلية',
    icon: <FileBarChart className="w-6 h-6" />,
    endpoint: '/api/export/sla',
    filename: 'اتفاقيات-مستوى-الخدمة',
    category: 'support',
  },
  {
    id: 'weekly-report',
    title: 'التقرير الأسبوعي',
    description: 'تقرير العمليات الأسبوعي مع مقارنات KPI واتجاهات الأداء',
    icon: <BarChart3 className="w-6 h-6" />,
    endpoint: '/api/export/weekly-report',
    filename: 'التقرير-الأسبوعي',
    category: 'admin',
  },
];

export default function ReportsExport() {
  const { toast } = useToast();
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('xlsx');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  const departmentOptions = [
    { value: 'all', label: 'جميع الإدارات' },
    { value: 'it', label: 'تقنية المعلومات' },
    { value: 'cybersecurity', label: 'الأمن السيبراني' },
    { value: 'infrastructure', label: 'البنية التحتية' },
    { value: 'digital', label: 'التحول الرقمي' },
    { value: 'dmo', label: 'حوكمة البيانات' },
    { value: 'support', label: 'الدعم الفني' },
    { value: 'committee', label: 'اللجان' },
  ];

  const handleExport = async (report: ReportType, format: ExportFormat = exportFormat) => {
    setExportingId(report.id);
    try {
      const params = new URLSearchParams();
      if (format === 'pdf') params.append('format', 'pdf');
      if (dateFrom) params.append('from', dateFrom);
      if (dateTo) params.append('to', dateTo);
      if (departmentFilter !== 'all') params.append('department', departmentFilter);
      const queryStr = params.toString() ? `?${params.toString()}` : '';

      const response = await apiRequest('GET', `${report.endpoint}${queryStr}`);

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = format === 'pdf' ? '.pdf' : '.xlsx';
      a.download = `${report.filename}-${new Date().toISOString().split('T')[0]}${ext}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'تم التصدير بنجاح',
        description: `تم تحميل ${report.title} بصيغة ${format === 'pdf' ? 'PDF' : 'Excel'}`,
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'خطأ غير معروف';
      toast({
        title: 'فشل التصدير',
        description: `حدث خطأ أثناء تصدير البيانات: ${errMsg}. تأكد من صلاحياتك.`,
        variant: 'destructive',
      });
    } finally {
      setExportingId(null);
    }
  };

  const filteredReports = activeTab === 'all'
    ? reports
    : reports.filter(r => r.category === activeTab);

  const handleExportAll = async () => {
    for (const report of filteredReports) {
      await handleExport(report);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  const handleExportTemplate = async (template: ReportTemplate) => {
    const templateReports = reports.filter(r => template.reportIds.includes(r.id));
    for (const report of templateReports) {
      await handleExport(report);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    toast({
      title: 'تم تصدير القالب',
      description: `تم تحميل ${templateReports.length} تقارير من "${template.label}"`,
    });
  };

  const getCategoryCount = (catId: string) => {
    if (catId === 'all') return reports.length;
    return reports.filter(r => r.category === catId).length;
  };

  const getIconColor = (index: number) => {
    return index % 2 === 0 ? GOLD : NAVY;
  };

  return (
    <DashboardLayout
      title="تصدير التقارير"
      subtitle="تصدير البيانات والتقارير بصيغة Excel"
      navGroups={adminNavGroups}
      portalName="بوابة مدير النظام"
    >
      <div className="space-y-5">
        <PageHeader
          icon={FileSpreadsheet}
          title="مركز تصدير التقارير"
          subtitle={`${reports.length} تقرير متاح للتصدير بصيغة Excel للتحليل والأرشفة`}
          actions={
            <>
              <Button
                variant="outline"
                className="h-9 gap-1.5 text-xs border-white/10 text-white/70 hover:bg-white/5"
                onClick={() => setShowFilters(!showFilters)}
                data-testid="button-toggle-filters"
              >
                <Filter className="w-3.5 h-3.5" />
                {showFilters ? 'إخفاء الفلاتر' : 'فلاتر التصدير'}
              </Button>
              <Button
                className="btn-gold h-9 gap-1.5 text-xs"
                onClick={handleExportAll}
                disabled={exportingId !== null}
                data-testid="button-export-all"
              >
                <Download className="w-3.5 h-3.5" />
                تصدير الكل
              </Button>
            </>
          }
        />

        {/* Export Filters Panel */}
        {showFilters && (
          <Card className="card-premium border-[hsl(var(--gold))]/20">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-white/50 font-medium">صيغة التصدير</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setExportFormat('xlsx')}
                      className={`flex-1 text-xs py-2 px-3 rounded-lg border transition-all ${
                        exportFormat === 'xlsx'
                          ? 'bg-[hsl(var(--gold))]/15 border-[hsl(var(--gold))]/40 text-[hsl(var(--gold))]'
                          : 'border-white/10 text-white/50 hover:border-white/20'
                      }`}
                      data-testid="format-xlsx"
                    >
                      <FileSpreadsheet className="w-4 h-4 mx-auto mb-1" />
                      Excel
                    </button>
                    <button
                      onClick={() => setExportFormat('pdf')}
                      className={`flex-1 text-xs py-2 px-3 rounded-lg border transition-all ${
                        exportFormat === 'pdf'
                          ? 'bg-[hsl(var(--gold))]/15 border-[hsl(var(--gold))]/40 text-[hsl(var(--gold))]'
                          : 'border-white/10 text-white/50 hover:border-white/20'
                      }`}
                      data-testid="format-pdf"
                    >
                      <FileText className="w-4 h-4 mx-auto mb-1" />
                      PDF
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-white/50 font-medium">من تاريخ</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                    className="w-full text-xs py-2 px-3 rounded-lg border border-white/10 bg-white/5 text-white/80 focus:border-[hsl(var(--gold))]/40 focus:outline-none"
                    data-testid="input-date-from"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-white/50 font-medium">إلى تاريخ</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                    className="w-full text-xs py-2 px-3 rounded-lg border border-white/10 bg-white/5 text-white/80 focus:border-[hsl(var(--gold))]/40 focus:outline-none"
                    data-testid="input-date-to"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-white/50 font-medium">الإدارة</label>
                  <select
                    value={departmentFilter}
                    onChange={e => setDepartmentFilter(e.target.value)}
                    className="w-full text-xs py-2 px-3 rounded-lg border border-white/10 bg-white/5 text-white/80 focus:border-[hsl(var(--gold))]/40 focus:outline-none"
                    data-testid="select-department"
                  >
                    {departmentOptions.map(opt => (
                      <option key={opt.value} value={opt.value} className="bg-[#0a1628] text-white">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {(dateFrom || dateTo || departmentFilter !== 'all') && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
                  <span className="text-[10px] text-white/40">الفلاتر النشطة:</span>
                  {dateFrom && (
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      من: {dateFrom}
                      <button onClick={() => setDateFrom('')} className="hover:text-red-400">&times;</button>
                    </Badge>
                  )}
                  {dateTo && (
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      إلى: {dateTo}
                      <button onClick={() => setDateTo('')} className="hover:text-red-400">&times;</button>
                    </Badge>
                  )}
                  {departmentFilter !== 'all' && (
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      {departmentOptions.find(d => d.value === departmentFilter)?.label}
                      <button onClick={() => setDepartmentFilter('all')} className="hover:text-red-400">&times;</button>
                    </Badge>
                  )}
                  <button
                    onClick={() => { setDateFrom(''); setDateTo(''); setDepartmentFilter('all'); }}
                    className="text-[10px] text-red-400/60 hover:text-red-400 mr-auto"
                  >
                    مسح الكل
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Report Templates */}
        <Card className="card-premium">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileBarChart className="w-4 h-4 hub-stat-gold" />
              قوالب التقارير الجاهزة
            </CardTitle>
            <CardDescription className="text-xs">تصدير مجموعة تقارير مرتبطة بضغطة واحدة</CardDescription>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {reportTemplates.map(template => (
                <button
                  key={template.id}
                  onClick={() => handleExportTemplate(template)}
                  disabled={exportingId !== null}
                  className="text-right p-3 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/5 hover:border-[hsl(var(--gold))]/30 transition-all group disabled:opacity-50"
                  data-testid={`template-${template.id}`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="p-2 rounded-lg hub-badge-gold shrink-0 group-hover:scale-105 transition-transform">
                      {template.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white/80 group-hover:text-[hsl(var(--gold))] transition-colors">
                        {template.label}
                      </div>
                      <div className="text-[10px] text-white/40 mt-0.5">{template.description}</div>
                      <div className="text-[10px] text-white/30 mt-1">{template.reportIds.length} تقارير</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="card-premium">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-3">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="text-center cursor-pointer hover-elevate rounded-lg p-2"
                  data-testid={`stat-category-${cat.id}`}
                  onClick={() => setActiveTab(cat.id)}
                >
                  <div className="text-2xl font-bold text-foreground">{getCategoryCount(cat.id)}</div>
                  <div className="text-xs text-muted-foreground">{cat.label}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="overflow-x-auto pb-1">
            <TabsList className="inline-flex w-auto min-w-full md:min-w-0 gap-1" data-testid="tabs-categories">
              {categories.map((cat) => (
                <TabsTrigger
                  key={cat.id}
                  value={cat.id}
                  className="gap-1.5 text-xs sm:text-sm whitespace-nowrap"
                  data-testid={`tab-${cat.id}`}
                >
                  {cat.icon}
                  <span>{cat.label}</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {getCategoryCount(cat.id)}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {categories.map((cat) => (
            <TabsContent key={cat.id} value={cat.id} className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(cat.id === 'all' ? reports : reports.filter(r => r.category === cat.id)).map((report, idx) => (
                  <Card
                    key={report.id}
                    className="card-premium hover-elevate"
                    data-testid={`card-report-${report.id}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between flex-wrap gap-2">
                        <div className={`p-3 rounded-xl ${getIconColor(idx)}`}>
                          {report.icon}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            Excel / PDF
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {categories.find(c => c.id === report.category)?.label}
                          </Badge>
                        </div>
                      </div>
                      <CardTitle className="text-lg mt-4" data-testid={`text-report-title-${report.id}`}>
                        {report.title}
                      </CardTitle>
                      <CardDescription>{report.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-2">
                        <Button
                          className="flex-1 btn-navy gap-2"
                          onClick={() => handleExport(report, 'xlsx')}
                          disabled={exportingId !== null}
                          data-testid={`button-export-${report.id}`}
                        >
                          {exportingId === report.id ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              جاري التصدير...
                            </>
                          ) : (
                            <>
                              <FileSpreadsheet className="w-4 h-4" />
                              Excel
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          className="gap-1.5 border-white/10 text-white/60 hover:bg-white/5 hover:text-white/80"
                          onClick={() => handleExport(report, 'pdf')}
                          disabled={exportingId !== null}
                          data-testid={`button-export-pdf-${report.id}`}
                        >
                          <FileText className="w-4 h-4" />
                          PDF
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Database className="w-5 h-5 hub-stat-gold" />
              معلومات التصدير
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg hub-icon-gold">
                  <FileSpreadsheet className="w-5 h-5 hub-stat-gold" />
                </div>
                <div>
                  <h4 className="font-medium">صيغة الملفات</h4>
                  <p className="text-sm text-muted-foreground">جميع التقارير بصيغة Excel (.xlsx) متوافقة مع Microsoft Office</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg hub-icon-navy">
                  <Calendar className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <h4 className="font-medium">التاريخ والوقت</h4>
                  <p className="text-sm text-muted-foreground">يتم اضافة تاريخ التصدير تلقائيا لاسم الملف</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg hub-icon-gold">
                  <Server className="w-5 h-5 hub-stat-gold" />
                </div>
                <div>
                  <h4 className="font-medium">البيانات الحقيقية</h4>
                  <p className="text-sm text-muted-foreground">التقارير تحتوي على احدث البيانات من قاعدة البيانات</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
