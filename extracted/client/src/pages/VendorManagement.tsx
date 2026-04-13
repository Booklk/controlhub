import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { queryClient, apiRequest, invalidateRelatedQueries } from '@/lib/queryClient';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingButton } from "@/components/LoadingButton";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { itDirectorNavGroups } from '@/lib/navigation';
import { getStatusBadge as getSharedStatusBadge, VENDOR_STATUS } from '@/lib/status-utils';
import {
  LayoutDashboard, Users,
  AlertTriangle, Plus, Building2, FileText, Star, Phone, Mail, Globe,
  Pencil, Trash2, CheckCircle,
  FileDown, FileSpreadsheet} from 'lucide-react';
import { useConfirmDialog, ConfirmDialog } from '@/components/ConfirmDialog';
import { exportToPDF, exportToExcel, formatStatus} from '@/lib/exports';
import { PageHeader, KpiCard } from "@/components/Quality";


// ==================== Zod Validation Schemas ====================
const vendorCreationSchema = z.object({
  name: z.string()
    .min(2, { message: 'اسم المورد مطلوب (2 أحرف على الأقل)' })
    .max(200, { message: 'اسم المورد يجب أن يكون 200 أحرف على الأكثر' }),
  nameAr: z.string()
    .optional()
    .default(''),
  contactPerson: z.string()
    .min(1, { message: 'اسم جهة الاتصال مطلوب' })
    .max(200, { message: 'اسم جهة الاتصال يجب أن يكون 200 أحرف على الأكثر' }),
  contactEmail: z.string()
    .email({ message: 'البريد الإلكتروني غير صحيح' }),
  contactPhone: z.string()
    .refine((val) => !val || /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/im.test(val), {
      message: 'رقم الهاتف غير صحيح'
    }),
  vendorType: z.string()
    .min(1, { message: 'نوع المورد مطلوب' }),
  category: z.string()
    .min(1, { message: 'الفئة مطلوبة' }),
  website: z.string()
    .optional()
    .refine((val) => !val || /^https?:\/\/.+/.test(val), {
      message: 'يجب أن يبدأ الموقع الإلكتروني بـ http:// أو https://'
    })
    .default(''),
  contractNumber: z.string()
    .optional()
    .default(''),
  contractValue: z.union([
    z.string().transform((val) => val === '' ? undefined : parseFloat(val)),
    z.number()
  ])
    .refine((val) => val === undefined || !isNaN(val as number), {
      message: 'قيمة العقد يجب أن تكون رقم صحيح'
    })
    .refine((val) => val === undefined || (val as number) > 0, {
      message: 'قيمة العقد يجب أن تكون رقم موجب'
    })
    .optional(),
  notes: z.string()
    .optional()
    .default('')
});

type VendorCreationFormData = z.infer<typeof vendorCreationSchema>;

interface Vendor {
  id: number;
  name: string;
  nameAr: string | null;
  vendorType: string;
  category: string | null;
  contactPerson: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  website: string | null;
  contractNumber: string | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  contractValue: string | null;
  status: string;
  rating: number | null;
  notes: string | null;
}

interface SLAAgreement {
  id: number;
  vendorId: number;
  title: string;
  serviceType: string;
  targetValue: string;
  targetUnit: string;
  currentValue: string | null;
  status: string;
  complianceStatus: string | null;
}

export default function VendorManagement() {
  const { toast } = useToast();
  const { confirm: confirmAction, dialogProps } = useConfirmDialog();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSLADialogOpen, setIsSLADialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");
  
  const form = useForm<VendorCreationFormData>({
    resolver: zodResolver(vendorCreationSchema),
    defaultValues: {
      name: "",
      nameAr: "",
      vendorType: "software",
      category: "it",
      contactPerson: "",
      contactEmail: "",
      contactPhone: "",
      website: "",
      contractNumber: "",
      contractValue: undefined,
      notes: ""
    },
    mode: 'onChange',
  });

  const [slaFormData, setSlaFormData] = useState({
    title: "",
    serviceType: "uptime",
    targetValue: "99.9",
    targetUnit: "percent",
    measurementPeriod: "monthly"
  });

  const { data: vendors = [], isLoading } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  const { data: slaAgreements = [] } = useQuery<SLAAgreement[]>({
    queryKey: ["/api/sla-agreements"],
  });

  const createVendorMutation = useMutation({
    mutationFn: async (data: VendorCreationFormData) => {
      const res = await apiRequest("POST", "/api/vendors", data);
      return res.json();
    },
    onSuccess: () => {
      invalidateRelatedQueries('/api/vendors');
      setIsAddDialogOpen(false);
      form.reset();
      toast({ title: "تم إضافة المورد بنجاح" });
    },
    onError: (error: Error) => {
      toast({ title: "خطأ في إضافة المورد", description: error.message, variant: "destructive" });
    }
  });

  const createSLAMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/sla-agreements", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sla-agreements"] });
      setIsSLADialogOpen(false);
      toast({ title: "تم إضافة اتفاقية SLA بنجاح" });
    },
    onError: (error: Error) => {
      toast({ title: "خطأ في إضافة الاتفاقية", description: error.message, variant: "destructive" });
    }
  });

  const updateVendorMutation = useMutation({
    mutationFn: async (data: VendorCreationFormData) => {
      const res = await apiRequest("PUT", `/api/vendors/${editingItem?.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      invalidateRelatedQueries('/api/vendors');
      setIsAddDialogOpen(false);
      setEditingItem(null);
      form.reset();
      toast({ title: "تم تحديث المورد بنجاح" });
    },
    onError: (error: Error) => {
      toast({ title: "خطأ في تحديث المورد", description: error.message, variant: "destructive" });
    }
  });

  const deleteVendorMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/vendors/${id}`);
      return res.json();
    },
    onSuccess: () => {
      invalidateRelatedQueries('/api/vendors');
      toast({ title: "تم حذف المورد بنجاح" });
    },
    onError: (error: Error) => {
      toast({ title: "خطأ في حذف المورد", description: error.message, variant: "destructive" });
    },
  });

  const handleEdit = (vendor: any) => {
    setEditingItem(vendor);
    form.reset({
      name: vendor.name || "",
      nameAr: vendor.nameAr || "",
      vendorType: vendor.vendorType || "software",
      category: vendor.category || "it",
      contactPerson: vendor.contactPerson || "",
      contactEmail: vendor.contactEmail || "",
      contactPhone: vendor.contactPhone || "",
      website: vendor.website || "",
      contractNumber: vendor.contractNumber || "",
      contractValue: vendor.contractValue ? Number(vendor.contractValue) : undefined,
      notes: vendor.notes || "",
    });
    setIsAddDialogOpen(true);
  };

  const onSubmit = (data: VendorCreationFormData) => {
    if (editingItem) {
      updateVendorMutation.mutate(data);
    } else {
      createVendorMutation.mutate(data);
    }
  };

  const handleDialogOpenChange = (open: boolean) => {
    setIsAddDialogOpen(open);
    if (!open) {
      setEditingItem(null);
      form.reset();
    }
  };

  const vendorTypeLabels: Record<string, string> = {
    software: "برمجيات",
    hardware: "أجهزة",
    service: "خدمات",
    cloud: "سحابي",
    consulting: "استشارات"
  };

  const statusLabels: Record<string, string> = {
    active: "نشط",
    inactive: "غير نشط",
    pending: "قيد المراجعة",
    suspended: "معلق"
  };

  const getVendorStatusBadge = (status: string) => getSharedStatusBadge(status, VENDOR_STATUS);

  const filteredVendors = vendors.filter(v => 
    filterStatus === "all" || v.status === filterStatus
  );

  const stats = {
    total: vendors.length,
    active: vendors.filter(v => v.status === "active").length,
    pending: vendors.filter(v => v.status === "pending").length,
    totalSLAs: slaAgreements.length,
    breachedSLAs: slaAgreements.filter(s => s.complianceStatus === "breached").length
  };

  const getVendorSLAs = (vendorId: number) => {
    return slaAgreements.filter(s => s.vendorId === vendorId);
  };

  const getSLACompliance = (vendorId: number) => {
    const vendorSLAs = getVendorSLAs(vendorId);
    if (vendorSLAs.length === 0) return null;
    const compliant = vendorSLAs.filter(s => s.complianceStatus === "compliant").length;
    return Math.round((compliant / vendorSLAs.length) * 100);
  };

  if (isLoading) {
    return (
      <DashboardLayout title="إدارة الموردين" portalName="it_director" navGroups={itDirectorNavGroups}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
        </div>
      </DashboardLayout>
    );
  }


  const handleExportPDF = () => {
    exportToPDF({
      title: 'تقرير الموردين',
      subtitle: 'JCSA - Control Hub',
      columns: [{"header":"المورد","key":"name","width":40},{"header":"النوع","key":"type","width":25},{"header":"جهة الاتصال","key":"contact","width":30},{"header":"الحالة","key":"status","width":20}],
      data: (vendors || []).map((item: any) => ({ name: item.name || '', type: item.type || '', contact: item.contactPerson || item.contact || '', status: formatStatus(item.status || '') })),
      filename: 'vendors-report',
      orientation: 'landscape',
    });
  };

  const handleExportExcel = () => {
    exportToExcel({
      title: 'تقرير الموردين',
      columns: [{"header":"المورد","key":"name","width":40},{"header":"النوع","key":"type","width":25},{"header":"جهة الاتصال","key":"contact","width":30},{"header":"الحالة","key":"status","width":20}],
      data: (vendors || []).map((item: any) => ({ name: item.name || '', type: item.type || '', contact: item.contactPerson || item.contact || '', status: formatStatus(item.status || '') })),
      filename: 'vendors-report',
    });
  };

  return (
    <DashboardLayout title="إدارة الموردين" portalName="it_director" navGroups={itDirectorNavGroups}>
      <div className="space-y-5">
        <PageHeader
          icon={Building2}
          title="إدارة الموردين و SLA"
          subtitle="إدارة الموردين واتفاقيات مستوى الخدمة"
          actions={
            <>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportPDF} data-testid="button-export-pdf"><FileDown className="w-3.5 h-3.5" />PDF</Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportExcel} data-testid="button-export-excel"><FileSpreadsheet className="w-3.5 h-3.5" />Excel</Button>
              <Button className="btn-gold h-9 gap-1.5 text-xs" onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-vendor"><Plus className="w-3.5 h-3.5" />إضافة مورد جديد</Button>
            </>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KpiCard
            label="إجمالي الموردين"
            value={stats.total}
            icon={Building2}
            color="navy"
            sublabel="جميع الموردين المسجلين"
            active={filterStatus === "all"}
            onClick={() => setFilterStatus("all")}
            data-testid="kpi-total-vendors"
          />
          <KpiCard
            label="موردين نشطين"
            value={stats.active}
            icon={CheckCircle}
            color="success"
            sublabel="علاقات تجارية فعالة"
            active={filterStatus === "active"}
            onClick={() => setFilterStatus(filterStatus === "active" ? "all" : "active")}
            data-testid="kpi-active-vendors"
          />
          <KpiCard
            label="اتفاقيات SLA"
            value={stats.totalSLAs}
            icon={FileText}
            color="gold"
            sublabel={stats.breachedSLAs > 0 ? `${stats.breachedSLAs} اتفاقيات مخترقة` : "جميع الاتفاقيات ملتزمة"}
            data-testid="kpi-total-slas"
          />
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingItem ? "تعديل المورد" : "إضافة مورد جديد"}</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                <DialogBody className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>اسم المورد (إنجليزي) *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Microsoft"
                              {...field}
                              data-testid="input-vendor-name"
                              className={form.formState.errors.name ? 'border-destructive' : ''}
                            />
                          </FormControl>
                          <FormMessage data-testid="error-vendor-name" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="nameAr"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>اسم المورد (عربي)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="مايكروسوفت"
                              {...field}
                              data-testid="input-vendor-name-ar"
                            />
                          </FormControl>
                          <FormMessage data-testid="error-vendor-name-ar" />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="vendorType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>نوع المورد *</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger data-testid="select-vendor-type" className={form.formState.errors.vendorType ? 'border-destructive' : ''}>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="software">برمجيات</SelectItem>
                              <SelectItem value="hardware">أجهزة</SelectItem>
                              <SelectItem value="service">خدمات</SelectItem>
                              <SelectItem value="cloud">سحابي</SelectItem>
                              <SelectItem value="consulting">استشارات</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage data-testid="error-vendor-type" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>الفئة *</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger data-testid="select-vendor-category" className={form.formState.errors.category ? 'border-destructive' : ''}>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="it">تقنية المعلومات</SelectItem>
                              <SelectItem value="security">أمن</SelectItem>
                              <SelectItem value="infrastructure">بنية تحتية</SelectItem>
                              <SelectItem value="business">أعمال</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage data-testid="error-vendor-category" />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="contactPerson"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>مسؤول التواصل *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="الاسم"
                              {...field}
                              data-testid="input-contact-person"
                              className={form.formState.errors.contactPerson ? 'border-destructive' : ''}
                            />
                          </FormControl>
                          <FormMessage data-testid="error-contact-person" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="contactEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>البريد الإلكتروني *</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="contact@vendor.com"
                              {...field}
                              data-testid="input-contact-email"
                              className={form.formState.errors.contactEmail ? 'border-destructive' : ''}
                            />
                          </FormControl>
                          <FormMessage data-testid="error-contact-email" />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="contactPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>رقم الهاتف *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="+966500000000"
                              {...field}
                              data-testid="input-contact-phone"
                              className={form.formState.errors.contactPhone ? 'border-destructive' : ''}
                            />
                          </FormControl>
                          <FormMessage data-testid="error-contact-phone" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="website"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>الموقع الإلكتروني</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="https://..."
                              {...field}
                              data-testid="input-website"
                              className={form.formState.errors.website ? 'border-destructive' : ''}
                            />
                          </FormControl>
                          <FormMessage data-testid="error-website" />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="contractNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>رقم العقد</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="CONTRACT-2024-001"
                              {...field}
                              data-testid="input-contract-number"
                            />
                          </FormControl>
                          <FormMessage data-testid="error-contract-number" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="contractValue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>قيمة العقد</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="100000"
                              {...field}
                              onChange={(e) => field.onChange(e.target.value === '' ? undefined : e.target.value)}
                              data-testid="input-contract-value"
                              className={form.formState.errors.contractValue ? 'border-destructive' : ''}
                            />
                          </FormControl>
                          <FormMessage data-testid="error-contract-value" />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ملاحظات</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="ملاحظات إضافية..."
                            {...field}
                            data-testid="input-notes"
                          />
                        </FormControl>
                        <FormMessage data-testid="error-notes" />
                      </FormItem>
                    )}
                  />
                </DialogBody>

                  <DialogFooter className="gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleDialogOpenChange(false)}
                      data-testid="button-cancel-vendor"
                    >
                      إلغاء
                    </Button>
                    <LoadingButton
                      type="submit"
                      disabled={!form.formState.isValid}
                      loading={createVendorMutation.isPending || updateVendorMutation.isPending}
                      loadingText="جاري الحفظ..."
                      className="btn-gold"
                      data-testid="button-submit-vendor"
                    >
                      {editingItem ? "تحديث المورد" : "إضافة المورد"}
                    </LoadingButton>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="card-premium">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">إجمالي الموردين</p>
                  <p className="text-2xl font-bold hub-stat-gold">{stats.total}</p>
                </div>
                <Building2 className="w-8 h-8 hub-stat-gold" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="card-premium">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">نشط</p>
                  <p className="text-2xl font-bold text-emerald-600">{stats.active}</p>
                </div>
                <Users className="w-8 h-8 hub-stat-gold" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="card-premium">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">قيد المراجعة</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="card-premium">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">اتفاقيات SLA</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.totalSLAs}</p>
                </div>
                <FileText className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="card-premium">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">خروقات SLA</p>
                  <p className="text-2xl font-bold text-foreground">{stats.breachedSLAs}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-48" data-testid="select-filter-status">
              <SelectValue placeholder="تصفية حسب الحالة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الموردين</SelectItem>
              <SelectItem value="active">نشط</SelectItem>
              <SelectItem value="inactive">غير نشط</SelectItem>
              <SelectItem value="pending">قيد المراجعة</SelectItem>
              <SelectItem value="suspended">معلق</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVendors.map((vendor) => {
            const compliance = getSLACompliance(vendor.id);
            const vendorSLAs = getVendorSLAs(vendor.id);
            return (
              <Card key={vendor.id} className="card-premium hover-elevate" data-testid={`card-vendor-${vendor.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{vendor.nameAr || vendor.name}</CardTitle>
                    {getVendorStatusBadge(vendor.status)}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline">{vendorTypeLabels[vendor.vendorType] || vendor.vendorType}</Badge>
                    {vendor.rating && (
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        <span className="text-sm">{vendor.rating}/5</span>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {vendor.contactPerson && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Users className="w-4 h-4" />
                        <span>{vendor.contactPerson}</span>
                      </div>
                    )}
                    {vendor.contactEmail && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Mail className="w-4 h-4" />
                        <span>{vendor.contactEmail}</span>
                      </div>
                    )}
                    {vendor.contactPhone && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Phone className="w-4 h-4" />
                        <span dir="ltr">{vendor.contactPhone}</span>
                      </div>
                    )}
                    {vendor.website && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Globe className="w-4 h-4" />
                        <a href={vendor.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          الموقع الإلكتروني
                        </a>
                      </div>
                    )}
                    
                    {compliance !== null && (
                      <div className="mt-4 pt-3 border-t">
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="text-gray-600 dark:text-gray-400">التزام SLA</span>
                          <span className="font-bold">{compliance}%</span>
                        </div>
                        <Progress value={compliance} className="h-2" />
                        <p className="text-xs text-gray-500 mt-1">{vendorSLAs.length} اتفاقيات</p>
                      </div>
                    )}
                    
                    <div className="flex gap-2 mt-4">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          setSelectedVendor(vendor);
                          setIsSLADialogOpen(true);
                        }}
                        data-testid={`button-add-sla-${vendor.id}`}
                      >
                        <Plus className="w-4 h-4 ml-1" />
                        إضافة SLA
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleEdit(vendor)}
                        data-testid={`button-edit-vendor-${vendor.id}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => confirmAction(
                          () => deleteVendorMutation.mutate(vendor.id),
                          { title: "حذف المورد", description: `هل أنت متأكد من حذف المورد "${vendor.nameAr || vendor.name}"؟` }
                        )}
                        data-testid={`button-delete-vendor-${vendor.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filteredVendors.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>لا يوجد موردين حالياً</p>
            <p className="text-sm mt-2">اضغط على "إضافة مورد جديد" للبدء</p>
          </div>
        )}

        <ConfirmDialog {...dialogProps} />

        <Dialog open={isSLADialogOpen} onOpenChange={setIsSLADialogOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>إضافة اتفاقية SLA - {selectedVendor?.nameAr || selectedVendor?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>عنوان الاتفاقية</Label>
                <Input 
                  value={slaFormData.title}
                  onChange={(e) => setSlaFormData({...slaFormData, title: e.target.value})}
                  placeholder="نسبة التشغيل الشهرية"
                  data-testid="input-sla-title"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>نوع الخدمة</Label>
                  <Select value={slaFormData.serviceType} onValueChange={(v) => setSlaFormData({...slaFormData, serviceType: v})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="uptime">نسبة التشغيل</SelectItem>
                      <SelectItem value="response_time">وقت الاستجابة</SelectItem>
                      <SelectItem value="resolution_time">وقت الحل</SelectItem>
                      <SelectItem value="support">الدعم الفني</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>فترة القياس</Label>
                  <Select value={slaFormData.measurementPeriod} onValueChange={(v) => setSlaFormData({...slaFormData, measurementPeriod: v})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">يومي</SelectItem>
                      <SelectItem value="weekly">أسبوعي</SelectItem>
                      <SelectItem value="monthly">شهري</SelectItem>
                      <SelectItem value="quarterly">ربع سنوي</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>القيمة المستهدفة</Label>
                  <Input 
                    type="number"
                    value={slaFormData.targetValue}
                    onChange={(e) => setSlaFormData({...slaFormData, targetValue: e.target.value})}
                    data-testid="input-sla-target"
                  />
                </div>
                <div className="space-y-2">
                  <Label>وحدة القياس</Label>
                  <Select value={slaFormData.targetUnit} onValueChange={(v) => setSlaFormData({...slaFormData, targetUnit: v})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">نسبة مئوية %</SelectItem>
                      <SelectItem value="hours">ساعات</SelectItem>
                      <SelectItem value="minutes">دقائق</SelectItem>
                      <SelectItem value="days">أيام</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <LoadingButton
                className="w-full btn-gold"
                onClick={() => createSLAMutation.mutate({
                  ...slaFormData,
                  vendorId: selectedVendor?.id
                })}
                disabled={!slaFormData.title}
                loading={createSLAMutation.isPending}
                loadingText="جاري الإضافة..."
              >
                إضافة الاتفاقية
              </LoadingButton>
            </div>
          </DialogContent>
        </Dialog>
    </DashboardLayout>
  );
}
