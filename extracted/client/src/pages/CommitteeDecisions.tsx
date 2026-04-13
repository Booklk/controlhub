import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/lib/auth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/LoadingButton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, invalidateRelatedQueries } from "@/lib/queryClient";
import { committeeNavGroups } from "@/lib/navigation";
import { decisionCreationSchema, type DecisionCreationFormData } from "@/lib/schemas";
import { 
  FileText, Plus, Search, RefreshCw, CheckCircle, Clock, 
  Users, Calendar, Vote, ThumbsUp, ThumbsDown,
  ArrowRight, FileCheck, Gavel, AlertCircle, Pencil, Trash2,
  FileDown, FileSpreadsheet, Send, XCircle, Eye, Minus, Shield, Paperclip
} from "lucide-react";
import { useConfirmDialog, ConfirmDialog } from '@/components/ConfirmDialog';
import { exportToPDF, exportToExcel, formatStatus} from '@/lib/exports';
import { PageHeader, KpiCard } from "@/components/Quality";
import { Progress } from "@/components/ui/progress";
import { FileAttachment, type FileAttachmentData } from "@/components/FileAttachment";
import { WorkflowIndicator as SharedWorkflowIndicator } from "@/components/WorkflowIndicator";
import { getStatusBadge, COMMITTEE_DECISION_STATUS } from "@/lib/status-utils";

const DECISION_WORKFLOW_STEPS = [
  { id: 'draft', label: 'مسودة', icon: FileText },
  { id: 'pending_review', label: 'بانتظار المراجعة', icon: Send },
  { id: 'voting', label: 'التصويت', icon: Vote },
  { id: 'approved', label: 'معتمد', icon: CheckCircle },
  { id: 'implemented', label: 'التنفيذ', icon: FileCheck },
];

function DecisionWorkflowIndicator({ currentStep }: { currentStep: string }) {
  if (currentStep === 'rejected') {
    return (
      <div className="flex items-center gap-1 px-3 py-1.5 bg-destructive/10 rounded-lg">
        <XCircle className="w-4 h-4 text-destructive" />
        <span className="text-xs font-bold text-destructive">مرفوض</span>
      </div>
    );
  }
  const stepMap: Record<string, string> = {
    draft: 'draft', pending_review: 'pending_review', pending: 'pending_review',
    review: 'pending_review', voting: 'voting', approved: 'approved', implemented: 'implemented',
  };
  return <SharedWorkflowIndicator steps={DECISION_WORKFLOW_STEPS} currentStep={stepMap[currentStep] || 'draft'} />;
}

const ROLE_LABELS: Record<string, string> = {
  system_admin: 'مدير النظام',
  admin: 'مدير النظام',
  committee_chairman: 'رئيس اللجنة',
  committee_vice_chairman: 'نائب رئيس اللجنة',
  committee_rapporteur: 'مقرر اللجنة',
  committee_specialist: 'عضو متخصص (مقرر)',
  committee_member: 'عضو اللجنة',
  it_director: 'مدير تقنية المعلومات',
  dmo_manager: 'مدير مكتب إدارة البيانات',
};

function DecisionCreationForm({ 
  isOpen, 
  onOpenChange,
  editingItem,
  onEditingItemChange,
}: { 
  isOpen: boolean; 
  onOpenChange: (open: boolean) => void;
  editingItem?: any;
  onEditingItemChange?: (item: any) => void;
}) {
  const { toast } = useToast();
  const [attachments, setAttachments] = useState<FileAttachmentData[]>([]);
  const form = useForm<DecisionCreationFormData>({
    resolver: zodResolver(decisionCreationSchema),
    defaultValues: {
      title: "",
      description: "",
      decisionType: "resolution",
      priority: "medium",
      effectiveDate: "",
      assignedTo: "",
      meetingId: undefined,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: DecisionCreationFormData) => {
      return apiRequest("POST", "/api/committee/decisions", { ...data, attachments });
    },
    onSuccess: () => {
      toast({ title: "نجح", description: "تم إنشاء القرار بنجاح وسيتم إرساله للمراجعة" });
      queryClient.invalidateQueries({ queryKey: ['/api/committee/decisions'] });
      invalidateRelatedQueries('/api/committee/decisions');
      form.reset();
      setAttachments([]);
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل إنشاء القرار", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: DecisionCreationFormData) => {
      return apiRequest("PUT", `/api/committee/decisions/${editingItem?.id}`, { ...data, attachments });
    },
    onSuccess: () => {
      toast({ title: "نجح", description: "تم تحديث القرار بنجاح" });
      queryClient.invalidateQueries({ queryKey: ['/api/committee/decisions'] });
      invalidateRelatedQueries('/api/committee/decisions');
      form.reset();
      onEditingItemChange?.(null);
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل تحديث القرار", variant: "destructive" });
    },
  });

  const onSubmit = (data: DecisionCreationFormData) => {
    if (editingItem) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const onInvalid = (errors: any) => {
    const errorMessages = Object.values(errors).map((e: any) => e?.message).filter(Boolean);
    if (errorMessages.length > 0) {
      toast({ title: "يرجى تصحيح الأخطاء", description: errorMessages.join(" • "), variant: "destructive" });
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      form.reset();
      setAttachments([]);
      onEditingItemChange?.(null);
    }
    onOpenChange(open);
  };

  useEffect(() => {
    if (editingItem) {
      form.reset({
        title: editingItem.title || "",
        description: editingItem.description || "",
        decisionType: editingItem.category || editingItem.decisionType || editingItem.type || "resolution",
        priority: editingItem.priority || "medium",
        effectiveDate: editingItem.effectiveDate ? new Date(editingItem.effectiveDate).toISOString().split('T')[0] : "",
        assignedTo: editingItem.assignedTo || "",
        meetingId: editingItem.meetingId || undefined,
      });
      setAttachments(Array.isArray(editingItem.attachments) ? editingItem.attachments : []);
    }
  }, [editingItem]);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileText className="w-5 h-5 hub-stat-gold" />
            {editingItem ? "تعديل القرار" : "مقترح قرار جديد"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit, onInvalid)}>
            <DialogBody className="space-y-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      عنوان القرار <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="مثال: اعتماد سياسة حماية البيانات" {...field} className="text-right" data-testid="input-decision-title" />
                    </FormControl>
                    <FormMessage className="text-sm" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      وصف القرار <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Textarea placeholder="اشرح التفاصيل الكاملة للقرار والأسباب والآثار المتوقعة..." {...field} rows={4} className="text-right resize-none" data-testid="textarea-decision-description" />
                    </FormControl>
                    <FormMessage className="text-sm" />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="decisionType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">نوع القرار <span className="text-destructive">*</span></FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-decision-type"><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="policy">سياسة</SelectItem>
                          <SelectItem value="procedure">إجراء</SelectItem>
                          <SelectItem value="resolution">قرار</SelectItem>
                          <SelectItem value="directive">توجيه</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage className="text-sm" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">مستوى الأولوية <span className="text-destructive">*</span></FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-priority"><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="urgent">عاجل</SelectItem>
                          <SelectItem value="low">منخفض</SelectItem>
                          <SelectItem value="medium">متوسط</SelectItem>
                          <SelectItem value="high">عالي</SelectItem>
                          <SelectItem value="critical">حرج</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage className="text-sm" />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="effectiveDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">تاريخ التطبيق</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-effective-date" />
                      </FormControl>
                      <FormMessage className="text-sm" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="assignedTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">مسؤول التنفيذ</FormLabel>
                      <FormControl>
                        <Input placeholder="اسم الشخص أو الإدارة المسؤولة" {...field} value={field.value || ""} className="text-right" data-testid="input-assigned-to" />
                      </FormControl>
                      <FormMessage className="text-sm" />
                    </FormItem>
                  )}
                />
              </div>

              <div>
                <FileAttachment
                  attachments={attachments}
                  onAttachmentsChange={setAttachments}
                  maxFiles={10}
                  label="المرفقات (مستندات، عروض، ملفات مرجعية)"
                  compact
                />
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/30 rounded-lg p-3 flex gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  سيتم إنشاء القرار كمسودة. بعد ذلك يمكنك تقديمه للمراجعة من قبل رئيس اللجنة، ثم يُطرح للتصويت ويُعتمد.
                </p>
              </div>
            </DialogBody>

            <DialogFooter className="gap-3">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-decision">
                إلغاء
              </Button>
              <LoadingButton
                type="submit"
                className="btn-gold"
                loading={createMutation.isPending || updateMutation.isPending}
                loadingText="جاري الحفظ..."
                data-testid="button-submit-decision"
              >
                {editingItem ? "تحديث القرار" : "إنشاء القرار"}
              </LoadingButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function VotesDetailDialog({ decisionId, isOpen, onOpenChange }: { decisionId: number | null; isOpen: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: votes = [] } = useQuery<any[]>({
    queryKey: ['/api/committee/decisions', decisionId, 'votes'],
    queryFn: () => apiRequest('GET', `/api/committee/decisions/${decisionId}/votes`).then(r => r.json()),
    enabled: isOpen && !!decisionId,
  });
  const voteLabels: Record<string, string> = { approve: 'موافق', reject: 'رافض', abstain: 'ممتنع' };
  const voteColors: Record<string, string> = { approve: 'hub-stat-gold', reject: 'text-destructive', abstain: 'text-muted-foreground' };
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Vote className="w-5 h-5 hub-stat-gold" />تفاصيل التصويت</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {votes.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">لا توجد أصوات بعد</p>
          ) : (
            <div className="space-y-3">
              {votes.map((v: any) => (
                <div key={v.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{v.memberName || `عضو #${v.memberId}`}</p>
                      {v.memberRole && <p className="text-xs text-muted-foreground">{ROLE_LABELS[v.memberRole] || v.memberRole}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={voteColors[v.vote]}>
                      {v.vote === 'approve' && <ThumbsUp className="w-3 h-3 ml-1" />}
                      {v.vote === 'reject' && <ThumbsDown className="w-3 h-3 ml-1" />}
                      {v.vote === 'abstain' && <Minus className="w-3 h-3 ml-1" />}
                      {voteLabels[v.vote] || v.vote}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function AddAttachmentDialog({ 
  decisionId, 
  isOpen, 
  onOpenChange 
}: { 
  decisionId: number | null; 
  isOpen: boolean; 
  onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const [attachments, setAttachments] = useState<FileAttachmentData[]>([]);

  const addMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/committee/decisions/${decisionId}/attachments`, { attachments });
    },
    onSuccess: () => {
      toast({ title: "تم إضافة المرفقات بنجاح", description: "سيتم إشعار أعضاء اللجنة" });
      queryClient.invalidateQueries({ queryKey: ['/api/committee/decisions'] });
      invalidateRelatedQueries('/api/committee/decisions');
      setAttachments([]);
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل إضافة المرفقات", variant: "destructive" });
    },
  });

  const handleClose = (open: boolean) => {
    if (!open) setAttachments([]);
    onOpenChange(open);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Paperclip className="w-5 h-5 hub-stat-gold" />
            إضافة مرفقات للقرار
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <p className="text-sm text-muted-foreground">
            ارفع الملفات المطلوبة وسيتم إشعار جميع أعضاء اللجنة والرئيس بالمرفقات الجديدة.
          </p>
          <FileAttachment
            attachments={attachments}
            onAttachmentsChange={setAttachments}
            maxFiles={10}
            label="اختر الملفات للإرفاق"
          />
        </DialogBody>
        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={() => handleClose(false)}>إلغاء</Button>
          <LoadingButton
            className="btn-gold"
            loading={addMutation.isPending}
            loadingText="جاري الإضافة..."
            onClick={() => addMutation.mutate()}
            disabled={attachments.length === 0}
            data-testid="button-confirm-add-attachments"
          >
            إضافة المرفقات ({attachments.length})
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RejectReasonDialog({ isOpen, onOpenChange, onConfirm, isPending }: { isOpen: boolean; onOpenChange: (v: boolean) => void; onConfirm: (reason: string) => void; isPending: boolean }) {
  const [reason, setReason] = useState('');
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <XCircle className="w-5 h-5" />
            رفض القرار
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-2">سبب الرفض</label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="اذكر سبب رفض القرار..."
              rows={3}
              className="resize-none"
              data-testid="textarea-rejection-reason"
            />
          </div>
        </DialogBody>
        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <LoadingButton
            className="bg-destructive text-white hover:bg-destructive/90"
            loading={isPending}
            loadingText="جاري الرفض..."
            onClick={() => onConfirm(reason)}
            data-testid="button-confirm-reject"
          >
            تأكيد الرفض
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function CommitteeDecisions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { confirm: confirmAction, dialogProps } = useConfirmDialog();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [votesDialogDecisionId, setVotesDialogDecisionId] = useState<number | null>(null);
  const [rejectDialogDecisionId, setRejectDialogDecisionId] = useState<number | null>(null);
  const [attachDialogDecisionId, setAttachDialogDecisionId] = useState<number | null>(null);

  const userRole = user?.role || '';
  const committeeRole = (user as any)?.committeeRole || '';
  const committeeRoleMapped = { chairman: 'committee_chairman', chair: 'committee_chairman', vice_chairman: 'committee_vice_chairman', vice_chair: 'committee_vice_chairman', rapporteur: 'committee_rapporteur', specialist_member: 'committee_specialist', specialist: 'committee_specialist', member: 'committee_member' }[committeeRole] || '';
  const effectiveRole = committeeRoleMapped || userRole;
  const isChairman = ['system_admin', 'admin', 'committee_chairman'].includes(userRole) || committeeRoleMapped === 'committee_chairman';
  const isSecretary = ['system_admin', 'admin', 'committee_rapporteur'].includes(userRole) || ['committee_rapporteur', 'committee_specialist'].includes(committeeRoleMapped);
  const isWriter = ['system_admin', 'admin', 'dmo_manager', 'committee_chairman', 'committee_vice_chairman', 'committee_rapporteur'].includes(userRole) || ['committee_chairman', 'committee_vice_chairman', 'committee_rapporteur', 'committee_specialist'].includes(committeeRoleMapped);

  const { data: decisions = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ['/api/committee/decisions'],
  });

  const getDecisionStatusBadge = (status: string) => getStatusBadge(status, COMMITTEE_DECISION_STATUS);

  const submitMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('PATCH', `/api/committee/decisions/${id}/submit`, {});
    },
    onSuccess: () => {
      toast({ title: 'تم تقديم القرار للمراجعة', description: 'سيتم إشعار رئيس اللجنة' });
      queryClient.invalidateQueries({ queryKey: ['/api/committee/decisions'] });
      invalidateRelatedQueries('/api/committee/decisions');
    },
    onError: (err: any) => {
      toast({ title: 'خطأ', description: err?.message || 'فشل تقديم القرار', variant: 'destructive' });
    },
  });

  const sendToVotingMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('PATCH', `/api/committee/decisions/${id}/send-to-voting`, {});
    },
    onSuccess: () => {
      toast({ title: 'تم إرسال القرار للتصويت', description: 'تم إشعار جميع الأعضاء' });
      queryClient.invalidateQueries({ queryKey: ['/api/committee/decisions'] });
      invalidateRelatedQueries('/api/committee/decisions');
    },
    onError: (err: any) => {
      toast({ title: 'خطأ', description: err?.message || 'فشل إرسال القرار للتصويت', variant: 'destructive' });
    },
  });

  const voteMutation = useMutation({
    mutationFn: async ({ id, vote }: { id: number; vote: string }) => {
      return apiRequest('POST', `/api/committee/decisions/${id}/vote`, { vote });
    },
    onSuccess: (_, vars) => {
      const voteLabel = vars.vote === 'approve' ? 'بالموافقة' : vars.vote === 'reject' ? 'بالرفض' : 'بالامتناع';
      toast({ title: `تم تسجيل تصويتك ${voteLabel}` });
      queryClient.invalidateQueries({ queryKey: ['/api/committee/decisions'] });
      invalidateRelatedQueries('/api/committee/decisions');
    },
    onError: (err: any) => {
      const msg = err?.message || 'حدث خطأ في التصويت';
      toast({ title: 'خطأ', description: msg.includes('مسبقاً') ? 'لقد قمت بالتصويت مسبقاً على هذا القرار' : msg, variant: 'destructive' });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('PATCH', `/api/committee/decisions/${id}/chairman-approve`, {});
    },
    onSuccess: () => {
      toast({ title: 'تم اعتماد القرار', description: 'تم إشعار جميع الأعضاء بالاعتماد' });
      queryClient.invalidateQueries({ queryKey: ['/api/committee/decisions'] });
      invalidateRelatedQueries('/api/committee/decisions');
    },
    onError: (err: any) => {
      toast({ title: 'خطأ', description: err?.message || 'فشل اعتماد القرار', variant: 'destructive' });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, rejectionReason }: { id: number; rejectionReason: string }) => {
      return apiRequest('PATCH', `/api/committee/decisions/${id}/chairman-reject`, { rejectionReason });
    },
    onSuccess: () => {
      toast({ title: 'تم رفض القرار' });
      setRejectDialogDecisionId(null);
      queryClient.invalidateQueries({ queryKey: ['/api/committee/decisions'] });
      invalidateRelatedQueries('/api/committee/decisions');
    },
    onError: (err: any) => {
      toast({ title: 'خطأ', description: err?.message || 'فشل رفض القرار', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/committee/decisions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/committee/decisions'] });
      invalidateRelatedQueries('/api/committee/decisions');
      toast({ title: "تم حذف القرار بنجاح" });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل حذف القرار", variant: "destructive" });
    },
  });

  const handleEdit = (decision: any) => {
    setEditingItem(decision);
    setIsAddDialogOpen(true);
  };

  const filteredDecisions = decisions.filter((d: any) => {
    const matchesSearch = !searchQuery || d.title?.includes(searchQuery) || d.decisionNumber?.includes(searchQuery);
    const matchesStatus = statusFilter === 'all' || d.status === statusFilter ||
      (statusFilter === 'pending' && ['pending', 'pending_review'].includes(d.status));
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: decisions.length,
    draft: decisions.filter((d: any) => d.status === 'draft').length,
    pending: decisions.filter((d: any) => ['pending', 'pending_review', 'review'].includes(d.status)).length,
    voting: decisions.filter((d: any) => d.status === 'voting').length,
    approved: decisions.filter((d: any) => d.status === 'approved' || d.status === 'implemented').length,
  };

  const handleExportPDF = () => {
    exportToPDF({
      title: 'تقرير قرارات اللجنة',
      subtitle: 'JCSA - Control Hub',
      columns: [
        { header: "القرار", key: "title", width: 40 },
        { header: "الحالة", key: "status", width: 20 },
        { header: "الأصوات (موافق/رافض/ممتنع)", key: "votes", width: 25 },
        { header: "التاريخ", key: "date", width: 25 },
      ],
      data: decisions.map((item: any) => ({
        title: item.title || '',
        status: formatStatus(item.status || ''),
        votes: `${item.votesFor || 0}/${item.votesAgainst || 0}/${item.votesAbstain || 0}`,
        date: item.createdAt ? new Date(item.createdAt).toLocaleDateString('ar-SA') : '',
      })),
      filename: 'committee-decisions-report',
      orientation: 'landscape',
    });
  };

  const handleExportExcel = () => {
    exportToExcel({
      title: 'تقرير قرارات اللجنة',
      columns: [
        { header: "القرار", key: "title", width: 40 },
        { header: "الحالة", key: "status", width: 20 },
        { header: "الأصوات (موافق/رافض/ممتنع)", key: "votes", width: 25 },
        { header: "التاريخ", key: "date", width: 25 },
      ],
      data: decisions.map((item: any) => ({
        title: item.title || '',
        status: formatStatus(item.status || ''),
        votes: `${item.votesFor || 0}/${item.votesAgainst || 0}/${item.votesAbstain || 0}`,
        date: item.createdAt ? new Date(item.createdAt).toLocaleDateString('ar-SA') : '',
      })),
      filename: 'committee-decisions-report',
    });
  };

  const categoryLabels: Record<string, string> = {
    policy: "سياسة", procedure: "إجراء", resolution: "قرار",
    directive: "توجيه", general: "عام"
  };

  return (
    <DashboardLayout 
      title="قرارات اللجنة" 
      subtitle="إدارة ومتابعة قرارات لجنة حوكمة البيانات"
      navGroups={committeeNavGroups}
      portalName="بوابة اللجان"
    >
      <DecisionCreationForm 
        isOpen={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        editingItem={editingItem}
        onEditingItemChange={setEditingItem}
      />
      <ConfirmDialog {...dialogProps} />
      <VotesDetailDialog
        decisionId={votesDialogDecisionId}
        isOpen={!!votesDialogDecisionId}
        onOpenChange={(v) => { if (!v) setVotesDialogDecisionId(null); }}
      />
      <RejectReasonDialog
        isOpen={!!rejectDialogDecisionId}
        onOpenChange={(v) => { if (!v) setRejectDialogDecisionId(null); }}
        onConfirm={(reason) => {
          if (rejectDialogDecisionId) {
            rejectMutation.mutate({ id: rejectDialogDecisionId, rejectionReason: reason });
          }
        }}
        isPending={rejectMutation.isPending}
      />
      <AddAttachmentDialog
        decisionId={attachDialogDecisionId}
        isOpen={!!attachDialogDecisionId}
        onOpenChange={(v) => { if (!v) setAttachDialogDecisionId(null); }}
      />
      <div className="space-y-5">
        <PageHeader
          icon={Gavel}
          title="قرارات اللجان"
          subtitle={`دورك: ${ROLE_LABELS[userRole] || userRole}`}
          actions={
            <>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input placeholder="بحث في القرارات..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pr-10 h-9 text-sm w-44 bg-background" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 h-9 text-sm"><SelectValue placeholder="الحالة" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الحالات</SelectItem>
                  <SelectItem value="draft">مسودة</SelectItem>
                  <SelectItem value="pending">بانتظار المراجعة</SelectItem>
                  <SelectItem value="voting">قيد التصويت</SelectItem>
                  <SelectItem value="approved">معتمد</SelectItem>
                  <SelectItem value="rejected">مرفوض</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => refetch()}><RefreshCw className="w-3.5 h-3.5" /></Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportPDF} data-testid="button-export-pdf"><FileDown className="w-3.5 h-3.5" />PDF</Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportExcel} data-testid="button-export-excel"><FileSpreadsheet className="w-3.5 h-3.5" />Excel</Button>
              {isWriter && (
                <Button className="btn-gold h-9 gap-1.5 text-xs" onClick={() => { setEditingItem(null); setIsAddDialogOpen(true); }} data-testid="button-new-decision">
                  <Plus className="w-3.5 h-3.5" />مقترح جديد
                </Button>
              )}
            </>
          }
        />

        <div className="bg-gradient-to-r from-primary/5 to-accent/5 border border-accent/20 rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 hub-stat-gold" />
            دورة حياة القرار
          </h3>
          <div className="flex items-center gap-3 flex-wrap text-xs">
            <div className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-muted-foreground" /><span>المقرر ينشئ مسودة</span></div>
            <ArrowRight className="w-3 h-3 text-muted-foreground" />
            <div className="flex items-center gap-1.5"><Send className="w-3.5 h-3.5 text-amber-500" /><span>يقدمها للمراجعة</span></div>
            <ArrowRight className="w-3 h-3 text-muted-foreground" />
            <div className="flex items-center gap-1.5"><Gavel className="w-3.5 h-3.5 text-primary" /><span>الرئيس يراجع ويرسل للتصويت</span></div>
            <ArrowRight className="w-3 h-3 text-muted-foreground" />
            <div className="flex items-center gap-1.5"><Vote className="w-3.5 h-3.5 text-blue-500" /><span>الأعضاء يصوتون</span></div>
            <ArrowRight className="w-3 h-3 text-muted-foreground" />
            <div className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 hub-stat-gold" /><span>الرئيس يعتمد</span></div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard label="إجمالي القرارات" value={stats.total} icon={FileText} color="navy" sublabel="جميع المقترحات" />
          <KpiCard label="مسودة" value={stats.draft} icon={FileText} color="muted" sublabel="بانتظار التقديم" active={statusFilter === "draft"} onClick={() => setStatusFilter(statusFilter === "draft" ? "all" : "draft")} />
          <KpiCard label="بانتظار المراجعة" value={stats.pending} icon={Clock} color="gold" sublabel="تحتاج مراجعة الرئيس" active={statusFilter === "pending"} onClick={() => setStatusFilter(statusFilter === "pending" ? "all" : "pending")} data-testid="kpi-pending-decisions" />
          <KpiCard label="قيد التصويت" value={stats.voting} icon={Vote} color="info" sublabel="جلسات مفتوحة" active={statusFilter === "voting"} onClick={() => setStatusFilter(statusFilter === "voting" ? "all" : "voting")} data-testid="kpi-voting-decisions" />
          <KpiCard label="معتمدة" value={stats.approved} icon={CheckCircle} color="success" sublabel="تمت الموافقة" active={statusFilter === "approved"} onClick={() => setStatusFilter(statusFilter === "approved" ? "all" : "approved")} data-testid="kpi-approved-decisions" />
        </div>

        <div className="space-y-4">
          {filteredDecisions.length === 0 && !isLoading && (
            <Card className="card-premium">
              <CardContent className="p-8 text-center">
                <Gavel className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-muted-foreground">لا توجد قرارات {statusFilter !== 'all' ? 'بهذه الحالة' : ''}</p>
              </CardContent>
            </Card>
          )}
          {filteredDecisions.map((decision: any, index: number) => {
            const totalVotes = (decision.votesFor || 0) + (decision.votesAgainst || 0) + (decision.votesAbstain || 0);
            const approvalPct = totalVotes > 0 ? Math.round((decision.votesFor || 0) / totalVotes * 100) : 0;
            return (
              <Card key={decision.id} className={`card-premium card-hover animate-fadeInUp stagger-${(index % 5) + 1}`}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <span className="text-sm font-mono hub-stat-gold">{decision.decisionNumber}</span>
                        {getDecisionStatusBadge(decision.status)}
                        <Badge variant="outline" className="text-xs">{categoryLabels[decision.category] || decision.category}</Badge>
                        {decision.priority === 'high' && <Badge className="bg-orange-500/20 text-orange-600 text-xs">عالي</Badge>}
                        {decision.priority === 'critical' && <Badge className="bg-destructive/20 text-destructive text-xs">حرج</Badge>}
                      </div>
                      <h4 className="font-semibold text-lg mb-1">{decision.title}</h4>
                      {decision.description && (
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{decision.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {decision.createdAt ? new Date(decision.createdAt).toLocaleDateString('ar-SA') : "-"}
                        </span>
                        {decision.votingDeadline && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            ينتهي: {new Date(decision.votingDeadline).toLocaleDateString('ar-SA')}
                          </span>
                        )}
                      </div>

                      {decision.rejectionReason && decision.status === 'rejected' && (
                        <div className="mt-3 p-3 bg-destructive/5 border border-destructive/20 rounded-lg text-sm">
                          <span className="font-medium text-destructive">سبب الرفض: </span>
                          <span className="text-muted-foreground">{decision.rejectionReason}</span>
                        </div>
                      )}

                      <div className="mt-3" data-testid={`attachments-section-${decision.id}`}>
                        {Array.isArray(decision.attachments) && decision.attachments.length > 0 && (
                          <FileAttachment
                            attachments={decision.attachments}
                            readonly
                            compact
                            label={`المرفقات (${decision.attachments.length})`}
                          />
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2 gap-1.5 text-xs"
                          onClick={() => setAttachDialogDecisionId(decision.id)}
                          data-testid={`button-add-attachment-${decision.id}`}
                        >
                          <Paperclip className="w-3.5 h-3.5" />
                          إضافة مرفق
                        </Button>
                      </div>

                      {(decision.status === 'voting' || decision.status === 'approved' || decision.status === 'rejected') && totalVotes > 0 && (
                        <div className="mt-3 p-3 bg-muted/30 rounded-lg space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">نتائج التصويت ({totalVotes} صوت)</span>
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setVotesDialogDecisionId(decision.id)} data-testid={`button-view-votes-${decision.id}`}>
                              <Eye className="w-3 h-3" />
                              التفاصيل
                            </Button>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="p-2 bg-accent/10 rounded">
                              <div className="flex items-center justify-center gap-1 mb-1">
                                <ThumbsUp className="w-3.5 h-3.5 hub-stat-gold" />
                                <span className="text-xs">موافق</span>
                              </div>
                              <span className="text-lg font-bold hub-stat-gold">{decision.votesFor || 0}</span>
                            </div>
                            <div className="p-2 bg-destructive/5 rounded">
                              <div className="flex items-center justify-center gap-1 mb-1">
                                <ThumbsDown className="w-3.5 h-3.5 text-destructive" />
                                <span className="text-xs">رافض</span>
                              </div>
                              <span className="text-lg font-bold text-destructive">{decision.votesAgainst || 0}</span>
                            </div>
                            <div className="p-2 bg-muted rounded">
                              <div className="flex items-center justify-center gap-1 mb-1">
                                <Minus className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-xs">ممتنع</span>
                              </div>
                              <span className="text-lg font-bold text-muted-foreground">{decision.votesAbstain || 0}</span>
                            </div>
                          </div>
                          <Progress value={approvalPct} className="h-1.5" />
                          <p className="text-xs text-muted-foreground text-center">نسبة الموافقة: {approvalPct}%</p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-3 flex-shrink-0">
                      <DecisionWorkflowIndicator currentStep={decision.status} />

                      <div className="flex gap-1.5 flex-wrap justify-end">
                        {decision.status === 'draft' && isWriter && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => handleEdit(decision)} data-testid={`button-edit-decision-${decision.id}`}>
                              <Pencil className="w-3.5 h-3.5 ml-1" />تعديل
                            </Button>
                            <Button size="sm" className="btn-gold gap-1" onClick={() => submitMutation.mutate(decision.id)} disabled={submitMutation.isPending} data-testid={`button-submit-decision-${decision.id}`}>
                              <Send className="w-3.5 h-3.5" />تقديم للمراجعة
                            </Button>
                          </>
                        )}

                        {['pending_review', 'pending', 'review'].includes(decision.status) && isChairman && (
                          <>
                            <Button size="sm" className="btn-gold gap-1" onClick={() => {
                              confirmAction(() => sendToVotingMutation.mutate(decision.id), {
                                title: 'إرسال للتصويت',
                                description: `هل تريد إرسال القرار "${decision.title}" للتصويت من قبل الأعضاء؟`,
                                confirmText: 'إرسال',
                                variant: 'info',
                              });
                            }} disabled={sendToVotingMutation.isPending} data-testid={`button-send-voting-${decision.id}`}>
                              <Vote className="w-3.5 h-3.5" />إرسال للتصويت
                            </Button>
                            <Button size="sm" variant="outline" className="gap-1 text-destructive" onClick={() => setRejectDialogDecisionId(decision.id)} data-testid={`button-reject-decision-${decision.id}`}>
                              <XCircle className="w-3.5 h-3.5" />رفض
                            </Button>
                          </>
                        )}

                        {decision.status === 'voting' && (
                          <>
                            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white gap-1" onClick={() => voteMutation.mutate({ id: decision.id, vote: 'approve' })} disabled={voteMutation.isPending} data-testid={`button-vote-approve-${decision.id}`}>
                              <ThumbsUp className="w-3.5 h-3.5" />موافق
                            </Button>
                            <Button size="sm" variant="outline" className="gap-1" onClick={() => voteMutation.mutate({ id: decision.id, vote: 'reject' })} disabled={voteMutation.isPending} data-testid={`button-vote-reject-${decision.id}`}>
                              <ThumbsDown className="w-3.5 h-3.5" />رافض
                            </Button>
                            <Button size="sm" variant="outline" className="gap-1 text-muted-foreground" onClick={() => voteMutation.mutate({ id: decision.id, vote: 'abstain' })} disabled={voteMutation.isPending} data-testid={`button-vote-abstain-${decision.id}`}>
                              <Minus className="w-3.5 h-3.5" />ممتنع
                            </Button>
                            {isChairman && (
                              <>
                                <div className="w-full border-t mt-1 pt-1" />
                                <Button size="sm" className="btn-gold gap-1 w-full" onClick={() => {
                                  confirmAction(() => approveMutation.mutate(decision.id), {
                                    title: 'اعتماد القرار',
                                    description: `هل تريد اعتماد القرار "${decision.title}" نهائياً بعد مراجعة نتائج التصويت؟`,
                                    confirmText: 'اعتماد',
                                    variant: 'info',
                                  });
                                }} disabled={approveMutation.isPending} data-testid={`button-chairman-approve-${decision.id}`}>
                                  <CheckCircle className="w-3.5 h-3.5" />اعتماد رئيس اللجنة
                                </Button>
                                <Button size="sm" variant="outline" className="gap-1 text-destructive w-full" onClick={() => setRejectDialogDecisionId(decision.id)} data-testid={`button-chairman-reject-${decision.id}`}>
                                  <XCircle className="w-3.5 h-3.5" />رفض رئيس اللجنة
                                </Button>
                              </>
                            )}
                          </>
                        )}

                        {['draft', 'rejected'].includes(decision.status) && isWriter && (
                          <Button size="icon" variant="ghost" onClick={() => confirmAction(() => deleteMutation.mutate(decision.id), { title: 'حذف القرار', description: `هل أنت متأكد من حذف القرار "${decision.title}"؟` })} data-testid={`button-delete-decision-${decision.id}`}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
