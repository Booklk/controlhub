import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useConfirmDialog, ConfirmDialog } from '@/components/ConfirmDialog';
import { useQuery, useMutation } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { BookmarkButton } from '@/components/SmartBookmarks';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, invalidateRelatedQueries } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { ReferralEscalationButtons, DepartmentReferralsSection } from "@/components/ReferralEscalationPanel";
import { exportToPDF, exportToExcel, formatStatus, formatPriority } from '@/lib/exports';
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader, KpiCard, EmptyState, SearchEmptyState, TableSkeleton } from "@/components/Quality";
import { FormSuccessPanel } from "@/components/ui/form-guide";
import {
  CheckCircle, Plus, Search, RefreshCw, Clock, Users,
  Calendar, Edit2, CheckCheck, Archive,
  ClipboardList, Inbox, AlertTriangle, ArrowRight,
  FileDown, FileSpreadsheet, CalendarDays, Timer,
  Target, TrendingUp, Zap, ListFilter, CheckSquare, X, Download
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ExternalImportDialog } from "@/components/ExternalImportDialog";

interface Task {
  id: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  assignedTo: string;
  assignedBy: string;
  dueDate: string;
  createdDate: string;
  createdAt?: string;
}

interface DepartmentTasksConfig {
  departmentId: number;
  departmentName: string;
  departmentNameEn: string;
  portalName: string;
  navGroups: any[];
  icon: LucideIcon;
  title: string;
  subtitle: string;
}

const STATUS_CONFIG: Record<string, { label: string; style: string; icon: LucideIcon }> = {
  pending: { label: "في الانتظار", style: "bg-muted text-muted-foreground border border-muted-foreground/20", icon: Clock },
  assigned: { label: "إسناد", style: "bg-muted text-muted-foreground border border-muted-foreground/20", icon: Users },
  in_progress: { label: "قيد التنفيذ", style: "hub-badge-navy", icon: Zap },
  review: { label: "مراجعة", style: "hub-badge-gold", icon: ClipboardList },
  completed: { label: "مكتمل", style: "hub-badge-gold-solid", icon: CheckCheck },
  archived: { label: "مؤرشف", style: "bg-foreground/10 text-muted-foreground border border-muted/40", icon: Archive },
};

const PRIORITY_CONFIG: Record<string, { label: string; style: string }> = {
  urgent: { label: "عاجلة", style: "bg-red-600/15 text-red-600 border border-red-600/40 font-semibold" },
  low: { label: "منخفضة", style: "bg-muted text-muted-foreground border border-muted/40" },
  medium: { label: "متوسطة", style: "hub-badge-navy" },
  high: { label: "عالية", style: "hub-badge-gold" },
  critical: { label: "حرجة", style: "bg-red-500/15 text-red-700 border border-red-500/30" },
};

function isOverdue(task: Task): boolean {
  if (!task.dueDate || task.status === 'completed' || task.status === 'archived') return false;
  return new Date(task.dueDate) < new Date(new Date().toDateString());
}

function isDueToday(task: Task): boolean {
  if (!task.dueDate || task.status === 'completed' || task.status === 'archived') return false;
  const today = new Date().toDateString();
  return new Date(task.dueDate).toDateString() === today;
}

function isDueThisWeek(task: Task): boolean {
  if (!task.dueDate || task.status === 'completed' || task.status === 'archived') return false;
  const now = new Date();
  const weekEnd = new Date(now);
  weekEnd.setDate(now.getDate() + 7);
  const due = new Date(task.dueDate);
  return due >= now && due <= weekEnd;
}

function getDaysRemaining(dueDate: string): number {
  const now = new Date(new Date().toDateString());
  const due = new Date(dueDate);
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function DueDateIndicator({ task }: { task: Task }) {
  if (!task.dueDate) return null;
  const days = getDaysRemaining(task.dueDate);
  const overdue = isOverdue(task);
  const today = isDueToday(task);

  if (task.status === 'completed' || task.status === 'archived') {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Calendar className="w-3 h-3" />
        {new Date(task.dueDate).toLocaleDateString('ar-SA')}
      </span>
    );
  }

  if (overdue) {
    return (
      <span className="flex items-center gap-1 text-xs text-red-600 font-medium" data-testid={`due-overdue-${task.id}`}>
        <AlertTriangle className="w-3 h-3" />
        متأخر {Math.abs(days)} يوم
      </span>
    );
  }

  if (today) {
    return (
      <span className="flex items-center gap-1 text-xs hub-stat-gold font-medium" data-testid={`due-today-${task.id}`}>
        <Timer className="w-3 h-3" />
        مستحق اليوم
      </span>
    );
  }

  if (days <= 3) {
    return (
      <span className="flex items-center gap-1 text-xs hub-stat-gold" data-testid={`due-soon-${task.id}`}>
        <Clock className="w-3 h-3" />
        بعد {days} أيام
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Calendar className="w-3 h-3" />
      {new Date(task.dueDate).toLocaleDateString('ar-SA')}
    </span>
  );
}

export default function DepartmentTasksPage({ config }: { config: DepartmentTasksConfig }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { confirm: confirmAction, dialogProps } = useConfirmDialog();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [createdTaskTitle, setCreatedTaskTitle] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [formData, setFormData] = useState({ title: "", description: "", assignedTo: "", priority: "medium", dueDate: "" });
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredTasks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTasks.map(t => t.id)));
    }
  };

  const exitBulkMode = () => {
    setBulkMode(false);
    setSelectedIds(new Set());
  };

  const { data: tasks = [], isLoading, refetch } = useQuery<Task[]>({
    queryKey: [`/api/tasks/it-department/${config.departmentId}`],
  });

  const { data: departmentUsers = [], isLoading: usersLoading } = useQuery<{ id: number; name: string; nameEn: string; email: string; jobTitle: string; role: string }[]>({
    queryKey: ['/api/department-users', config.departmentId],
    queryFn: async () => {
      const res = await fetch(`/api/department-users?departmentId=${config.departmentId}`, {
        headers: { 'Authorization': `Bearer ${sessionStorage.getItem('_cht') || ''}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const getUserName = useCallback((assignedTo: string | number | null | undefined) => {
    if (!assignedTo) return null;
    const id = typeof assignedTo === 'string' ? parseInt(assignedTo) : assignedTo;
    if (isNaN(id)) return String(assignedTo);
    const found = departmentUsers.find(u => u.id === id);
    return found ? found.name : String(assignedTo);
  }, [departmentUsers]);

  const stats = useMemo(() => {
    const active = tasks.filter(t => !['completed', 'archived'].includes(t.status));
    const completed = tasks.filter(t => t.status === 'completed' || t.status === 'archived');
    const overdue = tasks.filter(isOverdue);
    const dueToday = tasks.filter(isDueToday);
    const dueThisWeek = tasks.filter(isDueThisWeek);
    const inProgress = tasks.filter(t => t.status === 'in_progress');
    const completionRate = tasks.length > 0 ? Math.round((completed.length / tasks.length) * 100) : 0;

    return {
      total: tasks.length,
      active: active.length,
      completed: completed.length,
      overdue: overdue.length,
      dueToday: dueToday.length,
      dueThisWeek: dueThisWeek.length,
      inProgress: inProgress.length,
      completionRate,
    };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    let filtered = [...tasks];

    if (activeTab === "overdue") filtered = filtered.filter(isOverdue);
    else if (activeTab === "today") filtered = filtered.filter(isDueToday);
    else if (activeTab === "week") filtered = filtered.filter(isDueThisWeek);
    else if (activeTab === "active") filtered = filtered.filter(t => ['pending', 'assigned', 'in_progress', 'review'].includes(t.status));
    else if (activeTab === "completed") filtered = filtered.filter(t => t.status === 'completed' || t.status === 'archived');

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(t => t.title?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q) || t.assignedTo?.toLowerCase().includes(q));
    }
    if (statusFilter !== "all") filtered = filtered.filter(t => t.status === statusFilter);
    if (priorityFilter !== "all") filtered = filtered.filter(t => t.priority === priorityFilter);

    filtered.sort((a, b) => {
      const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      const overdueA = isOverdue(a) ? -1 : 0;
      const overdueB = isOverdue(b) ? -1 : 0;
      if (overdueA !== overdueB) return overdueA - overdueB;
      return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
    });

    return filtered;
  }, [tasks, activeTab, searchQuery, statusFilter, priorityFilter]);

  const taskQueryKey = [`/api/tasks/it-department/${config.departmentId}`];

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: taskQueryKey });
    invalidateRelatedQueries('/api/tasks');
  }, [config.departmentId]);

  const createTaskMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest('POST', '/api/tasks', { ...data, departmentId: config.departmentId });
      return res.json();
    },
    onSuccess: (_data: any) => {
      setCreatedTaskTitle(formData.title);
      resetForm();
      invalidateAll();
    },
    onError: () => toast({ title: 'خطأ', description: 'حدث خطأ أثناء إنشاء المهمة', variant: 'destructive' }),
  });

  const updateTaskMutation = useMutation({
    mutationFn: async (data: { id: number; updates: any }) => apiRequest('PATCH', `/api/tasks/${data.id}`, data.updates),
    onSuccess: () => {
      toast({ title: 'تم تحديث المهمة بنجاح' });
      setIsEditDialogOpen(false);
      setEditingTask(null);
      resetForm();
      invalidateAll();
    },
    onError: () => toast({ title: 'خطأ في التحديث', variant: 'destructive' }),
  });

  const bulkStatusMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: number[]; status: string }) => {
      await Promise.all(ids.map(id => apiRequest('PATCH', `/api/tasks/${id}/status`, { status })));
    },
    onSuccess: (_, { ids }) => {
      toast({ title: `تم تحديث ${ids.length} مهمة بنجاح` });
      exitBulkMode();
      invalidateAll();
    },
    onError: () => toast({ title: 'حدث خطأ في التحديث الجماعي', variant: 'destructive' }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => apiRequest('PATCH', `/api/tasks/${id}/status`, { status }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: taskQueryKey });
      const prev = queryClient.getQueryData<Task[]>(taskQueryKey);
      queryClient.setQueryData<Task[]>(taskQueryKey, (old) =>
        old?.map(t => t.id === id ? { ...t, status } : t) ?? []
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(taskQueryKey, context.prev);
      toast({ title: 'حدث خطأ في تحديث الحالة', variant: 'destructive' });
    },
    onSettled: () => invalidateAll(),
    onSuccess: () => toast({ title: 'تم تحديث الحالة' }),
  });

  const resetForm = () => setFormData({ title: "", description: "", assignedTo: "", priority: "medium", dueDate: "" });

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || "",
      assignedTo: task.assignedTo ? String(task.assignedTo) : "",
      priority: task.priority || "medium",
      dueDate: task.dueDate ? task.dueDate.split('T')[0] : "",
    });
    setIsEditDialogOpen(true);
  };

  const handleExportPDF = () => {
    exportToPDF({
      title: `تقرير مهام ${config.departmentName}`,
      subtitle: 'JCSA - Control Hub',
      columns: [
        { header: "المهمة", key: "title", width: 40 },
        { header: "الأولوية", key: "priority", width: 15 },
        { header: "الحالة", key: "status", width: 15 },
        { header: "المسؤول", key: "assignee", width: 20 },
        { header: "الموعد", key: "dueDate", width: 15 },
      ],
      data: filteredTasks.map(item => ({
        title: item.title || '',
        priority: formatPriority(item.priority || ''),
        status: formatStatus(item.status || ''),
        assignee: getUserName(item.assignedTo) || '',
        dueDate: item.dueDate ? new Date(item.dueDate).toLocaleDateString('ar-SA') : '-',
      })),
      filename: `${config.departmentNameEn}-tasks-report`,
      orientation: 'landscape',
    });
  };

  const handleExportExcel = () => {
    exportToExcel({
      title: `تقرير مهام ${config.departmentName}`,
      columns: [
        { header: "المهمة", key: "title", width: 40 },
        { header: "الأولوية", key: "priority", width: 15 },
        { header: "الحالة", key: "status", width: 15 },
        { header: "المسؤول", key: "assignee", width: 20 },
        { header: "الموعد", key: "dueDate", width: 15 },
      ],
      data: filteredTasks.map(item => ({
        title: item.title || '',
        priority: formatPriority(item.priority || ''),
        status: formatStatus(item.status || ''),
        assignee: getUserName(item.assignedTo) || '',
        dueDate: item.dueDate ? new Date(item.dueDate).toLocaleDateString('ar-SA') : '-',
      })),
      filename: `${config.departmentNameEn}-tasks-report`,
    });
  };

  const Icon = config.icon;

  return (
    <DashboardLayout title={config.title} subtitle={config.subtitle} navGroups={config.navGroups} portalName={config.portalName}>
      <div className="space-y-5" dir="rtl">
        <PageHeader
          icon={Icon}
          title={config.title}
          subtitle={config.subtitle}
          actions={
            <>
              <Button
                variant={bulkMode ? "default" : "outline"}
                size="sm"
                onClick={() => bulkMode ? exitBulkMode() : setBulkMode(true)}
                className="h-9 text-xs gap-1.5"
                data-testid="button-toggle-bulk"
              >
                {bulkMode ? <><X className="w-3.5 h-3.5" />إلغاء التحديد</> : <><CheckSquare className="w-3.5 h-3.5" />تحديد جماعي</>}
              </Button>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={handleExportPDF} title="تصدير PDF" data-testid="button-export-pdf">
                <FileDown className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={handleExportExcel} title="تصدير Excel" data-testid="button-export-excel">
                <FileSpreadsheet className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={() => refetch()} data-testid="button-refresh-tasks">
                <RefreshCw className="w-3.5 h-3.5" />تحديث
              </Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={() => setIsImportOpen(true)} data-testid="button-import-tasks">
                <Download className="w-3.5 h-3.5" />استيراد
              </Button>
              <Button size="sm" className="h-9 gap-1.5 text-xs" onClick={() => { setCreatedTaskTitle(null); resetForm(); setIsAddDialogOpen(true); }} data-testid="button-add-task">
                <Plus className="w-3.5 h-3.5" />مهمة جديدة
              </Button>
              <Dialog open={isAddDialogOpen} onOpenChange={(open) => { setIsAddDialogOpen(open); if (!open) { setCreatedTaskTitle(null); resetForm(); } }}>
              <DialogContent className="max-w-lg" dir="rtl">
                {createdTaskTitle ? (
                  <FormSuccessPanel
                    title="تم إنشاء المهمة بنجاح"
                    subtitle={`تم إضافة "${createdTaskTitle}" لقائمة مهام ${config.departmentName}`}
                    nextSteps={[
                      { title: "المهمة أُضيفت بحالة 'معلقة'", description: "يمكنك تعيين موظف وتغيير الحالة من القائمة" },
                      { title: "تابع تقدم المهمة من لوحة المهام", description: "اضغط على المهمة لعرض التفاصيل أو تعديلها" },
                    ]}
                    actions={[
                      { label: "إنشاء مهمة أخرى", icon: <Plus className="w-4 h-4" />, onClick: () => { setCreatedTaskTitle(null); resetForm(); }, testId: "button-create-another-task" },
                      { label: "إغلاق", variant: "outline", onClick: () => { setIsAddDialogOpen(false); setCreatedTaskTitle(null); }, testId: "button-close-task-success" },
                    ]}
                  />
                ) : (
                  <>
                    <DialogHeader><DialogTitle className="text-foreground">إنشاء مهمة جديدة</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label className="text-foreground font-semibold">العنوان *</Label>
                        <Input placeholder="عنوان المهمة" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="mt-1 border-foreground/20" data-testid="input-task-title" />
                      </div>
                      <div>
                        <Label className="text-foreground font-semibold">الوصف</Label>
                        <Textarea placeholder="وصف تفصيلي للمهمة" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="mt-1 border-foreground/20 min-h-[80px]" data-testid="input-task-description" />
                      </div>
                      <div>
                        <Label className="text-foreground font-semibold">المسؤول عن التنفيذ</Label>
                        <Select disabled={usersLoading} value={formData.assignedTo} onValueChange={(v) => setFormData({ ...formData, assignedTo: v })}>
                          <SelectTrigger className="mt-1 border-foreground/20" data-testid="input-task-assignee"><SelectValue placeholder={usersLoading ? "جاري التحميل..." : "اختر الموظف المسؤول"} /></SelectTrigger>
                          <SelectContent dir="rtl">
                            <SelectItem value="none">بدون تعيين</SelectItem>
                            {departmentUsers.map((u) => (
                              <SelectItem key={u.id} value={String(u.id)}>{u.name}{u.jobTitle ? ` - ${u.jobTitle}` : ''}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-foreground font-semibold">الأولوية</Label>
                          <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                            <SelectTrigger className="mt-1 border-foreground/20" data-testid="select-priority"><SelectValue /></SelectTrigger>
                            <SelectContent dir="rtl">
                              <SelectItem value="urgent">عاجلة</SelectItem>
                              <SelectItem value="low">منخفضة</SelectItem>
                              <SelectItem value="medium">متوسطة</SelectItem>
                              <SelectItem value="high">عالية</SelectItem>
                              <SelectItem value="critical">حرجة</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-foreground font-semibold">الموعد النهائي</Label>
                          <Input type="date" value={formData.dueDate} onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })} className="mt-1 border-foreground/20" data-testid="input-due-date" />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => { setIsAddDialogOpen(false); resetForm(); }} data-testid="button-cancel-task">إلغاء</Button>
                      <Button
                        onClick={() => createTaskMutation.mutate(formData)}
                        disabled={createTaskMutation.isPending || !formData.title}
                        className="hub-btn-gold"
                        data-testid="button-create-task"
                      >
                        {createTaskMutation.isPending ? "جاري الإنشاء..." : "إنشاء المهمة"}
                      </Button>
                    </DialogFooter>
                  </>
                )}
              </DialogContent>
            </Dialog>
            </>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard label="إجمالي المهام" value={stats.total} icon={ClipboardList} color="navy" data-testid="stat-total" />
          <KpiCard label="نشطة" value={stats.active} icon={Zap} color="navy" data-testid="stat-active" />
          <KpiCard
            label="متأخرة" value={stats.overdue} icon={AlertTriangle}
            color={stats.overdue > 0 ? "danger" : "muted"} data-testid="stat-overdue"
          />
          <KpiCard
            label="مستحقة اليوم" value={stats.dueToday} icon={Timer}
            color={stats.dueToday > 0 ? "gold" : "muted"} data-testid="stat-due-today"
          />
          <KpiCard label="مكتملة" value={stats.completed} icon={CheckCheck} color="success" data-testid="stat-completed" />
          <KpiCard
            label="نسبة الإنجاز" value={`${stats.completionRate}%`} icon={Target}
            color="gold" data-testid="stat-completion-rate"
          />
        </div>

        <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
            <TabsList className="bg-white/5 border border-white/10 h-auto flex-wrap" data-testid="tabs-task-views">
              <TabsTrigger value="all" className="text-xs gap-1.5 data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900" data-testid="tab-all">
                <Inbox className="w-3.5 h-3.5" />الكل ({stats.total})
              </TabsTrigger>
              <TabsTrigger value="active" className="text-xs gap-1.5 data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900" data-testid="tab-active">
                <Zap className="w-3.5 h-3.5" />نشطة ({stats.active})
              </TabsTrigger>
              {stats.overdue > 0 && (
                <TabsTrigger value="overdue" className="text-xs gap-1.5 data-[state=active]:bg-red-600 data-[state=active]:text-white text-red-600" data-testid="tab-overdue">
                  <AlertTriangle className="w-3.5 h-3.5" />متأخرة ({stats.overdue})
                </TabsTrigger>
              )}
              {stats.dueToday > 0 && (
                <TabsTrigger value="today" className="text-xs gap-1.5 data-[state=active]:bg-[hsl(43_74%_49%)] data-[state=active]:text-foreground" data-testid="tab-today">
                  <Timer className="w-3.5 h-3.5" />اليوم ({stats.dueToday})
                </TabsTrigger>
              )}
              {stats.dueThisWeek > 0 && (
                <TabsTrigger value="week" className="text-xs gap-1.5 data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900" data-testid="tab-week">
                  <CalendarDays className="w-3.5 h-3.5" />هذا الأسبوع ({stats.dueThisWeek})
                </TabsTrigger>
              )}
              <TabsTrigger value="completed" className="text-xs gap-1.5 data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900" data-testid="tab-completed">
                <CheckCheck className="w-3.5 h-3.5" />مكتملة ({stats.completed})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <Card className="border-foreground/10">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute right-3 top-2.5 text-muted-foreground" />
                <Input
                  placeholder="بحث بالعنوان أو الوصف أو المسؤول..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-3 pr-10 border-foreground/20 h-9"
                  data-testid="input-search-tasks"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="border-foreground/20 h-9" data-testid="filter-status">
                  <ListFilter className="w-3.5 h-3.5 ml-2 text-muted-foreground" />
                  <SelectValue placeholder="الحالة" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="all">جميع الحالات</SelectItem>
                  <SelectItem value="open">مفتوح</SelectItem>
                  <SelectItem value="pending">في الانتظار</SelectItem>
                  <SelectItem value="assigned">إسناد</SelectItem>
                  <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
                  <SelectItem value="review">مراجعة</SelectItem>
                  <SelectItem value="completed">مكتمل</SelectItem>
                  <SelectItem value="cancelled">ملغي</SelectItem>
                  <SelectItem value="archived">مؤرشف</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="border-foreground/20 h-9" data-testid="filter-priority">
                  <ListFilter className="w-3.5 h-3.5 ml-2 text-muted-foreground" />
                  <SelectValue placeholder="الأولوية" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="all">جميع الأولويات</SelectItem>
                  <SelectItem value="urgent">عاجلة</SelectItem>
                  <SelectItem value="low">منخفضة</SelectItem>
                  <SelectItem value="medium">متوسطة</SelectItem>
                  <SelectItem value="high">عالية</SelectItem>
                  <SelectItem value="critical">حرجة</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {bulkMode && selectedIds.size > 0 && (
          <Card className="border-[hsl(43_74%_49%)]/30 bg-[hsl(43_74%_49%)]/5" data-testid="bulk-actions-bar">
            <CardContent className="p-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-sm font-medium text-foreground">
                  <CheckSquare className="w-4 h-4 inline ml-1 hub-stat-gold" />
                  تم تحديد {selectedIds.size} مهمة
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <Select onValueChange={(status) => {
                    confirmAction(() => bulkStatusMutation.mutate({ ids: Array.from(selectedIds), status }), {
                      title: 'تغيير الحالة الجماعي',
                      description: `هل تريد تغيير حالة ${selectedIds.size} مهمة؟`,
                    });
                  }}>
                    <SelectTrigger className="w-auto h-8 text-xs border-foreground/20" data-testid="bulk-status-select">
                      <SelectValue placeholder="تغيير الحالة" />
                    </SelectTrigger>
                    <SelectContent dir="rtl">
                      <SelectItem value="open">مفتوح</SelectItem>
                      <SelectItem value="pending">في الانتظار</SelectItem>
                      <SelectItem value="assigned">إسناد</SelectItem>
                      <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
                      <SelectItem value="review">مراجعة</SelectItem>
                      <SelectItem value="completed">مكتمل</SelectItem>
                      <SelectItem value="cancelled">ملغي</SelectItem>
                      <SelectItem value="archived">مؤرشف</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-foreground/10">
          <CardHeader className="pb-3 px-5 pt-4">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2 text-foreground">
                {bulkMode && (
                  <Checkbox
                    checked={filteredTasks.length > 0 && selectedIds.size === filteredTasks.length}
                    onCheckedChange={toggleSelectAll}
                    className="ml-1"
                    data-testid="checkbox-select-all"
                  />
                )}
                <Inbox className="w-5 h-5 hub-stat-gold" />
                المهام ({filteredTasks.length})
              </span>
              {filteredTasks.length !== tasks.length && (
                <span className="text-xs text-muted-foreground font-normal">
                  عرض {filteredTasks.length} من {tasks.length}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {isLoading ? (
              <div className="space-y-2.5">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="p-4 border border-border/60 rounded-lg bg-muted/10">
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3.5 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                      <Skeleton className="h-6 w-20 rounded-full shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredTasks.length === 0 ? (
              searchQuery || statusFilter !== "all" || priorityFilter !== "all" ? (
                <SearchEmptyState
                  query={searchQuery || "عوامل التصفية المحددة"}
                  onClear={() => { setSearchQuery(""); setStatusFilter("all"); setPriorityFilter("all"); }}
                />
              ) : (
                <EmptyState
                  icon={activeTab === "overdue" ? CheckCircle : Inbox}
                  title={
                    activeTab === "overdue" ? "لا توجد مهام متأخرة 🎉" :
                    activeTab === "today" ? "لا توجد مهام مستحقة اليوم" :
                    activeTab === "completed" ? "لا توجد مهام مكتملة بعد" : "لا توجد مهام"
                  }
                  description={
                    activeTab === "all" ? 'اضغط على "مهمة جديدة" لإنشاء أول مهمة' :
                    activeTab === "overdue" ? "رائع! جميع المهام منجزة في وقتها" : undefined
                  }
                />
              )
            ) : (
              <AnimatePresence>
              <div className="space-y-2">
                {filteredTasks.map((task, idx) => {
                  const overdue = isOverdue(task);
                  const statusConf = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
                  const priorityConf = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
                  const StatusIcon = statusConf.icon;
                  const isSelected = selectedIds.has(task.id);

                  const taskPriorityStripe =
                    task.priority === 'urgent' ? 'bg-red-600' :
                    task.priority === 'critical' ? 'bg-red-500' :
                    task.priority === 'high' ? 'bg-orange-400' :
                    task.priority === 'medium' ? 'bg-blue-400' :
                    'bg-foreground/10';

                  return (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.18, delay: Math.min(idx * 0.03, 0.25) }}
                      className={`relative pl-1.5 pr-4 py-4 border rounded-lg transition-all duration-200 group cursor-pointer overflow-hidden hover:shadow-md hover:-translate-y-px ${
                        isSelected
                          ? 'border-[hsl(43_74%_49%)]/40 bg-[hsl(43_74%_49%)]/[0.06]'
                          : overdue
                            ? 'border-foreground/15 bg-red-500/[0.03] hover:bg-red-500/[0.06]'
                            : 'border-foreground/10 hover:border-[hsl(43_74%_49%)]/25 hover:bg-[hsl(43_74%_49%)]/[0.03]'
                      }`}
                      onClick={() => bulkMode ? toggleSelect(task.id) : setDetailTask(task)}
                      data-testid={`task-item-${task.id}`}
                    >
                      <div className={`absolute inset-y-0 right-0 w-[3px] rounded-l-sm ${taskPriorityStripe}`} />
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          {bulkMode && (
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelect(task.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="mt-1 flex-shrink-0"
                              data-testid={`checkbox-task-${task.id}`}
                            />
                          )}
                          <div className={`mt-0.5 p-1.5 rounded-md flex-shrink-0 ${
                            overdue ? 'bg-red-500/10' : 'bg-foreground/5'
                          }`}>
                            <StatusIcon className={`w-4 h-4 ${overdue ? 'text-red-500' : 'text-foreground/60'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h3 className={`font-semibold text-sm truncate ${overdue ? 'text-red-700' : 'text-foreground'}`}>
                                {task.title}
                              </h3>
                              <Badge className={`${priorityConf.style} font-medium text-[10px] leading-tight`}>
                                {priorityConf.label}
                              </Badge>
                            </div>
                            {task.description && (
                              <p className="text-xs text-muted-foreground mb-2 line-clamp-1">{task.description}</p>
                            )}
                            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                              {task.assignedTo && (
                                <span className="flex items-center gap-1">
                                  <Users className="w-3 h-3" />{getUserName(task.assignedTo)}
                                </span>
                              )}
                              <DueDateIndicator task={task} />
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 items-end flex-shrink-0">
                          <Select
                            value={task.status}
                            onValueChange={(v) => {
                              updateStatusMutation.mutate({ id: task.id, status: v });
                            }}
                          >
                            <SelectTrigger
                              className="w-auto border-0 bg-transparent p-0 h-auto min-w-0 gap-0"
                              onClick={(e) => e.stopPropagation()}
                              data-testid={`select-status-${task.id}`}
                            >
                              <Badge className={`${statusConf.style} font-medium text-[10px] leading-tight cursor-pointer`}>
                                {statusConf.label}
                              </Badge>
                            </SelectTrigger>
                            <SelectContent dir="rtl">
                              <SelectItem value="pending">في الانتظار</SelectItem>
                              <SelectItem value="assigned">إسناد</SelectItem>
                              <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
                              <SelectItem value="review">مراجعة</SelectItem>
                              <SelectItem value="completed">مكتمل</SelectItem>
                              <SelectItem value="archived">مؤرشف</SelectItem>
                            </SelectContent>
                          </Select>
                          <div className="flex gap-1 invisible group-hover:visible">
                            <span className="cursor-pointer" onClick={(e) => e.stopPropagation()}>
                              <BookmarkButton
                                portal={config.departmentNameEn}
                                entityType="task"
                                entityId={task.id}
                                title={task.title}
                                priority={task.priority}
                                status={task.status}
                              />
                            </span>
                            <ReferralEscalationButtons
                              entityType="task"
                              entityId={task.id}
                              entityTitle={task.title}
                              currentDeptId={config.departmentId}
                              currentDeptName={config.departmentName}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={(e) => { e.stopPropagation(); handleEdit(task); }}
                              data-testid={`button-edit-${task.id}`}
                            >
                              <Edit2 className="w-3.5 h-3.5 text-foreground" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
              </AnimatePresence>
            )}
          </CardContent>
        </Card>

        <DepartmentReferralsSection departmentId={config.departmentId} departmentName={config.departmentName} />

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-lg" dir="rtl">
            <DialogHeader><DialogTitle className="text-foreground">تحديث المهمة</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-foreground font-semibold">العنوان</Label>
                <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="mt-1 border-foreground/20" data-testid="input-edit-title" />
              </div>
              <div>
                <Label className="text-foreground font-semibold">الوصف</Label>
                <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="mt-1 border-foreground/20 min-h-[80px]" data-testid="input-edit-description" />
              </div>
              <div>
                <Label className="text-foreground font-semibold">المسؤول</Label>
                <Select disabled={usersLoading} value={formData.assignedTo} onValueChange={(v) => setFormData({ ...formData, assignedTo: v })}>
                  <SelectTrigger className="mt-1 border-foreground/20" data-testid="input-edit-assignee"><SelectValue placeholder={usersLoading ? "جاري التحميل..." : "اختر الموظف المسؤول"} /></SelectTrigger>
                  <SelectContent dir="rtl">
                    <SelectItem value="none">بدون تعيين</SelectItem>
                    {departmentUsers.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>{u.name}{u.jobTitle ? ` - ${u.jobTitle}` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-foreground font-semibold">الأولوية</Label>
                  <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                    <SelectTrigger className="mt-1 border-foreground/20" data-testid="select-edit-priority"><SelectValue /></SelectTrigger>
                    <SelectContent dir="rtl">
                      <SelectItem value="urgent">عاجلة</SelectItem>
                      <SelectItem value="low">منخفضة</SelectItem>
                      <SelectItem value="medium">متوسطة</SelectItem>
                      <SelectItem value="high">عالية</SelectItem>
                      <SelectItem value="critical">حرجة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-foreground font-semibold">الموعد النهائي</Label>
                  <Input type="date" value={formData.dueDate} onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })} className="mt-1 border-foreground/20" data-testid="input-edit-due-date" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsEditDialogOpen(false); setEditingTask(null); resetForm(); }} data-testid="button-cancel-edit-task">إلغاء</Button>
              <Button
                onClick={() => editingTask && updateTaskMutation.mutate({ id: editingTask.id, updates: formData })}
                disabled={updateTaskMutation.isPending}
                className="hub-btn-gold"
                data-testid="button-update-task"
              >
                {updateTaskMutation.isPending ? "جاري التحديث..." : "تحديث"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!detailTask} onOpenChange={(open) => !open && setDetailTask(null)}>
          <DialogContent className="max-w-lg" dir="rtl">
            {detailTask && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-foreground text-lg">{detailTask.title}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Badge className={`${(STATUS_CONFIG[detailTask.status] || STATUS_CONFIG.pending).style} font-medium`}>
                      {(STATUS_CONFIG[detailTask.status] || STATUS_CONFIG.pending).label}
                    </Badge>
                    <Badge className={`${(PRIORITY_CONFIG[detailTask.priority] || PRIORITY_CONFIG.medium).style} font-medium`}>
                      {(PRIORITY_CONFIG[detailTask.priority] || PRIORITY_CONFIG.medium).label}
                    </Badge>
                    {isOverdue(detailTask) && (
                      <Badge className="bg-red-500/15 text-red-700 border border-red-500/30">
                        <AlertTriangle className="w-3 h-3 ml-1" />متأخرة
                      </Badge>
                    )}
                  </div>

                  {detailTask.description && (
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">الوصف</Label>
                      <p className="text-sm text-foreground bg-muted/10 p-3 rounded-md border border-muted/20">
                        {detailTask.description}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    {(detailTask.assignedTo != null) && (
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">المسؤول</Label>
                        <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-muted-foreground" />{getUserName(detailTask.assignedTo)}
                        </p>
                      </div>
                    )}
                    {detailTask.assignedBy && (
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">المُسند</Label>
                        <p className="text-sm font-medium text-foreground">{detailTask.assignedBy}</p>
                      </div>
                    )}
                    {detailTask.dueDate && (
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">الموعد النهائي</Label>
                        <DueDateIndicator task={detailTask} />
                      </div>
                    )}
                    {detailTask.createdDate && (
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">تاريخ الإنشاء</Label>
                        <p className="text-sm text-foreground">
                          {new Date(detailTask.createdDate).toLocaleDateString('ar-SA')}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-muted/20 pt-4">
                    <Label className="text-xs text-muted-foreground mb-2 block">تغيير الحالة</Label>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(STATUS_CONFIG).map(([key, conf]) => {
                        const active = detailTask.status === key;
                        const Icon = conf.icon;
                        return (
                          <Button
                            key={key}
                            variant={active ? "default" : "outline"}
                            size="sm"
                            className={active ? "hub-btn-gold" : ""}
                            onClick={() => {
                              if (!active) {
                                updateStatusMutation.mutate({ id: detailTask.id, status: key });
                                setDetailTask({ ...detailTask, status: key });
                              }
                            }}
                            data-testid={`detail-status-${key}`}
                          >
                            <Icon className="w-3.5 h-3.5 ml-1.5" />
                            {conf.label}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDetailTask(null)} data-testid="button-close-detail">إغلاق</Button>
                  <Button
                    variant="outline"
                    onClick={() => { handleEdit(detailTask); setDetailTask(null); }}
                    data-testid="button-detail-edit"
                  >
                    <Edit2 className="w-4 h-4 ml-2" />تعديل
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        <ConfirmDialog {...dialogProps} />
        <ExternalImportDialog
          open={isImportOpen}
          onOpenChange={setIsImportOpen}
          departmentId={config.departmentId}
          departmentName={config.departmentName}
          targetType="tasks"
          invalidateKey={`/api/tasks/it-department/${config.departmentId}`}
        />
      </div>
    </DashboardLayout>
  );
}
