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
  Gavel, Users2, BookOpen, BarChart3, Handshake, LayoutGrid
} from 'lucide-react';

interface ReportType {
  id: string;
  title: string;
  description: string;
  icon: JSX.Element;
  endpoint: string;
  filename: string;
  category: string;
}

const GOLD = 'hub-badge-gold';
const NAVY = 'hub-badge-navy';

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

  const handleExport = async (report: ReportType) => {
    setExportingId(report.id);
    try {
      const response = await apiRequest('GET', report.endpoint);

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report.filename}-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'تم التصدير بنجاح',
        description: `تم تحميل ${report.title}`,
      });
    } catch (error) {
      toast({
        title: 'فشل التصدير',
        description: 'حدث خطا اثناء تصدير البيانات. تاكد من صلاحياتك.',
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
                            Excel
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
                      <Button
                        className="w-full btn-navy gap-2"
                        onClick={() => handleExport(report)}
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
                            <Download className="w-4 h-4" />
                            تصدير
                          </>
                        )}
                      </Button>
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
