import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useConfirmDialog, ConfirmDialog } from '@/components/ConfirmDialog';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingButton } from "@/components/LoadingButton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, invalidateRelatedQueries } from "@/lib/queryClient";
import { committeeNavGroups } from "@/lib/navigation";
import { taskCreationSchema, type TaskCreationFormData } from "@/lib/schemas";
import { 
  CheckCircle, Plus, Search, RefreshCw, Clock, AlertTriangle, Users,
  Calendar, Trash2, Edit2, CheckCheck, Archive,
  ClipboardList, FileDown, FileSpreadsheet} from "lucide-react";
import { exportToPDF, exportToExcel, formatStatus, formatPriority } from '@/lib/exports';
import { PageHeader, KpiCard } from "@/components/Quality";
import { WorkflowIndicator } from "@/components/WorkflowIndicator";
import { getStatusBadge, TASK_STATUS } from "@/lib/status-utils";

const TASK_WORKFLOW_STEPS = [
  { id: 'assigned', label: 'إسناد', icon: Users },
  { id: 'in_progress', label: 'قيد التنفيذ', icon: Clock },
  { id: 'review', label: 'مراجعة', icon: ClipboardList },
  { id: 'completed', label: 'مكتمل', icon: CheckCheck },
  { id: 'archived', label: 'مؤرشف', icon: Archive },
];

interface Task {
  id: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assignedTo: string | null;
  assignedMemberId?: number | null;
  dueDate: string | null;
  createdAt: string;
  notes?: string | null;
}

export default function CommitteeTasks() {
  const { toast } = useToast();
  const { confirm: confirmAction, dialogProps } = useConfirmDialog();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const createForm = useForm<TaskCreationFormData>({
    resolver: zodResolver(taskCreationSchema),
    defaultValues: {
      title: "",
      description: "",
      assignedTo: "",
      priority: "medium",
      dueDate: "",
      decisionId: undefined,
    },
  });

  const editForm = useForm<TaskCreationFormData>({
    resolver: zodResolver(taskCreationSchema),
    defaultValues: {
      title: "",
      description: "",
      assignedTo: "",
      priority: "medium",
      dueDate: "",
      decisionId: undefined,
    },
  });

  const { data: tasks = [], isLoading, refetch } = useQuery<Task[]>({
    queryKey: ['/api/committee-tasks'],
  });

  const { data: committeeMembers = [] } = useQuery<any[]>({
    queryKey: ['/api/committee-members'],
  });

  const { data: usersList = [] } = useQuery<any[]>({
    queryKey: ['/api/users-list'],
  });

  const filteredTasks = tasks.filter((task: Task) => {
    const matchesSearch = task.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (task.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || task.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: TaskCreationFormData) => {
      const res = await apiRequest('POST', '/api/committee-tasks', {
        title: data.title,
        description: data.description,
        assignedTo: data.assignedTo,
        priority: data.priority,
        dueDate: data.dueDate || null,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'تم إنشاء المهمة بنجاح', description: 'تمت إضافة المهمة الجديدة إلى القائمة' });
      setIsAddDialogOpen(false);
      createForm.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/committee-tasks'] });
      invalidateRelatedQueries('/api/committee-tasks');
    },
    onError: (error: Error) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async (data: { id: number; updates: TaskCreationFormData }) => {
      const res = await apiRequest('PUT', `/api/committee-tasks/${data.id}`, {
        title: data.updates.title,
        description: data.updates.description,
        assignedTo: data.updates.assignedTo,
        priority: data.updates.priority,
        dueDate: data.updates.dueDate || null,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'تم تحديث المهمة بنجاح', description: 'تم حفظ التغييرات' });
      setIsEditDialogOpen(false);
      setEditingTask(null);
      editForm.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/committee-tasks'] });
      invalidateRelatedQueries('/api/committee-tasks');
    },
    onError: (error: Error) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/committee-tasks/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'تم حذف المهمة بنجاح', description: 'تمت إزالة المهمة من القائمة' });
      queryClient.invalidateQueries({ queryKey: ['/api/committee-tasks'] });
      invalidateRelatedQueries('/api/committee-tasks');
    },
    onError: (error: Error) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });

  const handleCreateTask = (data: TaskCreationFormData) => {
    createTaskMutation.mutate(data);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    editForm.reset({
      title: task.title,
      description: task.description || '',
      assignedTo: task.assignedTo || '',
      priority: task.priority as 'low' | 'medium' | 'high' | 'critical' | 'urgent',
      dueDate: task.dueDate ? task.dueDate.split('T')[0] : '',
      decisionId: undefined,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateTask = (data: TaskCreationFormData) => {
    if (editingTask) {
      updateTaskMutation.mutate({ id: editingTask.id, updates: data });
    }
  };

  const handleDeleteTask = (id: number) => {
    confirmAction(() => deleteTaskMutation.mutate(id), { title: 'تأكيد الحذف', description: 'هل أنت متأكد من حذف هذه المهمة؟ لا يمكن التراجع عن هذا الإجراء.' });
  };

  const statusChangeMutation = useMutation({
    mutationFn: async (data: { id: number; status: string }) => {
      const res = await apiRequest('PATCH', `/api/committee-tasks/${data.id}/status`, { status: data.status });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'تم تحديث الحالة بنجاح' });
      queryClient.invalidateQueries({ queryKey: ['/api/committee-tasks'] });
      invalidateRelatedQueries('/api/committee-tasks');
    },
    onError: (error: Error) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });

  const handleStatusChange = (taskId: number, newStatus: string) => {
    statusChangeMutation.mutate({ id: taskId, status: newStatus });
  };

  const getTaskStatusBadge = (status: string) => getStatusBadge(status, TASK_STATUS);

  const getPriorityBadge = (priority: string) => {
    const styles: Record<string, string> = {
      urgent: "bg-red-600/20 text-red-600 font-semibold",
      low: "bg-muted text-muted-foreground",
      medium: "bg-[hsl(222_47%_11%)]/20 text-muted-foreground",
      high: "hub-badge-gold hub-stat-gold",
      critical: "bg-red-500/20 text-red-700",
    };
    const labels: Record<string, string> = {
      urgent: "عاجلة", low: "منخفضة", medium: "متوسطة", high: "عالية", critical: "حرجة"
    };
    return <Badge className={styles[priority] || styles.medium}>{labels[priority] || priority}</Badge>;
  };

  const stats = {
    total: tasks.length,
    assigned: tasks.filter((t: Task) => t.status === 'assigned' || t.status === 'pending').length,
    inProgress: tasks.filter((t: Task) => t.status === 'in_progress').length,
    completed: tasks.filter((t: Task) => t.status === 'completed' || t.status === 'archived').length,
  };

  const allMembers = (() => {
    const map = new Map<string, string>();
    committeeMembers.forEach((m: any) => {
      const name = m.name || m.nameAr || '';
      if (name) map.set(name, name);
    });
    usersList.forEach((u: any) => {
      const name = u.name || u.nameEn || '';
      if (name) map.set(name, name);
    });
    return Array.from(map.values()).sort();
  })();

  const formatTaskDate = (dateStr: string | null): string => {
    if (!dateStr) return '—';
    try { return new Date(dateStr).toLocaleDateString('ar-SA'); } catch { return dateStr; }
  };


  const handleExportPDF = () => {
    exportToPDF({
      title: 'تقرير مهام اللجنة',
      subtitle: 'JCSA - Control Hub',
      columns: [{"header":"المهمة","key":"title","width":40},{"header":"الأولوية","key":"priority","width":20},{"header":"الحالة","key":"status","width":20},{"header":"المسؤول","key":"assignee","width":25}],
      data: (filteredTasks || []).map((item: any) => ({ title: item.title || '', priority: formatPriority(item.priority || ''), status: formatStatus(item.status || ''), assignee: item.assignedTo || '' })),
      filename: 'committee-tasks-report',
      orientation: 'landscape',
    });
  };

  const handleExportExcel = () => {
    exportToExcel({
      title: 'تقرير مهام اللجنة',
      columns: [{"header":"المهمة","key":"title","width":40},{"header":"الأولوية","key":"priority","width":20},{"header":"الحالة","key":"status","width":20},{"header":"المسؤول","key":"assignee","width":25}],
      data: (filteredTasks || []).map((item: any) => ({ title: item.title || '', priority: formatPriority(item.priority || ''), status: formatStatus(item.status || ''), assignee: item.assignedTo || '' })),
      filename: 'committee-tasks-report',
    });
  };

  return (
    <DashboardLayout 
      title="مهام اللجنة" 
      subtitle="إدارة ومتابعة مهام لجنة حوكمة البيانات"
      navGroups={committeeNavGroups}
      portalName="اللجنة"
    >
      <div className="space-y-5">
        <PageHeader
          icon={ClipboardList}
          title="مهام اللجان"
          subtitle="متابعة وإدارة مهام اللجنة"
          actions={
            <>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input placeholder="بحث في المهام..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pr-10 h-9 text-sm w-44 bg-background" data-testid="input-search-tasks" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 h-9 text-sm" data-testid="select-status-filter"><SelectValue placeholder="الحالة" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الحالات</SelectItem>
                  <SelectItem value="pending">معلقة</SelectItem>
                  <SelectItem value="assigned">إسناد</SelectItem>
                  <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
                  <SelectItem value="review">مراجعة</SelectItem>
                  <SelectItem value="completed">مكتمل</SelectItem>
                  <SelectItem value="archived">مؤرشف</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-32 h-9 text-sm" data-testid="select-priority-filter"><SelectValue placeholder="الأولوية" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الأولويات</SelectItem>
                  <SelectItem value="urgent">عاجلة</SelectItem>
                  <SelectItem value="low">منخفضة</SelectItem>
                  <SelectItem value="medium">متوسطة</SelectItem>
                  <SelectItem value="high">عالية</SelectItem>
                  <SelectItem value="critical">حرجة</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => refetch()} data-testid="button-refresh-tasks"><RefreshCw className="w-3.5 h-3.5" /></Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportPDF} data-testid="button-export-pdf"><FileDown className="w-3.5 h-3.5" />PDF</Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportExcel} data-testid="button-export-excel"><FileSpreadsheet className="w-3.5 h-3.5" />Excel</Button>
              <Button className="btn-gold h-9 gap-1.5 text-xs" onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-task"><Plus className="w-3.5 h-3.5" />مهمة جديدة</Button>
            </>
          }
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label="إجمالي المهام"
            value={stats.total}
            icon={ClipboardList}
            color="navy"
            sublabel="كل مهام اللجنة"
            active={statusFilter === "all"}
            onClick={() => setStatusFilter("all")}
            data-testid="kpi-total-tasks"
          />
          <KpiCard
            label="مهام جديدة"
            value={stats.assigned}
            icon={AlertTriangle}
            color="gold"
            sublabel="مسندة ولم تبدأ بعد"
            active={statusFilter === "assigned"}
            onClick={() => setStatusFilter(statusFilter === "assigned" ? "all" : "assigned")}
            data-testid="kpi-assigned-tasks"
          />
          <KpiCard
            label="قيد التنفيذ"
            value={stats.inProgress}
            icon={Clock}
            color="info"
            sublabel="يعمل عليها الآن"
            active={statusFilter === "in_progress"}
            onClick={() => setStatusFilter(statusFilter === "in_progress" ? "all" : "in_progress")}
            data-testid="kpi-inprogress-tasks"
          />
          <KpiCard
            label="مكتملة"
            value={stats.completed}
            icon={CheckCircle}
            color="success"
            sublabel="أنجزت وتم توثيقها"
            active={statusFilter === "completed"}
            onClick={() => setStatusFilter(statusFilter === "completed" ? "all" : "completed")}
            data-testid="kpi-completed-tasks"
          />
        </div>

        <Dialog 
                open={isAddDialogOpen} 
                onOpenChange={(open) => {
                  setIsAddDialogOpen(open);
                  if (!open) {
                    createForm.reset();
                  }
                }}
              >
                <DialogContent className="max-w-md" dir="rtl">
                  <DialogHeader>
                    <DialogTitle>إضافة مهمة جديدة</DialogTitle>
                  </DialogHeader>
                  <Form {...createForm}>
                    <form onSubmit={createForm.handleSubmit(handleCreateTask)} className="space-y-4">
                      <FormField
                        control={createForm.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>عنوان المهمة</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="أدخل عنوان المهمة"
                                data-testid="input-task-title"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={createForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>الوصف</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="أدخل وصف المهمة"
                                data-testid="textarea-task-description"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={createForm.control}
                        name="assignedTo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>المسؤول</FormLabel>
                            <FormControl>
                              <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger data-testid="select-assigned-to">
                                  <SelectValue placeholder="اختر المسؤول" />
                                </SelectTrigger>
                                <SelectContent>
                                  {allMembers.map((member) => (
                                    <SelectItem key={member} value={member}>{member}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={createForm.control}
                          name="priority"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>الأولوية</FormLabel>
                              <FormControl>
                                <Select value={field.value} onValueChange={field.onChange}>
                                  <SelectTrigger data-testid="select-priority">
                                    <SelectValue placeholder="الأولوية" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="urgent">عاجلة</SelectItem>
                                    <SelectItem value="low">منخفضة</SelectItem>
                                    <SelectItem value="medium">متوسطة</SelectItem>
                                    <SelectItem value="high">عالية</SelectItem>
                                    <SelectItem value="critical">حرجة</SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={createForm.control}
                          name="dueDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>تاريخ الاستحقاق</FormLabel>
                              <FormControl>
                                <Input
                                  type="date"
                                  data-testid="input-due-date"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} data-testid="button-cancel-create-task">إلغاء</Button>
                        <LoadingButton
                          className="btn-gold"
                          type="submit"
                          loading={createTaskMutation.isPending}
                          loadingText="جاري الإنشاء..."
                          data-testid="button-create-task"
                        >
                          إنشاء
                        </LoadingButton>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>

        {/* Tasks List */}
        <div className="space-y-4">
          {filteredTasks.length > 0 ? (
            filteredTasks.map((task: Task, index: number) => (
              <Card key={task.id} className={`card-premium card-hover animate-fadeInUp stagger-${(index % 5) + 1}`} data-testid={`card-task-${task.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {getTaskStatusBadge(task.status)}
                        {getPriorityBadge(task.priority)}
                      </div>
                      <h4 className="font-semibold text-lg mb-2">{task.title}</h4>
                      <p className="text-sm text-muted-foreground mb-3">{task.description}</p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {task.assignedTo || 'غير محدد'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatTaskDate(task.dueDate)}
                        </span>
                      </div>
                      
                      {/* Status Update */}
                      <div className="flex items-center gap-2 mt-3">
                        <Label className="text-xs text-muted-foreground">تحديث الحالة:</Label>
                        <Select 
                          value={task.status} 
                          onValueChange={(newStatus) => handleStatusChange(task.id, newStatus)}
                        >
                          <SelectTrigger className="w-[150px] h-8" data-testid={`select-status-${task.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">معلقة</SelectItem>
                            <SelectItem value="assigned">إسناد</SelectItem>
                            <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
                            <SelectItem value="review">مراجعة</SelectItem>
                            <SelectItem value="completed">مكتمل</SelectItem>
                            <SelectItem value="archived">مؤرشف</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-3 mr-4">
                      <WorkflowIndicator steps={TASK_WORKFLOW_STEPS} currentStep={task.status} />
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleEditTask(task)}
                          data-testid={`button-edit-task-${task.id}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="hover:bg-red-500/20 hover:text-red-600"
                          onClick={() => handleDeleteTask(task.id)}
                          data-testid={`button-delete-task-${task.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="card-premium">
              <CardContent className="p-8 text-center">
                <ClipboardList className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">لا توجد مهام تطابق معايير البحث</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Edit Dialog */}
        <Dialog 
          open={isEditDialogOpen} 
          onOpenChange={(open) => {
            setIsEditDialogOpen(open);
            if (!open) {
              editForm.reset();
            }
          }}
        >
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle>تحرير المهمة</DialogTitle>
            </DialogHeader>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(handleUpdateTask)} className="space-y-4">
                <FormField
                  control={editForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>عنوان المهمة</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="أدخل عنوان المهمة"
                          data-testid="input-edit-task-title"
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
                      <FormLabel>الوصف</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="أدخل وصف المهمة"
                          data-testid="textarea-edit-task-description"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="assignedTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>المسؤول</FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger data-testid="select-edit-assigned-to">
                            <SelectValue placeholder="اختر المسؤول" />
                          </SelectTrigger>
                          <SelectContent>
                            {members.map((member) => (
                              <SelectItem key={member} value={member}>{member}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>الأولوية</FormLabel>
                        <FormControl>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger data-testid="select-edit-priority">
                              <SelectValue placeholder="الأولوية" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="urgent">عاجلة</SelectItem>
                              <SelectItem value="low">منخفضة</SelectItem>
                              <SelectItem value="medium">متوسطة</SelectItem>
                              <SelectItem value="high">عالية</SelectItem>
                              <SelectItem value="critical">حرجة</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>تاريخ الاستحقاق</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            data-testid="input-edit-due-date"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} data-testid="button-cancel-edit-task">إلغاء</Button>
                  <LoadingButton
                    className="btn-gold"
                    type="submit"
                    loading={updateTaskMutation.isPending}
                    loadingText="جاري التحديث..."
                    data-testid="button-update-task"
                  >
                    تحديث
                  </LoadingButton>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
      <ConfirmDialog {...dialogProps} />
    </DashboardLayout>
  );
}
