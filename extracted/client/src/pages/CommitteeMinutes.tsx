import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingButton } from "@/components/LoadingButton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { committeeNavGroups } from "@/lib/navigation";
import { 
  FileText, Plus, Search, RefreshCw, CheckCircle, Clock, 
  Users, Calendar, Archive,
  Download, Edit2, Eye, Trash2, FileCheck, Gavel, FileDown, FileSpreadsheet
} from "lucide-react";
import { exportToPDF, exportToExcel } from '@/lib/exports';
import { PageHeader, KpiCard } from "@/components/Quality";
import { WorkflowIndicator } from "@/components/WorkflowIndicator";
import { getStatusBadge, MINUTES_STATUS } from "@/lib/status-utils";

const MINUTES_WORKFLOW_STEPS = [
  { id: 'draft', label: 'قيد الإعداد', icon: FileText },
  { id: 'approved', label: 'معتمد', icon: Gavel },
  { id: 'published', label: 'منشور', icon: FileCheck },
  { id: 'archived', label: 'مؤرشف', icon: Archive },
];

interface Minute {
  id: number;
  meetingId: number | null;
  title: string;
  content: string | null;
  attendees: any;
  decisions: any;
  actionItems: any;
  status: string;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string | null;
  approvedBy?: number | null;
}

function getMinuteNumber(minute: Minute): string {
  return `MIN-${String(minute.id).padStart(4, '0')}`;
}

function getAttendeesCount(minute: Minute): number {
  return Array.isArray(minute.attendees) ? minute.attendees.length : 0;
}

function getDecisionsCount(minute: Minute): number {
  return Array.isArray(minute.decisions) ? minute.decisions.length : 0;
}

function getMinuteDate(minute: Minute): string {
  if (!minute.createdAt) return '';
  try { return new Date(minute.createdAt).toLocaleDateString('ar-SA'); } catch { return ''; }
}

export default function CommitteeMinutes() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedMinute, setSelectedMinute] = useState<Minute | null>(null);
  const [editingMinute, setEditingMinute] = useState<Minute | null>(null);
  const [newMinute, setNewMinute] = useState({
    title: '',
    content: '',
    meetingId: '',
    attendeesText: '',
    decisionsText: '',
  });
  const [editMinute, setEditMinute] = useState({
    title: '',
    content: '',
    status: 'draft',
    attendeesText: '',
    decisionsText: '',
  });

  const { data: rawMinutes = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ['/api/meeting-minutes'],
  });

  const minutes: Minute[] = rawMinutes as Minute[];

  const { data: meetings = [] } = useQuery<any[]>({
    queryKey: ['/api/committee-meetings'],
  });

  const filteredMinutes = minutes.filter((minute: Minute) => {
    const minNumber = getMinuteNumber(minute);
    const matchesSearch = minute.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      minNumber.includes(searchQuery);
    const matchesStatus = statusFilter === 'all' || minute.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getMinuteStatusBadge = (status: string) => getStatusBadge(status, MINUTES_STATUS);

  const stats = {
    total: minutes.length,
    draft: minutes.filter((m: Minute) => m.status === 'draft').length,
    approved: minutes.filter((m: Minute) => m.status === 'approved').length,
    published: minutes.filter((m: Minute) => m.status === 'published').length,
  };

  const createMinuteMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', '/api/meeting-minutes', data);
    },
    onSuccess: () => {
      toast({ title: 'تم إنشاء المحاضر بنجاح', description: 'تمت إضافة محاضر الجلسة الجديدة' });
      setIsAddDialogOpen(false);
      setNewMinute({ title: '', content: '', meetingId: '', attendeesText: '', decisionsText: '' });
      queryClient.invalidateQueries({ queryKey: ['/api/meeting-minutes'] });
    },
    onError: () => {
      toast({ title: 'خطأ', description: 'حدث خطأ أثناء إنشاء المحاضر', variant: 'destructive' });
    },
  });

  const updateMinuteMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest('PUT', `/api/meeting-minutes/${id}`, data);
    },
    onSuccess: () => {
      toast({ title: 'تم تحديث المحاضر بنجاح' });
      queryClient.invalidateQueries({ queryKey: ['/api/meeting-minutes'] });
      setIsEditDialogOpen(false);
      setEditingMinute(null);
    },
    onError: () => {
      toast({ title: 'خطأ', description: 'حدث خطأ أثناء تحديث المحاضر', variant: 'destructive' });
    },
  });

  const deleteMinuteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/meeting-minutes/${id}`);
    },
    onSuccess: () => {
      toast({ title: 'تم حذف المحاضر بنجاح' });
      queryClient.invalidateQueries({ queryKey: ['/api/meeting-minutes'] });
    },
    onError: () => {
      toast({ title: 'خطأ', description: 'حدث خطأ أثناء حذف المحاضر', variant: 'destructive' });
    },
  });

  const downloadMinute = (minute: Minute) => {
    const statusLabels: Record<string, string> = {
      draft: "قيد الإعداد", approved: "معتمد", published: "منشور", archived: "مؤرشف"
    };
    const content = `
محاضر اجتماع لجنة حوكمة البيانات
رقم المحاضر: ${getMinuteNumber(minute)}
العنوان: ${minute.title}
التاريخ: ${getMinuteDate(minute)}
عدد الحاضرين: ${getAttendeesCount(minute)}
عدد القرارات: ${getDecisionsCount(minute)}
الحالة: ${statusLabels[minute.status] || minute.status}

محتوى المحاضر:
${minute.content || ''}
    `.trim();
    const el = document.createElement('a');
    el.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content));
    el.setAttribute('download', `${getMinuteNumber(minute)}.txt`);
    el.style.display = 'none';
    document.body.appendChild(el);
    el.click();
    document.body.removeChild(el);
    toast({ title: 'تم تحميل المحاضر بنجاح' });
  };

  const handleExportPDF = () => {
    const statusLabels: Record<string, string> = {
      draft: "قيد الإعداد", approved: "معتمد", published: "منشور", archived: "مؤرشف"
    };
    exportToPDF({
      title: 'محاضر الجلسات',
      subtitle: 'نادي سباقات الخيل — مركز التحكم',
      columns: [
        { header: 'الرقم', key: 'number', width: 20 },
        { header: 'العنوان', key: 'title', width: 50 },
        { header: 'الحالة', key: 'statusLabel', width: 25 },
        { header: 'التاريخ', key: 'date', width: 25 },
        { header: 'الحاضرين', key: 'attendeesCount', width: 15 },
      ],
      data: filteredMinutes.map(m => ({
        number: getMinuteNumber(m),
        title: m.title || '',
        statusLabel: statusLabels[m.status] || m.status,
        date: getMinuteDate(m),
        attendeesCount: getAttendeesCount(m),
      })),
      filename: `committee-minutes-${new Date().toISOString().split('T')[0]}`,
      orientation: 'landscape',
    });
  };

  const handleExportExcel = () => {
    const statusLabels: Record<string, string> = {
      draft: "قيد الإعداد", approved: "معتمد", published: "منشور", archived: "مؤرشف"
    };
    exportToExcel({
      title: 'محاضر الجلسات',
      columns: [
        { header: 'الرقم', key: 'number' },
        { header: 'العنوان', key: 'title' },
        { header: 'الحالة', key: 'statusLabel' },
        { header: 'التاريخ', key: 'date' },
        { header: 'الحاضرين', key: 'attendeesCount' },
      ],
      data: filteredMinutes.map(m => ({
        number: getMinuteNumber(m),
        title: m.title || '',
        statusLabel: statusLabels[m.status] || m.status,
        date: getMinuteDate(m),
        attendeesCount: getAttendeesCount(m),
      })),
      filename: `committee-minutes-${new Date().toISOString().split('T')[0]}`,
    });
  };

  const handleEditMinute = (minute: Minute) => {
    setEditingMinute(minute);
    setEditMinute({
      title: minute.title || '',
      content: minute.content || '',
      status: minute.status || 'draft',
      attendeesText: Array.isArray(minute.attendees) ? minute.attendees.join('\n') : '',
      decisionsText: Array.isArray(minute.decisions) ? minute.decisions.join('\n') : '',
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateMinute = () => {
    if (!editingMinute) return;
    if (!editMinute.title.trim()) {
      toast({ title: 'تنبيه', description: 'يرجى إدخال عنوان المحاضر', variant: 'destructive' });
      return;
    }
    const attendeesArr = editMinute.attendeesText
      ? editMinute.attendeesText.split('\n').map(a => a.trim()).filter(Boolean)
      : [];
    const decisionsArr = editMinute.decisionsText
      ? editMinute.decisionsText.split('\n').map(d => d.trim()).filter(Boolean)
      : [];
    updateMinuteMutation.mutate({
      id: editingMinute.id,
      data: {
        title: editMinute.title,
        content: editMinute.content,
        status: editMinute.status,
        attendees: attendeesArr,
        decisions: decisionsArr,
        actionItems: [],
      },
    });
  };

  const handleCreateMinute = () => {
    if (!newMinute.meetingId) {
      toast({ title: 'تنبيه', description: 'يرجى اختيار الاجتماع المرتبط', variant: 'destructive' });
      return;
    }
    if (!newMinute.title.trim()) {
      toast({ title: 'تنبيه', description: 'يرجى إدخال عنوان المحاضر', variant: 'destructive' });
      return;
    }
    const attendeesArr = newMinute.attendeesText
      ? newMinute.attendeesText.split('\n').map(a => a.trim()).filter(Boolean)
      : [];
    const decisionsArr = newMinute.decisionsText
      ? newMinute.decisionsText.split('\n').map(d => d.trim()).filter(Boolean)
      : [];
    createMinuteMutation.mutate({
      meetingId: parseInt(newMinute.meetingId),
      title: newMinute.title,
      content: newMinute.content,
      attendees: attendeesArr,
      decisions: decisionsArr,
      actionItems: [],
    });
  };

  return (
    <DashboardLayout 
      title="محاضر الجلسات" 
      subtitle="إدارة ومتابعة محاضر اجتماعات لجنة حوكمة البيانات"
      navGroups={committeeNavGroups}
      portalName="اللجنة"
    >
      <div className="space-y-5">
        <PageHeader
          icon={FileText}
          title="محاضر الجلسات"
          subtitle="توثيق وإدارة محاضر اجتماعات اللجان"
          actions={
            <>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input placeholder="بحث في المحاضر..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pr-10 h-9 text-sm w-44 bg-background" data-testid="input-search-minutes" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 h-9 text-sm" data-testid="select-status-filter"><SelectValue placeholder="الحالة" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الحالات</SelectItem>
                  <SelectItem value="draft">قيد الإعداد</SelectItem>
                  <SelectItem value="approved">معتمد</SelectItem>
                  <SelectItem value="published">منشور</SelectItem>
                  <SelectItem value="archived">مؤرشف</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => refetch()} data-testid="button-refresh"><RefreshCw className="w-3.5 h-3.5" /></Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportPDF} data-testid="button-export-pdf"><FileDown className="w-3.5 h-3.5" />PDF</Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportExcel} data-testid="button-export-excel"><FileSpreadsheet className="w-3.5 h-3.5" />Excel</Button>
              <Button className="btn-gold h-9 gap-1.5 text-xs" onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-minutes"><Plus className="w-3.5 h-3.5" />محاضر جديدة</Button>
            </>
          }
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="إجمالي المحاضر" value={stats.total} icon={FileText} color="navy" />
          <KpiCard label="قيد الإعداد" value={stats.draft} icon={Clock} color="gold" />
          <KpiCard label="معتمدة" value={stats.approved} icon={CheckCircle} color="success" />
          <KpiCard label="منشورة" value={stats.published} icon={FileCheck} color="info" />
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent className="max-w-2xl" dir="rtl">
                  <DialogHeader>
                    <DialogTitle>إضافة محاضر جلسة جديدة</DialogTitle>
                  </DialogHeader>
                  <DialogBody className="space-y-4">
                    <div>
                      <Label htmlFor="meetingId">الاجتماع المرتبط <span className="text-red-400">*</span></Label>
                      <Select
                        value={newMinute.meetingId}
                        onValueChange={(v) => setNewMinute({ ...newMinute, meetingId: v })}
                      >
                        <SelectTrigger data-testid="select-meeting-id">
                          <SelectValue placeholder="اختر الاجتماع" />
                        </SelectTrigger>
                        <SelectContent>
                          {meetings.length === 0 ? (
                            <SelectItem value="_none" disabled>لا توجد اجتماعات مسجلة</SelectItem>
                          ) : (
                            meetings.map((m: any) => (
                              <SelectItem key={m.id} value={String(m.id)}>
                                {m.title} — {m.date ? new Date(m.date).toLocaleDateString('ar-SA') : ''}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="title">عنوان المحاضر <span className="text-red-400">*</span></Label>
                      <Input
                        id="title"
                        placeholder="أدخل عنوان المحاضر"
                        value={newMinute.title}
                        onChange={(e) => setNewMinute({ ...newMinute, title: e.target.value })}
                        data-testid="input-title"
                      />
                    </div>
                    <div>
                      <Label htmlFor="attendeesText">الحاضرون (اسم في كل سطر)</Label>
                      <Textarea
                        id="attendeesText"
                        placeholder="أدخل أسماء الحاضرين، اسم واحد في كل سطر"
                        value={newMinute.attendeesText}
                        onChange={(e) => setNewMinute({ ...newMinute, attendeesText: e.target.value })}
                        className="min-h-20"
                        data-testid="textarea-attendees"
                      />
                    </div>
                    <div>
                      <Label htmlFor="decisionsText">القرارات (قرار في كل سطر)</Label>
                      <Textarea
                        id="decisionsText"
                        placeholder="أدخل القرارات، قرار واحد في كل سطر"
                        value={newMinute.decisionsText}
                        onChange={(e) => setNewMinute({ ...newMinute, decisionsText: e.target.value })}
                        className="min-h-20"
                        data-testid="textarea-decisions"
                      />
                    </div>
                    <div>
                      <Label htmlFor="content">محتوى المحاضر</Label>
                      <Textarea
                        id="content"
                        placeholder="أدخل محتوى المحاضر"
                        value={newMinute.content}
                        onChange={(e) => setNewMinute({ ...newMinute, content: e.target.value })}
                        className="min-h-24"
                        data-testid="textarea-content"
                      />
                    </div>
                  </DialogBody>
                  <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>إلغاء</Button>
                    <LoadingButton
                      className="btn-gold"
                      onClick={handleCreateMinute}
                      loading={createMinuteMutation.isPending}
                      loadingText="جاري الحفظ..."
                      data-testid="button-save-minutes"
                    >
                      حفظ
                    </LoadingButton>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

        {/* Minutes List */}
        <div className="space-y-4">
          {isLoading ? (
            [1, 2, 3].map(i => (
              <Card key={i} className="card-premium animate-pulse">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="h-4 bg-muted rounded w-1/4" />
                    <div className="h-5 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-full" />
                  </div>
                </CardContent>
              </Card>
            ))
          ) : filteredMinutes.length === 0 ? (
            <Card className="card-premium">
              <CardContent className="p-8 text-center">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground">لا توجد محاضر تطابق معايير البحث</p>
              </CardContent>
            </Card>
          ) : (
            filteredMinutes.map((minute: Minute, index: number) => (
              <Card key={minute.id} className={`card-premium card-hover animate-fadeInUp stagger-${(index % 5) + 1}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm font-mono hub-stat-gold">{getMinuteNumber(minute)}</span>
                        {getMinuteStatusBadge(minute.status)}
                      </div>
                      <h4 className="font-semibold text-lg mb-2">{minute.title}</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-muted-foreground mb-3">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {getMinuteDate(minute)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {getAttendeesCount(minute)} حاضرين
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText className="w-4 h-4" />
                          {getDecisionsCount(minute)} قرارات
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {minute.actionItems ? `${Array.isArray(minute.actionItems) ? minute.actionItems.length : 0} إجراء` : '—'}
                        </span>
                      </div>
                      
                      {minute.content && (
                        <div className="p-3 bg-muted/30 rounded-lg mb-3">
                          <p className="text-sm line-clamp-2">{minute.content}</p>
                        </div>
                      )}

                      <div className="mt-3">
                        <WorkflowIndicator steps={MINUTES_WORKFLOW_STEPS} currentStep={minute.status} />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => { setSelectedMinute(minute); setIsViewDialogOpen(true); }}
                        data-testid={`button-view-${minute.id}`}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleEditMinute(minute)}
                        data-testid={`button-edit-${minute.id}`}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        className="btn-gold"
                        onClick={() => downloadMinute(minute)}
                        data-testid={`button-download-${minute.id}`}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => deleteMinuteMutation.mutate(minute.id)}
                        data-testid={`button-delete-${minute.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* View Dialog */}
        {selectedMinute && (
          <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
            <DialogContent className="max-w-3xl" dir="rtl">
              <DialogHeader>
                <DialogTitle>{selectedMinute.title}</DialogTitle>
              </DialogHeader>
              <DialogBody className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">رقم المحاضر</p>
                    <p className="font-mono font-semibold">{getMinuteNumber(selectedMinute)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">الحالة</p>
                    {getMinuteStatusBadge(selectedMinute.status)}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">تاريخ الإنشاء</p>
                    <p className="font-semibold">{getMinuteDate(selectedMinute)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">عدد الحاضرين</p>
                    <p className="font-semibold">{getAttendeesCount(selectedMinute)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">عدد القرارات</p>
                    <p className="font-semibold">{getDecisionsCount(selectedMinute)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">عدد الإجراءات</p>
                    <p className="font-semibold">{Array.isArray(selectedMinute.actionItems) ? selectedMinute.actionItems.length : 0}</p>
                  </div>
                </div>

                {Array.isArray(selectedMinute.attendees) && selectedMinute.attendees.length > 0 && (
                  <div className="border-t pt-4">
                    <p className="text-sm text-muted-foreground mb-2">الحاضرون</p>
                    <ul className="space-y-1">
                      {selectedMinute.attendees.map((a: string, i: number) => (
                        <li key={i} className="text-sm flex items-center gap-2">
                          <Users className="w-3 h-3 text-muted-foreground" /> {a}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {Array.isArray(selectedMinute.decisions) && selectedMinute.decisions.length > 0 && (
                  <div className="border-t pt-4">
                    <p className="text-sm text-muted-foreground mb-2">القرارات</p>
                    <ul className="space-y-1">
                      {selectedMinute.decisions.map((d: string, i: number) => (
                        <li key={i} className="text-sm flex items-center gap-2">
                          <CheckCircle className="w-3 h-3 hub-stat-gold" /> {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedMinute.content && (
                  <div className="border-t pt-4">
                    <p className="text-sm text-muted-foreground mb-2">محتوى المحاضر</p>
                    <p className="whitespace-pre-wrap bg-muted/30 p-3 rounded-lg text-sm">{selectedMinute.content}</p>
                  </div>
                )}
              </DialogBody>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>إغلاق</Button>
                <Button 
                  className="btn-gold"
                  onClick={() => downloadMinute(selectedMinute)}
                  data-testid="button-download-from-view"
                >
                  <Download className="w-4 h-4 ml-2" />
                  تحميل
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={(open) => { setIsEditDialogOpen(open); if (!open) setEditingMinute(null); }}>
          <DialogContent className="max-w-2xl" dir="rtl" data-testid="dialog-edit-minutes">
            <DialogHeader>
              <DialogTitle>تعديل محاضر الجلسة</DialogTitle>
            </DialogHeader>
            <DialogBody className="space-y-4">
              <div>
                <Label htmlFor="edit-title">عنوان المحاضر</Label>
                <Input
                  id="edit-title"
                  placeholder="أدخل عنوان المحاضر"
                  value={editMinute.title}
                  onChange={(e) => setEditMinute({ ...editMinute, title: e.target.value })}
                  data-testid="input-edit-title"
                />
              </div>
              <div>
                <Label htmlFor="edit-status">الحالة</Label>
                <Select
                  value={editMinute.status}
                  onValueChange={(v) => setEditMinute({ ...editMinute, status: v })}
                >
                  <SelectTrigger data-testid="select-edit-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">قيد الإعداد</SelectItem>
                    <SelectItem value="approved">معتمد</SelectItem>
                    <SelectItem value="published">منشور</SelectItem>
                    <SelectItem value="archived">مؤرشف</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-attendees">الحاضرون (اسم في كل سطر)</Label>
                <Textarea
                  id="edit-attendees"
                  placeholder="أدخل أسماء الحاضرين"
                  value={editMinute.attendeesText}
                  onChange={(e) => setEditMinute({ ...editMinute, attendeesText: e.target.value })}
                  className="min-h-20"
                  data-testid="textarea-edit-attendees"
                />
              </div>
              <div>
                <Label htmlFor="edit-decisions">القرارات (قرار في كل سطر)</Label>
                <Textarea
                  id="edit-decisions"
                  placeholder="أدخل القرارات"
                  value={editMinute.decisionsText}
                  onChange={(e) => setEditMinute({ ...editMinute, decisionsText: e.target.value })}
                  className="min-h-20"
                  data-testid="textarea-edit-decisions"
                />
              </div>
              <div>
                <Label htmlFor="edit-content">محتوى المحاضر</Label>
                <Textarea
                  id="edit-content"
                  placeholder="أدخل محتوى المحاضر"
                  value={editMinute.content}
                  onChange={(e) => setEditMinute({ ...editMinute, content: e.target.value })}
                  className="min-h-24"
                  data-testid="textarea-edit-content"
                />
              </div>
            </DialogBody>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => { setIsEditDialogOpen(false); setEditingMinute(null); }} data-testid="button-cancel-edit-minutes">إلغاء</Button>
              <LoadingButton className="btn-gold" onClick={handleUpdateMinute} loading={updateMinuteMutation.isPending} loadingText="جاري التحديث..." data-testid="button-save-edit-minutes">
                تحديث
              </LoadingButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
