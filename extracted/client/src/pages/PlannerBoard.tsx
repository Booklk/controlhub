import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, getQueryFn, invalidateRelatedQueries } from "@/lib/queryClient";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import {
  Plus, Search, Filter, Calendar, Clock, User, Users,
  MoreHorizontal, CheckCircle2, Circle, Timer, AlertCircle,
  Trash2, ChevronLeft, Eye, MessageSquare, Send,
  FolderKanban, BarChart3, Target, CheckSquare, Square,
  Flag, Tag, ClipboardCheck, ShieldCheck, UserCheck,
  TrendingUp, ArrowUpDown, Layers, X,
  Paperclip, Copy, Repeat, Link2, AlertTriangle, Bell, Mail,
  Calendar as CalendarIcon, Upload, ChevronDown, GanttChart,
  FileDown, FileSpreadsheet, Printer, FileBarChart2, ArrowLeftRight, Building2
} from "lucide-react";
import { IT_DEPARTMENTS_LIST } from "@/lib/permissions";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { LoadingButton } from "@/components/LoadingButton";
import WorkloadHeatmap from "@/components/planner/WorkloadHeatmap";
import BurndownChart from "@/components/planner/BurndownChart";
import ActivityFeed from "@/components/planner/ActivityFeed";
import FocusTimer from "@/components/planner/FocusTimer";
import BoardTemplates, { BOARD_TEMPLATES, type BoardTemplate } from "@/components/planner/BoardTemplates";
import { Flame, Activity, Heart, LayoutTemplate } from "lucide-react";
import { KpiCard } from "@/components/Quality";
import { ConfirmDialog, useConfirmDialog } from "@/components/ConfirmDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { exportToPDF, exportToExcel } from "@/lib/exports";
import type { NavGroup } from "@/lib/navigation";

interface PlannerTask {
  id: number;
  boardId: number;
  bucketId: number;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  progress: number;
  assignedTo: number | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
  createdBy: number | null;
  creatorName?: string | null;
  dueDate: string | null;
  startDate: string | null;
  completedAt: string | null;
  labels: string[] | null;
  checklist: { text: string; checked: boolean }[] | null;
  sortOrder: number;
  boardTitle?: string;
  boardColor?: string;
  bucketTitle?: string;
  createdAt: string;
  updatedAt: string;
  dependencies: number[] | null;
  recurrence: { type: string; interval: number; daysOfWeek?: number[] } | null;
  attachments: { name: string; size: number; type: string; url?: string }[] | null;
  isTemplate: number;
}

interface TimelineTask {
  id: number;
  title: string;
  status: string;
  startDate: string | null;
  dueDate: string | null;
  assigneeName: string | null;
  dependencies: number[] | null;
}

interface OverdueTasksData {
  overdue: PlannerTask[];
  approaching: PlannerTask[];
}

interface PlannerBucket {
  id: number;
  boardId: number;
  title: string;
  sortOrder: number;
  color: string | null;
  tasks: PlannerTask[];
}

interface PlannerBoardData {
  id: number;
  title: string;
  description: string | null;
  portal: string;
  color: string | null;
  buckets: PlannerBucket[];
}

interface BoardListItem {
  id: number;
  title: string;
  description: string | null;
  portal: string;
  color: string | null;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  bucketsCount: number;
}

interface TaskComment {
  id: number;
  taskId: number;
  userId: number | null;
  content: string;
  type: string;
  userName: string | null;
  createdAt: string;
}

interface MemberStat {
  name: string;
  total: number;
  completed: number;
  overdue: number;
  inProgress: number;
  notStarted: number;
  pendingApproval: number;
  open: number;
}

interface ChartData {
  totalTasks: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  byMember: MemberStat[];
  completionRate: number;
}

interface TeamData {
  tasks: PlannerTask[];
  members: { id: number; name: string; email: string; tasksCount: number; completedCount: number; overdueCount: number }[];
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  urgent: { label: 'عاجل', color: 'bg-red-500/15 text-red-700 dark:text-red-400' },
  high: { label: 'عالي', color: 'bg-orange-500/15 text-orange-700 dark:text-orange-400' },
  medium: { label: 'متوسط', color: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' },
  low: { label: 'منخفض', color: 'bg-slate-500/15 text-slate-600 dark:text-slate-400' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Circle }> = {
  not_started: { label: 'لم تبدأ', color: 'text-slate-400', icon: Circle },
  in_progress: { label: 'قيد التنفيذ', color: 'text-blue-500', icon: Timer },
  pending_approval: { label: 'بانتظار الموافقة', color: 'text-amber-500', icon: ClipboardCheck },
  completed: { label: 'مكتملة', color: 'text-emerald-500', icon: CheckCircle2 },
};

const LABEL_COLORS = [
  { name: 'تطوير', color: 'bg-violet-500/20 text-violet-700 dark:text-violet-400' },
  { name: 'تصميم', color: 'bg-pink-500/20 text-pink-700 dark:text-pink-400' },
  { name: 'اختبار', color: 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-400' },
  { name: 'توثيق', color: 'bg-amber-500/20 text-amber-700 dark:text-amber-400' },
  { name: 'أمان', color: 'bg-red-500/20 text-red-700 dark:text-red-400' },
  { name: 'بنية تحتية', color: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' },
  { name: 'تحليل', color: 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-400' },
  { name: 'مراجعة', color: 'bg-teal-500/20 text-teal-700 dark:text-teal-400' },
];

const MANAGER_ROLES = ['admin', 'system_admin', 'it_director', 'it_cybersecurity_manager', 'it_infrastructure_manager', 'it_digital_manager', 'it_support_manager', 'dmo_manager'];

function getLabelStyle(label: string) {
  return LABEL_COLORS.find(l => l.name === label)?.color || 'bg-muted text-muted-foreground';
}

function getInitials(name: string | null) {
  if (!name) return '?';
  const parts = name.split(' ');
  return parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].substring(0, 2);
}

function formatDate(date: string | null) {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return `متأخر ${Math.abs(days)} يوم`;
  if (days === 0) return 'اليوم';
  if (days === 1) return 'غداً';
  return d.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' });
}

function isOverdue(date: string | null, status: string) {
  if (!date || status === 'completed') return false;
  return new Date(date) < new Date();
}

function timeAgo(date: string) {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  return `منذ ${days} يوم`;
}

interface Props {
  portal: string;
  navGroups: NavGroup[];
  departmentId?: number;
}

export default function PlannerBoard({ portal, navGroups, departmentId }: Props) {
  const { toast } = useToast();
  const { user, token } = useAuth();
  const isManager = MANAGER_ROLES.includes(user?.role || '');
  const isEmployee = user?.role === 'employee';
  const canCreateContent = isManager || isEmployee;
  const authHeaders = useMemo(() => ({ 'Authorization': `Bearer ${token}` }), [token]);
  const [activeTab, setActiveTab] = useState("board");
  const [selectedBoardId, setSelectedBoardId] = useState<number | null>(null);
  const [isCreateBoardOpen, setIsCreateBoardOpen] = useState(false);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);
  const [isCreateBucketOpen, setIsCreateBucketOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<PlannerTask | null>(null);
  const [targetBucketId, setTargetBucketId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [myTasksGroupBy, setMyTasksGroupBy] = useState<"status" | "board" | "priority">("status");
  const [myTasksSearch, setMyTasksSearch] = useState('');
  const [myTasksStatusFilter, setMyTasksStatusFilter] = useState<string>('active');
  const [myTasksSortBy, setMyTasksSortBy] = useState<'smart' | 'dueDate' | 'priority' | 'created'>('smart');
  const [draggedTask, setDraggedTask] = useState<PlannerTask | null>(null);
  const [dragOverBucket, setDragOverBucket] = useState<number | null>(null);
  const [commentText, setCommentText] = useState('');
  const [memberFilter, setMemberFilter] = useState("all");

  const [newBoard, setNewBoard] = useState({ title: '', description: '', color: '#1e3a5f', templateBuckets: [] as string[] });
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(true);
  const [newTask, setNewTask] = useState({
    title: '', description: '', priority: 'medium', assignedTo: '', dueDate: '', startDate: '', labels: [] as string[],
    checklist: [] as { text: string; checked: boolean }[],
  });
  const [newBucket, setNewBucket] = useState({ title: '', color: '#6366f1' });
  const [newCheckItem, setNewCheckItem] = useState('');

  const [dateFilterStart, setDateFilterStart] = useState('');
  const [dateFilterEnd, setDateFilterEnd] = useState('');
  const [labelFilter, setLabelFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showOverdueBanner, setShowOverdueBanner] = useState(false);

  const [recurrenceEnabled, setRecurrenceEnabled] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState('daily');
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);

  const [dependencySelect, setDependencySelect] = useState('');
  const [taskDependencies, setTaskDependencies] = useState<number[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportDateFrom, setReportDateFrom] = useState('');
  const [reportDateTo, setReportDateTo] = useState('');
  const [reportInclude, setReportInclude] = useState({ tasks: true, members: true, overdue: true, boards: true });

  const [memberReportSort, setMemberReportSort] = useState<{ col: keyof MemberStat; dir: 'asc' | 'desc' }>({ col: 'total', dir: 'desc' });
  const [memberReportSearch, setMemberReportSearch] = useState('');
  const [inlineTaskBucketId, setInlineTaskBucketId] = useState<number | null>(null);
  const [inlineTaskTitle, setInlineTaskTitle] = useState('');
  const inlineTaskRef = useRef<HTMLInputElement>(null);

  // Send to department tasks
  const [isSendToTasksOpen, setIsSendToTasksOpen] = useState(false);
  const [sendToTasksData, setSendToTasksData] = useState({ targetDepartmentId: '', notes: '' });

  // Task detail panel state
  const [taskDetailTab, setTaskDetailTab] = useState('details');
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState('');
  const [editDescValue, setEditDescValue] = useState('');
  const [detailProgress, setDetailProgress] = useState(0);

  // Smart priority suggestion for create form
  const [smartSuggestion, setSmartSuggestion] = useState<{ priority: string; category: string; confidence: number } | null>(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [dateWarning, setDateWarning] = useState('');

  const isItDirector = user?.role === 'it_director' || user?.role === 'system_admin';
  const portalParam = encodeURIComponent(portal);

  const safeFetch = useCallback(async (url: string, opts?: RequestInit) => {
    const res = await fetch(url, { ...opts, headers: { ...authHeaders, ...opts?.headers }, credentials: 'include' });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Request failed: ${res.status}`);
    }
    return res.json();
  }, [authHeaders]);
  const { data: boards = [], isLoading: loadingBoards } = useQuery<BoardListItem[]>({
    queryKey: ['/api/planner/boards', portal],
    queryFn: () => safeFetch(`/api/planner/boards?portal=${portalParam}`),
  });

  const { data: boardData, isLoading: loadingBoard } = useQuery<PlannerBoardData>({
    queryKey: ['/api/planner/boards', selectedBoardId],
    queryFn: () => safeFetch(`/api/planner/boards/${selectedBoardId}`),
    enabled: !!selectedBoardId,
  });

  const { data: myTasks = [], isLoading: loadingMyTasks } = useQuery<PlannerTask[]>({
    queryKey: ['/api/planner/my-tasks', portal],
    queryFn: () => safeFetch(`/api/planner/my-tasks?portal=${portalParam}`),
    enabled: activeTab === 'my-tasks',
  });

  const { data: chartData } = useQuery<ChartData>({
    queryKey: ['/api/planner/charts', portal],
    queryFn: () => safeFetch(`/api/planner/charts?portal=${portalParam}`),
    enabled: activeTab === 'charts' || activeTab === 'reports',
  });

  const { data: teamData } = useQuery<TeamData>({
    queryKey: ['/api/planner/team-tasks', portal],
    queryFn: () => safeFetch(`/api/planner/team-tasks?portal=${portalParam}`),
    enabled: activeTab === 'members' && isManager,
  });

  const { data: taskComments = [] } = useQuery<TaskComment[]>({
    queryKey: ['/api/planner/tasks', selectedTask?.id, 'comments'],
    queryFn: () => safeFetch(`/api/planner/tasks/${selectedTask?.id}/comments`),
    enabled: !!selectedTask?.id && isTaskDetailOpen,
  });

  const { data: portalUsers = [] } = useQuery<any[]>({
    queryKey: ['/api/planner/portal-users', portal],
    queryFn: () => safeFetch(`/api/planner/portal-users?portal=${portalParam}`),
  });

  const { data: overdueData } = useQuery<OverdueTasksData>({
    queryKey: ['/api/planner/overdue-tasks', portal],
    queryFn: () => safeFetch(`/api/planner/overdue-tasks?portal=${portalParam}`).catch(() => ({ overdue: [], approaching: [] })),
  });

  const { data: timelineData = [] } = useQuery<TimelineTask[]>({
    queryKey: ['/api/planner/timeline', selectedBoardId],
    queryFn: () => safeFetch(`/api/planner/timeline?boardId=${selectedBoardId}&portal=${portalParam}`).catch(() => []),
    enabled: activeTab === 'timeline' && !!selectedBoardId,
  });

  const { data: workloadData, isLoading: workloadLoading } = useQuery({
    queryKey: ['/api/planner/workload', portal],
    queryFn: () => safeFetch(`/api/planner/workload?portal=${portalParam}`),
    enabled: activeTab === 'workload',
  });

  const { data: burndownData, isLoading: burndownLoading } = useQuery({
    queryKey: ['/api/planner/burndown', portal],
    queryFn: () => safeFetch(`/api/planner/burndown?portal=${portalParam}`),
    enabled: activeTab === 'burndown',
  });

  const { data: activityData, isLoading: activityLoading } = useQuery({
    queryKey: ['/api/planner/activity', portal],
    queryFn: () => safeFetch(`/api/planner/activity?portal=${portalParam}`),
    enabled: activeTab === 'activity',
  });

  const invalidatePlanner = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/planner/boards', selectedBoardId] });
    queryClient.invalidateQueries({ queryKey: ['/api/planner/boards'] });
    queryClient.invalidateQueries({ queryKey: ['/api/planner/my-tasks'] });
    queryClient.invalidateQueries({ queryKey: ['/api/planner/charts'] });
    queryClient.invalidateQueries({ queryKey: ['/api/planner/team-tasks'] });
    queryClient.invalidateQueries({ queryKey: ['/api/planner/overdue-tasks'] });
    queryClient.invalidateQueries({ queryKey: ['/api/planner/timeline'] });
    queryClient.invalidateQueries({ queryKey: ['/api/planner/workload'] });
    queryClient.invalidateQueries({ queryKey: ['/api/planner/burndown'] });
    queryClient.invalidateQueries({ queryKey: ['/api/planner/activity'] });
    invalidateRelatedQueries('/api/planner/tasks');
  }, [selectedBoardId]);

  // ─── Report Helpers ─────────────────────────────────────────────────────────
  const reportDeptLabels: Record<string, string> = {
    infrastructure: 'البنية التحتية',
    cybersecurity: 'الأمن السيبراني',
    digital_transformation: 'التحول الرقمي',
    support: 'الدعم الفني',
    dmo: 'إدارة البيانات',
    committee: 'اللجان',
    admin: 'الإدارة',
    it_director: 'مدير تقنية المعلومات',
  };

  const statusLabels: Record<string, string> = {
    not_started: 'لم تبدأ',
    in_progress: 'قيد التنفيذ',
    pending_approval: 'بانتظار الموافقة',
    completed: 'مكتملة',
  };

  const priorityLabels: Record<string, string> = {
    urgent: 'عاجل', critical: 'حرج', high: 'عالي', medium: 'متوسط', low: 'منخفض',
  };

  // Collect ALL tasks from all available data sources
  const getAllTasks = useCallback((): PlannerTask[] => {
    const allTasks: PlannerTask[] = [];
    if (teamData?.tasks) allTasks.push(...teamData.tasks);
    else if (boardData?.buckets) {
      boardData.buckets.forEach(b => allTasks.push(...b.tasks));
    }
    if (myTasks?.length) {
      myTasks.forEach(t => { if (!allTasks.find(x => x.id === t.id)) allTasks.push(t); });
    }
    if (overdueData?.overdue) {
      overdueData.overdue.forEach(t => { if (!allTasks.find(x => x.id === t.id)) allTasks.push(t); });
    }
    // filter by date range if set
    return allTasks.filter(t => {
      if (reportDateFrom && t.dueDate && t.dueDate < reportDateFrom) return false;
      if (reportDateTo && t.dueDate && t.dueDate > reportDateTo) return false;
      return true;
    });
  }, [teamData, boardData, myTasks, overdueData, reportDateFrom, reportDateTo]);

  const handleGeneratePDFReport = useCallback(async () => {
    setIsGeneratingReport(true);
    try {
      const allTasks = getAllTasks();
      const deptName = reportDeptLabels[portal] || portal;
      const managerName = user?.name || 'المدير';
      const now = new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });

      // Stats
      const total = allTasks.length;
      const completed = allTasks.filter(t => t.status === 'completed').length;
      const inProgress = allTasks.filter(t => t.status === 'in_progress').length;
      const overdue = allTasks.filter(t => isOverdue(t.dueDate, t.status)).length;
      const notStarted = allTasks.filter(t => t.status === 'not_started').length;
      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

      // Section 1: Summary
      const summaryData = [
        { metric: 'إجمالي المهام', value: String(total), icon: '📋' },
        { metric: 'مكتملة', value: `${completed} (${completionRate}%)`, icon: '✅' },
        { metric: 'قيد التنفيذ', value: String(inProgress), icon: '🔄' },
        { metric: 'لم تبدأ', value: String(notStarted), icon: '⏳' },
        { metric: 'متأخرة', value: String(overdue), icon: '🚨' },
        { metric: 'معدل الإنجاز', value: `${completionRate}%`, icon: '📈' },
      ];

      // Section 2: Tasks list
      const tasksData = allTasks.map(t => ({
        title: t.title,
        status: statusLabels[t.status] || t.status,
        priority: priorityLabels[t.priority] || t.priority,
        assignee: t.assigneeName || '—',
        dueDate: t.dueDate ? new Date(t.dueDate).toLocaleDateString('ar-SA') : '—',
        overdue: isOverdue(t.dueDate, t.status) ? '⚠️ متأخرة' : '—',
        board: boards.find(b => b.id === t.boardId)?.title || '—',
      }));

      // Section 3: Members performance
      const membersData: { name: string; total: number; completed: number; inProgress: number; overdue: number; rate: string }[] = [];
      if (teamData?.members?.length) {
        teamData.members.forEach(m => {
          membersData.push({
            name: m.name,
            total: m.tasksCount,
            completed: m.completedCount,
            inProgress: m.tasksCount - m.completedCount - m.overdueCount,
            overdue: m.overdueCount,
            rate: m.tasksCount > 0 ? `${Math.round((m.completedCount / m.tasksCount) * 100)}%` : '0%',
          });
        });
      } else {
        // Build from tasks
        const memberMap: Record<string, { name: string; total: number; completed: number; overdue: number }> = {};
        allTasks.forEach(t => {
          if (!t.assigneeName) return;
          if (!memberMap[t.assigneeName]) memberMap[t.assigneeName] = { name: t.assigneeName, total: 0, completed: 0, overdue: 0 };
          memberMap[t.assigneeName].total++;
          if (t.status === 'completed') memberMap[t.assigneeName].completed++;
          if (isOverdue(t.dueDate, t.status)) memberMap[t.assigneeName].overdue++;
        });
        Object.values(memberMap).forEach(m => {
          membersData.push({
            ...m,
            inProgress: m.total - m.completed - m.overdue,
            rate: m.total > 0 ? `${Math.round((m.completed / m.total) * 100)}%` : '0%',
          });
        });
      }

      // Generate multi-section PDF
      await exportToPDF({
        title: `تقرير أداء إدارة ${deptName}`,
        subtitle: `المدير: ${managerName} | تاريخ التقرير: ${now}`,
        columns: [
          { header: 'المؤشر', key: 'metric', width: 50 },
          { header: 'القيمة', key: 'value', width: 30 },
        ],
        data: summaryData,
        filename: `planner-report-${portal}-${new Date().toISOString().slice(0, 10)}`,
        orientation: 'landscape',
      });

      // Generate tasks PDF
      if (reportInclude.tasks && tasksData.length > 0) {
        await exportToPDF({
          title: `تفاصيل المهام — إدارة ${deptName}`,
          subtitle: `الفترة: ${reportDateFrom || 'الكل'} — ${reportDateTo || 'الكل'} | إجمالي: ${total} مهمة`,
          columns: [
            { header: 'المهمة', key: 'title', width: 55 },
            { header: 'الحالة', key: 'status', width: 25 },
            { header: 'الأولوية', key: 'priority', width: 20 },
            { header: 'المكلف', key: 'assignee', width: 35 },
            { header: 'الاستحقاق', key: 'dueDate', width: 25 },
            { header: 'تأخر', key: 'overdue', width: 15 },
            { header: 'اللوحة', key: 'board', width: 30 },
          ],
          data: tasksData,
          filename: `planner-tasks-${portal}-${new Date().toISOString().slice(0, 10)}`,
          orientation: 'landscape',
        });
      }

      // Generate members PDF
      if (reportInclude.members && membersData.length > 0) {
        await exportToPDF({
          title: `أداء الموظفين — إدارة ${deptName}`,
          subtitle: `عدد الموظفين: ${membersData.length} | معدل الإنجاز الكلي: ${completionRate}%`,
          columns: [
            { header: 'اسم الموظف', key: 'name', width: 50 },
            { header: 'إجمالي المهام', key: 'total', width: 25 },
            { header: 'مكتملة', key: 'completed', width: 20 },
            { header: 'قيد التنفيذ', key: 'inProgress', width: 20 },
            { header: 'متأخرة', key: 'overdue', width: 20 },
            { header: 'معدل الإنجاز', key: 'rate', width: 25 },
          ],
          data: membersData,
          filename: `planner-members-${portal}-${new Date().toISOString().slice(0, 10)}`,
          orientation: 'portrait',
        });
      }

      toast({ title: 'تم إنشاء التقارير بنجاح', description: `${[reportInclude.tasks, reportInclude.members].filter(Boolean).length + 1} ملفات PDF تم تحميلها` });
      setIsReportDialogOpen(false);
    } catch (err) {
      toast({ title: 'خطأ في إنشاء التقرير', variant: 'destructive' });
    } finally {
      setIsGeneratingReport(false);
    }
  }, [getAllTasks, portal, user, boards, teamData, reportInclude, reportDateFrom, reportDateTo, toast]);

  const handleGenerateExcelReport = useCallback(async () => {
    setIsGeneratingReport(true);
    try {
      const allTasks = getAllTasks();
      const deptName = reportDeptLabels[portal] || portal;

      const tasksData = allTasks.map(t => ({
        id: t.id,
        title: t.title,
        status: statusLabels[t.status] || t.status,
        priority: priorityLabels[t.priority] || t.priority,
        assignee: t.assigneeName || '—',
        dueDate: t.dueDate ? new Date(t.dueDate).toLocaleDateString('ar-SA') : '—',
        startDate: t.startDate ? new Date(t.startDate).toLocaleDateString('ar-SA') : '—',
        overdue: isOverdue(t.dueDate, t.status) ? 'نعم' : 'لا',
        progress: t.progress ?? 0,
        board: boards.find(b => b.id === t.boardId)?.title || '—',
      }));

      await exportToExcel({
        title: `تقرير مهام إدارة ${deptName}`,
        columns: [
          { header: '#', key: 'id' },
          { header: 'عنوان المهمة', key: 'title' },
          { header: 'الحالة', key: 'status' },
          { header: 'الأولوية', key: 'priority' },
          { header: 'المكلف', key: 'assignee' },
          { header: 'تاريخ البدء', key: 'startDate' },
          { header: 'تاريخ الاستحقاق', key: 'dueDate' },
          { header: 'متأخرة؟', key: 'overdue' },
          { header: 'نسبة الإنجاز', key: 'progress' },
          { header: 'اللوحة', key: 'board' },
        ],
        data: tasksData,
        filename: `planner-report-${portal}-${new Date().toISOString().slice(0, 10)}`,
      });

      toast({ title: 'تم تصدير التقرير بنجاح', description: `${allTasks.length} مهمة تم تصديرها` });
      setIsReportDialogOpen(false);
    } catch (err) {
      toast({ title: 'خطأ في التصدير', variant: 'destructive' });
    } finally {
      setIsGeneratingReport(false);
    }
  }, [getAllTasks, portal, boards, toast]);
  // ─────────────────────────────────────────────────────────────────────────────
  const confirmDelete = useConfirmDialog();

  const createBoardMutation = useMutation({
    mutationFn: (data: typeof newBoard) =>
      apiRequest('POST', '/api/planner/boards', { ...data, portal, departmentId }),
    onSuccess: () => {
      invalidatePlanner();
      setIsCreateBoardOpen(false);
      setNewBoard({ title: '', description: '', color: '#1e3a5f', templateBuckets: [] });
      setSelectedTemplate(null);
      setShowTemplates(true);
      toast({ title: 'تم إنشاء اللوحة بنجاح' });
    },
    onError: () => { toast({ title: 'خطأ في إنشاء اللوحة', variant: 'destructive' }); },
  });

  const createTaskMutation = useMutation({
    mutationFn: (data: any) => {
      if (!data.title?.trim()) throw new Error('العنوان مطلوب');
      if (!data.bucketId) throw new Error('يجب اختيار المجموعة');
      if (data.startDate && data.dueDate && data.dueDate < data.startDate) throw new Error('تاريخ الاستحقاق يجب أن يكون بعد تاريخ البداية');
      return apiRequest('POST', '/api/planner/tasks', data);
    },
    onSuccess: () => {
      invalidatePlanner();
      setIsCreateTaskOpen(false);
      setNewTask({ title: '', description: '', priority: 'medium', assignedTo: '', dueDate: '', startDate: '', labels: [], checklist: [] });
      setRecurrenceEnabled(false);
      setRecurrenceType('daily');
      setRecurrenceInterval(1);
      setRecurrenceDays([]);
      setSmartSuggestion(null);
      setDateWarning('');
      toast({ title: 'تم إنشاء المهمة بنجاح' });
    },
    onError: (err: any) => {
      toast({ title: err?.message || 'خطأ في إنشاء المهمة', variant: 'destructive' });
    },
  });

  const inlineCreateMutation = useMutation({
    mutationFn: (data: { title: string; bucketId: number; boardId: number }) =>
      apiRequest('POST', '/api/planner/tasks', { ...data, priority: 'medium', status: 'not_started' }),
    onSuccess: () => {
      invalidatePlanner();
      setInlineTaskTitle('');
      setInlineTaskBucketId(null);
    },
    onError: () => { toast({ title: 'خطأ في إنشاء المهمة', variant: 'destructive' }); },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest('PUT', `/api/planner/tasks/${id}`, data),
    onSuccess: () => {
      invalidatePlanner();
    },
    onError: () => { toast({ title: 'خطأ في تحديث المهمة', variant: 'destructive' }); },
  });

  const moveTaskMutation = useMutation({
    mutationFn: ({ id, bucketId }: { id: number; bucketId: number }) =>
      apiRequest('PUT', `/api/planner/tasks/${id}/move`, { bucketId }),
    onMutate: async ({ id, bucketId }) => {
      await queryClient.cancelQueries({ queryKey: ['/api/planner/boards', selectedBoardId] });
      const prev = queryClient.getQueryData<PlannerBoardData>(['/api/planner/boards', selectedBoardId]);
      if (prev) {
        let movedTask: any = null;
        for (const b of prev.buckets) {
          const found = b.tasks.find(t => t.id === id);
          if (found) { movedTask = { ...found, bucketId }; break; }
        }
        if (movedTask) {
          const updated = { ...prev, buckets: prev.buckets.map(b => ({
            ...b,
            tasks: b.id === bucketId
              ? [...b.tasks.filter(t => t.id !== id), movedTask]
              : b.tasks.filter(t => t.id !== id)
          }))};
          queryClient.setQueryData(['/api/planner/boards', selectedBoardId], updated);
        }
      }
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(['/api/planner/boards', selectedBoardId], context.prev);
      toast({ title: 'خطأ في نقل المهمة', variant: 'destructive' });
    },
    onSettled: () => invalidatePlanner(),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/planner/tasks/${id}`),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['/api/planner/boards', selectedBoardId] });
      const prev = queryClient.getQueryData<PlannerBoardData>(['/api/planner/boards', selectedBoardId]);
      if (prev) {
        queryClient.setQueryData(['/api/planner/boards', selectedBoardId], {
          ...prev,
          buckets: prev.buckets.map(b => ({ ...b, tasks: b.tasks.filter(t => t.id !== id) }))
        });
      }
      return { prev };
    },
    onError: (_err, _id, context) => {
      if (context?.prev) queryClient.setQueryData(['/api/planner/boards', selectedBoardId], context.prev);
      toast({ title: 'خطأ في حذف المهمة', variant: 'destructive' });
    },
    onSettled: () => invalidatePlanner(),
    onSuccess: () => {
      setIsTaskDetailOpen(false);
      toast({ title: 'تم حذف المهمة' });
    },
  });

  const deleteBoardMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/planner/boards/${id}`),
    onSuccess: () => {
      invalidatePlanner();
      setSelectedBoardId(null);
      toast({ title: 'تم حذف اللوحة' });
    },
    onError: () => { toast({ title: 'خطأ في حذف اللوحة', variant: 'destructive' }); },
  });

  const createBucketMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/planner/buckets', data),
    onSuccess: () => {
      invalidatePlanner();
      setIsCreateBucketOpen(false);
      setNewBucket({ title: '', color: '#6366f1' });
      toast({ title: 'تم إنشاء المجموعة' });
    },
    onError: () => { toast({ title: 'خطأ في إنشاء المجموعة', variant: 'destructive' }); },
  });

  const deleteBucketMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/planner/buckets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/planner/boards', selectedBoardId] });
      toast({ title: 'تم حذف المجموعة' });
    },
    onError: () => { toast({ title: 'خطأ في حذف المجموعة', variant: 'destructive' }); },
  });

  const addCommentMutation = useMutation({
    mutationFn: ({ taskId, content }: { taskId: number; content: string }) =>
      apiRequest('POST', `/api/planner/tasks/${taskId}/comments`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/planner/tasks', selectedTask?.id, 'comments'] });
      setCommentText('');
    },
    onError: () => { toast({ title: 'خطأ في إضافة التعليق', variant: 'destructive' }); },
  });

  const duplicateTaskMutation = useMutation({
    mutationFn: (id: number) => apiRequest('POST', `/api/planner/tasks/${id}/duplicate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/planner/boards', selectedBoardId] });
      queryClient.invalidateQueries({ queryKey: ['/api/planner/my-tasks'] });
      toast({ title: 'تم نسخ المهمة بنجاح' });
    },
    onError: () => { toast({ title: 'خطأ في نسخ المهمة', variant: 'destructive' }); },
  });

  const saveTemplateMutation = useMutation({
    mutationFn: (id: number) => apiRequest('POST', `/api/planner/tasks/${id}/save-template`),
    onSuccess: () => { toast({ title: 'تم حفظ القالب بنجاح' }); },
    onError: () => { toast({ title: 'خطأ في حفظ القالب', variant: 'destructive' }); },
  });

  const notifyMutation = useMutation({
    mutationFn: ({ id, type }: { id: number; type: string }) =>
      apiRequest('POST', `/api/planner/tasks/${id}/notify`, { type }),
    onSuccess: () => { toast({ title: 'تم إرسال الإشعار بنجاح' }); },
    onError: () => { toast({ title: 'خطأ في إرسال الإشعار', variant: 'destructive' }); },
  });

  const sendToTasksMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: number; targetDepartmentId: string; notes: string }) =>
      apiRequest('POST', `/api/planner/tasks/${id}/send-to-tasks`, data),
    onSuccess: () => {
      setIsSendToTasksOpen(false);
      setSendToTasksData({ targetDepartmentId: '', notes: '' });
      const deptName = IT_DEPARTMENTS_LIST.find(d => String(d.id) === sendToTasksData.targetDepartmentId)?.nameAr || 'الإدارة المستهدفة';
      toast({
        title: '✅ تم نقل المهمة',
        description: `المهمة الآن في صفحة مهام ${deptName} وجاهزة للإحالة`
      });
    },
    onError: () => toast({ title: 'خطأ في نقل المهمة', variant: 'destructive' }),
  });

  const uploadAttachmentMutation = useMutation({
    mutationFn: async ({ id, file }: { id: number; file: File }) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/planner/tasks/${id}/attachments`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        credentials: 'include',
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/planner/boards', selectedBoardId] });
      toast({ title: 'تم رفع المرفق بنجاح' });
    },
    onError: () => { toast({ title: 'خطأ في رفع المرفق', variant: 'destructive' }); },
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: ({ id, index }: { id: number; index: number }) =>
      apiRequest('DELETE', `/api/planner/tasks/${id}/attachments/${index}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/planner/boards', selectedBoardId] });
      toast({ title: 'تم حذف المرفق' });
    },
    onError: () => { toast({ title: 'خطأ في حذف المرفق', variant: 'destructive' }); },
  });

  const updateDependenciesMutation = useMutation({
    mutationFn: ({ id, dependencies }: { id: number; dependencies: number[] }) =>
      apiRequest('PUT', `/api/planner/tasks/${id}/dependencies`, { dependencies }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/planner/boards', selectedBoardId] });
      toast({ title: 'تم تحديث التبعيات' });
    },
    onError: () => { toast({ title: 'خطأ في تحديث التبعيات', variant: 'destructive' }); },
  });

  const handleRequestCompletion = (task: PlannerTask) => {
    updateTaskMutation.mutate({ id: task.id, status: 'pending_approval' }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/planner/tasks', task.id, 'comments'] });
      }
    });
    setSelectedTask({ ...task, status: 'pending_approval' });
    toast({ title: 'تم إرسال طلب الإغلاق للمدير' });
  };

  const handleApproveCompletion = (task: PlannerTask) => {
    const { blocked, blockingTasks } = checkDependenciesComplete(task);
    if (blocked) {
      toast({ title: 'لا يمكن إغلاق المهمة', description: `يجب إكمال المهام التالية أولاً: ${blockingTasks.join('، ')}`, variant: 'destructive' });
      return;
    }
    updateTaskMutation.mutate({ id: task.id, status: 'completed', progress: 100 }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/planner/tasks', task.id, 'comments'] });
      }
    });
    setSelectedTask({ ...task, status: 'completed', progress: 100, completedAt: new Date().toISOString() });
    toast({ title: 'تم الموافقة على إغلاق المهمة' });
  };

  const handleRejectCompletion = (task: PlannerTask) => {
    updateTaskMutation.mutate({ id: task.id, status: 'in_progress' }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/planner/tasks', task.id, 'comments'] });
      }
    });
    setSelectedTask({ ...task, status: 'in_progress' });
    toast({ title: 'تم رفض طلب الإغلاق' });
  };

  const handleDragStart = useCallback((task: PlannerTask) => setDraggedTask(task), []);
  const handleDragOver = useCallback((e: React.DragEvent, bucketId: number) => {
    e.preventDefault();
    setDragOverBucket(bucketId);
  }, []);
  const handleDrop = useCallback((bucketId: number) => {
    if (draggedTask && draggedTask.bucketId !== bucketId) {
      moveTaskMutation.mutate({ id: draggedTask.id, bucketId });
    }
    setDraggedTask(null);
    setDragOverBucket(null);
  }, [draggedTask, moveTaskMutation]);

  // Smart priority debounced suggestion
  useEffect(() => {
    if (!newTask.title.trim() || newTask.title.trim().length < 5) { setSmartSuggestion(null); return; }
    setLoadingSuggestion(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/smart/suggest-priority', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          credentials: 'include',
          body: JSON.stringify({ text: newTask.title }),
        });
        if (res.ok) { const data = await res.json(); setSmartSuggestion(data); }
      } catch { setSmartSuggestion(null); }
      setLoadingSuggestion(false);
    }, 600);
    return () => clearTimeout(timer);
  }, [newTask.title, token]);

  const handleTaskClick = (task: PlannerTask) => {
    setSelectedTask(task);
    setTaskDependencies(task.dependencies || []);
    setDependencySelect('');
    setTaskDetailTab('details');
    setEditingTitle(false);
    setEditingDescription(false);
    setEditTitleValue(task.title);
    setEditDescValue(task.description || '');
    setDetailProgress(task.progress || 0);
    setIsTaskDetailOpen(true);
  };

  const toggleCheckItem = (task: PlannerTask, index: number) => {
    if (!task.checklist) return;
    const updated = [...task.checklist];
    updated[index] = { ...updated[index], checked: !updated[index].checked };
    const checkedCount = updated.filter(c => c.checked).length;
    const totalCount = updated.length;
    const newProgress = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : task.progress;
    const updates: any = { checklist: updated, progress: newProgress };
    if (task.status === 'not_started' && checkedCount > 0) {
      updates.status = 'in_progress';
    }
    updateTaskMutation.mutate({ id: task.id, ...updates });
    if (selectedTask?.id === task.id) setSelectedTask({ ...task, checklist: updated, progress: newProgress, status: updates.status || task.status });
  };

  const filteredBuckets = useMemo(() => {
    return boardData?.buckets?.map(bucket => ({
      ...bucket,
      tasks: bucket.tasks.filter(task => {
        const matchSearch = !searchTerm || task.title.includes(searchTerm) || task.description?.includes(searchTerm);
        const matchPriority = priorityFilter === 'all' || task.priority === priorityFilter;
        const matchAssignee = assigneeFilter === 'all' || String(task.assignedTo) === assigneeFilter || (assigneeFilter === 'unassigned' && !task.assignedTo);
        const matchStatus = statusFilter === 'all' || task.status === statusFilter;
        const matchDateStart = !dateFilterStart || (task.dueDate && new Date(task.dueDate) >= new Date(dateFilterStart));
        const matchDateEnd = !dateFilterEnd || (task.dueDate && new Date(task.dueDate) <= new Date(dateFilterEnd));
        const matchLabels = labelFilter.length === 0 || (task.labels && labelFilter.some(l => task.labels!.includes(l)));
        return matchSearch && matchPriority && matchAssignee && matchStatus && matchDateStart && matchDateEnd && matchLabels;
      }),
    }));
  }, [boardData, searchTerm, priorityFilter, assigneeFilter, statusFilter, dateFilterStart, dateFilterEnd, labelFilter]);

  const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
  const STATUS_ORDER: Record<string, number> = { pending_approval: 0, in_progress: 1, not_started: 2, completed: 3 };

  const sortTasks = useCallback((tasks: PlannerTask[]) => {
    return [...tasks].sort((a, b) => {
      if (myTasksSortBy === 'smart') {
        const aOverdue = isOverdue(a.dueDate, a.status) ? 0 : 1;
        const bOverdue = isOverdue(b.dueDate, b.status) ? 0 : 1;
        if (aOverdue !== bOverdue) return aOverdue - bOverdue;
        const aStatus = STATUS_ORDER[a.status] ?? 9;
        const bStatus = STATUS_ORDER[b.status] ?? 9;
        if (aStatus !== bStatus) return aStatus - bStatus;
        const aPriority = PRIORITY_ORDER[a.priority] ?? 9;
        const bPriority = PRIORITY_ORDER[b.priority] ?? 9;
        if (aPriority !== bPriority) return aPriority - bPriority;
        if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return 0;
      }
      if (myTasksSortBy === 'dueDate') {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      if (myTasksSortBy === 'priority') return (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
      return 0;
    });
  }, [myTasksSortBy]);

  const filteredMyTasks = useMemo(() => {
    return myTasks.filter(task => {
      const matchSearch = !myTasksSearch || task.title.includes(myTasksSearch) || task.description?.includes(myTasksSearch) || task.boardTitle?.includes(myTasksSearch);
      const matchStatus = myTasksStatusFilter === 'all' ? true
        : myTasksStatusFilter === 'active' ? (task.status === 'not_started' || task.status === 'in_progress' || task.status === 'pending_approval')
        : task.status === myTasksStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [myTasks, myTasksSearch, myTasksStatusFilter]);

  const groupedMyTasks = useMemo(() => {
    const groups: Record<string, PlannerTask[]> = {};
    for (const task of filteredMyTasks) {
      let key = '';
      if (myTasksGroupBy === 'status') key = STATUS_CONFIG[task.status]?.label || task.status;
      else if (myTasksGroupBy === 'board') key = task.boardTitle || 'غير محدد';
      else if (myTasksGroupBy === 'priority') key = PRIORITY_CONFIG[task.priority]?.label || task.priority;
      if (!groups[key]) groups[key] = [];
      groups[key].push(task);
    }
    const ordered: Record<string, PlannerTask[]> = {};
    if (myTasksGroupBy === 'status') {
      const statusOrder = ['بانتظار الموافقة', 'قيد التنفيذ', 'لم تبدأ', 'مكتملة'];
      statusOrder.forEach(s => { if (groups[s]) ordered[s] = sortTasks(groups[s]); });
      Object.keys(groups).forEach(k => { if (!ordered[k]) ordered[k] = sortTasks(groups[k]); });
    } else {
      Object.keys(groups).forEach(k => { ordered[k] = sortTasks(groups[k]); });
    }
    return ordered;
  }, [filteredMyTasks, myTasksGroupBy, sortTasks]);

  const filteredTeamTasks = useMemo(() => {
    if (!teamData?.tasks) return [];
    return teamData.tasks.filter(t => {
      if (memberFilter !== 'all' && String(t.assignedTo) !== memberFilter) return false;
      return true;
    });
  }, [teamData, memberFilter]);

  const getAllBoardTasks = useCallback((): PlannerTask[] => {
    return boardData?.buckets?.flatMap(b => b.tasks) || [];
  }, [boardData]);

  const checkDependenciesComplete = useCallback((task: PlannerTask): { blocked: boolean; blockingTasks: string[] } => {
    if (!task.dependencies || task.dependencies.length === 0) return { blocked: false, blockingTasks: [] };
    const allTasks = getAllBoardTasks();
    const blockingTasks: string[] = [];
    for (const depId of task.dependencies) {
      const dep = allTasks.find(t => t.id === depId);
      if (dep && dep.status !== 'completed') {
        blockingTasks.push(dep.title);
      }
    }
    return { blocked: blockingTasks.length > 0, blockingTasks };
  }, [getAllBoardTasks]);

  const handleQuickStatusChange = (e: React.MouseEvent, task: PlannerTask) => {
    e.stopPropagation();
    const canModify = isManager || task.assignedTo === user?.id || task.createdBy === user?.id;
    if (!canModify) return;
    let nextStatus = task.status;
    if (task.status === 'not_started') nextStatus = 'in_progress';
    else if (task.status === 'in_progress' && isManager) nextStatus = 'completed';
    else if (task.status === 'in_progress' && !isManager) nextStatus = 'pending_approval';
    else if (task.status === 'pending_approval' && isManager) nextStatus = 'completed';
    else return;
    if (nextStatus === 'completed' || nextStatus === 'pending_approval') {
      const { blocked, blockingTasks } = checkDependenciesComplete(task);
      if (blocked) {
        toast({ title: 'لا يمكن إغلاق المهمة', description: `يجب إكمال المهام التالية أولاً: ${blockingTasks.join('، ')}`, variant: 'destructive' });
        return;
      }
      if (task.checklist && task.checklist.length > 0) {
        const unchecked = task.checklist.filter(c => !c.checked).length;
        if (unchecked > 0) {
          toast({ title: 'قائمة المراجعة غير مكتملة', description: `تبقى ${unchecked} عناصر لم تُنجز في قائمة المراجعة`, variant: 'destructive' });
          return;
        }
      }
    }
    if (nextStatus !== task.status) {
      updateTaskMutation.mutate({ id: task.id, status: nextStatus });
    }
  };

  const renderTaskCard = (task: PlannerTask, showBoard = false, draggable = false) => {
    const StatusIcon = STATUS_CONFIG[task.status]?.icon || Circle;
    const statusColor = STATUS_CONFIG[task.status]?.color || 'text-muted-foreground';
    const overdueFlag = isOverdue(task.dueDate, task.status);
    const plannerPriorityStripe =
      task.priority === 'urgent' ? 'bg-red-500' :
      task.priority === 'high' ? 'bg-orange-400' :
      task.priority === 'medium' ? 'bg-blue-400' :
      'bg-foreground/10';

    const checklistDone = (task.checklist || []).filter((c: any) => c.checked).length;
    const checklistTotal = (task.checklist || []).length;
    const checklistPct = checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) : 0;

    return (
      <Card
        key={task.id}
        className={`cursor-pointer hover-elevate group relative overflow-hidden ${overdueFlag ? 'border-red-500/20' : ''}`}
        draggable={draggable}
        onDragStart={draggable ? () => handleDragStart(task) : undefined}
        onClick={() => handleTaskClick(task)}
        data-testid={`card-task-${task.id}`}
      >
        <div className={`absolute inset-y-0 right-0 w-[3px] ${plannerPriorityStripe}`} />
        <CardContent className="p-2.5 space-y-1.5">
          {task.labels && task.labels.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {task.labels.map((label, i) => (
                <span key={i} className={`text-[9px] px-1.5 py-px rounded-sm font-medium ${getLabelStyle(label)}`}>
                  {label}
                </span>
              ))}
            </div>
          )}
          <div className="flex items-start gap-1.5">
            <button
              onClick={(e) => handleQuickStatusChange(e, task)}
              className="mt-0.5 shrink-0"
              title={`${STATUS_CONFIG[task.status]?.label} - اضغط للتغيير`}
              data-testid={`button-quick-status-${task.id}`}
            >
              <StatusIcon className={`w-3.5 h-3.5 ${statusColor} hover:scale-125 transition-transform`} />
            </button>
            <p className="text-sm font-medium text-foreground leading-snug flex-1">{task.title}</p>
          </div>
          {showBoard && task.boardTitle && (
            <div className="flex items-center gap-1.5 pr-5">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: task.boardColor || '#1e3a5f' }} />
              <span className="text-[10px] text-muted-foreground/50 truncate">{task.boardTitle} / {task.bucketTitle}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="secondary" className={`text-[10px] ${PRIORITY_CONFIG[task.priority]?.color || ''}`}>
              <Flag className="w-2.5 h-2.5 ml-0.5" />
              {PRIORITY_CONFIG[task.priority]?.label || task.priority}
            </Badge>
            {task.status === 'pending_approval' && (
              <Badge variant="secondary" className="text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <ClipboardCheck className="w-2.5 h-2.5 ml-0.5" />
                بانتظار الموافقة
              </Badge>
            )}
            {task.status !== 'completed' && task.dependencies && task.dependencies.length > 0 && checkDependenciesComplete(task).blocked && (
              <Badge variant="secondary" className="text-[10px] bg-red-500/15 text-red-600 dark:text-red-400" title={`محجوبة بسبب: ${checkDependenciesComplete(task).blockingTasks.join('، ')}`}>
                <AlertTriangle className="w-2.5 h-2.5 ml-0.5" />
                محجوبة
              </Badge>
            )}
            {task.recurrence && (
              <Badge variant="secondary" className="text-[10px] bg-violet-500/15 text-violet-600 dark:text-violet-400">
                <Repeat className="w-2.5 h-2.5 ml-0.5" />
                متكررة
              </Badge>
            )}
          </div>
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              {task.dueDate && (
                <span className={`text-[10px] flex items-center gap-0.5 ${overdueFlag ? 'text-red-500 font-medium' : 'text-muted-foreground/60'}`}>
                  <Calendar className="w-3 h-3" />
                  {formatDate(task.dueDate)}
                </span>
              )}
              {checklistTotal > 0 && (
                <span className="flex items-center gap-1 text-[10px] tabular-nums">
                  <CheckSquare className={`w-3 h-3 ${checklistPct === 100 ? 'text-emerald-500' : 'text-muted-foreground/40'}`} />
                  <span className={checklistPct === 100 ? 'text-emerald-500 font-medium' : 'text-muted-foreground/50'}>
                    {checklistDone}/{checklistTotal}
                  </span>
                </span>
              )}
              {task.attachments && task.attachments.length > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/40" data-testid={`attachment-count-${task.id}`}>
                  <Paperclip className="w-2.5 h-2.5" />{task.attachments.length}
                </span>
              )}
              {task.dependencies && task.dependencies.length > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/40" data-testid={`dependency-count-${task.id}`}>
                  <Link2 className="w-2.5 h-2.5" />{task.dependencies.length}
                </span>
              )}
            </div>
            {task.assigneeName ? (
              <div className="flex items-center gap-1 shrink-0">
                <Avatar className="w-5 h-5">
                  <AvatarFallback className="text-[8px] bg-primary/10 text-primary">{getInitials(task.assigneeName)}</AvatarFallback>
                </Avatar>
                <span className="text-[10px] text-muted-foreground/50 max-w-[60px] truncate">{task.assigneeName}</span>
              </div>
            ) : (
              <span className="text-[10px] text-muted-foreground/30 flex items-center gap-0.5 shrink-0">
                <User className="w-3 h-3" />
                غير معين
              </span>
            )}
          </div>
          {checklistTotal > 0 && (
            <div className="h-1 bg-foreground/8 rounded-full overflow-hidden mt-0.5">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  checklistPct === 100 ? 'bg-emerald-500' :
                  checklistPct > 60 ? 'bg-blue-500' :
                  checklistPct > 30 ? 'bg-yellow-500' : 'bg-orange-400'
                }`}
                style={{ width: `${checklistPct}%` }}
              />
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const portalLabels: Record<string, string> = {
    it_director: 'تقنية المعلومات',
    cybersecurity: 'الأمن السيبراني',
    infrastructure: 'البنية التحتية',
    digital_transformation: 'التحول الرقمي',
    support: 'الدعم الفني',
    dmo: 'إدارة البيانات',
    admin: 'الإدارة',
  };

  const roleLabels: Record<string, string> = {
    system_admin: 'مدير النظام',
    it_director: 'المدير العام',
    it_infrastructure_manager: 'مدير البنية التحتية',
    it_infrastructure_staff: 'البنية التحتية',
    it_cybersecurity_manager: 'مدير الأمن السيبراني',
    it_cybersecurity_staff: 'الأمن السيبراني',
    it_digital_manager: 'مدير التحول الرقمي',
    it_digital_staff: 'التحول الرقمي',
    it_support_manager: 'مدير الدعم الفني',
    it_support_staff: 'الدعم الفني',
    dmo_manager: 'مدير إدارة البيانات',
    dmo_staff: 'إدارة البيانات',
    data_steward: 'أمين البيانات',
    data_representative: 'ممثل البيانات',
    committee_chairman: 'رئيس اللجنة',
    committee_vice_chairman: 'نائب رئيس اللجنة',
    committee_rapporteur: 'مقرر اللجنة',
    committee_member: 'عضو اللجنة',
    employee: 'موظف',
  };

  const renderBoardsList = () => (
    <div className="p-4 md:p-6 space-y-6" data-testid="planner-boards-view">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-planner-title">لوحات التخطيط</h1>
          <p className="text-sm text-muted-foreground mt-1">{portalLabels[portal] || portal} - إدارة المهام والمشاريع</p>
        </div>
        {canCreateContent && (
          <Button onClick={() => setIsCreateBoardOpen(true)} className="hub-btn-gold font-medium" data-testid="button-create-board">
            <Plus className="w-4 h-4 ml-1" />
            لوحة جديدة
          </Button>
        )}
      </div>

      {/* KPI Summary */}
      {!loadingBoards && boards.length > 0 && (() => {
        const totalTasks = boards.reduce((s: number, b: any) => s + (b.totalTasks || 0), 0);
        const completedTasks = boards.reduce((s: number, b: any) => s + (b.completedTasks || 0), 0);
        const overallProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        const activeBoardsCount = boards.filter((b: any) => b.totalTasks > 0 && (b.completedTasks || 0) < b.totalTasks).length;
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="إجمالي اللوحات" value={boards.length} icon={FolderKanban} color="navy" sublabel={`${activeBoardsCount} نشطة`} data-testid="stat-total-boards" />
            <KpiCard label="إجمالي المهام" value={totalTasks} icon={CheckSquare} color="gold" sublabel={`${completedTasks} مكتملة`} data-testid="stat-total-tasks" />
            <KpiCard label="نسبة الإنجاز" value={`${overallProgress}%`} icon={BarChart3} color={overallProgress >= 70 ? 'success' : overallProgress >= 40 ? 'info' : 'muted'} sublabel="عبر جميع اللوحات" data-testid="stat-progress" />
            <KpiCard label="مهامي" value={myTasks.length} icon={User} color="info" sublabel={`${myTasks.filter((t: any) => t.status === 'completed').length} مكتملة`} data-testid="stat-my-tasks" />
          </div>
        );
      })()}

      {loadingBoards ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse"><CardContent className="p-6"><div className="h-6 bg-muted rounded w-2/3 mb-4" /><div className="h-4 bg-muted rounded w-full" /></CardContent></Card>
          ))}
        </div>
      ) : boards.length === 0 ? (
        <Card><CardContent className="p-12 text-center">
          <div className="w-12 h-12 rounded-md bg-muted/50 flex items-center justify-center mx-auto mb-4">
            <FolderKanban className="w-6 h-6 text-muted-foreground/40" />
          </div>
          <h3 className="text-base font-semibold mb-1">لا توجد لوحات تخطيط</h3>
          {canCreateContent ? (
            <>
              <p className="text-sm text-muted-foreground/60 mb-4">أنشئ أول لوحة تخطيط لبدء تنظيم مهامك</p>
              <Button onClick={() => setIsCreateBoardOpen(true)} className="hub-btn-gold font-medium" data-testid="button-create-first-board"><Plus className="w-4 h-4 ml-1" />إنشاء لوحة</Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground/60">سيقوم المدير بإنشاء لوحات التخطيط وتعيين المهام لك. يمكنك متابعة مهامك من تبويب "مهامي".</p>
          )}
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {boards.map((board) => {
            const progress = board.totalTasks > 0 ? Math.round((board.completedTasks / board.totalTasks) * 100) : 0;
            return (
              <Card
                key={board.id}
                className={`hover-elevate cursor-pointer group transition-all ${progress === 100 && board.totalTasks > 0 ? 'ring-1 ring-emerald-500/30' : ''}`}
                onClick={() => { setSelectedBoardId(board.id); setActiveTab('board'); }}
                data-testid={`card-board-${board.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: board.color || '#1e3a5f' }}>
                        {progress === 100 && board.totalTasks > 0
                          ? <CheckCircle2 className="w-4 h-4 text-white" />
                          : <FolderKanban className="w-4 h-4 text-white" />}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-medium text-sm text-foreground truncate">{board.title}</h3>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] text-muted-foreground/50">{board.bucketsCount} مجموعات</span>
                          {isItDirector && board.portal !== portal && (
                            <Badge variant="outline" className="text-[9px] px-1">{portalLabels[board.portal] || board.portal}</Badge>
                          )}
                          {(board as any).overdueCount > 0 && (
                            <Badge className="text-[9px] px-1.5 bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20">
                              <AlertTriangle className="w-2.5 h-2.5 ml-0.5" />{(board as any).overdueCount} متأخرة
                            </Badge>
                          )}
                          {progress === 100 && board.totalTasks > 0 && (
                            <Badge className="text-[9px] px-1.5 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                              <CheckCircle2 className="w-2.5 h-2.5 ml-0.5" />مكتملة
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    {isManager && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button size="icon" variant="ghost" className="shrink-0" data-testid={`button-board-menu-${board.id}`}><MoreHorizontal className="w-3.5 h-3.5" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); confirmDelete.confirm(() => deleteBoardMutation.mutate(board.id), { title: 'حذف اللوحة', description: `هل أنت متأكد من حذف لوحة "${board.title}"؟ سيتم حذف جميع المهام والمجموعات.`, confirmText: 'حذف اللوحة' }); }}>
                            <Trash2 className="w-3.5 h-3.5 ml-2" />حذف اللوحة
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                  {board.description && <p className="text-xs text-muted-foreground/60 mb-2.5 line-clamp-2">{board.description}</p>}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground/50">
                      <span className="tabular-nums">{board.completedTasks} / {board.totalTasks} مكتمل</span>
                      <span className={`tabular-nums font-medium ${progress === 100 ? 'text-emerald-500' : progress >= 70 ? 'text-blue-500' : progress >= 30 ? 'text-amber-500' : 'text-muted-foreground/50'}`}>{progress}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${progress === 100 ? 'bg-emerald-500' : progress >= 70 ? 'bg-blue-500' : progress >= 30 ? 'bg-amber-500' : 'bg-muted-foreground/30'}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2.5 text-[10px] text-muted-foreground/50 tabular-nums">
                    <div className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500" /><span>{board.completedTasks}</span></div>
                    <div className="flex items-center gap-1"><Timer className="w-3 h-3 text-amber-500" /><span>{board.inProgressTasks}</span></div>
                    <div className="flex items-center gap-1"><Circle className="w-3 h-3 text-slate-400" /><span>{board.totalTasks - board.completedTasks - board.inProgressTasks}</span></div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );

  const activeFilterCount = [
    priorityFilter !== 'all' ? 1 : 0,
    assigneeFilter !== 'all' ? 1 : 0,
    statusFilter !== 'all' ? 1 : 0,
    dateFilterStart ? 1 : 0,
    dateFilterEnd ? 1 : 0,
    labelFilter.length > 0 ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const renderKanban = () => (
    <div className="flex flex-col h-full" data-testid="planner-kanban-view">
      <div className="border-b bg-card/80 px-3 py-2.5 md:px-4 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => setSelectedBoardId(null)} data-testid="button-back-to-boards"><ChevronLeft className="w-4 h-4" /></Button>
            <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ backgroundColor: boardData?.color || '#1e3a5f' }}>
              <FolderKanban className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="font-semibold text-foreground text-sm leading-tight truncate">{boardData?.title || 'جاري التحميل...'}</h1>
              {boardData && (() => {
                const allTasks = boardData.buckets?.flatMap(b => b.tasks) || [];
                const total = allTasks.length;
                const completed = allTasks.filter(t => t.status === 'completed').length;
                const inProg = allTasks.filter(t => t.status === 'in_progress').length;
                const overdue = allTasks.filter(t => isOverdue(t.dueDate, t.status)).length;
                const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                return (
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                      <span className="tabular-nums text-emerald-500 font-medium">{completed}</span>/<span className="tabular-nums">{total}</span>
                      <span className="mx-0.5">•</span>
                      <span className={`font-medium ${pct === 100 ? 'text-emerald-500' : pct >= 70 ? 'text-blue-500' : 'text-muted-foreground/60'}`}>{pct}%</span>
                      {inProg > 0 && <><span className="mx-0.5">•</span><span className="text-amber-500">{inProg} قيد التنفيذ</span></>}
                      {overdue > 0 && <><span className="mx-0.5">•</span><span className="text-red-500 font-medium">{overdue} متأخرة</span></>}
                    </div>
                    <div className="w-16 h-1 rounded-full bg-muted overflow-hidden hidden sm:block">
                      <div className={`h-full rounded-full ${pct === 100 ? 'bg-emerald-500' : pct >= 70 ? 'bg-blue-500' : 'bg-amber-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
              <Input placeholder="بحث..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pr-8 w-40 h-8 text-xs" data-testid="input-search-tasks" />
            </div>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-24 h-8 text-xs" data-testid="select-priority-filter"><SelectValue placeholder="الأولوية" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="urgent">عاجل</SelectItem>
                <SelectItem value="high">عالي</SelectItem>
                <SelectItem value="medium">متوسط</SelectItem>
                <SelectItem value="low">منخفض</SelectItem>
              </SelectContent>
            </Select>
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="w-28 h-8 text-xs" data-testid="select-assignee-filter"><SelectValue placeholder="المسؤول" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الأعضاء</SelectItem>
                <SelectItem value="unassigned">غير معين</SelectItem>
                {portalUsers.map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.name}{isItDirector && u.role ? ` (${roleLabels[u.role] || u.role})` : ''}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-28 h-8 text-xs" data-testid="select-status-filter"><SelectValue placeholder="الحالة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => <SelectItem key={key} value={key}>{cfg.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {canCreateContent && <Button onClick={() => setIsCreateBucketOpen(true)} variant="outline" size="sm" data-testid="button-add-bucket"><Plus className="w-3.5 h-3.5 ml-1" />مجموعة</Button>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <Label className="text-[10px] text-muted-foreground/50 whitespace-nowrap">من:</Label>
            <Input type="date" value={dateFilterStart} onChange={e => setDateFilterStart(e.target.value)} className="w-32 h-7 text-[11px]" data-testid="input-date-filter-start" />
          </div>
          <div className="flex items-center gap-1">
            <Label className="text-[10px] text-muted-foreground/50 whitespace-nowrap">إلى:</Label>
            <Input type="date" value={dateFilterEnd} onChange={e => setDateFilterEnd(e.target.value)} className="w-32 h-7 text-[11px]" data-testid="input-date-filter-end" />
          </div>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center gap-1 flex-wrap">
            {LABEL_COLORS.map(lbl => (
              <button
                key={lbl.name}
                className={`text-[10px] px-1.5 py-0.5 rounded-sm font-medium transition-opacity ${getLabelStyle(lbl.name)} ${labelFilter.includes(lbl.name) ? 'opacity-100 ring-1 ring-foreground/20' : 'opacity-50'}`}
                onClick={() => setLabelFilter(prev => prev.includes(lbl.name) ? prev.filter(l => l !== lbl.name) : [...prev, lbl.name])}
                data-testid={`filter-label-${lbl.name}`}
              >{lbl.name}</button>
            ))}
          </div>
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={() => { setDateFilterStart(''); setDateFilterEnd(''); setLabelFilter([]); setStatusFilter('all'); setPriorityFilter('all'); setAssigneeFilter('all'); setSearchTerm(''); }} className="text-[10px] text-muted-foreground/50 h-6" data-testid="button-clear-filters">
              مسح ({activeFilterCount})
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-x-auto p-3 md:p-4">
        {loadingBoard ? (
          <div className="flex gap-4 h-full">{[1, 2, 3, 4].map(i => (<div key={i} className="w-72 flex-shrink-0 animate-pulse"><div className="h-10 bg-muted rounded-t-md mb-2" /><div className="space-y-2">{[1, 2].map(j => <div key={j} className="h-24 bg-muted rounded-md" />)}</div></div>))}</div>
        ) : (
          <div className="flex gap-3 h-full min-h-[60vh]">
            {filteredBuckets?.map((bucket) => (
              <div
                key={bucket.id}
                className={`w-72 md:w-80 flex-shrink-0 flex flex-col rounded-md transition-all ${dragOverBucket === bucket.id ? 'ring-2 ring-gold/30 bg-gold/5' : 'bg-muted/30'}`}
                onDragOver={(e) => handleDragOver(e, bucket.id)}
                onDragLeave={() => setDragOverBucket(null)}
                onDrop={() => handleDrop(bucket.id)}
                data-testid={`bucket-${bucket.id}`}
              >
                <div className="px-3 py-2.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: bucket.color || '#6366f1' }} />
                    <h3 className="font-medium text-sm text-foreground truncate">{bucket.title}</h3>
                    <span className="text-[10px] text-muted-foreground/50 tabular-nums shrink-0">{bucket.tasks.length}</span>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button size="icon" variant="ghost" onClick={() => { setTargetBucketId(bucket.id); setIsCreateTaskOpen(true); }} data-testid={`button-add-task-${bucket.id}`}><Plus className="w-3.5 h-3.5" /></Button>
                    {isManager && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreHorizontal className="w-3.5 h-3.5" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem className="text-destructive" onClick={() => confirmDelete.confirm(() => deleteBucketMutation.mutate(bucket.id), { title: 'حذف المجموعة', description: `هل أنت متأكد من حذف مجموعة "${bucket.title}"؟ ستُحذف جميع مهامها.`, confirmText: 'حذف المجموعة' })}><Trash2 className="w-3.5 h-3.5 ml-2" />حذف المجموعة</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1.5">
                  {bucket.tasks.map((task) => renderTaskCard(task, false, true))}
                  {bucket.tasks.length === 0 && inlineTaskBucketId !== bucket.id && (
                    <div className="text-center py-10 text-muted-foreground/30">
                      <Target className="w-5 h-5 mx-auto mb-1 opacity-50" />
                      <p className="text-[10px]">اسحب المهام هنا</p>
                    </div>
                  )}
                  {inlineTaskBucketId === bucket.id ? (
                    <form className="mt-1" onSubmit={(e) => {
                      e.preventDefault();
                      if (inlineTaskTitle.trim() && selectedBoardId) {
                        inlineCreateMutation.mutate({ title: inlineTaskTitle.trim(), bucketId: bucket.id, boardId: selectedBoardId });
                      }
                    }}>
                      <Input ref={inlineTaskRef} autoFocus value={inlineTaskTitle} onChange={e => setInlineTaskTitle(e.target.value)}
                        placeholder="عنوان المهمة..." className="h-8 text-xs mb-1" data-testid={`input-inline-task-${bucket.id}`}
                        onKeyDown={e => { if (e.key === 'Escape') { setInlineTaskBucketId(null); setInlineTaskTitle(''); } }}
                        onBlur={() => { if (!inlineTaskTitle.trim()) { setInlineTaskBucketId(null); } }}
                      />
                      <div className="flex gap-1">
                        <Button type="submit" size="sm" className="hub-btn-gold h-6 text-[10px] px-2" disabled={!inlineTaskTitle.trim() || inlineCreateMutation.isPending} data-testid={`button-inline-create-${bucket.id}`}>
                          {inlineCreateMutation.isPending ? '...' : 'إضافة'}
                        </Button>
                        <Button type="button" variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => { setInlineTaskBucketId(null); setInlineTaskTitle(''); }}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <button className="w-full text-right text-[10px] text-muted-foreground/40 hover:text-muted-foreground/70 py-1.5 px-2 rounded transition-colors"
                      onClick={() => { setInlineTaskBucketId(bucket.id); setInlineTaskTitle(''); }}
                      data-testid={`button-quick-add-${bucket.id}`}>
                      <Plus className="w-3 h-3 inline ml-1" />إضافة سريعة
                    </button>
                  )}
                </div>
              </div>
            ))}
            {canCreateContent && (
              <div className="w-72 flex-shrink-0">
                <Button variant="outline" className="w-full justify-center border-dashed h-10 text-xs text-muted-foreground/50" onClick={() => setIsCreateBucketOpen(true)} data-testid="button-add-column"><Plus className="w-3.5 h-3.5 ml-1" />إضافة مجموعة</Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const renderMyTasks = () => {
    const overdueCount = myTasks.filter(t => isOverdue(t.dueDate, t.status)).length;
    const pendingApprovalCount = myTasks.filter(t => t.status === 'pending_approval').length;
    const inProgressCount = myTasks.filter(t => t.status === 'in_progress').length;
    const notStartedCount = myTasks.filter(t => t.status === 'not_started').length;
    const completedCount = myTasks.filter(t => t.status === 'completed').length;
    const statusChips = [
      { key: 'active', label: 'النشطة', count: inProgressCount + notStartedCount + pendingApprovalCount, color: 'text-blue-600 dark:text-blue-400 border-blue-500/30 bg-blue-500/5' },
      { key: 'in_progress', label: 'قيد التنفيذ', count: inProgressCount, color: 'text-blue-600 dark:text-blue-400 border-blue-500/30 bg-blue-500/5' },
      { key: 'pending_approval', label: 'بانتظار الموافقة', count: pendingApprovalCount, color: 'text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/5' },
      { key: 'not_started', label: 'لم تبدأ', count: notStartedCount, color: 'text-slate-600 dark:text-slate-400 border-slate-500/30 bg-slate-500/5' },
      { key: 'completed', label: 'مكتملة', count: completedCount, color: 'text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/5' },
      { key: 'all', label: 'الكل', count: myTasks.length, color: 'text-foreground border-border bg-muted/30' },
    ];
    return (
    <div className="p-4 md:p-6 space-y-4" data-testid="planner-my-tasks-view">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-foreground">مهامي</h2>
          <p className="text-sm text-muted-foreground">
            {filteredMyTasks.length} من {myTasks.length} مهمة
            {overdueCount > 0 && <span className="mr-2 text-red-500 font-medium">• {overdueCount} متأخرة</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isManager && (
            <Button
              size="sm"
              className="hub-btn-gold h-8 text-xs font-medium"
              onClick={() => { setTargetBucketId(boardData?.buckets?.[0]?.id || null); setIsCreateTaskOpen(true); }}
              data-testid="button-create-mytask"
            >
              <Plus className="w-3.5 h-3.5 ml-1" />مهمة جديدة
            </Button>
          )}
          <Select value={myTasksSortBy} onValueChange={(v: any) => setMyTasksSortBy(v)}>
            <SelectTrigger className="w-32 h-8 text-xs" data-testid="select-sort-by"><ArrowUpDown className="w-3.5 h-3.5 ml-1" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="smart">ذكي (موصى به)</SelectItem>
              <SelectItem value="dueDate">تاريخ الاستحقاق</SelectItem>
              <SelectItem value="priority">الأولوية</SelectItem>
            </SelectContent>
          </Select>
          <Select value={myTasksGroupBy} onValueChange={(v: any) => setMyTasksGroupBy(v)}>
            <SelectTrigger className="w-32 h-8 text-xs" data-testid="select-group-by"><Layers className="w-3.5 h-3.5 ml-1" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="status">تجميع بالحالة</SelectItem>
              <SelectItem value="board">تجميع باللوحة</SelectItem>
              <SelectItem value="priority">تجميع بالأولوية</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Quick stats summary */}
      {!loadingMyTasks && myTasks.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'قيد التنفيذ', count: inProgressCount, color: 'text-blue-500', bg: 'bg-blue-500/10' },
            { label: 'بانتظار الموافقة', count: pendingApprovalCount, color: 'text-amber-500', bg: 'bg-amber-500/10' },
            { label: 'متأخرة', count: overdueCount, color: 'text-red-500', bg: 'bg-red-500/10' },
            { label: 'مكتملة', count: completedCount, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          ].map(s => (
            <div key={s.label} className={`rounded-lg p-2.5 text-center ${s.bg} cursor-pointer`} onClick={() => { if (s.label === 'قيد التنفيذ') setMyTasksStatusFilter('in_progress'); else if (s.label === 'بانتظار الموافقة') setMyTasksStatusFilter('pending_approval'); else if (s.label === 'مكتملة') setMyTasksStatusFilter('completed'); else setMyTasksStatusFilter('all'); }}>
              <p className={`text-xl font-bold ${s.color}`}>{s.count}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search + Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
          <Input
            placeholder="بحث في مهامي..."
            value={myTasksSearch}
            onChange={e => setMyTasksSearch(e.target.value)}
            className="pr-8 h-8 text-xs"
            data-testid="input-my-tasks-search"
          />
          {myTasksSearch && (
            <button className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground" onClick={() => setMyTasksSearch('')}>
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {statusChips.map(chip => (
            <button
              key={chip.key}
              onClick={() => setMyTasksStatusFilter(chip.key)}
              className={`text-[11px] px-2.5 py-1 rounded-full border font-medium transition-all ${myTasksStatusFilter === chip.key ? chip.color + ' ring-1 ring-current/20' : 'text-muted-foreground border-transparent hover:border-border hover:bg-muted/50'}`}
              data-testid={`filter-my-tasks-${chip.key}`}
            >
              {chip.label}
              {chip.count > 0 && <span className="mr-1 opacity-60">({chip.count})</span>}
            </button>
          ))}
        </div>
      </div>

      {loadingMyTasks ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Card key={i} className="animate-pulse"><CardContent className="p-4"><div className="h-5 bg-muted rounded w-2/3" /></CardContent></Card>)}</div>
      ) : filteredMyTasks.length === 0 ? (
        <Card><CardContent className="p-12 text-center">
          <Target className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
          <h3 className="font-semibold mb-1">{myTasks.length === 0 ? 'لا توجد مهام حالياً' : 'لا توجد نتائج'}</h3>
          <p className="text-sm text-muted-foreground">{myTasks.length === 0 ? 'سيتم عرض المهام المعينة لك هنا' : 'حاول تغيير مرشحات البحث'}</p>
          {(myTasksSearch || myTasksStatusFilter !== 'active') && (
            <Button size="sm" variant="outline" className="mt-3 text-xs" onClick={() => { setMyTasksSearch(''); setMyTasksStatusFilter('active'); }}>
              <X className="w-3 h-3 ml-1" />مسح المرشحات
            </Button>
          )}
        </CardContent></Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedMyTasks).map(([groupName, tasks]) => (
            <div key={groupName}>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold text-sm text-foreground">{groupName}</h3>
                <Badge variant="secondary" className="text-xs">{tasks.length}</Badge>
              </div>
              <div className="space-y-1.5">
                {tasks.map(task => {
                  const overdueFlag = isOverdue(task.dueDate, task.status);
                  const StatusIcon = STATUS_CONFIG[task.status]?.icon || Circle;
                  const canStart = task.status === 'not_started' && (task.assignedTo === user?.id || task.createdBy === user?.id);
                  const canRequestDone = task.status === 'in_progress' && (task.assignedTo === user?.id || task.createdBy === user?.id) && !isManager;
                  return (
                    <div
                      key={task.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors cursor-pointer group ${overdueFlag ? 'border-red-500/20 bg-red-500/5' : ''}`}
                      onClick={() => handleTaskClick(task)}
                      data-testid={`my-task-row-${task.id}`}
                    >
                      <button
                        className="shrink-0"
                        onClick={e => { e.stopPropagation(); handleQuickStatusChange(e, task); }}
                        title={STATUS_CONFIG[task.status]?.label}
                        data-testid={`button-mytask-status-${task.id}`}
                      >
                        <StatusIcon className={`w-4 h-4 ${STATUS_CONFIG[task.status]?.color} hover:scale-125 transition-transform`} />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>{task.title}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {task.boardTitle && <span className="text-[10px] text-muted-foreground/50">{task.boardTitle}</span>}
                          {task.dueDate && (
                            <span className={`text-[10px] flex items-center gap-0.5 ${overdueFlag ? 'text-red-500 font-medium' : 'text-muted-foreground/50'}`}>
                              <Calendar className="w-2.5 h-2.5" />{formatDate(task.dueDate)}
                            </span>
                          )}
                          {task.checklist && task.checklist.length > 0 && (
                            <span className="text-[10px] text-muted-foreground/50 flex items-center gap-0.5">
                              <CheckSquare className="w-2.5 h-2.5" />
                              {task.checklist.filter(c => c.checked).length}/{task.checklist.length}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge variant="secondary" className={`text-[10px] ${PRIORITY_CONFIG[task.priority]?.color || ''}`}>
                          {PRIORITY_CONFIG[task.priority]?.label}
                        </Badge>
                        {canStart && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[10px] px-2 opacity-0 group-hover:opacity-100 transition-opacity border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
                            onClick={e => { e.stopPropagation(); updateTaskMutation.mutate({ id: task.id, status: 'in_progress' }); toast({ title: 'بدأت العمل على المهمة' }); }}
                            data-testid={`button-start-mytask-${task.id}`}
                          >
                            <Timer className="w-3 h-3 ml-0.5" />بدء
                          </Button>
                        )}
                        {canRequestDone && (
                          <Button
                            size="sm"
                            className="h-6 text-[10px] px-2 opacity-0 group-hover:opacity-100 transition-opacity bg-emerald-600 hover:bg-emerald-700"
                            onClick={e => { e.stopPropagation(); handleRequestCompletion(task); }}
                            data-testid={`button-done-mytask-${task.id}`}
                          >
                            <CheckCircle2 className="w-3 h-3 ml-0.5" />إنجاز
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    );
  };

  const renderMemberReport = () => {
    const members = chartData?.byMember || [];
    const filtered = members.filter(m =>
      !memberReportSearch || m.name.toLowerCase().includes(memberReportSearch.toLowerCase())
    );
    const sorted = [...filtered].sort((a, b) => {
      const av = a[memberReportSort.col] as number;
      const bv = b[memberReportSort.col] as number;
      return memberReportSort.dir === 'desc' ? bv - av : av - bv;
    });

    const toggleSort = (col: keyof MemberStat) => {
      setMemberReportSort(prev =>
        prev.col === col ? { col, dir: prev.dir === 'desc' ? 'asc' : 'desc' } : { col, dir: 'desc' }
      );
    };

    const totalEmployees = members.length;
    const avgCompletion = totalEmployees > 0
      ? Math.round(members.reduce((s, m) => s + (m.total > 0 ? (m.completed / m.total) * 100 : 0), 0) / totalEmployees)
      : 0;
    const totalOverdue = members.reduce((s, m) => s + m.overdue, 0);
    const topPerformer = members.length > 0
      ? members.reduce((best, m) =>
        (m.total > 0 && (m.completed / m.total) > (best.total > 0 ? best.completed / best.total : 0)) ? m : best
        , members[0])
      : null;

    const handleExportExcel = async () => {
      const deptName = reportDeptLabels[portal] || portal;
      await exportToExcel({
        title: `تقرير أداء موظفي ${deptName}`,
        filename: `member-report-${portal}-${new Date().toISOString().slice(0, 10)}`,
        orientation: 'landscape',
        columns: [
          { header: 'الموظف', key: 'name', width: 120 },
          { header: 'إجمالي', key: 'total', width: 60 },
          { header: 'مفتوحة', key: 'open', width: 60 },
          { header: 'قيد التنفيذ', key: 'inProgress', width: 80 },
          { header: 'لم تبدأ', key: 'notStarted', width: 70 },
          { header: 'انتظار موافقة', key: 'pendingApproval', width: 90 },
          { header: 'متأخرة', key: 'overdue', width: 60 },
          { header: 'مكتملة', key: 'completed', width: 70 },
          { header: 'نسبة الإنجاز', key: 'rate', width: 80 },
        ],
        data: sorted.map(m => ({
          name: m.name,
          total: m.total,
          open: m.open,
          inProgress: m.inProgress,
          notStarted: m.notStarted,
          pendingApproval: m.pendingApproval,
          overdue: m.overdue,
          completed: m.completed,
          rate: m.total > 0 ? `${Math.round((m.completed / m.total) * 100)}%` : '0%',
        })),
      });
    };

    const SortIcon = ({ col }: { col: keyof MemberStat }) => (
      memberReportSort.col === col
        ? <span className={`mr-1 text-gold ${memberReportSort.dir === 'desc' ? '' : 'rotate-180 inline-block'}`}>▼</span>
        : <span className="mr-1 text-muted-foreground/40">↕</span>
    );

    return (
      <div className="p-4 md:p-6 space-y-6" data-testid="planner-member-report-view">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <FileBarChart2 className="w-5 h-5 text-gold" />
              تقرير أداء الموظفين
            </h2>
            <p className="text-sm text-muted-foreground">إحصاءات تفصيلية لكل موظف — المهام المعالجة، المفتوحة، والمتأخرة</p>
          </div>
          <Button variant="outline" size="sm" className="gap-2 h-8" onClick={handleExportExcel} data-testid="button-export-member-report">
            <FileSpreadsheet className="w-4 h-4" />تصدير Excel
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-foreground">{totalEmployees}</p>
            <p className="text-xs text-muted-foreground mt-1">عدد الموظفين</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-emerald-500">{avgCompletion}%</p>
            <p className="text-xs text-muted-foreground mt-1">متوسط الإنجاز</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-red-500">{totalOverdue}</p>
            <p className="text-xs text-muted-foreground mt-1">إجمالي المتأخرة</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-base font-bold text-primary truncate">{topPerformer?.name || '—'}</p>
            <p className="text-xs text-muted-foreground mt-1">الأعلى إنجازاً</p>
            {topPerformer && topPerformer.total > 0 && (
              <p className="text-[11px] text-emerald-500">{Math.round((topPerformer.completed / topPerformer.total) * 100)}%</p>
            )}
          </CardContent></Card>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute right-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="بحث عن موظف..."
            value={memberReportSearch}
            onChange={e => setMemberReportSearch(e.target.value)}
            className="pr-9 h-9"
            data-testid="input-member-report-search"
          />
        </div>

        {/* Table */}
        {!chartData ? (
          <Card><CardContent className="p-8"><div className="animate-pulse space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-10 bg-muted rounded" />)}</div></CardContent></Card>
        ) : (
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm" dir="rtl">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {([
                      { label: 'الموظف', col: 'name' as keyof MemberStat },
                      { label: 'إجمالي', col: 'total' as keyof MemberStat },
                      { label: 'مفتوحة', col: 'open' as keyof MemberStat },
                      { label: 'قيد التنفيذ', col: 'inProgress' as keyof MemberStat },
                      { label: 'لم تبدأ', col: 'notStarted' as keyof MemberStat },
                      { label: 'انتظار موافقة', col: 'pendingApproval' as keyof MemberStat },
                      { label: 'متأخرة', col: 'overdue' as keyof MemberStat },
                      { label: 'مكتملة', col: 'completed' as keyof MemberStat },
                      { label: 'نسبة الإنجاز', col: null },
                    ] as { label: string; col: keyof MemberStat | null }[]).map(({ label, col }) => (
                      <th
                        key={label}
                        className={`px-4 py-3 text-right font-medium text-muted-foreground text-xs whitespace-nowrap ${col ? 'cursor-pointer select-none hover:text-foreground' : ''}`}
                        onClick={() => col && toggleSort(col)}
                        data-testid={col ? `th-sort-${col}` : undefined}
                      >
                        {label}{col && <SortIcon col={col} />}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.length === 0 && (
                    <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">لا توجد بيانات</td></tr>
                  )}
                  {sorted.map((m, i) => {
                    const rate = m.total > 0 ? Math.round((m.completed / m.total) * 100) : 0;
                    return (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors" data-testid={`row-member-${i}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Avatar className="w-7 h-7 flex-shrink-0">
                              <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{getInitials(m.name)}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-foreground text-xs">{m.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-semibold text-foreground">{m.total}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-medium ${m.open > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>{m.open}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-medium ${m.inProgress > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'}`}>{m.inProgress}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-medium ${m.notStarted > 0 ? 'text-slate-500' : 'text-muted-foreground'}`}>{m.notStarted}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {m.pendingApproval > 0
                            ? <Badge variant="secondary" className="bg-amber-500/15 text-amber-700 dark:text-amber-400 text-[10px] px-1.5">{m.pendingApproval}</Badge>
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {m.overdue > 0
                            ? <Badge variant="secondary" className="bg-red-500/15 text-red-700 dark:text-red-400 text-[10px] px-1.5">{m.overdue}</Badge>
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-medium ${m.completed > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>{m.completed}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 min-w-[80px]">
                            <Progress value={rate} className="h-1.5 flex-1" />
                            <span className={`text-xs font-semibold w-8 text-left ${rate >= 80 ? 'text-emerald-600 dark:text-emerald-400' : rate >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>{rate}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderCharts = () => (
    <div className="p-4 md:p-6 space-y-6" data-testid="planner-charts-view">
      <h2 className="text-xl font-bold text-foreground">الرسوم البيانية والإحصائيات</h2>
      {!chartData ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[1, 2, 3, 4].map(i => <Card key={i} className="animate-pulse"><CardContent className="p-6"><div className="h-40 bg-muted rounded" /></CardContent></Card>)}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card><CardContent className="p-4 text-center">
              <AnimatedNumber value={chartData.totalTasks} className="text-3xl font-bold text-foreground" />
              <p className="text-xs text-muted-foreground mt-1">إجمالي المهام</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <AnimatedNumber value={chartData.completionRate} suffix="%" className="text-3xl font-bold text-emerald-500" />
              <p className="text-xs text-muted-foreground mt-1">نسبة الإنجاز</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <AnimatedNumber value={chartData.byStatus['in_progress'] || 0} className="text-3xl font-bold text-blue-500" />
              <p className="text-xs text-muted-foreground mt-1">قيد التنفيذ</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <AnimatedNumber value={chartData.byStatus['pending_approval'] || 0} className="text-3xl font-bold text-amber-500" />
              <p className="text-xs text-muted-foreground mt-1">بانتظار الموافقة</p>
            </CardContent></Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">توزيع الحالات</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(chartData.byStatus).map(([status, count]) => {
                  const config = STATUS_CONFIG[status];
                  const pct = chartData.totalTasks > 0 ? Math.round((count / chartData.totalTasks) * 100) : 0;
                  return (
                    <div key={status} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className={config?.color}>{config?.label || status}</span>
                        <span className="text-muted-foreground">{count} ({pct}%)</span>
                      </div>
                      <Progress value={pct} className="h-2" />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">توزيع الأولويات</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(chartData.byPriority).map(([priority, count]) => {
                  const config = PRIORITY_CONFIG[priority];
                  const pct = chartData.totalTasks > 0 ? Math.round((count / chartData.totalTasks) * 100) : 0;
                  return (
                    <div key={priority} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <Badge variant="secondary" className={config?.color}>{config?.label || priority}</Badge>
                        <span className="text-muted-foreground">{count} ({pct}%)</span>
                      </div>
                      <Progress value={pct} className="h-2" />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">أداء أعضاء الفريق</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {chartData.byMember.map((member, i) => {
                  const completionPct = member.total > 0 ? Math.round((member.completed / member.total) * 100) : 0;
                  return (
                    <div key={i} className="flex items-center gap-4">
                      <Avatar className="w-9 h-9 flex-shrink-0">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">{getInitials(member.name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium truncate">{member.name}</span>
                          <span className="text-xs text-muted-foreground">{completionPct}%</span>
                        </div>
                        <Progress value={completionPct} className="h-1.5" />
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                          <span>{member.total} إجمالي</span>
                          <span className="text-emerald-500">{member.completed} مكتملة</span>
                          <span className="text-blue-500">{member.inProgress} قيد التنفيذ</span>
                          {member.overdue > 0 && <span className="text-red-500">{member.overdue} متأخرة</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {chartData.byMember.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">لا توجد بيانات</p>}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );

  const renderMembers = () => (
    <div className="p-4 md:p-6 space-y-6" data-testid="planner-members-view">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-foreground">متابعة الفريق</h2>
          <p className="text-sm text-muted-foreground">عرض شامل لمهام جميع الأعضاء</p>
        </div>
        <Select value={memberFilter} onValueChange={setMemberFilter}>
          <SelectTrigger className="w-44" data-testid="select-member-filter"><Users className="w-4 h-4 ml-1" /><SelectValue placeholder="عضو الفريق" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الأعضاء</SelectItem>
            {teamData?.members.map(m => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {teamData?.members && teamData.members.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teamData.members.map(member => {
            const pct = member.tasksCount > 0 ? Math.round((member.completedCount / member.tasksCount) * 100) : 0;
            return (
              <Card key={member.id} className={`hover-elevate cursor-pointer ${memberFilter === String(member.id) ? 'ring-2 ring-primary/30' : ''}`} onClick={() => setMemberFilter(memberFilter === String(member.id) ? 'all' : String(member.id))} data-testid={`card-member-${member.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar className="w-10 h-10"><AvatarFallback className="bg-primary/10 text-primary font-bold">{getInitials(member.name)}</AvatarFallback></Avatar>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{member.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{member.email}</p>
                    </div>
                  </div>
                  <Progress value={pct} className="h-1.5 mb-2" />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{member.tasksCount} مهمة</span>
                    <span className="text-emerald-500">{member.completedCount} مكتملة</span>
                    {member.overdueCount > 0 && <span className="text-red-500">{member.overdueCount} متأخرة</span>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredTeamTasks.map(task => renderTaskCard(task, true))}
        {filteredTeamTasks.length === 0 && (
          <Card className="col-span-full"><CardContent className="p-8 text-center text-muted-foreground">لا توجد مهام</CardContent></Card>
        )}
      </div>
    </div>
  );

  const overdueCount = overdueData?.overdue?.length || 0;
  const approachingCount = overdueData?.approaching?.length || 0;

  const renderOverdueBanner = () => {
    if (overdueCount === 0 && approachingCount === 0) return null;
    return (
      <div className="relative" data-testid="overdue-banner">
        <button
          className="w-full flex items-center justify-between gap-3 p-3 bg-red-500/10 dark:bg-red-500/5 border border-red-500/20 rounded-lg cursor-pointer"
          onClick={() => setShowOverdueBanner(!showOverdueBanner)}
          data-testid="button-toggle-overdue-banner"
        >
          <div className="flex items-center gap-3 flex-wrap">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <div className="flex items-center gap-3 flex-wrap">
              {overdueCount > 0 && (
                <Badge variant="secondary" className="bg-red-500/15 text-red-600 dark:text-red-400">{overdueCount} مهمة متأخرة</Badge>
              )}
              {approachingCount > 0 && (
                <Badge variant="secondary" className="bg-amber-500/15 text-amber-600 dark:text-amber-400">{approachingCount} مهمة تقترب</Badge>
              )}
            </div>
          </div>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showOverdueBanner ? 'rotate-180' : ''}`} />
        </button>
        {showOverdueBanner && (
          <Card className="mt-2">
            <CardContent className="p-3 space-y-3 max-h-64 overflow-y-auto">
              {overdueData?.overdue?.map(task => (
                <div key={task.id} className="flex items-center justify-between gap-2 p-2 rounded-md bg-red-500/5 cursor-pointer" onClick={() => handleTaskClick(task)} data-testid={`overdue-task-${task.id}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <span className="text-sm truncate">{task.title}</span>
                  </div>
                  <span className="text-[10px] text-red-500 whitespace-nowrap">{formatDate(task.dueDate)}</span>
                </div>
              ))}
              {overdueData?.approaching?.map(task => (
                <div key={task.id} className="flex items-center justify-between gap-2 p-2 rounded-md bg-amber-500/5 cursor-pointer" onClick={() => handleTaskClick(task)} data-testid={`approaching-task-${task.id}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <span className="text-sm truncate">{task.title}</span>
                  </div>
                  <span className="text-[10px] text-amber-500 whitespace-nowrap">{formatDate(task.dueDate)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderTimeline = () => {
    const tasks = timelineData.filter(t => t.startDate || t.dueDate);
    if (tasks.length === 0) {
      return (
        <div className="p-4 md:p-6" data-testid="planner-timeline-view">
          <Card><CardContent className="p-12 text-center">
            <GanttChart className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
            <h3 className="font-semibold mb-1">لا توجد مهام بتواريخ</h3>
            <p className="text-sm text-muted-foreground">أضف تواريخ بداية واستحقاق للمهام لعرضها على الجدول الزمني</p>
          </CardContent></Card>
        </div>
      );
    }

    const allDates = tasks.flatMap(t => [t.startDate, t.dueDate].filter(Boolean) as string[]).map(d => new Date(d).getTime());
    const minDate = new Date(Math.min(...allDates));
    const maxDate = new Date(Math.max(...allDates));
    const today = new Date();
    const totalDays = Math.max(Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) + 2, 7);

    const getBarStyle = (start: string | null, end: string | null) => {
      const s = start ? new Date(start) : (end ? new Date(end) : today);
      const e = end ? new Date(end) : (start ? new Date(start) : today);
      const leftDays = Math.max(0, (s.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
      const widthDays = Math.max(1, (e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
      return {
        left: `${(leftDays / totalDays) * 100}%`,
        width: `${Math.max((widthDays / totalDays) * 100, 2)}%`,
      };
    };

    const statusColors: Record<string, string> = {
      not_started: 'bg-slate-400',
      in_progress: 'bg-blue-500',
      completed: 'bg-emerald-500',
      pending_approval: 'bg-amber-500',
    };

    const todayLeft = ((today.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24) / totalDays) * 100;

    return (
      <div className="p-4 md:p-6 space-y-4" data-testid="planner-timeline-view">
        <h2 className="text-xl font-bold text-foreground">الجدول الزمني</h2>
        <Card>
          <CardContent className="p-4 overflow-x-auto">
            <div className="relative min-w-[600px]" style={{ minHeight: `${tasks.length * 44 + 40}px` }}>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-2 px-1">
                <span>{minDate.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })}</span>
                <span>{maxDate.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })}</span>
              </div>
              {todayLeft >= 0 && todayLeft <= 100 && (
                <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10" style={{ left: `${todayLeft}%` }} data-testid="timeline-today-marker">
                  <span className="absolute -top-4 -translate-x-1/2 text-[9px] text-red-500 whitespace-nowrap">اليوم</span>
                </div>
              )}
              {tasks.map((task, i) => {
                const barStyle = getBarStyle(task.startDate, task.dueDate);
                return (
                  <div key={task.id} className="relative h-10 flex items-center" style={{ marginTop: i === 0 ? '8px' : '0' }}>
                    <div
                      className={`absolute h-7 rounded-md ${statusColors[task.status] || 'bg-slate-400'} flex items-center px-2 cursor-pointer hover:opacity-90 transition-opacity`}
                      style={barStyle}
                      title={`${task.title} - ${STATUS_CONFIG[task.status]?.label || task.status}`}
                      data-testid={`timeline-bar-${task.id}`}
                    >
                      <span className="text-[10px] text-white truncate font-medium">{task.title}</span>
                    </div>
                  </div>
                );
              })}
              {tasks.map(task => {
                if (!task.dependencies || task.dependencies.length === 0) return null;
                return task.dependencies.map(depId => {
                  const depTask = tasks.find(t => t.id === depId);
                  if (!depTask) return null;
                  return (
                    <svg key={`dep-${task.id}-${depId}`} className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }}>
                      <line
                        x1="50%" y1="50%" x2="50%" y2="50%"
                        stroke="hsl(var(--muted-foreground))" strokeWidth="1" strokeDasharray="4 2" opacity="0.3"
                      />
                    </svg>
                  );
                });
              })}
            </div>
            <div className="flex items-center gap-4 mt-4 pt-3 border-t flex-wrap">
              {Object.entries(statusColors).map(([status, color]) => (
                <div key={status} className="flex items-center gap-1.5">
                  <div className={`w-3 h-3 rounded-sm ${color}`} />
                  <span className="text-[10px] text-muted-foreground">{STATUS_CONFIG[status]?.label || status}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderTaskDetail = () => {
    if (!selectedTask) return null;
    const StatusIcon = STATUS_CONFIG[selectedTask.status]?.icon || Circle;
    const canRequestClose = !isManager && selectedTask.status === 'in_progress' && (selectedTask.assignedTo === user?.id || selectedTask.createdBy === user?.id);
    const canApproveClose = isManager && selectedTask.status === 'pending_approval';
    const overdueFlag = isOverdue(selectedTask.dueDate, selectedTask.status);
    const checklistDone = selectedTask.checklist?.filter(c => c.checked).length || 0;
    const checklistTotal = selectedTask.checklist?.length || 0;

    return (
      <Sheet open={isTaskDetailOpen} onOpenChange={open => { setIsTaskDetailOpen(open); if (!open) { setEditingTitle(false); setEditingDescription(false); } }}>
        <SheetContent side="left" className="w-full sm:max-w-xl p-0 flex flex-col overflow-hidden" dir="rtl">
          {/* Header */}
          <div className="px-5 pt-5 pb-3 border-b flex-shrink-0 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                {editingTitle ? (
                  <Input
                    autoFocus
                    value={editTitleValue}
                    onChange={e => setEditTitleValue(e.target.value)}
                    className="text-base font-semibold h-8 px-2"
                    onBlur={() => {
                      if (editTitleValue.trim() && editTitleValue !== selectedTask.title) {
                        updateTaskMutation.mutate({ id: selectedTask.id, title: editTitleValue.trim() });
                        setSelectedTask({ ...selectedTask, title: editTitleValue.trim() });
                      }
                      setEditingTitle(false);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                      if (e.key === 'Escape') { setEditTitleValue(selectedTask.title); setEditingTitle(false); }
                    }}
                    data-testid="input-edit-title"
                  />
                ) : (
                  <h2
                    className={`text-base font-semibold text-foreground leading-snug cursor-pointer hover:text-primary transition-colors group flex items-start gap-1.5 ${(isManager || selectedTask.assignedTo === user?.id) ? '' : 'cursor-default'}`}
                    onClick={() => { if (isManager || selectedTask.assignedTo === user?.id) { setEditTitleValue(selectedTask.title); setEditingTitle(true); } }}
                    data-testid="text-task-title-editable"
                  >
                    {selectedTask.title}
                    {(isManager || selectedTask.assignedTo === user?.id) && (
                      <Eye className="w-3.5 h-3.5 text-muted-foreground/30 opacity-0 group-hover:opacity-100 mt-0.5 shrink-0" />
                    )}
                  </h2>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Badge variant="secondary" className={`text-xs ${PRIORITY_CONFIG[selectedTask.priority]?.color || ''}`}>
                  <Flag className="w-3 h-3 ml-0.5" />{PRIORITY_CONFIG[selectedTask.priority]?.label}
                </Badge>
                <Badge variant="secondary" className={`text-xs ${overdueFlag ? 'bg-red-500/15 text-red-600 dark:text-red-400' : ''}`}>
                  <StatusIcon className="w-3 h-3 ml-0.5" />{STATUS_CONFIG[selectedTask.status]?.label}
                </Badge>
              </div>
            </div>

            {/* Description inline edit */}
            {editingDescription ? (
              <Textarea
                autoFocus
                value={editDescValue}
                onChange={e => setEditDescValue(e.target.value)}
                className="text-sm min-h-[60px] resize-none"
                placeholder="أضف وصفاً للمهمة..."
                onBlur={() => {
                  const desc = editDescValue.trim() || null;
                  if (desc !== selectedTask.description) {
                    updateTaskMutation.mutate({ id: selectedTask.id, description: desc });
                    setSelectedTask({ ...selectedTask, description: desc });
                  }
                  setEditingDescription(false);
                }}
                onKeyDown={e => { if (e.key === 'Escape') { setEditDescValue(selectedTask.description || ''); setEditingDescription(false); } }}
                data-testid="textarea-edit-description"
              />
            ) : (
              <p
                className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors min-h-[1.5rem]"
                onClick={() => { setEditDescValue(selectedTask.description || ''); setEditingDescription(true); }}
                data-testid="text-task-description-editable"
              >
                {selectedTask.description || <span className="text-muted-foreground/40 italic">اضغط لإضافة وصف...</span>}
              </p>
            )}

            {/* Progress bar if checklist */}
            {checklistTotal > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>قائمة المراجعة</span>
                  <span className="tabular-nums">{checklistDone}/{checklistTotal}</span>
                </div>
                <Progress value={(checklistDone / checklistTotal) * 100} className="h-1" />
              </div>
            )}

            {/* Approval / completion banners */}
            {canApproveClose && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <ClipboardCheck className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="font-medium text-sm text-amber-600 dark:text-amber-400">طلب إغلاق المهمة - بانتظار موافقتك</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => handleApproveCompletion(selectedTask)} className="bg-emerald-600 hover:bg-emerald-700 h-7 text-xs" data-testid="button-approve-close">
                    <ShieldCheck className="w-3.5 h-3.5 ml-1" />الموافقة والإغلاق
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleRejectCompletion(selectedTask)} className="h-7 text-xs" data-testid="button-reject-close">
                    رفض - تحتاج مراجعة
                  </Button>
                </div>
              </div>
            )}

            {selectedTask.status === 'completed' && selectedTask.completedAt && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2.5 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="text-xs text-emerald-600 dark:text-emerald-400">
                  تم الإغلاق: {new Date(selectedTask.completedAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </div>
            )}

            {canRequestClose && (
              <Button onClick={() => handleRequestCompletion(selectedTask)} className="w-full bg-emerald-600 hover:bg-emerald-700 h-8 text-sm" data-testid="button-request-close">
                <CheckCircle2 className="w-4 h-4 ml-2" />تم الإنجاز - طلب إغلاق
              </Button>
            )}

            {!isManager && selectedTask.status === 'not_started' && (selectedTask.assignedTo === user?.id || selectedTask.createdBy === user?.id) && (
              <Button variant="outline" onClick={() => { updateTaskMutation.mutate({ id: selectedTask.id, status: 'in_progress' }); setSelectedTask({ ...selectedTask, status: 'in_progress' }); toast({ title: 'تم بدء العمل على المهمة' }); }} className="w-full h-8 text-sm" data-testid="button-start-task">
                <Timer className="w-4 h-4 ml-2" />بدء العمل على المهمة
              </Button>
            )}
          </div>

          {/* Tabs */}
          <Tabs value={taskDetailTab} onValueChange={setTaskDetailTab} className="flex flex-col flex-1 overflow-hidden">
            <TabsList className="bg-transparent gap-0 h-auto p-0 border-b rounded-none px-4 flex-shrink-0 justify-start">
              {[
                { value: 'details', label: 'التفاصيل', icon: Target },
                { value: 'checklist', label: `المراجعة${checklistTotal > 0 ? ` (${checklistDone}/${checklistTotal})` : ''}`, icon: CheckSquare },
                { value: 'comments', label: `التعليقات${taskComments.length > 0 ? ` (${taskComments.length})` : ''}`, icon: MessageSquare },
                { value: 'attachments', label: `المرفقات${(selectedTask.attachments?.length || 0) > 0 ? ` (${selectedTask.attachments!.length})` : ''}`, icon: Paperclip },
              ].map(tab => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:font-semibold rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none px-3 py-2 text-xs text-muted-foreground"
                  data-testid={`tab-detail-${tab.value}`}
                >
                  <tab.icon className="w-3.5 h-3.5 ml-1" />{tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* ── Details Tab ── */}
            <TabsContent value="details" className="flex-1 overflow-y-auto p-5 mt-0 space-y-5">
              {/* Status & Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1"><Flag className="w-3 h-3" />الأولوية</Label>
                  <Select value={selectedTask.priority} onValueChange={v => { updateTaskMutation.mutate({ id: selectedTask.id, priority: v }); setSelectedTask({ ...selectedTask, priority: v }); }}>
                    <SelectTrigger className="h-8 text-sm" data-testid="select-detail-priority"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="urgent">🔴 عاجل</SelectItem>
                      <SelectItem value="high">🟠 عالي</SelectItem>
                      <SelectItem value="medium">🔵 متوسط</SelectItem>
                      <SelectItem value="low">⚪ منخفض</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1"><StatusIcon className="w-3 h-3" />الحالة</Label>
                  {isManager ? (
                    <Select value={selectedTask.status} onValueChange={v => { updateTaskMutation.mutate({ id: selectedTask.id, status: v }); setSelectedTask({ ...selectedTask, status: v }); }}>
                      <SelectTrigger className="h-8 text-sm" data-testid="select-detail-status"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_started">⚪ لم تبدأ</SelectItem>
                        <SelectItem value="in_progress">🔵 قيد التنفيذ</SelectItem>
                        <SelectItem value="pending_approval">🟡 بانتظار الموافقة</SelectItem>
                        <SelectItem value="completed">✅ مكتملة</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex items-center gap-2 h-8 px-3 rounded-md border bg-muted/30 text-sm">
                      <StatusIcon className={`w-3.5 h-3.5 ${STATUS_CONFIG[selectedTask.status]?.color}`} />
                      {STATUS_CONFIG[selectedTask.status]?.label}
                    </div>
                  )}
                </div>
              </div>

              {/* Assignee & Creator */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1"><User className="w-3 h-3" />المسؤول</Label>
                  {isManager ? (
                    <Select
                      value={selectedTask.assignedTo ? String(selectedTask.assignedTo) : 'none'}
                      onValueChange={v => {
                        const assignedTo = v === 'none' ? null : parseInt(v);
                        const assignee = portalUsers.find((u: any) => u.id === assignedTo);
                        updateTaskMutation.mutate({ id: selectedTask.id, assignedTo });
                        setSelectedTask({ ...selectedTask, assignedTo, assigneeName: assignee?.name || null, assigneeEmail: assignee?.email || null });
                      }}
                    >
                      <SelectTrigger className="h-8 text-sm" data-testid="select-detail-assignee"><SelectValue placeholder="اختر المسؤول" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">بدون تعيين</SelectItem>
                        {portalUsers.map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.name}{u.role ? ` - ${roleLabels[u.role] || u.role}` : ''}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex items-center gap-2 h-8 px-3 rounded-md border bg-muted/30">
                      {selectedTask.assigneeName ? (
                        <>
                          <Avatar className="w-5 h-5"><AvatarFallback className="text-[8px] bg-primary/10 text-primary">{getInitials(selectedTask.assigneeName)}</AvatarFallback></Avatar>
                          <span className="text-sm truncate">{selectedTask.assigneeName}</span>
                        </>
                      ) : <span className="text-sm text-muted-foreground">غير معين</span>}
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1"><User className="w-3 h-3" />أنشأها</Label>
                  <div className="flex items-center gap-2 h-8 px-3 rounded-md border bg-muted/30 text-sm text-muted-foreground">
                    {selectedTask.creatorName || 'غير محدد'}
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" />تاريخ البداية</Label>
                  <Input
                    type="date" className="h-8 text-sm"
                    value={selectedTask.startDate ? selectedTask.startDate.split('T')[0] : ''}
                    onChange={e => { const startDate = e.target.value || null; updateTaskMutation.mutate({ id: selectedTask.id, startDate }); setSelectedTask({ ...selectedTask, startDate }); }}
                    data-testid="input-detail-start-date"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className={`text-xs flex items-center gap-1 ${overdueFlag ? 'text-red-500' : 'text-muted-foreground'}`}>
                    <Clock className="w-3 h-3" />تاريخ الاستحقاق
                    {overdueFlag && <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-red-500/15 text-red-600 dark:text-red-400 h-4">متأخر</Badge>}
                  </Label>
                  <Input
                    type="date" className={`h-8 text-sm ${overdueFlag ? 'border-red-500/40 text-red-500' : ''}`}
                    value={selectedTask.dueDate ? selectedTask.dueDate.split('T')[0] : ''}
                    onChange={e => { const dueDate = e.target.value || null; updateTaskMutation.mutate({ id: selectedTask.id, dueDate }); setSelectedTask({ ...selectedTask, dueDate }); }}
                    data-testid="input-detail-due-date"
                  />
                </div>
              </div>

              {/* Manual progress (only when no checklist) */}
              {(!selectedTask.checklist || selectedTask.checklist.length === 0) && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3 h-3" />نسبة الإنجاز اليدوية</Label>
                    <span className="text-xs font-medium tabular-nums text-foreground">{detailProgress}%</span>
                  </div>
                  <input
                    type="range" min={0} max={100} step={5}
                    value={detailProgress}
                    onChange={e => setDetailProgress(Number(e.target.value))}
                    onMouseUp={() => { updateTaskMutation.mutate({ id: selectedTask.id, progress: detailProgress }); setSelectedTask({ ...selectedTask, progress: detailProgress }); }}
                    onTouchEnd={() => { updateTaskMutation.mutate({ id: selectedTask.id, progress: detailProgress }); setSelectedTask({ ...selectedTask, progress: detailProgress }); }}
                    className="w-full accent-primary h-1.5 rounded-full cursor-pointer"
                    data-testid="input-detail-progress"
                  />
                  <div className="flex justify-between text-[9px] text-muted-foreground/40">
                    <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
                  </div>
                </div>
              )}

              {/* Labels */}
              {selectedTask.labels && selectedTask.labels.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1"><Tag className="w-3 h-3" />التصنيفات</Label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {selectedTask.labels.map((label, i) => (
                      <span key={i} className={`text-xs px-2 py-0.5 rounded-sm font-medium ${getLabelStyle(label)}`}>{label}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Dependencies */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1"><Link2 className="w-3 h-3" />المهام المرتبطة</Label>
                {selectedTask.dependencies && selectedTask.dependencies.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {selectedTask.dependencies.map(depId => {
                      const allTasks = boardData?.buckets?.flatMap(b => b.tasks) || [];
                      const depTask = allTasks.find(t => t.id === depId);
                      return (
                        <Badge key={depId} variant="secondary" className="gap-1 text-xs">
                          <Link2 className="w-2.5 h-2.5" />
                          {depTask?.title || `مهمة #${depId}`}
                          {isManager && (
                            <button className="mr-1 hover:text-destructive" onClick={() => {
                              const newDeps = (selectedTask.dependencies || []).filter(d => d !== depId);
                              updateDependenciesMutation.mutate({ id: selectedTask.id, dependencies: newDeps });
                              setSelectedTask({ ...selectedTask, dependencies: newDeps });
                            }}>×</button>
                          )}
                        </Badge>
                      );
                    })}
                  </div>
                )}
                {isManager && (
                  <Select value={dependencySelect} onValueChange={v => {
                    const depId = parseInt(v);
                    if (depId && !(selectedTask.dependencies || []).includes(depId)) {
                      const newDeps = [...(selectedTask.dependencies || []), depId];
                      updateDependenciesMutation.mutate({ id: selectedTask.id, dependencies: newDeps });
                      setSelectedTask({ ...selectedTask, dependencies: newDeps });
                    }
                    setDependencySelect('');
                  }}>
                    <SelectTrigger className="text-xs h-8" data-testid="select-dependency"><SelectValue placeholder="ربط بمهمة..." /></SelectTrigger>
                    <SelectContent>
                      {boardData?.buckets?.flatMap(b => b.tasks).filter(t => t.id !== selectedTask.id && !(selectedTask.dependencies || []).includes(t.id)).map(t => (
                        <SelectItem key={t.id} value={String(t.id)} className="text-xs">{t.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Recurrence */}
              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1"><Repeat className="w-3 h-3" />تكرار المهمة</Label>
                  {isManager && (
                    <button
                      className={`w-8 h-4 rounded-full transition-colors relative ${selectedTask.recurrence ? 'bg-primary' : 'bg-muted'}`}
                      onClick={() => {
                        if (selectedTask.recurrence) {
                          updateTaskMutation.mutate({ id: selectedTask.id, recurrence: null });
                          setSelectedTask({ ...selectedTask, recurrence: null });
                        } else {
                          const rec = { type: 'daily', interval: 1 };
                          updateTaskMutation.mutate({ id: selectedTask.id, recurrence: rec });
                          setSelectedTask({ ...selectedTask, recurrence: rec });
                        }
                      }}
                      data-testid="button-toggle-detail-recurrence"
                    >
                      <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all ${selectedTask.recurrence ? 'right-0.5' : 'left-0.5'}`} />
                    </button>
                  )}
                </div>
                {selectedTask.recurrence ? (
                  isManager ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs mb-1 block">نوع التكرار</Label>
                        <Select value={selectedTask.recurrence.type} onValueChange={v => { const rec = { ...selectedTask.recurrence!, type: v }; updateTaskMutation.mutate({ id: selectedTask.id, recurrence: rec }); setSelectedTask({ ...selectedTask, recurrence: rec }); }}>
                          <SelectTrigger className="h-7 text-xs" data-testid="select-detail-recurrence-type"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">يومي</SelectItem>
                            <SelectItem value="weekly">أسبوعي</SelectItem>
                            <SelectItem value="monthly">شهري</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs mb-1 block">الفترة</Label>
                        <Input type="number" min={1} max={30} className="h-7 text-xs" value={selectedTask.recurrence.interval} onChange={e => { const rec = { ...selectedTask.recurrence!, interval: parseInt(e.target.value) || 1 }; updateTaskMutation.mutate({ id: selectedTask.id, recurrence: rec }); setSelectedTask({ ...selectedTask, recurrence: rec }); }} data-testid="input-detail-recurrence-interval" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Repeat className="w-3.5 h-3.5 text-primary" />
                      <span className="text-xs">مهمة متكررة</span>
                      <Badge variant="secondary" className="text-xs">
                        {selectedTask.recurrence.type === 'daily' ? 'يومياً' : selectedTask.recurrence.type === 'weekly' ? 'أسبوعياً' : 'شهرياً'}
                        {selectedTask.recurrence.interval > 1 ? ` كل ${selectedTask.recurrence.interval}` : ''}
                      </Badge>
                    </div>
                  )
                ) : (
                  <p className="text-xs text-muted-foreground/50">لا يوجد تكرار</p>
                )}
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">إجراءات سريعة</Label>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => duplicateTaskMutation.mutate(selectedTask.id)} disabled={duplicateTaskMutation.isPending} data-testid="button-duplicate-task">
                    <Copy className="w-3.5 h-3.5 ml-1" />نسخ
                  </Button>
                  {isManager && (
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => saveTemplateMutation.mutate(selectedTask.id)} disabled={saveTemplateMutation.isPending} data-testid="button-save-template">
                      <Repeat className="w-3.5 h-3.5 ml-1" />قالب
                    </Button>
                  )}
                  {isManager && selectedTask.assignedTo && (
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => notifyMutation.mutate({ id: selectedTask.id, type: 'reminder' })} disabled={notifyMutation.isPending} data-testid="button-send-reminder">
                      <Mail className="w-3.5 h-3.5 ml-1" />تذكير
                    </Button>
                  )}
                  {isManager && overdueFlag && (
                    <Button variant="outline" size="sm" className="h-7 text-xs text-red-500 border-red-500/30" onClick={() => notifyMutation.mutate({ id: selectedTask.id, type: 'overdue' })} disabled={notifyMutation.isPending} data-testid="button-notify-overdue">
                      <AlertTriangle className="w-3.5 h-3.5 ml-1" />تنبيه تأخر
                    </Button>
                  )}
                </div>

                {/* نقل المهمة إلى صفحة المهام */}
                <div className="pt-1 border-t border-dashed border-navy/10">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs w-full border-gold/40 text-navy hover:bg-gold/10 hover:border-gold/70 transition-all font-medium"
                    onClick={() => {
                      setSendToTasksData({ targetDepartmentId: '', notes: '' });
                      setIsSendToTasksOpen(true);
                    }}
                    data-testid="button-send-to-tasks"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5 ml-1.5 text-gold" />
                    نقل إلى صفحة المهام للإحالة
                  </Button>
                </div>
              </div>

              {/* Footer meta */}
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-[10px] text-muted-foreground/50">أُنشئت: {new Date(selectedTask.createdAt).toLocaleDateString('ar-SA')}</span>
                {isManager && (
                  <LoadingButton
                    variant="ghost" size="sm"
                    className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                    loading={deleteTaskMutation.isPending}
                    loadingText="جاري الحذف..."
                    onClick={() => confirmDelete.confirm(() => deleteTaskMutation.mutate(selectedTask.id), { title: 'حذف المهمة', description: `هل أنت متأكد من حذف "${selectedTask.title}"؟ لا يمكن التراجع.`, confirmText: 'حذف المهمة' })}
                    data-testid="button-delete-task"
                  >
                    <Trash2 className="w-3.5 h-3.5 ml-1" />حذف المهمة
                  </LoadingButton>
                )}
              </div>
            </TabsContent>

            {/* ── Checklist Tab ── */}
            <TabsContent value="checklist" className="flex-1 overflow-y-auto p-5 mt-0 space-y-4">
              {checklistTotal > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>الإنجاز</span>
                    <span className="tabular-nums font-medium">{Math.round((checklistDone / checklistTotal) * 100)}%</span>
                  </div>
                  <Progress value={(checklistDone / checklistTotal) * 100} className="h-2" />
                </div>
              )}
              <div className="space-y-1.5">
                {selectedTask.checklist?.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 cursor-pointer group transition-colors"
                    onClick={() => toggleCheckItem(selectedTask, i)}
                    data-testid={`check-item-${i}`}
                  >
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${item.checked ? 'bg-primary border-primary' : 'border-muted-foreground/30'}`}>
                      {item.checked && <CheckSquare className="w-2.5 h-2.5 text-primary-foreground" />}
                    </div>
                    <span className={`text-sm flex-1 ${item.checked ? 'line-through text-muted-foreground/50' : 'text-foreground'}`}>{item.text}</span>
                  </div>
                ))}
                {checklistTotal === 0 && (
                  <div className="text-center py-10 text-muted-foreground/40">
                    <CheckSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">لا توجد عناصر في قائمة المراجعة</p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ── Comments Tab ── */}
            <TabsContent value="comments" className="flex-1 overflow-y-auto p-5 mt-0 flex flex-col">
              <div className="flex-1 space-y-4 mb-4 overflow-y-auto">
                {taskComments.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground/40">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">لا توجد تعليقات بعد</p>
                  </div>
                ) : taskComments.map(comment => (
                  <div key={comment.id} className={`flex gap-3 ${comment.type === 'activity' ? 'opacity-60' : ''}`}>
                    <Avatar className="w-7 h-7 flex-shrink-0 mt-0.5">
                      <AvatarFallback className="text-[9px] bg-primary/10 text-primary">{getInitials(comment.userName)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-medium">{comment.userName}</span>
                        <span className="text-[10px] text-muted-foreground">{timeAgo(comment.createdAt)}</span>
                        {comment.type === 'activity' && <Badge variant="outline" className="text-[9px] h-4 px-1">سجل</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{comment.content}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 border-t pt-3 flex-shrink-0">
                <Avatar className="w-7 h-7 flex-shrink-0">
                  <AvatarFallback className="text-[9px] bg-primary/10 text-primary">{getInitials(user?.name || '')}</AvatarFallback>
                </Avatar>
                <Input
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder="اكتب تعليقاً..."
                  className="text-sm h-8"
                  onKeyDown={e => { if (e.key === 'Enter' && commentText.trim()) { addCommentMutation.mutate({ taskId: selectedTask.id, content: commentText.trim() }); } }}
                  data-testid="input-comment"
                />
                <Button size="icon" className="h-8 w-8 shrink-0" disabled={!commentText.trim() || addCommentMutation.isPending} onClick={() => { if (commentText.trim()) addCommentMutation.mutate({ taskId: selectedTask.id, content: commentText.trim() }); }} data-testid="button-send-comment">
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>
            </TabsContent>

            {/* ── Attachments Tab ── */}
            <TabsContent value="attachments" className="flex-1 overflow-y-auto p-5 mt-0 space-y-4">
              <div className="space-y-2">
                {selectedTask.attachments && selectedTask.attachments.length > 0 ? selectedTask.attachments.map((att, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors" data-testid={`attachment-${i}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                        <Paperclip className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{att.name}</p>
                        <p className="text-[10px] text-muted-foreground">{((att.size || 0) / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" className="shrink-0 h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => confirmDelete.confirm(() => { deleteAttachmentMutation.mutate({ id: selectedTask.id, index: i }); const updated = [...(selectedTask.attachments || [])]; updated.splice(i, 1); setSelectedTask({ ...selectedTask, attachments: updated }); }, { title: 'حذف المرفق', description: `هل تريد حذف "${att.name}"؟`, confirmText: 'حذف المرفق' })} data-testid={`button-delete-attachment-${i}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )) : (
                  <div className="text-center py-10 text-muted-foreground/40">
                    <Paperclip className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">لا توجد مرفقات</p>
                  </div>
                )}
              </div>
              <input type="file" ref={fileInputRef} className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) uploadAttachmentMutation.mutate({ id: selectedTask.id, file }); e.target.value = ''; }} />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploadAttachmentMutation.isPending} className="w-full border-dashed h-10 text-sm" data-testid="button-upload-attachment">
                <Upload className="w-4 h-4 ml-2" />
                {uploadAttachmentMutation.isPending ? 'جاري الرفع...' : 'رفع ملف مرفق'}
              </Button>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    );
  };

  if (selectedBoardId && activeTab === 'board') {
    return (
      <DashboardLayout navGroups={navGroups} title="لوحة التخطيط" portalName={portalLabels[portal] || portal}>
        {renderKanban()}
        {renderTaskDetail()}
        <Dialog open={isCreateTaskOpen} onOpenChange={setIsCreateTaskOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" />
                إنشاء مهمة جديدة
              </DialogTitle>
              <DialogDescription>أضف مهمة جديدة للوحة التخطيط</DialogDescription>
            </DialogHeader>
            <div className="space-y-5 max-h-[60vh] overflow-y-auto">
              <div className="space-y-3">
                {boardData?.buckets && boardData.buckets.length > 1 && (
                  <div>
                    <Label className="flex items-center gap-1 mb-1"><FolderKanban className="w-3.5 h-3.5" />المجموعة *</Label>
                    <Select value={String(targetBucketId || '')} onValueChange={v => setTargetBucketId(parseInt(v))}>
                      <SelectTrigger data-testid="select-task-bucket"><SelectValue placeholder="اختر المجموعة..." /></SelectTrigger>
                      <SelectContent>
                        {boardData.buckets.map((b: any) => (
                          <SelectItem key={b.id} value={String(b.id)}>{b.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label className="flex items-center gap-1 mb-1"><Target className="w-3.5 h-3.5" />عنوان المهمة *</Label>
                  <Input
                    value={newTask.title}
                    onChange={e => { setNewTask(p => ({ ...p, title: e.target.value })); setSmartSuggestion(null); }}
                    placeholder="مثال: تحديث سياسة الأمان"
                    data-testid="input-task-title"
                  />
                  {/* Smart priority suggestion */}
                  {loadingSuggestion && (
                    <p className="text-[10px] text-muted-foreground/50 mt-1 flex items-center gap-1">
                      <span className="animate-pulse">●</span> جاري تحليل العنوان...
                    </p>
                  )}
                  {smartSuggestion && !loadingSuggestion && (
                    <div className="mt-1.5 flex items-center gap-2 p-2 rounded-md bg-primary/5 border border-primary/10">
                      <span className="text-xs text-muted-foreground">اقتراح ذكي:</span>
                      <Badge variant="secondary" className={`text-xs ${PRIORITY_CONFIG[smartSuggestion.priority]?.color || ''}`}>
                        <Flag className="w-2.5 h-2.5 ml-0.5" />{PRIORITY_CONFIG[smartSuggestion.priority]?.label}
                      </Badge>
                      {smartSuggestion.category && (
                        <span className="text-xs text-muted-foreground/70">{smartSuggestion.category}</span>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 text-[10px] px-1.5 text-primary ml-auto"
                        onClick={() => { setNewTask(p => ({ ...p, priority: smartSuggestion.priority })); setSmartSuggestion(null); }}
                        data-testid="button-accept-suggestion"
                      >
                        قبول ✓
                      </Button>
                      <button className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground" onClick={() => setSmartSuggestion(null)}>✕</button>
                    </div>
                  )}
                </div>
                <div>
                  <Label className="flex items-center gap-1 mb-1"><MessageSquare className="w-3.5 h-3.5" />الوصف</Label>
                  <Textarea value={newTask.description} onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))} placeholder="تفاصيل المهمة والمتطلبات..." data-testid="input-task-description" />
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <User className="w-3.5 h-3.5" />التعيين والجدولة
                </Label>
                <div>
                  <Label className="text-xs mb-1 block">المسؤول عن التنفيذ</Label>
                  <Select value={newTask.assignedTo} onValueChange={v => setNewTask(p => ({ ...p, assignedTo: v }))}>
                    <SelectTrigger data-testid="select-task-assignee">
                      <SelectValue placeholder="اختر الموظف المسؤول..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">بدون تعيين</SelectItem>
                      {portalUsers.map((u: any) => (
                        <SelectItem key={u.id} value={String(u.id)}>
                          {u.name}{u.role ? ` - ${roleLabels[u.role] || u.role}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs mb-1 flex items-center gap-1"><Flag className="w-3 h-3" />الأولوية</Label>
                    <Select value={newTask.priority} onValueChange={v => setNewTask(p => ({ ...p, priority: v }))}>
                      <SelectTrigger data-testid="select-task-priority"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="urgent">🔴 عاجل</SelectItem>
                        <SelectItem value="high">🟠 عالي</SelectItem>
                        <SelectItem value="medium">🔵 متوسط</SelectItem>
                        <SelectItem value="low">⚪ منخفض</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" />البداية</Label>
                    <Input
                      type="date"
                      value={newTask.startDate}
                      onChange={e => {
                        const v = e.target.value;
                        setNewTask(p => ({ ...p, startDate: v }));
                        if (newTask.dueDate && v && v > newTask.dueDate) setDateWarning('تاريخ البداية يجب أن يكون قبل تاريخ الاستحقاق');
                        else setDateWarning('');
                      }}
                      data-testid="input-task-start-date"
                    />
                  </div>
                  <div>
                    <Label className="text-xs mb-1 flex items-center gap-1"><Clock className="w-3 h-3" />الاستحقاق</Label>
                    <Input
                      type="date"
                      value={newTask.dueDate}
                      onChange={e => {
                        const v = e.target.value;
                        setNewTask(p => ({ ...p, dueDate: v }));
                        if (newTask.startDate && v && v < newTask.startDate) setDateWarning('تاريخ الاستحقاق يجب أن يكون بعد تاريخ البداية');
                        else setDateWarning('');
                      }}
                      className={dateWarning ? 'border-amber-500/50' : ''}
                      data-testid="input-task-due-date"
                    />
                  </div>
                </div>
                {dateWarning && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1" data-testid="text-date-warning">
                    <AlertTriangle className="w-3 h-3" />{dateWarning}
                  </p>
                )}
              </div>

              <Separator />

              <div className="space-y-3">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5" />التصنيف والمتابعة
                </Label>
                <div>
                  <Label className="text-xs mb-1 block">التصنيفات</Label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {LABEL_COLORS.map(lbl => (
                      <button key={lbl.name} className={`text-xs px-2 py-1 rounded-sm font-medium transition-opacity ${getLabelStyle(lbl.name)} ${newTask.labels.includes(lbl.name) ? 'opacity-100 ring-1 ring-foreground/20' : 'opacity-40'}`}
                        onClick={() => setNewTask(p => ({ ...p, labels: p.labels.includes(lbl.name) ? p.labels.filter(l => l !== lbl.name) : [...p.labels, lbl.name] }))}
                        data-testid={`button-label-${lbl.name}`}
                      >{lbl.name}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-xs mb-1 flex items-center gap-1"><CheckSquare className="w-3 h-3" />قائمة المراجعة</Label>
                  <div className="space-y-1.5">
                    {newTask.checklist.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 p-1.5 rounded-md bg-muted/30">
                        <CheckSquare className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-sm flex-1">{item.text}</span>
                        <Button size="icon" variant="ghost" onClick={() => setNewTask(p => ({ ...p, checklist: p.checklist.filter((_, idx) => idx !== i) }))}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    ))}
                    <div className="flex items-center gap-2">
                      <Input value={newCheckItem} onChange={e => setNewCheckItem(e.target.value)} placeholder="أضف عنصر مراجعة..." className="text-sm"
                        onKeyDown={e => { if (e.key === 'Enter' && newCheckItem.trim()) { setNewTask(p => ({ ...p, checklist: [...p.checklist, { text: newCheckItem.trim(), checked: false }] })); setNewCheckItem(''); }}}
                        data-testid="input-checklist-item"
                      />
                      <Button size="sm" variant="outline" onClick={() => { if (newCheckItem.trim()) { setNewTask(p => ({ ...p, checklist: [...p.checklist, { text: newCheckItem.trim(), checked: false }] })); setNewCheckItem(''); }}} data-testid="button-add-checklist">
                        <Plus className="w-3.5 h-3.5 ml-1" />إضافة
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Repeat className="w-3.5 h-3.5" />تكرار المهمة
                  </Label>
                  <button className={`w-9 h-5 rounded-full transition-colors ${recurrenceEnabled ? 'bg-primary' : 'bg-muted'}`} onClick={() => setRecurrenceEnabled(!recurrenceEnabled)} data-testid="button-toggle-recurrence">
                    <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${recurrenceEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                {recurrenceEnabled && (
                  <div className="space-y-2 p-3 rounded-md bg-muted/30 border border-muted">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">نوع التكرار</Label>
                        <Select value={recurrenceType} onValueChange={setRecurrenceType}>
                          <SelectTrigger data-testid="select-recurrence-type"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">يومي</SelectItem>
                            <SelectItem value="weekly">أسبوعي</SelectItem>
                            <SelectItem value="monthly">شهري</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">كل</Label>
                        <Input type="number" min={1} max={30} value={recurrenceInterval} onChange={e => setRecurrenceInterval(parseInt(e.target.value) || 1)} data-testid="input-recurrence-interval" />
                      </div>
                    </div>
                    {recurrenceType === 'weekly' && (
                      <div>
                        <Label className="text-xs mb-1 block">أيام الأسبوع</Label>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس'].map((day, i) => (
                            <button key={i} className={`text-xs px-2 py-1 rounded-sm border ${recurrenceDays.includes(i) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border'}`}
                              onClick={() => setRecurrenceDays(prev => prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i])} data-testid={`button-day-${i}`}>{day}</button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setIsCreateTaskOpen(false)}>إلغاء</Button>
              <LoadingButton
                onClick={() => createTaskMutation.mutate({
                  boardId: selectedBoardId, bucketId: targetBucketId,
                  title: newTask.title, description: newTask.description || null,
                  priority: newTask.priority,
                  assignedTo: newTask.assignedTo && newTask.assignedTo !== 'none' ? parseInt(newTask.assignedTo) : null,
                  startDate: newTask.startDate || null, dueDate: newTask.dueDate || null,
                  labels: newTask.labels, checklist: newTask.checklist,
                  recurrence: recurrenceEnabled ? { type: recurrenceType, interval: recurrenceInterval, daysOfWeek: recurrenceType === 'weekly' ? recurrenceDays : undefined } : null,
                })}
                disabled={!newTask.title.trim() || !targetBucketId}
                loading={createTaskMutation.isPending}
                loadingText="جاري الإنشاء..."
                className="hub-btn-gold font-medium"
                data-testid="button-submit-task"
              >
                <Plus className="w-4 h-4 ml-1" />
                إنشاء المهمة
              </LoadingButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={isCreateBucketOpen} onOpenChange={setIsCreateBucketOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>إنشاء مجموعة جديدة</DialogTitle><DialogDescription>أضف مجموعة جديدة (عمود) للوحة</DialogDescription></DialogHeader>
            <div className="space-y-4">
              <div><Label>اسم المجموعة</Label><Input value={newBucket.title} onChange={e => setNewBucket(p => ({ ...p, title: e.target.value }))} placeholder="مثال: المهام الجديدة" data-testid="input-bucket-title" /></div>
              <div>
                <Label>اللون</Label>
                <div className="flex items-center gap-2 mt-1">
                  {['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#1e3a5f'].map(c => (
                    <button key={c} className={`w-7 h-7 rounded-md border-2 transition-transform ${newBucket.color === c ? 'border-foreground scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} onClick={() => setNewBucket(p => ({ ...p, color: c }))} />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateBucketOpen(false)}>إلغاء</Button>
              <LoadingButton onClick={() => createBucketMutation.mutate({ boardId: selectedBoardId, title: newBucket.title, color: newBucket.color })} disabled={!newBucket.title.trim()} loading={createBucketMutation.isPending} loadingText="جاري الإنشاء..." data-testid="button-submit-bucket">إنشاء</LoadingButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout navGroups={navGroups} title="لوحة التخطيط" portalName={portalLabels[portal] || portal}>
      <div className="flex flex-col h-full">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
          <div className="border-b bg-card px-4 pt-2 flex-shrink-0 flex items-end justify-between gap-2">
            <TabsList className="bg-transparent gap-0.5 h-auto p-0">
              <TabsTrigger value="board" className="data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:font-semibold rounded-t-md rounded-b-none border-b-2 border-transparent data-[state=active]:border-gold data-[state=active]:shadow-none px-4 py-2.5 text-muted-foreground" data-testid="tab-board">
                <FolderKanban className="w-4 h-4 ml-1.5" />اللوحات
              </TabsTrigger>
              <TabsTrigger value="my-tasks" className="data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:font-semibold rounded-t-md rounded-b-none border-b-2 border-transparent data-[state=active]:border-gold data-[state=active]:shadow-none px-4 py-2.5 text-muted-foreground" data-testid="tab-my-tasks">
                <UserCheck className="w-4 h-4 ml-1.5" />مهامي
              </TabsTrigger>
              <TabsTrigger value="charts" className="data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:font-semibold rounded-t-md rounded-b-none border-b-2 border-transparent data-[state=active]:border-gold data-[state=active]:shadow-none px-4 py-2.5 text-muted-foreground" data-testid="tab-charts">
                <BarChart3 className="w-4 h-4 ml-1.5" />الإحصائيات
              </TabsTrigger>
              {isManager && (
                <TabsTrigger value="members" className="data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:font-semibold rounded-t-md rounded-b-none border-b-2 border-transparent data-[state=active]:border-gold data-[state=active]:shadow-none px-4 py-2.5 text-muted-foreground" data-testid="tab-members">
                  <Users className="w-4 h-4 ml-1.5" />الفريق
                </TabsTrigger>
              )}
              {isManager && (
                <TabsTrigger value="reports" className="data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:font-semibold rounded-t-md rounded-b-none border-b-2 border-transparent data-[state=active]:border-gold data-[state=active]:shadow-none px-4 py-2.5 text-muted-foreground" data-testid="tab-reports">
                  <FileBarChart2 className="w-4 h-4 ml-1.5" />تقارير الموظفين
                </TabsTrigger>
              )}
              {isManager && (
                <TabsTrigger value="workload" className="data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:font-semibold rounded-t-md rounded-b-none border-b-2 border-transparent data-[state=active]:border-gold data-[state=active]:shadow-none px-4 py-2.5 text-muted-foreground" data-testid="tab-workload">
                  <Flame className="w-4 h-4 ml-1.5" />أعباء العمل
                </TabsTrigger>
              )}
              <TabsTrigger value="burndown" className="data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:font-semibold rounded-t-md rounded-b-none border-b-2 border-transparent data-[state=active]:border-gold data-[state=active]:shadow-none px-4 py-2.5 text-muted-foreground" data-testid="tab-burndown">
                <TrendingUp className="w-4 h-4 ml-1.5" />الاحتراق
              </TabsTrigger>
              <TabsTrigger value="activity" className="data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:font-semibold rounded-t-md rounded-b-none border-b-2 border-transparent data-[state=active]:border-gold data-[state=active]:shadow-none px-4 py-2.5 text-muted-foreground" data-testid="tab-activity">
                <Activity className="w-4 h-4 ml-1.5" />الأنشطة
              </TabsTrigger>
              <TabsTrigger value="focus" className="data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:font-semibold rounded-t-md rounded-b-none border-b-2 border-transparent data-[state=active]:border-gold data-[state=active]:shadow-none px-4 py-2.5 text-muted-foreground" data-testid="tab-focus">
                <Heart className="w-4 h-4 ml-1.5" />التركيز
              </TabsTrigger>
            </TabsList>
            {isManager && (
              <div className="mb-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs h-8 border-navy/30 hover:bg-navy/5 text-navy dark:text-white"
                  onClick={() => setIsReportDialogOpen(true)}
                  data-testid="button-open-report"
                >
                  <FileBarChart2 className="w-3.5 h-3.5" />
                  تقرير الإدارة
                </Button>
              </div>
            )}
          </div>
          <TabsContent value="board" className="flex-1 overflow-auto mt-0">{renderBoardsList()}</TabsContent>
          <TabsContent value="my-tasks" className="flex-1 overflow-auto mt-0">{renderMyTasks()}</TabsContent>
          <TabsContent value="charts" className="flex-1 overflow-auto mt-0">{renderCharts()}</TabsContent>
          {isManager && <TabsContent value="members" className="flex-1 overflow-auto mt-0">{renderMembers()}</TabsContent>}
          {isManager && <TabsContent value="reports" className="flex-1 overflow-auto mt-0">{renderMemberReport()}</TabsContent>}
          {isManager && <TabsContent value="workload" className="flex-1 overflow-auto mt-0"><WorkloadHeatmap data={workloadData} isLoading={workloadLoading} /></TabsContent>}
          <TabsContent value="burndown" className="flex-1 overflow-auto mt-0"><BurndownChart data={burndownData} isLoading={burndownLoading} /></TabsContent>
          <TabsContent value="activity" className="flex-1 overflow-auto mt-0"><ActivityFeed data={activityData} isLoading={activityLoading} /></TabsContent>
          <TabsContent value="focus" className="flex-1 overflow-auto mt-0"><FocusTimer /></TabsContent>
        </Tabs>
      </div>

      {renderTaskDetail()}

      {/* ─── Report Dialog ─── */}
      <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileBarChart2 className="w-5 h-5 text-gold" />
              تقرير أداء الإدارة
            </DialogTitle>
            <DialogDescription>
              اختر نوع التقرير والفترة الزمنية، ثم اضغط تصدير
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* Date Range */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">الفترة الزمنية (اختياري)</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">من تاريخ</Label>
                  <Input type="date" value={reportDateFrom} onChange={e => setReportDateFrom(e.target.value)} data-testid="input-report-date-from" className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">إلى تاريخ</Label>
                  <Input type="date" value={reportDateTo} onChange={e => setReportDateTo(e.target.value)} data-testid="input-report-date-to" className="h-8 text-sm" />
                </div>
              </div>
            </div>

            {/* Include sections */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">أقسام التقرير</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'tasks', label: 'تفاصيل المهام', icon: '📋' },
                  { key: 'members', label: 'أداء الموظفين', icon: '👥' },
                  { key: 'overdue', label: 'المهام المتأخرة', icon: '⚠️' },
                  { key: 'boards', label: 'ملخص اللوحات', icon: '📌' },
                ].map(s => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setReportInclude(p => ({ ...p, [s.key]: !p[s.key as keyof typeof reportInclude] }))}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm text-right transition-colors ${
                      reportInclude[s.key as keyof typeof reportInclude]
                        ? 'border-navy/50 bg-navy/5 text-navy dark:bg-navy/20 dark:border-navy/40 dark:text-white font-medium'
                        : 'border-border text-muted-foreground hover:bg-muted/50'
                    }`}
                    data-testid={`toggle-report-${s.key}`}
                  >
                    <span className="text-base">{s.icon}</span>
                    <span>{s.label}</span>
                    {reportInclude[s.key as keyof typeof reportInclude] && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mr-auto" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Task count preview */}
            {teamData?.tasks && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground flex items-center gap-2">
                <Target className="w-4 h-4 text-gold shrink-0" />
                <span>
                  سيشمل التقرير <strong className="text-foreground">{teamData.tasks.length} مهمة</strong> للفريق
                  {teamData.members?.length ? ` — ${teamData.members.length} موظف` : ''}
                </span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 flex-row-reverse sm:flex-row-reverse">
            <Button variant="outline" onClick={() => setIsReportDialogOpen(false)} className="flex-1 sm:flex-none">
              إلغاء
            </Button>
            <Button
              variant="outline"
              className="flex-1 sm:flex-none gap-2 border-emerald-500/30 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
              onClick={handleGenerateExcelReport}
              disabled={isGeneratingReport}
              data-testid="button-export-excel"
            >
              <FileSpreadsheet className="w-4 h-4" />
              {isGeneratingReport ? 'جارٍ التصدير...' : 'تصدير Excel'}
            </Button>
            <Button
              className="flex-1 sm:flex-none gap-2 bg-navy hover:bg-navy/90 text-white"
              onClick={handleGeneratePDFReport}
              disabled={isGeneratingReport}
              data-testid="button-export-pdf"
            >
              <FileDown className="w-4 h-4" />
              {isGeneratingReport ? 'جارٍ الإنشاء...' : 'تصدير PDF'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateBoardOpen} onOpenChange={(open) => { setIsCreateBoardOpen(open); if (!open) { setShowTemplates(true); setSelectedTemplate(null); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LayoutTemplate className="w-5 h-5 text-gold" />
              إنشاء لوحة تخطيط جديدة
            </DialogTitle>
            <DialogDescription>اختر قالباً جاهزاً أو أنشئ لوحة مخصصة</DialogDescription>
          </DialogHeader>
          {showTemplates && !selectedTemplate ? (
            <div className="space-y-3">
              <Button variant="outline" className="w-full justify-start gap-2 text-sm" onClick={() => { setShowTemplates(false); setSelectedTemplate(null); }} data-testid="button-custom-board">
                <Plus className="w-4 h-4" />لوحة مخصصة بدون قالب
              </Button>
              <Separator />
              <p className="text-xs font-semibold text-muted-foreground">أو اختر من القوالب الجاهزة:</p>
              <BoardTemplates onSelect={(tmpl: BoardTemplate) => {
                setSelectedTemplate(tmpl.id);
                setNewBoard(p => ({ ...p, title: tmpl.title, description: tmpl.description, color: tmpl.color, templateBuckets: tmpl.buckets }));
                setShowTemplates(false);
              }} />
            </div>
          ) : (
            <div className="space-y-4">
              {selectedTemplate && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/10">
                  <Badge variant="outline" className="text-[10px]">قالب: {BOARD_TEMPLATES.find(t => t.id === selectedTemplate)?.title}</Badge>
                  <Button variant="ghost" size="sm" className="mr-auto text-xs" onClick={() => { setShowTemplates(true); setSelectedTemplate(null); setNewBoard({ title: '', description: '', color: '#1e3a5f', templateBuckets: [] }); }}>تغيير</Button>
                </div>
              )}
              <div><Label>عنوان اللوحة</Label><Input value={newBoard.title} onChange={e => setNewBoard(p => ({ ...p, title: e.target.value }))} placeholder="مثال: خطة الربع الأول" data-testid="input-board-title" /></div>
              <div><Label>الوصف</Label><Textarea value={newBoard.description} onChange={e => setNewBoard(p => ({ ...p, description: e.target.value }))} placeholder="وصف مختصر للوحة..." data-testid="input-board-description" /></div>
              <div>
                <Label>اللون</Label>
                <div className="flex items-center gap-2 mt-1">
                  {['#1e3a5f', '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'].map(c => (
                    <button key={c} className={`w-8 h-8 rounded-md border-2 transition-transform ${newBoard.color === c ? 'border-foreground scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} onClick={() => setNewBoard(p => ({ ...p, color: c }))} data-testid={`button-color-${c}`} />
                  ))}
                </div>
              </div>
              {newBoard.templateBuckets.length > 0 && (
                <div>
                  <Label>الأعمدة (من القالب)</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {newBoard.templateBuckets.map((b, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{b}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {!showTemplates && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateBoardOpen(false)}>إلغاء</Button>
              <LoadingButton onClick={() => createBoardMutation.mutate(newBoard)} disabled={!newBoard.title.trim()} loading={createBoardMutation.isPending} loadingText="جاري الإنشاء..." data-testid="button-submit-board">إنشاء</LoadingButton>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog {...confirmDelete.dialogProps} isPending={deleteBoardMutation.isPending || deleteBucketMutation.isPending || deleteTaskMutation.isPending || deleteAttachmentMutation.isPending} />

      {/* Dialog: نقل مهمة إلى صفحة المهام */}
      <Dialog open={isSendToTasksOpen} onOpenChange={setIsSendToTasksOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-navy text-base">
              <ArrowLeftRight className="w-5 h-5 text-gold" />
              نقل المهمة إلى صفحة المهام
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              سيتم إرسال نسخة من هذه المهمة إلى صفحة مهام الإدارة المختارة لتتمكن من متابعتها وإحالتها
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* اسم المهمة */}
            <div className="bg-navy/5 rounded-lg p-3 border border-navy/10">
              <p className="text-[10px] text-muted-foreground mb-1">المهمة المُختارة</p>
              <p className="text-sm font-medium text-navy">{selectedTask?.title || ''}</p>
            </div>

            {/* اختيار الإدارة */}
            <div className="space-y-1.5">
              <Label className="text-sm flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-gold" />
                الإدارة المستهدفة <span className="text-destructive">*</span>
              </Label>
              <Select
                value={sendToTasksData.targetDepartmentId}
                onValueChange={v => setSendToTasksData(p => ({ ...p, targetDepartmentId: v }))}
              >
                <SelectTrigger data-testid="select-target-department" className="h-9 text-sm">
                  <SelectValue placeholder="اختر الإدارة المستهدفة..." />
                </SelectTrigger>
                <SelectContent>
                  {IT_DEPARTMENTS_LIST.filter(d => d.id > 0).map(dept => (
                    <SelectItem key={dept.id} value={String(dept.id)}>
                      {dept.nameAr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ملاحظات */}
            <div className="space-y-1.5">
              <Label className="text-sm">ملاحظات الإحالة (اختياري)</Label>
              <Textarea
                placeholder="أضف أي تعليمات أو ملاحظات للإدارة المستهدفة..."
                rows={3}
                className="text-sm resize-none"
                value={sendToTasksData.notes}
                onChange={e => setSendToTasksData(p => ({ ...p, notes: e.target.value }))}
                data-testid="textarea-send-notes"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 flex-row-reverse">
            <LoadingButton
              loading={sendToTasksMutation.isPending}
              loadingText="جاري النقل..."
              disabled={!sendToTasksData.targetDepartmentId}
              className="bg-gold hover:bg-gold/90 text-white"
              onClick={() => selectedTask && sendToTasksMutation.mutate({
                id: selectedTask.id,
                targetDepartmentId: sendToTasksData.targetDepartmentId,
                notes: sendToTasksData.notes,
              })}
              data-testid="button-confirm-send-to-tasks"
            >
              <ArrowLeftRight className="w-4 h-4 ml-1" />
              نقل المهمة الآن
            </LoadingButton>
            <Button variant="outline" size="sm" onClick={() => setIsSendToTasksOpen(false)} data-testid="button-cancel-send-to-tasks">
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}