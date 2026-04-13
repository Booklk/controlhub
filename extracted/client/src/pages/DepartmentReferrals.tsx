import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeftRight, CheckCircle, XCircle, Clock, Search, Play, RotateCcw,
  ArrowLeft, Calendar,
  RefreshCw, Eye, Inbox, Send, MessageSquare,
  CheckSquare, AlertTriangle, Timer, Bell, BellRing, ChevronUp,
  Plus, Shield, Star, Forward, History, Check
} from "lucide-react";
import { FileAttachment, type FileAttachmentData } from "@/components/FileAttachment";
import { FormSuccessPanel } from "@/components/ui/form-guide";
import type { NavGroup } from "@/lib/navigation";

// ─── Constants ────────────────────────────────────────────────────────────────
const DEPARTMENTS = [
  { id: 5, name: "مكتب إدارة البيانات", nameEn: "DMO", color: "text-cyan-400", bg: "bg-cyan-500/10" },
  { id: 9, name: "البنية التحتية", nameEn: "Infrastructure", color: "text-green-400", bg: "bg-green-500/10" },
  { id: 10, name: "الأمن السيبراني", nameEn: "Cybersecurity", color: "text-red-400", bg: "bg-red-500/10" },
  { id: 11, name: "التحول الرقمي", nameEn: "Digital", color: "text-indigo-400", bg: "bg-indigo-500/10" },
  { id: 12, name: "الدعم الفني", nameEn: "Support", color: "text-orange-400", bg: "bg-orange-500/10" },
];
const getDept = (id: number) => DEPARTMENTS.find(d => d.id === id) || { id, name: `إدارة ${id}`, nameEn: "", color: "text-white", bg: "bg-white/10" };

const PRIORITY_MAP: Record<string, { label: string; color: string; dot: string }> = {
  low: { label: "منخفضة", color: "text-blue-400 bg-blue-500/10 border-blue-500/30", dot: "bg-blue-400" },
  medium: { label: "متوسطة", color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30", dot: "bg-yellow-400" },
  high: { label: "عالية", color: "text-orange-400 bg-orange-500/10 border-orange-500/30", dot: "bg-orange-400" },
  urgent: { label: "عاجلة", color: "text-red-400 bg-red-500/10 border-red-500/30", dot: "bg-red-400" },
  critical: { label: "حرجة", color: "text-red-500 bg-red-600/10 border-red-600/30", dot: "bg-red-500" },
};

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "معلقة — بانتظار الاستلام", color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30", icon: <Clock className="w-3 h-3" /> },
  acknowledged: { label: "مؤكدة الاستلام", color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30", icon: <Bell className="w-3 h-3" /> },
  accepted: { label: "مقبولة — قيد الدراسة", color: "text-blue-400 bg-blue-500/10 border-blue-500/30", icon: <CheckSquare className="w-3 h-3" /> },
  in_progress: { label: "قيد التنفيذ", color: "text-purple-400 bg-purple-500/10 border-purple-500/30", icon: <Play className="w-3 h-3" /> },
  completed: { label: "مكتملة", color: "text-green-400 bg-green-500/10 border-green-500/30", icon: <CheckCircle className="w-3 h-3" /> },
  rejected: { label: "مرفوضة", color: "text-red-400 bg-red-500/10 border-red-500/30", icon: <XCircle className="w-3 h-3" /> },
  returned: { label: "مُعادة للمُرسِل", color: "text-orange-400 bg-orange-500/10 border-orange-500/30", icon: <RotateCcw className="w-3 h-3" /> },
  delegated: { label: "مُحوَّلة لجهة أخرى", color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/30", icon: <Forward className="w-3 h-3" /> },
};

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface Referral {
  id: number;
  referralNumber: string;
  type: string;
  entityId: number;
  title: string;
  description: string;
  priority: string;
  fromDepartmentId: number;
  toDepartmentId: number;
  referredById: number;
  assignedToId: number | null;
  delegatedToDepartmentId: number | null;
  status: string;
  reason: string | null;
  responseNote: string | null;
  dueDate: string | null;
  slaHours: number | null;
  slaAcknowledgeHours: number | null;
  acceptedAt: string | null;
  completedAt: string | null;
  acknowledgedAt: string | null;
  escalationLevel: number;
  escalatedAt: string | null;
  itDirectorEscalatedAt: string | null;
  createdAt: string;
  history?: HistoryEntry[];
  attachments?: FileAttachmentData[];
}

interface HistoryEntry {
  id: number;
  action: string;
  performedById: number;
  fromStatus: string | null;
  toStatus: string;
  notes: string | null;
  createdAt: string;
}

interface ReferralStats {
  total: number;
  pending: number;
  accepted: number;
  inProgress: number;
  completed: number;
  rejected: number;
  overdue: number;
  pendingAcknowledgment: number;
  escalated: number;
}

interface DepartmentReferralsProps {
  departmentId: number;
  departmentName: string;
  navGroups: NavGroup[];
}

// ─── SLA Countdown Hook ───────────────────────────────────────────────────────
function useSLATimer(referral: Referral) {
  const [left, setLeft] = useState<{ h: number; m: number; s: number; breached: boolean; pct: number } | null>(null);
  useEffect(() => {
    const calc = () => {
      if (!referral.createdAt) return;
      const slaMs = (referral.slaHours || 48) * 3600000;
      const created = new Date(referral.createdAt).getTime();
      const deadline = referral.dueDate ? new Date(referral.dueDate).getTime() : created + slaMs;
      const now = Date.now();
      const diff = deadline - now;
      const breached = diff < 0;
      const absMs = Math.abs(diff);
      const h = Math.floor(absMs / 3600000);
      const m = Math.floor((absMs % 3600000) / 60000);
      const s = Math.floor((absMs % 60000) / 1000);
      const total = deadline - created;
      const pct = Math.min(100, Math.max(0, ((now - created) / total) * 100));
      setLeft({ h, m, s, breached, pct });
    };
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, [referral]);
  return left;
}

// ─── SLA Badge ────────────────────────────────────────────────────────────────
function SLABadge({ referral }: { referral: Referral }) {
  const t = useSLATimer(referral);
  if (!t || referral.status === 'completed' || referral.status === 'rejected') return null;
  const color = t.breached ? "text-red-400 bg-red-500/10 border-red-500/30" : t.pct > 75 ? "text-orange-400 bg-orange-500/10 border-orange-500/30" : "text-green-400 bg-green-500/10 border-green-500/30";
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-mono ${color}`}>
      <Timer className="w-2.5 h-2.5" />
      {t.breached ? `+${t.h}h ${t.m}m` : `${t.h}h ${t.m}m`}
    </span>
  );
}

// ─── Action Buttons Per Status ─────────────────────────────────────────────────
function ReferralActions({ referral, deptId, onAction }: { referral: Referral; deptId: number; onAction: (action: string, ref: Referral) => void }) {
  const isIncoming = referral.toDepartmentId === deptId;
  const isOutgoing = referral.fromDepartmentId === deptId;

  if (!isIncoming) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {/* Acknowledge button for any pending without ack */}
      {referral.status === 'pending' && !referral.acknowledgedAt && (
        <button onClick={() => onAction('acknowledge', referral)} className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 hover:bg-blue-500/20 transition-all cursor-pointer" data-testid={`button-acknowledge-${referral.id}`}>
          <Check className="w-3 h-3" /> تأكيد الاستلام
        </button>
      )}
      {referral.status === 'pending' && (
        <>
          <button onClick={() => onAction('accept', referral)} className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-green-500/10 border border-green-500/30 text-green-300 hover:bg-green-500/20 transition-all cursor-pointer" data-testid={`button-accept-${referral.id}`}>
            <CheckCircle className="w-3 h-3" /> قبول
          </button>
          <button onClick={() => onAction('reject', referral)} className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 hover:bg-red-500/20 transition-all cursor-pointer" data-testid={`button-reject-${referral.id}`}>
            <XCircle className="w-3 h-3" /> رفض
          </button>
          <button onClick={() => onAction('delegate', referral)} className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-300 hover:bg-purple-500/20 transition-all cursor-pointer" data-testid={`button-delegate-${referral.id}`}>
            <Forward className="w-3 h-3" /> تفويض
          </button>
        </>
      )}
      {referral.status === 'accepted' && (
        <button onClick={() => onAction('complete', referral)} className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-green-500/10 border border-green-500/30 text-green-300 hover:bg-green-500/20 transition-all cursor-pointer" data-testid={`button-complete-${referral.id}`}>
          <Star className="w-3 h-3" /> إنجاز
        </button>
      )}
      {/* Escalate button for overdue */}
      {(referral.escalationLevel || 0) < 2 && referral.status === 'pending' && (() => {
        const created = new Date(referral.createdAt).getTime();
        const slaMs = (referral.slaHours || 48) * 3600000;
        return Date.now() > created + slaMs;
      })() && (
        <button onClick={() => onAction('escalate', referral)} className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-red-500/15 border border-red-500/40 text-red-300 hover:bg-red-500/25 transition-all cursor-pointer" data-testid={`button-escalate-${referral.id}`}>
          <ChevronUp className="w-3 h-3" /> تصعيد
        </button>
      )}
    </div>
  );
}

// ─── Referral Card ────────────────────────────────────────────────────────────
function ReferralCard({ referral, deptId, onView, onAction, index = 0 }: {
  referral: Referral;
  deptId: number;
  onView: (r: Referral) => void;
  onAction: (action: string, r: Referral) => void;
  index?: number;
}) {
  const isIncoming = referral.toDepartmentId === deptId;
  const fromDept = getDept(referral.fromDepartmentId);
  const toDept = getDept(referral.toDepartmentId);
  const status = STATUS_MAP[referral.status] || { label: referral.status, color: "text-white/60 bg-white/5 border-white/10", icon: null };
  const priority = PRIORITY_MAP[referral.priority] || PRIORITY_MAP.medium;
  const escalated = (referral.escalationLevel || 0) > 0;
  const unacknowledged = isIncoming && referral.status === 'pending' && !referral.acknowledgedAt;

  const refPriorityStripe =
    referral.priority === 'urgent' ? 'bg-red-500' :
    referral.priority === 'high' ? 'bg-orange-400' :
    referral.priority === 'medium' ? 'bg-yellow-400' :
    'bg-blue-400/50';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.04, 0.3) }}
      className={`relative rounded-xl border overflow-hidden hover:bg-white/5 transition-all duration-200 group hover:shadow-lg hover:shadow-black/20 hover:-translate-y-px ${
        escalated ? 'border-red-500/40 bg-red-500/5' :
        unacknowledged ? 'border-yellow-500/40 bg-yellow-500/5' :
        'border-white/10 bg-white/[0.02]'
      }`}
    >
      <div className={`absolute inset-y-0 right-0 w-[3px] ${refPriorityStripe}`} />
      <div className="p-4">
        {/* Top row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-mono text-white/35 bg-white/5 px-1.5 py-0.5 rounded">{referral.referralNumber}</span>
            <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${status.color}`}>
              {status.icon}{status.label}
            </span>
            <span className={`inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full border ${priority.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${priority.dot}`} />
              {priority.label}
            </span>
            {escalated && (
              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border bg-red-500/15 border-red-500/40 text-red-300 font-medium">
                <ChevronUp className="w-2.5 h-2.5" />مُصعَّدة L{referral.escalationLevel}
              </span>
            )}
            {referral.acknowledgedAt && !escalated && (
              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border bg-blue-500/10 border-blue-500/30 text-blue-300">
                <Check className="w-2.5 h-2.5" /> مُستلَمة
              </span>
            )}
            {unacknowledged && (
              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border bg-yellow-500/10 border-yellow-500/30 text-yellow-300 animate-pulse">
                <BellRing className="w-2.5 h-2.5" /> بانتظار التأكيد
              </span>
            )}
          </div>
          <button onClick={() => onView(referral)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white cursor-pointer shrink-0" data-testid={`button-view-referral-${referral.id}`}>
            <Eye className="w-4 h-4" />
          </button>
        </div>

        {/* Title */}
        <h4 className="mt-2 text-sm font-semibold text-white leading-snug">{referral.title}</h4>
        {referral.description && (
          <p className="mt-1 text-[11px] text-white/45 line-clamp-2 leading-relaxed">{referral.description}</p>
        )}

        {/* Flow — visual direction indicator */}
        <div className="flex items-center gap-2 mt-3">
          <div className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg ${fromDept.bg} ${fromDept.color}`}>
            {!isIncoming && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />}
            {fromDept.name}
          </div>
          <div className="flex items-center gap-0.5 text-white/25">
            <div className="h-px w-3 bg-white/20" />
            <ArrowLeft className="w-3 h-3" />
          </div>
          <div className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg font-semibold ${toDept.bg} ${toDept.color}`}>
            {toDept.name}
            {isIncoming && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />}
          </div>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${isIncoming ? 'text-green-400 bg-green-500/10' : 'text-blue-400 bg-blue-500/10'}`}>
            {isIncoming ? '← وارد' : 'صادر →'}
          </span>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-3 mt-2 text-[10px] text-white/35">
          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(referral.createdAt).toLocaleDateString('ar-SA')}</span>
          {referral.reason && <span className="flex items-center gap-1 truncate max-w-[120px]"><MessageSquare className="w-3 h-3" />{referral.reason}</span>}
          <SLABadge referral={referral} />
        </div>

        {/* Actions */}
        <ReferralActions referral={referral} deptId={deptId} onAction={onAction} />
      </div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DepartmentReferrals({ departmentId, departmentName, navGroups }: DepartmentReferralsProps) {
  const { toast } = useToast();
  const dept = getDept(departmentId);
  const otherDepts = DEPARTMENTS.filter(d => d.id !== departmentId);

  // ── State ──────────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("incoming");
  const [viewingRef, setViewingRef] = useState<Referral | null>(null);
  const [actionDialog, setActionDialog] = useState<{ type: string; referral: Referral } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createdReferralNum, setCreatedReferralNum] = useState<string | null>(null);
  const [actionNote, setActionNote] = useState("");
  const [delegateToDept, setDelegateToDept] = useState("");
  const [assignedToId, setAssignedToId] = useState("");

  // Create form state
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [newToDept, setNewToDept] = useState("");
  const [newReason, setNewReason] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newSlaHours, setNewSlaHours] = useState("48");
  const [newAttachments, setNewAttachments] = useState<FileAttachmentData[]>([]);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: allReferrals = [], isLoading, refetch } = useQuery<Referral[]>({
    queryKey: ['/api/it-referrals/department', departmentId],
    queryFn: () => apiRequest('GET', `/api/it-referrals/department/${departmentId}`).then(r => r.json()),
    refetchInterval: 60000,
  });

  const { data: stats } = useQuery<ReferralStats>({
    queryKey: ['/api/it-referrals/stats', departmentId],
    queryFn: () => apiRequest('GET', `/api/it-referrals/stats?deptId=${departmentId}`).then(r => r.json()),
    refetchInterval: 60000,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/it-referrals'] });
    queryClient.invalidateQueries({ queryKey: ['/api/it-referrals/department', departmentId] });
    queryClient.invalidateQueries({ queryKey: ['/api/it-referrals/stats', departmentId] });
  };

  const acknowledgeMutation = useMutation({
    mutationFn: (id: number) => apiRequest('POST', `/api/it-referrals/${id}/acknowledge`, { note: actionNote }).then(r => r.json()),
    onSuccess: () => { toast({ title: "✅ تم تأكيد الاستلام", description: "أُبلغت الإدارة المُرسِلة بتأكيد استلام الإحالة" }); setActionDialog(null); setActionNote(""); invalidateAll(); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message || "حدث خطأ", variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status, note, assignedToId: aId, rejectionReason }: any) =>
      apiRequest('PUT', `/api/it-referrals/${id}/status`, { status, responseNote: note, assignedToId: aId ? parseInt(aId) : undefined, rejectionReason }).then(r => r.json()),
    onSuccess: (_, vars) => {
      const labels: Record<string, string> = { accepted: "تم قبول الإحالة وإنشاء مهمة", rejected: "تم رفض الإحالة", completed: "تم إكمال الإحالة", in_progress: "تم تحديث الحالة", returned: "تم إعادة الإحالة" };
      toast({ title: `✅ ${labels[vars.status] || "تم التحديث"}` });
      setActionDialog(null); setActionNote(""); setAssignedToId(""); invalidateAll();
    },
    onError: () => toast({ title: "خطأ في التحديث", variant: "destructive" }),
  });

  const escalateMutation = useMutation({
    mutationFn: (id: number) => apiRequest('POST', `/api/it-referrals/${id}/escalate`, { reason: actionNote || "لا استجابة خلال مهلة SLA" }).then(r => r.json()),
    onSuccess: () => { toast({ title: "🔴 تم التصعيد", description: "أُبلغ مدير تقنية المعلومات بهذه الإحالة" }); setActionDialog(null); setActionNote(""); invalidateAll(); },
    onError: () => toast({ title: "خطأ في التصعيد", variant: "destructive" }),
  });

  const delegateMutation = useMutation({
    mutationFn: ({ id, toDeptId, reason }: any) => apiRequest('POST', `/api/it-referrals/${id}/delegate`, { toDepartmentId: parseInt(toDeptId), reason }).then(r => r.json()),
    onSuccess: () => { toast({ title: "✅ تم التفويض", description: "تم إحالة المهمة للإدارة المختارة" }); setActionDialog(null); setActionNote(""); setDelegateToDept(""); invalidateAll(); },
    onError: () => toast({ title: "خطأ في التفويض", variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: (body: any) => apiRequest('POST', '/api/it-referrals', body).then(r => r.json()),
    onSuccess: (data) => {
      if (newAttachments.length > 0) {
        apiRequest('POST', `/api/it-referrals/${data.id}/attachments`, { attachments: newAttachments });
      }
      setCreatedReferralNum(data.referralNumber || `REF-${data.id}`);
      setNewTitle(""); setNewDesc(""); setNewReason(""); setNewToDept(""); setNewDueDate(""); setNewSlaHours("48"); setNewPriority("medium"); setNewAttachments([]);
      invalidateAll();
    },
    onError: (e: any) => toast({ title: "خطأ في الإنشاء", description: e.message || "", variant: "destructive" }),
  });

  const addAttachmentsMutation = useMutation({
    mutationFn: ({ id, attachments }: { id: number; attachments: FileAttachmentData[] }) =>
      apiRequest('POST', `/api/it-referrals/${id}/attachments`, { attachments }),
    onSuccess: () => {
      invalidateAll();
      if (viewingRef?.id) viewReferral({ ...viewingRef });
      toast({ title: "✅ تم حفظ المرفقات" });
    },
    onError: () => toast({ title: "خطأ في حفظ المرفقات", variant: "destructive" }),
  });

  // ── Action handler ─────────────────────────────────────────────────────────
  const handleAction = (action: string, referral: Referral) => {
    setActionNote("");
    setAssignedToId("");
    setDelegateToDept("");
    if (action === 'acknowledge') {
      acknowledgeMutation.mutate(referral.id);
    } else {
      setActionDialog({ type: action, referral });
    }
  };

  const confirmAction = () => {
    if (!actionDialog) return;
    const { type, referral } = actionDialog;
    if (type === 'accept') statusMutation.mutate({ id: referral.id, status: 'accepted', note: actionNote, assignedToId });
    else if (type === 'reject') statusMutation.mutate({ id: referral.id, status: 'rejected', note: actionNote, rejectionReason: actionNote });
    else if (type === 'complete') statusMutation.mutate({ id: referral.id, status: 'completed', note: actionNote });
    else if (type === 'return') statusMutation.mutate({ id: referral.id, status: 'returned', note: actionNote });
    else if (type === 'start') statusMutation.mutate({ id: referral.id, status: 'in_progress', note: actionNote });
    else if (type === 'escalate') escalateMutation.mutate(referral.id);
    else if (type === 'delegate') delegateMutation.mutate({ id: referral.id, toDeptId: delegateToDept, reason: actionNote });
  };

  // ── Fetch full referral on view ────────────────────────────────────────────
  const viewReferral = async (ref: Referral) => {
    try {
      const res = await apiRequest('GET', `/api/it-referrals/${ref.id}`);
      const full = await res.json();
      setViewingRef(full);
    } catch { setViewingRef(ref); }
  };

  // ── Filter referrals ───────────────────────────────────────────────────────
  const filtered = allReferrals.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q || r.title.toLowerCase().includes(q) || r.referralNumber.toLowerCase().includes(q) || (r.reason || '').toLowerCase().includes(q);
    if (!matchSearch) return false;
    const isMyDept = r.toDepartmentId === departmentId || r.fromDepartmentId === departmentId;
    if (activeTab === 'incoming') return r.toDepartmentId === departmentId && ['pending', 'acknowledged', 'accepted', 'in_progress'].includes(r.status);
    if (activeTab === 'outgoing') return r.fromDepartmentId === departmentId && ['pending', 'acknowledged', 'accepted', 'in_progress', 'delegated'].includes(r.status);
    if (activeTab === 'active') return ['accepted', 'in_progress'].includes(r.status) && isMyDept;
    if (activeTab === 'escalated') return (r.escalationLevel || 0) > 0 && isMyDept && !['completed','rejected','returned'].includes(r.status);
    if (activeTab === 'completed') return ['completed', 'rejected', 'returned', 'delegated'].includes(r.status) && isMyDept;
    return isMyDept;
  }).sort((a, b) => {
    const escA = (a.escalationLevel || 0), escB = (b.escalationLevel || 0);
    if (escA !== escB) return escB - escA;
    const prio: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
    const prioA = prio[a.priority] ?? 2;
    const prioB = prio[b.priority] ?? 2;
    if (prioA !== prioB) return prioA - prioB;
    const ackA = !a.acknowledgedAt && a.toDepartmentId === departmentId && a.status === 'pending' ? 1 : 0;
    const ackB = !b.acknowledgedAt && b.toDepartmentId === departmentId && b.status === 'pending' ? 1 : 0;
    if (ackA !== ackB) return ackB - ackA;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const incomingPending = allReferrals.filter(r => r.toDepartmentId === departmentId && r.status === 'pending');
  const unackCount = incomingPending.filter(r => !r.acknowledgedAt).length;
  const activeCount = allReferrals.filter(r => ['accepted', 'in_progress'].includes(r.status) && (r.toDepartmentId === departmentId || r.fromDepartmentId === departmentId)).length;
  const escalatedCount = allReferrals.filter(r => (r.escalationLevel || 0) > 0 && (r.toDepartmentId === departmentId || r.fromDepartmentId === departmentId) && !['completed','rejected','returned'].includes(r.status)).length;

  // ── Action dialog config ───────────────────────────────────────────────────
  const actionConfig: Record<string, { title: string; desc: string; btnLabel: string; btnColor: string }> = {
    accept: { title: 'قبول الإحالة', desc: 'بالقبول ستُنشأ مهمة في قسمك للمعالجة. يمكنك تعيين موظف مباشرة.', btnLabel: 'قبول وإنشاء مهمة', btnColor: 'bg-green-600 hover:bg-green-700' },
    reject: { title: 'رفض الإحالة', desc: 'حدد سبب الرفض بوضوح حتى تتمكن الإدارة المُرسِلة من التعديل وإعادة الإرسال.', btnLabel: 'رفض الإحالة', btnColor: 'bg-red-600 hover:bg-red-700' },
    complete: { title: 'إنجاز الإحالة', desc: 'تأكيد إتمام المهمة المطلوبة في الإحالة.', btnLabel: 'تأكيد الإنجاز', btnColor: 'bg-green-600 hover:bg-green-700' },
    return: { title: 'إعادة الإحالة', desc: 'إعادة الإحالة للإدارة المُرسِلة مع توضيح سبب الإعادة.', btnLabel: 'إعادة الإحالة', btnColor: 'bg-orange-600 hover:bg-orange-700' },
    escalate: { title: 'تصعيد للمدير التنفيذي', desc: 'ستُبلَّغ إدارة تقنية المعلومات بهذه الإحالة المتجاوزة للـ SLA وتُطلب تدخلها.', btnLabel: 'تصعيد الآن', btnColor: 'bg-red-700 hover:bg-red-800' },
    delegate: { title: 'تفويض لإدارة أخرى', desc: 'تحويل الإحالة لإدارة أخرى مع الاحتفاظ بسجل التحويل.', btnLabel: 'تفويض', btnColor: 'bg-purple-600 hover:bg-purple-700' },
  };

  const aConf = actionDialog ? actionConfig[actionDialog.type] : null;
  const isPending = acknowledgeMutation.isPending || statusMutation.isPending || escalateMutation.isPending || delegateMutation.isPending;

  return (
    <DashboardLayout navGroups={navGroups} title={`إحالات — ${departmentName}`} portalName={departmentName}>
      <div className="space-y-6" dir="rtl">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${dept.bg}`}>
                <ArrowLeftRight className={`w-5 h-5 ${dept.color}`} />
              </div>
              الإحالات التقنية
              {unackCount > 0 && (
                <span className="text-sm px-2.5 py-1 rounded-full bg-yellow-500/15 border border-yellow-500/30 text-yellow-300 animate-pulse flex items-center gap-1">
                  <BellRing className="w-3.5 h-3.5" />{unackCount} تنتظر التأكيد
                </span>
              )}
            </h1>
            <p className="text-white/50 text-sm mt-1">إدارة الإحالات الواردة والصادرة — {departmentName}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} className="border-white/20 text-white/70 hover:text-white gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> تحديث
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)} className="bg-[#c9a84c] hover:bg-[#b8973b] text-[#0a1628] font-semibold gap-1.5">
              <Plus className="w-4 h-4" /> إحالة جديدة
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "واردة معلقة", value: stats?.pending || 0, icon: <Inbox className="w-4 h-4" />, color: "text-yellow-400", border: "border-yellow-500/20", bg: "bg-yellow-500/5" },
            { label: "بانتظار التأكيد", value: unackCount, icon: <BellRing className="w-4 h-4" />, color: "text-blue-400", border: "border-blue-500/20", bg: "bg-blue-500/5" },
            { label: "مُصعَّدة", value: escalatedCount, icon: <ChevronUp className="w-4 h-4" />, color: "text-red-400", border: "border-red-500/20", bg: "bg-red-500/5" },
            { label: "مكتملة", value: stats?.completed || 0, icon: <CheckCircle className="w-4 h-4" />, color: "text-green-400", border: "border-green-500/20", bg: "bg-green-500/5" },
          ].map((s, i) => (
            <div key={i} className={`rounded-xl border ${s.border} ${s.bg} p-4`}>
              <div className={`${s.color} mb-2`}>{s.icon}</div>
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-white/50 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* SLA Info Banner */}
        {unackCount > 0 && (
          <div className="flex items-start gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4">
            <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-yellow-300">إحالات تنتظر تأكيد الاستلام</p>
              <p className="text-xs text-yellow-300/70 mt-0.5">
                لديك <strong>{unackCount}</strong> إحالة وارده لم يتم تأكيد استلامها. التصعيد التلقائي يبدأ بعد {4} ساعات من الإرسال.
                اضغط "تأكيد الاستلام" لإيقاف عداد التصعيد.
              </p>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute right-3 top-2.5 w-4 h-4 text-white/30" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث في الإحالات..." className="pr-9 bg-white/5 border-white/15 text-white placeholder-white/30" />
        </div>

        {/* Tabs + Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white/5 border border-white/10 p-1 h-auto flex-wrap gap-1">
            {[
              { key: 'incoming', label: 'واردة', count: allReferrals.filter(r => r.toDepartmentId === departmentId && ['pending','acknowledged','accepted','in_progress'].includes(r.status)).length, icon: <Inbox className="w-3.5 h-3.5" />, urgent: unackCount > 0 },
              { key: 'outgoing', label: 'صادرة', count: allReferrals.filter(r => r.fromDepartmentId === departmentId && ['pending','acknowledged','accepted','in_progress'].includes(r.status)).length, icon: <Send className="w-3.5 h-3.5" />, urgent: false },
              { key: 'active', label: 'نشطة', count: activeCount, icon: <Play className="w-3.5 h-3.5" />, urgent: false },
              { key: 'escalated', label: 'مُصعَّدة', count: escalatedCount, icon: <ChevronUp className="w-3.5 h-3.5" />, urgent: escalatedCount > 0 },
              { key: 'completed', label: 'المنجزة', count: allReferrals.filter(r => ['completed','rejected','returned'].includes(r.status) && (r.toDepartmentId === departmentId || r.fromDepartmentId === departmentId)).length, icon: <CheckCircle className="w-3.5 h-3.5" />, urgent: false },
            ].map(tab => (
              <TabsTrigger key={tab.key} value={tab.key} className={`gap-1.5 text-xs data-[state=active]:bg-[#c9a84c]/20 data-[state=active]:text-[#c9a84c] relative`}>
                {tab.icon}{tab.label}
                {tab.count > 0 && (
                  <span className={`text-[10px] px-1.5 rounded-full ${tab.urgent ? 'bg-red-500/20 text-red-300 animate-pulse' : 'bg-white/10 text-white/60'}`}>
                    {tab.count}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {['incoming', 'outgoing', 'active', 'escalated', 'completed'].map(tab => (
            <TabsContent key={tab} value={tab} className="mt-4">
              {isLoading ? (
                <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-16 text-white/30">
                  <ArrowLeftRight className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">لا توجد إحالات {tab === 'incoming' ? 'واردة' : tab === 'outgoing' ? 'صادرة' : tab === 'active' ? 'نشطة' : tab === 'escalated' ? 'مُصعَّدة' : 'مُنجزة'}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filtered.map((ref, idx) => (
                    <ReferralCard key={ref.id} referral={ref} deptId={departmentId} onView={viewReferral} onAction={handleAction} index={idx} />
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* ── Detail Sheet ─────────────────────────────────────────────────────── */}
      <Sheet open={!!viewingRef} onOpenChange={() => setViewingRef(null)}>
        <SheetContent side="left" className="w-full sm:max-w-xl bg-[#0d1e3d] border-white/10 text-white overflow-y-auto" dir="rtl">
          {viewingRef && (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle className="text-white text-lg">{viewingRef.title}</SheetTitle>
                <p className="text-white/50 text-xs font-mono">{viewingRef.referralNumber}</p>
              </SheetHeader>

              <div className="space-y-4">
                {/* Status badges */}
                <div className="flex flex-wrap gap-2">
                  <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border ${(STATUS_MAP[viewingRef.status] || STATUS_MAP.pending).color}`}>
                    {(STATUS_MAP[viewingRef.status] || STATUS_MAP.pending).icon}
                    {(STATUS_MAP[viewingRef.status] || STATUS_MAP.pending).label}
                  </span>
                  <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border ${(PRIORITY_MAP[viewingRef.priority] || PRIORITY_MAP.medium).color}`}>
                    {(PRIORITY_MAP[viewingRef.priority] || PRIORITY_MAP.medium).label}
                  </span>
                  {(viewingRef.escalationLevel || 0) > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border bg-red-500/15 border-red-500/40 text-red-300">
                      <ChevronUp className="w-3 h-3" />مُصعَّدة المستوى {viewingRef.escalationLevel}
                    </span>
                  )}
                </div>

                {/* Flow */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-center flex-1">
                    <p className="text-[10px] text-white/40 mb-1">من</p>
                    <span className={`text-xs font-semibold ${getDept(viewingRef.fromDepartmentId).color}`}>{getDept(viewingRef.fromDepartmentId).name}</span>
                  </div>
                  <ArrowLeft className="w-5 h-5 text-white/20 shrink-0" />
                  <div className="text-center flex-1">
                    <p className="text-[10px] text-white/40 mb-1">إلى</p>
                    <span className={`text-xs font-semibold ${getDept(viewingRef.toDepartmentId).color}`}>{getDept(viewingRef.toDepartmentId).name}</span>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-2 text-sm">
                  {viewingRef.description && (
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <p className="text-[10px] text-white/40 mb-1">الوصف</p>
                      <p className="text-white/80 text-xs leading-relaxed">{viewingRef.description}</p>
                    </div>
                  )}
                  {viewingRef.reason && (
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <p className="text-[10px] text-white/40 mb-1">سبب الإحالة</p>
                      <p className="text-white/80 text-xs">{viewingRef.reason}</p>
                    </div>
                  )}
                  {viewingRef.responseNote && (
                    <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                      <p className="text-[10px] text-green-400 mb-1">ملاحظة الاستجابة</p>
                      <p className="text-white/80 text-xs">{viewingRef.responseNote}</p>
                    </div>
                  )}
                </div>

                {/* Timeline */}
                {/* SLA info */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-white/40 text-[10px]">SLA استلام</p>
                    <p className="text-white font-semibold mt-0.5">{viewingRef.slaAcknowledgeHours || 4} ساعات</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-white/40 text-[10px]">SLA معالجة</p>
                    <p className="text-white font-semibold mt-0.5">{viewingRef.slaHours || 48} ساعة</p>
                  </div>
                  {viewingRef.acknowledgedAt && (
                    <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <p className="text-blue-400 text-[10px]">تأكيد الاستلام</p>
                      <p className="text-white font-semibold mt-0.5">{new Date(viewingRef.acknowledgedAt).toLocaleString('ar-SA')}</p>
                    </div>
                  )}
                  {viewingRef.acceptedAt && (
                    <div className="p-2.5 rounded-lg bg-green-500/10 border border-green-500/20">
                      <p className="text-green-400 text-[10px]">تاريخ القبول</p>
                      <p className="text-white font-semibold mt-0.5">{new Date(viewingRef.acceptedAt).toLocaleString('ar-SA')}</p>
                    </div>
                  )}
                </div>

                {/* History */}
                {viewingRef.history && viewingRef.history.length > 0 && (
                  <div>
                    <p className="text-xs text-white/40 flex items-center gap-1.5 mb-3"><History className="w-3.5 h-3.5" />سجل الإجراءات</p>
                    <div className="space-y-2">
                      {viewingRef.history.map((h, i) => {
                        const actionLabels: Record<string, string> = {
                          created: 'إنشاء الإحالة', acknowledged: 'تأكيد الاستلام', accepted: 'قبول الإحالة',
                          rejected: 'رفض الإحالة', completed: 'إنجاز الإحالة', in_progress: 'بدء التنفيذ',
                          returned: 'إعادة الإحالة', escalated: 'تصعيد يدوي',
                          auto_escalated_L1: 'تصعيد تلقائي (M1)', auto_escalated_L2: 'تصعيد تلقائي (M2 — مدير TI)',
                          delegated: 'تفويض لإدارة أخرى',
                        };
                        const actionColors: Record<string, string> = {
                          created: 'bg-blue-500', acknowledged: 'bg-cyan-500', accepted: 'bg-green-500',
                          rejected: 'bg-red-500', completed: 'bg-emerald-500', escalated: 'bg-orange-500',
                          auto_escalated_L1: 'bg-orange-600', auto_escalated_L2: 'bg-red-600', delegated: 'bg-purple-500',
                        };
                        return (
                          <div key={i} className="flex gap-3 text-xs">
                            <div className="flex flex-col items-center">
                              <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${actionColors[h.action] || 'bg-white/30'}`} />
                              {i < viewingRef.history!.length - 1 && <div className="w-px flex-1 bg-white/10 mt-1" />}
                            </div>
                            <div className="pb-3">
                              <p className="text-white/80 font-medium">{actionLabels[h.action] || h.action}</p>
                              {h.notes && <p className="text-white/50 mt-0.5">{h.notes}</p>}
                              <p className="text-white/30 mt-0.5">{new Date(h.createdAt).toLocaleString('ar-SA')}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── Attachments ─────────────────────────────────────── */}
                <div className="pt-2">
                  <Separator className="bg-white/10 mb-4" />
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <FileAttachment
                      label="مرفقات الإحالة"
                      attachments={viewingRef.attachments || []}
                      onAttachmentsChange={(newFiles) => {
                        const existing = viewingRef.attachments || [];
                        const added = newFiles.filter(f => !existing.includes(f));
                        if (added.length > 0) {
                          addAttachmentsMutation.mutate({ id: viewingRef.id, attachments: added });
                        }
                      }}
                      readonly={false}
                      maxFiles={10}
                      maxFileSize={20 * 1024 * 1024}
                      dark
                    />
                  </div>
                </div>

                {/* Actions in sheet */}
                <ReferralActions referral={viewingRef} deptId={departmentId} onAction={handleAction} />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Action Dialog ─────────────────────────────────────────────────────── */}
      <Dialog open={!!actionDialog} onOpenChange={() => setActionDialog(null)}>
        <DialogContent className="bg-[#0d1e3d] border-white/15 text-white" dir="rtl">
          <DialogHeader>
            <DialogTitle>{aConf?.title}</DialogTitle>
            <DialogDescription className="text-white/50">{aConf?.desc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {actionDialog?.type === 'accept' && (
              <div>
                <Label className="text-white/70 text-xs">تعيين موظف (اختياري — رقم المعرّف)</Label>
                <Input value={assignedToId} onChange={e => setAssignedToId(e.target.value)} placeholder="رقم الموظف..." className="mt-1 bg-white/5 border-white/20 text-white" type="number" data-testid="input-assignee-id" />
              </div>
            )}
            {actionDialog?.type === 'delegate' && (
              <div>
                <Label className="text-white/70 text-xs">الإدارة المفوَّضة *</Label>
                <Select value={delegateToDept} onValueChange={setDelegateToDept}>
                  <SelectTrigger className="mt-1 bg-white/5 border-white/20 text-white" data-testid="select-delegate-dept">
                    <SelectValue placeholder="اختر الإدارة..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0d1e3d] border-white/15 text-white">
                    {otherDepts.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-white/70 text-xs">
                {actionDialog?.type === 'reject' ? 'سبب الرفض *' :
                 actionDialog?.type === 'return' ? 'سبب الإعادة *' :
                 actionDialog?.type === 'escalate' ? 'ملاحظة التصعيد (اختياري)' :
                 'ملاحظة (اختياري)'}
              </Label>
              <Textarea value={actionNote} onChange={e => setActionNote(e.target.value)} placeholder="اكتب هنا..." rows={3} className="mt-1 bg-white/5 border-white/20 text-white resize-none" data-testid="input-action-note" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setActionDialog(null)} className="border-white/20 text-white/60" data-testid="button-cancel-action">إلغاء</Button>
            <Button
              onClick={confirmAction}
              disabled={isPending || (actionDialog?.type === 'delegate' && !delegateToDept) || (['reject','return'].includes(actionDialog?.type || '') && !actionNote)}
              className={`${aConf?.btnColor || 'bg-[#c9a84c] hover:bg-[#b8973b]'} text-white`}
              data-testid="button-confirm-action"
            >
              {isPending ? <><RefreshCw className="w-3.5 h-3.5 animate-spin ml-1" />جاري...</> : aConf?.btnLabel || 'تأكيد'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create Referral Dialog ────────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={(open) => {
        setCreateOpen(open);
        if (!open) { setNewTitle(""); setNewDesc(""); setNewReason(""); setNewToDept(""); setNewDueDate(""); setNewSlaHours("48"); setNewPriority("medium"); setNewAttachments([]); setCreatedReferralNum(null); }
      }}>
        <DialogContent className="bg-[#0d1e3d] border-white/15 text-white max-w-lg" dir="rtl">
          {createdReferralNum ? (
            <div className="py-2">
              <FormSuccessPanel
                title="تم إنشاء الإحالة بنجاح"
                subtitle={`تم إرسال الإحالة من ${dept.name} للإدارة المستقبِلة`}
                referenceNumber={createdReferralNum}
                referenceLabel="رقم الإحالة"
                nextSteps={[
                  { title: "الإحالة أُرسلت للإدارة المستقبِلة", description: "لديهم 4 ساعات لتأكيد الاستلام قبل التصعيد التلقائي" },
                  { title: "تابع حالة الإحالة من تبويب 'الصادرة'", description: "ستظهر التحديثات فور ورود رد من الإدارة المستقبِلة" },
                ]}
                actions={[
                  { label: "إنشاء إحالة أخرى", icon: <Plus className="w-4 h-4" />, onClick: () => setCreatedReferralNum(null), testId: "button-create-another-referral" },
                  { label: "إغلاق", variant: "outline", onClick: () => { setCreateOpen(false); setCreatedReferralNum(null); }, testId: "button-close-referral-success" },
                ]}
              />
            </div>
          ) : (
          <>
          <DialogHeader>
            <DialogTitle>إنشاء إحالة جديدة</DialogTitle>
            <DialogDescription className="text-white/50">
              إحالة من <strong className={dept.color}>{dept.name}</strong> إلى إدارة أخرى
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh]">
            <div className="space-y-3 pr-1">
              <div>
                <Label className="text-white/70 text-xs">الإدارة المستقبِلة *</Label>
                <Select value={newToDept} onValueChange={setNewToDept}>
                  <SelectTrigger className="mt-1 bg-white/5 border-white/20 text-white" data-testid="select-target-dept">
                    <SelectValue placeholder="اختر الإدارة..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0d1e3d] border-white/15 text-white">
                    {otherDepts.map(d => <SelectItem key={d.id} value={String(d.id)} className={d.color}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-white/70 text-xs">عنوان الإحالة *</Label>
                <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="اكتب عنواناً وصفياً..." className="mt-1 bg-white/5 border-white/20 text-white" data-testid="input-referral-title" />
              </div>
              <div>
                <Label className="text-white/70 text-xs">الوصف التفصيلي</Label>
                <Textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="اشرح المشكلة أو المهمة بالتفصيل..." rows={3} className="mt-1 bg-white/5 border-white/20 text-white resize-none" data-testid="input-referral-description" />
              </div>
              <div>
                <Label className="text-white/70 text-xs">سبب الإحالة *</Label>
                <Textarea value={newReason} onChange={e => setNewReason(e.target.value)} placeholder="لماذا تُحال هذه المهمة لهذه الإدارة؟" rows={2} className="mt-1 bg-white/5 border-white/20 text-white resize-none" data-testid="input-referral-reason" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-white/70 text-xs">الأولوية</Label>
                  <Select value={newPriority} onValueChange={setNewPriority}>
                    <SelectTrigger className="mt-1 bg-white/5 border-white/20 text-white" data-testid="select-referral-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0d1e3d] border-white/15 text-white">
                      <SelectItem value="low">منخفضة</SelectItem>
                      <SelectItem value="medium">متوسطة</SelectItem>
                      <SelectItem value="high">عالية</SelectItem>
                      <SelectItem value="urgent">عاجلة</SelectItem>
                      <SelectItem value="critical">حرجة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-white/70 text-xs">SLA المعالجة (ساعة)</Label>
                  <Select value={newSlaHours} onValueChange={setNewSlaHours}>
                    <SelectTrigger className="mt-1 bg-white/5 border-white/20 text-white" data-testid="select-referral-sla">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0d1e3d] border-white/15 text-white">
                      <SelectItem value="4">4 ساعات (عاجل)</SelectItem>
                      <SelectItem value="8">8 ساعات</SelectItem>
                      <SelectItem value="24">24 ساعة</SelectItem>
                      <SelectItem value="48">48 ساعة</SelectItem>
                      <SelectItem value="72">72 ساعة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-white/70 text-xs">الموعد النهائي (اختياري)</Label>
                <Input value={newDueDate} onChange={e => setNewDueDate(e.target.value)} type="datetime-local" className="mt-1 bg-white/5 border-white/20 text-white" data-testid="input-referral-due-date" />
              </div>

              {/* File Attachments */}
              <FileAttachment
                attachments={newAttachments}
                onAttachmentsChange={setNewAttachments}
                label="المرفقات (اختياري)"
                dark
                maxFiles={5}
              />

              {/* SLA info banner */}
              <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">
                <Shield className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  الإدارة المستقبِلة لديها <strong>4 ساعات</strong> لتأكيد الاستلام قبل التصعيد التلقائي.
                  SLA المعالجة المختار هو <strong>{newSlaHours} ساعة</strong> — بعدها يتصعّد تلقائياً لمدير تقنية المعلومات.
                </span>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="border-white/20 text-white/60" data-testid="button-cancel-referral">إلغاء</Button>
            <Button
              data-testid="button-submit-referral"
              onClick={() => createMutation.mutate({
                type: 'general', entityId: 0,
                title: newTitle, description: newDesc,
                priority: newPriority, fromDepartmentId: departmentId,
                toDepartmentId: parseInt(newToDept), reason: newReason,
                dueDate: newDueDate || null, slaHours: parseInt(newSlaHours),
              })}
              disabled={!newTitle || !newToDept || !newReason || createMutation.isPending}
              className="bg-[#c9a84c] hover:bg-[#b8973b] text-[#0a1628] font-semibold"
            >
              {createMutation.isPending ? <><RefreshCw className="w-3.5 h-3.5 animate-spin ml-1" />إرسال...</> : <><Send className="w-3.5 h-3.5 ml-1" />إرسال الإحالة</>}
            </Button>
          </DialogFooter>
          </>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
