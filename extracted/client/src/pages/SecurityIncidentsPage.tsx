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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, AlertTriangle, Shield, ShieldAlert, Activity, FileDown, FileSpreadsheet, EyeOff, Building2, Server, Search } from "lucide-react";
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
  open: { label: "مفتوحة", color: "bg-red-100 text-red-800" },
  investigating: { label: "قيد التحقيق", color: "bg-blue-100 text-blue-800" },
  contained: { label: "محتواة", color: "bg-yellow-100 text-yellow-800" },
  resolved: { label: "محلولة", color: "hub-badge-success" },
  closed: { label: "مغلقة", color: "hub-badge-neutral" }
};

const typeLabels: Record<string, string> = {
  malware: "برمجيات خبيثة",
  phishing: "تصيد احتيالي",
  data_breach: "اختراق بيانات",
  data_leak: "تسريب بيانات",
  ddos: "هجوم DDoS",
  unauthorized_access: "وصول غير مصرح",
  ransomware: "برامج الفدية",
  insider_threat: "تهديد داخلي",
  social_engineering: "هندسة اجتماعية",
  misconfiguration: "خطأ في الإعدادات",
  other: "أخرى"
};

const departmentLabels: Record<string, string> = {
  dmo: "مكتب إدارة البيانات (DMO)",
  infrastructure: "البنية التحتية",
  cybersecurity: "الأمن السيبراني",
  dta: "التحول الرقمي",
  support: "الدعم الفني",
  hr: "الموارد البشرية",
  finance: "المالية",
  operations: "العمليات",
  management: "الإدارة العليا",
  other: "أخرى"
};

const detectionMethods: Record<string, string> = {
  ids_ips: "نظام كشف/منع التسلل (IDS/IPS)",
  siem: "نظام SIEM",
  antivirus: "مكافح الفيروسات",
  user_report: "بلاغ من مستخدم",
  security_audit: "تدقيق أمني",
  monitoring: "مراقبة الشبكة",
  penetration_test: "اختبار اختراق",
  external_report: "بلاغ خارجي",
  manual_discovery: "اكتشاف يدوي",
  other: "أخرى"
};

export default function SecurityIncidentsPage() {
  const { toast } = useToast();
  const { confirm: confirmAction, dialogProps } = useConfirmDialog();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [successIncident, setSuccessIncident] = useState<{ id: number; title: string } | null>(null);
  const [formStep, setFormStep] = useState(1);
  
  const [form, setForm] = useState({
    title: "", titleAr: "", description: "", incidentType: "data_breach",
    severity: "medium", status: "open", affectedSystems: "",
    sourceSystem: "", affectedDepartment: "", isAnonymous: false,
    detectionMethod: "", containmentActions: "", remediationSteps: ""
  });

  const { data: incidents = [] } = useQuery<any[]>({ 
    queryKey: ["/api/security-incidents"] 
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => { const r = await apiRequest("POST", "/api/security-incidents", data); return r.json(); },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/security-incidents"] });
      invalidateRelatedQueries('/api/security-incidents');
      setSuccessIncident({ id: data.id, title: data.title || data.titleAr || 'حادثة أمنية' });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: 'خطأ في إنشاء البلاغ', description: error.message, variant: 'destructive' });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PUT", `/api/security-incidents/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/security-incidents"] });
      invalidateRelatedQueries('/api/security-incidents');
      setIsDialogOpen(false);
      setEditing(null);
      toast({ title: "تم تحديث الحادثة" });
    },
    onError: (error: Error) => {
      toast({ title: 'خطأ في تحديث الحادث', description: error.message, variant: 'destructive' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/security-incidents/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/security-incidents"] });
      invalidateRelatedQueries('/api/security-incidents');
      toast({ title: "تم حذف الحادثة" });
    },
    onError: (error: Error) => {
      toast({ title: 'خطأ في حذف الحادث', description: error.message, variant: 'destructive' });
    }
  });

  const resetForm = () => {
    setForm({
      title: "", titleAr: "", description: "", incidentType: "data_breach",
      severity: "medium", status: "open", affectedSystems: "",
      sourceSystem: "", affectedDepartment: "", isAnonymous: false,
      detectionMethod: "", containmentActions: "", remediationSteps: ""
    });
    setFormStep(1);
  };

  const handleEdit = (item: any) => {
    setEditing(item);
    setForm({
      title: item.title || "",
      titleAr: item.titleAr || "",
      description: item.description || "",
      incidentType: item.incidentType || "data_breach",
      severity: item.severity || "medium",
      status: item.status || "open",
      affectedSystems: item.affectedSystems || item.affectedAssets || "",
      sourceSystem: item.sourceSystem || "",
      affectedDepartment: item.affectedDepartment || "",
      isAnonymous: item.isAnonymous || false,
      detectionMethod: item.detectionMethod || "",
      containmentActions: item.containmentActions || "",
      remediationSteps: item.remediationSteps || ""
    });
    setFormStep(1);
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.title.trim() && !form.titleAr.trim()) {
      toast({ title: "تنبيه", description: "يرجى إدخال عنوان البلاغ", variant: "destructive" });
      return;
    }
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const stats = {
    total: incidents.length,
    open: incidents.filter((i: any) => i.status === 'open' || i.status === 'investigating').length,
    critical: incidents.filter((i: any) => i.severity === 'critical').length,
    resolved: incidents.filter((i: any) => i.status === 'resolved' || i.status === 'closed').length
  };

  const handleExportPDF = () => {
    exportToPDF({
      title: 'تقرير الحوادث الأمنية',
      subtitle: 'JCSA - Control Hub',
      columns: [{"header":"الحادثة","key":"title","width":40},{"header":"الخطورة","key":"severity","width":20},{"header":"النوع","key":"type","width":25},{"header":"الحالة","key":"status","width":20},{"header":"التاريخ","key":"date","width":25}],
      data: (incidents || []).map((item: any) => ({ title: item.title || '', severity: item.severity || '', type: item.incidentType || item.type || '', status: formatStatus(item.status || ''), date: item.reportedAt || item.createdAt ? new Date(item.reportedAt || item.createdAt).toLocaleDateString('ar-SA') : '' })),
      filename: 'security-incidents-report',
      orientation: 'landscape',
    });
  };

  const handleExportExcel = () => {
    exportToExcel({
      title: 'تقرير الحوادث الأمنية',
      columns: [{"header":"الحادثة","key":"title","width":40},{"header":"الخطورة","key":"severity","width":20},{"header":"النوع","key":"type","width":25},{"header":"الحالة","key":"status","width":20},{"header":"التاريخ","key":"date","width":25}],
      data: (incidents || []).map((item: any) => ({ title: item.title || '', severity: item.severity || '', type: item.incidentType || item.type || '', status: formatStatus(item.status || ''), date: item.reportedAt || item.createdAt ? new Date(item.reportedAt || item.createdAt).toLocaleDateString('ar-SA') : '' })),
      filename: 'security-incidents-report',
    });
  };

  const isStep1Valid = form.title.trim() || form.titleAr.trim();

  return (
    <DashboardLayout
      title="الحوادث الأمنية"
      subtitle="إدارة ومتابعة الحوادث والتهديدات الأمنية"
      navGroups={cybersecurityNavGroups}
      portalName="الأمن السيبراني"
    >
      <div className="space-y-5" dir="rtl">
        <PageHeader
          icon={Shield}
          title="الحوادث الأمنية"
          subtitle="إدارة ومتابعة الحوادث والتهديدات الأمنية"
          actions={
            <>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportPDF} data-testid="button-export-pdf"><FileDown className="w-3.5 h-3.5" />PDF</Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportExcel} data-testid="button-export-excel"><FileSpreadsheet className="w-3.5 h-3.5" />Excel</Button>
              <Button className="btn-gold h-9 gap-1.5 text-xs" onClick={() => { resetForm(); setEditing(null); setIsDialogOpen(true); }} data-testid="button-add-incident"><Plus className="w-3.5 h-3.5" />تسجيل بلاغ</Button>
            </>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="إجمالي الحوادث" value={stats.total} icon={Shield} color="navy" />
          <KpiCard label="حوادث مفتوحة" value={stats.open} icon={AlertTriangle} color={stats.open > 0 ? "danger" : "muted"} />
          <KpiCard label="حوادث حرجة" value={stats.critical} icon={ShieldAlert} color={stats.critical > 0 ? "danger" : "muted"} />
          <KpiCard label="محلولة" value={stats.resolved} icon={Activity} color="success" />
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <CardTitle>سجل الحوادث الأمنية</CardTitle>
          </CardHeader>
          <CardContent>
            {incidents.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Shield className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-lg">لا توجد حوادث مسجلة</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>العنوان</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>الخطورة</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>النظام المسرب</TableHead>
                    <TableHead>الإدارة</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incidents.map((incident: any) => (
                    <TableRow key={incident.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{incident.titleAr || incident.title}</div>
                          {incident.titleAr && incident.title && incident.title !== incident.titleAr && (
                            <div className="text-sm text-muted-foreground">{incident.title}</div>
                          )}
                          {incident.isAnonymous && (
                            <Badge variant="outline" className="mt-1 text-xs gap-1">
                              <EyeOff className="w-3 h-3" />بلاغ مجهول
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{typeLabels[incident.incidentType] || incident.incidentType || "-"}</TableCell>
                      <TableCell>
                        <Badge className={severityLabels[incident.severity]?.color || "bg-gray-100"}>
                          {severityLabels[incident.severity]?.label || incident.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusLabels[incident.status]?.color || "bg-gray-100"}>
                          {statusLabels[incident.status]?.label || incident.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[120px] truncate">{incident.sourceSystem || "-"}</TableCell>
                      <TableCell>{departmentLabels[incident.affectedDepartment] || incident.affectedDepartment || "-"}</TableCell>
                      <TableCell>{incident.createdAt ? new Date(incident.createdAt).toLocaleDateString('ar-SA') : "-"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => handleEdit(incident)} data-testid={`button-edit-incident-${incident.id}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-red-600" disabled={deleteMutation.isPending} onClick={() => confirmAction(() => deleteMutation.mutate(incident.id), { title: 'تأكيد الحذف', description: 'هل أنت متأكد من حذف هذا البلاغ؟ لا يمكن التراجع عن هذا الإجراء.' })} data-testid={`button-delete-incident-${incident.id}`}>
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

        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) { setSuccessIncident(null); setFormStep(1); } }}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle>{successIncident ? 'تم تسجيل البلاغ' : editing ? "تعديل البلاغ" : "تسجيل بلاغ حادثة أمنية"}</DialogTitle>
            </DialogHeader>
            {successIncident ? (
              <FormSuccessPanel
                title="تم تسجيل البلاغ الأمني بنجاح!"
                subtitle={successIncident.title}
                referenceNumber={`INC-${String(successIncident.id).padStart(4, '0')}`}
                referenceLabel="رقم البلاغ"
                nextSteps={[
                  { title: "مراجعة فورية من فريق الأمن", description: "سيتلقى مدير الأمن السيبراني إشعاراً فورياً بالبلاغ الجديد" },
                  { title: "التحقيق والتصنيف", description: "سيتم تحديد نطاق الحادثة وتصنيفها وتعيين المسؤول عن المعالجة" },
                  { title: "الاحتواء والمعالجة", description: "ستُتخذ إجراءات الاحتواء الفوري وسيُبلَّغ عنها في منصة التتبع" },
                  { title: "التوثيق والتقرير", description: "سيُعدّ تقرير نهائي عند إغلاق الحادثة ويُرفع إلى إدارة تقنية المعلومات" },
                ]}
                actions={[
                  {
                    label: "تسجيل بلاغ آخر",
                    variant: "default",
                    icon: <Plus className="w-4 h-4" />,
                    onClick: () => setSuccessIncident(null),
                  },
                  {
                    label: "إغلاق",
                    variant: "outline",
                    onClick: () => { setIsDialogOpen(false); setSuccessIncident(null); },
                  },
                ]}
              />
            ) : (
              <>
                {!editing && (
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${formStep === 1 ? 'bg-[hsl(var(--gold))] text-white' : 'bg-muted text-muted-foreground'}`}>
                      <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">1</span>
                      معلومات البلاغ
                    </div>
                    <div className="h-px flex-1 bg-border" />
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${formStep === 2 ? 'bg-[hsl(var(--gold))] text-white' : 'bg-muted text-muted-foreground'}`}>
                      <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">2</span>
                      تفاصيل إضافية
                    </div>
                  </div>
                )}

                <DialogBody className="space-y-4">
                  <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-300">
                    ⚠️ سجّل البلاغ فور اكتشاف الحادثة — كل دقيقة مهمة في الاستجابة للحوادث الأمنية.
                  </div>

                  {(formStep === 1 || editing) && (
                    <>
                      <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
                        <div className="flex items-center gap-2">
                          <EyeOff className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <Label className="text-sm font-medium">بلاغ مجهول الهوية</Label>
                            <p className="text-xs text-muted-foreground">لن يظهر اسمك كمُبلّغ عن هذه الحادثة</p>
                          </div>
                        </div>
                        <Switch
                          checked={form.isAnonymous}
                          onCheckedChange={(checked) => setForm({...form, isAnonymous: checked})}
                          data-testid="switch-anonymous"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>عنوان البلاغ بالعربية *</Label>
                          <Input value={form.titleAr} onChange={e => setForm({...form, titleAr: e.target.value})} placeholder="مثال: تسريب بيانات من نظام الموارد البشرية" data-testid="input-title-ar" />
                          <FieldHint>وصف مختصر وواضح للحادثة.</FieldHint>
                        </div>
                        <div>
                          <Label>العنوان بالإنجليزية</Label>
                          <Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="Data Breach in HR System" data-testid="input-title-en" />
                        </div>
                      </div>

                      <div>
                        <Label>وصف الحادثة *</Label>
                        <Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3} placeholder="اشرح ما حدث بالتفصيل: ماذا لاحظت؟ متى حدث ذلك؟ ما البيانات المتأثرة؟" data-testid="input-description" />
                        <FieldHint>اذكر أكبر قدر من التفاصيل لمساعدة فريق الأمن في التحقيق.</FieldHint>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label>نوع الحادثة</Label>
                          <Select value={form.incidentType} onValueChange={v => setForm({...form, incidentType: v})}>
                            <SelectTrigger data-testid="select-incident-type"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Object.entries(typeLabels).map(([k, v]) => (
                                <SelectItem key={k} value={k}>{v}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>مستوى الخطورة</Label>
                          <Select value={form.severity} onValueChange={v => setForm({...form, severity: v})}>
                            <SelectTrigger data-testid="select-severity"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="critical">🔴 حرج — توقف كامل</SelectItem>
                              <SelectItem value="high">🟠 عالي — تأثير كبير</SelectItem>
                              <SelectItem value="medium">🟡 متوسط — تأثير محدود</SelectItem>
                              <SelectItem value="low">🟢 منخفض — تأثير طفيف</SelectItem>
                            </SelectContent>
                          </Select>
                          <FieldHint>حرج = يتطلب تدخلاً فورياً.</FieldHint>
                        </div>
                        {editing && (
                          <div>
                            <Label>الحالة</Label>
                            <Select value={form.status} onValueChange={v => setForm({...form, status: v})}>
                              <SelectTrigger data-testid="select-status"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {Object.entries(statusLabels).map(([k, v]) => (
                                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="flex items-center gap-1.5"><Server className="w-3.5 h-3.5" />النظام المصدر / المسرب منه</Label>
                          <Input value={form.sourceSystem} onChange={e => setForm({...form, sourceSystem: e.target.value})} placeholder="مثال: نظام ERP، قاعدة بيانات HR، خادم الملفات" data-testid="input-source-system" />
                          <FieldHint>النظام أو التطبيق الذي حدث منه التسريب أو الاختراق.</FieldHint>
                        </div>
                        <div>
                          <Label className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" />الإدارة المعنية</Label>
                          <Select value={form.affectedDepartment} onValueChange={v => setForm({...form, affectedDepartment: v})}>
                            <SelectTrigger data-testid="select-department"><SelectValue placeholder="اختر الإدارة..." /></SelectTrigger>
                            <SelectContent>
                              {Object.entries(departmentLabels).map(([k, v]) => (
                                <SelectItem key={k} value={k}>{v}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FieldHint>الإدارة المتأثرة بالحادثة أو المسؤولة عن النظام.</FieldHint>
                        </div>
                      </div>
                    </>
                  )}

                  {(formStep === 2 || editing) && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="flex items-center gap-1.5"><Search className="w-3.5 h-3.5" />طريقة الاكتشاف</Label>
                          <Select value={form.detectionMethod} onValueChange={v => setForm({...form, detectionMethod: v})}>
                            <SelectTrigger data-testid="select-detection"><SelectValue placeholder="كيف تم اكتشاف الحادثة؟" /></SelectTrigger>
                            <SelectContent>
                              {Object.entries(detectionMethods).map(([k, v]) => (
                                <SelectItem key={k} value={k}>{v}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>الأنظمة والأصول المتأثرة</Label>
                          <Input value={form.affectedSystems} onChange={e => setForm({...form, affectedSystems: e.target.value})} placeholder="مثال: خادم الويب، قاعدة البيانات، شبكة VPN" data-testid="input-affected-systems" />
                          <FieldHint>جميع الأنظمة والأصول التي تأثرت بالحادثة.</FieldHint>
                        </div>
                      </div>
                      <div>
                        <Label>إجراءات الاحتواء الفورية</Label>
                        <Textarea value={form.containmentActions} onChange={e => setForm({...form, containmentActions: e.target.value})} rows={2} placeholder="ما الإجراءات التي اتُّخذت فوراً للحد من الضرر؟ مثال: فصل الجهاز عن الشبكة، تعطيل الحساب..." data-testid="input-containment" />
                      </div>
                      <div>
                        <Label>خطوات المعالجة المقترحة</Label>
                        <Textarea value={form.remediationSteps} onChange={e => setForm({...form, remediationSteps: e.target.value})} rows={2} placeholder="اقترح الخطوات اللازمة لإصلاح المشكلة ومنع تكرارها..." data-testid="input-remediation" />
                      </div>
                    </>
                  )}
                </DialogBody>
                <DialogFooter className="flex gap-2">
                  {!editing && formStep === 2 && (
                    <Button variant="outline" onClick={() => setFormStep(1)} data-testid="button-back">
                      السابق
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
                  {!editing && formStep === 1 ? (
                    <Button className="btn-gold" disabled={!isStep1Valid} onClick={() => setFormStep(2)} data-testid="button-next">
                      التالي
                    </Button>
                  ) : (
                    <LoadingButton onClick={handleSubmit} loading={createMutation.isPending || updateMutation.isPending} loadingText="جاري التسجيل..." className="btn-gold" data-testid="button-submit-incident">
                      {editing ? "حفظ التعديلات" : "تسجيل البلاغ"}
                    </LoadingButton>
                  )}
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
