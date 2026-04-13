import { useState } from 'react';
import { useConfirmDialog, ConfirmDialog } from '@/components/ConfirmDialog';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { queryClient, apiRequest, invalidateRelatedQueries } from '@/lib/queryClient';
import DashboardLayout from '@/components/DashboardLayout';
import { itDirectorNavGroups } from '@/lib/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LoadingButton } from "@/components/LoadingButton";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import {
  LayoutDashboard, FolderKanban, Ticket, BarChart3, Users, AlertTriangle,
  Plus, Search, Calendar, Clock, CheckCircle, Circle, ArrowRight, FileDown, 
  FileSpreadsheet, RefreshCw
} from 'lucide-react';
import { exportToPDF, exportToExcel, formatStatus, formatPriority } from '@/lib/exports';
import { SmartFormAssistant, ParsedFormData } from "@/components/SmartFormAssistant";
import { FormSuccessPanel, FieldHint } from "@/components/ui/form-guide";
import { PageHeader, KpiCard } from "@/components/Quality";

// ==================== Zod Validation Schemas ====================
const projectValidationSchema = z.object({
  nameAr: z.string()
    .min(3, { message: 'اسم المشروع بالعربي مطلوب (3 أحرف على الأقل)' })
    .max(200, { message: 'اسم المشروع يجب أن يكون 200 حرف على الأكثر' }),
  code: z.string()
    .min(1, { message: 'رمز المشروع مطلوب' })
    .regex(/^[A-Z0-9-]+$/, { message: 'رمز المشروع غير صحيح' })
    .max(20, { message: 'رمز المشروع يجب أن يكون 20 حرف على الأكثر' }),
  description: z.string()
    .max(500, { message: 'الوصف يجب أن يكون 500 حرف على الأكثر' })
    .optional()
    .or(z.literal('')),
  startDate: z.string()
    .optional()
    .or(z.literal(''))
    .refine((date) => !date || !isNaN(new Date(date).getTime()), {
      message: 'تاريخ البداية غير صحيح'
    }),
  endDate: z.string()
    .optional()
    .or(z.literal(''))
    .refine((date) => !date || !isNaN(new Date(date).getTime()), {
      message: 'تاريخ الانتهاء غير صحيح'
    }),
  budget: z.string()
    .optional()
    .or(z.literal(''))
    .refine((val) => !val || !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
      message: 'الميزانية يجب أن تكون رقم موجب'
    }),
  priority: z.enum(['low', 'medium', 'high', 'critical'], {
    errorMap: () => ({ message: 'الأولوية مطلوبة' })
  }),
  status: z.enum(['planning', 'development', 'testing', 'deployment', 'maintenance', 'completed', 'on_hold'], {
    errorMap: () => ({ message: 'الحالة مطلوبة' })
  }),
}).refine((data) => {
  if (data.startDate && data.endDate) {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    return end > start;
  }
  return true;
}, {
  message: 'تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية',
  path: ['endDate']
});

type ProjectFormData = z.infer<typeof projectValidationSchema>;


interface Project {
  id: number;
  code: string;
  nameAr: string;
  nameEn: string | null;
  description: string | null;
  status: string;
  priority: string;
  progress: number;
  startDate: string | null;
  endDate: string | null;
  itDepartmentId: number | null;
  createdAt: string;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  planning: { label: 'تخطيط', color: 'bg-[hsl(222_47%_11%)]/10 text-muted-foreground' },
  development: { label: 'تطوير', color: 'bg-[hsl(43_74%_49%)]/20 hub-stat-gold' },
  testing: { label: 'اختبار', color: 'bg-[hsl(43_74%_49%)]/30 hub-stat-gold' },
  deployment: { label: 'نشر', color: 'hub-badge-gold' },
  maintenance: { label: 'صيانة', color: 'bg-[hsl(222_47%_11%)]/20 text-muted-foreground' },
  completed: { label: 'مكتمل', color: 'bg-emerald-500/10 text-emerald-700' },
  on_hold: { label: 'متوقف', color: 'bg-red-500/10 text-red-700' },
};

const priorityLabels: Record<string, { label: string; color: string }> = {
  low: { label: 'منخفض', color: 'border-[hsl(222_47%_11%)]/20' },
  medium: { label: 'متوسط', color: 'border-[hsl(43_74%_49%)]/50' },
  high: { label: 'عالي', color: 'border-[hsl(43_74%_49%)]' },
  critical: { label: 'حرج', color: 'border-[hsl(222_47%_11%)]' },
};

export default function ProjectsManagement() {
  const { toast } = useToast();
  const { confirm: confirmAction, dialogProps } = useConfirmDialog();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [successProject, setSuccessProject] = useState<{ id: number; nameAr: string; code: string } | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const updateProjectMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Project> }) => {
      const response = await apiRequest('PUT', `/api/projects/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      invalidateRelatedQueries('/api/projects');
      setIsEditDialogOpen(false);
      setSelectedProject(null);
      toast({ title: 'تم تحديث المشروع بنجاح' });
    },
    onError: (error: any) => {
      toast({ title: error.message || 'حدث خطأ في تحديث المشروع', variant: 'destructive' });
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      invalidateRelatedQueries('/api/projects');
      setSelectedProject(null);
      toast({ title: 'تم حذف المشروع بنجاح' });
    },
    onError: (error: any) => {
      toast({ title: error.message || 'حدث خطأ في حذف المشروع', variant: 'destructive' });
    },
  });

  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectValidationSchema),
    defaultValues: {
      nameAr: '',
      code: '',
      description: '',
      priority: 'medium',
      status: 'planning',
      startDate: '',
      endDate: '',
      budget: '',
    },
    mode: 'onChange',
  });

  const { data: projects = [], isLoading, refetch } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 500);
    toast({ title: 'تم تحديث البيانات' });
  };

  const handleExportPDF = () => {
    exportToPDF({
      title: 'تقرير المشاريع',
      subtitle: 'JCSA - Control Hub',
      columns: [
        { header: 'كود المشروع', key: 'code', width: 30 },
        { header: 'الحالة', key: 'statusLabel', width: 25 },
        { header: 'الأولوية', key: 'priorityLabel', width: 25 },
        { header: 'نسبة الإنجاز', key: 'progressLabel', width: 25 },
        { header: 'التاريخ', key: 'dateFormatted', width: 30 },
      ],
      data: filteredProjects.map(p => ({
        ...p,
        statusLabel: formatStatus(p.status),
        priorityLabel: formatPriority(p.priority),
        progressLabel: `${p.progress}%`,
        dateFormatted: p.startDate ? new Date(p.startDate).toLocaleDateString('ar-SA') : '-',
      })),
      filename: `projects-report-${new Date().toISOString().split('T')[0]}`,
      orientation: 'landscape',
    });
    toast({ title: 'تم تصدير التقرير بصيغة PDF' });
  };

  const handleExportExcel = () => {
    exportToExcel({
      title: 'تقرير المشاريع',
      columns: [
        { header: 'كود المشروع', key: 'code' },
        { header: 'الحالة', key: 'statusLabel' },
        { header: 'الأولوية', key: 'priorityLabel' },
        { header: 'نسبة الإنجاز', key: 'progressLabel' },
        { header: 'تاريخ البداية', key: 'startDateFormatted' },
        { header: 'تاريخ الانتهاء', key: 'endDateFormatted' },
      ],
      data: filteredProjects.map(p => ({
        ...p,
        statusLabel: formatStatus(p.status),
        priorityLabel: formatPriority(p.priority),
        progressLabel: `${p.progress}%`,
        startDateFormatted: p.startDate ? new Date(p.startDate).toLocaleDateString('ar-SA') : '-',
        endDateFormatted: p.endDate ? new Date(p.endDate).toLocaleDateString('ar-SA') : '-',
      })),
      filename: `projects-report-${new Date().toISOString().split('T')[0]}`,
    });
    toast({ title: 'تم تصدير التقرير بصيغة Excel' });
  };

  const createProjectMutation = useMutation({
    mutationFn: async (projectData: ProjectFormData) => {
      const response = await apiRequest('POST', '/api/projects', {
          nameAr: projectData.nameAr,
          code: projectData.code,
          description: projectData.description,
          priority: projectData.priority,
          status: projectData.status,
          startDate: projectData.startDate || null,
          endDate: projectData.endDate || null,
          budget: projectData.budget ? parseFloat(projectData.budget) : null,
        });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      invalidateRelatedQueries('/api/projects');
      setSuccessProject({ id: data.id, nameAr: data.nameAr, code: data.code });
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: error.message || 'حدث خطأ في إنشاء المشروع', variant: 'destructive' });
    },
  });

  const onSubmit = (data: ProjectFormData) => {
    createProjectMutation.mutate(data);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setIsAddDialogOpen(open);
    if (!open) {
      form.reset();
      setSuccessProject(null);
    }
  };

  const IN_PROGRESS_STATUSES = ['development', 'testing', 'deployment'];
  const filteredProjects = projects.filter(project => {
    const matchesSearch = (project.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (project.nameAr || '').includes(searchTerm);
    const matchesStatus = statusFilter === 'all'
      || (statusFilter === 'in_progress' ? IN_PROGRESS_STATUSES.includes(project.status) : project.status === statusFilter);
    return matchesSearch && matchesStatus;
  });

  const projectStats = {
    total: projects.length,
    inProgress: projects.filter(p => ['development', 'testing', 'deployment'].includes(p.status)).length,
    completed: projects.filter(p => p.status === 'completed').length,
    onHold: projects.filter(p => p.status === 'on_hold').length,
  };

  return (
    <DashboardLayout
      title="إدارة المشاريع"
      subtitle="متابعة وإدارة جميع المشاريع التقنية"
      navGroups={itDirectorNavGroups}
      portalName="بوابة المدير العام"
    >
      <div className="space-y-5">
        <PageHeader
          icon={FolderKanban}
          title="إدارة المشاريع"
          subtitle="متابعة وإدارة جميع المشاريع التقنية"
          actions={
            <>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input placeholder="بحث..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pr-10 h-9 text-sm w-44 bg-background" data-testid="input-search-projects" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 h-9 text-sm" data-testid="select-status-filter"><SelectValue placeholder="الحالة" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الحالات</SelectItem>
                  <SelectItem value="planning">تخطيط</SelectItem>
                  <SelectItem value="development">تطوير</SelectItem>
                  <SelectItem value="testing">اختبار</SelectItem>
                  <SelectItem value="deployment">نشر</SelectItem>
                  <SelectItem value="maintenance">صيانة</SelectItem>
                  <SelectItem value="completed">مكتمل</SelectItem>
                  <SelectItem value="on_hold">متوقف</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={handleRefresh} data-testid="button-refresh-projects"><RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} /></Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportPDF} data-testid="button-export-pdf"><FileDown className="w-3.5 h-3.5" />PDF</Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportExcel} data-testid="button-export-excel"><FileSpreadsheet className="w-3.5 h-3.5" />Excel</Button>
              <Button className="btn-gold h-9 gap-1.5 text-xs" onClick={() => { setIsAddDialogOpen(true); }} data-testid="button-add-project"><Plus className="w-3.5 h-3.5" />مشروع جديد</Button>
            </>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label="إجمالي المشاريع"
            value={projectStats.total}
            icon={FolderKanban}
            color="navy"
            sublabel="جميع مشاريع الإدارة"
            active={statusFilter === "all"}
            onClick={() => setStatusFilter("all")}
            data-testid="kpi-total-projects"
          />
          <KpiCard
            label="قيد التنفيذ"
            value={projectStats.inProgress}
            icon={Clock}
            color="gold"
            sublabel="مشاريع تسير بشكل نشط"
            active={statusFilter === "in_progress"}
            onClick={() => setStatusFilter(statusFilter === "in_progress" ? "all" : "in_progress")}
            data-testid="kpi-inprogress-projects"
          />
          <KpiCard
            label="مكتملة"
            value={projectStats.completed}
            icon={CheckCircle}
            color="success"
            sublabel="أنجزت جميع مراحلها"
            active={statusFilter === "completed"}
            onClick={() => setStatusFilter(statusFilter === "completed" ? "all" : "completed")}
            data-testid="kpi-completed-projects"
          />
          <KpiCard
            label="متوقفة"
            value={projectStats.onHold}
            icon={Circle}
            color="muted"
            sublabel="بانتظار استئناف الأعمال"
            active={statusFilter === "on_hold"}
            onClick={() => setStatusFilter(statusFilter === "on_hold" ? "all" : "on_hold")}
            data-testid="kpi-onhold-projects"
          />
        </div>

        <Card className="card-premium">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <FolderKanban className="w-5 h-5 hub-stat-gold" />
                قائمة المشاريع
              </CardTitle>
              <Dialog open={isAddDialogOpen} onOpenChange={handleDialogOpenChange}>
                  <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
                    <DialogHeader>
                      <DialogTitle>{successProject ? 'تم إنشاء المشروع' : 'إنشاء مشروع جديد'}</DialogTitle>
                    </DialogHeader>
                    {successProject ? (
                      <FormSuccessPanel
                        title="تم إنشاء المشروع بنجاح!"
                        subtitle={successProject.nameAr}
                        referenceNumber={successProject.code}
                        referenceLabel="رمز المشروع"
                        nextSteps={[
                          { title: "تحديد الفريق والموارد", description: "ادخل إلى المشروع لإضافة أعضاء الفريق وتوزيع المهام" },
                          { title: "تقسيم المشروع لمهام", description: "أنشئ المهام الرئيسية والفرعية لكل مرحلة من مراحل المشروع" },
                          { title: "متابعة التقدم", description: "يمكنك متابعة نسبة الإنجاز في لوحة تحكم المشاريع في أي وقت" },
                        ]}
                        actions={[
                          {
                            label: "إنشاء مشروع آخر",
                            variant: "default",
                            icon: <Plus className="w-4 h-4" />,
                            onClick: () => setSuccessProject(null),
                            testId: "button-create-another-project",
                          },
                          {
                            label: "إغلاق",
                            variant: "outline",
                            onClick: () => handleDialogOpenChange(false),
                            testId: "button-close-project-success",
                          },
                        ]}
                      />
                    ) : (
                    <>
                    <SmartFormAssistant 
                      formType="project"
                      onDataParsed={(data: ParsedFormData) => {
                        if (data.title) form.setValue('nameAr', data.title);
                        if (data.description) form.setValue('description', data.description);
                        if (data.priority) form.setValue('priority', data.priority as any);
                        if (data.dueDate) form.setValue('endDate', data.dueDate);
                      }}
                    />
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                        <FormField
                          control={form.control}
                          name="nameAr"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>اسم المشروع بالعربية *</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="مثال: مشروع تطوير بوابة الموظفين"
                                  {...field}
                                  data-testid="input-project-name"
                                />
                              </FormControl>
                              <FieldHint>اختر اسماً واضحاً يعكس هدف المشروع ونطاقه.</FieldHint>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="code"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>رمز المشروع *</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="مثال: IT-PRJ-2026-001"
                                  {...field}
                                  data-testid="input-project-code"
                                />
                              </FormControl>
                              <FieldHint>رمز فريد لتمييز المشروع في التقارير — أحرف كبيرة وأرقام وشرطة فقط.</FieldHint>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>وصف المشروع ونطاقه</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="اشرح هدف المشروع، والأقسام المستفيدة، والمخرجات المتوقعة..."
                                  rows={3}
                                  {...field}
                                  data-testid="input-project-description"
                                />
                              </FormControl>
                              <FieldHint>وصف واضح يساعد الفريق على فهم التوقعات منذ البداية.</FieldHint>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="priority"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>الأولوية *</FormLabel>
                                <Select value={field.value} onValueChange={field.onChange}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-project-priority">
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="low">منخفض</SelectItem>
                                    <SelectItem value="medium">متوسط</SelectItem>
                                    <SelectItem value="high">عالي</SelectItem>
                                    <SelectItem value="critical">حرج</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="status"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>الحالة *</FormLabel>
                                <Select value={field.value} onValueChange={field.onChange}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-project-status">
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="planning">تخطيط</SelectItem>
                                    <SelectItem value="development">تطوير</SelectItem>
                                    <SelectItem value="testing">اختبار</SelectItem>
                                    <SelectItem value="deployment">نشر</SelectItem>
                                    <SelectItem value="maintenance">صيانة</SelectItem>
                                    <SelectItem value="completed">مكتمل</SelectItem>
                                    <SelectItem value="on_hold">متوقف</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="startDate"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>تاريخ البداية</FormLabel>
                                <FormControl>
                                  <Input
                                    type="date"
                                    {...field}
                                    data-testid="input-project-start-date"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="endDate"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>تاريخ الانتهاء</FormLabel>
                                <FormControl>
                                  <Input
                                    type="date"
                                    {...field}
                                    data-testid="input-project-end-date"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name="budget"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>الميزانية</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="أدخل الميزانية"
                                  {...field}
                                  data-testid="input-project-budget"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <DialogFooter className="gap-2">
                          <Button 
                            variant="outline" 
                            onClick={() => setIsAddDialogOpen(false)}
                            type="button"
                            data-testid="button-cancel-project"
                          >
                            إلغاء
                          </Button>
                          <LoadingButton
                            type="submit"
                            loading={createProjectMutation.isPending}
                            loadingText="جاري الإنشاء..."
                            className="btn-gold"
                            data-testid="button-confirm-add-project"
                          >
                            إنشاء المشروع
                          </LoadingButton>
                        </DialogFooter>
                      </form>
                    </Form>
                    </>
                    )}
                  </DialogContent>
                </Dialog>
              </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">جاري تحميل المشاريع...</div>
            ) : filteredProjects.length === 0 ? (
              <div className="text-center py-12">
                <FolderKanban className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground">لا توجد مشاريع</p>
                <Button className="mt-4 btn-gold gap-2" onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="w-4 h-4" />
                  إنشاء مشروع جديد
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProjects.map((project) => (
                  <Card
                    key={project.id}
                    className="hover-elevate transition-all"
                    data-testid={`project-card-${project.id}`}
                    onClick={() => setSelectedProject(project)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold">{project.nameAr || project.code}</h3>
                          <span className="text-xs text-muted-foreground">{project.code}</span>
                        </div>
                        <Badge className={statusLabels[project.status]?.color || ''}>
                          {statusLabels[project.status]?.label || project.status}
                        </Badge>
                      </div>
                      {project.description && (
                        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                          {project.description}
                        </p>
                      )}
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>التقدم</span>
                            <span className="font-medium">{project.progress}%</span>
                          </div>
                          <Progress value={project.progress} className="h-2" />
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {project.startDate ? new Date(project.startDate).toLocaleDateString('ar-SA') : 'غير محدد'}
                          </div>
                          <ArrowRight className="w-3 h-3" />
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {project.endDate ? new Date(project.endDate).toLocaleDateString('ar-SA') : 'غير محدد'}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedProject} onOpenChange={(open) => !open && setSelectedProject(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          {selectedProject && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FolderKanban className="w-5 h-5 hub-stat-gold" />
                  تفاصيل المشروع
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold">{selectedProject.nameAr || selectedProject.code}</h2>
                    <span className="text-sm text-muted-foreground">{selectedProject.code}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={statusLabels[selectedProject.status]?.color || ''}>
                      {statusLabels[selectedProject.status]?.label || selectedProject.status}
                    </Badge>
                    <Badge variant="outline" className={priorityLabels[selectedProject.priority]?.color || ''}>
                      {priorityLabels[selectedProject.priority]?.label || selectedProject.priority}
                    </Badge>
                  </div>
                </div>

                {selectedProject.description && (
                  <div>
                    <Label className="text-muted-foreground text-xs">الوصف</Label>
                    <p className="mt-1">{selectedProject.description}</p>
                  </div>
                )}

                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>نسبة الإنجاز</span>
                    <span className="font-bold hub-stat-gold">{selectedProject.progress}%</span>
                  </div>
                  <Progress value={selectedProject.progress} className="h-3" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <Label className="text-muted-foreground text-xs">تاريخ البداية</Label>
                    <p className="font-medium flex items-center gap-1 mt-1">
                      <Calendar className="w-4 h-4" />
                      {selectedProject.startDate ? new Date(selectedProject.startDate).toLocaleDateString('ar-SA') : 'غير محدد'}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <Label className="text-muted-foreground text-xs">تاريخ الانتهاء</Label>
                    <p className="font-medium flex items-center gap-1 mt-1">
                      <Calendar className="w-4 h-4" />
                      {selectedProject.endDate ? new Date(selectedProject.endDate).toLocaleDateString('ar-SA') : 'غير محدد'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <Label className="text-muted-foreground text-xs">تاريخ الإنشاء</Label>
                    <p className="font-medium mt-1">
                      {new Date(selectedProject.createdAt).toLocaleDateString('ar-SA')}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <Label className="text-muted-foreground text-xs">تحديث الحالة</Label>
                    <Select
                      value={selectedProject.status}
                      onValueChange={(newStatus) => {
                        updateProjectMutation.mutate({ id: selectedProject.id, data: { status: newStatus } });
                      }}
                    >
                      <SelectTrigger data-testid="select-update-project-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="planning">تخطيط</SelectItem>
                        <SelectItem value="development">تطوير</SelectItem>
                        <SelectItem value="testing">اختبار</SelectItem>
                        <SelectItem value="deployment">نشر</SelectItem>
                        <SelectItem value="maintenance">صيانة</SelectItem>
                        <SelectItem value="completed">مكتمل</SelectItem>
                        <SelectItem value="on_hold">متوقف</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <DialogFooter className="gap-2">
                  <Button
                    variant="destructive"
                    onClick={() => confirmAction(() => deleteProjectMutation.mutate(selectedProject.id), { title: 'تأكيد الحذف', description: 'هل أنت متأكد من حذف هذا المشروع؟ لا يمكن التراجع عن هذا الإجراء.' })}
                    data-testid="button-delete-project"
                  >
                    حذف المشروع
                  </Button>
                  <Button variant="outline" onClick={() => setSelectedProject(null)} data-testid="button-close-project-details">
                    إغلاق
                  </Button>
                </DialogFooter>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog {...dialogProps} />
    </DashboardLayout>
  );
}
