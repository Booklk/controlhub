import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useConfirmDialog, ConfirmDialog } from '@/components/ConfirmDialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { queryClient, apiRequest, invalidateRelatedQueries } from '@/lib/queryClient';
import DashboardLayout from '@/components/DashboardLayout';
import { itDirectorNavGroups } from '@/lib/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
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
  LayoutDashboard, Ticket, BarChart3, AlertTriangle,
  Plus, Search, Clock, CheckCircle, Circle, MessageSquare,
  FileDown, FileSpreadsheet, RefreshCw, Pencil, Trash2, CheckSquare
} from 'lucide-react';
import { SmartFormAssistant, ParsedFormData } from "@/components/SmartFormAssistant";
import { exportToPDF, exportToExcel, formatStatus, formatPriority } from '@/lib/exports';
import { FormSuccessPanel, FieldHint } from "@/components/ui/form-guide";
import { ExternalImportDialog } from "@/components/ExternalImportDialog";
import { Download } from "lucide-react";
import { PageHeader, KpiCard } from "@/components/Quality";

const validCategories = ['technical', 'network', 'security', 'software', 'hardware'] as const;
const validPriorities = ['low', 'medium', 'high', 'critical', 'urgent'] as const;

const ticketValidationSchema = z.object({
  title: z.string()
    .min(1, 'عنوان التذكرة مطلوب')
    .min(5, 'عنوان التذكرة مطلوب (5-200 حرف)')
    .max(200, 'عنوان التذكرة مطلوب (5-200 حرف)')
    .trim(),
  description: z.string().optional().default(''),
  category: z.enum(validCategories, {
    errorMap: () => ({ message: 'يجب اختيار تصنيف' }),
  }),
  priority: z.enum(validPriorities, {
    errorMap: () => ({ message: 'الأولوية غير صحيحة' }),
  }).default('medium'),
  assigneeId: z.number().optional().nullable(),
});

type TicketFormData = z.infer<typeof ticketValidationSchema>;


interface TicketType {
  id: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  category: string | null;
  createdById: number | null;
  assignedToId: number | null;
  itDepartmentId: number | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

const statusLabels: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  open: { label: 'مفتوحة', color: 'bg-[hsl(43_74%_49%)]/20 hub-stat-gold', icon: <Circle className="w-3 h-3" /> },
  in_progress: { label: 'قيد المعالجة', color: 'bg-[hsl(222_47%_11%)]/10 text-muted-foreground', icon: <Clock className="w-3 h-3" /> },
  resolved: { label: 'تم الحل', color: 'bg-[hsl(43_74%_49%)]/20 hub-stat-gold', icon: <CheckCircle className="w-3 h-3" /> },
  closed: { label: 'مغلقة', color: 'bg-muted text-muted-foreground', icon: <CheckCircle className="w-3 h-3" /> },
};

const priorityLabels: Record<string, { label: string; color: string }> = {
  low: { label: 'منخفض', color: 'bg-muted text-muted-foreground' },
  medium: { label: 'متوسط', color: 'bg-[hsl(222_47%_11%)]/10 text-muted-foreground' },
  high: { label: 'عالي', color: 'bg-[hsl(43_74%_49%)]/20 hub-stat-gold' },
  critical: { label: 'حرج', color: 'bg-destructive/20 text-destructive' },
  urgent: { label: 'عاجل', color: 'bg-destructive/30 text-destructive font-bold' },
};

export default function TicketsManagement() {
  const { toast } = useToast();
  const { confirm: confirmAction, dialogProps } = useConfirmDialog();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<TicketType | null>(null);
  const [ticketResponse, setTicketResponse] = useState('');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<TicketType | null>(null);
  const [selectedTicketIds, setSelectedTicketIds] = useState<Set<number>>(new Set());
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [successTicket, setSuccessTicket] = useState<{ id: number; title: string } | null>(null);

  const form = useForm<TicketFormData>({
    resolver: zodResolver(ticketValidationSchema),
    defaultValues: {
      title: '',
      description: '',
      priority: 'medium',
      category: 'technical',
      assigneeId: null,
    },
    mode: 'onChange',
  });

  const { data: tickets = [], isLoading, refetch } = useQuery<TicketType[]>({
    queryKey: ['/api/it-tickets'],
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });

  const { data: deptUsers = [] } = useQuery<{ id: number; name: string; email: string; role: string }[]>({
    queryKey: ['/api/department-users'],
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 500);
    toast({ title: 'تم تحديث البيانات' });
  };

  const handleExportPDF = () => {
    exportToPDF({
      title: 'تقرير التذاكر',
      subtitle: 'نادي سباقات الخيل - مركز التحكم',
      columns: [
        { header: 'العنوان', key: 'title', width: 60 },
        { header: 'الحالة', key: 'statusLabel', width: 25 },
        { header: 'الأولوية', key: 'priorityLabel', width: 25 },
        { header: 'التاريخ', key: 'dateFormatted', width: 30 },
      ],
      data: filteredTickets.map(t => ({
        ...t,
        statusLabel: formatStatus(t.status),
        priorityLabel: formatPriority(t.priority),
        dateFormatted: new Date(t.createdAt).toLocaleDateString('ar-SA'),
      })),
      filename: `tickets-report-${new Date().toISOString().split('T')[0]}`,
      orientation: 'landscape',
    });
    toast({ title: 'تم تصدير التقرير بصيغة PDF' });
  };

  const handleExportExcel = () => {
    exportToExcel({
      title: 'تقرير التذاكر',
      columns: [
        { header: 'العنوان', key: 'title' },
        { header: 'الحالة', key: 'statusLabel' },
        { header: 'الأولوية', key: 'priorityLabel' },
        { header: 'التاريخ', key: 'dateFormatted' },
      ],
      data: filteredTickets.map(t => ({
        ...t,
        statusLabel: formatStatus(t.status),
        priorityLabel: formatPriority(t.priority),
        dateFormatted: new Date(t.createdAt).toLocaleDateString('ar-SA'),
      })),
      filename: `tickets-report-${new Date().toISOString().split('T')[0]}`,
    });
    toast({ title: 'تم تصدير التقرير بصيغة Excel' });
  };

  const createTicketMutation = useMutation({
    mutationFn: async (ticketData: TicketFormData) => {
      const response = await apiRequest('POST', '/api/it-tickets', ticketData);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/it-tickets'] });
      invalidateRelatedQueries('/api/it-tickets');
      setSuccessTicket({ id: data.id, title: data.title });
      form.reset({
        title: '',
        description: '',
        priority: 'medium',
        category: 'technical',
        assigneeId: null,
      });
    },
    onError: () => {
      toast({ title: 'حدث خطأ في إنشاء التذكرة', variant: 'destructive' });
    },
  });

  const onSubmit = (data: TicketFormData) => {
    createTicketMutation.mutate(data);
  };

  const updateTicketStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await apiRequest('PUT', `/api/it-tickets/${id}/status`, { status });
      return response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/it-tickets'] });
      invalidateRelatedQueries('/api/it-tickets');
      if (selectedTicket && selectedTicket.id === variables.id) {
        setSelectedTicket({ ...selectedTicket, status: variables.status });
      }
      toast({ title: 'تم تحديث حالة التذكرة' });
    },
    onError: (error: any) => {
      toast({ title: error.message || 'حدث خطأ في تحديث التذكرة', variant: 'destructive' });
    },
  });

  const deleteTicketMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/it-tickets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/it-tickets'] });
      invalidateRelatedQueries('/api/it-tickets');
      setSelectedTicket(null);
      toast({ title: 'تم حذف التذكرة بنجاح' });
    },
    onError: (error: any) => {
      toast({ title: error.message || 'حدث خطأ في حذف التذكرة', variant: 'destructive' });
    },
  });

  const bulkUpdateStatusMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: number[]; status: string }) => {
      await Promise.all(ids.map(id => apiRequest('PUT', `/api/it-tickets/${id}/status`, { status })));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/it-tickets'] });
      invalidateRelatedQueries('/api/it-tickets');
      setSelectedTicketIds(new Set());
      setIsBulkMode(false);
      toast({ title: `تم تحديث ${selectedTicketIds.size} تذكرة بنجاح` });
    },
    onError: () => {
      toast({ title: 'حدث خطأ في التحديث الجماعي', variant: 'destructive' });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      await Promise.all(ids.map(id => apiRequest('DELETE', `/api/it-tickets/${id}`)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/it-tickets'] });
      invalidateRelatedQueries('/api/it-tickets');
      setSelectedTicketIds(new Set());
      setIsBulkMode(false);
      toast({ title: 'تم حذف التذاكر المحددة' });
    },
    onError: () => {
      toast({ title: 'حدث خطأ في الحذف الجماعي', variant: 'destructive' });
    },
  });

  const addResponseMutation = useMutation({
    mutationFn: async ({ id, response }: { id: number; response: string }) => {
      const res = await apiRequest('PUT', `/api/it-tickets/${id}`, { response });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/it-tickets'] });
      invalidateRelatedQueries('/api/it-tickets');
      setTicketResponse('');
      toast({ title: 'تم إضافة الرد بنجاح' });
    },
    onError: (error: any) => {
      toast({ title: error.message || 'حدث خطأ في إضافة الرد', variant: 'destructive' });
    },
  });

  const editForm = useForm<TicketFormData>({
    resolver: zodResolver(ticketValidationSchema),
    defaultValues: {
      title: '',
      description: '',
      priority: 'medium',
      category: 'technical',
      assigneeId: null,
    },
    mode: 'onChange',
  });

  const updateTicketMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: TicketFormData }) => {
      const res = await apiRequest('PUT', `/api/it-tickets/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/it-tickets'] });
      invalidateRelatedQueries('/api/it-tickets');
      setIsEditDialogOpen(false);
      setEditingTicket(null);
      editForm.reset();
      toast({ title: 'تم تحديث التذكرة بنجاح' });
    },
    onError: (error: any) => {
      toast({ title: error.message || 'حدث خطأ في تحديث التذكرة', variant: 'destructive' });
    },
  });

  const handleEditTicket = (ticket: TicketType, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingTicket(ticket);
    editForm.reset({
      title: ticket.title,
      description: ticket.description || '',
      priority: (ticket.priority as any) || 'medium',
      category: (ticket.category as any) || 'technical',
      assigneeId: ticket.assignedToId || null,
    });
    setIsEditDialogOpen(true);
  };

  const onEditSubmit = (data: TicketFormData) => {
    if (editingTicket) {
      updateTicketMutation.mutate({ id: editingTicket.id, data });
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = ticket.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const ticketStats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    inProgress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length,
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ar-SA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const getSlaInfo = (ticket: TicketType) => {
    if (ticket.status === 'resolved' || ticket.status === 'closed') return null;
    const created = new Date(ticket.createdAt);
    const now = new Date();
    const hoursElapsed = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60));
    const slaHours = (ticket.priority === 'critical' || ticket.priority === 'urgent') ? 4 : ticket.priority === 'high' ? 8 : ticket.priority === 'medium' ? 24 : 48;
    const remaining = slaHours - hoursElapsed;
    const percentage = Math.min(100, (hoursElapsed / slaHours) * 100);
    if (remaining <= 0) return { label: 'تجاوز SLA', color: 'bg-red-500/20 text-red-600', iconType: 'alert' as const, percentage: 100, breached: true };
    if (remaining <= 2) return { label: `${remaining}س متبقية`, color: 'bg-amber-500/20 text-amber-600', iconType: 'clock' as const, percentage, breached: false };
    return { label: `${remaining}س متبقية`, color: 'bg-emerald-500/20 text-emerald-600', iconType: 'check' as const, percentage, breached: false };
  };

  return (
    <DashboardLayout
      title="إدارة التذاكر"
      subtitle="متابعة وحل تذاكر الدعم الفني"
      navGroups={itDirectorNavGroups}
      portalName="بوابة المدير العام"
    >
      <div className="space-y-5">
        <PageHeader
          icon={Ticket}
          title="إدارة التذاكر"
          subtitle="متابعة وحل تذاكر الدعم الفني"
          actions={
            <>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input placeholder="بحث..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pr-10 h-9 text-sm w-44 bg-background" data-testid="input-search-tickets" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32 h-9 text-sm"><SelectValue placeholder="الحالة" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="open">مفتوحة</SelectItem>
                  <SelectItem value="in_progress">قيد المعالجة</SelectItem>
                  <SelectItem value="resolved">تم الحل</SelectItem>
                  <SelectItem value="closed">مغلقة</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-32 h-9 text-sm"><SelectValue placeholder="الأولوية" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="low">منخفض</SelectItem>
                  <SelectItem value="medium">متوسط</SelectItem>
                  <SelectItem value="high">عالي</SelectItem>
                  <SelectItem value="critical">حرج</SelectItem>
                  <SelectItem value="urgent">عاجل</SelectItem>
                </SelectContent>
              </Select>
              <Button variant={isBulkMode ? "default" : "outline"} size="icon" className="h-9 w-9" onClick={() => { setIsBulkMode(!isBulkMode); if (isBulkMode) setSelectedTicketIds(new Set()); }} data-testid="button-toggle-bulk"><CheckSquare className="w-3.5 h-3.5" /></Button>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={handleRefresh} data-testid="button-refresh-tickets"><RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} /></Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportPDF} data-testid="button-export-pdf"><FileDown className="w-3.5 h-3.5" />PDF</Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportExcel} data-testid="button-export-excel"><FileSpreadsheet className="w-3.5 h-3.5" />Excel</Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={() => setIsImportOpen(true)} data-testid="button-import-tickets"><Download className="w-3.5 h-3.5" />استيراد</Button>
              <Button className="btn-gold h-9 gap-1.5 text-xs" onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-ticket"><Plus className="w-3.5 h-3.5" />تذكرة جديدة</Button>
            </>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label="إجمالي التذاكر"
            value={ticketStats.total}
            icon={Ticket}
            color="navy"
            sublabel="كل التذاكر المسجلة"
            active={statusFilter === "all"}
            onClick={() => setStatusFilter("all")}
            data-testid="kpi-total-tickets"
          />
          <KpiCard
            label="مفتوحة"
            value={ticketStats.open}
            icon={Circle}
            color="gold"
            sublabel="بانتظار البدء في المعالجة"
            active={statusFilter === "open"}
            onClick={() => setStatusFilter(statusFilter === "open" ? "all" : "open")}
            data-testid="kpi-open-tickets"
          />
          <KpiCard
            label="قيد المعالجة"
            value={ticketStats.inProgress}
            icon={Clock}
            color="info"
            sublabel="يعمل عليها الفريق الآن"
            active={statusFilter === "in_progress"}
            onClick={() => setStatusFilter(statusFilter === "in_progress" ? "all" : "in_progress")}
            data-testid="kpi-inprogress-tickets"
          />
          <KpiCard
            label="تم الحل"
            value={ticketStats.resolved}
            icon={CheckCircle}
            color="success"
            sublabel="مغلقة ومنجزة بنجاح"
            active={statusFilter === "resolved"}
            onClick={() => setStatusFilter(statusFilter === "resolved" ? "all" : "resolved")}
            data-testid="kpi-resolved-tickets"
          />
        </div>

        <Card className="card-premium">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Ticket className="w-5 h-5 hub-stat-gold" />
                قائمة التذاكر
              </CardTitle>
              {isBulkMode && (
                <Button variant="ghost" size="sm" onClick={() => { if (selectedTicketIds.size === filteredTickets.length) { setSelectedTicketIds(new Set()); } else { setSelectedTicketIds(new Set(filteredTickets.map(t => t.id))); } }} data-testid="button-select-all">
                  {selectedTicketIds.size === filteredTickets.length ? 'إلغاء الكل' : 'تحديد الكل'}
                </Button>
              )}
              <Dialog open={isAddDialogOpen} onOpenChange={(open) => { setIsAddDialogOpen(open); if (!open) setSuccessTicket(null); }}>
                  <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
                    <DialogHeader>
                      <DialogTitle>{successTicket ? 'تم إنشاء التذكرة' : 'إنشاء تذكرة جديدة'}</DialogTitle>
                    </DialogHeader>

                    {successTicket ? (
                      <FormSuccessPanel
                        title="تم إنشاء التذكرة بنجاح!"
                        subtitle={successTicket.title}
                        referenceNumber={`TKT-${String(successTicket.id).padStart(4, '0')}`}
                        referenceLabel="رقم التذكرة"
                        nextSteps={[
                          { title: "مراجعة التذكرة", description: "سيتلقى مسؤول تقنية المعلومات إشعاراً بالطلب الجديد" },
                          { title: "التحقيق والتعيين", description: "سيُحدَّد المسؤول عن المعالجة وفقاً للأولوية والتصنيف" },
                          { title: "المعالجة والإغلاق", description: "ستصلك إشعارات بكل تحديث على حالة التذكرة" },
                        ]}
                        actions={[
                          {
                            label: "إنشاء تذكرة أخرى",
                            variant: "default",
                            icon: <Plus className="w-4 h-4" />,
                            onClick: () => setSuccessTicket(null),
                            testId: "button-create-another-ticket",
                          },
                          {
                            label: "إغلاق",
                            variant: "outline",
                            onClick: () => { setIsAddDialogOpen(false); setSuccessTicket(null); },
                            testId: "button-close-success",
                          },
                        ]}
                      />
                    ) : (
                      <>
                        <SmartFormAssistant 
                          formType="ticket"
                          onDataParsed={(data: ParsedFormData) => {
                            if (data.title) form.setValue('title', data.title);
                            if (data.description) form.setValue('description', data.description);
                            if (data.priority) form.setValue('priority', data.priority as any);
                            if (data.category) form.setValue('category', data.category as any);
                          }}
                        />
                        <Form {...form}>
                          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                            <FormField
                              control={form.control}
                              name="title"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>عنوان التذكرة *</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="مثال: الطابعة لا تعمل في قسم الحسابات"
                                      data-testid="input-ticket-title"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FieldHint>صِف المشكلة بإيجاز واضح حتى يسهل تعيينها للشخص المناسب.</FieldHint>
                                  <FormMessage data-testid="error-title" />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="description"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>تفاصيل المشكلة *</FormLabel>
                                  <FormControl>
                                    <Textarea
                                      placeholder="اذكر متى بدأت المشكلة، والأجهزة أو الأنظمة المتأثرة، وما جربته لحل المشكلة..."
                                      rows={4}
                                      data-testid="input-ticket-description"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FieldHint>كلما كانت التفاصيل أوضح، كان الحل أسرع. اذكر رسائل الخطأ إن وجدت.</FieldHint>
                                  <FormMessage data-testid="error-description" />
                                </FormItem>
                              )}
                            />
                            <div className="grid grid-cols-2 gap-4">
                              <FormField
                                control={form.control}
                                name="priority"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>مستوى الأولوية</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                      <FormControl>
                                        <SelectTrigger data-testid="select-ticket-priority">
                                          <SelectValue />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="low">🟢 منخفض — أيام</SelectItem>
                                        <SelectItem value="medium">🟡 متوسط — ساعات</SelectItem>
                                        <SelectItem value="high">🟠 عالي — فوري</SelectItem>
                                        <SelectItem value="critical">🔴 حرج — الآن</SelectItem>
                                        <SelectItem value="urgent">🚨 عاجل — فوري جداً</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FieldHint>حرج = نظام متوقف تاماً يؤثر على العمل.</FieldHint>
                                    <FormMessage data-testid="error-priority" />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="category"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>تصنيف المشكلة *</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                      <FormControl>
                                        <SelectTrigger data-testid="select-ticket-category">
                                          <SelectValue />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="technical">⚙️ تقني عام</SelectItem>
                                        <SelectItem value="network">🌐 شبكات وإنترنت</SelectItem>
                                        <SelectItem value="security">🔒 أمن معلومات</SelectItem>
                                        <SelectItem value="software">💻 برمجيات وأنظمة</SelectItem>
                                        <SelectItem value="hardware">🖨️ أجهزة ومعدات</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FieldHint>يساعد التصنيف في توجيه التذكرة للفريق المناسب.</FieldHint>
                                    <FormMessage data-testid="error-category" />
                                  </FormItem>
                                )}
                              />
                            </div>
                            {deptUsers.length > 0 && (
                              <FormField
                                control={form.control}
                                name="assigneeId"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>تعيين إلى موظف</FormLabel>
                                    <Select
                                      value={field.value ? String(field.value) : "unassigned"}
                                      onValueChange={(v) => field.onChange(v === "unassigned" ? null : parseInt(v))}
                                    >
                                      <FormControl>
                                        <SelectTrigger data-testid="select-ticket-assignee">
                                          <SelectValue placeholder="اختر موظف..." />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="unassigned">بدون تعيين</SelectItem>
                                        {deptUsers.map((u: any) => (
                                          <SelectItem key={u.id} value={String(u.id)}>{u.name || u.email}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </FormItem>
                                )}
                              />
                            )}
                            <DialogFooter className="gap-2 pt-4">
                              <Button 
                                variant="outline" 
                                onClick={() => setIsAddDialogOpen(false)}
                                type="button"
                                data-testid="button-cancel-ticket"
                              >
                                إلغاء
                              </Button>
                              <Button
                                type="submit"
                                disabled={createTicketMutation.isPending || !form.formState.isValid}
                                className="btn-gold"
                                data-testid="button-confirm-add-ticket"
                              >
                                {createTicketMutation.isPending ? 'جاري الإرسال...' : 'إرسال الطلب'}
                              </Button>
                            </DialogFooter>
                          </form>
                        </Form>
                      </>
                    )}
                  </DialogContent>
                </Dialog>
            </div>
          </CardHeader>
          {isBulkMode && selectedTicketIds.size > 0 && (
            <div className="flex items-center gap-3 p-3 mx-6 mb-3 rounded-lg bg-[hsl(43_74%_49%)]/10 border border-[hsl(43_74%_49%)]/30" data-testid="bulk-actions-bar">
              <span className="text-sm font-medium">{selectedTicketIds.size} تذكرة محددة</span>
              <div className="flex-1" />
              <Button size="sm" variant="outline" onClick={() => bulkUpdateStatusMutation.mutate({ ids: Array.from(selectedTicketIds), status: 'in_progress' })} data-testid="bulk-start-processing">
                بدء المعالجة
              </Button>
              <Button size="sm" variant="outline" onClick={() => bulkUpdateStatusMutation.mutate({ ids: Array.from(selectedTicketIds), status: 'resolved' })} data-testid="bulk-resolve">
                تم الحل
              </Button>
              <Button size="sm" variant="outline" onClick={() => bulkUpdateStatusMutation.mutate({ ids: Array.from(selectedTicketIds), status: 'closed' })} data-testid="bulk-close">
                إغلاق
              </Button>
              <Button size="sm" variant="destructive" onClick={() => {
                confirmAction(() => bulkDeleteMutation.mutate(Array.from(selectedTicketIds)), {
                  title: 'تأكيد الحذف الجماعي',
                  description: `هل أنت متأكد من حذف ${selectedTicketIds.size} تذكرة؟`
                });
              }} data-testid="bulk-delete">
                <Trash2 className="w-4 h-4 ml-1" />
                حذف
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setSelectedTicketIds(new Set()); setIsBulkMode(false); }} data-testid="bulk-cancel">
                إلغاء
              </Button>
            </div>
          )}
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">جاري تحميل التذاكر...</div>
            ) : filteredTickets.length === 0 ? (
              <div className="text-center py-12">
                <Ticket className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground">لا توجد تذاكر</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="p-4 rounded-lg border border-border hover:border-[hsl(43_74%_49%)]/50 transition-all"
                    data-testid={`ticket-row-${ticket.id}`}
                    onClick={() => { setSelectedTicket(ticket); setTicketResponse(''); }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      {isBulkMode && (
                        <div className="flex items-center ml-3 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedTicketIds.has(ticket.id)}
                            onChange={(e) => {
                              const newSet = new Set(selectedTicketIds);
                              if (e.target.checked) newSet.add(ticket.id);
                              else newSet.delete(ticket.id);
                              setSelectedTicketIds(newSet);
                            }}
                            className="w-4 h-4 rounded border-border accent-[hsl(43_74%_49%)]"
                            data-testid={`checkbox-ticket-${ticket.id}`}
                          />
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium">#{ticket.id}</span>
                          <h3 className="font-semibold">{ticket.title}</h3>
                        </div>
                        {ticket.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                            {ticket.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(ticket.createdAt)}
                          </span>
                          {ticket.category && (
                            <Badge variant="outline" className="text-xs">{ticket.category}</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge className={statusLabels[ticket.status]?.color || ''}>
                          {statusLabels[ticket.status]?.label || ticket.status}
                        </Badge>
                        <Badge className={priorityLabels[ticket.priority]?.color || ''}>
                          {priorityLabels[ticket.priority]?.label || ticket.priority}
                        </Badge>
                        {(() => {
                          const sla = getSlaInfo(ticket);
                          if (!sla) return null;
                          return (
                            <Badge className={`text-xs ${sla.color}`} data-testid={`sla-badge-${ticket.id}`}>
                              {sla.iconType === 'alert' && <AlertTriangle className="w-3 h-3 ml-1 inline" />}
                              {sla.iconType === 'clock' && <Clock className="w-3 h-3 ml-1 inline" />}
                              {sla.iconType === 'check' && <CheckCircle className="w-3 h-3 ml-1 inline" />}
                              {sla.label}
                            </Badge>
                          );
                        })()}
                        <div className="flex items-center gap-1">
                          {ticket.status === 'open' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => { e.stopPropagation(); updateTicketStatusMutation.mutate({ id: ticket.id, status: 'in_progress' }); }}
                              data-testid={`button-start-ticket-${ticket.id}`}
                            >
                              بدء المعالجة
                            </Button>
                          )}
                          {ticket.status === 'in_progress' && (
                            <Button
                              size="sm"
                              className="btn-gold"
                              onClick={(e) => { e.stopPropagation(); updateTicketStatusMutation.mutate({ id: ticket.id, status: 'resolved' }); }}
                              data-testid={`button-resolve-ticket-${ticket.id}`}
                            >
                              تم الحل
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => handleEditTicket(ticket, e)}
                            data-testid={`button-edit-ticket-${ticket.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-red-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              confirmAction(() => deleteTicketMutation.mutate(ticket.id), {
                                title: 'تأكيد الحذف',
                                description: 'هل أنت متأكد من حذف هذه التذكرة؟ لا يمكن التراجع عن هذا الإجراء.'
                              });
                            }}
                            data-testid={`button-delete-ticket-${ticket.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedTicket} onOpenChange={(open) => { if (!open) { setSelectedTicket(null); setTicketResponse(''); } }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          {selectedTicket && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Ticket className="w-5 h-5 hub-stat-gold" />
                  تفاصيل التذكرة #{selectedTicket.id}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <h2 className="text-lg font-bold flex-1">{selectedTicket.title}</h2>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge className={statusLabels[selectedTicket.status]?.color || ''}>
                      {statusLabels[selectedTicket.status]?.label || selectedTicket.status}
                    </Badge>
                    <Badge className={priorityLabels[selectedTicket.priority]?.color || ''}>
                      {priorityLabels[selectedTicket.priority]?.label || selectedTicket.priority}
                    </Badge>
                  </div>
                </div>

                {selectedTicket.description && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <Label className="text-muted-foreground text-xs">وصف المشكلة</Label>
                    <p className="mt-1 whitespace-pre-wrap">{selectedTicket.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <Label className="text-muted-foreground text-xs">التصنيف</Label>
                    <p className="font-medium mt-1">{selectedTicket.category || 'غير محدد'}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <Label className="text-muted-foreground text-xs">تاريخ الإنشاء</Label>
                    <p className="font-medium flex items-center gap-1 mt-1">
                      <Clock className="w-4 h-4" />
                      {formatDate(selectedTicket.createdAt)}
                    </p>
                  </div>
                </div>

                {selectedTicket.resolvedAt && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <Label className="text-muted-foreground text-xs">تاريخ الحل</Label>
                    <p className="font-medium flex items-center gap-1 mt-1">
                      <CheckCircle className="w-4 h-4 hub-stat-gold" />
                      {formatDate(selectedTicket.resolvedAt)}
                    </p>
                  </div>
                )}

                <div className="p-3 rounded-lg bg-muted/50">
                  <Label className="text-muted-foreground text-xs">تغيير الحالة</Label>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {selectedTicket.status !== 'open' && (
                      <Button size="sm" variant="outline" onClick={() => updateTicketStatusMutation.mutate({ id: selectedTicket.id, status: 'open' })} data-testid="button-status-open">
                        إعادة فتح
                      </Button>
                    )}
                    {selectedTicket.status === 'open' && (
                      <Button size="sm" variant="outline" onClick={() => updateTicketStatusMutation.mutate({ id: selectedTicket.id, status: 'in_progress' })} data-testid="button-status-progress">
                        بدء المعالجة
                      </Button>
                    )}
                    {(selectedTicket.status === 'open' || selectedTicket.status === 'in_progress') && (
                      <Button size="sm" className="btn-gold" onClick={() => updateTicketStatusMutation.mutate({ id: selectedTicket.id, status: 'resolved' })} data-testid="button-status-resolve">
                        تم الحل
                      </Button>
                    )}
                    {selectedTicket.status === 'resolved' && (
                      <Button size="sm" variant="outline" onClick={() => updateTicketStatusMutation.mutate({ id: selectedTicket.id, status: 'closed' })} data-testid="button-status-close">
                        إغلاق التذكرة
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">إضافة رد / ملاحظة</Label>
                  <Textarea
                    value={ticketResponse}
                    onChange={(e) => setTicketResponse(e.target.value)}
                    placeholder="اكتب ردك أو ملاحظتك هنا..."
                    rows={3}
                    data-testid="input-ticket-response"
                  />
                  <Button
                    size="sm"
                    className="btn-gold gap-1"
                    disabled={!ticketResponse.trim() || addResponseMutation.isPending}
                    onClick={() => addResponseMutation.mutate({ id: selectedTicket.id, response: ticketResponse })}
                    data-testid="button-send-response"
                  >
                    <MessageSquare className="w-4 h-4" />
                    {addResponseMutation.isPending ? 'جاري الإرسال...' : 'إرسال الرد'}
                  </Button>
                </div>

                <DialogFooter className="gap-2">
                  <Button
                    variant="destructive"
                    onClick={() => {
                      confirmAction(() => deleteTicketMutation.mutate(selectedTicket.id), { title: 'تأكيد الحذف', description: 'هل أنت متأكد من حذف هذه التذكرة؟ لا يمكن التراجع عن هذا الإجراء.' });
                    }}
                    data-testid="button-delete-ticket"
                  >
                    حذف التذكرة
                  </Button>
                  <Button variant="outline" onClick={() => { setSelectedTicket(null); setTicketResponse(''); }} data-testid="button-close-ticket-details">
                    إغلاق
                  </Button>
                </DialogFooter>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open);
        if (!open) {
          setEditingTicket(null);
          editForm.reset();
        }
      }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل التذكرة</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 mt-4">
              <FormField
                control={editForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>عنوان التذكرة</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="أدخل عنوان التذكرة"
                        data-testid="input-edit-ticket-title"
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
                    <FormLabel>وصف المشكلة</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="صف المشكلة بالتفصيل"
                        rows={3}
                        data-testid="input-edit-ticket-description"
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
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>التصنيف</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-ticket-category">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="technical">تقني</SelectItem>
                          <SelectItem value="network">شبكات</SelectItem>
                          <SelectItem value="security">أمن</SelectItem>
                          <SelectItem value="software">برمجيات</SelectItem>
                          <SelectItem value="hardware">أجهزة</SelectItem>
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
                          <SelectTrigger data-testid="select-edit-ticket-priority">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">منخفض</SelectItem>
                          <SelectItem value="medium">متوسط</SelectItem>
                          <SelectItem value="high">عالي</SelectItem>
                          <SelectItem value="critical">حرج</SelectItem>
                          <SelectItem value="urgent">عاجل</SelectItem>
                        </SelectContent>
                      </Select>
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
                  className="bg-gradient-to-r from-[hsl(43_74%_49%)] to-[hsl(43_74%_40%)] text-muted-foreground"
                  disabled={updateTicketMutation.isPending}
                  data-testid="button-update-ticket"
                  type="submit"
                >
                  {updateTicketMutation.isPending ? 'جاري التحديث...' : 'تحديث التذكرة'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog {...dialogProps} />
      <ExternalImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        departmentId={0}
        departmentName="مدير تقنية المعلومات"
        targetType="tickets"
        invalidateKey="/api/it-tickets"
      />
    </DashboardLayout>
  );
}
