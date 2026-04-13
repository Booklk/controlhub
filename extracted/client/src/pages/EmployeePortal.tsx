import { useState, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import MyDayWidget from "@/components/MyDayWidget";
import { WelcomeBanner } from "@/components/WelcomeBanner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { exportToPDF, exportToExcel } from "@/lib/exports";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  LayoutDashboard, Bell, User, Building2, Shield,
  Ticket, BookOpen, CheckCircle2, AlertTriangle,
  FileText, Headphones, HelpCircle, XCircle,
  FileDown, FileSpreadsheet, ListTodo, CalendarDays,
  KanbanSquare, Target, BarChart3, Zap, Clock,
  TrendingUp, Star, Award, Flame, Activity,
  ChevronRight, ArrowUpRight, Circle, Inbox,
  RefreshCw, Eye, MessageSquare, Users, Layers,
  CheckSquare, Timer, AlertCircle, ThumbsUp,
  Sparkles, Briefcase, Network, Database, Code,
  Globe, Lock, Server, Mail, Send, MoreHorizontal,
  Plus, Filter, BellOff, BellRing, Wifi, WifiOff,
  PlayCircle, PauseCircle, TrendingDown
} from "lucide-react";

const navGroups = [
  {
    label: "الرئيسية",
    items: [
      { title: "لوحة التحكم", href: "/employee", icon: LayoutDashboard },
      { title: "مهامي", href: "/employee/planner", icon: KanbanSquare },
    ],
  },
];

const PORTAL_META: Record<string, { name: string; nameEn: string; color: string; bgClass: string; icon: any; accentBorder: string }> = {
  infrastructure: { name: "البنية التحتية", nameEn: "Infrastructure", color: "text-blue-400", bgClass: "bg-blue-500/10", icon: Server, accentBorder: "border-blue-400/30" },
  cybersecurity:  { name: "الأمن السيبراني", nameEn: "Cybersecurity", color: "text-red-400", bgClass: "bg-red-500/10", icon: Shield, accentBorder: "border-red-400/30" },
  digital_transformation: { name: "التحول الرقمي", nameEn: "Digital Transformation", color: "text-violet-400", bgClass: "bg-violet-500/10", icon: Code, accentBorder: "border-violet-400/30" },
  support: { name: "الدعم الفني", nameEn: "IT Support", color: "text-emerald-400", bgClass: "bg-emerald-500/10", icon: Headphones, accentBorder: "border-emerald-400/30" },
  dmo: { name: "إدارة البيانات", nameEn: "Data Management", color: "text-cyan-400", bgClass: "bg-cyan-500/10", icon: Database, accentBorder: "border-cyan-400/30" },
  committee: { name: "اللجان", nameEn: "Committee", color: "text-amber-400", bgClass: "bg-amber-500/10", icon: Users, accentBorder: "border-amber-400/30" },
};

const PORTAL_QUICK_ACTIONS: Record<string, { label: string; sub: string; icon: any; path: string; color: string }[]> = {
  infrastructure: [
    { label: "خوادم", sub: "إدارة الخوادم", icon: Server, path: "/department/infrastructure/servers", color: "text-blue-400" },
    { label: "شبكة", sub: "إدارة الشبكة", icon: Network, path: "/department/infrastructure", color: "text-cyan-400" },
    { label: "تذكرة دعم", sub: "طلب دعم فني", icon: Ticket, path: "/department/support/tickets", color: "text-amber-400" },
    { label: "قاعدة المعرفة", sub: "حلول وإرشادات", icon: BookOpen, path: "/department/support/knowledge-base", color: "text-emerald-400" },
  ],
  cybersecurity: [
    { label: "الحوادث", sub: "الحوادث الأمنية", icon: AlertTriangle, path: "/department/cybersecurity/incidents", color: "text-red-400" },
    { label: "الثغرات", sub: "الثغرات الأمنية", icon: Shield, path: "/department/cybersecurity/vulnerabilities", color: "text-orange-400" },
    { label: "تذكرة دعم", sub: "طلب دعم فني", icon: Ticket, path: "/department/support/tickets", color: "text-amber-400" },
    { label: "الاختبارات", sub: "اختبارات الاختراق", icon: Target, path: "/department/cybersecurity", color: "text-violet-400" },
  ],
  digital_transformation: [
    { label: "المبادرات", sub: "مبادرات التحول", icon: Layers, path: "/department/digital-transformation", color: "text-violet-400" },
    { label: "التطبيقات", sub: "إدارة التطبيقات", icon: Globe, path: "/department/digital-transformation", color: "text-blue-400" },
    { label: "تذكرة دعم", sub: "طلب دعم فني", icon: Ticket, path: "/department/support/tickets", color: "text-amber-400" },
    { label: "التقارير", sub: "تحليلات وتقارير", icon: BarChart3, path: "/department/digital-transformation", color: "text-emerald-400" },
  ],
  support: [
    { label: "التذاكر", sub: "تذاكر الدعم", icon: Ticket, path: "/department/support/tickets", color: "text-amber-400" },
    { label: "المعرفة", sub: "قاعدة المعرفة", icon: BookOpen, path: "/department/support/knowledge-base", color: "text-emerald-400" },
    { label: "الإحالات", sub: "طلبات الإحالة", icon: Send, path: "/department/support/referrals", color: "text-blue-400" },
    { label: "المستخدمون", sub: "إدارة المستخدمين", icon: Users, path: "/department/support", color: "text-violet-400" },
  ],
  dmo: [
    { label: "كتالوج البيانات", sub: "استعراض البيانات", icon: Database, path: "/dmo/data-catalog", color: "text-cyan-400" },
    { label: "طلبات الخصوصية", sub: "طلبات PDPL", icon: Lock, path: "/dmo/pdpl", color: "text-blue-400" },
    { label: "التدريب", sub: "دورات تدريبية", icon: BookOpen, path: "/dmo/training", color: "text-emerald-400" },
    { label: "تذكرة دعم", sub: "طلب دعم فني", icon: Ticket, path: "/department/support/tickets", color: "text-amber-400" },
  ],
  committee: [
    { label: "القرارات", sub: "قرارات اللجنة", icon: CheckSquare, path: "/committee/decisions", color: "text-amber-400" },
    { label: "المهام", sub: "مهام اللجنة", icon: ListTodo, path: "/committee/tasks", color: "text-emerald-400" },
    { label: "المحاضر", sub: "محاضر الجلسات", icon: FileText, path: "/committee/minutes", color: "text-blue-400" },
    { label: "تذكرة دعم", sub: "طلب دعم فني", icon: Ticket, path: "/department/support/tickets", color: "text-violet-400" },
  ],
};

const DEFAULT_QUICK_ACTIONS = [
  { label: "تذكرة دعم", sub: "إنشاء تذكرة جديدة", icon: Ticket, path: "/department/support/tickets", color: "text-amber-400" },
  { label: "قاعدة المعرفة", sub: "حلول وأدلة", icon: BookOpen, path: "/department/support/knowledge-base", color: "text-emerald-400" },
  { label: "السياسات", sub: "المستندات والسياسات", icon: FileText, path: "/department/support/knowledge-base", color: "text-blue-400" },
  { label: "المساعدة", sub: "الأسئلة الشائعة", icon: HelpCircle, path: "/department/support/tickets", color: "text-violet-400" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  connected: { label: "متصل", color: "text-emerald-400", icon: CheckCircle2 },
  active: { label: "نشط", color: "text-emerald-400", icon: CheckCircle2 },
  healthy: { label: "يعمل بشكل طبيعي", color: "text-emerald-400", icon: CheckCircle2 },
  online: { label: "متصل", color: "text-emerald-400", icon: Wifi },
  disconnected: { label: "غير متصل", color: "text-red-400", icon: WifiOff },
  error: { label: "خطأ", color: "text-red-400", icon: XCircle },
  offline: { label: "غير متصل", color: "text-red-400", icon: WifiOff },
  warning: { label: "تحذير", color: "text-amber-400", icon: AlertTriangle },
  degraded: { label: "أداء منخفض", color: "text-amber-400", icon: AlertTriangle },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  urgent:   { label: "عاجل",   color: "text-red-400",    bg: "bg-red-600/20",    border: "border-red-600/30" },
  critical: { label: "حرج",    color: "text-red-400",    bg: "bg-red-500/20",    border: "border-red-500/30" },
  high:     { label: "عالي",   color: "text-orange-400", bg: "bg-orange-500/20", border: "border-orange-500/30" },
  medium:   { label: "متوسط",  color: "text-amber-400",  bg: "bg-amber-500/20",  border: "border-amber-500/30" },
  low:      { label: "منخفض",  color: "text-blue-400",   bg: "bg-blue-500/20",   border: "border-blue-500/30" },
};

const TASK_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  completed:    { label: "مكتمل",       color: "text-emerald-400", bg: "bg-emerald-500/15" },
  done:         { label: "مكتمل",       color: "text-emerald-400", bg: "bg-emerald-500/15" },
  in_progress:  { label: "قيد التنفيذ", color: "text-blue-400",    bg: "bg-blue-500/15" },
  pending:      { label: "معلق",         color: "text-amber-400",   bg: "bg-amber-500/15" },
  cancelled:    { label: "ملغي",         color: "text-muted-foreground", bg: "bg-muted/20" },
};

function PriorityBadge({ priority }: { priority: string }) {
  const cfg = PRIORITY_CONFIG[(priority || "low").toLowerCase()] || PRIORITY_CONFIG.low;
  return (
    <Badge className={`text-[10px] px-1.5 py-0 ${cfg.bg} ${cfg.color} ${cfg.border} border`}>{cfg.label}</Badge>
  );
}

function TaskStatusBadge({ status }: { status: string }) {
  const key = (status || "pending").toLowerCase().replace(/ /g, "_");
  const cfg = TASK_STATUS_CONFIG[key] || { label: status, color: "text-muted-foreground", bg: "bg-muted/20" };
  return (
    <Badge className={`text-[10px] px-1.5 py-0 border-0 ${cfg.bg} ${cfg.color}`}>{cfg.label}</Badge>
  );
}

function ProductivityRing({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 15.5;
  const filled = (score / 100) * circumference;
  const color = score >= 75 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative w-20 h-20 mx-auto">
      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
        <circle cx="18" cy="18" r="15.5" fill="none"
          stroke={color} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          style={{ transition: "stroke-dasharray 1s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-white">{score}</span>
        <span className="text-[8px] text-white/40">%</span>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color, bar, barColor, testId }: {
  icon: any; label: string; value: string | number; sub?: string;
  color?: string; bar?: number; barColor?: string; testId?: string;
}) {
  return (
    <Card className="hub-card hub-card-gold hub-card-hover relative overflow-hidden" data-testid={testId}>
      <div className={`absolute inset-y-0 right-0 w-[3px] rounded-r-xl ${barColor || "bg-primary/40"}`} />
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          <div className={`p-1.5 rounded-lg ${barColor ? barColor.replace("bg-", "bg-").replace(/\/\d+$/, "/15") : "bg-primary/10"}`}>
            <Icon className={`w-3.5 h-3.5 ${color || "hub-stat-gold"}`} />
          </div>
        </div>
        <p className={`text-2xl font-bold ${color || "hub-stat-gold"}`} data-testid={testId ? `${testId}-value` : undefined}>{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</p>}
        {bar !== undefined && (
          <div className="mt-2 h-1 bg-border/30 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ${barColor || "bg-primary/60"}`}
              style={{ width: `${Math.min(bar, 100)}%` }} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SkeletonCard() {
  return (
    <Card className="hub-card hub-card-gold">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-20 bg-white/5" />
          <Skeleton className="h-6 w-6 rounded-lg bg-white/5" />
        </div>
        <Skeleton className="h-7 w-12 bg-white/5" />
        <Skeleton className="h-1 w-full bg-white/5" />
      </CardContent>
    </Card>
  );
}

function TaskRow({ task, idx, onClick }: { task: any; idx: number; onClick?: () => void }) {
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !["completed", "done", "مكتمل"].includes((task.status || "").toLowerCase());
  const daysUntilDue = task.dueDate ? Math.ceil((new Date(task.dueDate).getTime() - Date.now()) / 86400000) : null;
  return (
    <div
      className={`p-3 rounded-lg border transition-all duration-150 cursor-pointer hover:bg-white/5
        ${isOverdue ? "border-red-500/20 bg-red-500/5" : "border-border/30 bg-card/30"}`}
      data-testid={`task-row-${task.id || idx}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0
            ${isOverdue ? "bg-red-400" :
              (task.status || "").toLowerCase() === "completed" || (task.status || "").toLowerCase() === "done" ? "bg-emerald-400" :
              (task.status || "").toLowerCase() === "in_progress" ? "bg-blue-400" : "bg-amber-400"}`} />
          <p className="text-sm font-medium text-foreground truncate" data-testid={`task-title-${task.id || idx}`}>{task.title}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <TaskStatusBadge status={task.status || "pending"} />
          {task.priority && <PriorityBadge priority={task.priority} />}
        </div>
      </div>
      {task.dueDate && (
        <div className={`flex items-center gap-1 mt-1.5 mr-4 ${isOverdue ? "text-red-400" : daysUntilDue !== null && daysUntilDue <= 1 ? "text-amber-400" : "text-muted-foreground/50"}`}>
          <Clock className="w-3 h-3" />
          <span className="text-[10px]" data-testid={`task-due-${task.id || idx}`}>
            {isOverdue ? `متأخرة ${Math.abs(daysUntilDue ?? 0)} يوم` :
             daysUntilDue === 0 ? "اليوم" :
             daysUntilDue === 1 ? "غداً" :
             `${new Date(task.dueDate).toLocaleDateString("ar-SA")}`}
          </span>
        </div>
      )}
    </div>
  );
}

function TicketRow({ ticket, idx, onClick }: { ticket: any; idx: number; onClick?: () => void }) {
  return (
    <div
      className="p-3 rounded-lg border border-border/30 bg-card/30 hover:bg-white/5 transition-all duration-150 cursor-pointer"
      data-testid={`ticket-row-${ticket.id || idx}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate" data-testid={`ticket-title-${ticket.id || idx}`}>
            {ticket.title || ticket.subject || `تذكرة #${ticket.id}`}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-muted-foreground/50">#{ticket.id}</span>
            {ticket.department && <span className="text-[10px] text-muted-foreground/40">·  {ticket.department}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <TaskStatusBadge status={ticket.status || "pending"} />
          {ticket.priority && <PriorityBadge priority={ticket.priority} />}
        </div>
      </div>
    </div>
  );
}

function NotificationRow({ notif, idx, onMarkRead }: { notif: any; idx: number; onMarkRead: (id: number) => void }) {
  const isUnread = !notif.read;
  const typeIcon: Record<string, any> = {
    task: ListTodo, ticket: Ticket, system: Activity, alert: AlertTriangle, info: Inbox, success: CheckCircle2,
  };
  const typeColor: Record<string, string> = {
    task: "text-blue-400", ticket: "text-amber-400", system: "text-violet-400",
    alert: "text-red-400", info: "text-muted-foreground", success: "text-emerald-400",
  };
  const Icon = typeIcon[(notif.type || "info").toLowerCase()] || Bell;
  const color = typeColor[(notif.type || "info").toLowerCase()] || "text-muted-foreground";
  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg border transition-all duration-150
        ${isUnread ? "border-primary/20 bg-primary/5" : "border-border/20 bg-card/20"}`}
      data-testid={`notification-row-${notif.id || idx}`}
    >
      <div className={`mt-0.5 p-1.5 rounded-lg bg-white/5 flex-shrink-0`}>
        <Icon className={`w-3.5 h-3.5 ${color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${isUnread ? "text-foreground" : "text-muted-foreground"}`}
          data-testid={`notification-title-${notif.id || idx}`}>
          {notif.title || notif.message}
        </p>
        {notif.message && notif.title && (
          <p className="text-[11px] text-muted-foreground/60 mt-0.5 line-clamp-1">{notif.message}</p>
        )}
        <p className="text-[10px] text-muted-foreground/40 mt-1">
          {notif.createdAt ? new Date(notif.createdAt).toLocaleDateString("ar-SA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
        </p>
      </div>
      {isUnread && (
        <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0"
          data-testid={`btn-read-${notif.id || idx}`}
          onClick={() => onMarkRead(notif.id)}
        >
          <Eye className="w-3.5 h-3.5 text-muted-foreground/50" />
        </Button>
      )}
    </div>
  );
}

export default function EmployeePortal() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("overview");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const portalMeta = user?.portal ? PORTAL_META[user.portal] : null;
  const quickActions = user?.portal ? (PORTAL_QUICK_ACTIONS[user.portal] || DEFAULT_QUICK_ACTIONS) : DEFAULT_QUICK_ACTIONS;

  const { data: notifications = [], isLoading: notifLoading } = useQuery<any[]>({
    queryKey: ["/api/notifications"],
    enabled: !!user,
  });

  const { data: allTasks = [], isLoading: tasksLoading } = useQuery<any[]>({
    queryKey: ["/api/tasks"],
    enabled: !!user,
  });

  const { data: tickets = [], isLoading: ticketsLoading } = useQuery<any[]>({
    queryKey: ["/api/it-tickets"],
    enabled: !!user,
  });

  const { data: externalSystems = [], isLoading: systemsLoading } = useQuery<any[]>({
    queryKey: ["/api/external-systems"],
    enabled: !!user,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PUT", `/api/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
    onError: (error: Error) => { toast({ title: "خطأ", description: error.message, variant: "destructive" }); },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiRequest("PUT", "/api/notifications/read-all"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
    onError: (error: Error) => { toast({ title: "خطأ", description: error.message, variant: "destructive" }); },
  });

  const myTasks = useMemo(() =>
    allTasks.filter((t: any) =>
      t.assignedTo === user?.name || t.assignedTo === user?.email || t.createdBy === user?.id
    ), [allTasks, user]);

  const myTickets = useMemo(() =>
    tickets.filter((t: any) =>
      t.createdBy === user?.id || t.assignedTo === user?.id || t.reporterEmail === user?.email
    ), [tickets, user]);

  const unreadNotifications = useMemo(() => notifications.filter((n: any) => !n.read), [notifications]);
  const unreadCount = unreadNotifications.length;

  const completedTasks = useMemo(() => myTasks.filter((t: any) => ["completed", "done", "مكتمل"].includes((t.status || "").toLowerCase())), [myTasks]);
  const inProgressTasks = useMemo(() => myTasks.filter((t: any) => ["in_progress", "قيد التنفيذ"].includes((t.status || "").toLowerCase())), [myTasks]);
  const pendingTasks = useMemo(() => myTasks.filter((t: any) => ["pending", "معلق", "todo"].includes((t.status || "").toLowerCase())), [myTasks]);

  const overdueTasks = useMemo(() => myTasks.filter((t: any) => {
    if (!t.dueDate) return false;
    return new Date(t.dueDate) < new Date() && !["completed", "done", "مكتمل"].includes((t.status || "").toLowerCase());
  }), [myTasks]);

  const todayTasks = useMemo(() => myTasks.filter((t: any) => {
    if (!t.dueDate) return false;
    const due = new Date(t.dueDate);
    const today = new Date();
    return due.toDateString() === today.toDateString() && !["completed", "done"].includes((t.status || "").toLowerCase());
  }), [myTasks]);

  const urgentTasks = useMemo(() => myTasks.filter((t: any) =>
    ["urgent", "critical"].includes((t.priority || "").toLowerCase()) && !["completed", "done"].includes((t.status || "").toLowerCase())
  ), [myTasks]);

  const resolvedTickets = useMemo(() => tickets.filter((t: any) => ["resolved", "closed"].includes((t.status || "").toLowerCase())), [tickets]);

  const taskCompletionRate = myTasks.length > 0 ? Math.round((completedTasks.length / myTasks.length) * 100) : 0;
  const ticketResolutionRate = tickets.length > 0 ? Math.round((resolvedTickets.length / tickets.length) * 100) : 0;

  const productivityScore = Math.min(100, Math.round(
    (taskCompletionRate * 0.4) +
    (ticketResolutionRate * 0.3) +
    (overdueTasks.length === 0 ? 30 : Math.max(0, 30 - overdueTasks.length * 10))
  ));

  const productivityLabel = productivityScore >= 80 ? "ممتاز" : productivityScore >= 60 ? "جيد جداً" : productivityScore >= 40 ? "مقبول" : "يحتاج تحسين";
  const productivityColor = productivityScore >= 80 ? "text-emerald-400" : productivityScore >= 60 ? "text-blue-400" : productivityScore >= 40 ? "text-amber-400" : "text-red-400";

  const displayTickets = myTickets.length > 0 ? myTickets : tickets;

  const servicesHealthy = externalSystems.filter((s: any) => ["connected", "active", "healthy", "online"].includes((s.status || s.connectionStatus || "").toLowerCase())).length;
  const servicesDegraded = externalSystems.filter((s: any) => ["warning", "degraded"].includes((s.status || s.connectionStatus || "").toLowerCase())).length;
  const servicesDown = externalSystems.filter((s: any) => ["disconnected", "error", "offline"].includes((s.status || s.connectionStatus || "").toLowerCase())).length;

  const currentHour = new Date().getHours();
  const greeting = currentHour < 6 ? "طاب مساؤك" : currentHour < 12 ? "صباح الخير" : currentHour < 18 ? "مساء الخير" : "مساء النور";

  const handleExportPDF = () => {
    const data = myTasks.map((t: any) => ({
      title: t.title || "",
      status: t.status || "",
      priority: t.priority || "",
      dueDate: t.dueDate ? new Date(t.dueDate).toLocaleDateString("ar-SA") : "",
    }));
    exportToPDF({ data, columns: [
      { header: "المهمة", key: "title" },
      { header: "الحالة", key: "status" },
      { header: "الأولوية", key: "priority" },
      { header: "الاستحقاق", key: "dueDate" },
    ], title: "تقرير مهامي", filename: "employee-tasks", orientation: "portrait" });
  };

  const handleExportExcel = () => {
    const data = myTasks.map((t: any) => ({
      title: t.title || "",
      status: t.status || "",
      priority: t.priority || "",
      dueDate: t.dueDate ? new Date(t.dueDate).toLocaleDateString("ar-SA") : "",
    }));
    exportToExcel({ data, columns: [
      { header: "المهمة", key: "title" },
      { header: "الحالة", key: "status" },
      { header: "الأولوية", key: "priority" },
      { header: "الاستحقاق", key: "dueDate" },
    ], title: "تقرير مهامي", filename: "employee-tasks" });
  };

  return (
    <DashboardLayout title="بوابة الموظفين" navGroups={navGroups} portalName="بوابة الموظفين">
      <div className="space-y-6" dir="rtl">

        {/* ── بانر الترحيب ── */}
        <WelcomeBanner
          portal="employee"
          userName={user?.name}
          portalName={portalMeta?.name || "بوابة الموظفين"}
          stats={{
            pendingTasks: pendingTasks.length + inProgressTasks.length,
            openTickets: displayTickets.filter((t: any) => !["resolved", "closed"].includes((t.status || "").toLowerCase())).length,
            completedToday: completedTasks.length,
            overdueItems: overdueTasks.length,
          }}
          className="animate-fadeInUp"
        />

        {/* ── صف KPIs ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 animate-fadeInUp stagger-1">
          {tasksLoading ? (
            [1,2,3,4,5,6].map(i => <SkeletonCard key={i} />)
          ) : (<>
            <StatCard icon={ListTodo} label="إجمالي مهامي" value={myTasks.length}
              sub={`${completedTasks.length} مكتملة`} color="text-foreground" barColor="bg-primary/50"
              bar={taskCompletionRate} testId="stat-total-tasks" />
            <StatCard icon={PlayCircle} label="قيد التنفيذ" value={inProgressTasks.length}
              sub="مهمة نشطة" color="text-blue-400" barColor="bg-blue-500"
              bar={myTasks.length > 0 ? Math.round((inProgressTasks.length / myTasks.length) * 100) : 0}
              testId="stat-inprogress-tasks" />
            <StatCard icon={CheckCircle2} label="معدل الإنجاز" value={`${taskCompletionRate}%`}
              sub={`${completedTasks.length} / ${myTasks.length}`} color="text-emerald-400" barColor="bg-emerald-500"
              bar={taskCompletionRate} testId="stat-completion-rate" />
            <StatCard icon={AlertTriangle} label="متأخرة" value={overdueTasks.length}
              sub={overdueTasks.length > 0 ? "تحتاج انتباهاً" : "لا تأخير"} 
              color={overdueTasks.length > 0 ? "text-red-400" : "text-emerald-400"}
              barColor={overdueTasks.length > 0 ? "bg-red-500" : "bg-emerald-500"}
              bar={overdueTasks.length > 0 ? Math.min(100, overdueTasks.length * 20) : 100}
              testId="stat-overdue-tasks" />
            <StatCard icon={Ticket} label="تذاكري" value={displayTickets.length}
              sub={`${resolvedTickets.length} محلولة`} color="text-amber-400" barColor="bg-amber-500"
              bar={ticketResolutionRate} testId="stat-my-tickets" />
            <StatCard icon={Bell} label="إشعارات جديدة" value={unreadCount}
              sub={unreadCount > 0 ? "غير مقروءة" : "لا إشعارات جديدة"}
              color={unreadCount > 0 ? "text-violet-400" : "text-muted-foreground"}
              barColor={unreadCount > 0 ? "bg-violet-500" : "bg-muted/30"}
              bar={Math.min(100, unreadCount * 10)} testId="stat-notifications" />
          </>)}
        </div>

        {/* ── التبويبات الرئيسية ── */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="animate-fadeInUp stagger-2">
          <TabsList className="w-full bg-card/50 border border-border/30 p-1 h-auto flex-wrap gap-1" data-testid="tabs-main">
            <TabsTrigger value="overview" className="flex-1 text-xs gap-1.5" data-testid="tab-overview">
              <LayoutDashboard className="w-3.5 h-3.5" /> نظرة عامة
            </TabsTrigger>
            <TabsTrigger value="tasks" className="flex-1 text-xs gap-1.5" data-testid="tab-tasks">
              <ListTodo className="w-3.5 h-3.5" /> مهامي
              {overdueTasks.length > 0 && (
                <span className="bg-red-500 text-white text-[9px] rounded-full px-1 min-w-[14px] text-center">{overdueTasks.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="tickets" className="flex-1 text-xs gap-1.5" data-testid="tab-tickets">
              <Ticket className="w-3.5 h-3.5" /> تذاكري
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex-1 text-xs gap-1.5" data-testid="tab-notifications">
              <Bell className="w-3.5 h-3.5" /> الإشعارات
              {unreadCount > 0 && (
                <span className="bg-violet-500 text-white text-[9px] rounded-full px-1 min-w-[14px] text-center">{unreadCount}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="services" className="flex-1 text-xs gap-1.5" data-testid="tab-services">
              <Activity className="w-3.5 h-3.5" /> الخدمات
            </TabsTrigger>
          </TabsList>

          {/* ── تبويب: نظرة عامة ── */}
          <TabsContent value="overview" className="space-y-5 mt-5">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

              {/* بطاقة الأداء الشخصي */}
              <Card className="hub-card hub-card-gold" data-testid="card-performance">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Award className="w-4 h-4 hub-stat-gold" /> الأداء الشخصي
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <ProductivityRing score={productivityScore} />
                    <div>
                      <p className={`text-lg font-bold ${productivityColor}`} data-testid="text-productivity-label">{productivityLabel}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">مؤشر الإنتاجية</p>
                      <div className="flex items-center gap-1 mt-2">
                        {productivityScore >= 60
                          ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                          : <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
                        <span className="text-[11px] text-muted-foreground">
                          {productivityScore >= 60 ? "أداء ممتاز" : "يمكن التحسين"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Separator className="bg-border/30" />
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">إنجاز المهام</span>
                      <span className="text-emerald-400 font-medium">{taskCompletionRate}%</span>
                    </div>
                    <Progress value={taskCompletionRate} className="h-1.5" />
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">حل التذاكر</span>
                      <span className="text-blue-400 font-medium">{ticketResolutionRate}%</span>
                    </div>
                    <Progress value={ticketResolutionRate} className="h-1.5" />
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">الالتزام بالمواعيد</span>
                      <span className={`font-medium ${overdueTasks.length === 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {overdueTasks.length === 0 ? "100%" : `${Math.max(0, 100 - overdueTasks.length * 20)}%`}
                      </span>
                    </div>
                    <Progress value={overdueTasks.length === 0 ? 100 : Math.max(0, 100 - overdueTasks.length * 20)} className="h-1.5" />
                  </div>
                </CardContent>
              </Card>

              {/* بطاقة اليوم */}
              <Card className="hub-card hub-card-gold" data-testid="card-today">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 hub-stat-gold" />
                    {greeting}، {user?.name?.split(" ")[0]}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* ملخص اليوم */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20" data-testid="today-due">
                      <p className="text-xs text-muted-foreground mb-0.5">مستحق اليوم</p>
                      <p className="text-xl font-bold text-blue-400">{todayTasks.length}</p>
                    </div>
                    <div className={`p-2.5 rounded-lg border ${urgentTasks.length > 0 ? "bg-red-500/10 border-red-500/20" : "bg-emerald-500/10 border-emerald-500/20"}`} data-testid="today-urgent">
                      <p className="text-xs text-muted-foreground mb-0.5">عاجل / حرج</p>
                      <p className={`text-xl font-bold ${urgentTasks.length > 0 ? "text-red-400" : "text-emerald-400"}`}>{urgentTasks.length}</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20" data-testid="today-overdue">
                      <p className="text-xs text-muted-foreground mb-0.5">متأخرة</p>
                      <p className="text-xl font-bold text-amber-400">{overdueTasks.length}</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20" data-testid="today-completed">
                      <p className="text-xs text-muted-foreground mb-0.5">مكتملة</p>
                      <p className="text-xl font-bold text-emerald-400">{completedTasks.length}</p>
                    </div>
                  </div>
                  <Separator className="bg-border/30" />
                  {/* مهام عاجلة */}
                  {urgentTasks.length > 0 ? (
                    <div className="space-y-1.5">
                      <p className="text-[11px] text-red-400 font-medium flex items-center gap-1">
                        <Flame className="w-3 h-3" /> تحتاج اهتماماً فورياً
                      </p>
                      {urgentTasks.slice(0, 2).map((t: any, i: number) => (
                        <div key={t.id || i} className="flex items-center gap-2 p-2 rounded bg-red-500/10 border border-red-500/20"
                          data-testid={`urgent-task-${t.id || i}`}>
                          <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
                          <p className="text-xs text-foreground truncate">{t.title}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <ThumbsUp className="w-4 h-4 text-emerald-400" />
                      <p className="text-xs text-emerald-400">لا توجد مهام عاجلة اليوم</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* بطاقة الملف الشخصي */}
              <Card className="hub-card hub-card-gold" data-testid="card-profile">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <User className="w-4 h-4 hub-stat-gold" /> الملف الشخصي
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 border-2 border-primary/30">
                      <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
                        {(user?.name || "م").charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-foreground" data-testid="text-user-name">{user?.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5" data-testid="text-user-job">{user?.jobTitle || "موظف"}</p>
                      {portalMeta && (
                        <Badge variant="outline" className={`text-[10px] mt-1 gap-1 ${portalMeta.accentBorder} ${portalMeta.color}`}
                          data-testid="badge-portal-type">
                          <portalMeta.icon className="w-2.5 h-2.5" />
                          {portalMeta.name}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Separator className="bg-border/30" />
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <Mail className="w-3 h-3 text-muted-foreground/50" />
                      <span className="text-muted-foreground/70 truncate" data-testid="text-user-email">{user?.email}</span>
                    </div>
                    {user?.portal && (
                      <div className="flex items-center gap-2">
                        <Briefcase className="w-3 h-3 text-muted-foreground/50" />
                        <span className="text-muted-foreground/70">{portalMeta?.name || user.portal}</span>
                      </div>
                    )}
                  </div>
                  <Separator className="bg-border/30" />
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 text-xs gap-1.5 h-8" onClick={handleExportPDF}
                      data-testid="btn-export-pdf">
                      <FileDown className="w-3.5 h-3.5" /> PDF
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 text-xs gap-1.5 h-8" onClick={handleExportExcel}
                      data-testid="btn-export-excel">
                      <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* الإجراءات السريعة */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 hub-stat-gold" />
                <h2 className="text-sm font-semibold text-foreground" data-testid="text-quick-actions-title">إجراءات سريعة</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {quickActions.map((action, idx) => (
                  <Card key={idx}
                    className="hub-card hub-card-gold hub-card-hover cursor-pointer group"
                    data-testid={`quick-action-${idx}`}
                    onClick={() => setLocation(action.path)}
                  >
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className={`p-2 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors`}>
                        <action.icon className={`w-5 h-5 ${action.color}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{action.label}</p>
                        <p className="text-[10px] text-muted-foreground/60 truncate">{action.sub}</p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 mr-auto flex-shrink-0 rtl:rotate-180" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* ويدجت يومي + أول 3 مهام */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <MyDayWidget portal="employee" />
              <Card className="hub-card hub-card-gold" data-testid="card-upcoming-tasks">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Target className="w-4 h-4 hub-stat-gold" /> المهام القادمة
                    </CardTitle>
                    <Button variant="ghost" size="sm" className="text-xs h-7 hub-stat-gold gap-1"
                      data-testid="btn-view-all-tasks" onClick={() => setActiveTab("tasks")}>
                      الكل <ArrowUpRight className="w-3 h-3" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {tasksLoading ? (
                    <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full bg-white/5" />)}</div>
                  ) : myTasks.filter((t: any) => !["completed", "done"].includes((t.status || "").toLowerCase())).length > 0 ? (
                    <div className="space-y-2">
                      {myTasks
                        .filter((t: any) => !["completed", "done"].includes((t.status || "").toLowerCase()))
                        .sort((a: any, b: any) => {
                          const priorityOrder: Record<string, number> = { urgent: 0, critical: 1, high: 2, medium: 3, low: 4 };
                          return (priorityOrder[a.priority] ?? 5) - (priorityOrder[b.priority] ?? 5);
                        })
                        .slice(0, 4)
                        .map((task: any, idx: number) => (
                          <TaskRow key={task.id || idx} task={task} idx={idx}
                            onClick={() => setLocation("/employee/planner")} />
                        ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center py-6 text-center">
                      <CheckCircle2 className="w-10 h-10 text-emerald-400/40 mb-2" />
                      <p className="text-sm text-muted-foreground/60">أنجزت جميع مهامك!</p>
                      <p className="text-xs text-muted-foreground/40 mt-0.5">عمل رائع</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── تبويب: مهامي ── */}
          <TabsContent value="tasks" className="space-y-4 mt-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-semibold text-foreground" data-testid="text-tasks-heading">مهامي الكاملة</h2>
                <Badge variant="outline" className="hub-stat-gold border-primary/30 text-xs" data-testid="badge-all-tasks-count">
                  {myTasks.length} مهمة
                </Badge>
              </div>
              <Button variant="outline" size="sm" className="text-xs gap-1.5" data-testid="btn-open-planner"
                onClick={() => setLocation("/employee/planner")}>
                <KanbanSquare className="w-3.5 h-3.5" /> لوحة التخطيط
              </Button>
            </div>

            {/* فلتر سريع */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "الكل", count: myTasks.length, color: "text-foreground", bg: "bg-card/50" },
                { label: "قيد التنفيذ", count: inProgressTasks.length, color: "text-blue-400", bg: "bg-blue-500/10" },
                { label: "متأخرة", count: overdueTasks.length, color: "text-red-400", bg: "bg-red-500/10" },
                { label: "مكتملة", count: completedTasks.length, color: "text-emerald-400", bg: "bg-emerald-500/10" },
              ].map((f, i) => (
                <div key={i} className={`p-2.5 rounded-lg border border-border/30 text-center ${f.bg}`}
                  data-testid={`tasks-filter-${i}`}>
                  <p className={`text-lg font-bold ${f.color}`}>{f.count}</p>
                  <p className="text-[10px] text-muted-foreground/60">{f.label}</p>
                </div>
              ))}
            </div>

            {tasksLoading ? (
              <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 w-full bg-white/5" />)}</div>
            ) : myTasks.length > 0 ? (
              <ScrollArea className="h-[500px] pr-2">
                <div className="space-y-2">
                  {/* متأخرة أولاً */}
                  {overdueTasks.length > 0 && (
                    <div className="mb-3">
                      <p className="text-[11px] text-red-400 font-medium flex items-center gap-1 mb-2">
                        <AlertCircle className="w-3 h-3" /> متأخرة ({overdueTasks.length})
                      </p>
                      {overdueTasks.map((t: any, i: number) => (
                        <TaskRow key={`ov-${t.id || i}`} task={t} idx={i}
                          onClick={() => setLocation("/employee/planner")} />
                      ))}
                    </div>
                  )}
                  {/* عاجل / حرج */}
                  {urgentTasks.filter((t: any) => !overdueTasks.includes(t)).length > 0 && (
                    <div className="mb-3">
                      <p className="text-[11px] text-amber-400 font-medium flex items-center gap-1 mb-2">
                        <Flame className="w-3 h-3" /> عاجل / حرج ({urgentTasks.filter((t: any) => !overdueTasks.includes(t)).length})
                      </p>
                      {urgentTasks.filter((t: any) => !overdueTasks.includes(t)).map((t: any, i: number) => (
                        <TaskRow key={`ur-${t.id || i}`} task={t} idx={i}
                          onClick={() => setLocation("/employee/planner")} />
                      ))}
                    </div>
                  )}
                  {/* باقي المهام */}
                  {myTasks
                    .filter((t: any) => !overdueTasks.includes(t) && !urgentTasks.includes(t))
                    .map((t: any, i: number) => (
                      <TaskRow key={`t-${t.id || i}`} task={t} idx={i}
                        onClick={() => setLocation("/employee/planner")} />
                    ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex flex-col items-center py-16 text-center">
                <ListTodo className="w-12 h-12 text-muted-foreground/20 mb-3" />
                <p className="text-sm text-muted-foreground/60" data-testid="text-no-tasks">لا توجد مهام مسندة إليك</p>
                <p className="text-xs text-muted-foreground/40 mt-1">ستظهر هنا عند إسناد مهام لك</p>
              </div>
            )}
          </TabsContent>

          {/* ── تبويب: تذاكري ── */}
          <TabsContent value="tickets" className="space-y-4 mt-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-semibold text-foreground" data-testid="text-tickets-heading">تذاكري</h2>
                <Badge variant="outline" className="hub-stat-gold border-primary/30 text-xs" data-testid="badge-tickets-total">
                  {displayTickets.length}
                </Badge>
              </div>
              <Button variant="outline" size="sm" className="text-xs gap-1.5" data-testid="btn-new-ticket"
                onClick={() => setLocation("/department/support/tickets")}>
                <Plus className="w-3.5 h-3.5" /> تذكرة جديدة
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "مفتوحة", count: displayTickets.filter((t: any) => (t.status || "").toLowerCase() === "open").length, color: "text-blue-400", bg: "bg-blue-500/10" },
                { label: "قيد المعالجة", count: displayTickets.filter((t: any) => ["in_progress", "pending"].includes((t.status || "").toLowerCase())).length, color: "text-amber-400", bg: "bg-amber-500/10" },
                { label: "محلولة", count: resolvedTickets.length, color: "text-emerald-400", bg: "bg-emerald-500/10" },
              ].map((f, i) => (
                <div key={i} className={`p-3 rounded-lg border border-border/30 text-center ${f.bg}`}
                  data-testid={`tickets-stat-${i}`}>
                  <p className={`text-xl font-bold ${f.color}`}>{f.count}</p>
                  <p className="text-[10px] text-muted-foreground/60">{f.label}</p>
                </div>
              ))}
            </div>

            {ticketsLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full bg-white/5" />)}</div>
            ) : displayTickets.length > 0 ? (
              <ScrollArea className="h-[450px] pr-2">
                <div className="space-y-2">
                  {displayTickets.map((ticket: any, idx: number) => (
                    <TicketRow key={ticket.id || idx} ticket={ticket} idx={idx}
                      onClick={() => setLocation("/department/support/tickets")} />
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex flex-col items-center py-16 text-center">
                <Ticket className="w-12 h-12 text-muted-foreground/20 mb-3" />
                <p className="text-sm text-muted-foreground/60" data-testid="text-no-tickets">لا توجد تذاكر</p>
                <Button variant="outline" size="sm" className="mt-3 text-xs gap-1.5"
                  data-testid="btn-create-first-ticket"
                  onClick={() => setLocation("/department/support/tickets")}>
                  <Plus className="w-3.5 h-3.5" /> إنشاء تذكرة
                </Button>
              </div>
            )}
          </TabsContent>

          {/* ── تبويب: الإشعارات ── */}
          <TabsContent value="notifications" className="space-y-4 mt-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-semibold text-foreground" data-testid="text-notifications-heading">مركز الإشعارات</h2>
                {unreadCount > 0 && (
                  <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30 text-xs" data-testid="badge-unread-count">
                    {unreadCount} جديد
                  </Badge>
                )}
              </div>
              {unreadCount > 0 && (
                <Button variant="outline" size="sm" className="text-xs gap-1.5"
                  data-testid="btn-mark-all-read"
                  onClick={() => markAllReadMutation.mutate()}
                  disabled={markAllReadMutation.isPending}
                >
                  <BellOff className="w-3.5 h-3.5" />
                  {markAllReadMutation.isPending ? "جارٍ..." : "تعليم الكل مقروءاً"}
                </Button>
              )}
            </div>

            {notifLoading ? (
              <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-16 w-full bg-white/5" />)}</div>
            ) : notifications.length > 0 ? (
              <ScrollArea className="h-[500px] pr-2">
                <div className="space-y-2">
                  {/* غير مقروءة أولاً */}
                  {unreadNotifications.length > 0 && (
                    <div className="mb-3">
                      <p className="text-[11px] text-violet-400 font-medium flex items-center gap-1 mb-2">
                        <BellRing className="w-3 h-3" /> جديدة ({unreadCount})
                      </p>
                      {unreadNotifications.map((n: any, i: number) => (
                        <NotificationRow key={`un-${n.id || i}`} notif={n} idx={i}
                          onMarkRead={(id) => markReadMutation.mutate(id)} />
                      ))}
                    </div>
                  )}
                  {/* المقروءة */}
                  {notifications.filter((n: any) => n.read).length > 0 && (
                    <div>
                      <p className="text-[11px] text-muted-foreground/50 font-medium flex items-center gap-1 mb-2">
                        <Eye className="w-3 h-3" /> مقروءة ({notifications.filter((n: any) => n.read).length})
                      </p>
                      {notifications.filter((n: any) => n.read).slice(0, 10).map((n: any, i: number) => (
                        <NotificationRow key={`rd-${n.id || i}`} notif={n} idx={i}
                          onMarkRead={(id) => markReadMutation.mutate(id)} />
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex flex-col items-center py-16 text-center">
                <BellOff className="w-12 h-12 text-muted-foreground/20 mb-3" />
                <p className="text-sm text-muted-foreground/60" data-testid="text-no-notifications">لا توجد إشعارات</p>
                <p className="text-xs text-muted-foreground/40 mt-1">ستظهر هنا عند وصول إشعارات جديدة</p>
              </div>
            )}
          </TabsContent>

          {/* ── تبويب: حالة الخدمات ── */}
          <TabsContent value="services" className="space-y-4 mt-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground" data-testid="text-services-heading">حالة الخدمات والأنظمة</h2>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" /> {servicesHealthy} سليم
                </span>
                {servicesDegraded > 0 && (
                  <span className="text-[11px] text-amber-400 flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-amber-400" /> {servicesDegraded} تحذير
                  </span>
                )}
                {servicesDown > 0 && (
                  <span className="text-[11px] text-red-400 flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-red-400" /> {servicesDown} متوقف
                  </span>
                )}
              </div>
            </div>

            {/* ملخص الصحة العام */}
            {externalSystems.length > 0 && (
              <div className="flex items-center gap-3 p-3 rounded-xl border border-border/30 bg-card/30">
                <div className={`text-3xl font-bold ${servicesDown > 0 ? "text-red-400" : servicesDegraded > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                  {externalSystems.length > 0 ? Math.round((servicesHealthy / externalSystems.length) * 100) : 100}%
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">معدل توافر الخدمات</p>
                  <p className="text-xs text-muted-foreground/60">{externalSystems.length} نظام مرصود</p>
                </div>
                <div className="flex-1 mr-4">
                  <div className="h-2 bg-border/30 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700
                      ${servicesDown > 0 ? "bg-red-500" : servicesDegraded > 0 ? "bg-amber-400" : "bg-emerald-500"}`}
                      style={{ width: `${externalSystems.length > 0 ? Math.round((servicesHealthy / externalSystems.length) * 100) : 100}%` }} />
                  </div>
                </div>
              </div>
            )}

            {systemsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-16 w-full bg-white/5" />)}
              </div>
            ) : externalSystems.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {externalSystems.map((sys: any, idx: number) => {
                  const statusKey = (sys.status || sys.connectionStatus || "unknown").toLowerCase();
                  const cfg = STATUS_CONFIG[statusKey] || { label: "غير معروف", color: "text-muted-foreground", icon: Circle };
                  const StatusIcon = cfg.icon;
                  return (
                    <Card key={sys.id || idx} className="hub-card hub-card-gold hub-card-hover"
                      data-testid={`service-card-${sys.id || idx}`}>
                      <CardContent className="p-4 flex items-center gap-3">
                        <StatusIcon className={`w-5 h-5 flex-shrink-0 ${cfg.color}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate"
                            data-testid={`service-name-${sys.id || idx}`}>
                            {sys.name || sys.systemName}
                          </p>
                          <p className={`text-xs ${cfg.color}`} data-testid={`service-status-${sys.id || idx}`}>
                            {cfg.label}
                          </p>
                        </div>
                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0
                          ${statusKey === "connected" || statusKey === "active" || statusKey === "healthy" || statusKey === "online"
                            ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]"
                            : statusKey === "warning" || statusKey === "degraded"
                            ? "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]"
                            : "bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.6)]"}`} />
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              /* حالة افتراضية عند عدم وجود بيانات */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { name: "الأنظمة الرئيسية", icon: Server, status: "healthy" },
                  { name: "شبكة JCSA", icon: Network, status: "healthy" },
                  { name: "البريد الإلكتروني", icon: Mail, status: "healthy" },
                  { name: "قاعدة البيانات", icon: Database, status: "healthy" },
                  { name: "الأمان والحماية", icon: Lock, status: "healthy" },
                  { name: "Control Hub", icon: Globe, status: "healthy" },
                ].map((s, i) => (
                  <Card key={i} className="hub-card hub-card-gold" data-testid={`default-service-${i}`}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{s.name}</p>
                        <p className="text-xs text-emerald-400">يعمل بشكل طبيعي</p>
                      </div>
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)] flex-shrink-0" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* ── تذييل ── */}
        <div className="flex items-center justify-center pt-2 pb-1">
          <p className="text-[10px] text-muted-foreground/30">Control Hub · JCSA · {new Date().getFullYear()}</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
