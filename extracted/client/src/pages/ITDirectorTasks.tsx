import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, invalidateRelatedQueries } from "@/lib/queryClient";
import DashboardLayout from "@/components/DashboardLayout";
import { itDirectorNavGroups } from "@/lib/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import {
  Plus, Search, Filter, Server, Shield, Smartphone, Headphones, Database,
  CheckCircle2, Clock, AlertTriangle, XCircle, Play, LayoutGrid, List,
  Mail, Sparkles, RefreshCw, Calendar,
  User, Flag, KanbanSquare, Loader2, ChevronDown,
  Zap, Target, TrendingUp, Eye, Edit, SendHorizontal, X, Pencil,
  ClipboardPaste, BarChart3, Timer, CheckCheck, ChevronRight, Download
} from "lucide-react";
import { IT_DEPARTMENTS_LIST } from "@/lib/permissions";
import { ExternalImportDialog } from "@/components/ExternalImportDialog";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────
interface DirectorTask {
  id: number;
  title: string;
  description: string | null;
  departmentId: number | null;
  assignedTo: number | null;
  assignedBy: number | null;
  priority: string;
  status: string;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  isEscalated: boolean;
  notes: string | null;
  estimatedHours: number | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
  assignerName: string | null;
}

interface OverviewResponse {
  tasks: DirectorTask[];
  byDept: Record<number, { total: number; pending: number; inProgress: number; completed: number; overdue: number; cancelled: number }>;
  total: number;
}

interface DeptUser {
  id: number;
  name: string;
  email: string;
  role: string;
  jobTitle: string | null;
}

interface PlannerTask {
  id: number;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  progress: number;
  dueDate: string | null;
  assignedTo: number | null;
  assigneeName: string | null;
  boardId: number;
  bucketId: number;
}

// ─── Constants ────────────────────────────────────────────────
const DEPTS = IT_DEPARTMENTS_LIST;
const DEPT_MAP: Record<number, typeof IT_DEPARTMENTS_LIST[0]> = {};
for (const d of DEPTS) DEPT_MAP[d.id] = d;

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  pending:     { label: 'قيد الانتظار',  icon: <Clock className="w-3.5 h-3.5" />,       color: 'text-amber-600 dark:text-amber-400',  bg: 'bg-amber-500/10' },
  assigned:    { label: 'مُعيَّنة',       icon: <User className="w-3.5 h-3.5" />,        color: 'text-blue-600 dark:text-blue-400',    bg: 'bg-blue-500/10' },
  in_progress: { label: 'قيد التنفيذ',   icon: <Play className="w-3.5 h-3.5" />,        color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-500/10' },
  completed:   { label: 'مكتملة',        icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
  cancelled:   { label: 'ملغاة',         icon: <XCircle className="w-3.5 h-3.5" />,     color: 'text-gray-500',                       bg: 'bg-gray-500/10' },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  urgent:   { label: 'عاجلة',   color: 'text-red-700 dark:text-red-300 font-semibold', dot: 'bg-red-600' },
  critical: { label: 'حرجة',    color: 'text-red-600 dark:text-red-400',       dot: 'bg-red-500' },
  high:     { label: 'عالية',   color: 'text-orange-600 dark:text-orange-400', dot: 'bg-orange-500' },
  medium:   { label: 'متوسطة',  color: 'text-amber-600 dark:text-amber-400',   dot: 'bg-amber-500' },
  low:      { label: 'منخفضة',  color: 'text-gray-500',                        dot: 'bg-gray-400' },
};

const DEPT_ICONS: Record<number, React.ReactNode> = {
  9: <Server className="w-4 h-4" />,
  10: <Shield className="w-4 h-4" />,
  11: <Smartphone className="w-4 h-4" />,
  12: <Headphones className="w-4 h-4" />,
  5: <Database className="w-4 h-4" />,
};

function daysUntil(date: string) {
  const diff = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
  return diff;
}

function getInitials(name: string) {
  const p = (name || '').split(' ');
  return p.length > 1 ? p[0][0] + p[1][0] : (name || '?').substring(0, 2);
}

// ─── Smart Email Parser ───────────────────────────────────────
function parseEmailToTask(text: string) {
  const result: { title: string; description: string; priority: string; departmentId: string; dueDate: string } = {
    title: '', description: '', priority: 'medium', departmentId: '', dueDate: '',
  };

  // Extract subject as title
  const subjectMatch = text.match(/(?:الموضوع|Subject|موضوع|RE:|FW:)[:\s]*(.+)/i);
  if (subjectMatch) result.title = subjectMatch[1].replace(/^(RE:|FW:)\s*/i, '').trim();

  // Extract body as description
  const bodyMatch = text.match(/(?:المحتوى|Body|الرسالة|المتن|Dear|مرحبا|أخي|عزيزي)[\s\S]*/i);
  result.description = bodyMatch ? bodyMatch[0].substring(0, 500).trim() : text.substring(0, 300).trim();

  // Detect priority
  if (/عاجل|urgent|مستعجل/i.test(text)) result.priority = 'urgent';
  else if (/أولوية عالية|high priority|critical|حرج/i.test(text)) result.priority = 'critical';
  else if (/عادي|normal|منخفض|low/i.test(text)) result.priority = 'low';

  // Detect department
  if (/بنية تحتية|infrastructure|شبكة|network|server|خادم/i.test(text)) result.departmentId = '9';
  else if (/أمن|cyber|security|سيبران|هجوم/i.test(text)) result.departmentId = '10';
  else if (/تحول رقمي|digital|تطبيق|application|برنامج/i.test(text)) result.departmentId = '11';
  else if (/دعم|support|مساعدة|help|عطل|تقنية/i.test(text)) result.departmentId = '12';
  else if (/بيانات|data|dmo/i.test(text)) result.departmentId = '5';

  // Detect date
  const dateMatch = text.match(/(?:الموعد|التاريخ|deadline|due|بتاريخ|قبل)\s*[:،]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/i);
  if (dateMatch) {
    try {
      const d = new Date(dateMatch[1].replace(/[\/\.]/g, '-'));
      if (!isNaN(d.getTime())) result.dueDate = d.toISOString().split('T')[0];
    } catch {}
  }

  if (!result.title) {
    const firstLine = text.split('\n').find(l => l.trim().length > 5);
    result.title = firstLine?.trim().substring(0, 100) || '';
  }

  return result;
}

// ─── Main Component ───────────────────────────────────────────
export default function ITDirectorTasks() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Filters
  const [activeDept, setActiveDept] = useState<number | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [activeTab, setActiveTab] = useState<'tasks' | 'planner'>('tasks');

  // Create task dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [emailParserOpen, setEmailParserOpen] = useState(false);
  const [detailTask, setDetailTask] = useState<DirectorTask | null>(null);
  const [emailText, setEmailText] = useState('');
  const [sendToPlannerTask, setSendToPlannerTask] = useState<PlannerTask | null>(null);
  const [selectedDeptForPlanner, setSelectedDeptForPlanner] = useState('');

  const [editingItem, setEditingItem] = useState<any>(null);

  const [form, setForm] = useState({
    title: '', description: '', departmentId: '', assignedTo: '',
    priority: 'medium', dueDate: '', notes: '', estimatedHours: '',
    sendEmail: true,
  });

  // ─── Queries ─────────────────────────────────────────────────
  const { data: overview, isLoading } = useQuery<OverviewResponse>({
    queryKey: ['/api/director/tasks/overview'],
  });

  const { data: deptUsers = [] } = useQuery<DeptUser[]>({
    queryKey: ['/api/director/users/by-department', form.departmentId],
    queryFn: async () => {
      const res = await fetch(`/api/director/users/by-department?departmentId=${form.departmentId}`, {
        headers: { 'Authorization': `Bearer ${sessionStorage.getItem('_cht')}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!form.departmentId && createOpen,
  });

  const { data: plannerTasksList = [] } = useQuery<PlannerTask[]>({
    queryKey: ['/api/director/planner/tasks'],
    enabled: activeTab === 'planner',
  });

  // ─── Mutations ───────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await apiRequest('POST', '/api/tasks', {
        title: data.title,
        description: data.description || null,
        departmentId: parseInt(data.departmentId),
        assignedTo: data.assignedTo ? parseInt(data.assignedTo) : null,
        priority: data.priority,
        dueDate: data.dueDate || null,
        notes: data.notes || null,
        estimatedHours: data.estimatedHours ? parseInt(data.estimatedHours) : null,
        sendEmail: data.sendEmail,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '✅ تم إنشاء المهمة', description: `تم إنشاء "${form.title}" وإرسالها للإدارة` });
      queryClient.invalidateQueries({ queryKey: ['/api/director/tasks/overview'] });
      setCreateOpen(false);
      resetForm();
    },
    onError: (error: Error) => toast({ title: 'خطأ', description: error.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await apiRequest('PATCH', `/api/tasks/${editingItem?.id}`, {
        title: data.title,
        description: data.description || null,
        departmentId: parseInt(data.departmentId),
        assignedTo: data.assignedTo ? parseInt(data.assignedTo) : null,
        priority: data.priority,
        dueDate: data.dueDate || null,
        notes: data.notes || null,
        estimatedHours: data.estimatedHours ? parseInt(data.estimatedHours) : null,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '✅ تم تحديث المهمة', description: `تم تحديث "${form.title}" بنجاح` });
      queryClient.invalidateQueries({ queryKey: ['/api/director/tasks/overview'] });
      setCreateOpen(false);
      setEditingItem(null);
      resetForm();
    },
    onError: (error: Error) => toast({ title: 'خطأ', description: error.message, variant: 'destructive' }),
  });

  const sendToDeptMutation = useMutation({
    mutationFn: async ({ id, deptId }: { id: number; deptId: number }) => {
      const res = await apiRequest('POST', `/api/planner/tasks/${id}/send-to-tasks`, { targetDepartmentId: deptId });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '✅ تم النقل', description: 'تم نقل المهمة من البلانر إلى مهام الإدارة' });
      queryClient.invalidateQueries({ queryKey: ['/api/director/tasks/overview'] });
      setSendToPlannerTask(null);
    },
    onError: (error: Error) => toast({ title: 'خطأ', description: error.message, variant: 'destructive' }),
  });

  // ─── Helpers ─────────────────────────────────────────────────
  const resetForm = () => { setForm({ title: '', description: '', departmentId: '', assignedTo: '', priority: 'medium', dueDate: '', notes: '', estimatedHours: '', sendEmail: true }); setEditingItem(null); };

  const applyEmailParse = () => {
    if (!emailText.trim()) return;
    const parsed = parseEmailToTask(emailText);
    setForm(p => ({ ...p, ...parsed }));
    setEmailParserOpen(false);
    setEmailText('');
    setCreateOpen(true);
    toast({ title: '✨ تم الاستخراج الذكي', description: 'تم تعبئة بيانات المهمة من الإيميل' });
  };

  // ─── Filtered tasks ──────────────────────────────────────────
  const allTasks = overview?.tasks || [];
  const filteredTasks = useMemo(() => {
    return allTasks.filter(t => {
      if (activeDept !== 'all' && t.departmentId !== activeDept) return false;
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      if (searchTerm && !t.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !t.assigneeName?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [allTasks, activeDept, statusFilter, priorityFilter, searchTerm]);

  const byDept = overview?.byDept || {};

  // Stats
  const totalAll = allTasks.length;
  const completedAll = allTasks.filter(t => t.status === 'completed').length;
  const overdueAll = allTasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'completed' && t.status !== 'cancelled').length;
  const inProgressAll = allTasks.filter(t => t.status === 'in_progress').length;

  // ─── Render helpers ──────────────────────────────────────────
  function TaskStatusBadge({ status }: { status: string }) {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG['pending'];
    return (
      <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full", cfg.bg, cfg.color)}>
        {cfg.icon}{cfg.label}
      </span>
    );
  }

  function PriorityDot({ priority }: { priority: string }) {
    const cfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG['medium'];
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px]">
        <span className={cn("w-2 h-2 rounded-full flex-shrink-0", cfg.dot)} />
        <span className={cfg.color}>{cfg.label}</span>
      </span>
    );
  }

  function DueDateBadge({ date }: { date: string | null }) {
    if (!date) return <span className="text-xs text-muted-foreground">—</span>;
    const d = daysUntil(date);
    const formatted = new Date(date).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' });
    if (d < 0) return <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400 font-medium"><AlertTriangle className="w-3 h-3" />متأخر {Math.abs(d)}د</span>;
    if (d === 0) return <span className="inline-flex items-center gap-1 text-xs text-orange-500 font-medium"><Timer className="w-3 h-3" />اليوم</span>;
    if (d <= 3) return <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium"><Calendar className="w-3 h-3" />{d}أيام</span>;
    return <span className="text-xs text-muted-foreground">{formatted}</span>;
  }

  return (
    <DashboardLayout navGroups={itDirectorNavGroups} title="مهام مركزية" portalName="مدير تقنية المعلومات">
      <div className="p-4 md:p-6 space-y-5" dir="rtl">

        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">المهام المركزية</h1>
            <p className="text-sm text-muted-foreground mt-0.5">رؤية شاملة وكاملة لجميع مهام الإدارات</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setEmailParserOpen(true)} className="gap-2" data-testid="button-email-parse">
              <Sparkles className="w-4 h-4 text-purple-500" />قراءة إيميل ذكية
            </Button>
            <Button variant="outline" onClick={() => setIsImportOpen(true)} className="gap-2" data-testid="button-import-tasks">
              <Download className="w-4 h-4" />استيراد
            </Button>
            <Button onClick={() => { resetForm(); setCreateOpen(true); }} className="gap-2" data-testid="button-create-task">
              <Plus className="w-4 h-4" />مهمة جديدة
            </Button>
          </div>
        </div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'إجمالي المهام', value: totalAll, icon: <ClipboardPaste className="w-5 h-5" />, color: 'text-blue-500', bg: 'bg-blue-500/10' },
            { label: 'قيد التنفيذ', value: inProgressAll, icon: <Play className="w-5 h-5" />, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
            { label: 'مكتملة', value: completedAll, icon: <CheckCheck className="w-5 h-5" />, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
            { label: 'متأخرة', value: overdueAll, icon: <AlertTriangle className="w-5 h-5" />, color: 'text-red-500', bg: 'bg-red-500/10' },
          ].map(({ label, value, icon, color, bg }) => (
            <Card key={label} className="border-0 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", bg)}>
                  <span className={color}>{icon}</span>
                </div>
                <div>
                  <p className="text-2xl font-bold">{isLoading ? '—' : value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Dept Summary Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {DEPTS.map(dept => {
            const s = byDept[dept.id] || { total: 0, pending: 0, inProgress: 0, completed: 0, overdue: 0, cancelled: 0 };
            const pct = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
            return (
              <Card
                key={dept.id}
                className={cn("cursor-pointer border-2 transition-all", activeDept === dept.id ? 'border-primary shadow-md' : 'border-transparent hover:border-border')}
                onClick={() => setActiveDept(activeDept === dept.id ? 'all' : dept.id)}
                data-testid={`dept-card-${dept.id}`}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: dept.color + '20' }}>
                      <span style={{ color: dept.color }}>{DEPT_ICONS[dept.id]}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate leading-tight">{dept.nameAr.replace('إدارة ', '')}</p>
                    </div>
                  </div>
                  <div className="flex items-end justify-between gap-1">
                    <div>
                      <p className="text-xl font-bold">{s.total}</p>
                      <p className="text-[10px] text-muted-foreground">مهمة</p>
                    </div>
                    <div className="text-left space-y-0.5">
                      {s.overdue > 0 && <p className="text-[10px] text-red-500 font-medium">{s.overdue} متأخرة</p>}
                      <p className="text-[10px] text-emerald-600">{s.completed} مكتملة</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>الإنجاز</span><span>{pct}%</span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* ── Tabs: Tasks vs Planner ── */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="tasks" className="gap-2 text-sm" data-testid="tab-director-tasks">
                <ClipboardPaste className="w-4 h-4" />مهام الإدارات
              </TabsTrigger>
              <TabsTrigger value="planner" className="gap-2 text-sm" data-testid="tab-director-planner">
                <KanbanSquare className="w-4 h-4" />البلانر
              </TabsTrigger>
            </TabsList>

            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute right-3 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="بحث..." className="pr-9 h-9 w-44" data-testid="input-task-search" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-32 text-xs" data-testid="select-status-filter">
                  <SelectValue placeholder="الحالة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الحالات</SelectItem>
                  <SelectItem value="pending">قيد الانتظار</SelectItem>
                  <SelectItem value="assigned">مُعيَّنة</SelectItem>
                  <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
                  <SelectItem value="completed">مكتملة</SelectItem>
                  <SelectItem value="cancelled">ملغاة</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="h-9 w-32 text-xs" data-testid="select-priority-filter">
                  <SelectValue placeholder="الأولوية" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الأولويات</SelectItem>
                  <SelectItem value="urgent">عاجلة</SelectItem>
                  <SelectItem value="critical">حرجة</SelectItem>
                  <SelectItem value="high">عالية</SelectItem>
                  <SelectItem value="medium">متوسطة</SelectItem>
                  <SelectItem value="low">منخفضة</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1 border rounded-lg p-0.5">
                <button onClick={() => setViewMode('table')} className={cn("p-1.5 rounded-md transition-colors", viewMode === 'table' ? 'bg-background shadow-sm' : 'hover:bg-muted/50')} data-testid="button-view-table">
                  <List className="w-4 h-4" />
                </button>
                <button onClick={() => setViewMode('cards')} className={cn("p-1.5 rounded-md transition-colors", viewMode === 'cards' ? 'bg-background shadow-sm' : 'hover:bg-muted/50')} data-testid="button-view-cards">
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* ── TASKS TAB ── */}
          <TabsContent value="tasks" className="mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" /><span>جاري تحميل المهام...</span>
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <Target className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="font-medium">لا توجد مهام</p>
                <p className="text-sm mt-1">جرّب تعديل الفلاتر أو أنشئ مهمة جديدة</p>
              </div>
            ) : viewMode === 'table' ? (
              /* ─ TABLE VIEW ─ */
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        {['المهمة', 'الإدارة', 'المُكلَّف', 'الأولوية', 'الحالة', 'الموعد', ''].map(h => (
                          <th key={h} className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTasks.map((t, i) => {
                        const dept = DEPT_MAP[t.departmentId || 0];
                        return (
                          <tr key={t.id} className={cn("border-b last:border-0 hover:bg-muted/20 transition-colors cursor-pointer", i % 2 === 0 ? '' : 'bg-muted/10')} onClick={() => setDetailTask(t)} data-testid={`row-task-${t.id}`}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {t.isEscalated && <Zap className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                                <div>
                                  <p className="font-medium text-sm line-clamp-1 max-w-[260px]">{t.title}</p>
                                  {t.description && <p className="text-[11px] text-muted-foreground line-clamp-1 max-w-[240px]">{t.description}</p>}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {dept ? (
                                <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: dept.color + '15', color: dept.color }}>
                                  {DEPT_ICONS[dept.id]}<span className="font-medium">{dept.code}</span>
                                </span>
                              ) : <span className="text-xs text-muted-foreground">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              {t.assigneeName ? (
                                <div className="flex items-center gap-1.5">
                                  <Avatar className="w-6 h-6"><AvatarFallback className="text-[9px] bg-primary/10">{getInitials(t.assigneeName)}</AvatarFallback></Avatar>
                                  <span className="text-xs">{t.assigneeName}</span>
                                </div>
                              ) : <span className="text-xs text-muted-foreground">—</span>}
                            </td>
                            <td className="px-4 py-3"><PriorityDot priority={t.priority} /></td>
                            <td className="px-4 py-3"><TaskStatusBadge status={t.status} /></td>
                            <td className="px-4 py-3"><DueDateBadge date={t.dueDate} /></td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <button onClick={e => { e.stopPropagation(); setEditingItem(t); setForm({ title: t.title, description: t.description || '', departmentId: String(t.departmentId || ''), assignedTo: t.assignedTo ? String(t.assignedTo) : '', priority: t.priority, dueDate: t.dueDate ? t.dueDate.split('T')[0] : '', notes: t.notes || '', estimatedHours: t.estimatedHours ? String(t.estimatedHours) : '', sendEmail: false }); setCreateOpen(true); }} className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" data-testid={`button-edit-task-${t.id}`}>
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={e => { e.stopPropagation(); setDetailTask(t); }} className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-3 bg-muted/20 border-t text-xs text-muted-foreground">
                  {filteredTasks.length} مهمة
                  {activeDept !== 'all' && ` • ${DEPT_MAP[activeDept]?.nameAr}`}
                </div>
              </Card>
            ) : (
              /* ─ CARD VIEW ─ */
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredTasks.map(t => {
                  const dept = DEPT_MAP[t.departmentId || 0];
                  return (
                    <Card key={t.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setDetailTask(t)} data-testid={`card-task-${t.id}`}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1">
                              {t.isEscalated && <Zap className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                              {dept && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-sm" style={{ backgroundColor: dept.color + '15', color: dept.color }}>{dept.code}</span>}
                            </div>
                            <p className="font-semibold text-sm line-clamp-2">{t.title}</p>
                            {t.description && <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1">{t.description}</p>}
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={e => { e.stopPropagation(); setEditingItem(t); setForm({ title: t.title, description: t.description || '', departmentId: String(t.departmentId || ''), assignedTo: t.assignedTo ? String(t.assignedTo) : '', priority: t.priority, dueDate: t.dueDate ? t.dueDate.split('T')[0] : '', notes: t.notes || '', estimatedHours: t.estimatedHours ? String(t.estimatedHours) : '', sendEmail: false }); setCreateOpen(true); }} className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" data-testid={`button-edit-card-task-${t.id}`}>
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <PriorityDot priority={t.priority} />
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <TaskStatusBadge status={t.status} />
                          <DueDateBadge date={t.dueDate} />
                        </div>
                        {t.assigneeName && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Avatar className="w-5 h-5"><AvatarFallback className="text-[8px] bg-primary/10">{getInitials(t.assigneeName)}</AvatarFallback></Avatar>
                            {t.assigneeName}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ── PLANNER TAB ── */}
          <TabsContent value="planner" className="mt-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">مهام البلانر — يمكنك سحبها وإرسالها إلى أي إدارة كمهام رسمية</p>
            </div>
            {plannerTasksList.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <KanbanSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="font-medium">لا توجد مهام في البلانر</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {plannerTasksList.map(pt => (
                  <Card key={pt.id} className="hover:shadow-md transition-shadow" data-testid={`card-planner-${pt.id}`}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <Badge variant="secondary" className="text-[9px] mb-1.5">البلانر</Badge>
                          <p className="font-semibold text-sm line-clamp-2">{pt.title}</p>
                          {pt.description && <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1">{pt.description}</p>}
                        </div>
                        <PriorityDot priority={pt.priority} />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-muted-foreground">{pt.progress}% اكتمال</span>
                        <DueDateBadge date={pt.dueDate} />
                      </div>
                      {pt.progress > 0 && <Progress value={pt.progress} className="h-1.5" />}
                      {pt.assigneeName && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Avatar className="w-5 h-5"><AvatarFallback className="text-[8px] bg-primary/10">{getInitials(pt.assigneeName)}</AvatarFallback></Avatar>
                          {pt.assigneeName}
                        </div>
                      )}
                      <Separator />
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full gap-2 text-xs"
                        onClick={() => setSendToPlannerTask(pt)}
                        data-testid={`button-planner-send-${pt.id}`}
                      >
                        <SendHorizontal className="w-3.5 h-3.5" />إرسال إلى إدارة
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* ──────────────────────────────────────────────────────── */}
        {/* CREATE TASK DIALOG                                       */}
        {/* ──────────────────────────────────────────────────────── */}
        <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) { resetForm(); } }}>
          <DialogContent className="max-w-2xl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {editingItem ? <><Pencil className="w-5 h-5 text-primary" />تعديل المهمة</> : <><Plus className="w-5 h-5 text-primary" />إنشاء مهمة جديدة</>}
              </DialogTitle>
            </DialogHeader>
            <DialogBody className="space-y-4">
              <div className="space-y-1.5">
                <Label>عنوان المهمة <span className="text-red-500">*</span></Label>
                <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="عنوان واضح ومحدد للمهمة" data-testid="input-task-title" />
              </div>
              <div className="space-y-1.5">
                <Label>الوصف</Label>
                <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="تفاصيل إضافية عن المهمة..." rows={3} data-testid="input-task-description" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>الإدارة <span className="text-red-500">*</span></Label>
                  <Select value={form.departmentId} onValueChange={v => setForm(p => ({ ...p, departmentId: v, assignedTo: '' }))}>
                    <SelectTrigger data-testid="select-task-dept">
                      <SelectValue placeholder="اختر الإدارة" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPTS.map(d => (
                        <SelectItem key={d.id} value={String(d.id)}>
                          <span className="flex items-center gap-2">{DEPT_ICONS[d.id]}{d.nameAr.replace('إدارة ', '')}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>تعيين إلى</Label>
                  <Select value={form.assignedTo} onValueChange={v => setForm(p => ({ ...p, assignedTo: v }))} disabled={!form.departmentId || deptUsers.length === 0}>
                    <SelectTrigger data-testid="select-task-assignee">
                      <SelectValue placeholder={!form.departmentId ? 'اختر إدارة أولاً' : deptUsers.length === 0 ? 'لا يوجد موظفون' : 'اختر موظفاً'} />
                    </SelectTrigger>
                    <SelectContent>
                      {deptUsers.map(u => (
                        <SelectItem key={u.id} value={String(u.id)}>
                          {u.name} {u.jobTitle ? `— ${u.jobTitle}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>الأولوية</Label>
                  <Select value={form.priority} onValueChange={v => setForm(p => ({ ...p, priority: v }))}>
                    <SelectTrigger data-testid="select-task-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="urgent"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />عاجلة</span></SelectItem>
                      <SelectItem value="critical"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />حرجة</span></SelectItem>
                      <SelectItem value="high"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />عالية</span></SelectItem>
                      <SelectItem value="medium"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />متوسطة</span></SelectItem>
                      <SelectItem value="low"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />منخفضة</span></SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>الموعد النهائي</Label>
                  <Input type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} data-testid="input-task-duedate" dir="ltr" />
                </div>
                <div className="space-y-1.5">
                  <Label>الساعات المقدرة</Label>
                  <Input type="number" value={form.estimatedHours} onChange={e => setForm(p => ({ ...p, estimatedHours: e.target.value }))} placeholder="مثل: 8" min="1" data-testid="input-task-hours" />
                </div>
                <div className="space-y-1.5">
                  <Label>ملاحظات</Label>
                  <Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="ملاحظات إضافية..." data-testid="input-task-notes" />
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border">
                <input type="checkbox" id="sendEmail" checked={form.sendEmail} onChange={e => setForm(p => ({ ...p, sendEmail: e.target.checked }))} className="w-4 h-4" data-testid="checkbox-task-email" />
                <label htmlFor="sendEmail" className="text-sm cursor-pointer flex items-center gap-2"><Mail className="w-4 h-4 text-blue-500" />إرسال إشعار بريد إلكتروني للمُكلَّف</label>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setCreateOpen(false); resetForm(); }}>إلغاء</Button>
              <Button
                onClick={() => editingItem ? updateMutation.mutate(form) : createMutation.mutate(form)}
                disabled={(editingItem ? updateMutation.isPending : createMutation.isPending) || !form.title.trim() || !form.departmentId}
                className="gap-2"
                data-testid="button-submit-task"
              >
                {(editingItem ? updateMutation.isPending : createMutation.isPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : editingItem ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {editingItem ? 'تحديث المهمة' : 'إنشاء المهمة'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ──────────────────────────────────────────────────────── */}
        {/* EMAIL SMART PARSER DIALOG                               */}
        {/* ──────────────────────────────────────────────────────── */}
        <Dialog open={emailParserOpen} onOpenChange={setEmailParserOpen}>
          <DialogContent className="max-w-2xl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-500" />القراءة الذكية للإيميل
              </DialogTitle>
            </DialogHeader>
            <DialogBody className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                <Sparkles className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-purple-700 dark:text-purple-300">الصق نص الإيميل هنا وسيتم تحليله تلقائياً لاستخراج: العنوان، الوصف، الأولوية، الإدارة المعنية، والموعد النهائي.</p>
              </div>
              <div className="space-y-1.5">
                <Label>نص الإيميل</Label>
                <Textarea
                  value={emailText}
                  onChange={e => setEmailText(e.target.value)}
                  placeholder={`الموضوع: طلب مراجعة أمنية عاجلة\n\nعزيزي المدير،\n\nنحتاج إلى مراجعة أمنية عاجلة للخوادم قبل تاريخ 15/03/2026...\n\nمع التحية`}
                  rows={10}
                  className="font-mono text-sm"
                  data-testid="textarea-email-content"
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Sparkles className="w-3.5 h-3.5" />
                يكتشف تلقائياً: الأولوية (عاجل/حرج)، الإدارة (بنية تحتية/أمن/دعم/...)، التاريخ
              </div>
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEmailParserOpen(false)}>إلغاء</Button>
              <Button onClick={applyEmailParse} disabled={!emailText.trim()} className="gap-2" data-testid="button-parse-email">
                <Sparkles className="w-4 h-4" />تحليل وتعبئة المهمة
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ──────────────────────────────────────────────────────── */}
        {/* TASK DETAIL SLIDE PANEL                                 */}
        {/* ──────────────────────────────────────────────────────── */}
        {detailTask && (
          <div className="fixed inset-0 z-50 flex" dir="rtl">
            <div className="flex-1 bg-black/40 backdrop-blur-sm cursor-pointer" onClick={() => setDetailTask(null)} />
            <div className="w-full max-w-md bg-background border-r shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
              {/* Panel Header */}
              <div className="flex items-center justify-between p-5 border-b bg-muted/20">
                <div className="flex items-center gap-2">
                  {detailTask.isEscalated && <Badge variant="destructive" className="text-[10px]"><Zap className="w-3 h-3 ml-1" />مصعَّدة</Badge>}
                  <span className="text-xs text-muted-foreground">#{detailTask.id}</span>
                </div>
                <button onClick={() => setDetailTask(null)} className="p-1.5 rounded-md hover:bg-muted transition-colors"><X className="w-4 h-4" /></button>
              </div>

              {/* Panel Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                <div>
                  <h2 className="text-lg font-bold leading-snug">{detailTask.title}</h2>
                  {detailTask.description && <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{detailTask.description}</p>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'الحالة', value: <TaskStatusBadge status={detailTask.status} /> },
                    { label: 'الأولوية', value: <PriorityDot priority={detailTask.priority} /> },
                    { label: 'الإدارة', value: (() => { const d = DEPT_MAP[detailTask.departmentId || 0]; return d ? <span className="inline-flex items-center gap-1 text-xs" style={{ color: d.color }}>{DEPT_ICONS[d.id]}{d.code}</span> : '—'; })() },
                    { label: 'الموعد', value: <DueDateBadge date={detailTask.dueDate} /> },
                  ].map(({ label, value }) => (
                    <div key={label} className="p-3 rounded-lg bg-muted/30 border space-y-1">
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
                      <div className="text-sm">{value}</div>
                    </div>
                  ))}
                </div>

                {detailTask.assigneeName && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 border">
                    <Avatar className="w-9 h-9"><AvatarFallback className="bg-primary/10 text-sm font-bold">{getInitials(detailTask.assigneeName)}</AvatarFallback></Avatar>
                    <div>
                      <p className="text-sm font-semibold">{detailTask.assigneeName}</p>
                      <p className="text-[11px] text-muted-foreground">{detailTask.assigneeEmail || 'المُكلَّف بالمهمة'}</p>
                    </div>
                  </div>
                )}

                {detailTask.notes && (
                  <div className="p-3 rounded-lg border bg-amber-500/5">
                    <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 mb-1">ملاحظات</p>
                    <p className="text-sm text-muted-foreground">{detailTask.notes}</p>
                  </div>
                )}

                {detailTask.estimatedHours && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Timer className="w-4 h-4" />{detailTask.estimatedHours} ساعة مقدَّرة
                  </div>
                )}

                <div className="text-[11px] text-muted-foreground space-y-0.5">
                  <p>تم الإنشاء: {new Date(detailTask.createdAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  {detailTask.assignerName && <p>بواسطة: {detailTask.assignerName}</p>}
                </div>
              </div>

              {/* Panel Footer */}
              <div className="p-4 border-t flex items-center gap-2">
                <Button size="sm" className="flex-1 gap-2" onClick={() => { setDetailTask(null); }} data-testid="button-close-detail">
                  إغلاق
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ──────────────────────────────────────────────────────── */}
        {/* SEND PLANNER TASK TO DEPT DIALOG                        */}
        {/* ──────────────────────────────────────────────────────── */}
        <Dialog open={!!sendToPlannerTask} onOpenChange={() => setSendToPlannerTask(null)}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <SendHorizontal className="w-5 h-5 text-blue-500" />إرسال إلى إدارة
              </DialogTitle>
            </DialogHeader>
            <DialogBody className="space-y-4">
              {sendToPlannerTask && (
                <div className="p-3 rounded-lg bg-muted/30 border">
                  <p className="text-sm font-semibold">{sendToPlannerTask.title}</p>
                  {sendToPlannerTask.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{sendToPlannerTask.description}</p>}
                </div>
              )}
              <div className="space-y-1.5">
                <Label>الإدارة المستهدفة <span className="text-red-500">*</span></Label>
                <Select value={selectedDeptForPlanner} onValueChange={setSelectedDeptForPlanner}>
                  <SelectTrigger data-testid="select-planner-send-dept">
                    <SelectValue placeholder="اختر الإدارة" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPTS.map(d => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        <span className="flex items-center gap-2">{DEPT_ICONS[d.id]}{d.nameAr.replace('إدارة ', '')}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSendToPlannerTask(null)}>إلغاء</Button>
              <Button
                disabled={!selectedDeptForPlanner || sendToDeptMutation.isPending}
                onClick={() => {
                  if (sendToPlannerTask && selectedDeptForPlanner) {
                    sendToDeptMutation.mutate({ id: sendToPlannerTask.id, deptId: parseInt(selectedDeptForPlanner) });
                  }
                }}
                className="gap-2"
                data-testid="button-confirm-planner-send"
              >
                {sendToDeptMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendHorizontal className="w-4 h-4" />}
                إرسال
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ExternalImportDialog
          open={isImportOpen}
          onOpenChange={setIsImportOpen}
          departmentId={0}
          departmentName="مدير تقنية المعلومات"
          targetType="tasks"
          invalidateKey="/api/director/tasks/overview"
        />
      </div>
    </DashboardLayout>
  );
}
