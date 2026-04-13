import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, invalidateRelatedQueries } from "@/lib/queryClient";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, AppWindow, Globe, Server, Smartphone, FileDown, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { digitalTransformationNavGroups } from "@/lib/navigation";
import { exportToPDF, exportToExcel, formatStatus} from '@/lib/exports';
import { useConfirmDialog, ConfirmDialog } from '@/components/ConfirmDialog';
import { PageHeader, KpiCard } from "@/components/Quality";
import { LoadingButton } from "@/components/LoadingButton";

const appTypeLabels: Record<string, string> = {
  web: "تطبيق ويب",
  mobile: "تطبيق جوال",
  desktop: "تطبيق سطح مكتب",
  api: "خدمة API",
  integration: "تكامل"
};

const hostingLabels: Record<string, string> = {
  on_premise: "محلي",
  cloud: "سحابي",
  hybrid: "هجين",
  saas: "SaaS"
};

const statusLabels: Record<string, string> = {
  active: "نشط",
  inactive: "غير نشط",
  development: "قيد التطوير",
  maintenance: "صيانة",
  deprecated: "منتهي"
};

export default function DigitalApplicationsPage() {
  const { toast } = useToast();
  const { confirm: confirmAction, dialogProps } = useConfirmDialog();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState({
    nameAr: "", nameEn: "", description: "", appType: "web",
    platform: "web", vendor: "", version: "", url: "",
    hostingType: "on_premise", usersCount: "", licensingType: "",
    licenseCost: "", renewalDate: "", status: "active",
    criticality: "medium", dataClassification: "internal", documentation: ""
  });

  const { data: apps = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/digital-applications"] });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/digital-applications", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/digital-applications"] });
      invalidateRelatedQueries('/api/digital-applications');
      setIsDialogOpen(false);
      toast({ title: "تم إضافة التطبيق بنجاح" });
    },
    onError: () => {
      toast({ title: 'خطأ في إضافة التطبيق', variant: 'destructive' });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => 
      apiRequest("PUT", `/api/digital-applications/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/digital-applications"] });
      invalidateRelatedQueries('/api/digital-applications');
      setIsDialogOpen(false);
      toast({ title: "تم تحديث التطبيق بنجاح" });
    },
    onError: () => {
      toast({ title: 'خطأ في تحديث التطبيق', variant: 'destructive' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/digital-applications/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/digital-applications"] });
      invalidateRelatedQueries('/api/digital-applications');
      toast({ title: "تم حذف التطبيق" });
    },
    onError: () => {
      toast({ title: 'خطأ في حذف التطبيق', variant: 'destructive' });
    }
  });

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setFormData({
      nameAr: item.nameAr || "", nameEn: item.nameEn || "",
      description: item.description || "", appType: item.appType || "web",
      platform: item.platform || "web", vendor: item.vendor || "",
      version: item.version || "", url: item.url || "",
      hostingType: item.hostingType || "on_premise",
      usersCount: item.usersCount?.toString() || "",
      licensingType: item.licensingType || "",
      licenseCost: item.licenseCost?.toString() || "",
      renewalDate: item.renewalDate ? new Date(item.renewalDate).toISOString().split('T')[0] : "",
      status: item.status || "active",
      criticality: item.criticality || "medium",
      dataClassification: item.dataClassification || "internal",
      documentation: item.documentation || ""
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.nameAr.trim() && !formData.nameEn.trim()) {
      toast({ title: "تنبيه", description: "يرجى إدخال اسم التطبيق", variant: "destructive" });
      return;
    }
    const data = {
      ...formData,
      usersCount: formData.usersCount ? parseInt(formData.usersCount) : null,
      licenseCost: formData.licenseCost ? parseFloat(formData.licenseCost) : null,
      renewalDate: formData.renewalDate || null
    };
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const getAppIcon = (type: string) => {
    switch (type) {
      case 'web': return <Globe className="h-4 w-4" />;
      case 'mobile': return <Smartphone className="h-4 w-4" />;
      case 'api': return <Server className="h-4 w-4" />;
      default: return <AppWindow className="h-4 w-4" />;
    }
  };

  const stats = {
    total: apps.length,
    active: apps.filter((a: any) => a.status === 'active').length,
    web: apps.filter((a: any) => a.appType === 'web').length,
    mobile: apps.filter((a: any) => a.appType === 'mobile').length
  };


  const handleExportPDF = () => {
    exportToPDF({
      title: 'تقرير التطبيقات الرقمية',
      subtitle: 'JCSA - Control Hub',
      columns: [{"header":"التطبيق","key":"name","width":35},{"header":"النوع","key":"type","width":25},{"header":"الحالة","key":"status","width":20},{"header":"القسم","key":"department","width":25}],
      data: (apps || []).map((item: any) => ({ name: item.nameAr || item.name || '', type: item.appType || item.type || '', status: formatStatus(item.status || ''), department: item.department || '' })),
      filename: 'digital-applications-report',
      orientation: 'landscape',
    });
  };

  const handleExportExcel = () => {
    exportToExcel({
      title: 'تقرير التطبيقات الرقمية',
      columns: [{"header":"التطبيق","key":"name","width":35},{"header":"النوع","key":"type","width":25},{"header":"الحالة","key":"status","width":20},{"header":"القسم","key":"department","width":25}],
      data: (apps || []).map((item: any) => ({ name: item.nameAr || item.name || '', type: item.appType || item.type || '', status: formatStatus(item.status || ''), department: item.department || '' })),
      filename: 'digital-applications-report',
    });
  };

  return (
    <DashboardLayout
      title="التطبيقات الرقمية"
      subtitle="إدارة سجل التطبيقات والأنظمة الرقمية"
      navGroups={digitalTransformationNavGroups}
      portalName="التحول الرقمي"
    >
      <div className="space-y-5" dir="rtl">
        <PageHeader
          icon={AppWindow}
          title="التطبيقات الرقمية"
          subtitle="إدارة سجل التطبيقات والأنظمة الرقمية المستخدمة في المؤسسة"
          actions={
            <>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportPDF} data-testid="button-export-pdf"><FileDown className="w-3.5 h-3.5" />PDF</Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportExcel} data-testid="button-export-excel"><FileSpreadsheet className="w-3.5 h-3.5" />Excel</Button>
              <Button onClick={() => { setEditingItem(null); setFormData({ nameAr: "", nameEn: "", description: "", appType: "web", platform: "web", vendor: "", version: "", url: "", hostingType: "on_premise", usersCount: "", licensingType: "", licenseCost: "", renewalDate: "", status: "active", criticality: "medium", dataClassification: "internal", documentation: "" }); setIsDialogOpen(true); }} className="btn-gold h-9 gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" />إضافة تطبيق
              </Button>
            </>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="إجمالي التطبيقات" value={stats.total} icon={AppWindow} color="navy" />
          <KpiCard label="التطبيقات النشطة" value={stats.active} icon={CheckCircle2} color="success" />
          <KpiCard label="تطبيقات الويب" value={stats.web} icon={Globe} color="gold" />
          <KpiCard label="تطبيقات الجوال" value={stats.mobile} icon={Smartphone} color="info" />
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>سجل التطبيقات</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="flex items-center gap-4 p-3 border-b border-border/40">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                ))}
              </div>
            ) : apps.length === 0 ? (
              <div className="text-center py-12">
                <AppWindow className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
                <p className="text-muted-foreground font-medium">لا توجد تطبيقات</p>
                <p className="text-sm text-muted-foreground/60 mt-1">اضغط على "إضافة تطبيق" لإضافة أول تطبيق</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الكود</TableHead>
                    <TableHead>التطبيق</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>الاستضافة</TableHead>
                    <TableHead>المستخدمين</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apps.map((app: any) => (
                    <TableRow key={app.id}>
                      <TableCell className="font-mono text-sm">{app.appCode}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getAppIcon(app.appType)}
                          <div>
                            <div className="font-medium">{app.nameAr}</div>
                            {app.nameEn && <div className="text-sm text-muted-foreground">{app.nameEn}</div>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{appTypeLabels[app.appType] || app.appType}</TableCell>
                      <TableCell>{hostingLabels[app.hostingType] || app.hostingType}</TableCell>
                      <TableCell>{app.usersCount || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={app.status === 'active' ? 'default' : 'secondary'}>
                          {statusLabels[app.status] || app.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="icon" variant="ghost" onClick={() => handleEdit(app)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-red-600" disabled={deleteMutation.isPending} onClick={() => confirmAction(() => deleteMutation.mutate(app.id), { title: 'تأكيد الحذف', description: 'هل أنت متأكد من حذف هذا التطبيق الرقمي؟ لا يمكن التراجع عن هذا الإجراء.' })}>
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

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-2xl" dir="rtl">
            <DialogHeader>
              <DialogTitle>{editingItem ? "تعديل التطبيق" : "إضافة تطبيق جديد"}</DialogTitle>
            </DialogHeader>
            <DialogBody className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>اسم التطبيق (عربي) *</Label>
                  <Input value={formData.nameAr} onChange={e => setFormData({...formData, nameAr: e.target.value})} />
                </div>
                <div>
                  <Label>اسم التطبيق (إنجليزي)</Label>
                  <Input value={formData.nameEn} onChange={e => setFormData({...formData, nameEn: e.target.value})} />
                </div>
              </div>
              <div>
                <Label>الوصف</Label>
                <Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows={2} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>نوع التطبيق</Label>
                  <Select value={formData.appType} onValueChange={v => setFormData({...formData, appType: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(appTypeLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>نوع الاستضافة</Label>
                  <Select value={formData.hostingType} onValueChange={v => setFormData({...formData, hostingType: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(hostingLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>الحالة</Label>
                  <Select value={formData.status} onValueChange={v => setFormData({...formData, status: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(statusLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>المورد</Label>
                  <Input value={formData.vendor} onChange={e => setFormData({...formData, vendor: e.target.value})} />
                </div>
                <div>
                  <Label>الإصدار</Label>
                  <Input value={formData.version} onChange={e => setFormData({...formData, version: e.target.value})} />
                </div>
                <div>
                  <Label>عدد المستخدمين</Label>
                  <Input type="number" value={formData.usersCount} onChange={e => setFormData({...formData, usersCount: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>الرابط</Label>
                  <Input value={formData.url} onChange={e => setFormData({...formData, url: e.target.value})} placeholder="https://" />
                </div>
                <div>
                  <Label>تكلفة الترخيص (ريال/سنة)</Label>
                  <Input type="number" value={formData.licenseCost} onChange={e => setFormData({...formData, licenseCost: e.target.value})} />
                </div>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
              <LoadingButton onClick={handleSubmit} className="btn-gold"
                loading={createMutation.isPending || updateMutation.isPending}
                loadingText={editingItem ? "جاري التحديث..." : "جاري الإضافة..."}>
                {editingItem ? "تحديث التطبيق" : "إضافة التطبيق"}
              </LoadingButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <ConfirmDialog {...dialogProps} />
    </DashboardLayout>
  );
}
