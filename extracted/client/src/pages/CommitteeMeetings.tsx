import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/LoadingButton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, invalidateRelatedQueries } from "@/lib/queryClient";
import { committeeNavGroups } from "@/lib/navigation";
import { meetingCreationSchema, type MeetingCreationFormData } from "@/lib/schemas";
import {
  Calendar, Plus, Search, RefreshCw, CheckCircle, Clock,
  Users, FileText,
  MapPin, Eye, Trash2, Users2, ListTodo,
  Pencil, FileDown, FileSpreadsheet
} from "lucide-react";
import { useConfirmDialog, ConfirmDialog } from '@/components/ConfirmDialog';
import { exportToPDF, exportToExcel, formatStatus} from '@/lib/exports';
import { PageHeader, KpiCard } from "@/components/Quality";
import { WorkflowIndicator } from "@/components/WorkflowIndicator";

function parseAgendaItems(agenda: any): string[] {
  if (!agenda) return [];
  if (Array.isArray(agenda)) return agenda;
  if (typeof agenda === 'string') return agenda.split('\n').filter((s: string) => s.trim());
  return [];
}

const MEETING_WORKFLOW_STEPS = [
  { id: 'create', label: 'إنشاء', icon: Plus },
  { id: 'schedule', label: 'جدولة', icon: Calendar },
  { id: 'convene', label: 'انعقاد', icon: Users },
  { id: 'document', label: 'توثيق', icon: FileText },
  { id: 'archive', label: 'أرشفة', icon: CheckCircle },
];

function getMeetingWorkflowStep(status: string): string {
  const map: Record<string, string> = {
    draft: 'create', pending: 'create',
    scheduled: 'schedule',
    in_progress: 'convene',
    completed: 'document',
    archived: 'archive',
  };
  return map[status] || status;
}

export default function CommitteeMeetings() {
  const { toast } = useToast();
  const { confirm: confirmAction, dialogProps } = useConfirmDialog();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isAttendeesDialogOpen, setIsAttendeesDialogOpen] = useState(false);
  const [isAgendaDialogOpen, setIsAgendaDialogOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<any>(null);
  const [attendees, setAttendees] = useState<string>('');
  const [agenda, setAgenda] = useState<string>('');
  const [editingItem, setEditingItem] = useState<any>(null);

  const form = useForm<MeetingCreationFormData>({
    resolver: zodResolver(meetingCreationSchema),
    defaultValues: {
      title: '',
      description: '',
      meetingDate: '',
      startTime: '',
      endTime: '',
      location: '',
      agenda: '',
      meetingType: 'regular',
    },
  });

  const { data: meetings = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ['/api/committee-meetings'],
  });

  const getStatusBadge = (status: string, workflowStep?: string) => {
    const step = workflowStep || (
      status === 'scheduled' ? 'schedule' :
      status === 'in_progress' ? 'convene' :
      status === 'completed' ? 'document' :
      status === 'archived' ? 'archive' :
      status === 'cancelled' ? 'archive' : status
    );
    const styles: Record<string, string> = {
      create: "bg-muted text-muted-foreground",
      schedule: "bg-primary/20 text-muted-foreground",
      convene: "hub-badge-gold hub-stat-gold",
      document: "hub-badge-gold-solid",
      archive: "hub-badge-neutral",
    };
    const labels: Record<string, string> = {
      create: "قيد الإنشاء",
      schedule: "جاهزة للجدولة",
      convene: "جارية الآن",
      document: "قيد التوثيق",
      archive: "مؤرشفة"
    };
    return <Badge className={styles[step] || styles.create}>{labels[step] || step}</Badge>;
  };

  const stats = {
    total: meetings.length,
    upcoming: meetings.filter((m: any) => m.status === 'scheduled' || m.status === 'draft' || m.workflowStep === 'schedule' || m.workflowStep === 'create').length,
    ongoing: meetings.filter((m: any) => m.status === 'in_progress' || m.workflowStep === 'convene').length,
    documented: meetings.filter((m: any) => m.status === 'completed' || m.status === 'archived' || m.workflowStep === 'document' || m.workflowStep === 'archive').length,
  };

  const createMeetingMutation = useMutation({
    mutationFn: async (data: MeetingCreationFormData) => {
      const res = await apiRequest('POST', '/api/committee-meetings', {
        title: data.title,
        description: data.description,
        date: data.meetingDate,
        time: data.startTime,
        endTime: data.endTime,
        location: data.location,
        agenda: data.agenda,
        meetingType: data.meetingType,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'تم إنشاء الاجتماع بنجاح', description: 'تمت إضافة الاجتماع الجديد إلى القائمة' });
      setIsAddDialogOpen(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/committee-meetings'] });
      invalidateRelatedQueries('/api/committee-meetings');
    },
    onError: (error: Error) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: MeetingCreationFormData) => {
      const res = await apiRequest('PATCH', `/api/committee-meetings/${editingItem?.id}`, {
        title: data.title,
        description: data.description,
        date: data.meetingDate,
        time: data.startTime,
        endTime: data.endTime,
        location: data.location,
        agenda: data.agenda,
        meetingType: data.meetingType,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'تم تحديث الاجتماع بنجاح' });
      setIsAddDialogOpen(false);
      setEditingItem(null);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/committee-meetings'] });
      invalidateRelatedQueries('/api/committee-meetings');
    },
    onError: (error: Error) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/committee-meetings/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/committee-meetings'] });
      invalidateRelatedQueries('/api/committee-meetings');
      toast({ title: 'تم حذف الاجتماع بنجاح' });
    },
    onError: (error: Error) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });

  const handleEdit = (meeting: any) => {
    setEditingItem(meeting);
    form.reset({
      title: meeting.title || '',
      description: meeting.description || '',
      meetingDate: meeting.date || '',
      startTime: meeting.time || '',
      endTime: meeting.endTime || '',
      location: meeting.location || '',
      agenda: Array.isArray(meeting.agenda) ? meeting.agenda.join('\n') : (meeting.agenda || ''),
      meetingType: meeting.meetingType || 'regular',
    });
    setIsAddDialogOpen(true);
  };

  const onSubmit = async (data: MeetingCreationFormData) => {
    if (editingItem) {
      updateMutation.mutate(data);
    } else {
      createMeetingMutation.mutate(data);
    }
  };

  const handleViewDetails = (meeting: any) => {
    setSelectedMeeting(meeting);
    setIsDetailsDialogOpen(true);
  };

  const handleSetAttendees = (meeting: any) => {
    setSelectedMeeting(meeting);
    setAttendees(meeting.attendees?.join('\n') || '');
    setIsAttendeesDialogOpen(true);
  };

  const handleSetAgenda = (meeting: any) => {
    setSelectedMeeting(meeting);
    setAgenda(Array.isArray(meeting.agenda) ? meeting.agenda.join('\n') : (meeting.agenda || ''));
    setIsAgendaDialogOpen(true);
  };

  const saveAttendeesMutation = useMutation({
    mutationFn: async () => {
      const attendeesList = attendees.split('\n').filter(Boolean);
      const res = await apiRequest('PATCH', `/api/committee-meetings/${selectedMeeting!.id}`, { attendees: attendeesList });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/committee-meetings'] });
      invalidateRelatedQueries('/api/committee-meetings');
      toast({ title: 'تم تحديث الحاضرين', description: 'تم حفظ قائمة الحاضرين بنجاح' });
      setIsAttendeesDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'حدث خطأ', description: error.message, variant: 'destructive' });
    }
  });

  const saveAgendaMutation = useMutation({
    mutationFn: async () => {
      const agendaItems = agenda.split('\n').filter(Boolean);
      const res = await apiRequest('PATCH', `/api/committee-meetings/${selectedMeeting!.id}`, { agenda: agendaItems });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/committee-meetings'] });
      invalidateRelatedQueries('/api/committee-meetings');
      toast({ title: 'تم تحديث جدول الأعمال', description: 'تم حفظ جدول الأعمال بنجاح' });
      setIsAgendaDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'حدث خطأ', description: error.message, variant: 'destructive' });
    }
  });

  const handleSaveAttendees = () => {
    if (selectedMeeting && attendees.trim()) {
      saveAttendeesMutation.mutate();
    } else {
      toast({ title: 'تنبيه', description: 'يرجى إدخال أسماء الحاضرين', variant: 'destructive' });
    }
  };

  const handleSaveAgenda = () => {
    if (selectedMeeting && agenda.trim()) {
      saveAgendaMutation.mutate();
    } else {
      toast({ title: 'تنبيه', description: 'يرجى إدخال بنود جدول الأعمال', variant: 'destructive' });
    }
  };

  const filteredMeetings = meetings.filter((meeting: any) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery ||
      (meeting.title || '').toLowerCase().includes(searchLower) ||
      (meeting.number || meeting.meetingNumber || '').toLowerCase().includes(searchLower);
    const matchesStatus = statusFilter === 'all' || meeting.workflowStep === statusFilter || meeting.status === statusFilter;
    return matchesSearch && matchesStatus;
  });


  const handleExportPDF = () => {
    exportToPDF({
      title: 'تقرير اجتماعات اللجنة',
      subtitle: 'JCSA - Control Hub',
      columns: [{"header":"الاجتماع","key":"title","width":40},{"header":"التاريخ","key":"date","width":25},{"header":"الموقع","key":"location","width":25},{"header":"الحالة","key":"status","width":20}],
      data: (filteredMeetings || meetings || []).map((item: any) => ({ title: item.title || '', date: item.meetingDate || item.date ? new Date(item.meetingDate || item.date).toLocaleDateString('ar-SA') : '', location: item.location || '', status: formatStatus(item.status || '') })),
      filename: 'committee-meetings-report',
      orientation: 'landscape',
    });
  };

  const handleExportExcel = () => {
    exportToExcel({
      title: 'تقرير اجتماعات اللجنة',
      columns: [{"header":"الاجتماع","key":"title","width":40},{"header":"التاريخ","key":"date","width":25},{"header":"الموقع","key":"location","width":25},{"header":"الحالة","key":"status","width":20}],
      data: (filteredMeetings || meetings || []).map((item: any) => ({ title: item.title || '', date: item.meetingDate || item.date ? new Date(item.meetingDate || item.date).toLocaleDateString('ar-SA') : '', location: item.location || '', status: formatStatus(item.status || '') })),
      filename: 'committee-meetings-report',
    });
  };

  return (
    <DashboardLayout
      title="اجتماعات اللجنة"
      subtitle="إدارة ومتابعة اجتماعات لجنة حوكمة البيانات"
      navGroups={committeeNavGroups}
      portalName="اللجنة"
    >
      <div className="space-y-5">
        <PageHeader
          icon={Calendar}
          title="اجتماعات اللجان"
          subtitle="إدارة ومتابعة اجتماعات اللجان"
          actions={
            <>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input placeholder="بحث في الاجتماعات..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pr-10 h-9 text-sm w-44 bg-background" data-testid="input-search-meetings" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 h-9 text-sm" data-testid="select-status-filter"><SelectValue placeholder="الحالة" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الحالات</SelectItem>
                  <SelectItem value="create">قيد الإنشاء</SelectItem>
                  <SelectItem value="schedule">جاهزة للجدولة</SelectItem>
                  <SelectItem value="convene">جارية الآن</SelectItem>
                  <SelectItem value="document">قيد التوثيق</SelectItem>
                  <SelectItem value="archive">مؤرشفة</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => refetch()} data-testid="button-refresh-meetings"><RefreshCw className="w-3.5 h-3.5" /></Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportPDF} data-testid="button-export-pdf"><FileDown className="w-3.5 h-3.5" />PDF</Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportExcel} data-testid="button-export-excel"><FileSpreadsheet className="w-3.5 h-3.5" />Excel</Button>
              <Button className="btn-gold h-9 gap-1.5 text-xs" onClick={() => { setEditingItem(null); form.reset(); setIsAddDialogOpen(true); }} data-testid="button-add-meeting"><Plus className="w-3.5 h-3.5" />اجتماع جديد</Button>
            </>
          }
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label="إجمالي الاجتماعات"
            value={stats.total}
            icon={Calendar}
            color="navy"
            sublabel="كل اجتماعات اللجنة"
            active={statusFilter === "all"}
            onClick={() => setStatusFilter("all")}
            data-testid="kpi-total-meetings"
          />
          <KpiCard
            label="الاجتماعات القادمة"
            value={stats.upcoming}
            icon={Clock}
            color="gold"
            sublabel="مجدولة ولم تُعقد بعد"
            active={statusFilter === "schedule"}
            onClick={() => setStatusFilter(statusFilter === "schedule" ? "all" : "schedule")}
            data-testid="kpi-upcoming-meetings"
          />
          <KpiCard
            label="جارية الآن"
            value={stats.ongoing}
            icon={Users}
            color={stats.ongoing > 0 ? "info" : "muted"}
            sublabel={stats.ongoing > 0 ? "اجتماعات تُعقد الآن" : "لا اجتماعات جارية"}
            active={statusFilter === "convene"}
            onClick={() => setStatusFilter(statusFilter === "convene" ? "all" : "convene")}
            data-testid="kpi-ongoing-meetings"
          />
          <KpiCard
            label="موثقة"
            value={stats.documented}
            icon={CheckCircle}
            color="success"
            sublabel="مكتملة ومحفوظة في الأرشيف"
            active={statusFilter === "document"}
            onClick={() => setStatusFilter(statusFilter === "document" ? "all" : "document")}
            data-testid="kpi-documented-meetings"
          />
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={(open) => { setIsAddDialogOpen(open); if (!open) { setEditingItem(null); form.reset(); } }}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
                  <DialogHeader>
                    <DialogTitle>{editingItem ? "تعديل الاجتماع" : "إنشاء اجتماع جديد"}</DialogTitle>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                      <DialogBody className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        {/* Title Field */}
                        <FormField
                          control={form.control}
                          name="title"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>العنوان</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="عنوان الاجتماع"
                                  {...field}
                                  data-testid="input-meeting-title"
                                />
                              </FormControl>
                              <FormMessage data-testid="error-meeting-title" />
                            </FormItem>
                          )}
                        />

                        {/* Meeting Type Field */}
                        <FormField
                          control={form.control}
                          name="meetingType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>نوع الاجتماع</FormLabel>
                              <Select value={field.value} onValueChange={field.onChange}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-meeting-type">
                                    <SelectValue placeholder="اختر نوع الاجتماع" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="regular">عادي</SelectItem>
                                  <SelectItem value="emergency">طارئ</SelectItem>
                                  <SelectItem value="special">خاص</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage data-testid="error-meeting-type" />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {/* Date Field */}
                        <FormField
                          control={form.control}
                          name="meetingDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>التاريخ</FormLabel>
                              <FormControl>
                                <Input
                                  type="date"
                                  {...field}
                                  data-testid="input-meeting-date"
                                />
                              </FormControl>
                              <FormMessage data-testid="error-meeting-date" />
                            </FormItem>
                          )}
                        />

                        {/* Location Field */}
                        <FormField
                          control={form.control}
                          name="location"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>الموقع (اختياري)</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="مكان الاجتماع"
                                  {...field}
                                  data-testid="input-meeting-location"
                                />
                              </FormControl>
                              <FormMessage data-testid="error-meeting-location" />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {/* Start Time Field */}
                        <FormField
                          control={form.control}
                          name="startTime"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>وقت البداية</FormLabel>
                              <FormControl>
                                <Input
                                  type="time"
                                  {...field}
                                  data-testid="input-meeting-start-time"
                                />
                              </FormControl>
                              <FormMessage data-testid="error-meeting-start-time" />
                            </FormItem>
                          )}
                        />

                        {/* End Time Field */}
                        <FormField
                          control={form.control}
                          name="endTime"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>وقت النهاية (اختياري)</FormLabel>
                              <FormControl>
                                <Input
                                  type="time"
                                  {...field}
                                  data-testid="input-meeting-end-time"
                                />
                              </FormControl>
                              <FormMessage data-testid="error-meeting-end-time" />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Agenda Field */}
                      <FormField
                        control={form.control}
                        name="agenda"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>جدول الأعمال</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="أدخل بنود جدول الأعمال (10 أحرف على الأقل)"
                                {...field}
                                rows={4}
                                data-testid="textarea-meeting-agenda"
                              />
                            </FormControl>
                            <FormMessage data-testid="error-meeting-agenda" />
                          </FormItem>
                        )}
                      />

                      {/* Description Field */}
                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>الوصف (اختياري)</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="وصف الاجتماع"
                                {...field}
                                rows={3}
                                data-testid="textarea-meeting-description"
                              />
                            </FormControl>
                            <FormMessage data-testid="error-meeting-description" />
                          </FormItem>
                        )}
                      />
                      </DialogBody>

                      <DialogFooter>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setIsAddDialogOpen(false);
                            form.reset();
                          }}
                        >
                          إلغاء
                        </Button>
                        <LoadingButton
                          type="submit"
                          className="btn-gold"
                          loading={createMeetingMutation.isPending || updateMutation.isPending}
                          loadingText="جاري الحفظ..."
                          data-testid="button-create-meeting"
                        >
                          {editingItem ? 'تحديث' : 'إنشاء'}
                        </LoadingButton>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>

        {/* Meetings List */}
        <div className="space-y-4">
          {filteredMeetings.map((meeting: any, index: number) => (
            <Card key={meeting.id} className={`card-premium card-hover animate-fadeInUp stagger-${(index % 5) + 1}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm font-mono hub-stat-gold">{meeting.number || meeting.meetingNumber}</span>
                      {getStatusBadge(meeting.status, meeting.workflowStep)}
                    </div>
                    <h4 className="font-semibold text-lg mb-2">{meeting.title}</h4>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground mb-3">
                      <span className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 hub-stat-gold" />
                        {meeting.date}
                      </span>
                      <span className="flex items-center gap-2">
                        <Clock className="w-4 h-4 hub-stat-gold" />
                        {meeting.time}
                      </span>
                      <span className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 hub-stat-gold" />
                        {meeting.location}
                      </span>
                    </div>

                    <div className="flex items-center gap-6 text-sm text-muted-foreground mb-3">
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {meeting.organizer}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users2 className="w-4 h-4" />
                        {meeting.attendees?.length || 0} حاضرين
                      </span>
                    </div>

                    {(() => { const agendaItems = parseAgendaItems(meeting.agenda); return agendaItems.length > 0 ? (
                      <div className="p-3 bg-muted/30 rounded-lg mb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <ListTodo className="w-4 h-4 hub-stat-gold" />
                          <span className="font-medium text-sm">جدول الأعمال:</span>
                        </div>
                        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                          {agendaItems.slice(0, 2).map((item: string, idx: number) => (
                            <li key={idx}>{item}</li>
                          ))}
                          {agendaItems.length > 2 && (
                            <li className="hub-stat-gold">و {agendaItems.length - 2} آخرون</li>
                          )}
                        </ul>
                      </div>
                    ) : null; })()}

                    {meeting.minutes && (
                      <div className="p-3 hub-icon-gold rounded-lg border border-accent/20">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 hub-stat-gold" />
                          <span className="text-sm hub-stat-gold">المحاضر: {meeting.minutes}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <WorkflowIndicator steps={MEETING_WORKFLOW_STEPS} currentStep={meeting.workflowStep || getMeetingWorkflowStep(meeting.status)} />
                    <div className="flex gap-2 mt-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleEdit(meeting)}
                        data-testid={`button-edit-meeting-${meeting.id}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => confirmAction(
                          () => deleteMutation.mutate(meeting.id),
                          { title: "حذف الاجتماع", description: `هل أنت متأكد من حذف الاجتماع "${meeting.title}"؟` }
                        )}
                        data-testid={`button-delete-meeting-${meeting.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1"
                        onClick={() => handleViewDetails(meeting)}
                        data-testid={`button-view-details-${meeting.id}`}
                      >
                        <Eye className="w-4 h-4" />
                        التفاصيل
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => handleSetAttendees(meeting)}
                        data-testid={`button-set-attendees-${meeting.id}`}
                      >
                        <Users2 className="w-4 h-4" />
                        الحاضرين
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => handleSetAgenda(meeting)}
                        data-testid={`button-set-agenda-${meeting.id}`}
                      >
                        <ListTodo className="w-4 h-4" />
                        الأعمال
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {filteredMeetings.length === 0 && (
            <Card className="card-premium">
              <CardContent className="p-8 text-center">
                <Calendar className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">لا توجد اجتماعات تطابق البحث</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Meeting Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>تفاصيل الاجتماع</DialogTitle>
          </DialogHeader>
          <DialogBody>
          {selectedMeeting && (
            <div className="space-y-3">
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">الرقم</p>
                <p className="font-mono font-semibold hub-stat-gold">{selectedMeeting.number}</p>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">العنوان</p>
                <p className="font-semibold">{selectedMeeting.title}</p>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">التاريخ والوقت</p>
                <p className="font-semibold">{selectedMeeting.date} - {selectedMeeting.time}</p>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">الموقع</p>
                <p className="font-semibold">{selectedMeeting.location}</p>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">المنظم</p>
                <p className="font-semibold">{selectedMeeting.organizer}</p>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">الحالة</p>
                {getStatusBadge(selectedMeeting.status)}
              </div>
            </div>
          )}
          </DialogBody>
          <DialogFooter>
            <Button className="btn-gold" onClick={() => setIsDetailsDialogOpen(false)}>
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attendees Dialog */}
      <Dialog open={isAttendeesDialogOpen} onOpenChange={setIsAttendeesDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>تعيين الحاضرين</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div>
              <Label className="mb-2 block">أسماء الحاضرين</Label>
              <Textarea
                placeholder="أدخل أسماء الحاضرين (كل اسم في سطر)"
                value={attendees}
                onChange={(e) => setAttendees(e.target.value)}
                rows={5}
                data-testid="textarea-attendees"
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAttendeesDialogOpen(false)}>
              إلغاء
            </Button>
            <Button className="btn-gold" onClick={handleSaveAttendees} data-testid="button-save-attendees">
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog {...dialogProps} />

      {/* Agenda Dialog */}
      <Dialog open={isAgendaDialogOpen} onOpenChange={setIsAgendaDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>تعيين جدول الأعمال</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div>
              <Label className="mb-2 block">بنود جدول الأعمال</Label>
              <Textarea
                placeholder="أدخل بنود جدول الأعمال (كل بند في سطر)"
                value={agenda}
                onChange={(e) => setAgenda(e.target.value)}
                rows={5}
                data-testid="textarea-agenda"
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAgendaDialogOpen(false)}>
              إلغاء
            </Button>
            <Button className="btn-gold" onClick={handleSaveAgenda} data-testid="button-save-agenda">
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
