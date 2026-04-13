import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, invalidateRelatedQueries } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/DashboardLayout";
import { dmoNavGroups } from "@/lib/navigation";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Shield, CheckCircle2, XCircle, Clock, Plus, MoreVertical,
  FileText, Download, Search, Filter, AlertTriangle, Eye,
  ShieldCheck, ShieldX, CalendarClock, Users, Pencil,
} from "lucide-react";

const DMO_DEPARTMENT_ID = 5;

const LEGAL_BASES = [
  { value: "consent", label: "الموافقة الصريحة", labelEn: "Explicit Consent" },
  { value: "contract", label: "تنفيذ عقد", labelEn: "Contractual Necessity" },
  { value: "legal_obligation", label: "التزام قانوني", labelEn: "Legal Obligation" },
  { value: "vital_interest", label: "مصلحة حيوية", labelEn: "Vital Interest" },
  { value: "public_interest", label: "مصلحة عامة", labelEn: "Public Interest" },
  { value: "legitimate_interest", label: "مصلحة مشروعة", labelEn: "Legitimate Interest" },
];

const DATA_TYPE_OPTIONS = [
  "بيانات شخصية أساسية",
  "بيانات الاتصال",
  "بيانات مالية",
  "بيانات صحية",
  "بيانات وظيفية",
  "بيانات الموقع",
  "بيانات سلوكية",
  "بيانات بيومترية",
  "بيانات تعليمية",
  "بيانات الهوية الوطنية",
];

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  withdrawn: "bg-red-500/20 text-red-400 border-red-500/30",
  expired: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

function getConsentStatus(record: any): string {
  if (record.withdrawnAt) return "withdrawn";
  if (record.expiresAt && new Date(record.expiresAt) <= new Date()) return "expired";
  if (record.isActive) return "active";
  return "withdrawn";
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: "سارية",
    withdrawn: "مسحوبة",
    expired: "منتهية",
  };
  return labels[status] || status;
}

function getLegalBasisLabel(basis: string): string {
  const found = LEGAL_BASES.find(b => b.value === basis);
  return found ? found.label : basis;
}

export default function ConsentManagement() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [legalBasisFilter, setLegalBasisFilter] = useState("all");
  const [form, setForm] = useState({
    dataSubjectId: "",
    purpose: "",
    purposeAr: "",
    legalBasis: "consent",
    dataTypes: [] as string[],
    expiresAt: "",
    ipAddress: "",
    metadata: "",
  });

  const { data: records = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/consent-records"],
    staleTime: 2 * 60 * 1000,
  });

  const { data: stats } = useQuery<any>({
    queryKey: ["/api/consent-records/stats"],
    staleTime: 2 * 60 * 1000,
  });

  const { data: usersList = [] } = useQuery<any[]>({
    queryKey: ["/api/users-list"],
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/consent-records", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم إنشاء سجل الموافقة بنجاح" });
      queryClient.invalidateQueries({ queryKey: ["/api/consent-records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/consent-records/stats"] });
      invalidateRelatedQueries('/api/consent-records');
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (error: Error) => toast({ title: "خطأ", description: error.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PUT", `/api/consent-records/${editingItem?.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم تحديث سجل الموافقة بنجاح" });
      queryClient.invalidateQueries({ queryKey: ["/api/consent-records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/consent-records/stats"] });
      invalidateRelatedQueries('/api/consent-records');
      setIsCreateOpen(false);
      setEditingItem(null);
      resetForm();
    },
    onError: (error: Error) => toast({ title: "خطأ", description: error.message, variant: "destructive" }),
  });

  const withdrawMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PUT", `/api/consent-records/${id}/withdraw`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم سحب الموافقة بنجاح" });
      queryClient.invalidateQueries({ queryKey: ["/api/consent-records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/consent-records/stats"] });
      invalidateRelatedQueries('/api/consent-records');
      setIsDetailOpen(false);
    },
    onError: (error: Error) => toast({ title: "خطأ", description: error.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/consent-records/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم حذف السجل" });
      queryClient.invalidateQueries({ queryKey: ["/api/consent-records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/consent-records/stats"] });
      invalidateRelatedQueries('/api/consent-records');
    },
    onError: (error: Error) => toast({ title: "خطأ", description: error.message, variant: "destructive" }),
  });

  const resetForm = () => {
    setForm({
      dataSubjectId: "", purpose: "", purposeAr: "", legalBasis: "consent",
      dataTypes: [], expiresAt: "", ipAddress: "", metadata: "",
    });
  };

  const handleCreate = () => {
    if (!form.dataSubjectId || !form.purposeAr) {
      toast({ title: "تنبيه", description: "يرجى تعبئة الحقول المطلوبة (صاحب البيانات والغرض)", variant: "destructive" });
      return;
    }
    if (form.dataTypes.length === 0) {
      toast({ title: "تنبيه", description: "يرجى تحديد نوع واحد على الأقل من أنواع البيانات", variant: "destructive" });
      return;
    }
    const payload = {
      dataSubjectId: Number(form.dataSubjectId),
      purpose: form.purpose || form.purposeAr,
      purposeAr: form.purposeAr,
      legalBasis: form.legalBasis,
      dataTypes: form.dataTypes,
      givenAt: new Date().toISOString(),
      expiresAt: form.expiresAt || null,
      ipAddress: form.ipAddress || null,
      metadata: form.metadata ? { notes: form.metadata } : null,
    };
    if (editingItem) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const toggleDataType = (type: string) => {
    setForm(prev => ({
      ...prev,
      dataTypes: prev.dataTypes.includes(type)
        ? prev.dataTypes.filter(t => t !== type)
        : [...prev.dataTypes, type],
    }));
  };

  const filteredRecords = records.filter((r: any) => {
    const status = getConsentStatus(r);
    if (statusFilter !== "all" && status !== statusFilter) return false;
    if (legalBasisFilter !== "all" && r.legalBasis !== legalBasisFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        (r.subjectName || "").toLowerCase().includes(q) ||
        (r.subjectEmail || "").toLowerCase().includes(q) ||
        (r.purposeAr || "").toLowerCase().includes(q) ||
        (r.purpose || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleExport = () => {
    const rows = filteredRecords.map((r: any) => ({
      "صاحب البيانات": r.subjectName || `#${r.dataSubjectId}`,
      "البريد": r.subjectEmail || "-",
      "الغرض": r.purposeAr || r.purpose,
      "الأساس القانوني": getLegalBasisLabel(r.legalBasis),
      "أنواع البيانات": (r.dataTypes || []).join("، "),
      "الحالة": getStatusLabel(getConsentStatus(r)),
      "تاريخ المنح": r.givenAt ? new Date(r.givenAt).toLocaleDateString("ar-SA") : "-",
      "تاريخ الانتهاء": r.expiresAt ? new Date(r.expiresAt).toLocaleDateString("ar-SA") : "-",
      "تاريخ السحب": r.withdrawnAt ? new Date(r.withdrawnAt).toLocaleDateString("ar-SA") : "-",
    }));
    const headers = Object.keys(rows[0] || {});
    const csv = [headers.join(","), ...rows.map((r: any) => headers.map(h => `"${r[h]}"`).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `consent-records-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout
      navGroups={dmoNavGroups}
      basePath="/dmo"
      departmentId={DMO_DEPARTMENT_ID}
      departmentName="مكتب إدارة البيانات"
    >
      <div className="space-y-6 p-4 md:p-6" dir="rtl">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2" data-testid="text-page-title">
              <Shield className="w-7 h-7 text-amber-400" />
              نظام إدارة الموافقات
            </h1>
            <p className="text-white/60 mt-1">إدارة موافقات أصحاب البيانات الشخصية وفق نظام حماية البيانات الشخصية (PDPL)</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10"
              onClick={handleExport}
              disabled={filteredRecords.length === 0}
              data-testid="button-export-consents"
            >
              <Download className="w-4 h-4 ml-2" />
              تصدير CSV
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => { resetForm(); setEditingItem(null); setIsCreateOpen(true); }}
              data-testid="button-create-consent"
            >
              <Plus className="w-4 h-4 ml-2" />
              تسجيل موافقة جديدة
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-[#0a1929] border-white/10">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <FileText className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-white/50">إجمالي السجلات</p>
                <p className="text-2xl font-bold text-white" data-testid="text-total-consents">{stats?.total || 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-[#0a1929] border-white/10">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-white/50">موافقات سارية</p>
                <p className="text-2xl font-bold text-emerald-400" data-testid="text-active-consents">{stats?.active || 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-[#0a1929] border-white/10">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/20">
                <ShieldX className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-xs text-white/50">موافقات مسحوبة</p>
                <p className="text-2xl font-bold text-red-400" data-testid="text-withdrawn-consents">{stats?.withdrawn || 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-[#0a1929] border-white/10">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <CalendarClock className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-white/50">موافقات منتهية</p>
                <p className="text-2xl font-bold text-amber-400" data-testid="text-expired-consents">{stats?.expired || 0}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-[#0a1929] border-white/10">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <Input
                  placeholder="بحث بالاسم أو البريد أو الغرض..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pr-10 bg-white/5 border-white/10 text-white"
                  data-testid="input-search-consents"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px] bg-white/5 border-white/10 text-white" data-testid="select-status-filter">
                  <Filter className="w-4 h-4 ml-2 text-white/40" />
                  <SelectValue placeholder="الحالة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الحالات</SelectItem>
                  <SelectItem value="active">سارية</SelectItem>
                  <SelectItem value="withdrawn">مسحوبة</SelectItem>
                  <SelectItem value="expired">منتهية</SelectItem>
                </SelectContent>
              </Select>
              <Select value={legalBasisFilter} onValueChange={setLegalBasisFilter}>
                <SelectTrigger className="w-[200px] bg-white/5 border-white/10 text-white" data-testid="select-basis-filter">
                  <SelectValue placeholder="الأساس القانوني" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الأسس القانونية</SelectItem>
                  {LEGAL_BASES.map(b => (
                    <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Records Table */}
        <Card className="bg-[#0a1929] border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-400" />
              سجلات الموافقات ({filteredRecords.length})
            </CardTitle>
            <CardDescription className="text-white/50">جميع سجلات موافقات أصحاب البيانات الشخصية</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="text-center py-12 text-white/40">
                <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>لا توجد سجلات موافقات</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableHead className="text-white/60 text-right">#</TableHead>
                      <TableHead className="text-white/60 text-right">صاحب البيانات</TableHead>
                      <TableHead className="text-white/60 text-right">الغرض</TableHead>
                      <TableHead className="text-white/60 text-right">الأساس القانوني</TableHead>
                      <TableHead className="text-white/60 text-right">أنواع البيانات</TableHead>
                      <TableHead className="text-white/60 text-right">الحالة</TableHead>
                      <TableHead className="text-white/60 text-right">تاريخ المنح</TableHead>
                      <TableHead className="text-white/60 text-right">الانتهاء</TableHead>
                      <TableHead className="text-white/60 text-right">إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.map((record: any, idx: number) => {
                      const status = getConsentStatus(record);
                      return (
                        <TableRow
                          key={record.id}
                          className="border-white/5 hover:bg-white/5 cursor-pointer"
                          onClick={() => { setSelectedRecord(record); setIsDetailOpen(true); }}
                          data-testid={`row-consent-${record.id}`}
                        >
                          <TableCell className="text-white/60 font-mono text-sm">{idx + 1}</TableCell>
                          <TableCell>
                            <div>
                              <p className="text-white font-medium text-sm">{record.subjectName || `مستخدم #${record.dataSubjectId}`}</p>
                              {record.subjectEmail && <p className="text-white/40 text-xs">{record.subjectEmail}</p>}
                            </div>
                          </TableCell>
                          <TableCell className="text-white/80 text-sm max-w-[200px] truncate">{record.purposeAr || record.purpose}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-white/70 border-white/20 text-xs">
                              {getLegalBasisLabel(record.legalBasis)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {(record.dataTypes || []).slice(0, 2).map((t: string, i: number) => (
                                <Badge key={i} variant="outline" className="text-xs text-white/50 border-white/10">{t}</Badge>
                              ))}
                              {(record.dataTypes || []).length > 2 && (
                                <Badge variant="outline" className="text-xs text-white/50 border-white/10">
                                  +{(record.dataTypes || []).length - 2}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={`${STATUS_COLORS[status]} text-xs`} data-testid={`badge-status-${record.id}`}>
                              {status === "active" && <CheckCircle2 className="w-3 h-3 ml-1" />}
                              {status === "withdrawn" && <XCircle className="w-3 h-3 ml-1" />}
                              {status === "expired" && <Clock className="w-3 h-3 ml-1" />}
                              {getStatusLabel(status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-white/60 text-sm">
                            {record.givenAt ? new Date(record.givenAt).toLocaleDateString("ar-SA") : "-"}
                          </TableCell>
                          <TableCell className="text-white/60 text-sm">
                            {record.expiresAt ? new Date(record.expiresAt).toLocaleDateString("ar-SA") : "غير محدد"}
                          </TableCell>
                          <TableCell onClick={e => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-white/40" data-testid={`button-actions-${record.id}`}>
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => { setSelectedRecord(record); setIsDetailOpen(true); }}>
                                  <Eye className="w-4 h-4 ml-2" /> عرض التفاصيل
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                  setEditingItem(record);
                                  setForm({
                                    dataSubjectId: String(record.dataSubjectId),
                                    purpose: record.purpose || '',
                                    purposeAr: record.purposeAr || '',
                                    legalBasis: record.legalBasis || 'consent',
                                    dataTypes: record.dataTypes || [],
                                    expiresAt: record.expiresAt ? record.expiresAt.split('T')[0] : '',
                                    ipAddress: record.ipAddress || '',
                                    metadata: record.metadata?.notes || '',
                                  });
                                  setIsCreateOpen(true);
                                }} data-testid={`button-edit-consent-${record.id}`}>
                                  <Pencil className="w-4 h-4 ml-2" /> تعديل السجل
                                </DropdownMenuItem>
                                {status === "active" && (
                                  <DropdownMenuItem
                                    className="text-red-500"
                                    onClick={() => withdrawMutation.mutate(record.id)}
                                  >
                                    <ShieldX className="w-4 h-4 ml-2" /> سحب الموافقة
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  className="text-red-500"
                                  onClick={() => {
                                    if (confirm("هل أنت متأكد من حذف هذا السجل؟")) {
                                      deleteMutation.mutate(record.id);
                                    }
                                  }}
                                >
                                  <XCircle className="w-4 h-4 ml-2" /> حذف السجل
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* PDPL Reference */}
        <Card className="bg-[#0a1929] border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-amber-400 font-semibold text-sm">مرجع PDPL - المادة 6</p>
                <p className="text-white/60 text-xs mt-1">
                  لا يجوز جمع البيانات الشخصية أو معالجتها إلا بموافقة صاحب البيانات الشخصية.
                  يجب أن تكون الموافقة صريحة ومحددة وقابلة للسحب في أي وقت.
                  يحق لصاحب البيانات الاطلاع على بياناته وطلب تصحيحها أو حذفها.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Create Dialog */}
        <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) { resetForm(); setEditingItem(null); } }}>
          <DialogContent className="max-w-2xl bg-[#0d2137] border-white/10 text-white" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                {editingItem ? <><Pencil className="w-5 h-5 text-amber-400" />تعديل سجل الموافقة</> : <><ShieldCheck className="w-5 h-5 text-amber-400" />تسجيل موافقة جديدة</>}
              </DialogTitle>
              <DialogDescription className="text-white/50">
                {editingItem ? 'تعديل بيانات سجل الموافقة الحالي' : 'تسجيل موافقة صاحب بيانات شخصية وفق متطلبات PDPL'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              <div>
                <Label className="text-white/80">صاحب البيانات *</Label>
                <Select value={form.dataSubjectId} onValueChange={v => setForm({ ...form, dataSubjectId: v })}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1" data-testid="select-data-subject">
                    <SelectValue placeholder="اختر صاحب البيانات" />
                  </SelectTrigger>
                  <SelectContent>
                    {usersList.map((u: any) => (
                      <SelectItem key={u.id} value={String(u.id)}>{u.name} ({u.email})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-white/80">الغرض (عربي) *</Label>
                  <Input
                    value={form.purposeAr}
                    onChange={e => setForm({ ...form, purposeAr: e.target.value })}
                    className="bg-white/5 border-white/10 text-white mt-1"
                    placeholder="مثال: معالجة بيانات التوظيف"
                    data-testid="input-purpose-ar"
                  />
                </div>
                <div>
                  <Label className="text-white/80">الغرض (إنجليزي)</Label>
                  <Input
                    value={form.purpose}
                    onChange={e => setForm({ ...form, purpose: e.target.value })}
                    className="bg-white/5 border-white/10 text-white mt-1"
                    placeholder="e.g., Employment data processing"
                    dir="ltr"
                    data-testid="input-purpose-en"
                  />
                </div>
              </div>

              <div>
                <Label className="text-white/80">الأساس القانوني *</Label>
                <Select value={form.legalBasis} onValueChange={v => setForm({ ...form, legalBasis: v })}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1" data-testid="select-legal-basis">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEGAL_BASES.map(b => (
                      <SelectItem key={b.value} value={b.value}>{b.label} - {b.labelEn}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-white/80">أنواع البيانات المشمولة *</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {DATA_TYPE_OPTIONS.map(type => (
                    <Badge
                      key={type}
                      variant="outline"
                      className={`cursor-pointer transition-all text-xs ${
                        form.dataTypes.includes(type)
                          ? "bg-amber-500/30 text-amber-300 border-amber-500/50"
                          : "text-white/50 border-white/20 hover:border-white/40"
                      }`}
                      onClick={() => toggleDataType(type)}
                      data-testid={`badge-datatype-${type}`}
                    >
                      {form.dataTypes.includes(type) && <CheckCircle2 className="w-3 h-3 ml-1" />}
                      {type}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-white/80">تاريخ انتهاء الموافقة</Label>
                  <Input
                    type="date"
                    value={form.expiresAt}
                    onChange={e => setForm({ ...form, expiresAt: e.target.value })}
                    className="bg-white/5 border-white/10 text-white mt-1"
                    data-testid="input-expires-at"
                  />
                </div>
                <div>
                  <Label className="text-white/80">عنوان IP</Label>
                  <Input
                    value={form.ipAddress}
                    onChange={e => setForm({ ...form, ipAddress: e.target.value })}
                    className="bg-white/5 border-white/10 text-white mt-1"
                    placeholder="مثال: 192.168.1.1"
                    dir="ltr"
                    data-testid="input-ip-address"
                  />
                </div>
              </div>

              <div>
                <Label className="text-white/80">ملاحظات إضافية</Label>
                <Textarea
                  value={form.metadata}
                  onChange={e => setForm({ ...form, metadata: e.target.value })}
                  className="bg-white/5 border-white/10 text-white mt-1"
                  placeholder="أي ملاحظات أو سياق إضافي..."
                  rows={3}
                  data-testid="input-metadata"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 mt-4">
              <Button variant="outline" onClick={() => { setIsCreateOpen(false); setEditingItem(null); resetForm(); }} className="border-white/20 text-white" data-testid="button-cancel-create">
                إلغاء
              </Button>
              <Button
                onClick={handleCreate}
                disabled={editingItem ? updateMutation.isPending : createMutation.isPending}
                className="bg-amber-600 hover:bg-amber-700 text-white"
                data-testid="button-submit-consent"
              >
                {(editingItem ? updateMutation.isPending : createMutation.isPending) ? "جاري الحفظ..." : editingItem ? "تحديث السجل" : "تسجيل الموافقة"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Detail Dialog */}
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="max-w-lg bg-[#0d2137] border-white/10 text-white" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <Eye className="w-5 h-5 text-amber-400" />
                تفاصيل سجل الموافقة
              </DialogTitle>
            </DialogHeader>

            {selectedRecord && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-white/40 text-xs">صاحب البيانات</p>
                    <p className="text-white font-medium" data-testid="text-detail-subject">
                      {selectedRecord.subjectName || `مستخدم #${selectedRecord.dataSubjectId}`}
                    </p>
                    {selectedRecord.subjectEmail && (
                      <p className="text-white/50 text-xs">{selectedRecord.subjectEmail}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-white/40 text-xs">الحالة</p>
                    <Badge className={`${STATUS_COLORS[getConsentStatus(selectedRecord)]} mt-1`}>
                      {getStatusLabel(getConsentStatus(selectedRecord))}
                    </Badge>
                  </div>
                </div>

                <div>
                  <p className="text-white/40 text-xs">الغرض</p>
                  <p className="text-white">{selectedRecord.purposeAr || selectedRecord.purpose}</p>
                  {selectedRecord.purpose && selectedRecord.purposeAr && (
                    <p className="text-white/50 text-sm" dir="ltr">{selectedRecord.purpose}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-white/40 text-xs">الأساس القانوني</p>
                    <p className="text-white text-sm">{getLegalBasisLabel(selectedRecord.legalBasis)}</p>
                  </div>
                  <div>
                    <p className="text-white/40 text-xs">الإصدار</p>
                    <p className="text-white text-sm">v{selectedRecord.version}</p>
                  </div>
                </div>

                <div>
                  <p className="text-white/40 text-xs mb-2">أنواع البيانات المشمولة</p>
                  <div className="flex flex-wrap gap-1">
                    {(selectedRecord.dataTypes || []).map((t: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-xs text-white/60 border-white/20">{t}</Badge>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-white/40 text-xs">تاريخ المنح</p>
                    <p className="text-white text-sm">
                      {selectedRecord.givenAt ? new Date(selectedRecord.givenAt).toLocaleDateString("ar-SA") : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-white/40 text-xs">تاريخ الانتهاء</p>
                    <p className="text-white text-sm">
                      {selectedRecord.expiresAt ? new Date(selectedRecord.expiresAt).toLocaleDateString("ar-SA") : "غير محدد"}
                    </p>
                  </div>
                  <div>
                    <p className="text-white/40 text-xs">تاريخ السحب</p>
                    <p className="text-white text-sm">
                      {selectedRecord.withdrawnAt ? new Date(selectedRecord.withdrawnAt).toLocaleDateString("ar-SA") : "-"}
                    </p>
                  </div>
                </div>

                {selectedRecord.ipAddress && (
                  <div>
                    <p className="text-white/40 text-xs">عنوان IP</p>
                    <p className="text-white/70 text-sm font-mono" dir="ltr">{selectedRecord.ipAddress}</p>
                  </div>
                )}

                {selectedRecord.metadata?.notes && (
                  <div>
                    <p className="text-white/40 text-xs">ملاحظات</p>
                    <p className="text-white/70 text-sm">{selectedRecord.metadata.notes}</p>
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="gap-2 mt-4">
              <Button variant="outline" onClick={() => setIsDetailOpen(false)} className="border-white/20 text-white">
                إغلاق
              </Button>
              {selectedRecord && getConsentStatus(selectedRecord) === "active" && (
                <Button
                  variant="destructive"
                  onClick={() => withdrawMutation.mutate(selectedRecord.id)}
                  disabled={withdrawMutation.isPending}
                  data-testid="button-withdraw-consent"
                >
                  <ShieldX className="w-4 h-4 ml-2" />
                  {withdrawMutation.isPending ? "جاري السحب..." : "سحب الموافقة"}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
