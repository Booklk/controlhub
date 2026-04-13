import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, invalidateRelatedQueries } from "@/lib/queryClient";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingButton } from "@/components/LoadingButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { itDirectorNavGroups, cybersecurityNavGroups, infrastructureNavGroups, digitalTransformationNavGroups, supportNavGroups, CYBERSECURITY_DEPT_ID, INFRASTRUCTURE_DEPT_ID, DIGITAL_TRANSFORMATION_DEPT_ID, SUPPORT_DEPT_ID } from "@/lib/navigation";
import type { NavGroup } from "@/lib/navigation";
import { 
  BarChart3, TrendingUp, TrendingDown, Target, Plus, ArrowUpRight,
  Pencil, Trash2,
  FileDown, FileSpreadsheet } from "lucide-react";
import { useConfirmDialog, ConfirmDialog } from '@/components/ConfirmDialog';
import { exportToPDF, exportToExcel, formatStatus} from '@/lib/exports';
import { PageHeader, KpiCard } from "@/components/Quality";


// Zod validation schema with Arabic error messages
const kpiValidationSchema = z.object({
  name: z.string()
    .min(3, { message: "اسم المؤشر مطلوب (3 أحرف على الأقل)" })
    .max(100, { message: "اسم المؤشر يجب أن لا يتجاوز 100 حرف" }),
  description: z.string()
    .max(500, { message: "الوصف يجب أن لا يتجاوز 500 حرف" })
    .optional()
    .or(z.literal("")),
  category: z.enum(["operational", "strategic", "financial", "security", "quality"], {
    errorMap: () => ({ message: "يجب اختيار فئة صحيحة" })
  }),
  targetValue: z.string()
    .refine(val => !isNaN(parseFloat(val)), { message: "القيمة المستهدفة يجب أن تكون رقم" })
    .refine(val => parseFloat(val) > 0, { message: "القيمة المستهدفة يجب أن تكون رقم موجب" }),
  currentValue: z.string()
    .refine(val => !isNaN(parseFloat(val)), { message: "القيمة الحالية يجب أن تكون رقم" }),
  unit: z.enum(["percent", "number", "currency", "hours", "days"], {
    errorMap: () => ({ message: "وحدة القياس مطلوبة" })
  }),
  frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "yearly"], {
    errorMap: () => ({ message: "التكرار يجب أن يكون يومي أو أسبوعي أو شهري أو ربع سنوي أو سنوي" })
  }),
  departmentId: z.string()
    .optional()
    .refine(val => !val || !isNaN(parseInt(val)), { message: "معرف الإدارة يجب أن يكون رقم" })
});

type KPIFormData = z.infer<typeof kpiValidationSchema>;

interface KPIMetric {
  id: number;
  metricName: string;
  metricType: string;
  targetValue: string | null;
  actualValue: string | null;
  unit: string | null;
  period: string;
  periodDate: string;
  trend: string | null;
  notes: string | null;
  departmentId?: number;
}

interface KPIPageProps {
  portalName?: string;
  navGroups?: NavGroup[];
  departmentId?: number;
}

export default function KPIsManagement({ portalName = "it_director", navGroups = itDirectorNavGroups, departmentId }: KPIPageProps) {
  const { toast } = useToast();
  const { confirm: confirmAction, dialogProps } = useConfirmDialog();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState("all");
  const [editingItem, setEditingItem] = useState<any>(null);

  const form = useForm<KPIFormData>({
    resolver: zodResolver(kpiValidationSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "operational",
      targetValue: "100",
      currentValue: "0",
      unit: "percent",
      frequency: "monthly",
      departmentId: departmentId ? String(departmentId) : "none",
    },
  });

  const kpiEndpoint = departmentId ? `/api/kpis?departmentId=${departmentId}` : '/api/kpis';
  const { data: kpis = [], isLoading } = useQuery<KPIMetric[]>({
    queryKey: [kpiEndpoint],
  });

  const { data: departments = [] } = useQuery<any[]>({
    queryKey: ["/api/it-departments"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: KPIFormData) => {
      const payload = {
        metricName: data.name,
        metricType: data.category,
        targetValue: data.targetValue,
        actualValue: data.currentValue,
        unit: data.unit,
        period: data.frequency,
        periodDate: new Date().toISOString(),
        notes: data.description,
        departmentId: data.departmentId && data.departmentId !== "none" ? parseInt(data.departmentId) : null,
      };
      return apiRequest("POST", "/api/kpis", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith('/api/kpis') });
      invalidateRelatedQueries('/api/kpis');
      toast({ title: "تم إنشاء المؤشر بنجاح" });
      setIsAddDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في إنشاء المؤشر", variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (data: KPIFormData) => {
      const payload = {
        metricName: data.name,
        metricType: data.category,
        targetValue: data.targetValue,
        actualValue: data.currentValue,
        unit: data.unit,
        period: data.frequency,
        notes: data.description,
        departmentId: data.departmentId && data.departmentId !== "none" ? parseInt(data.departmentId) : null,
      };
      return apiRequest("PUT", `/api/kpis/${editingItem?.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith('/api/kpis') });
      invalidateRelatedQueries('/api/kpis');
      toast({ title: "تم تحديث المؤشر بنجاح" });
      setIsAddDialogOpen(false);
      setEditingItem(null);
      form.reset();
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في تحديث المؤشر", variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/kpis/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith('/api/kpis') });
      invalidateRelatedQueries('/api/kpis');
      toast({ title: "تم حذف المؤشر بنجاح" });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل حذف المؤشر", variant: "destructive" });
    },
  });

  const handleEdit = (kpi: any) => {
    setEditingItem(kpi);
    form.reset({
      name: kpi.metricName || "",
      description: kpi.notes || "",
      category: kpi.metricType || "operational",
      targetValue: kpi.targetValue?.toString() || "100",
      currentValue: kpi.actualValue?.toString() || "0",
      unit: kpi.unit || "percent",
      frequency: kpi.period || "monthly",
      departmentId: kpi.departmentId ? String(kpi.departmentId) : "none",
    });
    setIsAddDialogOpen(true);
  };

  const onSubmit = (data: KPIFormData) => {
    if (editingItem) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const getProgress = (current: string | null, target: string | null) => {
    const currentNum = parseFloat(current || "0");
    const targetNum = parseFloat(target || "0");
    if (targetNum === 0) return 0;
    return Math.min(100, Math.round((currentNum / targetNum) * 100));
  };

  const getStatusColor = (current: string | null, target: string | null) => {
    const progress = getProgress(current, target);
    if (progress >= 90) return "bg-[hsl(43_74%_49%)]";
    if (progress >= 70) return "hub-badge-gold";
    return "bg-[hsl(222_47%_11%)]";
  };

  const getStatusBadge = (current: string | null, target: string | null) => {
    const progress = getProgress(current, target);
    if (progress >= 90) return <Badge className="bg-[hsl(43_74%_49%)] text-muted-foreground">ممتاز</Badge>;
    if (progress >= 70) return <Badge className="hub-badge-gold text-muted-foreground">جيد</Badge>;
    return <Badge className="bg-[hsl(222_47%_11%)]/20 text-muted-foreground">يحتاج تحسين</Badge>;
  };

  const getTrendIcon = (trend: string) => {
    if (trend === "up") return <TrendingUp className="w-4 h-4 hub-stat-gold" />;
    if (trend === "down") return <TrendingDown className="w-4 h-4 text-muted-foreground" />;
    return <ArrowUpRight className="w-4 h-4 text-gray-500" />;
  };

  const categoryLabels: Record<string, string> = {
    operational: "تشغيلي",
    strategic: "استراتيجي",
    financial: "مالي",
    security: "أمني",
    quality: "جودة"
  };

  const filteredKPIs = kpis.filter(kpi => 
    filterCategory === "all" || kpi.metricType === filterCategory
  );

  const stats = {
    total: kpis.length,
    onTarget: kpis.filter(k => getProgress(k.actualValue, k.targetValue) >= 90).length,
    needsAttention: kpis.filter(k => getProgress(k.actualValue, k.targetValue) < 70).length,
    avgProgress: kpis.length > 0 
      ? Math.round(kpis.reduce((acc, k) => acc + getProgress(k.actualValue, k.targetValue), 0) / kpis.length) 
      : 0
  };

  if (isLoading) {
    return (
      <DashboardLayout title="مؤشرات الأداء" portalName={portalName} navGroups={navGroups}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[hsl(43_74%_49%)]" />
        </div>
      </DashboardLayout>
    );
  }


  const handleExportPDF = () => {
    exportToPDF({
      title: 'تقرير مؤشرات الأداء',
      subtitle: 'JCSA - Control Hub',
      columns: [{"header":"المؤشر","key":"name","width":40},{"header":"المستهدف","key":"target","width":20},{"header":"الفعلي","key":"actual","width":20},{"header":"الوحدة","key":"unit","width":20},{"header":"الحالة","key":"status","width":20}],
      data: (kpis || []).map((item: any) => ({ name: item.name || '', target: item.target?.toString() || '', actual: item.actual?.toString() || '', unit: item.unit || '', status: formatStatus(item.status || '') })),
      filename: 'kpis-report',
      orientation: 'landscape',
    });
  };

  const handleExportExcel = () => {
    exportToExcel({
      title: 'تقرير مؤشرات الأداء',
      columns: [{"header":"المؤشر","key":"name","width":40},{"header":"المستهدف","key":"target","width":20},{"header":"الفعلي","key":"actual","width":20},{"header":"الوحدة","key":"unit","width":20},{"header":"الحالة","key":"status","width":20}],
      data: (kpis || []).map((item: any) => ({ name: item.name || '', target: item.target?.toString() || '', actual: item.actual?.toString() || '', unit: item.unit || '', status: formatStatus(item.status || '') })),
      filename: 'kpis-report',
    });
  };

  return (
    <DashboardLayout 
      title="مؤشرات الأداء الرئيسية" 
      portalName={portalName}
      navGroups={navGroups}
    >
      <div className="p-6 space-y-5">
        <PageHeader
          icon={BarChart3}
          title="مؤشرات الأداء الرئيسية"
          subtitle="متابعة وقياس أداء الإدارات التقنية"
          actions={
            <>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportPDF} data-testid="button-export-pdf"><FileDown className="w-3.5 h-3.5" />PDF</Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportExcel} data-testid="button-export-excel"><FileSpreadsheet className="w-3.5 h-3.5" />Excel</Button>
              <Button className="btn-gold h-9 gap-1.5 text-xs" onClick={() => { setEditingItem(null); form.reset(); setIsAddDialogOpen(true); }} data-testid="button-add-kpi"><Plus className="w-3.5 h-3.5" />إضافة مؤشر جديد</Button>
            </>
          }
        />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KpiCard label="إجمالي المؤشرات" value={stats.total} icon={BarChart3} color="navy" />
          <KpiCard label="على المسار" value={stats.onTarget} icon={Target} color="success" />
          <KpiCard label="يحتاج انتباه" value={stats.needsAttention} icon={TrendingDown} color="danger" />
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={(open) => { setIsAddDialogOpen(open); if (!open) { setEditingItem(null); form.reset(); } }}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
              <DialogHeader>
                <DialogTitle>{editingItem ? "تعديل مؤشر الأداء" : "إضافة مؤشر أداء جديد"}</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>اسم المؤشر *</FormLabel>
                        <FormControl>
                          <Input 
                            {...field}
                            placeholder="نسبة إنجاز المشاريع"
                            data-testid="input-kpi-name"
                          />
                        </FormControl>
                        <FormMessage data-testid="error-kpi-name" />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>نوع المؤشر *</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger data-testid="select-kpi-type">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="operational">تشغيلي</SelectItem>
                              <SelectItem value="strategic">استراتيجي</SelectItem>
                              <SelectItem value="financial">مالي</SelectItem>
                              <SelectItem value="security">أمني</SelectItem>
                              <SelectItem value="quality">جودة</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage data-testid="error-kpi-category" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="unit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>وحدة القياس *</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger data-testid="select-kpi-unit">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="percent">نسبة مئوية %</SelectItem>
                              <SelectItem value="number">عدد</SelectItem>
                              <SelectItem value="currency">ريال</SelectItem>
                              <SelectItem value="hours">ساعات</SelectItem>
                              <SelectItem value="days">أيام</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage data-testid="error-kpi-unit" />
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
                          <FormLabel>القيمة المستهدفة *</FormLabel>
                          <FormControl>
                            <Input 
                              {...field}
                              type="number"
                              step="0.01"
                              placeholder="100"
                              data-testid="input-kpi-target"
                            />
                          </FormControl>
                          <FormMessage data-testid="error-kpi-target" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="currentValue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>القيمة الحالية *</FormLabel>
                          <FormControl>
                            <Input 
                              {...field}
                              type="number"
                              step="0.01"
                              placeholder="0"
                              data-testid="input-kpi-current"
                            />
                          </FormControl>
                          <FormMessage data-testid="error-kpi-current" />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="frequency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>التكرار *</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid="select-kpi-frequency">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="daily">يومي</SelectItem>
                            <SelectItem value="weekly">أسبوعي</SelectItem>
                            <SelectItem value="monthly">شهري</SelectItem>
                            <SelectItem value="quarterly">ربع سنوي</SelectItem>
                            <SelectItem value="yearly">سنوي</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage data-testid="error-kpi-frequency" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>الوصف</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field}
                            placeholder="ملاحظات إضافية..."
                            data-testid="input-kpi-description"
                          />
                        </FormControl>
                        <FormMessage data-testid="error-kpi-description" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="departmentId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>الإدارة</FormLabel>
                        <Select value={field.value || undefined} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid="select-kpi-department">
                              <SelectValue placeholder="اختر إدارة" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">بدون إدارة</SelectItem>
                            {departments.map((dept) => (
                              <SelectItem key={dept.id} value={String(dept.id)}>
                                {dept.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage data-testid="error-kpi-department" />
                      </FormItem>
                    )}
                  />

                  <LoadingButton
                    type="submit"
                    className="w-full btn-gold"
                    loading={createMutation.isPending || updateMutation.isPending}
                    loadingText="جاري الحفظ..."
                    data-testid="button-save-kpi"
                  >
                    {editingItem ? "تحديث المؤشر" : "حفظ المؤشر"}
                  </LoadingButton>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="card-premium">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">إجمالي المؤشرات</p>
                  <p className="text-2xl font-bold hub-stat-gold">{stats.total}</p>
                </div>
                <Target className="w-8 h-8 hub-stat-gold" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="card-premium">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">على المسار</p>
                  <p className="text-2xl font-bold hub-stat-gold">{stats.onTarget}</p>
                </div>
                <TrendingUp className="w-8 h-8 hub-stat-gold" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="card-premium">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">يحتاج انتباه</p>
                  <p className="text-2xl font-bold text-muted-foreground">{stats.needsAttention}</p>
                </div>
                <TrendingDown className="w-8 h-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="card-premium">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">متوسط الإنجاز</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.avgProgress}%</p>
                </div>
                <BarChart3 className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-48" data-testid="select-filter-category">
              <SelectValue placeholder="تصفية حسب الفئة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الفئات</SelectItem>
              <SelectItem value="operational">تشغيلي</SelectItem>
              <SelectItem value="strategic">استراتيجي</SelectItem>
              <SelectItem value="financial">مالي</SelectItem>
              <SelectItem value="security">أمني</SelectItem>
              <SelectItem value="quality">جودة</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredKPIs.map((kpi) => (
            <Card key={kpi.id} className="card-premium hover-elevate" data-testid={`card-kpi-${kpi.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{kpi.metricName}</CardTitle>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleEdit(kpi)}
                      data-testid={`button-edit-kpi-${kpi.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => confirmAction(
                        () => deleteMutation.mutate(kpi.id),
                        { title: "حذف المؤشر", description: `هل أنت متأكد من حذف المؤشر "${kpi.metricName}"؟` }
                      )}
                      data-testid={`button-delete-kpi-${kpi.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                    {getTrendIcon(kpi.trend || "stable")}
                  </div>
                </div>
                <Badge variant="outline" className="w-fit">
                  {categoryLabels[kpi.metricType] || kpi.metricType}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">الحالي</span>
                    <span className="font-bold">{kpi.actualValue || 0} {kpi.unit === "percent" ? "%" : ""}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">المستهدف</span>
                    <span className="font-bold">{kpi.targetValue || 0} {kpi.unit === "percent" ? "%" : ""}</span>
                  </div>
                  <Progress 
                    value={getProgress(kpi.actualValue, kpi.targetValue)} 
                    className="h-2"
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">
                      {getProgress(kpi.actualValue, kpi.targetValue)}% مكتمل
                    </span>
                    {getStatusBadge(kpi.actualValue, kpi.targetValue)}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredKPIs.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>لا توجد مؤشرات أداء حالياً</p>
            <p className="text-sm mt-2">اضغط على "إضافة مؤشر جديد" للبدء</p>
          </div>
        )}

        <ConfirmDialog {...dialogProps} />
      </div>
    </DashboardLayout>
  );
}
