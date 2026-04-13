import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, invalidateRelatedQueries } from "@/lib/queryClient";
import DashboardLayout from "@/components/DashboardLayout";
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
import { Plus, Pencil, Trash2, Bug, Shield, AlertOctagon, CheckCircle2, FileDown, FileSpreadsheet } from "lucide-react";
import { PageHeader, KpiCard } from "@/components/Quality";
import { cybersecurityNavGroups } from "@/lib/navigation";
import { exportToPDF, exportToExcel, formatStatus} from '@/lib/exports';
import { useConfirmDialog, ConfirmDialog } from '@/components/ConfirmDialog';
import { FormSuccessPanel, FieldHint } from "@/components/ui/form-guide";

const severityLabels: Record<string, { label: string; color: string }> = {
  critical: { label: "حرج", color: "bg-red-600 text-white" },
  high: { label: "عالي", color: "bg-orange-500 text-white" },
  medium: { label: "متوسط", color: "bg-yellow-500 text-black" },
  low: { label: "منخفض", color: "bg-emerald-500 text-white" }
};

const statusLabels: Record<string, { label: string; color: string }> = {
  discovered: { label: "مكتشفة", color: "bg-red-100 text-red-800" },
  analyzing: { label: "قيد التحليل", color: "bg-blue-100 text-blue-800" },
  patching: { label: "قيد المعالجة", color: "bg-yellow-100 text-yellow-800" },
  resolved: { label: "معالجة", color: "hub-badge-success" },
  accepted: { label: "مقبولة", color: "hub-badge-neutral" }
};

export default function SecurityVulnerabilitiesPage() {
  const { toast } = useToast();
  const { confirm: confirmAction, dialogProps } = useConfirmDialog();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [successVuln, setSuccessVuln] = useState<{ id: number; title: string } | null>(null);
  
  const [form, setForm] = useState({
    cveId: "", title: "", titleAr: "", description: "",
    severity: "medium", status: "discovered", affectedAssets: "",
    cvssScore: "", remediation: "", dueDate: ""
  });

  const { data: vulnerabilities = [] } = useQuery<any[]>({ 
    queryKey: ["/api/security-vulnerabilities"] 
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => { const r = await apiRequest("POST", "/api/security-vulnerabilities", data); return r.json(); },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/security-vulnerabilities"] });
      invalidateRelatedQueries('/api/security-vulnerabilities');
      setSuccessVuln({ id: data.id, title: data.title || data.titleAr || data.cveId || 'ثغرة أمنية' });
      resetForm();
    },
    onError: () => {
      toast({ title: 'خطأ في إنشاء الثغرة', variant: 'destructive' });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => 
      apiRequest("PUT", `/api/security-vulnerabilities/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/security-vulnerabilities"] });
      invalidateRelatedQueries('/api/security-vulnerabilities');
      setIsDialogOpen(false);
      setEditing(null);
      toast({ title: "تم تحديث الثغرة" });
    },
    onError: () => {
      toast({ title: 'خطأ في تحديث الثغرة', variant: 'destructive' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/security-vulnerabilities/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/security-vulnerabilities"] });
      invalidateRelatedQueries('/api/security-vulnerabilities');
      toast({ title: "تم حذف الثغرة" });
    },
    onError: () => {
      toast({ title: 'خطأ في حذف الثغرة', variant: 'destructive' });
    }
  });

  const resetForm = () => {
    setForm({
      cveId: "", title: "", titleAr: "", description: "",
      severity: "medium", status: "discovered", affectedAssets: "",
      cvssScore: "", remediation: "", dueDate: ""
    });
  };

  const handleEdit = (item: any) => {
    setEditing(item);
    setForm({
      cveId: item.cveId || "",
      title: item.title || "",
      titleAr: item.titleAr || "",
      description: item.description || "",
      severity: item.severity || "medium",
      status: item.status || "discovered",
      affectedAssets: item.affectedAssets || "",
      cvssScore: item.cvssScore?.toString() || "",
      remediation: item.remediation || "",
      dueDate: item.dueDate || ""
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.title.trim() && !form.titleAr.trim()) {
      toast({ title: "تنبيه", description: "يرجى إدخال اسم الثغرة", variant: "destructive" });
      return;
    }
    const data = {
      ...form,
      cvssScore: form.cvssScore ? parseFloat(form.cvssScore) : null
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const stats = {
    total: vulnerabilities.length,
    open: vulnerabilities.filter((v: any) => v.status === 'discovered' || v.status === 'analyzing').length,
    critical: vulnerabilities.filter((v: any) => v.severity === 'critical').length,
    resolved: vulnerabilities.filter((v: any) => v.status === 'resolved').length
  };


  const handleExportPDF = () => {
    exportToPDF({
      title: 'تقرير الثغرات الأمنية',
      subtitle: 'JCSA - Control Hub',
      columns: [{"header":"الثغرة","key":"title","width":40},{"header":"الخطورة","key":"severity","width":20},{"header":"الحالة","key":"status","width":20},{"header":"النظام المتأثر","key":"affectedSystem","width":30}],
      data: (vulnerabilities || []).map((item: any) => ({ title: item.title || '', severity: item.severity || '', status: formatStatus(item.status || ''), affectedSystem: item.affectedSystem || item.affectedSystems || '' })),
      filename: 'security-vulnerabilities-report',
      orientation: 'landscape',
    });
  };

  const handleExportExcel = () => {
    exportToExcel({
      title: 'تقرير الثغرات الأمنية',
      columns: [{"header":"الثغرة","key":"title","width":40},{"header":"الخطورة","key":"severity","width":20},{"header":"الحالة","key":"status","width":20},{"header":"النظام المتأثر","key":"affectedSystem","width":30}],
      data: (vulnerabilities || []).map((item: any) => ({ title: item.title || '', severity: item.severity || '', status: formatStatus(item.status || ''), affectedSystem: item.affectedSystem || item.affectedSystems || '' })),
      filename: 'security-vulnerabilities-report',
    });
  };

  return (
    <DashboardLayout
      title="الثغرات الأمنية"
      subtitle="تتبع ومعالجة الثغرات الأمنية"
      navGroups={cybersecurityNavGroups}
      portalName="الأمن السيبراني"
    >
      <div className="space-y-5" dir="rtl">
        <PageHeader
          icon={Bug}
          title="الثغرات الأمنية"
          subtitle="تتبع ومعالجة الثغرات الأمنية"
          actions={
            <>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportPDF} data-testid="button-export-pdf"><FileDown className="w-3.5 h-3.5" />PDF</Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportExcel} data-testid="button-export-excel"><FileSpreadsheet className="w-3.5 h-3.5" />Excel</Button>
              <Button className="btn-gold h-9 gap-1.5 text-xs" onClick={() => { resetForm(); setEditing(null); setIsDialogOpen(true); }}><Plus className="w-3.5 h-3.5" />تسجيل ثغرة</Button>
            </>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="إجمالي الثغرات" value={stats.total} icon={Bug} color="navy" />
          <KpiCard label="ثغرات مفتوحة" value={stats.open} icon={AlertOctagon} color={stats.open > 0 ? "danger" : "muted"} />
          <KpiCard label="ثغرات حرجة" value={stats.critical} icon={Shield} color={stats.critical > 0 ? "danger" : "muted"} />
          <KpiCard label="معالجة" value={stats.resolved} icon={CheckCircle2} color="success" />
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <CardTitle>سجل الثغرات الأمنية</CardTitle>
          </CardHeader>
          <CardContent>
            {vulnerabilities.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Bug className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-lg">لا توجد ثغرات مسجلة</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>CVE ID</TableHead>
                    <TableHead>العنوان</TableHead>
                    <TableHead>الخطورة</TableHead>
                    <TableHead>CVSS</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>الأصول المتأثرة</TableHead>
                    <TableHead>الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vulnerabilities.map((vuln: any) => (
                    <TableRow key={vuln.id}>
                      <TableCell className="font-mono text-sm">{vuln.cveId || "-"}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{vuln.title}</div>
                          {vuln.titleAr && <div className="text-sm text-muted-foreground">{vuln.titleAr}</div>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={severityLabels[vuln.severity]?.color || "bg-gray-100"}>
                          {severityLabels[vuln.severity]?.label || vuln.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>{vuln.cvssScore || "-"}</TableCell>
                      <TableCell>
                        <Badge className={statusLabels[vuln.status]?.color || "bg-gray-100"}>
                          {statusLabels[vuln.status]?.label || vuln.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate">{vuln.affectedAssets || "-"}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="icon" variant="ghost" onClick={() => handleEdit(vuln)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-red-600" disabled={deleteMutation.isPending} onClick={() => confirmAction(() => deleteMutation.mutate(vuln.id), { title: 'تأكيد الحذف', description: 'هل أنت متأكد من حذف هذه الثغرة الأمنية؟ لا يمكن التراجع عن هذا الإجراء.' })}>
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

        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setSuccessVuln(null); }}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle>{successVuln ? 'تم تسجيل الثغرة' : editing ? "تعديل الثغرة" : "تسجيل ثغرة أمنية"}</DialogTitle>
            </DialogHeader>
            {successVuln ? (
              <FormSuccessPanel
                title="تم تسجيل الثغرة الأمنية بنجاح!"
                subtitle={successVuln.title}
                referenceNumber={`VUL-${String(successVuln.id).padStart(4, '0')}`}
                referenceLabel="رقم الثغرة"
                nextSteps={[
                  { title: "تحليل الثغرة", description: "سيراجع فريق الأمن السيبراني الثغرة ويحدد مدى تأثيرها على الأنظمة" },
                  { title: "تحديد الأولوية والتخطيط", description: "سيُعطى لكل ثغرة أولوية بناءً على درجة CVSS ونطاق التأثير" },
                  { title: "تطبيق التصحيح", description: "سيتم تطبيق التحديثات والتصحيحات اللازمة ضمن الإطار الزمني المحدد" },
                  { title: "التحقق والإغلاق", description: "بعد المعالجة سيُتحقق من إغلاق الثغرة ويُوثَّق في السجلات" },
                ]}
                actions={[
                  {
                    label: "تسجيل ثغرة أخرى",
                    variant: "default",
                    icon: <Plus className="w-4 h-4" />,
                    onClick: () => setSuccessVuln(null),
                  },
                  {
                    label: "إغلاق",
                    variant: "outline",
                    onClick: () => { setIsDialogOpen(false); setSuccessVuln(null); },
                  },
                ]}
              />
            ) : (
              <>
                <DialogBody className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>رقم CVE (إن وُجد)</Label>
                      <Input value={form.cveId} onChange={e => setForm({...form, cveId: e.target.value})} placeholder="CVE-2024-XXXX" />
                      <FieldHint>رقم التعريف الدولي للثغرة من قاعدة NVD.</FieldHint>
                    </div>
                    <div>
                      <Label>اسم الثغرة (إنجليزي) *</Label>
                      <Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="SQL Injection in Login Form" />
                    </div>
                    <div>
                      <Label>اسم الثغرة (عربي)</Label>
                      <Input value={form.titleAr} onChange={e => setForm({...form, titleAr: e.target.value})} placeholder="حقن SQL في نموذج الدخول" />
                    </div>
                  </div>
                  <div>
                    <Label>وصف الثغرة</Label>
                    <Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3} placeholder="اشرح طبيعة الثغرة وكيف يمكن استغلالها..." />
                    <FieldHint>اذكر الإصدارات المتأثرة والطريقة التقنية لاستغلال الثغرة.</FieldHint>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>مستوى الخطورة</Label>
                      <Select value={form.severity} onValueChange={v => setForm({...form, severity: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="critical">🔴 حرج (9.0-10)</SelectItem>
                          <SelectItem value="high">🟠 عالي (7.0-8.9)</SelectItem>
                          <SelectItem value="medium">🟡 متوسط (4.0-6.9)</SelectItem>
                          <SelectItem value="low">🟢 منخفض (0.1-3.9)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>درجة CVSS (0-10)</Label>
                      <Input type="number" step="0.1" min="0" max="10" value={form.cvssScore} onChange={e => setForm({...form, cvssScore: e.target.value})} placeholder="7.5" />
                      <FieldHint>احسب الدرجة عبر nvd.nist.gov/vuln-metrics/cvss</FieldHint>
                    </div>
                    <div>
                      <Label>الحالة الحالية</Label>
                      <Select value={form.status} onValueChange={v => setForm({...form, status: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(statusLabels).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>الأنظمة والأصول المتأثرة</Label>
                      <Input value={form.affectedAssets} onChange={e => setForm({...form, affectedAssets: e.target.value})} placeholder="مثال: خادم الويب، تطبيق الجوال" />
                      <FieldHint>أدرج جميع الأصول المتأثرة مفصولة بفاصلة.</FieldHint>
                    </div>
                    <div>
                      <Label>الموعد النهائي للمعالجة</Label>
                      <Input type="date" value={form.dueDate} onChange={e => setForm({...form, dueDate: e.target.value})} />
                      <FieldHint>الثغرات الحرجة: 7 أيام | العالية: 30 يوم.</FieldHint>
                    </div>
                  </div>
                  <div>
                    <Label>خطة المعالجة والإصلاح</Label>
                    <Textarea value={form.remediation} onChange={e => setForm({...form, remediation: e.target.value})} rows={3} placeholder="اذكر التصحيحات المطلوبة، إعدادات الأمان، وأي حلول مؤقتة..." />
                    <FieldHint>كن محدداً: أرقام الإصدارات، أوامر التثبيت، أو الإعدادات المطلوبة.</FieldHint>
                  </div>
                </DialogBody>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
                  <LoadingButton onClick={handleSubmit} loading={createMutation.isPending || updateMutation.isPending} loadingText="جاري التسجيل..." className="btn-gold">
                    {editing ? "حفظ التعديلات" : "تسجيل الثغرة"}
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
