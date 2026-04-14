import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/auth";
import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader, KpiCard, EmptyState, SearchEmptyState } from "@/components/Quality";
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
import {
  Ticket, Plus, Search, RefreshCw, CheckCircle,
  Clock, AlertTriangle, User, Calendar, MessageSquare,
  Loader2, FileDown, FileSpreadsheet, Pencil, Trash2,
  Inbox, Target, ListFilter, Zap, ArrowRight, type LucideIcon
} from "lucide-react";
import { ReferralEscalationButtons, DepartmentReferralsSection } from "@/components/ReferralEscalationPanel";
import { SLACountdown } from "@/components/SLACountdown";
import TicketDetailPanel from "@/components/TicketDetailPanel";
import { exportToPDF, exportToExcel, formatStatus, formatPriority } from '@/lib/exports';
import { useConfirmDialog, ConfirmDialog } from '@/components/ConfirmDialog';
import { BookmarkButton } from '@/components/SmartBookmarks';
import { FormSuccessPanel } from "@/components/ui/form-guide";
import { Sparkles, CheckCheck, Download } from "lucide-react";
import { ExternalImportDialog } from "@/components/ExternalImportDialog";

interface CategoryOption {
  value: string;
  label: string;
}

interface DepartmentTicketsConfig {
  departmentId: number;
  departmentName: string;
  departmentNameEn: string;
  portalName: string;
  navGroups: any[];
  icon: LucideIcon;
  title: string;
  subtitle: string;
  categories: CategoryOption[];
  defaultCategory: string;
}

const STATUS_CONFIG: Record<string, { label: string; style: string }> = {
  open: { label: "مفتوحة", style: "hub-badge-gold" },
  new: { label: "جديدة", style: "hub-badge-gold" },
  assigned: { label: "معيّنة", style: "hub-badge-navy" },
  in_progress: { label: "قيد العمل", style: "hub-badge-navy" },
  resolved: { label: "محلولة", style: "hub-badge-success" },
  closed: { label: "مغلقة", style: "bg-muted text-muted-foreground border border-muted/40" },
};

const PRIORITY_CONFIG: Record<string, { label: string; style: string }> = {
  low: { label: "منخفضة", style: "bg-muted text-muted-foreground border border-muted/40" },
  medium: { label: "متوسطة", style: "hub-badge-gold" },
  high: { label: "عالية", style: "hub-badge-navy" },
  critical: { label: "حرجة", style: "bg-red-500/15 text-red-700 border border-red-500/30" },
  urgent: { label: "عاجلة", style: "bg-red-600/20 text-red-800 border border-red-600/40 font-semibold" },
};

function isTicketUrgent(ticket: any): boolean {
  return (ticket.priority === 'critical' || ticket.priority === 'high' || ticket.priority === 'urgent') &&
    (ticket.status === 'open' || ticket.status === 'new' || ticket.status === 'in_progress');
}

function getTicketAge(ticket: any): number {
  if (!ticket.createdAt) return 0;
  return Math.ceil((Date.now() - new Date(ticket.createdAt).getTime()) / (1000 * 60 * 60 * 24));
}

function TicketAgeIndicator({ ticket }: { ticket: any }) {
  const age = getTicketAge(ticket);
  if (ticket.status === 'resolved' || ticket.status === 'closed') {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Calendar className="w-3 h-3" />
        {new Date(ticket.createdAt).toLocaleDateString('ar-SA')}
      </span>
    );
  }
  if (age > 7) {
    return (
      <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
        <AlertTriangle className="w-3 h-3" />منذ {age} يوم
      </span>
    );
  }
  if (age > 3) {
    return (
      <span className="flex items-center gap-1 text-xs hub-stat-gold font-medium">
        <Clock className="w-3 h-3" />منذ {age} أيام
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Calendar className="w-3 h-3" />
      {age === 0 ? "اليوم" : age === 1 ? "أمس" : `منذ ${age} أيام`}
    </span>
  );
}

function getNextAction(status: string): { label: string; nextStatus: string } | null {
  const actions: Record<string, { label: string; nextStatus: string }> = {
    open: { label: "بدء العمل", nextStatus: "in_progress" },
    new: { label: "بدء العمل", nextStatus: "in_progress" },
    in_progress: { label: "تم الحل", nextStatus: "resolved" },
    resolved: { label: "إغلاق", nextStatus: "closed" },
  };
  return actions[status] || null;
}

export default function DepartmentTicketsPage({ config }: { config: DepartmentTicketsConfig }) {
  const { toast } = useToast();
  const { confirm: confirmAction, dialogProps } = useConfirmDialog();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [createdTicketRef, setCreatedTicketRef] = useState<string | null>(null);
  const [detailTicket, setDetailTicket] = useState<any>(null);
  const [commentTicket, setCommentTicket] = useState<any>(null);
  const [commentText, setCommentText] = useState('');
  const [smartSuggestion, setSmartSuggestion] = useState<{ priority: string; category: string; priorityConfidence: number; similarTickets: any[] } | null>(null);
  const [smartAccepted, setSmartAccepted] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const smartDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [newTicket, setNewTicket] = useState<{ title: string; description: string; priority: string; category: string; assigneeId: number | null }>({
    title: "", description: "", priority: "medium", category: config.defaultCategory, assigneeId: null
  });

  const Icon = config.icon;
  const queryKey = `/api/it-tickets?departmentId=${config.departmentId}`;

  const { data: tickets = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: [queryKey],
  });

  const { data: deptUsers = [], isLoading: usersLoading } = useQuery<{ id: number; name: string; email: string }[]>({
    queryKey: ['/api/department-users', config.departmentId],
    queryFn: async () => {
      const res = await fetch(`/api/department-users?departmentId=${config.departmentId}`, {
        headers: { 'Authorization': `Bearer ${sessionStorage.getItem('_cht') || ''}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const stats = useMemo(() => {
    const open = tickets.filter((t: any) => t.status === 'open' || t.status === 'new').length;
    const inProgress = tickets.filter((t: any) => t.status === 'in_progress' || t.status === 'assigned').length;
    const resolved = tickets.filter((t: any) => t.status === 'resolved' || t.status === 'closed').length;
    const urgent = tickets.filter(isTicketUrgent).length;
    const aging = tickets.filter((t: any) => getTicketAge(t) > 7 && t.status !== 'resolved' && t.status !== 'closed').length;
    const resolutionRate = tickets.length > 0 ? Math.round((resolved / tickets.length) * 100) : 0;
    return { total: tickets.length, open, inProgress, resolved, urgent, aging, resolutionRate };
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    let filtered = [...tickets];
    if (activeTab === "open") filtered = filtered.filter((t: any) => t.status === 'open' || t.status === 'new');
    else if (activeTab === "active") filtered = filtered.filter((t: any) => t.status === 'in_progress' || t.status === 'assigned');
    else if (activeTab === "urgent") filtered = filtered.filter(isTicketUrgent);
    else if (activeTab === "aging") filtered = filtered.filter((t: any) => getTicketAge(t) > 7 && t.status !== 'resolved' && t.status !== 'closed');
    else if (activeTab === "resolved") filtered = filtered.filter((t: any) => t.status === 'resolved' || t.status === 'closed');

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((t: any) =>
        t.title?.toLowerCase().includes(q) || t.ticketNumber?.includes(q) || t.description?.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") filtered = filtered.filter((t: any) => t.status === statusFilter);
    if (priorityFilter !== "all") filtered = filtered.filter((t: any) => t.priority === priorityFilter);

    filtered.sort((a: any, b: any) => {
      const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      const urgentA = isTicketUrgent(a) ? -1 : 0;
      const urgentB = isTicketUrgent(b) ? -1 : 0;
      if (urgentA !== urgentB) return urgentA - urgentB;
      return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
    });
    return filtered;
  }, [tickets, activeTab, searchQuery, statusFilter, priorityFilter]);

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [queryKey] });
    invalidateRelatedQueries('/api/it-tickets');
  }, [queryKey]);

  const createTicketMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/it-tickets', { ...data, departmentId: config.departmentId });
      return res.json();
    },
    onSuccess: (data: any) => {
      invalidateAll();
      resetForm();
      setCreatedTicketRef(data?.ticketNumber || `TK-${Date.now()}`);
    },
    onError: (e: any) => toast({ title: "حدث خطأ", description: e?.message || "حدث خطأ في إنشاء التذكرة", variant: "destructive" }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => apiRequest('PUT', `/api/it-tickets/${id}/status`, { status }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: [queryKey] });
      const prev = queryClient.getQueryData<any[]>([queryKey]);
      queryClient.setQueryData<any[]>([queryKey], (old) =>
        old?.map(t => t.id === id ? { ...t, status } : t) ?? []
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData([queryKey], context.prev);
      toast({ title: "حدث خطأ في تحديث الحالة", variant: "destructive" });
    },
    onSettled: () => {
      invalidateAll();
    },
    onSuccess: () => {
      toast({ title: "تم تحديث حالة التذكرة" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest('PUT', `/api/it-tickets/${id}`, data),
    onSuccess: () => {
      invalidateAll();
      setIsAddDialogOpen(false);
      setEditingItem(null);
      resetForm();
      toast({ title: "تم تحديث التذكرة بنجاح" });
    },
    onError: () => toast({ title: "حدث خطأ في التحديث", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/it-tickets/${id}`),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: [queryKey] });
      const prev = queryClient.getQueryData<any[]>([queryKey]);
      queryClient.setQueryData<any[]>([queryKey], (old) =>
        old?.filter(t => t.id !== id) ?? []
      );
      return { prev };
    },
    onError: (_err, _id, context) => {
      if (context?.prev) queryClient.setQueryData([queryKey], context.prev);
      toast({ title: "حدث خطأ في الحذف", variant: "destructive" });
    },
    onSettled: () => {
      invalidateAll();
    },
    onSuccess: () => {
      toast({ title: "تم حذف التذكرة بنجاح" });
    },
  });

  const resetForm = () => {
    setNewTicket({ title: "", description: "", priority: "medium", category: config.defaultCategory, assigneeId: null });
    setSmartSuggestion(null);
    setSmartAccepted(false);
  };

  const handleTitleChange = (title: string) => {
    setNewTicket(prev => ({ ...prev, title }));
    if (editingItem) return;
    if (smartDebounceRef.current) clearTimeout(smartDebounceRef.current);
    if (title.length < 4) { setSmartSuggestion(null); return; }
    smartDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/smart/suggest-priority', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAuthToken()}` },
          body: JSON.stringify({ title, description: newTicket.description }),
        });
        if (res.ok) {
          const suggestion = await res.json();
          setSmartSuggestion(suggestion);
          setSmartAccepted(false);
        }
      } catch { /* ignore */ }
    }, 600);
  };

  const handleEdit = (ticket: any) => {
    setEditingItem(ticket);
    setNewTicket({
      title: ticket.title || "",
      description: ticket.description || "",
      priority: ticket.priority || "medium",
      category: ticket.category || config.defaultCategory,
      assigneeId: ticket.assigneeId || null,
    });
    setIsAddDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!newTicket.title.trim()) {
      toast({ title: "عنوان التذكرة مطلوب", description: "يرجى إدخال عنوان واضح للتذكرة", variant: "destructive" });
      return;
    }
    if (newTicket.title.trim().length < 3) {
      toast({ title: "العنوان قصير جداً", description: "يجب أن يكون العنوان 3 أحرف على الأقل", variant: "destructive" });
      return;
    }
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: { ...newTicket, departmentId: config.departmentId } });
    } else {
      createTicketMutation.mutate(newTicket);
    }
  };

  const categoryLabels = useMemo(() => {
    const map: Record<string, string> = {};
    config.categories.forEach(c => { map[c.value] = c.label; });
    return map;
  }, [config.categories]);

  const handleExportPDF = () => {
    exportToPDF({
      title: `تقرير تذاكر ${config.departmentName}`,
      subtitle: 'JCSA - Control Hub',
      columns: [
        { header: "الرقم", key: "number", width: 15 },
        { header: "التذكرة", key: "title", width: 35 },
        { header: "الأولوية", key: "priority", width: 15 },
        { header: "الحالة", key: "status", width: 15 },
        { header: "التصنيف", key: "category", width: 15 },
      ],
      data: filteredTickets.map((item: any) => ({
        number: item.ticketNumber || '',
        title: item.title || '',
        priority: formatPriority(item.priority || ''),
        status: formatStatus(item.status || ''),
        category: categoryLabels[item.category] || item.category || '',
      })),
      filename: `${config.departmentNameEn}-tickets-report`,
      orientation: 'landscape',
    });
  };

  const handleExportExcel = () => {
    exportToExcel({
      title: `تقرير تذاكر ${config.departmentName}`,
      columns: [
        { header: "الرقم", key: "number", width: 15 },
        { header: "التذكرة", key: "title", width: 35 },
        { header: "الأولوية", key: "priority", width: 15 },
        { header: "الحالة", key: "status", width: 15 },
        { header: "التصنيف", key: "category", width: 15 },
      ],
      data: filteredTickets.map((item: any) => ({
        number: item.ticketNumber || '',
        title: item.title || '',
        priority: formatPriority(item.priority || ''),
        status: formatStatus(item.status || ''),
        category: categoryLabels[item.category] || item.category || '',
      })),
      filename: `${config.departmentNameEn}-tickets-report`,
    });
  };

  return (
    <DashboardLayout title={config.title} subtitle={config.subtitle} navGroups={config.navGroups} portalName={config.portalName}>
      <div className="space-y-5" dir="rtl">
        <PageHeader
          icon={Icon}
          title={config.title}
          subtitle={config.subtitle}
          actions={
            <>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={handleExportPDF} title="تصدير PDF" data-testid="button-export-pdf"><FileDown className="w-4 h-4" /></Button>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={handleExportExcel} title="تصدير Excel" data-testid="button-export-excel"><FileSpreadsheet className="w-4 h-4" /></Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={() => refetch()} data-testid="button-refresh-tickets"><RefreshCw className="w-3.5 h-3.5" />تحديث</Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={() => setIsImportOpen(true)} data-testid="button-import-tickets">
                <Download className="w-3.5 h-3.5" />استيراد
              </Button>
              <Button size="sm" className="h-9 gap-1.5 text-xs"
                onClick={() => { setEditingItem(null); resetForm(); setIsAddDialogOpen(true); }}
                data-testid="button-new-ticket"
              >
                <Plus className="w-3.5 h-3.5" />تذكرة جديدة
              </Button>
            </>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <KpiCard label="إجمالي" value={stats.total} icon={Ticket} color="navy" />
          <KpiCard label="مفتوحة" value={stats.open} icon={Inbox} color={stats.open > 0 ? "gold" : "muted"} />
          <KpiCard label="قيد العمل" value={stats.inProgress} icon={Loader2} color="navy" />
          <KpiCard label="عاجلة" value={stats.urgent} icon={AlertTriangle} color={stats.urgent > 0 ? "danger" : "muted"} />
          <KpiCard label="متقادمة +7 أيام" value={stats.aging} icon={Clock} color={stats.aging > 0 ? "gold" : "muted"} />
          <KpiCard label="محلولة" value={stats.resolved} icon={CheckCircle} color="success" />
          <KpiCard label="نسبة الحل" value={`${stats.resolutionRate}%`} icon={Target} color="gold" />
        </div>

        <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
            <TabsList className="bg-white/5 border border-white/10 h-auto flex-wrap">
              <TabsTrigger value="all" className="text-xs gap-1.5 data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900"><Inbox className="w-3.5 h-3.5" />الكل ({stats.total})</TabsTrigger>
              <TabsTrigger value="open" className="text-xs gap-1.5 data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900"><Ticket className="w-3.5 h-3.5" />مفتوحة ({stats.open})</TabsTrigger>
              <TabsTrigger value="active" className="text-xs gap-1.5 data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900"><Zap className="w-3.5 h-3.5" />قيد العمل ({stats.inProgress})</TabsTrigger>
              {stats.urgent > 0 && (
                <TabsTrigger value="urgent" className="text-xs gap-1.5 data-[state=active]:bg-red-600 data-[state=active]:text-white text-red-600"><AlertTriangle className="w-3.5 h-3.5" />عاجلة ({stats.urgent})</TabsTrigger>
              )}
              {stats.aging > 0 && (
                <TabsTrigger value="aging" className="text-xs gap-1.5 data-[state=active]:bg-[hsl(43_74%_49%)] data-[state=active]:text-foreground"><Clock className="w-3.5 h-3.5" />متقادمة ({stats.aging})</TabsTrigger>
              )}
              <TabsTrigger value="resolved" className="text-xs gap-1.5 data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900"><CheckCircle className="w-3.5 h-3.5" />محلولة ({stats.resolved})</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <Card className="border-foreground/10">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute right-3 top-2.5 text-muted-foreground" />
                <Input placeholder="بحث برقم أو عنوان التذكرة..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-3 pr-10 border-foreground/20 h-9" data-testid="input-search-tickets" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="border-foreground/20 h-9" data-testid="select-status-filter"><ListFilter className="w-3.5 h-3.5 ml-2 text-muted-foreground" /><SelectValue placeholder="الحالة" /></SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="all">جميع الحالات</SelectItem>
                  <SelectItem value="open">مفتوحة</SelectItem>
                  <SelectItem value="in_progress">قيد العمل</SelectItem>
                  <SelectItem value="resolved">محلولة</SelectItem>
                  <SelectItem value="closed">مغلقة</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="border-foreground/20 h-9" data-testid="select-priority-filter"><ListFilter className="w-3.5 h-3.5 ml-2 text-muted-foreground" /><SelectValue placeholder="الأولوية" /></SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="all">جميع الأولويات</SelectItem>
                  <SelectItem value="urgent">عاجلة</SelectItem>
                  <SelectItem value="critical">حرجة</SelectItem>
                  <SelectItem value="high">عالية</SelectItem>
                  <SelectItem value="medium">متوسطة</SelectItem>
                  <SelectItem value="low">منخفضة</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="border-foreground/10">
          <CardHeader className="pb-3 px-5 pt-4">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2 text-foreground">
                <Ticket className="w-5 h-5 hub-stat-gold" />التذاكر ({filteredTickets.length})
              </span>
              {filteredTickets.length !== tickets.length && (
                <span className="text-xs text-muted-foreground font-normal">عرض {filteredTickets.length} من {tickets.length}</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="p-4 border border-muted/20 rounded-md">
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-10 w-10 rounded-md" />
                      <div className="flex-1 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div>
                      <Skeleton className="h-6 w-20 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="text-center py-16">
                <div className="mx-auto w-16 h-16 rounded-full bg-muted/20 flex items-center justify-center mb-4">
                  {activeTab === "urgent" ? <CheckCircle className="w-8 h-8 hub-stat-gold/40" /> : <Ticket className="w-8 h-8 text-muted-foreground/30" />}
                </div>
                <p className="text-muted-foreground font-medium mb-1">
                  {activeTab === "urgent" ? "لا توجد تذاكر عاجلة" : activeTab === "aging" ? "لا توجد تذاكر متقادمة" : searchQuery ? "لا توجد نتائج" : "لا توجد تذاكر"}
                </p>
                <p className="text-xs text-muted-foreground/60">
                  {!searchQuery && activeTab === "all" && "اضغط على \"تذكرة جديدة\" لإنشاء أول تذكرة"}
                  {activeTab === "urgent" && "جميع التذاكر الحرجة والعالية تحت السيطرة"}
                </p>
              </div>
            ) : (
              <AnimatePresence>
              <div className="space-y-2">
                {filteredTickets.map((ticket: any, idx: number) => {
                  const urgent = isTicketUrgent(ticket);
                  const aging = getTicketAge(ticket) > 7 && ticket.status !== 'resolved' && ticket.status !== 'closed';
                  const statusConf = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
                  const priorityConf = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.medium;
                  const nextAction = getNextAction(ticket.status);

                  const priorityStripe =
                    (ticket.priority === 'critical' || ticket.priority === 'urgent') ? 'bg-red-500' :
                    ticket.priority === 'high' ? 'bg-orange-400' :
                    ticket.priority === 'medium' ? 'bg-blue-400' :
                    'bg-foreground/10';

                  return (
                    <motion.div
                      key={ticket.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.18, delay: Math.min(idx * 0.03, 0.25) }}
                      className={`relative pl-1.5 pr-4 py-4 border rounded-lg transition-all duration-200 group cursor-pointer overflow-hidden hover:shadow-md hover:-translate-y-px ${
                        urgent ? 'border-foreground/15 bg-red-500/[0.03] hover:bg-red-500/[0.06]' :
                        aging ? 'border-foreground/15 bg-[hsl(43_74%_49%)]/[0.03] hover:bg-[hsl(43_74%_49%)]/[0.06]' :
                        'border-foreground/10 hover:border-[hsl(43_74%_49%)]/25 hover:bg-[hsl(43_74%_49%)]/[0.03]'
                      }`}
                      onClick={() => setDetailTicket(ticket)}
                      data-testid={`ticket-item-${ticket.id}`}
                    >
                      <div className={`absolute inset-y-0 right-0 w-[3px] rounded-l-sm ${priorityStripe}`} />
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className={`mt-0.5 p-1.5 rounded-md flex-shrink-0 ${urgent ? 'bg-red-500/10' : 'bg-foreground/5'}`}>
                            <Ticket className={`w-4 h-4 ${urgent ? 'text-red-500' : 'text-foreground/60'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              {ticket.ticketNumber && <span className="text-xs font-mono text-muted-foreground">{ticket.ticketNumber}</span>}
                              <h3 className={`font-semibold text-sm truncate ${urgent ? 'text-red-700' : 'text-foreground'}`}>{ticket.title}</h3>
                              <Badge className={`${priorityConf.style} font-medium text-[10px] leading-tight`}>{priorityConf.label}</Badge>
                              {ticket.category && (
                                <Badge variant="outline" className="text-[10px] leading-tight font-normal">{categoryLabels[ticket.category] || ticket.category}</Badge>
                              )}
                            </div>
                            {ticket.description && <p className="text-xs text-muted-foreground mb-2 line-clamp-1">{ticket.description}</p>}
                            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                              {ticket.requesterName && <span className="flex items-center gap-1"><User className="w-3 h-3" />{ticket.requesterName}</span>}
                              <TicketAgeIndicator ticket={ticket} />
                              {ticket.slaDeadline && (
                                <SLACountdown deadline={ticket.slaDeadline} status={ticket.status} compact />
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 items-end flex-shrink-0">
                          <Select value={ticket.status} onValueChange={(v) => updateStatusMutation.mutate({ id: ticket.id, status: v })}>
                            <SelectTrigger className="w-auto border-0 bg-transparent p-0 h-auto min-w-0 gap-0" onClick={(e) => e.stopPropagation()}>
                              <Badge className={`${statusConf.style} font-medium text-[10px] leading-tight cursor-pointer`}>{statusConf.label}</Badge>
                            </SelectTrigger>
                            <SelectContent dir="rtl">
                              <SelectItem value="open">مفتوحة</SelectItem>
                              <SelectItem value="in_progress">قيد العمل</SelectItem>
                              <SelectItem value="resolved">محلولة</SelectItem>
                              <SelectItem value="closed">مغلقة</SelectItem>
                            </SelectContent>
                          </Select>
                          <div className="flex gap-1 items-center">
                            {nextAction && (
                              <Button variant="outline" size="sm" className="h-7 text-xs invisible group-hover:visible"
                                onClick={(e) => { e.stopPropagation(); updateStatusMutation.mutate({ id: ticket.id, status: nextAction.nextStatus }); }}
                              >
                                <ArrowRight className="w-3 h-3 ml-1" />{nextAction.label}
                              </Button>
                            )}
                            <div className="flex gap-0.5 invisible group-hover:visible">
                              <span className="cursor-pointer" onClick={(e) => e.stopPropagation()}>
                                <BookmarkButton
                                  portal={config.departmentNameEn}
                                  entityType="ticket"
                                  entityId={ticket.id}
                                  title={ticket.title}
                                  subtitle={ticket.ticketNumber}
                                  priority={ticket.priority}
                                  status={ticket.status}
                                />
                              </span>
                              <ReferralEscalationButtons entityType="ticket" entityId={ticket.id} entityTitle={ticket.title} currentDeptId={config.departmentId} currentDeptName={config.departmentName} />
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setCommentTicket(ticket); }}><MessageSquare className="w-3.5 h-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleEdit(ticket); }}><Pencil className="w-3.5 h-3.5 text-foreground" /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); confirmAction(() => deleteMutation.mutate(ticket.id), { title: 'تأكيد الحذف', description: 'هل أنت متأكد من حذف هذه التذكرة؟' }); }}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
                            </div>
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

        <Dialog open={isAddDialogOpen} onOpenChange={(open) => { setIsAddDialogOpen(open); if (!open) { setEditingItem(null); resetForm(); setCreatedTicketRef(null); } }}>
          <DialogContent className="max-w-lg" dir="rtl">
            {createdTicketRef && !editingItem ? (
              <FormSuccessPanel
                title="تم إنشاء التذكرة بنجاح"
                subtitle={`تم تسجيل التذكرة في قسم ${config.departmentName} وستظهر في قائمة التذاكر`}
                referenceNumber={createdTicketRef}
                referenceLabel="رقم التذكرة"
                nextSteps={[
                  { title: "تم إضافة التذكرة لقائمة المهام المفتوحة", description: "سيتم مراجعتها والبدء بالعمل عليها" },
                  { title: "يمكنك متابعة حالة التذكرة من القائمة", description: "اضغط على التذكرة لعرض التفاصيل والتحديثات" },
                ]}
                actions={[
                  { label: "إنشاء تذكرة أخرى", icon: <Plus className="w-4 h-4" />, onClick: () => { setCreatedTicketRef(null); resetForm(); }, testId: "button-create-another-ticket" },
                  { label: "إغلاق", variant: "outline", onClick: () => { setIsAddDialogOpen(false); setCreatedTicketRef(null); }, testId: "button-close-success" },
                ]}
              />
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle className="text-foreground">{editingItem ? "تعديل التذكرة" : "إنشاء تذكرة جديدة"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label className="text-foreground font-semibold">العنوان *</Label>
                    <Input value={newTicket.title} onChange={(e) => handleTitleChange(e.target.value)} placeholder="عنوان المشكلة..." className="mt-1 border-foreground/20" data-testid="input-ticket-title" />
                    {smartSuggestion && !editingItem && !smartAccepted && (
                      <div className="mt-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start gap-2" data-testid="smart-suggestion-banner">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-amber-300">
                            مقترح ذكي: <strong>أولوية {
                              smartSuggestion.priority === 'urgent' ? 'عاجلة 🚨' :
                              smartSuggestion.priority === 'critical' ? 'حرجة 🔴' :
                              smartSuggestion.priority === 'high' ? 'عالية 🟠' :
                              smartSuggestion.priority === 'medium' ? 'متوسطة 🟡' : 'منخفضة 🟢'
                            }</strong>
                            {smartSuggestion.category !== 'support' && <span className="mr-1 text-amber-300/70">• تصنيف: {smartSuggestion.category}</span>}
                          </p>
                          {smartSuggestion.similarTickets?.length > 0 && (
                            <p className="text-[10px] text-amber-300/60 mt-0.5">تذاكر مشابهة: {smartSuggestion.similarTickets.map((t: any) => t.title).join('، ')}</p>
                          )}
                        </div>
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-amber-400 hover:bg-amber-500/20" data-testid="btn-accept-smart-suggestion"
                          onClick={() => {
                            setNewTicket(prev => ({ ...prev, priority: smartSuggestion.priority, category: smartSuggestion.category in prev ? smartSuggestion.category : prev.category }));
                            setSmartAccepted(true);
                          }}>
                          <CheckCheck className="w-3 h-3 ml-1" />قبول
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-foreground font-semibold">الأولوية</Label>
                      <Select value={newTicket.priority} onValueChange={(v) => setNewTicket({ ...newTicket, priority: v })}>
                        <SelectTrigger className="mt-1 border-foreground/20" data-testid="select-ticket-priority"><SelectValue /></SelectTrigger>
                        <SelectContent dir="rtl">
                          <SelectItem value="low">منخفضة</SelectItem>
                          <SelectItem value="medium">متوسطة</SelectItem>
                          <SelectItem value="high">عالية</SelectItem>
                          <SelectItem value="critical">حرجة</SelectItem>
                          <SelectItem value="urgent">عاجلة</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-foreground font-semibold">التصنيف</Label>
                      <Select value={newTicket.category} onValueChange={(v) => setNewTicket({ ...newTicket, category: v })}>
                        <SelectTrigger className="mt-1 border-foreground/20" data-testid="select-ticket-category"><SelectValue /></SelectTrigger>
                        <SelectContent dir="rtl">
                          {config.categories.map(c => (
                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-foreground font-semibold">الوصف</Label>
                    <Textarea value={newTicket.description} onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })} placeholder="وصف تفصيلي للمشكلة..." className="mt-1 border-foreground/20 min-h-[80px]" data-testid="input-ticket-description" />
                  </div>
                  <div>
                    <Label className="text-foreground font-semibold">تعيين إلى موظف</Label>
                    <Select disabled={usersLoading} value={newTicket.assigneeId ? String(newTicket.assigneeId) : "unassigned"} onValueChange={(v) => setNewTicket({ ...newTicket, assigneeId: v === "unassigned" ? null : parseInt(v) })}>
                      <SelectTrigger className="mt-1 border-foreground/20" data-testid="select-ticket-assignee"><SelectValue placeholder={usersLoading ? "جاري تحميل الموظفين..." : "اختر موظف..."} /></SelectTrigger>
                      <SelectContent dir="rtl">
                        <SelectItem value="unassigned">بدون تعيين</SelectItem>
                        {deptUsers.map((u: any) => (
                          <SelectItem key={u.id} value={String(u.id)}>{u.name || u.email}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} data-testid="button-cancel-ticket">إلغاء</Button>
                  <Button onClick={handleSubmit} disabled={createTicketMutation.isPending || updateMutation.isPending || !newTicket.title.trim()} className="hub-btn-gold gap-1.5" data-testid="button-submit-ticket">
                    {(createTicketMutation.isPending || updateMutation.isPending) && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {editingItem ? (updateMutation.isPending ? "جاري التحديث..." : "تحديث") : (createTicketMutation.isPending ? "جاري الإنشاء..." : "إنشاء التذكرة")}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        <TicketDetailPanel
          ticket={detailTicket}
          open={!!detailTicket}
          onClose={() => setDetailTicket(null)}
          departmentId={config.departmentId}
          onEdit={(ticket) => { handleEdit(ticket); }}
          queryKey={queryKey}
        />

        <Dialog open={!!commentTicket} onOpenChange={(open) => { if (!open) { setCommentTicket(null); setCommentText(''); } }}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-foreground">إضافة تعليق - {commentTicket?.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Textarea placeholder="اكتب تعليقك هنا..." value={commentText} onChange={(e) => setCommentText(e.target.value)} className="border-foreground/20 min-h-[80px]" data-testid="input-comment-text" />
              <Button className="w-full hub-btn-gold" disabled={!commentText.trim()}
                onClick={async () => {
                  try {
                    await apiRequest('POST', `/api/tickets/${commentTicket.id}/comments`, { content: commentText });
                    toast({ title: 'تم إضافة التعليق بنجاح' });
                    setCommentTicket(null); setCommentText('');
                  } catch { toast({ title: 'خطأ', description: 'فشل في إضافة التعليق', variant: 'destructive' }); setCommentTicket(null); setCommentText(''); }
                }}
                data-testid="button-submit-comment"
              >إضافة التعليق</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <ConfirmDialog {...dialogProps} />
      <ExternalImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        departmentId={config.departmentId}
        departmentName={config.departmentName}
        targetType="tickets"
        invalidateKey={queryKey}
      />
    </DashboardLayout>
  );
}
