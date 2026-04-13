import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest, invalidateRelatedQueries } from '@/lib/queryClient';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingButton } from "@/components/LoadingButton";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  AlertTriangle, Search, Clock, CheckCircle, ArrowUpCircle,
  MessageSquare, FileDown, FileSpreadsheet, Ticket, ClipboardList,
  Eye, Building2, Shield, ArrowDown, Inbox, CircleDot
} from 'lucide-react';
import { exportToPDF, exportToExcel } from '@/lib/exports';
import { PageHeader, KpiCard } from "@/components/Quality";
import { itDirectorNavGroups } from '@/lib/navigation';

interface Escalation {
  id: number;
  entityType: string;
  entityId: number;
  reason: string;
  escalatedFrom: number | null;
  escalatedTo: number;
  priority: string;
  status: string;
  resolvedAt: string | null;
  resolution: string | null;
  createdAt: string;
}

interface TicketItem {
  id: number;
  title: string;
  status: string;
  priority: string;
  ticketNumber?: string;
}

interface TaskItem {
  id: number;
  title: string;
  status: string;
  priority: string;
}

interface UserItem {
  id: number;
  fullName: string;
  email: string;
  portal: string;
}

const priorityConfig: Record<string, { label: string; variant: string; icon: typeof AlertTriangle }> = {
  urgent: { label: 'عاجلة', variant: 'bg-red-600/20 text-red-400', icon: Shield },
  low: { label: 'منخفضة', variant: 'bg-muted text-muted-foreground', icon: ArrowDown },
  medium: { label: 'متوسطة', variant: 'bg-blue-500/15 text-blue-500', icon: CircleDot },
  high: { label: 'عالية', variant: 'hub-badge-gold', icon: AlertTriangle },
  critical: { label: 'حرجة', variant: 'bg-red-500/15 text-red-500', icon: Shield },
};

const statusConfig: Record<string, { label: string; variant: string }> = {
  pending: { label: 'بانتظار الإجراء', variant: 'hub-badge-gold' },
  in_review: { label: 'قيد المراجعة', variant: 'bg-blue-500/15 text-blue-500' },
  resolved: { label: 'تم الحل', variant: 'bg-emerald-500/15 text-emerald-500' },
  escalated: { label: 'مصعّد', variant: 'bg-red-500/15 text-red-500' },
};

const DEPARTMENTS: Record<number, string> = {
  0: 'المدير العام',
  1: 'البنية التحتية',
  2: 'الأمن السيبراني',
  3: 'التحول الرقمي',
  4: 'الدعم الفني',
  5: 'مكتب إدارة البيانات',
};

const PORTAL_LABELS: Record<string, string> = {
  infrastructure: 'البنية التحتية',
  cybersecurity: 'الأمن السيبراني',
  digital_transformation: 'التحول الرقمي',
  support: 'الدعم الفني',
  dmo: 'مكتب إدارة البيانات',
  committee: 'اللجنة',
  system_admin: 'مدير النظام',
  it_director: 'المدير العام',
};

export default function EscalationsManagement() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [selectedEscalation, setSelectedEscalation] = useState<Escalation | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [resolution, setResolution] = useState('');

  const { data: escalations = [], isLoading } = useQuery<Escalation[]>({
    queryKey: ['/api/escalations'],
  });

  const { data: tickets = [] } = useQuery<TicketItem[]>({
    queryKey: ['/api/it-tickets'],
  });

  const { data: tasks = [] } = useQuery<TaskItem[]>({
    queryKey: ['/api/tasks'],
  });

  const { data: users = [] } = useQuery<UserItem[]>({
    queryKey: ['/api/users'],
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ id, resolution }: { id: number; resolution: string }) => {
      const response = await apiRequest('PUT', `/api/escalations/${id}/resolve`, { resolution });
      if (!response.ok) throw new Error('فشل في حل التصعيد');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/escalations'] });
      invalidateRelatedQueries('/api/escalations');
      setResolveDialogOpen(false);
      setSelectedEscalation(null);
      setResolution('');
      toast({ title: 'تم اتخاذ الإجراء بنجاح', description: 'تم تحديث حالة التصعيد' });
    },
    onError: (error: Error) => {
      toast({ title: 'حدث خطأ', description: error.message, variant: 'destructive' });
    },
  });

  const filteredEscalations = escalations
    .sort((a, b) => {
      const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      if (a.status !== 'resolved' && b.status === 'resolved') return -1;
      if (a.status === 'resolved' && b.status !== 'resolved') return 1;
      return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
    })
    .filter(e => {
      const matchesSearch = e.reason?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(e.entityId).includes(searchTerm) ||
        getEntityTitle(e).toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || e.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || e.priority === priorityFilter;
      return matchesSearch && matchesStatus && matchesPriority;
    });

  const stats = {
    total: escalations.length,
    pending: escalations.filter(e => e.status === 'pending').length,
    inReview: escalations.filter(e => e.status === 'in_review').length,
    resolved: escalations.filter(e => e.status === 'resolved').length,
    critical: escalations.filter(e => (e.priority === 'critical' || e.priority === 'urgent') && e.status !== 'resolved').length,
  };

  function getEntityTitle(escalation: Escalation) {
    if (escalation.entityType === 'ticket') {
      const ticket = tickets.find(t => t.id === escalation.entityId);
      return ticket?.title || `تذكرة #${escalation.entityId}`;
    }
    if (escalation.entityType === 'task') {
      const task = tasks.find(t => t.id === escalation.entityId);
      return task?.title || `مهمة #${escalation.entityId}`;
    }
    return `#${escalation.entityId}`;
  }

  function getEntityStatus(escalation: Escalation) {
    if (escalation.entityType === 'ticket') {
      const ticket = tickets.find(t => t.id === escalation.entityId);
      return ticket?.status || '';
    }
    if (escalation.entityType === 'task') {
      const task = tasks.find(t => t.id === escalation.entityId);
      return task?.status || '';
    }
    return '';
  }

  function getEscalatedByName(escalation: Escalation) {
    if (!escalation.escalatedFrom) return 'النظام';
    const user = users.find(u => u.id === escalation.escalatedFrom);
    if (user) {
      const portalLabel = PORTAL_LABELS[user.portal] || user.portal;
      return `${user.fullName} (${portalLabel})`;
    }
    return `مستخدم #${escalation.escalatedFrom}`;
  }

  function getDeptFromReason(reason: string) {
    const match = reason.match(/^\[(.+?)\]/);
    return match ? match[1] : '';
  }

  function getCleanReason(reason: string) {
    return reason.replace(/^\[.+?\]\s*/, '').replace(/^.+?\n/, '').trim() || reason;
  }

  function formatTimeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    if (minutes < 1) return 'الآن';
    if (minutes < 60) return `منذ ${minutes} دقيقة`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `منذ ${hours} ساعة`;
    const days = Math.floor(hours / 24);
    return `منذ ${days} يوم`;
  }

  const handleExportPDF = () => {
    exportToPDF({
      title: 'تقرير التصعيدات الواردة',
      subtitle: 'نادي سباقات الخيل - مركز التحكم',
      columns: [
        { header: '#', key: 'id', width: 15 },
        { header: 'النوع', key: 'typeLabel', width: 20 },
        { header: 'العنصر', key: 'entityTitle', width: 50 },
        { header: 'الإدارة', key: 'dept', width: 30 },
        { header: 'السبب', key: 'cleanReason', width: 60 },
        { header: 'الأولوية', key: 'priorityLabel', width: 20 },
        { header: 'الحالة', key: 'statusLabel', width: 25 },
        { header: 'التاريخ', key: 'dateStr', width: 35 },
      ],
      data: filteredEscalations.map(e => ({
        id: e.id,
        typeLabel: e.entityType === 'task' ? 'مهمة' : 'تذكرة',
        entityTitle: getEntityTitle(e),
        dept: getDeptFromReason(e.reason) || DEPARTMENTS[e.escalatedTo] || '',
        cleanReason: getCleanReason(e.reason),
        priorityLabel: priorityConfig[e.priority]?.label || e.priority,
        statusLabel: statusConfig[e.status]?.label || e.status,
        dateStr: new Date(e.createdAt).toLocaleDateString('ar-SA'),
      })),
      filename: 'escalations-report',
      orientation: 'landscape',
    });
    toast({ title: 'تم تصدير التقرير بنجاح' });
  };

  const handleExportExcel = () => {
    exportToExcel({
      title: 'تقرير التصعيدات',
      columns: [
        { header: '#', key: 'id', width: 10 },
        { header: 'النوع', key: 'typeLabel', width: 15 },
        { header: 'العنصر', key: 'entityTitle', width: 40 },
        { header: 'الإدارة المصعّدة', key: 'dept', width: 25 },
        { header: 'المصعّد بواسطة', key: 'escalatedBy', width: 30 },
        { header: 'السبب', key: 'cleanReason', width: 50 },
        { header: 'الأولوية', key: 'priorityLabel', width: 15 },
        { header: 'الحالة', key: 'statusLabel', width: 20 },
        { header: 'الحل', key: 'resolution', width: 40 },
        { header: 'التاريخ', key: 'dateStr', width: 25 },
      ],
      data: filteredEscalations.map(e => ({
        id: e.id,
        typeLabel: e.entityType === 'task' ? 'مهمة' : 'تذكرة',
        entityTitle: getEntityTitle(e),
        dept: getDeptFromReason(e.reason) || DEPARTMENTS[e.escalatedTo] || '',
        escalatedBy: getEscalatedByName(e),
        cleanReason: getCleanReason(e.reason),
        priorityLabel: priorityConfig[e.priority]?.label || e.priority,
        statusLabel: statusConfig[e.status]?.label || e.status,
        resolution: e.resolution || '-',
        dateStr: new Date(e.createdAt).toLocaleDateString('ar-SA'),
      })),
      filename: 'escalations-report',
    });
    toast({ title: 'تم تصدير التقرير بنجاح' });
  };

  return (
    <DashboardLayout
      title="التصعيدات الواردة"
      subtitle="متابعة التصعيدات من الإدارات واتخاذ الإجراءات اللازمة"
      navGroups={itDirectorNavGroups}
      portalName="بوابة المدير العام"
    >
      <div className="space-y-5">
        <PageHeader
          icon={ArrowUpCircle}
          title="إدارة التصعيدات"
          subtitle="متابعة التصعيدات من الإدارات واتخاذ الإجراءات اللازمة"
          actions={
            <>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input placeholder="بحث..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pr-10 h-9 text-sm w-40 bg-background" data-testid="input-search-escalations" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 h-9 text-sm" data-testid="select-status-filter"><SelectValue placeholder="الحالة" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الحالات</SelectItem>
                  <SelectItem value="pending">تحتاج إجراء</SelectItem>
                  <SelectItem value="in_review">قيد المراجعة</SelectItem>
                  <SelectItem value="resolved">تم الحل</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-32 h-9 text-sm" data-testid="select-priority-filter"><SelectValue placeholder="الأولوية" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الأولويات</SelectItem>
                  <SelectItem value="urgent">عاجلة</SelectItem>
                  <SelectItem value="critical">حرجة</SelectItem>
                  <SelectItem value="high">عالية</SelectItem>
                  <SelectItem value="medium">متوسطة</SelectItem>
                  <SelectItem value="low">منخفضة</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportPDF} data-testid="button-export-pdf"><FileDown className="w-3.5 h-3.5" />PDF</Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportExcel} data-testid="button-export-excel"><FileSpreadsheet className="w-3.5 h-3.5" />Excel</Button>
            </>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard label="إجمالي التصعيدات" value={stats.total} icon={ArrowUpCircle} color="navy" />
          <KpiCard label="حرجة" value={stats.critical} icon={Shield} color={stats.critical > 0 ? "danger" : "muted"} />
          <KpiCard label="تحتاج إجراء" value={stats.pending} icon={Clock} color={stats.pending > 0 ? "gold" : "muted"} />
          <KpiCard label="قيد المراجعة" value={stats.inReview} icon={MessageSquare} color="info" />
          <KpiCard label="تم الحل" value={stats.resolved} icon={CheckCircle} color="success" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ArrowUpCircle className="w-5 h-5 hub-stat-gold" />
              التصعيدات الواردة من الإدارات
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">جاري تحميل التصعيدات...</div>
            ) : filteredEscalations.length === 0 ? (
              <div className="text-center py-12">
                <Inbox className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
                <p className="text-muted-foreground font-medium">لا توجد تصعيدات</p>
                <p className="text-sm text-muted-foreground mt-1">التصعيدات ترد من الإدارات عند تأخر التذاكر أو المهام</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredEscalations.map((escalation) => {
                  const isCritical = (escalation.priority === 'critical' || escalation.priority === 'urgent') && escalation.status !== 'resolved';
                  const isPending = escalation.status === 'pending';
                  const isResolved = escalation.status === 'resolved';
                  const dept = getDeptFromReason(escalation.reason) || DEPARTMENTS[escalation.escalatedTo] || '';
                  const cleanReason = getCleanReason(escalation.reason);

                  return (
                    <div
                      key={escalation.id}
                      className={`p-4 rounded-md border transition-all ${
                        isCritical
                          ? 'border-red-500/40 bg-red-500/5'
                          : isPending
                          ? 'border-gold/30 hub-icon-gold'
                          : isResolved
                          ? 'border-border bg-muted/30'
                          : 'border-border'
                      }`}
                      data-testid={`escalation-row-${escalation.id}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <Badge className={priorityConfig[escalation.priority]?.variant || ''}>
                              {priorityConfig[escalation.priority]?.label || escalation.priority}
                            </Badge>
                            <Badge className={statusConfig[escalation.status]?.variant || ''}>
                              {statusConfig[escalation.status]?.label || escalation.status}
                            </Badge>
                            <Badge variant="outline" className="gap-1">
                              {escalation.entityType === 'task' ? <ClipboardList className="w-3 h-3" /> : <Ticket className="w-3 h-3" />}
                              {escalation.entityType === 'task' ? 'مهمة' : 'تذكرة'} #{escalation.entityId}
                            </Badge>
                            {getEntityStatus(escalation) && (
                              <Badge variant="outline" className="text-xs">
                                حالة العنصر: {getEntityStatus(escalation)}
                              </Badge>
                            )}
                          </div>

                          <h3 className="font-semibold mb-1" data-testid={`text-escalation-title-${escalation.id}`}>
                            {getEntityTitle(escalation)}
                          </h3>

                          {cleanReason && (
                            <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                              <span className="font-medium">سبب التصعيد:</span> {cleanReason}
                            </p>
                          )}

                          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                            {dept && (
                              <span className="flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                من: {dept}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatTimeAgo(escalation.createdAt)}
                            </span>
                            <span className="text-xs">
                              {getEscalatedByName(escalation)}
                            </span>
                            {escalation.resolvedAt && (
                              <span className="flex items-center gap-1 text-emerald-500">
                                <CheckCircle className="w-3 h-3" />
                                تم الحل {formatTimeAgo(escalation.resolvedAt)}
                              </span>
                            )}
                          </div>

                          {escalation.resolution && (
                            <div className="mt-2 p-2 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                                <span className="font-medium">الإجراء المتخذ:</span> {escalation.resolution}
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-2 flex-shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setSelectedEscalation(escalation); setDetailDialogOpen(true); }}
                            data-testid={`button-view-escalation-${escalation.id}`}
                          >
                            <Eye className="w-4 h-4 ml-1" />
                            التفاصيل
                          </Button>
                          {!isResolved && (
                            <Button
                              size="sm"
                              className="btn-gold"
                              onClick={() => { setSelectedEscalation(escalation); setResolution(''); setResolveDialogOpen(true); }}
                              data-testid={`button-resolve-escalation-${escalation.id}`}
                            >
                              <CheckCircle className="w-4 h-4 ml-1" />
                              اتخذ إجراء
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto" dir="rtl" data-testid="dialog-resolve-escalation">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              اتخاذ إجراء على التصعيد
            </DialogTitle>
            <DialogDescription>
              أدخل الإجراء المتخذ لمعالجة هذا التصعيد الوارد من الإدارة
            </DialogDescription>
          </DialogHeader>
          {selectedEscalation && (
            <div className="space-y-4">
              <div className="p-3 rounded-md bg-muted/50 border space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={priorityConfig[selectedEscalation.priority]?.variant || ''}>
                    {priorityConfig[selectedEscalation.priority]?.label}
                  </Badge>
                  <Badge variant="outline">
                    {selectedEscalation.entityType === 'task' ? 'مهمة' : 'تذكرة'} #{selectedEscalation.entityId}
                  </Badge>
                </div>
                <p className="text-sm font-medium">{getEntityTitle(selectedEscalation)}</p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">السبب:</span> {getCleanReason(selectedEscalation.reason)}
                </p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">من:</span> {getEscalatedByName(selectedEscalation)}
                </p>
              </div>
              <div>
                <Label className="font-semibold">الإجراء المتخذ *</Label>
                <Textarea
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  placeholder="اشرح الإجراء المتخذ بالتفصيل (مثال: تم التواصل مع الإدارة، تم تحويل المهمة، تم اعتماد الطلب...)"
                  rows={4}
                  className="mt-2"
                  data-testid="input-resolution"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setResolveDialogOpen(false)} data-testid="button-cancel-resolve">إلغاء</Button>
            <LoadingButton
              onClick={() => selectedEscalation && resolveMutation.mutate({ id: selectedEscalation.id, resolution })}
              disabled={resolution.length < 5}
              loading={resolveMutation.isPending}
              loadingText="جاري الحفظ..."
              className="btn-gold"
              data-testid="button-confirm-resolve"
            >
              حفظ الإجراء وإغلاق التصعيد
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl" data-testid="dialog-escalation-detail">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 hub-stat-gold" />
              تفاصيل التصعيد #{selectedEscalation?.id}
            </DialogTitle>
          </DialogHeader>
          {selectedEscalation && (
            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <Badge className={priorityConfig[selectedEscalation.priority]?.variant || ''}>
                  {priorityConfig[selectedEscalation.priority]?.label}
                </Badge>
                <Badge className={statusConfig[selectedEscalation.status]?.variant || ''}>
                  {statusConfig[selectedEscalation.status]?.label}
                </Badge>
                <Badge variant="outline" className="gap-1">
                  {selectedEscalation.entityType === 'task' ? <ClipboardList className="w-3 h-3" /> : <Ticket className="w-3 h-3" />}
                  {selectedEscalation.entityType === 'task' ? 'مهمة' : 'تذكرة'}
                </Badge>
              </div>

              <div className="space-y-3">
                <div className="p-3 rounded-md bg-muted/50 border">
                  <p className="text-xs text-muted-foreground mb-1">العنصر المصعّد</p>
                  <p className="text-sm font-medium">{getEntityTitle(selectedEscalation)}</p>
                  {getEntityStatus(selectedEscalation) && (
                    <p className="text-xs text-muted-foreground mt-1">حالة العنصر الحالية: {getEntityStatus(selectedEscalation)}</p>
                  )}
                </div>

                <div className="p-3 rounded-md bg-muted/50 border">
                  <p className="text-xs text-muted-foreground mb-1">الإدارة المصعِّدة</p>
                  <p className="text-sm font-medium">{getDeptFromReason(selectedEscalation.reason) || DEPARTMENTS[selectedEscalation.escalatedTo] || '-'}</p>
                </div>

                <div className="p-3 rounded-md bg-muted/50 border">
                  <p className="text-xs text-muted-foreground mb-1">مصعّد بواسطة</p>
                  <p className="text-sm font-medium">{getEscalatedByName(selectedEscalation)}</p>
                </div>

                <div className="p-3 rounded-md bg-muted/50 border">
                  <p className="text-xs text-muted-foreground mb-1">سبب التصعيد</p>
                  <p className="text-sm">{getCleanReason(selectedEscalation.reason)}</p>
                </div>

                <div className="p-3 rounded-md bg-muted/50 border">
                  <p className="text-xs text-muted-foreground mb-1">تاريخ التصعيد</p>
                  <p className="text-sm">{new Date(selectedEscalation.createdAt).toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>

                {selectedEscalation.resolution && (
                  <div className="p-3 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-1 font-medium">الإجراء المتخذ</p>
                    <p className="text-sm text-emerald-700 dark:text-emerald-300">{selectedEscalation.resolution}</p>
                    {selectedEscalation.resolvedAt && (
                      <p className="text-xs text-emerald-500 mt-1">
                        {new Date(selectedEscalation.resolvedAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {selectedEscalation.status !== 'resolved' && (
                <Button
                  className="w-full btn-gold"
                  onClick={() => {
                    setDetailDialogOpen(false);
                    setResolution('');
                    setResolveDialogOpen(true);
                  }}
                  data-testid="button-take-action"
                >
                  <CheckCircle className="w-4 h-4 ml-2" />
                  اتخذ إجراء على هذا التصعيد
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
