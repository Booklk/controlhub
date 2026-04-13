import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileAttachment, FileAttachmentData } from "@/components/FileAttachment";
import {
  Share2, Plus, Search, Eye, Pencil, Trash2,
  ArrowLeftRight, ArrowUpRight, ArrowDownLeft,
  FileText, CheckCircle2, Clock,
  XCircle, AlertCircle, RefreshCw, Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useConfirmDialog, ConfirmDialog } from "@/components/ConfirmDialog";
import type { ExternalDataSharingRequest } from "@shared/schema";
import DashboardLayout from "@/components/DashboardLayout";
import { dmoNavGroups } from "@/lib/navigation";

// ─── Constants ───────────────────────────────────────────────────────────────

const PARTY_TYPES: Record<string, string> = {
  government: "جهة حكومية",
  private: "شركة خاصة",
  international: "جهة دولية",
  ngo: "منظمة غير ربحية",
  academic: "مؤسسة أكاديمية",
};

const SHARING_DIRECTIONS: Record<string, { label: string; icon: any; color: string }> = {
  outbound: { label: "نشارك بياناتنا", icon: ArrowUpRight, color: "text-blue-400" },
  inbound: { label: "نستقبل بيانات", icon: ArrowDownLeft, color: "text-purple-400" },
  bidirectional: { label: "تبادل ثنائي", icon: ArrowLeftRight, color: "text-amber-400" },
};

const LEGAL_BASES: Record<string, string> = {
  legal_obligation: "التزام قانوني",
  legitimate_interest: "مصلحة مشروعة",
  consent: "موافقة صريحة",
  vital_interest: "مصلحة حيوية",
  public_interest: "مصلحة عامة",
  contract: "تنفيذ عقد",
};

const STATUSES: Record<string, { label: string; color: string; icon: any }> = {
  pending:     { label: "قيد المراجعة",  color: "bg-amber-500/20 text-amber-400 border-amber-500/30",  icon: Clock },
  approved:    { label: "موافق عليه",    color: "bg-green-500/20 text-green-400 border-green-500/30",   icon: CheckCircle2 },
  active:      { label: "نشط",           color: "bg-blue-500/20 text-blue-400 border-blue-500/30",      icon: RefreshCw },
  rejected:    { label: "مرفوض",         color: "bg-red-500/20 text-red-400 border-red-500/30",         icon: XCircle },
  expired:     { label: "منتهي الصلاحية",color: "bg-slate-500/20 text-slate-400 border-slate-500/30",  icon: AlertCircle },
  terminated:  { label: "موقوف",         color: "bg-red-900/30 text-red-300 border-red-800/40",         icon: XCircle },
};

const EMPTY_FORM = {
  externalPartyName: "", externalPartyType: "government", externalPartyContact: "",
  sharingDirection: "outbound", dataAssets: "", purpose: "",
  legalBasis: "legal_obligation", securityMeasures: "", conditions: "",
  requestDate: new Date().toISOString().split("T")[0], approvalDate: "",
  startDate: "", endDate: "", status: "pending", referenceDoc: "", notes: "",
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const s = STATUSES[status] || { label: status, color: "bg-slate-500/20 text-slate-400 border-slate-500/30", icon: AlertCircle };
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${s.color}`}>
      <Icon className="w-3 h-3" />
      {s.label}
    </span>
  );
}

function StatCard({ label, value, color, icon: Icon }: { label: string; value: number; color: string; icon: any }) {
  return (
    <div className={`bg-[#0f1f3d] border border-[rgba(212,175,55,0.15)] rounded-xl p-4 flex items-center gap-3`}>
      <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center flex-shrink-0`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-slate-400 text-xs">{label}</p>
      </div>
    </div>
  );
}

// ─── Main Form Dialog ────────────────────────────────────────────────────────

function FormDialog({
  open, onClose, initial, onSave, isSaving,
}: {
  open: boolean; onClose: () => void;
  initial: typeof EMPTY_FORM | (ExternalDataSharingRequest & { requestDate?: any; approvalDate?: any; startDate?: any; endDate?: any });
  onSave: (data: any) => void; isSaving: boolean;
}) {
  const [form, setForm] = useState<any>(initial);
  const [attachments, setAttachments] = useState<FileAttachmentData[]>(
    Array.isArray((initial as any).attachments) ? (initial as any).attachments : []
  );
  const set = (k: string, v: string) => setForm((p: any) => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#0f1f3d] border-[rgba(212,175,55,0.3)] text-white max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-[#d4af37] flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            {(initial as any).id ? "تعديل سجل مشاركة البيانات" : "تسجيل طلب مشاركة بيانات جديد"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          {/* الجهة الخارجية */}
          <div className="md:col-span-2">
            <p className="text-[#d4af37] text-xs font-semibold uppercase tracking-wider mb-3 border-b border-[rgba(212,175,55,0.2)] pb-1">
              معلومات الجهة الخارجية
            </p>
          </div>

          <div>
            <Label className="text-slate-300 text-sm mb-1.5 block">اسم الجهة الخارجية *</Label>
            <Input value={form.externalPartyName} onChange={e => set("externalPartyName", e.target.value)}
              placeholder="مثال: وزارة الاتصالات" className="bg-[#1a3a6b]/40 border-slate-600 text-white"
              data-testid="input-party-name" />
          </div>

          <div>
            <Label className="text-slate-300 text-sm mb-1.5 block">نوع الجهة</Label>
            <Select value={form.externalPartyType} onValueChange={v => set("externalPartyType", v)}>
              <SelectTrigger className="bg-[#1a3a6b]/40 border-slate-600 text-white" data-testid="select-party-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0f1f3d] border-slate-700 text-white">
                {Object.entries(PARTY_TYPES).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2">
            <Label className="text-slate-300 text-sm mb-1.5 block">جهة التواصل في الجهة الخارجية</Label>
            <Input value={form.externalPartyContact} onChange={e => set("externalPartyContact", e.target.value)}
              placeholder="الاسم والمنصب والبريد الإلكتروني" className="bg-[#1a3a6b]/40 border-slate-600 text-white"
              data-testid="input-party-contact" />
          </div>

          {/* تفاصيل المشاركة */}
          <div className="md:col-span-2">
            <p className="text-[#d4af37] text-xs font-semibold uppercase tracking-wider mb-3 border-b border-[rgba(212,175,55,0.2)] pb-1 mt-2">
              تفاصيل مشاركة البيانات
            </p>
          </div>

          <div>
            <Label className="text-slate-300 text-sm mb-1.5 block">اتجاه المشاركة</Label>
            <Select value={form.sharingDirection} onValueChange={v => set("sharingDirection", v)}>
              <SelectTrigger className="bg-[#1a3a6b]/40 border-slate-600 text-white" data-testid="select-direction">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0f1f3d] border-slate-700 text-white">
                {Object.entries(SHARING_DIRECTIONS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-slate-300 text-sm mb-1.5 block">الأساس القانوني (PDPL)</Label>
            <Select value={form.legalBasis} onValueChange={v => set("legalBasis", v)}>
              <SelectTrigger className="bg-[#1a3a6b]/40 border-slate-600 text-white" data-testid="select-legal-basis">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0f1f3d] border-slate-700 text-white">
                {Object.entries(LEGAL_BASES).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2">
            <Label className="text-slate-300 text-sm mb-1.5 block">البيانات / الأصول المشاركة *</Label>
            <Textarea value={form.dataAssets} onChange={e => set("dataAssets", e.target.value)}
              placeholder="صف البيانات أو الأصول التي ستُشارك بالتفصيل..."
              className="bg-[#1a3a6b]/40 border-slate-600 text-white min-h-[80px] resize-none"
              data-testid="textarea-data-assets" />
          </div>

          <div className="md:col-span-2">
            <Label className="text-slate-300 text-sm mb-1.5 block">الغرض من المشاركة *</Label>
            <Textarea value={form.purpose} onChange={e => set("purpose", e.target.value)}
              placeholder="اشرح الغرض والمبرر من مشاركة هذه البيانات..."
              className="bg-[#1a3a6b]/40 border-slate-600 text-white min-h-[70px] resize-none"
              data-testid="textarea-purpose" />
          </div>

          <div className="md:col-span-2">
            <Label className="text-slate-300 text-sm mb-1.5 block">الإجراءات الأمنية والضمانات</Label>
            <Textarea value={form.securityMeasures} onChange={e => set("securityMeasures", e.target.value)}
              placeholder="التشفير، قيود الوصول، اتفاقية السرية، بروتوكولات الحماية..."
              className="bg-[#1a3a6b]/40 border-slate-600 text-white min-h-[60px] resize-none"
              data-testid="textarea-security" />
          </div>

          <div className="md:col-span-2">
            <Label className="text-slate-300 text-sm mb-1.5 block">الشروط والقيود</Label>
            <Textarea value={form.conditions} onChange={e => set("conditions", e.target.value)}
              placeholder="أي شروط أو قيود على استخدام البيانات..."
              className="bg-[#1a3a6b]/40 border-slate-600 text-white min-h-[60px] resize-none"
              data-testid="textarea-conditions" />
          </div>

          {/* التواريخ والحالة */}
          <div className="md:col-span-2">
            <p className="text-[#d4af37] text-xs font-semibold uppercase tracking-wider mb-3 border-b border-[rgba(212,175,55,0.2)] pb-1 mt-2">
              التواريخ والحالة
            </p>
          </div>

          <div>
            <Label className="text-slate-300 text-sm mb-1.5 block">تاريخ الطلب *</Label>
            <Input type="date" value={form.requestDate?.toString().split("T")[0] || ""}
              onChange={e => set("requestDate", e.target.value)}
              className="bg-[#1a3a6b]/40 border-slate-600 text-white"
              data-testid="input-request-date" />
          </div>

          <div>
            <Label className="text-slate-300 text-sm mb-1.5 block">تاريخ الموافقة</Label>
            <Input type="date" value={form.approvalDate?.toString().split("T")[0] || ""}
              onChange={e => set("approvalDate", e.target.value)}
              className="bg-[#1a3a6b]/40 border-slate-600 text-white"
              data-testid="input-approval-date" />
          </div>

          <div>
            <Label className="text-slate-300 text-sm mb-1.5 block">تاريخ البدء</Label>
            <Input type="date" value={form.startDate?.toString().split("T")[0] || ""}
              onChange={e => set("startDate", e.target.value)}
              className="bg-[#1a3a6b]/40 border-slate-600 text-white"
              data-testid="input-start-date" />
          </div>

          <div>
            <Label className="text-slate-300 text-sm mb-1.5 block">تاريخ الانتهاء</Label>
            <Input type="date" value={form.endDate?.toString().split("T")[0] || ""}
              onChange={e => set("endDate", e.target.value)}
              className="bg-[#1a3a6b]/40 border-slate-600 text-white"
              data-testid="input-end-date" />
          </div>

          <div>
            <Label className="text-slate-300 text-sm mb-1.5 block">حالة السجل</Label>
            <Select value={form.status} onValueChange={v => set("status", v)}>
              <SelectTrigger className="bg-[#1a3a6b]/40 border-slate-600 text-white" data-testid="select-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0f1f3d] border-slate-700 text-white">
                {Object.entries(STATUSES).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-slate-300 text-sm mb-1.5 block">رقم المرجع / الوثيقة</Label>
            <Input value={form.referenceDoc} onChange={e => set("referenceDoc", e.target.value)}
              placeholder="رقم الخطاب أو المرجع الرسمي"
              className="bg-[#1a3a6b]/40 border-slate-600 text-white"
              data-testid="input-ref-doc" />
          </div>

          <div className="md:col-span-2">
            <Label className="text-slate-300 text-sm mb-1.5 block">ملاحظات إضافية</Label>
            <Textarea value={form.notes} onChange={e => set("notes", e.target.value)}
              placeholder="أي معلومات إضافية..."
              className="bg-[#1a3a6b]/40 border-slate-600 text-white min-h-[60px] resize-none"
              data-testid="textarea-notes" />
          </div>

          <div className="md:col-span-2">
            <FileAttachment
              attachments={attachments}
              onAttachmentsChange={setAttachments}
              label="المرفقات"
              maxFiles={5}
              dark
            />
          </div>
        </div>

        <DialogFooter className="mt-4 gap-2 flex-row-reverse">
          <Button onClick={() => onSave({ ...form, attachments })} disabled={isSaving || !form.externalPartyName || !form.dataAssets || !form.purpose}
            className="bg-[#d4af37] hover:bg-[#b8963e] text-[#0a1628] font-bold"
            data-testid="button-save-form">
            {isSaving ? "جاري الحفظ..." : (initial as any).id ? "حفظ التعديلات" : "تسجيل الطلب"}
          </Button>
          <Button variant="ghost" onClick={onClose} className="text-slate-400 hover:text-white" data-testid="button-cancel-form">
            إلغاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Detail Dialog ───────────────────────────────────────────────────────────

function DetailDialog({ record, onClose }: { record: ExternalDataSharingRequest; onClose: () => void }) {
  const Row = ({ label, value }: { label: string; value?: string | null }) =>
    value ? (
      <div className="py-2 border-b border-slate-700/50 last:border-0">
        <p className="text-slate-400 text-xs mb-0.5">{label}</p>
        <p className="text-white text-sm">{value}</p>
      </div>
    ) : null;

  const formatDate = (d: any) => d ? new Date(d).toLocaleDateString("ar-SA") : null;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#0f1f3d] border-[rgba(212,175,55,0.3)] text-white max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-[#d4af37] flex items-center gap-2">
            <FileText className="w-5 h-5" />
            {record.requestNumber}
          </DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2 flex-wrap mt-1">
          <StatusBadge status={record.status} />
          <Badge variant="outline" className="text-slate-300 border-slate-600">
            {PARTY_TYPES[record.externalPartyType] || record.externalPartyType}
          </Badge>
          <span className={`flex items-center gap-1 text-xs font-medium ${SHARING_DIRECTIONS[record.sharingDirection]?.color}`}>
            {SHARING_DIRECTIONS[record.sharingDirection]?.label}
          </span>
        </div>
        <div className="mt-4 space-y-0">
          <Row label="الجهة الخارجية" value={record.externalPartyName} />
          <Row label="جهة التواصل" value={record.externalPartyContact} />
          <Row label="البيانات / الأصول المشاركة" value={record.dataAssets} />
          <Row label="الغرض من المشاركة" value={record.purpose} />
          <Row label="الأساس القانوني" value={LEGAL_BASES[record.legalBasis] || record.legalBasis} />
          <Row label="الإجراءات الأمنية" value={record.securityMeasures} />
          <Row label="الشروط والقيود" value={record.conditions} />
          <Row label="تاريخ الطلب" value={formatDate(record.requestDate)} />
          <Row label="تاريخ الموافقة" value={formatDate(record.approvalDate)} />
          <Row label="تاريخ البدء" value={formatDate(record.startDate)} />
          <Row label="تاريخ الانتهاء" value={formatDate(record.endDate)} />
          <Row label="رقم المرجع" value={record.referenceDoc} />
          <Row label="ملاحظات" value={record.notes} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-slate-400 hover:text-white">إغلاق</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ExternalDataSharingRequests() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { confirm, dialogProps } = useConfirmDialog();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDirection, setFilterDirection] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ExternalDataSharingRequest | null>(null);
  const [viewing, setViewing] = useState<ExternalDataSharingRequest | null>(null);

  const { data: records = [], isLoading, refetch } = useQuery<ExternalDataSharingRequest[]>({
    queryKey: ["/api/external-sharing-requests"],
    staleTime: 60 * 1000,
  });

  const filtered = records.filter(r => {
    const matchSearch = !search ||
      r.externalPartyName?.toLowerCase().includes(search.toLowerCase()) ||
      r.requestNumber?.toLowerCase().includes(search.toLowerCase()) ||
      r.dataAssets?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || r.status === filterStatus;
    const matchDir = filterDirection === "all" || r.sharingDirection === filterDirection;
    return matchSearch && matchStatus && matchDir;
  });

  // Stats
  const stats = {
    total: records.length,
    pending: records.filter(r => r.status === "pending").length,
    active: records.filter(r => r.status === "active").length,
    expiringSoon: records.filter(r => {
      if (!r.endDate) return false;
      const diff = new Date(r.endDate).getTime() - Date.now();
      return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
    }).length,
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/external-sharing-requests", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/external-sharing-requests"] });
      toast({ title: "تم التسجيل", description: "تم تسجيل طلب مشاركة البيانات بنجاح" });
      setShowForm(false);
    },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PUT", `/api/external-sharing-requests/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/external-sharing-requests"] });
      toast({ title: "تم التحديث", description: "تم تحديث السجل بنجاح" });
      setEditing(null);
    },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/external-sharing-requests/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/external-sharing-requests"] });
      toast({ title: "تم الحذف", description: "تم حذف السجل" });
    },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const handleSave = (data: any) => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (r: ExternalDataSharingRequest) => {
    confirm(
      () => deleteMutation.mutate(r.id),
      {
        title: "حذف السجل",
        description: `هل أنت متأكد من حذف سجل مشاركة البيانات مع "${r.externalPartyName}"؟ لا يمكن التراجع.`,
        confirmText: "حذف",
        variant: "destructive",
      }
    );
  };

  const exportCSV = () => {
    const headers = ["رقم السجل", "الجهة الخارجية", "نوع الجهة", "الاتجاه", "البيانات", "الغرض", "الأساس القانوني", "الحالة", "تاريخ الطلب", "تاريخ الموافقة", "رقم المرجع"];
    const rows = filtered.map(r => [
      r.requestNumber, r.externalPartyName, PARTY_TYPES[r.externalPartyType] || r.externalPartyType,
      SHARING_DIRECTIONS[r.sharingDirection]?.label || r.sharingDirection,
      `"${r.dataAssets?.replace(/"/g, '""')}"`, `"${r.purpose?.replace(/"/g, '""')}"`,
      LEGAL_BASES[r.legalBasis] || r.legalBasis, STATUSES[r.status]?.label || r.status,
      r.requestDate ? new Date(r.requestDate).toLocaleDateString("ar-SA") : "",
      r.approvalDate ? new Date(r.approvalDate).toLocaleDateString("ar-SA") : "",
      r.referenceDoc || "",
    ]);
    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `external-sharing-${new Date().toISOString().split("T")[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout navGroups={dmoNavGroups} title="سجل مشاركة البيانات الخارجية" portalName="مكتب إدارة البيانات">
    <div className="min-h-screen text-white" dir="rtl">
      <ConfirmDialog {...dialogProps} isPending={deleteMutation.isPending} />

      {/* Form Dialog */}
      {(showForm || editing) && (
        <FormDialog
          open={showForm || !!editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          initial={editing ? {
            ...editing,
            requestDate: editing.requestDate ? new Date(editing.requestDate).toISOString().split("T")[0] : "",
            approvalDate: editing.approvalDate ? new Date(editing.approvalDate).toISOString().split("T")[0] : "",
            startDate: editing.startDate ? new Date(editing.startDate).toISOString().split("T")[0] : "",
            endDate: editing.endDate ? new Date(editing.endDate).toISOString().split("T")[0] : "",
          } as any : EMPTY_FORM}
          onSave={handleSave}
          isSaving={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {/* Detail Dialog */}
      {viewing && <DetailDialog record={viewing} onClose={() => setViewing(null)} />}

      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[rgba(212,175,55,0.15)] border border-[rgba(212,175,55,0.3)] flex items-center justify-center">
              <Share2 className="w-6 h-6 text-[#d4af37]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">سجل طلبات مشاركة البيانات الخارجية</h1>
              <p className="text-slate-400 text-sm">توثيق ومتابعة جميع طلبات مشاركة البيانات مع الجهات الخارجية</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={exportCSV}
              className="border-slate-600 text-slate-300 hover:text-white hover:border-slate-500 gap-2"
              data-testid="button-export-csv">
              <Download className="w-4 h-4" />
              تصدير CSV
            </Button>
            <Button onClick={() => setShowForm(true)}
              className="bg-[#d4af37] hover:bg-[#b8963e] text-[#0a1628] font-bold gap-2"
              data-testid="button-add-record">
              <Plus className="w-4 h-4" />
              تسجيل طلب جديد
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="إجمالي السجلات" value={stats.total} color="bg-[rgba(212,175,55,0.15)]" icon={FileText} />
          <StatCard label="قيد المراجعة" value={stats.pending} color="bg-amber-500/15" icon={Clock} />
          <StatCard label="نشطة حالياً" value={stats.active} color="bg-blue-500/15" icon={CheckCircle2} />
          <StatCard label="تنتهي خلال 30 يوم" value={stats.expiringSoon} color="bg-red-500/15" icon={AlertCircle} />
        </div>

        {/* Filters */}
        <div className="bg-[#0f1f3d] border border-[rgba(212,175,55,0.15)] rounded-xl p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="ابحث باسم الجهة، رقم السجل، أو البيانات..."
                className="bg-[#1a3a6b]/40 border-slate-600 text-white pr-10"
                data-testid="input-search" />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="bg-[#1a3a6b]/40 border-slate-600 text-white w-48" data-testid="select-filter-status">
                <SelectValue placeholder="الحالة" />
              </SelectTrigger>
              <SelectContent className="bg-[#0f1f3d] border-slate-700 text-white">
                <SelectItem value="all">جميع الحالات</SelectItem>
                {Object.entries(STATUSES).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterDirection} onValueChange={setFilterDirection}>
              <SelectTrigger className="bg-[#1a3a6b]/40 border-slate-600 text-white w-48" data-testid="select-filter-direction">
                <SelectValue placeholder="الاتجاه" />
              </SelectTrigger>
              <SelectContent className="bg-[#0f1f3d] border-slate-700 text-white">
                <SelectItem value="all">جميع الاتجاهات</SelectItem>
                {Object.entries(SHARING_DIRECTIONS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" onClick={() => refetch()}
              className="text-slate-400 hover:text-white" data-testid="button-refresh">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-[#0f1f3d] border border-[rgba(212,175,55,0.15)] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1a3a6b]/60 border-b border-[rgba(212,175,55,0.2)]">
                  <th className="text-right py-3 px-4 text-[#d4af37] font-semibold">رقم السجل</th>
                  <th className="text-right py-3 px-4 text-[#d4af37] font-semibold">الجهة الخارجية</th>
                  <th className="text-right py-3 px-4 text-[#d4af37] font-semibold">الاتجاه</th>
                  <th className="text-right py-3 px-4 text-[#d4af37] font-semibold">الأساس القانوني</th>
                  <th className="text-right py-3 px-4 text-[#d4af37] font-semibold">تاريخ الطلب</th>
                  <th className="text-right py-3 px-4 text-[#d4af37] font-semibold">الانتهاء</th>
                  <th className="text-right py-3 px-4 text-[#d4af37] font-semibold">الحالة</th>
                  <th className="text-right py-3 px-4 text-[#d4af37] font-semibold">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-700/50">
                      {Array.from({ length: 8 }).map((__, j) => (
                        <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-full bg-slate-700/50" /></td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center">
                      <Share2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                      <p className="text-slate-400 font-medium">لا توجد سجلات</p>
                      <p className="text-slate-500 text-xs mt-1">
                        {records.length === 0 ? "ابدأ بتسجيل أول طلب مشاركة بيانات" : "لا توجد نتائج تطابق البحث"}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((r, idx) => {
                    const DirIcon = SHARING_DIRECTIONS[r.sharingDirection]?.icon || ArrowLeftRight;
                    const isExpiring = r.endDate && (() => {
                      const diff = new Date(r.endDate!).getTime() - Date.now();
                      return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
                    })();
                    return (
                      <tr key={r.id}
                        className={`border-b border-slate-700/40 hover:bg-[#1a3a6b]/20 transition-colors ${idx % 2 === 0 ? "" : "bg-[#1a3a6b]/10"}`}
                        data-testid={`row-sharing-${r.id}`}>
                        <td className="py-3 px-4">
                          <span className="font-mono text-[#d4af37] text-xs font-semibold">{r.requestNumber}</span>
                        </td>
                        <td className="py-3 px-4">
                          <div>
                            <p className="text-white font-medium">{r.externalPartyName}</p>
                            <p className="text-slate-400 text-xs">{PARTY_TYPES[r.externalPartyType] || r.externalPartyType}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`flex items-center gap-1.5 text-xs font-medium ${SHARING_DIRECTIONS[r.sharingDirection]?.color}`}>
                            <DirIcon className="w-3.5 h-3.5" />
                            {SHARING_DIRECTIONS[r.sharingDirection]?.label}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-slate-300 text-xs">{LEGAL_BASES[r.legalBasis] || r.legalBasis}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-slate-300 text-xs">
                            {r.requestDate ? new Date(r.requestDate).toLocaleDateString("ar-SA") : "—"}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-xs ${isExpiring ? "text-amber-400 font-semibold" : "text-slate-300"}`}>
                            {r.endDate ? new Date(r.endDate).toLocaleDateString("ar-SA") : "—"}
                            {isExpiring && " ⚠️"}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="ghost"
                              className="w-7 h-7 text-slate-400 hover:text-blue-400"
                              onClick={() => setViewing(r)} data-testid={`button-view-${r.id}`}>
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost"
                              className="w-7 h-7 text-slate-400 hover:text-[#d4af37]"
                              onClick={() => setEditing(r)} data-testid={`button-edit-${r.id}`}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost"
                              className="w-7 h-7 text-slate-400 hover:text-red-400"
                              onClick={() => handleDelete(r)} data-testid={`button-delete-${r.id}`}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {filtered.length > 0 && (
            <div className="px-4 py-3 border-t border-slate-700/40 flex items-center justify-between">
              <p className="text-slate-400 text-xs">
                يُعرض <span className="text-white font-medium">{filtered.length}</span> من أصل <span className="text-white font-medium">{records.length}</span> سجل
              </p>
              <div className="flex items-center gap-1.5">
                {Object.entries(STATUSES).map(([k, v]) => {
                  const count = records.filter(r => r.status === k).length;
                  if (count === 0) return null;
                  return (
                    <span key={k} className={`text-xs px-2 py-0.5 rounded-full border ${v.color}`}>
                      {v.label}: {count}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </DashboardLayout>
  );
}
