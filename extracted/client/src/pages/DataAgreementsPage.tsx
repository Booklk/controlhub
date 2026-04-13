import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, invalidateRelatedQueries } from "@/lib/queryClient";
import DashboardLayout from "@/components/DashboardLayout";
import type { NavGroup } from "@/lib/navigation";
import { PageHeader, KpiCard } from "@/components/Quality";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingButton } from "@/components/LoadingButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Briefcase, FileText, Upload, FileDown, FileSpreadsheet, Calendar, Building2, Download, CheckCircle2, Clock } from "lucide-react";
import { exportToPDF, exportToExcel, formatStatus } from '@/lib/exports';
import { useConfirmDialog, ConfirmDialog } from '@/components/ConfirmDialog';
import { FormSuccessPanel, FieldHint } from "@/components/ui/form-guide";

interface DataAgreementsPageProps {
  navGroups: NavGroup[];
  portalName: string;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: "مسودة", color: "bg-gray-100 text-gray-800" },
  active: { label: "نشطة", color: "hub-badge-success" },
  pending: { label: "قيد المراجعة", color: "bg-yellow-100 text-yellow-800" },
  expired: { label: "منتهية", color: "bg-red-100 text-red-800" },
  cancelled: { label: "ملغاة", color: "hub-badge-neutral" },
};

const typeLabels: Record<string, string> = {
  nda: "اتفاقية عدم إفشاء (NDA)",
  sla: "اتفاقية مستوى خدمة (SLA)",
  dpa: "اتفاقية معالجة بيانات (DPA)",
  mou: "مذكرة تفاهم (MoU)",
  service: "عقد خدمة",
  license: "عقد ترخيص",
  maintenance: "عقد صيانة",
  consulting: "عقد استشارات",
  other: "أخرى",
};

export default function DataAgreementsPage({ navGroups, portalName }: DataAgreementsPageProps) {
  const { toast } = useToast();
  const { confirm: confirmAction, dialogProps } = useConfirmDialog();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [successAgreement, setSuccessAgreement] = useState<{ id: number; title: string } | null>(null);

  const [form, setForm] = useState({
    title: "", description: "", agreementType: "service",
    parties: "", status: "draft", startDate: "", endDate: "",
  });

  const { data: agreements = [] } = useQuery<any[]>({
    queryKey: ["/api/data-agreements"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await apiRequest("POST", "/api/data-agreements", data);
      return r.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/data-agreements"] });
      invalidateRelatedQueries('/api/data-agreements');
      setSuccessAgreement({ id: data.id, title: data.title });
      resetForm();
    },
    onError: () => {
      toast({ title: "خطأ في إنشاء العقد", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest("PUT", `/api/data-agreements/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/data-agreements"] });
      invalidateRelatedQueries('/api/data-agreements');
      setIsDialogOpen(false);
      setEditing(null);
      toast({ title: "تم تحديث العقد" });
    },
    onError: () => {
      toast({ title: "خطأ في تحديث العقد", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/data-agreements/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/data-agreements"] });
      invalidateRelatedQueries('/api/data-agreements');
      toast({ title: "تم حذف العقد" });
    },
    onError: () => {
      toast({ title: "خطأ في حذف العقد", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setForm({
      title: "", description: "", agreementType: "service",
      parties: "", status: "draft", startDate: "", endDate: "",
    });
  };

  const handleEdit = (item: any) => {
    setEditing(item);
    setForm({
      title: item.title || "",
      description: item.description || "",
      agreementType: item.agreementType || "service",
      parties: item.partyName || "",
      status: item.status || "draft",
      startDate: item.startDate ? new Date(item.startDate).toISOString().split("T")[0] : "",
      endDate: item.endDate ? new Date(item.endDate).toISOString().split("T")[0] : "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.title.trim()) {
      toast({ title: "تنبيه", description: "يرجى إدخال عنوان العقد", variant: "destructive" });
      return;
    }
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleFileUpload = async (agreementId: number, file: File) => {
    setUploadingId(agreementId);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/data-agreements/${agreementId}/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem("_cht")}`,
          "x-csrf-token": document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "",
        },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "خطأ في الرفع");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/data-agreements"] });
      toast({ title: "تم رفع المرفق بنجاح" });
    } catch (error: any) {
      toast({ title: error.message || "خطأ في رفع الملف", variant: "destructive" });
    }
    setUploadingId(null);
  };

  const stats = {
    total: agreements.length,
    active: agreements.filter((a: any) => a.status === "active").length,
    pending: agreements.filter((a: any) => a.status === "pending" || a.status === "draft").length,
    expired: agreements.filter((a: any) => a.status === "expired").length,
  };

  const handleExportPDF = () => {
    exportToPDF({
      title: "تقرير العقود والاتفاقيات",
      subtitle: `JCSA - ${portalName}`,
      columns: [
        { header: "العقد", key: "title", width: 40 },
        { header: "النوع", key: "type", width: 25 },
        { header: "الطرف الآخر", key: "party", width: 25 },
        { header: "الحالة", key: "status", width: 20 },
        { header: "تاريخ البداية", key: "start", width: 25 },
      ],
      data: agreements.map((a: any) => ({
        title: a.title || "",
        type: typeLabels[a.agreementType] || a.agreementType || "",
        party: a.partyName || "",
        status: formatStatus(a.status || ""),
        start: a.startDate ? new Date(a.startDate).toLocaleDateString("ar-SA") : "",
      })),
      filename: "agreements-report",
      orientation: "landscape",
    });
  };

  const handleExportExcel = () => {
    exportToExcel({
      title: "تقرير العقود والاتفاقيات",
      columns: [
        { header: "العقد", key: "title", width: 40 },
        { header: "النوع", key: "type", width: 25 },
        { header: "الطرف الآخر", key: "party", width: 25 },
        { header: "الحالة", key: "status", width: 20 },
        { header: "تاريخ البداية", key: "start", width: 25 },
      ],
      data: agreements.map((a: any) => ({
        title: a.title || "",
        type: typeLabels[a.agreementType] || a.agreementType || "",
        party: a.partyName || "",
        status: formatStatus(a.status || ""),
        start: a.startDate ? new Date(a.startDate).toLocaleDateString("ar-SA") : "",
      })),
      filename: "agreements-report",
    });
  };

  return (
    <DashboardLayout
      title="العقود والاتفاقيات"
      subtitle="إدارة العقود والاتفاقيات مع الجهات والموردين"
      navGroups={navGroups}
      portalName={portalName}
    >
      <div className="space-y-5" dir="rtl">
        <PageHeader
          icon={Briefcase}
          title="العقود والاتفاقيات"
          subtitle="إدارة العقود والاتفاقيات مع الجهات والموردين"
          actions={
            <>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportPDF} data-testid="button-export-pdf">
                <FileDown className="w-3.5 h-3.5" />PDF
              </Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportExcel} data-testid="button-export-excel">
                <FileSpreadsheet className="w-3.5 h-3.5" />Excel
              </Button>
              <Button className="btn-gold h-9 gap-1.5 text-xs" onClick={() => { resetForm(); setEditing(null); setSuccessAgreement(null); setIsDialogOpen(true); }} data-testid="button-add-agreement">
                <Plus className="w-3.5 h-3.5" />إضافة عقد
              </Button>
            </>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="إجمالي العقود" value={stats.total} icon={Briefcase} color="navy" />
          <KpiCard label="عقود نشطة" value={stats.active} icon={CheckCircle2} color="success" />
          <KpiCard label="قيد المراجعة" value={stats.pending} icon={Clock} color={stats.pending > 0 ? "warning" : "muted"} />
          <KpiCard label="منتهية" value={stats.expired} icon={Calendar} color={stats.expired > 0 ? "danger" : "muted"} />
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <CardTitle>سجل العقود والاتفاقيات</CardTitle>
          </CardHeader>
          <CardContent>
            {agreements.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Briefcase className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-lg">لا توجد عقود مسجلة</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>العقد</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>الطرف الآخر</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>الفترة</TableHead>
                    <TableHead>المرفق</TableHead>
                    <TableHead>الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agreements.map((agreement: any) => (
                    <TableRow key={agreement.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{agreement.title}</div>
                          {agreement.agreementNumber && (
                            <div className="text-xs text-muted-foreground">{agreement.agreementNumber}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{typeLabels[agreement.agreementType] || agreement.agreementType || "-"}</TableCell>
                      <TableCell>{agreement.partyName || "-"}</TableCell>
                      <TableCell>
                        <Badge className={statusLabels[agreement.status]?.color || "bg-gray-100"}>
                          {statusLabels[agreement.status]?.label || agreement.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {agreement.startDate ? (
                          <div>
                            <div>{new Date(agreement.startDate).toLocaleDateString("ar-SA")}</div>
                            {agreement.endDate && (
                              <div className="text-muted-foreground">إلى {new Date(agreement.endDate).toLocaleDateString("ar-SA")}</div>
                            )}
                          </div>
                        ) : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {agreement.fileUrl ? (
                            <a href={agreement.fileUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 text-xs" data-testid={`link-download-${agreement.id}`}>
                              <Download className="w-3.5 h-3.5" />عرض
                            </a>
                          ) : (
                            <label className="cursor-pointer">
                              <input
                                type="file"
                                className="hidden"
                                accept=".pdf,.doc,.docx,.xls,.xlsx,.pptx,.png,.jpg,.jpeg"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleFileUpload(agreement.id, file);
                                }}
                                data-testid={`input-upload-${agreement.id}`}
                              />
                              <span className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                                {uploadingId === agreement.id ? (
                                  <span className="animate-spin">⏳</span>
                                ) : (
                                  <Upload className="w-3.5 h-3.5" />
                                )}
                                رفع مرفق
                              </span>
                            </label>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => handleEdit(agreement)} data-testid={`button-edit-${agreement.id}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-red-600" disabled={deleteMutation.isPending} onClick={() => confirmAction(() => deleteMutation.mutate(agreement.id), { title: "تأكيد الحذف", description: "هل أنت متأكد من حذف هذا العقد؟" })} data-testid={`button-delete-${agreement.id}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setSuccessAgreement(null); }}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle>{successAgreement ? "تم إنشاء العقد" : editing ? "تعديل العقد" : "إضافة عقد جديد"}</DialogTitle>
            </DialogHeader>
            {successAgreement ? (
              <FormSuccessPanel
                title="تم إنشاء العقد بنجاح!"
                subtitle={successAgreement.title}
                referenceNumber={`AGR-${String(successAgreement.id).padStart(4, "0")}`}
                referenceLabel="رقم العقد"
                nextSteps={[
                  { title: "إرفاق المستند", description: "ارفق نسخة العقد الموقعة (PDF أو Word) من خلال زر 'رفع مرفق' في الجدول" },
                  { title: "تحديث الحالة", description: "حدّث حالة العقد إلى 'نشط' بعد التوقيع والاعتماد" },
                ]}
                actions={[
                  { label: "إضافة عقد آخر", variant: "default", icon: <Plus className="w-4 h-4" />, onClick: () => setSuccessAgreement(null) },
                  { label: "إغلاق", variant: "outline", onClick: () => { setIsDialogOpen(false); setSuccessAgreement(null); } },
                ]}
              />
            ) : (
              <>
                <DialogBody className="space-y-4">
                  <div>
                    <Label>عنوان العقد *</Label>
                    <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثال: عقد صيانة أنظمة ERP" data-testid="input-title" />
                  </div>
                  <div>
                    <Label>وصف العقد</Label>
                    <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="وصف مختصر لنطاق العقد والالتزامات..." data-testid="input-description" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>نوع العقد</Label>
                      <Select value={form.agreementType} onValueChange={(v) => setForm({ ...form, agreementType: v })}>
                        <SelectTrigger data-testid="select-type"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(typeLabels).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" />الطرف الآخر</Label>
                      <Input value={form.parties} onChange={(e) => setForm({ ...form, parties: e.target.value })} placeholder="اسم الشركة أو الجهة" data-testid="input-party" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>الحالة</Label>
                      <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                        <SelectTrigger data-testid="select-status"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(statusLabels).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />تاريخ البداية</Label>
                      <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} data-testid="input-start-date" />
                    </div>
                    <div>
                      <Label className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />تاريخ الانتهاء</Label>
                      <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} data-testid="input-end-date" />
                    </div>
                  </div>
                </DialogBody>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
                  <LoadingButton onClick={handleSubmit} loading={createMutation.isPending || updateMutation.isPending} loadingText="جاري الحفظ..." className="btn-gold" data-testid="button-submit">
                    {editing ? "حفظ التعديلات" : "إنشاء العقد"}
                  </LoadingButton>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
      <ConfirmDialog {...dialogProps} />
    </DashboardLayout>
  );
}
