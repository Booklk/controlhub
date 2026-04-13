import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { getStatusBadge as getSharedStatusBadge, REFERRAL_ESCALATION_STATUS } from "@/lib/status-utils";
import {
  ArrowLeftRight, Send, ArrowUpCircle, Building2, AlertTriangle,
  CheckCircle, Clock, XCircle, ArrowRight, ArrowLeft, Eye, Inbox, ArrowUp
} from "lucide-react";

const DEPARTMENTS = [
  { id: 5, name: "مكتب إدارة البيانات", code: "DMO" },
  { id: 9, name: "البنية التحتية", code: "INFRA" },
  { id: 10, name: "الأمن السيبراني", code: "CYBER" },
  { id: 11, name: "التحول الرقمي", code: "DIGITAL" },
  { id: 12, name: "الدعم الفني", code: "SUPPORT" },
];

interface ReferralEscalationPanelProps {
  entityType: "task" | "ticket";
  entityId: number;
  entityTitle: string;
  currentDeptId: number;
  currentDeptName: string;
  onClose?: () => void;
}

export function ReferralDialog({
  entityType,
  entityId,
  entityTitle,
  currentDeptId,
  currentDeptName,
  isOpen,
  onClose,
}: ReferralEscalationPanelProps & { isOpen: boolean }) {
  const { toast } = useToast();
  const [toDepartmentId, setToDepartmentId] = useState("");
  const [reason, setReason] = useState("");
  const [priority, setPriority] = useState("medium");

  const otherDepts = DEPARTMENTS.filter(d => d.id !== currentDeptId);

  const createReferralMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/it-referrals", {
        type: entityType,
        entityId,
        title: entityTitle,
        description: reason,
        priority,
        fromDepartmentId: currentDeptId,
        toDepartmentId: parseInt(toDepartmentId),
        reason,
      });
    },
    onSuccess: () => {
      toast({ title: "تم إنشاء الإحالة بنجاح", description: `تم إحالة ${entityType === 'task' ? 'المهمة' : 'التذكرة'} إلى ${otherDepts.find(d => d.id === parseInt(toDepartmentId))?.name}` });
      queryClient.invalidateQueries({ queryKey: ["/api/it-referrals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/it-referrals/department"] });
      onClose?.();
      setToDepartmentId("");
      setReason("");
      setPriority("medium");
    },
    onError: () => {
      toast({ title: "خطأ", description: "حدث خطأ أثناء إنشاء الإحالة", variant: "destructive" });
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose?.()}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 hub-stat-gold" />
            إحالة {entityType === "task" ? "المهمة" : "التذكرة"} لإدارة أخرى
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            سيتم إرسال {entityType === "task" ? "المهمة" : "التذكرة"} للإدارة المحددة للمتابعة والتنفيذ
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-3 bg-foreground/5 rounded-md border border-[hsl(43_74%_49%)]/10">
            <p className="text-sm font-medium text-foreground">{entityTitle}</p>
            <p className="text-xs text-muted-foreground mt-1">من: {currentDeptName}</p>
          </div>
          <div>
            <Label className="text-foreground font-semibold">الإدارة المستهدفة</Label>
            <Select value={toDepartmentId} onValueChange={setToDepartmentId}>
              <SelectTrigger className="mt-1 border-foreground/20" data-testid="select-referral-dept">
                <SelectValue placeholder="اختر الإدارة" />
              </SelectTrigger>
              <SelectContent dir="rtl">
                {otherDepts.map((dept) => (
                  <SelectItem key={dept.id} value={String(dept.id)}>
                    <span className="flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      {dept.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-foreground font-semibold">الأولوية</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="mt-1 border-foreground/20" data-testid="select-referral-priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="low">منخفضة</SelectItem>
                <SelectItem value="medium">متوسطة</SelectItem>
                <SelectItem value="high">عالية</SelectItem>
                <SelectItem value="critical">حرجة</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-foreground font-semibold">سبب الإحالة</Label>
            <Textarea
              placeholder="اشرح سبب الإحالة بالتفصيل..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 border-foreground/20"
              data-testid="input-referral-reason"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button
            onClick={() => createReferralMutation.mutate()}
            disabled={createReferralMutation.isPending || !toDepartmentId || !reason}
            className="hub-btn-gold"
            data-testid="button-submit-referral"
          >
            <Send className="w-4 h-4 ml-2" />
            {createReferralMutation.isPending ? "جاري الإرسال..." : "إرسال الإحالة"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EscalationDialog({
  entityType,
  entityId,
  entityTitle,
  currentDeptId,
  currentDeptName,
  isOpen,
  onClose,
}: ReferralEscalationPanelProps & { isOpen: boolean }) {
  const { toast } = useToast();
  const [priority, setPriority] = useState("high");
  const [reason, setReason] = useState("");

  const createEscalationMutation = useMutation({
    mutationFn: async () => {
      const IT_DIRECTOR_DEPT_ID = 0;
      const res = await apiRequest("POST", "/api/escalations", {
        entityType,
        entityId,
        reason: `[${currentDeptName}] ${entityTitle}\n${reason}`,
        escalatedTo: IT_DIRECTOR_DEPT_ID,
        priority,
        status: "pending",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "فشل التصعيد");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم التصعيد بنجاح", description: "تم إرسال التصعيد للمدير العام للمراجعة واتخاذ الإجراء" });
      queryClient.invalidateQueries({ queryKey: ["/api/escalations"] });
      onClose?.();
      setPriority("high");
      setReason("");
    },
    onError: (err: any) => {
      toast({ title: "خطأ", description: err.message || "حدث خطأ أثناء التصعيد", variant: "destructive" });
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose?.()}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpCircle className="w-5 h-5 text-red-500" />
            تصعيد للمدير العام
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            سيتم إرسال نسخة من {entityType === "task" ? "المهمة" : "التذكرة"} للمدير العام لاتخاذ إجراء عاجل
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-3 bg-red-500/5 rounded-md border border-red-500/20">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <p className="text-sm font-medium">{entityTitle}</p>
            </div>
            <p className="text-xs text-muted-foreground">الإدارة المصعِّدة: {currentDeptName}</p>
            <Badge className="mt-1 bg-muted text-muted-foreground text-xs">{entityType === "task" ? "مهمة" : "تذكرة"} #{entityId}</Badge>
          </div>
          <div>
            <Label className="font-semibold">درجة الأولوية</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="mt-1" data-testid="select-escalation-severity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="medium">متوسطة</SelectItem>
                <SelectItem value="high">عالية</SelectItem>
                <SelectItem value="critical">حرجة - تحتاج تدخل فوري</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="font-semibold">سبب التصعيد</Label>
            <Textarea
              placeholder="اشرح سبب التصعيد بالتفصيل (مثال: تأخر في الاستجابة، تجاوز SLA، يحتاج قرار إداري...)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="mt-1"
              data-testid="input-escalation-reason"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button
            onClick={() => createEscalationMutation.mutate()}
            disabled={createEscalationMutation.isPending || reason.length < 5}
            variant="destructive"
            data-testid="button-submit-escalation"
          >
            <ArrowUp className="w-4 h-4 ml-2" />
            {createEscalationMutation.isPending ? "جاري التصعيد..." : "تصعيد للمدير العام"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ReferralItem {
  id: number;
  referralNumber: string;
  type: string;
  title: string;
  description: string;
  priority: string;
  fromDepartmentId: number;
  toDepartmentId: number;
  status: string;
  reason: string | null;
  responseNote: string | null;
  createdAt: string;
}

function getStatusBadge(status: string) {
  return getSharedStatusBadge(status, REFERRAL_ESCALATION_STATUS);
}

function getPriorityBadge(priority: string) {
  const styles: Record<string, string> = {
    low: "bg-muted text-muted-foreground border border-muted/40",
    medium: "hub-badge-navy",
    high: "hub-badge-gold",
    critical: "bg-red-500/15 text-red-700 border border-red-500/30",
    urgent: "bg-red-600/20 text-red-800 border border-red-600/40 font-semibold",
  };
  const labels: Record<string, string> = { low: "منخفضة", medium: "متوسطة", high: "عالية", critical: "حرجة", urgent: "عاجلة" };
  return <Badge className={`${styles[priority] || styles.medium} font-medium text-xs`}>{labels[priority] || priority}</Badge>;
}

function getDeptName(id: number) {
  return DEPARTMENTS.find(d => d.id === id)?.name || `إدارة ${id}`;
}

export function DepartmentReferralsSection({ departmentId, departmentName }: { departmentId: number; departmentName: string }) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"incoming" | "outgoing">("incoming");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "accepted" | "rejected">("all");
  const [rejectingReferral, setRejectingReferral] = useState<ReferralItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: incomingReferrals = [] } = useQuery<ReferralItem[]>({
    queryKey: ['/api/it-referrals/department', departmentId, 'incoming'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/it-referrals/department/${departmentId}?direction=incoming`);
      return res.json();
    },
  });

  const { data: outgoingReferrals = [] } = useQuery<ReferralItem[]>({
    queryKey: ['/api/it-referrals/department', departmentId, 'outgoing'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/it-referrals/department/${departmentId}?direction=outgoing`);
      return res.json();
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, rejectionReason: reason }: { id: number; status: string; rejectionReason?: string }) => {
      return apiRequest("PUT", `/api/it-referrals/${id}/status`, { status, rejectionReason: reason });
    },
    onSuccess: (_, variables) => {
      toast({ title: variables.status === "accepted" ? "تم قبول الإحالة وإنشاء مهمة للإدارة" : variables.status === "rejected" ? "تم رفض الإحالة" : "تم تحديث حالة الإحالة" });
      queryClient.invalidateQueries({ queryKey: ['/api/it-referrals/department', departmentId, 'incoming'] });
      queryClient.invalidateQueries({ queryKey: ['/api/it-referrals/department', departmentId, 'outgoing'] });
      queryClient.invalidateQueries({ queryKey: ["/api/it-referrals"] });
      setRejectingReferral(null);
      setRejectionReason("");
    },
  });

  const handleReject = () => {
    if (!rejectingReferral || !rejectionReason.trim()) return;
    updateStatusMutation.mutate({
      id: rejectingReferral.id,
      status: "rejected",
      rejectionReason: rejectionReason.trim(),
    });
  };

  const pendingIncoming = incomingReferrals.filter(r => r.status === "pending").length;
  const allReferrals = activeTab === "incoming" ? incomingReferrals : outgoingReferrals;
  const referrals = statusFilter === "all" ? allReferrals : allReferrals.filter(r => r.status === statusFilter);
  const acceptedCount = allReferrals.filter(r => r.status === "accepted").length;
  const rejectedCount = allReferrals.filter(r => r.status === "rejected").length;
  const pendingCount = allReferrals.filter(r => r.status === "pending").length;

  return (
    <>
      <Card className="border-[hsl(43_74%_49%)]/10">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="flex items-center gap-2 text-foreground text-base">
              <ArrowLeftRight className="w-5 h-5 hub-stat-gold" />
              إحالات {departmentName}
              {pendingIncoming > 0 && (
                <Badge className="bg-red-500/15 text-red-700 border border-red-500/30 text-xs mr-1">
                  {pendingIncoming} بانتظار الرد
                </Badge>
              )}
            </CardTitle>
            <div className="flex gap-1">
              <Button
                variant={activeTab === "incoming" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("incoming")}
                className={activeTab === "incoming" ? "bg-amber-500 text-slate-900" : ""}
                data-testid="button-incoming-referrals"
              >
                <ArrowLeft className="w-4 h-4 ml-1" />
                واردة ({incomingReferrals.length})
              </Button>
              <Button
                variant={activeTab === "outgoing" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("outgoing")}
                className={activeTab === "outgoing" ? "hub-btn-gold" : ""}
                data-testid="button-outgoing-referrals"
              >
                <ArrowRight className="w-4 h-4 ml-1" />
                صادرة ({outgoingReferrals.length})
              </Button>
            </div>
          </div>
          {allReferrals.length > 0 && (
            <div className="flex gap-1 mt-3 flex-wrap">
              <Button variant={statusFilter === "all" ? "default" : "ghost"} size="sm" className={`h-7 text-xs ${statusFilter === "all" ? "bg-amber-500 text-slate-900" : ""}`} onClick={() => setStatusFilter("all")} data-testid="filter-referral-all">
                الكل ({allReferrals.length})
              </Button>
              {pendingCount > 0 && (
                <Button variant={statusFilter === "pending" ? "default" : "ghost"} size="sm" className={`h-7 text-xs ${statusFilter === "pending" ? "hub-btn-gold" : ""}`} onClick={() => setStatusFilter("pending")} data-testid="filter-referral-pending">
                  <Clock className="w-3 h-3 ml-1" />بانتظار ({pendingCount})
                </Button>
              )}
              {acceptedCount > 0 && (
                <Button variant={statusFilter === "accepted" ? "default" : "ghost"} size="sm" className={`h-7 text-xs ${statusFilter === "accepted" ? "bg-emerald-600 text-white hover:bg-emerald-700" : ""}`} onClick={() => setStatusFilter("accepted")} data-testid="filter-referral-accepted">
                  <CheckCircle className="w-3 h-3 ml-1" />مقبولة ({acceptedCount})
                </Button>
              )}
              {rejectedCount > 0 && (
                <Button variant={statusFilter === "rejected" ? "default" : "ghost"} size="sm" className={`h-7 text-xs ${statusFilter === "rejected" ? "bg-red-600 text-white hover:bg-red-700" : ""}`} onClick={() => setStatusFilter("rejected")} data-testid="filter-referral-rejected">
                  <XCircle className="w-3 h-3 ml-1" />مرفوضة ({rejectedCount})
                </Button>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {referrals.length === 0 ? (
            <div className="text-center py-8">
              <Inbox className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">
                {statusFilter !== "all" ? `لا توجد إحالات ${statusFilter === "pending" ? "بانتظار" : statusFilter === "accepted" ? "مقبولة" : "مرفوضة"}` : `لا توجد إحالات ${activeTab === "incoming" ? "واردة" : "صادرة"}`}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {referrals.map((ref) => (
                <div
                  key={ref.id}
                  className={`p-4 border rounded-md transition-colors ${
                    ref.status === "pending" && activeTab === "incoming"
                      ? "border-[hsl(43_74%_49%)]/30 bg-[hsl(43_74%_49%)]/[0.03]"
                      : ref.status === "rejected"
                      ? "border-red-500/20 bg-red-500/[0.02]"
                      : "border-foreground/10 hover:border-[hsl(43_74%_49%)]/25"
                  }`}
                  data-testid={`referral-item-${ref.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <h4 className="font-semibold text-foreground text-sm truncate">{ref.title}</h4>
                        {getStatusBadge(ref.status)}
                        {getPriorityBadge(ref.priority)}
                        <Badge className="bg-foreground/5 text-foreground border border-foreground/10 font-normal text-xs">
                          {ref.type === "task" ? "مهمة" : "تذكرة"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {activeTab === "incoming" ? `من: ${getDeptName(ref.fromDepartmentId)}` : `إلى: ${getDeptName(ref.toDepartmentId)}`}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(ref.createdAt).toLocaleDateString("ar-SA")}
                        </span>
                        {ref.referralNumber && (
                          <span className="hub-stat-gold font-mono text-[10px]">#{ref.referralNumber}</span>
                        )}
                      </div>
                      {ref.reason && (
                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                          <span className="font-medium">السبب:</span> {ref.reason}
                        </p>
                      )}
                      {ref.status === "rejected" && ref.responseNote && (
                        <div className="mt-2 p-2 bg-red-500/5 border border-red-500/15 rounded-md">
                          <p className="text-xs text-red-700 font-medium flex items-center gap-1">
                            <XCircle className="w-3 h-3" />
                            سبب الرفض:
                          </p>
                          <p className="text-xs text-red-600 mt-0.5">{ref.responseNote}</p>
                        </div>
                      )}
                      {ref.status === "accepted" && (
                        <div className="mt-2 p-2 bg-[hsl(43_74%_49%)]/5 border border-[hsl(43_74%_49%)]/15 rounded-md">
                          <p className="text-xs text-foreground font-medium flex items-center gap-1">
                            <CheckCircle className="w-3 h-3 hub-stat-gold" />
                            تم القبول وإنشاء مهمة للإدارة المستقبلة
                          </p>
                        </div>
                      )}
                    </div>
                    {activeTab === "incoming" && ref.status === "pending" && (
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          size="sm"
                          onClick={() => updateStatusMutation.mutate({ id: ref.id, status: "accepted" })}
                          disabled={updateStatusMutation.isPending}
                          className="hub-btn-gold"
                          data-testid={`button-accept-referral-${ref.id}`}
                        >
                          <CheckCircle className="w-4 h-4 ml-1" />
                          قبول
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setRejectingReferral(ref); setRejectionReason(""); }}
                          disabled={updateStatusMutation.isPending}
                          className="border-red-500/30 text-red-600"
                          data-testid={`button-reject-referral-${ref.id}`}
                        >
                          <XCircle className="w-4 h-4 ml-1" />
                          رفض
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!rejectingReferral} onOpenChange={(open) => { if (!open) { setRejectingReferral(null); setRejectionReason(""); } }}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-500" />
              رفض الإحالة
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              يرجى ذكر سبب رفض هذه الإحالة. سيتم إبلاغ الإدارة المرسلة بالسبب.
            </DialogDescription>
          </DialogHeader>
          {rejectingReferral && (
            <div className="space-y-4">
              <div className="p-3 bg-red-500/5 border border-red-500/15 rounded-md">
                <p className="text-sm font-medium text-foreground">{rejectingReferral.title}</p>
                <p className="text-xs text-muted-foreground mt-1">من: {getDeptName(rejectingReferral.fromDepartmentId)}</p>
              </div>
              <div>
                <Label className="text-foreground font-semibold">سبب الرفض *</Label>
                <Textarea
                  placeholder="اذكر سبب رفض الإحالة بالتفصيل..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="mt-1 border-foreground/20 min-h-[80px]"
                  data-testid="input-rejection-reason"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectingReferral(null); setRejectionReason(""); }}>إلغاء</Button>
            <Button
              onClick={handleReject}
              disabled={updateStatusMutation.isPending || rejectionReason.trim().length < 3}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="button-confirm-reject"
            >
              <XCircle className="w-4 h-4 ml-2" />
              {updateStatusMutation.isPending ? "جاري الرفض..." : "تأكيد الرفض"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ReferralEscalationButtons({
  entityType,
  entityId,
  entityTitle,
  currentDeptId,
  currentDeptName,
}: Omit<ReferralEscalationPanelProps, "onClose">) {
  const [showReferral, setShowReferral] = useState(false);
  const [showEscalation, setShowEscalation] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowReferral(true)}
        className="hub-stat-gold"
        data-testid={`button-refer-${entityType}-${entityId}`}
      >
        <ArrowLeftRight className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowEscalation(true)}
        className="text-red-500"
        data-testid={`button-escalate-${entityType}-${entityId}`}
      >
        <ArrowUpCircle className="w-4 h-4" />
      </Button>

      <ReferralDialog
        entityType={entityType}
        entityId={entityId}
        entityTitle={entityTitle}
        currentDeptId={currentDeptId}
        currentDeptName={currentDeptName}
        isOpen={showReferral}
        onClose={() => setShowReferral(false)}
      />
      <EscalationDialog
        entityType={entityType}
        entityId={entityId}
        entityTitle={entityTitle}
        currentDeptId={currentDeptId}
        currentDeptName={currentDeptName}
        isOpen={showEscalation}
        onClose={() => setShowEscalation(false)}
      />
    </>
  );
}
