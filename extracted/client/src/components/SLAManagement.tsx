import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader, KpiCard } from "@/components/Quality";
import type { NavGroup } from "@/lib/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  Plus,
  Target,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
  Calendar,
  Building2,
  Activity,
  Eye,
  Edit2,
  Trash2,
  RefreshCw,
  FileDown,
} from "lucide-react";
import { exportToPDF, exportToExcel } from "@/lib/exports";

const slaCreationSchema = z.object({
  title: z.string()
    .min(1, "عنوان الاتفاقية مطلوب")
    .min(3, "عنوان الاتفاقية مطلوب (3 أحرف على الأقل)"),
  vendorId: z.number()
    .int("يجب اختيار المورد")
    .positive("يجب اختيار المورد"),
  serviceType: z.string()
    .min(1, "نوع الخدمة مطلوب"),
  targetValue: z.string()
    .min(1, "القيمة المستهدفة يجب أن تكون رقم موجب")
    .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
      message: "القيمة المستهدفة يجب أن تكون رقم موجب"
    }),
  targetUnit: z.string()
    .min(1, "وحدة القياس مطلوبة"),
  projectId: z.number()
    .int("معرف المشروع يجب أن يكون رقم صحيح")
    .nonnegative("معرف المشروع يجب أن يكون موجب أو صفر")
    .optional()
    .refine((val) => !val || val > 0, {
      message: "معرف المشروع يجب أن يكون موجب"
    }),
  measurementPeriod: z.string()
    .min(1, "فترة القياس مطلوبة")
    .refine((val) => ["daily", "weekly", "monthly", "quarterly"].includes(val), {
      message: "فترة القياس يجب أن تكون يومي أو أسبوعي أو شهري أو ربع سنوي"
    }),
  description: z.string().optional(),
  penaltyClause: z.string().optional(),
  penaltyAmount: z.string()
    .optional()
    .refine((val) => !val || val.trim() === '' || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0), {
      message: 'مبلغ الجزاء يجب أن يكون رقمًا موجبًا'
    }),
});

type SLACreationFormData = z.infer<typeof slaCreationSchema>;

interface SLAManagementProps {
  departmentId: number;
  departmentName: string;
  navGroups: NavGroup[];
  basePath: string;
}

interface SLAAgreement {
  id: number;
  vendorId: number;
  systemId?: number;
  projectId?: number;
  title: string;
  description?: string;
  serviceType: string;
  targetValue: string;
  targetUnit: string;
  currentValue?: string;
  measurementPeriod?: string;
  penaltyClause?: string;
  penaltyAmount?: string;
  startDate?: string;
  endDate?: string;
  status: string;
  lastMeasured?: string;
  complianceStatus?: string;
  createdAt: string;
  updatedAt: string;
}

interface ITProject {
  id: number;
  nameAr: string;
  nameEn?: string;
  code: string;
  status: string;
}

interface SLABreach {
  id: number;
  slaId: number;
  vendorId: number;
  breachDate: string;
  expectedValue?: string;
  actualValue?: string;
  impactLevel: string;
  description?: string;
  rootCause?: string;
  resolution?: string;
  penaltyApplied: boolean;
  penaltyAmount?: string;
  status: string;
  resolvedAt?: string;
  createdAt: string;
}

const serviceTypeLabels: Record<string, string> = {
  uptime: 'وقت التشغيل',
  response_time: 'وقت الاستجابة',
  resolution_time: 'وقت الحل',
  support: 'الدعم الفني',
  availability: 'التوفر',
  performance: 'الأداء',
};

const statusLabels: Record<string, string> = {
  active: 'نشط',
  expired: 'منتهي',
  breached: 'مخالف',
  pending: 'معلق',
};

const complianceLabels: Record<string, string> = {
  compliant: 'ملتزم',
  warning: 'تحذير',
  breached: 'مخالف',
};

const impactLabels: Record<string, string> = {
  low: 'منخفض',
  medium: 'متوسط',
  high: 'عالي',
  critical: 'حرج',
};

const breachStatusLabels: Record<string, string> = {
  open: 'مفتوح',
  investigating: 'قيد التحقيق',
  resolved: 'تم الحل',
  closed: 'مغلق',
};

export default function SLAManagement({ departmentId, departmentName, navGroups, basePath }: SLAManagementProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("agreements");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [selectedSLA, setSelectedSLA] = useState<SLAAgreement | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const form = useForm<SLACreationFormData>({
    resolver: zodResolver(slaCreationSchema),
    defaultValues: {
      title: '',
      description: '',
      serviceType: 'uptime',
      targetValue: '',
      targetUnit: 'percent',
      measurementPeriod: 'monthly',
      vendorId: undefined as unknown as number,
      projectId: 0,
      penaltyClause: '',
      penaltyAmount: '',
    },
  });

  const { data: slaAgreements = [], isLoading: loadingAgreements } = useQuery<SLAAgreement[]>({
    queryKey: ['/api/sla-agreements', departmentId],
  });

  const { data: slaBreaches = [], isLoading: loadingBreaches } = useQuery<SLABreach[]>({
    queryKey: ['/api/sla-breaches', departmentId],
  });

  const { data: vendors = [] } = useQuery<any[]>({
    queryKey: ['/api/vendors', departmentId],
  });

  const { data: projects = [] } = useQuery<ITProject[]>({
    queryKey: ['/api/it-projects'],
  });

  const createSLAMutation = useMutation({
    mutationFn: async (data: SLACreationFormData) => {
      const payloadData = {
        ...data,
        departmentId,
        projectId: data.projectId && data.projectId > 0 ? data.projectId : undefined,
      };
      return apiRequest('POST', '/api/sla-agreements', payloadData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sla-agreements', departmentId] });
      setShowCreateDialog(false);
      form.reset();
      toast({
        title: "تم بنجاح",
        description: "تم إنشاء اتفاقية مستوى الخدمة",
      });
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "فشل في إنشاء الاتفاقية",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SLACreationFormData) => {
    createSLAMutation.mutate(data);
  };

  const handleCreateDialogOpen = (open: boolean) => {
    if (!open) {
      form.reset();
    }
    setShowCreateDialog(open);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['/api/sla-agreements', departmentId] });
    await queryClient.invalidateQueries({ queryKey: ['/api/sla-breaches', departmentId] });
    setIsRefreshing(false);
    toast({
      title: "تم التحديث",
      description: "تم تحديث البيانات بنجاح",
    });
  };

  const handleExportPDF = () => {
    exportToPDF({
      title: `اتفاقيات مستوى الخدمة - ${departmentName}`,
      subtitle: 'تقرير شامل لجميع اتفاقيات SLA',
      columns: [
        { header: 'العنوان', key: 'title', width: 60 },
        { header: 'نوع الخدمة', key: 'serviceType', width: 35 },
        { header: 'القيمة المستهدفة', key: 'targetValue', width: 30 },
        { header: 'القيمة الحالية', key: 'currentValue', width: 30 },
        { header: 'الحالة', key: 'status', width: 25 },
        { header: 'الالتزام', key: 'complianceStatus', width: 25 },
      ],
      data: slaAgreements.map(sla => ({
        ...sla,
        serviceType: serviceTypeLabels[sla.serviceType] || sla.serviceType,
        status: statusLabels[sla.status] || sla.status,
        complianceStatus: complianceLabels[sla.complianceStatus || 'compliant'] || sla.complianceStatus,
        targetValue: `${sla.targetValue} ${sla.targetUnit === 'percent' ? '%' : sla.targetUnit}`,
        currentValue: sla.currentValue ? `${sla.currentValue} ${sla.targetUnit === 'percent' ? '%' : sla.targetUnit}` : '-',
      })),
      filename: `sla-agreements-${departmentName}`,
      orientation: 'landscape',
    });
  };

  const handleExportExcel = () => {
    exportToExcel({
      title: `اتفاقيات مستوى الخدمة - ${departmentName}`,
      columns: [
        { header: 'العنوان', key: 'title' },
        { header: 'نوع الخدمة', key: 'serviceType' },
        { header: 'القيمة المستهدفة', key: 'targetValue' },
        { header: 'القيمة الحالية', key: 'currentValue' },
        { header: 'الحالة', key: 'status' },
        { header: 'الالتزام', key: 'complianceStatus' },
        { header: 'تاريخ البداية', key: 'startDate' },
        { header: 'تاريخ النهاية', key: 'endDate' },
      ],
      data: slaAgreements.map(sla => ({
        ...sla,
        serviceType: serviceTypeLabels[sla.serviceType] || sla.serviceType,
        status: statusLabels[sla.status] || sla.status,
        complianceStatus: complianceLabels[sla.complianceStatus || 'compliant'] || sla.complianceStatus,
        targetValue: `${sla.targetValue} ${sla.targetUnit === 'percent' ? '%' : sla.targetUnit}`,
        currentValue: sla.currentValue ? `${sla.currentValue}` : '-',
        startDate: sla.startDate ? new Date(sla.startDate).toLocaleDateString('ar-SA') : '-',
        endDate: sla.endDate ? new Date(sla.endDate).toLocaleDateString('ar-SA') : '-',
      })),
      filename: `sla-agreements-${departmentName}`,
    });
  };

  const getComplianceColor = (status?: string) => {
    switch (status) {
      case 'compliant': return 'hub-badge-gold border-gold/30';
      case 'warning': return 'hub-badge-navy border-navy/20';
      case 'breached': return 'hub-card text-white border-navy';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getImpactColor = (level: string) => {
    switch (level) {
      case 'critical': return 'hub-card text-white';
      case 'high': return 'hub-card/80 text-white';
      case 'medium': return 'hub-badge-gold';
      case 'low': return 'hub-badge-gold';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const stats = {
    total: slaAgreements.length,
    active: slaAgreements.filter(s => s.status === 'active').length,
    compliant: slaAgreements.filter(s => s.complianceStatus === 'compliant').length,
    breached: slaAgreements.filter(s => s.complianceStatus === 'breached').length,
    warning: slaAgreements.filter(s => s.complianceStatus === 'warning').length,
    openBreaches: slaBreaches.filter(b => b.status === 'open' || b.status === 'investigating').length,
  };

  const complianceRate = stats.total > 0 ? Math.round((stats.compliant / stats.total) * 100) : 0;

  return (
    <DashboardLayout
      title={`إدارة اتفاقيات مستوى الخدمة - ${departmentName}`}
      subtitle="متابعة ومراقبة اتفاقيات SLA مع الموردين"
      navGroups={navGroups}
      portalName={departmentName}
    >
      <div className="space-y-5">
        <PageHeader
          icon={FileText}
          title="إدارة اتفاقيات مستوى الخدمة"
          subtitle="تتبع ومراقبة الاتفاقيات وضمان الالتزام بالمستويات المحددة"
          actions={
            <>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportPDF} data-testid="button-export-pdf"><FileDown className="w-3.5 h-3.5" />PDF</Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportExcel} data-testid="button-export-excel"><FileDown className="w-3.5 h-3.5" />Excel</Button>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={handleRefresh} data-testid="button-refresh-sla"><RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} /></Button>
              <Button className="btn-gold h-9 gap-1.5 text-xs" onClick={() => handleCreateDialogOpen(true)} data-testid="button-create-sla"><Plus className="w-3.5 h-3.5" />اتفاقية جديدة</Button>
            </>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="إجمالي الاتفاقيات" value={stats.total} icon={FileText} color="navy" />
          <KpiCard label="نسبة الالتزام" value={`${complianceRate}%`} icon={Target} color={complianceRate >= 90 ? "success" : complianceRate >= 70 ? "gold" : "danger"} />
          <KpiCard label="تحذيرات" value={stats.warning} icon={AlertTriangle} color={stats.warning > 0 ? "gold" : "muted"} />
          <KpiCard label="مخالفات مفتوحة" value={stats.openBreaches} icon={Activity} color={stats.openBreaches > 0 ? "danger" : "muted"} />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="agreements" data-testid="tab-agreements">الاتفاقيات</TabsTrigger>
            <TabsTrigger value="breaches" data-testid="tab-breaches">المخالفات</TabsTrigger>
          </TabsList>

          <TabsContent value="agreements" className="mt-4">
            {loadingAgreements ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-24 w-full rounded-lg" />
                ))}
              </div>
            ) : slaAgreements.length === 0 ? (
              <Card className="border-dashed border-gold/30">
                <CardContent className="p-8 text-center">
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">لا توجد اتفاقيات مستوى خدمة</p>
                  <Button onClick={() => handleCreateDialogOpen(true)} className="mt-4 gap-2" data-testid="button-add-sla-empty">
                    <Plus className="w-4 h-4" />
                    إضافة اتفاقية
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {slaAgreements.map(sla => (
                  <Card 
                    key={sla.id} 
                    className="border-gold/20 hover-elevate cursor-pointer"
                    onClick={() => {
                      setSelectedSLA(sla);
                      setShowDetailsDialog(true);
                    }}
                    data-testid={`card-sla-${sla.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-foreground">{sla.title}</h3>
                            <Badge className={getComplianceColor(sla.complianceStatus)}>
                              {complianceLabels[sla.complianceStatus || 'compliant']}
                            </Badge>
                            <Badge variant="outline" className="border-gold/30">
                              {serviceTypeLabels[sla.serviceType] || sla.serviceType}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-1">{sla.description}</p>
                          <div className="flex items-center gap-4 mt-3 text-sm">
                            <div className="flex items-center gap-1">
                              <Target className="w-4 h-4 hub-stat-gold" />
                              <span>الهدف: {sla.targetValue}{sla.targetUnit === 'percent' ? '%' : ` ${sla.targetUnit}`}</span>
                            </div>
                            {sla.currentValue && (
                              <div className="flex items-center gap-1">
                                <Activity className="w-4 h-4 text-muted-foreground" />
                                <span>الحالي: {sla.currentValue}{sla.targetUnit === 'percent' ? '%' : ` ${sla.targetUnit}`}</span>
                              </div>
                            )}
                            {sla.lastMeasured && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Clock className="w-4 h-4" />
                                <span>آخر قياس: {new Date(sla.lastMeasured).toLocaleDateString('ar-SA')}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="icon" data-testid={`button-view-sla-${sla.id}`}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      {sla.currentValue && sla.targetValue && (
                        <div className="mt-3">
                          <Progress 
                            value={Math.min(100, (parseFloat(sla.currentValue) / parseFloat(sla.targetValue)) * 100)} 
                            className="h-2"
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="breaches" className="mt-4">
            {loadingBreaches ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-20 w-full rounded-lg" />
                ))}
              </div>
            ) : slaBreaches.length === 0 ? (
              <Card className="border-dashed border-gold/30">
                <CardContent className="p-8 text-center">
                  <CheckCircle2 className="w-12 h-12 mx-auto hub-stat-gold mb-4" />
                  <p className="text-muted-foreground">لا توجد مخالفات مسجلة</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {slaBreaches.map(breach => (
                  <Card 
                    key={breach.id} 
                    className="border-foreground/20"
                    data-testid={`card-breach-${breach.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="w-5 h-5 text-foreground" />
                            <h3 className="font-semibold text-foreground">مخالفة #{breach.id}</h3>
                            <Badge className={getImpactColor(breach.impactLevel)}>
                              {impactLabels[breach.impactLevel]}
                            </Badge>
                            <Badge variant="outline" className="border-foreground/30">
                              {breachStatusLabels[breach.status]}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{breach.description}</p>
                          <div className="flex items-center gap-4 mt-3 text-sm">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4 text-muted-foreground" />
                              <span>تاريخ المخالفة: {new Date(breach.breachDate).toLocaleDateString('ar-SA')}</span>
                            </div>
                            {breach.expectedValue && breach.actualValue && (
                              <div className="flex items-center gap-1">
                                <TrendingDown className="w-4 h-4 text-foreground" />
                                <span>المتوقع: {breach.expectedValue} | الفعلي: {breach.actualValue}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={showCreateDialog} onOpenChange={handleCreateDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle>إضافة اتفاقية مستوى خدمة جديدة</DialogTitle>
              <DialogDescription>أدخل تفاصيل الاتفاقية مع المورد</DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-right block">عنوان الاتفاقية</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="مثال: اتفاقية وقت تشغيل السيرفرات"
                          className="text-right"
                          data-testid="input-sla-title"
                        />
                      </FormControl>
                      <FormMessage className="text-right" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-right block">الوصف</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="وصف تفصيلي للاتفاقية"
                          className="text-right"
                          data-testid="input-sla-description"
                        />
                      </FormControl>
                      <FormMessage className="text-right" />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="serviceType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-right block">نوع الخدمة</FormLabel>
                        <FormControl>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger data-testid="select-service-type">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="uptime">وقت التشغيل</SelectItem>
                              <SelectItem value="response_time">وقت الاستجابة</SelectItem>
                              <SelectItem value="resolution_time">وقت الحل</SelectItem>
                              <SelectItem value="support">الدعم الفني</SelectItem>
                              <SelectItem value="availability">التوفر</SelectItem>
                              <SelectItem value="performance">الأداء</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage className="text-right" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="measurementPeriod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-right block">فترة القياس</FormLabel>
                        <FormControl>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger data-testid="select-measurement-period">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="daily">يومي</SelectItem>
                              <SelectItem value="weekly">أسبوعي</SelectItem>
                              <SelectItem value="monthly">شهري</SelectItem>
                              <SelectItem value="quarterly">ربع سنوي</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage className="text-right" />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="targetValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-right block">القيمة المستهدفة</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            step="0.1"
                            placeholder="99.9"
                            className="text-right"
                            data-testid="input-target-value"
                          />
                        </FormControl>
                        <FormMessage className="text-right" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="targetUnit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-right block">وحدة القياس</FormLabel>
                        <FormControl>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger data-testid="select-target-unit">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="percent">نسبة مئوية %</SelectItem>
                              <SelectItem value="hours">ساعات</SelectItem>
                              <SelectItem value="minutes">دقائق</SelectItem>
                              <SelectItem value="days">أيام</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage className="text-right" />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="vendorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-right block">المورد</FormLabel>
                      <FormControl>
                        <Select 
                          value={field.value ? field.value.toString() : ""}
                          onValueChange={(value) => field.onChange(parseInt(value))}
                        >
                          <SelectTrigger data-testid="select-vendor">
                            <SelectValue placeholder="اختر المورد" />
                          </SelectTrigger>
                          <SelectContent>
                            {vendors.map((vendor: any) => (
                              <SelectItem key={vendor.id} value={vendor.id.toString()}>
                                {vendor.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage className="text-right" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="projectId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-right block">ربط بمشروع (اختياري)</FormLabel>
                      <FormControl>
                        <Select 
                          value={field.value ? field.value.toString() : "0"}
                          onValueChange={(value) => field.onChange(parseInt(value))}
                        >
                          <SelectTrigger data-testid="select-project">
                            <SelectValue placeholder="اختر المشروع" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">بدون مشروع</SelectItem>
                            {projects.map((project: ITProject) => (
                              <SelectItem key={project.id} value={project.id.toString()}>
                                {project.code} - {project.nameAr || project.nameEn}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage className="text-right" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="penaltyClause"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-right block">بند الجزاء (اختياري)</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="وصف شروط الجزاء في حالة المخالفة"
                          className="text-right"
                          data-testid="input-penalty-clause"
                        />
                      </FormControl>
                      <FormMessage className="text-right" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="penaltyAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-right block">مبلغ الجزاء (اختياري)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="بالريال"
                          className="text-right"
                          data-testid="input-penalty-amount"
                        />
                      </FormControl>
                      <FormMessage className="text-right" />
                    </FormItem>
                  )}
                />

                <DialogFooter className="gap-2 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => handleCreateDialogOpen(false)}
                    type="button"
                    data-testid="button-cancel-sla"
                  >
                    إلغاء
                  </Button>
                  <Button 
                    type="submit"
                    disabled={createSLAMutation.isPending}
                    data-testid="button-submit-sla"
                  >
                    {createSLAMutation.isPending ? 'جاري الإنشاء...' : 'إنشاء الاتفاقية'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle>{selectedSLA?.title}</DialogTitle>
              <DialogDescription>تفاصيل اتفاقية مستوى الخدمة</DialogDescription>
            </DialogHeader>
            {selectedSLA && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted/30">
                    <p className="text-sm text-muted-foreground mb-1">نوع الخدمة</p>
                    <p className="font-medium">{serviceTypeLabels[selectedSLA.serviceType]}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30">
                    <p className="text-sm text-muted-foreground mb-1">حالة الالتزام</p>
                    <Badge className={getComplianceColor(selectedSLA.complianceStatus)}>
                      {complianceLabels[selectedSLA.complianceStatus || 'compliant']}
                    </Badge>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted/30">
                    <p className="text-sm text-muted-foreground mb-1">القيمة المستهدفة</p>
                    <p className="font-medium text-lg hub-stat-gold">
                      {selectedSLA.targetValue}{selectedSLA.targetUnit === 'percent' ? '%' : ` ${selectedSLA.targetUnit}`}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30">
                    <p className="text-sm text-muted-foreground mb-1">القيمة الحالية</p>
                    <p className="font-medium text-lg">
                      {selectedSLA.currentValue 
                        ? `${selectedSLA.currentValue}${selectedSLA.targetUnit === 'percent' ? '%' : ` ${selectedSLA.targetUnit}`}`
                        : 'لم يتم القياس بعد'}
                    </p>
                  </div>
                </div>
                {selectedSLA.description && (
                  <div className="p-4 rounded-lg bg-muted/30">
                    <p className="text-sm text-muted-foreground mb-1">الوصف</p>
                    <p>{selectedSLA.description}</p>
                  </div>
                )}
                {selectedSLA.penaltyClause && (
                  <div className="p-4 rounded-lg bg-muted/30 border border-foreground/10">
                    <p className="text-sm text-muted-foreground mb-1">بند الجزاء</p>
                    <p>{selectedSLA.penaltyClause}</p>
                    {selectedSLA.penaltyAmount && (
                      <p className="mt-2 font-medium">مبلغ الجزاء: {selectedSLA.penaltyAmount} ريال</p>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span>تاريخ البداية: {selectedSLA.startDate ? new Date(selectedSLA.startDate).toLocaleDateString('ar-SA') : 'غير محدد'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span>تاريخ النهاية: {selectedSLA.endDate ? new Date(selectedSLA.endDate).toLocaleDateString('ar-SA') : 'غير محدد'}</span>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
                إغلاق
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
