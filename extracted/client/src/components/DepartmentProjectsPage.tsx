import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { PageHeader, KpiCard, EmptyState, SearchEmptyState } from '@/components/Quality';
import { useConfirmDialog, ConfirmDialog } from '@/components/ConfirmDialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/lib/auth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { infrastructureProjectSchema, type InfrastructureProjectFormData } from '@/lib/schemas';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import {
  BarChart3, Inbox, Server, Network, HardDrive, FileCheck2, BookOpen, FileText,
  FolderKanban, Ticket, Wrench, Activity, Users, Globe, Settings,
  Plus, Search, Calendar, Clock, CheckCircle, Circle, ArrowRight, RefreshCw,
  AlertCircle, Zap, ChevronRight, Layers, FileDown, FileSpreadsheet, Pencil, Trash2, Loader2
} from 'lucide-react';
import { exportToPDF, exportToExcel} from '@/lib/exports';
import { FormSuccessPanel } from "@/components/ui/form-guide";
import type { NavGroup } from '@/lib/navigation';

interface DepartmentProjectsConfig {
  departmentId: number;
  departmentName: string;
  portalName: string;
  navGroups: NavGroup[];
  icon: any;
}

interface DepartmentProjectsPageProps {
  config: DepartmentProjectsConfig;
}

const workflowStages = [
  { id: 1, label: 'تخطيط', color: 'hsl(222 47% 11%)', textColor: 'text-muted-foreground' },
  { id: 2, label: 'تطوير', color: 'hsl(43 74% 49%)', textColor: 'hub-stat-gold' },
  { id: 3, label: 'اختبار', color: 'hsl(43 74% 49%)', textColor: 'hub-stat-gold' },
  { id: 4, label: 'نشر', color: 'hsl(43 74% 49%)', textColor: 'hub-stat-gold' },
  { id: 5, label: 'صيانة', color: 'hsl(222 47% 11%)', textColor: 'text-muted-foreground' },
];

const statusLabels: Record<string, { label: string; color: string }> = {
  planning: { label: 'تخطيط', color: 'hub-badge-navy' },
  development: { label: 'تطوير', color: 'hub-badge-gold' },
  testing: { label: 'اختبار', color: 'hub-badge-gold' },
  deployment: { label: 'نشر', color: 'hub-badge-gold' },
  maintenance: { label: 'صيانة', color: 'hub-badge-navy' },
  completed: { label: 'مكتمل', color: 'bg-emerald-500/10 text-emerald-700' },
  on_hold: { label: 'متوقف', color: 'bg-red-500/10 text-red-700' },
};

const priorityLabels: Record<string, { label: string; color: string }> = {
  low: { label: 'منخفض', color: 'border-[hsl(222_47%_11%)]/20' },
  medium: { label: 'متوسط', color: 'border-[hsl(43_74%_49%)]/50' },
  high: { label: 'عالي', color: 'border-[hsl(43_74%_49%)]' },
  critical: { label: 'حرج', color: 'border-red-500' },
};

interface DepartmentProject {
  id?: number;
  code?: string;
  name: string;
  description?: string;
  status: string;
  priority: string;
  progress: number;
  startDate?: string;
  endDate?: string;
  departmentId?: number;
  timeline?: string;
}

function WorkflowIndicator({ currentStage }: { currentStage: number }) {
  return (
    <div className="relative mb-8 animate-fadeInUp">
      <div className="flex items-center justify-between px-4 py-6 bg-gradient-to-r from-[hsl(222_47%_11%)]/5 via-[hsl(43_74%_49%)]/5 to-[hsl(222_47%_11%)]/5 rounded-xl border border-[hsl(43_74%_49%)]/20 backdrop-blur-sm">
        {workflowStages.map((stage, index) => (
          <div key={stage.id} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${
                  currentStage >= stage.id
                    ? `bg-gradient-to-br from-[hsl(43_74%_49%)] to-[hsl(43_74%_40%)] text-muted-foreground shadow-lg shadow-[hsl(43_74%_49%)]/30`
                    : 'hub-badge-navy'
                }`}
              >
                {stage.id}
              </div>
              <span className={`text-xs mt-2 font-medium ${stage.textColor}`}>{stage.label}</span>
            </div>
            {index < workflowStages.length - 1 && (
              <div
                className={`flex-1 h-1 mx-2 rounded-full transition-all duration-300 ${
                  currentStage > stage.id
                    ? 'bg-gradient-to-r from-[hsl(43_74%_49%)] to-[hsl(43_74%_40%)]'
                    : 'bg-[hsl(222_47%_11%)]/10'
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DepartmentProjectsPage({ config }: DepartmentProjectsPageProps) {
  const { departmentId, departmentName, portalName, navGroups } = config;
  const { user } = useAuth();
  const { toast } = useToast();
  const { confirm: confirmAction, dialogProps } = useConfirmDialog();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [createdProjectName, setCreatedProjectName] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<DepartmentProject | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const addForm = useForm<InfrastructureProjectFormData>({
    resolver: zodResolver(infrastructureProjectSchema),
    defaultValues: {
      name: '',
      code: '',
      description: '',
      status: 'planning',
      priority: 'medium',
      progress: 0,
      startDate: '',
      endDate: '',
    },
  });

  const editForm = useForm<InfrastructureProjectFormData>({
    resolver: zodResolver(infrastructureProjectSchema),
    defaultValues: {
      name: '',
      code: '',
      description: '',
      status: 'planning',
      priority: 'medium',
      progress: 0,
      startDate: '',
      endDate: '',
    },
  });

  const { data: projects = [], isLoading, refetch } = useQuery<DepartmentProject[]>({
    queryKey: [`/api/it-projects?departmentId=${departmentId}`],
  });

  const createProjectMutation = useMutation({
    mutationFn: async (data: InfrastructureProjectFormData) => {
      const res = await apiRequest('POST', '/api/it-projects', {
        ...data,
        departmentId: departmentId,
        progress: Number(data.progress) || 0,
        budget: data.budget ? Number(data.budget) : undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/it-projects?departmentId=${departmentId}`] });
      setCreatedProjectName(addForm.getValues('name'));
      addForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: 'فشل في إنشاء المشروع', description: error.message, variant: 'destructive' });
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: async (data: DepartmentProject) => {
      const res = await apiRequest('PUT', `/api/it-projects/${data.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/it-projects?departmentId=${departmentId}`] });
      setIsEditDialogOpen(false);
      setSelectedProject(null);
      editForm.reset();
      toast({ title: 'تم تحديث المشروع بنجاح' });
    },
    onError: (error: Error) => {
      toast({ title: 'فشل في تحديث المشروع', description: error.message, variant: 'destructive' });
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId: number) => {
      const res = await apiRequest('DELETE', `/api/it-projects/${projectId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/it-projects?departmentId=${departmentId}`] });
      toast({ title: 'تم حذف المشروع بنجاح' });
    },
    onError: (error: Error) => {
      toast({ title: 'فشل في حذف المشروع', description: error.message, variant: 'destructive' });
    },
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 500);
    toast({ title: 'تم تحديث البيانات' });
  };

  const onAddProjectSubmit = (data: InfrastructureProjectFormData) => {
    createProjectMutation.mutate(data);
  };

  const onEditProjectSubmit = (data: InfrastructureProjectFormData) => {
    if (selectedProject) {
      updateProjectMutation.mutate({
        ...selectedProject,
        ...data,
        progress: typeof data.progress === 'string' ? parseInt(data.progress) || 0 : (data.progress ?? 0),
      });
    }
  };

  const handleUpdateStatus = (projectId: number, newStatus: string) => {
    const project = projects.find(p => p.id === projectId);
    if (project) {
      updateProjectMutation.mutate({ ...project, status: newStatus });
    }
  };

  const handleUpdateProgress = (projectId: number, newProgress: number) => {
    const project = projects.find(p => p.id === projectId);
    if (project) {
      updateProjectMutation.mutate({ ...project, progress: newProgress });
    }
  };

  const getCurrentWorkflowStage = (status: string): number => {
    const stageMap: Record<string, number> = {
      planning: 1,
      development: 2,
      testing: 3,
      deployment: 4,
      maintenance: 5,
      completed: 5,
      on_hold: 2,
    };
    return stageMap[status] || 1;
  };

  const handleExportPDF = () => {
    exportToPDF({
      title: `مشاريع ${departmentName}`,
      subtitle: 'نادي سباقات الخيل — مركز التحكم',
      columns: [
        { header: 'الاسم', key: 'name', width: 50 },
        { header: 'الحالة', key: 'statusLabel', width: 25 },
        { header: 'الأولوية', key: 'priorityLabel', width: 25 },
        { header: 'التقدم', key: 'progressLabel', width: 20 },
      ],
      data: projects.map(p => ({
        ...p,
        statusLabel: statusLabels[p.status]?.label || p.status,
        priorityLabel: priorityLabels[p.priority]?.label || p.priority,
        progressLabel: `${p.progress}%`,
      })),
      filename: `${departmentName}-projects-${new Date().toISOString().split('T')[0]}`,
      orientation: 'landscape',
    });
  };

  const handleExportExcel = () => {
    exportToExcel({
      title: `مشاريع ${departmentName}`,
      columns: [
        { header: 'الاسم', key: 'name' },
        { header: 'الحالة', key: 'statusLabel' },
        { header: 'الأولوية', key: 'priorityLabel' },
        { header: 'التقدم', key: 'progressLabel' },
      ],
      data: projects.map(p => ({
        ...p,
        statusLabel: statusLabels[p.status]?.label || p.status,
        priorityLabel: priorityLabels[p.priority]?.label || p.priority,
        progressLabel: `${p.progress}%`,
      })),
      filename: `${departmentName}-projects-${new Date().toISOString().split('T')[0]}`,
    });
  };

  const filteredProjects = projects.filter(project => {
    const matchesSearch = (project.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const projectStats = {
    total: projects.length,
    inProgress: projects.filter(p => ['development', 'testing', 'deployment'].includes(p.status)).length,
    completed: projects.filter(p => p.status === 'completed').length,
    onHold: projects.filter(p => p.status === 'on_hold').length,
  };

  const avgProgress = projects.length > 0 
    ? Math.round(projects.reduce((sum, p) => sum + (p.progress || 0), 0) / projects.length)
    : 0;

  return (
    <DashboardLayout 
      title={`إدارة مشاريع ${departmentName}`}
      subtitle={`إدارة مشاريع ${departmentName} والصيانة`}
      navGroups={navGroups}
      portalName={portalName}
    >
      <div className="space-y-5 animate-fadeIn">
        <PageHeader
          icon={FolderKanban}
          title={`مشاريع ${departmentName}`}
          subtitle={`إدارة مشاريع ${departmentName} والصيانة`}
          actions={
            <>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportPDF} data-testid="button-export-pdf"><FileDown className="w-3.5 h-3.5" />PDF</Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportExcel} data-testid="button-export-excel"><FileSpreadsheet className="w-3.5 h-3.5" />Excel</Button>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={handleRefresh} data-testid="button-refresh-projects"><RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} /></Button>
              <Button className="btn-gold h-9 gap-1.5 text-xs" size="sm" onClick={() => { addForm.reset(); setIsAddDialogOpen(true); }} data-testid="button-add-project"><Plus className="w-3.5 h-3.5" />إضافة مشروع</Button>
            </>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="إجمالي المشاريع" value={projectStats.total} icon={FolderKanban} color="navy" />
          <KpiCard label="قيد التنفيذ" value={projectStats.inProgress} icon={Zap} color="gold" />
          <KpiCard label="المكتملة" value={projectStats.completed} icon={CheckCircle} color="success" />
          <KpiCard label="متوسط الإنجاز" value={`${avgProgress}%`} icon={Layers} color="navy" />
        </div>

        <WorkflowIndicator currentStage={Math.min(Math.max(...projects.map(p => getCurrentWorkflowStage(p.status))), 5)} />

        <Card className="card-premium border-[hsl(43_74%_49%)]/20 animate-fadeInUp" style={{ animationDelay: '300ms' }}>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <FolderKanban className="w-5 h-5 hub-stat-gold" />
                <CardTitle className="text-lg">قائمة المشاريع</CardTitle>
                {filteredProjects.length !== projects.length && (
                  <span className="text-xs text-muted-foreground font-normal">عرض {filteredProjects.length} من {projects.length}</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="بحث عن مشروع..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pr-10 w-48"
                    data-testid="input-search-projects"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40" data-testid="select-status-filter">
                    <SelectValue placeholder="الحالة" />
                  </SelectTrigger>
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
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 bg-muted/50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="text-center py-12">
                <FolderKanban className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground font-medium">
                  {searchTerm || statusFilter !== 'all' ? 'لا توجد نتائج مطابقة' : 'لا توجد مشاريع حالياً'}
                </p>
                <p className="text-sm text-muted-foreground/60 mt-1">
                  {searchTerm || statusFilter !== 'all'
                    ? 'جرّب تعديل معايير البحث أو التصفية'
                    : 'اضغط على "إضافة مشروع" لإنشاء أول مشروع في القسم'}
                </p>
                {(searchTerm || statusFilter !== 'all') && (
                  <Button variant="outline" size="sm" className="mt-3 text-xs" onClick={() => { setSearchTerm(''); setStatusFilter('all'); }}>
                    إعادة ضبط التصفية
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredProjects.map((project, index) => (
                  <div
                    key={project.id}
                    className="p-4 border border-[hsl(43_74%_49%)]/20 rounded-lg bg-gradient-to-r from-[hsl(222_47%_11%)]/5 to-[hsl(43_74%_49%)]/5 hover-elevate transition-all animate-fadeInUp"
                    style={{ animationDelay: `${index * 50}ms` }}
                    data-testid={`project-card-${project.id}`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-muted-foreground">{project.name}</h3>
                          <Badge className={statusLabels[project.status]?.color || 'bg-gray-100'}>
                            {statusLabels[project.status]?.label || project.status}
                          </Badge>
                          <Badge variant="outline" className={priorityLabels[project.priority]?.color || 'border-gray-300'}>
                            {priorityLabels[project.priority]?.label || project.priority}
                          </Badge>
                        </div>
                        {project.description && (
                          <p className="text-sm text-muted-foreground">{project.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-muted-foreground">نسبة الإنجاز</span>
                          <span className="text-xs font-bold hub-stat-gold">{project.progress}%</span>
                        </div>
                        <Progress 
                          value={project.progress} 
                          className="h-2"
                        />
                      </div>

                      {(project.startDate || project.endDate) && (
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          {project.startDate && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Calendar className="w-4 h-4" />
                              <span>بدء: {new Date(project.startDate).toLocaleDateString('ar-SA')}</span>
                            </div>
                          )}
                          {project.endDate && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Clock className="w-4 h-4" />
                              <span>انتهاء: {new Date(project.endDate).toLocaleDateString('ar-SA')}</span>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-2">
                        <Select 
                          value={project.status}
                          onValueChange={(newStatus) => handleUpdateStatus(project.id!, newStatus)}
                        >
                          <SelectTrigger className="h-8 text-xs" data-testid={`status-select-${project.id}`}>
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

                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setSelectedProject(project);
                            editForm.reset({
                              name: project.name,
                              code: project.code || '',
                              description: project.description || '',
                              status: project.status as any,
                              priority: project.priority as any,
                              progress: project.progress || 0,
                              startDate: project.startDate || '',
                              endDate: project.endDate || '',
                            });
                            setIsEditDialogOpen(true);
                          }}
                          data-testid={`button-edit-${project.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>

                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-red-600"
                          onClick={() => {
                            confirmAction(() => deleteProjectMutation.mutate(project.id!), { title: 'تأكيد الحذف', description: 'هل أنت متأكد من حذف هذا المشروع؟ لا يمكن التراجع عن هذا الإجراء.' });
                          }}
                          data-testid={`button-delete-${project.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isAddDialogOpen} onOpenChange={(open) => { setIsAddDialogOpen(open); if (!open) { setCreatedProjectName(null); addForm.reset(); } }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" dir="rtl">
          {createdProjectName ? (
            <FormSuccessPanel
              title="تم إنشاء المشروع بنجاح"
              subtitle={`تم إضافة مشروع "${createdProjectName}" لقائمة مشاريع ${departmentName}`}
              nextSteps={[
                { title: "المشروع مسجل بحالة 'تخطيط'", description: "يمكنك تعديل الحالة ونسبة الإنجاز من بطاقة المشروع" },
                { title: "تابع تقدم المشروع من القائمة", description: "اضغط على المشروع لعرض التفاصيل وتحديث المراحل" },
              ]}
              actions={[
                { label: "إنشاء مشروع آخر", icon: <Plus className="w-4 h-4" />, onClick: () => { setCreatedProjectName(null); addForm.reset(); }, testId: "button-create-another-project" },
                { label: "إغلاق", variant: "outline", onClick: () => { setIsAddDialogOpen(false); setCreatedProjectName(null); }, testId: "button-close-project-success" },
              ]}
            />
          ) : (
          <>
          <DialogHeader>
            <DialogTitle>إضافة مشروع جديد</DialogTitle>
          </DialogHeader>
          <Form {...addForm}>
            <form onSubmit={addForm.handleSubmit(onAddProjectSubmit)} className="space-y-4">
              <FormField
                control={addForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>اسم المشروع</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="أدخل اسم المشروع"
                        data-testid="input-project-name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={addForm.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>رمز المشروع (اختياري)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="مثال: PROJ-001"
                        data-testid="input-project-code"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={addForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الوصف (اختياري)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="أدخل وصف المشروع"
                        className="h-20"
                        data-testid="input-project-description"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={addForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>الحالة</FormLabel>
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
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={addForm.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>الأولوية</FormLabel>
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
              </div>

              <FormField
                control={addForm.control}
                name="progress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>نسبة الإنجاز: {field.value}%</FormLabel>
                    <FormControl>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={field.value || 0}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                        className="w-full"
                        data-testid="input-project-progress"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={addForm.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>تاريخ البداية (اختياري)</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          data-testid="input-start-date"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={addForm.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>تاريخ الانتهاء (اختياري)</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          data-testid="input-end-date"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setIsAddDialogOpen(false)}
                  type="button"
                >
                  إلغاء
                </Button>
                <Button
                  className="bg-gradient-to-r from-[hsl(43_74%_49%)] to-[hsl(43_74%_40%)] text-muted-foreground gap-1.5"
                  disabled={createProjectMutation.isPending}
                  data-testid="button-submit-project"
                  type="submit"
                >
                  {createProjectMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {createProjectMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
          </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل المشروع</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditProjectSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>اسم المشروع</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="أدخل اسم المشروع"
                        data-testid="input-edit-project-name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>رمز المشروع (اختياري)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="مثال: PROJ-001"
                        data-testid="input-edit-project-code"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الوصف (اختياري)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="أدخل وصف المشروع"
                        className="h-20"
                        data-testid="input-edit-project-description"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>الحالة</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-project-status">
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

                <FormField
                  control={editForm.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>الأولوية</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-project-priority">
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
              </div>

              <FormField
                control={editForm.control}
                name="progress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>نسبة الإنجاز: {field.value}%</FormLabel>
                    <FormControl>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={field.value || 0}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                        className="w-full"
                        data-testid="input-edit-project-progress"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>تاريخ البداية (اختياري)</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          data-testid="input-edit-start-date"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>تاريخ الانتهاء (اختياري)</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          data-testid="input-edit-end-date"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setIsEditDialogOpen(false)}
                  type="button"
                >
                  إلغاء
                </Button>
                <Button
                  className="bg-gradient-to-r from-[hsl(43_74%_49%)] to-[hsl(43_74%_40%)] text-muted-foreground gap-1.5"
                  disabled={updateProjectMutation.isPending}
                  data-testid="button-update-project"
                  type="submit"
                >
                  {updateProjectMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {updateProjectMutation.isPending ? 'جاري الحفظ...' : 'تحديث'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog {...dialogProps} />
    </DashboardLayout>
  );
}