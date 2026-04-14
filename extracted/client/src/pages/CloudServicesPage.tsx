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
import { Plus, Pencil, Trash2, Cloud, Server, Database, DollarSign, FileDown, FileSpreadsheet } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { digitalTransformationNavGroups } from "@/lib/navigation";
import { exportToPDF, exportToExcel, formatStatus} from '@/lib/exports';
import { useConfirmDialog, ConfirmDialog } from '@/components/ConfirmDialog';
import { PageHeader, KpiCard } from "@/components/Quality";
import { LoadingButton } from "@/components/LoadingButton";

const providerLabels: Record<string, string> = {
  aws: "Amazon AWS",
  azure: "Microsoft Azure",
  gcp: "Google Cloud",
  alibaba: "Alibaba Cloud",
  oracle: "Oracle Cloud",
  other: "أخرى"
};

const serviceTypeLabels: Record<string, string> = {
  iaas: "البنية التحتية (IaaS)",
  paas: "المنصة (PaaS)",
  saas: "البرمجيات (SaaS)",
  faas: "الوظائف (FaaS)",
  storage: "التخزين",
  database: "قاعدة البيانات",
  ai_ml: "الذكاء الاصطناعي"
};

const statusLabels: Record<string, string> = {
  active: "نشط",
  inactive: "غير نشط",
  provisioning: "جاري التفعيل",
  suspended: "موقوف"
};

export default function CloudServicesPage() {
  const { toast } = useToast();
  const { confirm: confirmAction, dialogProps } = useConfirmDialog();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState({
    nameAr: "", nameEn: "", description: "", provider: "aws",
    serviceType: "saas", region: "", accountId: "",
    subscriptionType: "", monthlyCost: "", annualCost: "",
    dataClassification: "internal", complianceStatus: "compliant",
    contractStartDate: "", contractEndDate: "", autoRenew: false,
    status: "active", slaUptime: ""
  });

  const { data: services = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/cloud-services"] });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/cloud-services", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cloud-services"] });
      invalidateRelatedQueries('/api/cloud-services');
      setIsDialogOpen(false);
      resetFormData();
      toast({ title: "تم إضافة الخدمة السحابية بنجاح" });
    },
    onError: (error: Error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PUT", `/api/cloud-services/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cloud-services"] });
      invalidateRelatedQueries('/api/cloud-services');
      setIsDialogOpen(false);
      setEditingItem(null);
      resetFormData();
      toast({ title: "تم تحديث الخدمة السحابية" });
    },
    onError: (error: Error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/cloud-services/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cloud-services"] });
      invalidateRelatedQueries('/api/cloud-services');
      toast({ title: "تم حذف الخدمة السحابية" });
    },
    onError: (error: Error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    }
  });

  const resetFormData = () => {
    setFormData({
      nameAr: "", nameEn: "", description: "", provider: "aws",
      serviceType: "saas", region: "", accountId: "",
      subscriptionType: "", monthlyCost: "", annualCost: "",
      dataClassification: "internal", complianceStatus: "compliant",
      contractStartDate: "", contractEndDate: "", autoRenew: false,
      status: "active", slaUptime: ""
    });
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setFormData({
      nameAr: item.nameAr || "", nameEn: item.nameEn || "",
      description: item.description || "", provider: item.provider || "aws",
      serviceType: item.serviceType || "saas", region: item.region || "",
      accountId: item.accountId || "", subscriptionType: item.subscriptionType || "",
      monthlyCost: item.monthlyCost?.toString() || "",
      annualCost: item.annualCost?.toString() || "",
      dataClassification: item.dataClassification || "internal",
      complianceStatus: item.complianceStatus || "compliant",
      contractStartDate: item.contractStartDate ? new Date(item.contractStartDate).toISOString().split('T')[0] : "",
      contractEndDate: item.contractEndDate ? new Date(item.contractEndDate).toISOString().split('T')[0] : "",
      autoRenew: item.autoRenew || false,
      status: item.status || "active",
      slaUptime: item.slaUptime?.toString() || ""
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.nameAr.trim() && !formData.nameEn.trim()) {
      toast({ title: "تنبيه", description: "يرجى إدخال اسم الخدمة السحابية", variant: "destructive" });
      return;
    }
    const data = {
      ...formData,
      monthlyCost: formData.monthlyCost ? parseFloat(formData.monthlyCost) : null,
      annualCost: formData.annualCost ? parseFloat(formData.annualCost) : null,
      slaUptime: formData.slaUptime ? parseFloat(formData.slaUptime) : null,
      contractStartDate: formData.contractStartDate || null,
      contractEndDate: formData.contractEndDate || null
    };
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const totalMonthlyCost = services.reduce((sum: number, s: any) => sum + (parseFloat(s.monthlyCost) || 0), 0);
  const totalAnnualCost = services.reduce((sum: number, s: any) => sum + (parseFloat(s.annualCost) || 0), 0);


  const handleExportPDF = () => {
    if (!services || services.length === 0) {
      toast({ title: "لا توجد بيانات للتصدير", variant: "destructive" });
      return;
    }
    exportToPDF({
      title: 'تقرير الخدمات السحابية',
      subtitle: 'JCSA - Control Hub',
      columns: [{"header":"الخدمة","key":"name","width":35},{"header":"المزود","key":"provider","width":25},{"header":"النوع","key":"type","width":25},{"header":"الحالة","key":"status","width":20}],
      data: (services || []).map((item: any) => ({ name: item.nameAr || item.name || '', provider: item.provider || '', type: item.serviceType || item.type || '', status: formatStatus(item.status || '') })),
      filename: 'cloud-services-report',
      orientation: 'landscape',
    });
  };

  const handleExportExcel = () => {
    if (!services || services.length === 0) {
      toast({ title: "لا توجد بيانات للتصدير", variant: "destructive" });
      return;
    }
    exportToExcel({
      title: 'تقرير الخدمات السحابية',
      columns: [{"header":"الخدمة","key":"name","width":35},{"header":"المزود","key":"provider","width":25},{"header":"النوع","key":"type","width":25},{"header":"الحالة","key":"status","width":20}],
      data: (services || []).map((item: any) => ({ name: item.nameAr || item.name || '', provider: item.provider || '', type: item.serviceType || item.type || '', status: formatStatus(item.status || '') })),
      filename: 'cloud-services-report',
    });
  };

  return (
    <DashboardLayout
      title="الخدمات السحابية"
      subtitle="إدارة الاشتراكات والخدمات السحابية"
      navGroups={digitalTransformationNavGroups}
      portalName="التحول الرقمي"
    >
      <div className="space-y-5">
        <PageHeader
          icon={Cloud}
          title="الخدمات السحابية"
          subtitle="إدارة الاشتراكات والخدمات السحابية"
          actions={
            <>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportPDF} data-testid="button-export-pdf"><FileDown className="w-3.5 h-3.5" />PDF</Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportExcel} data-testid="button-export-excel"><FileSpreadsheet className="w-3.5 h-3.5" />Excel</Button>
              <Button onClick={() => { setEditingItem(null); setFormData({ nameAr: "", nameEn: "", description: "", provider: "aws", serviceType: "saas", region: "", accountId: "", subscriptionType: "", monthlyCost: "", annualCost: "", dataClassification: "internal", complianceStatus: "compliant", contractStartDate: "", contractEndDate: "", autoRenew: false, status: "active", slaUptime: "" }); setIsDialogOpen(true); }} className="btn-gold h-9 gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" />
                إضافة خدمة
              </Button>
            </>
          }
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="إجمالي الخدمات" value={services.length} icon={Cloud} color="navy" />
          <KpiCard label="نشطة" value={services.filter((s: any) => s.status === 'active').length} icon={Server} color="success" />
          <KpiCard label="التكلفة الشهرية" value={`${totalMonthlyCost.toLocaleString()} ر`} icon={DollarSign} color="gold" />
          <KpiCard label="التكلفة السنوية" value={`${totalAnnualCost.toLocaleString()} ر`} icon={Database} color="info" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>سجل الخدمات السحابية</CardTitle>
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
            ) : services.length === 0 ? (
              <div className="text-center py-12">
                <Cloud className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
                <p className="text-muted-foreground font-medium">لا توجد خدمات سحابية</p>
                <p className="text-sm text-muted-foreground/60 mt-1">اضغط على "إضافة خدمة" لإضافة أول خدمة</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الكود</TableHead>
                    <TableHead>الخدمة</TableHead>
                    <TableHead>المزود</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>التكلفة الشهرية</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services.map((service: any) => (
                    <TableRow key={service.id}>
                      <TableCell className="font-mono text-sm">{service.serviceCode}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{service.nameAr}</div>
                          {service.nameEn && <div className="text-sm text-muted-foreground">{service.nameEn}</div>}
                        </div>
                      </TableCell>
                      <TableCell>{providerLabels[service.provider] || service.provider}</TableCell>
                      <TableCell>{serviceTypeLabels[service.serviceType] || service.serviceType}</TableCell>
                      <TableCell>{service.monthlyCost ? `${parseFloat(service.monthlyCost).toLocaleString()} ريال` : "-"}</TableCell>
                      <TableCell>
                        <Badge variant={service.status === 'active' ? 'default' : 'secondary'}>
                          {statusLabels[service.status] || service.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="icon" variant="ghost" onClick={() => handleEdit(service)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-red-600" onClick={() => confirmAction(() => deleteMutation.mutate(service.id), { title: 'تأكيد الحذف', description: 'هل أنت متأكد من حذف هذه الخدمة السحابية؟ لا يمكن التراجع عن هذا الإجراء.' })}>
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

        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) { setEditingItem(null); resetFormData(); } }}>
          <DialogContent className="sm:max-w-2xl" dir="rtl">
            <DialogHeader>
              <DialogTitle>{editingItem ? "تعديل الخدمة" : "إضافة خدمة سحابية"}</DialogTitle>
            </DialogHeader>
            <DialogBody className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>اسم الخدمة (عربي) *</Label>
                  <Input value={formData.nameAr} onChange={e => setFormData({...formData, nameAr: e.target.value})} />
                </div>
                <div>
                  <Label>اسم الخدمة (إنجليزي)</Label>
                  <Input value={formData.nameEn} onChange={e => setFormData({...formData, nameEn: e.target.value})} />
                </div>
              </div>
              <div>
                <Label>الوصف</Label>
                <Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows={2} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>مزود الخدمة</Label>
                  <Select value={formData.provider} onValueChange={v => setFormData({...formData, provider: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(providerLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>نوع الخدمة</Label>
                  <Select value={formData.serviceType} onValueChange={v => setFormData({...formData, serviceType: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(serviceTypeLabels).map(([k, v]) => (
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
                  <Label>المنطقة</Label>
                  <Input value={formData.region} onChange={e => setFormData({...formData, region: e.target.value})} placeholder="me-south-1" />
                </div>
                <div>
                  <Label>التكلفة الشهرية (ريال)</Label>
                  <Input type="number" value={formData.monthlyCost} onChange={e => setFormData({...formData, monthlyCost: e.target.value})} />
                </div>
                <div>
                  <Label>التكلفة السنوية (ريال)</Label>
                  <Input type="number" value={formData.annualCost} onChange={e => setFormData({...formData, annualCost: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>تاريخ بدء العقد</Label>
                  <Input type="date" value={formData.contractStartDate} onChange={e => setFormData({...formData, contractStartDate: e.target.value})} />
                </div>
                <div>
                  <Label>تاريخ انتهاء العقد</Label>
                  <Input type="date" value={formData.contractEndDate} onChange={e => setFormData({...formData, contractEndDate: e.target.value})} />
                </div>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
              <LoadingButton onClick={handleSubmit} className="btn-gold"
                loading={createMutation.isPending || updateMutation.isPending}
                loadingText={editingItem ? "جاري التحديث..." : "جاري الإضافة..."}>
                {editingItem ? "تحديث الخدمة" : "إضافة الخدمة"}
              </LoadingButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <ConfirmDialog {...dialogProps} />
    </DashboardLayout>
  );
}
