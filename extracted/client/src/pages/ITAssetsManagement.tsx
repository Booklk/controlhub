import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useConfirmDialog, ConfirmDialog } from '@/components/ConfirmDialog';
import { queryClient, apiRequest, invalidateRelatedQueries } from "@/lib/queryClient";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import DashboardLayout from "@/components/DashboardLayout";
import { itDirectorNavGroups } from "@/lib/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogBody } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { DataClassificationBadge, DataClassificationSelect } from "@/components/DataClassificationBadge";
import { Breadcrumb } from "@/components/Breadcrumb";
import { 
  Server, Plus, Search, Filter, Edit2, Trash2, 
  Building2, Shield, HardDrive, Network, Cloud, 
  Monitor, MapPin, AlertTriangle, AlertCircle, CheckCircle,
  FileDown, FileSpreadsheet
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { ITAsset, DataClassification } from "@shared/schema";
import { exportToPDF, exportToExcel, formatStatus} from '@/lib/exports';
import { PageHeader, KpiCard } from "@/components/Quality";

// Zod Validation Schema with Arabic Error Messages
const itAssetValidationSchema = z.object({
  assetCode: z.string()
    .min(1, "رقم الأصل مطلوب")
    .regex(/^[a-zA-Z0-9-_]+$/, "رقم الأصل غير صحيح"),
  nameAr: z.string()
    .min(2, "اسم الأصل مطلوب (2 أحرف على الأقل)")
    .max(200, "اسم الأصل يجب أن لا يتجاوز 200 حرف"),
  nameEn: z.string()
    .max(200, "الاسم الإنجليزي يجب أن لا يتجاوز 200 حرف")
    .optional()
    .or(z.literal("")),
  description: z.string()
    .optional()
    .or(z.literal("")),
  assetType: z.enum(["server", "network", "storage", "software", "hardware", "security", "cloud", "other"], {
    errorMap: () => ({ message: "نوع الأصل مطلوب" })
  }),
  dataClassification: z.enum(["top_secret", "confidential", "restricted", "public"], {
    errorMap: () => ({ message: "تصنيف البيانات مطلوب" })
  }).optional().default("public"),
  manufacturer: z.string()
    .max(100, "اسم الشركة المصنعة يجب أن لا يتجاوز 100 حرف")
    .optional()
    .or(z.literal("")),
  model: z.string()
    .max(100, "الموديل يجب أن لا يتجاوز 100 حرف")
    .optional()
    .or(z.literal("")),
  serialNumber: z.string()
    .max(100, "الرقم التسلسلي يجب أن لا يتجاوز 100 حرف")
    .optional()
    .or(z.literal("")),
  purchaseDate: z.string()
    .optional()
    .or(z.literal(""))
    .refine(
      (date) => !date || !isNaN(new Date(date).getTime()),
      "تاريخ الشراء يجب أن يكون تاريخاً صحيحاً"
    ),
  value: z.string()
    .optional()
    .or(z.literal(""))
    .refine(
      (value) => !value || (parseFloat(value) > 0 && !isNaN(parseFloat(value))),
      "تكلفة الشراء يجب أن تكون رقم موجب"
    ),
  location: z.string()
    .max(200, "الموقع يجب أن لا يتجاوز 200 حرف")
    .optional()
    .or(z.literal("")),
  status: z.enum(["active", "maintenance", "retired", "pending_assignment"], {
    errorMap: () => ({ message: "حالة الأصل مطلوبة" })
  }),
  criticality: z.enum(["critical", "high", "medium", "low"], {
    errorMap: () => ({ message: "مستوى الأهمية مطلوب" })
  }).optional().default("medium"),
  assignedDepartmentId: z.string()
    .optional()
    .or(z.literal("")),
  ipAddress: z.string()
    .max(45, "عنوان IP يجب أن لا يتجاوز 45 حرف")
    .optional()
    .or(z.literal(""))
    .refine(
      (ip) => !ip || /^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip),
      "عنوان IP غير صحيح"
    ),
});

type ITAssetFormData = z.infer<typeof itAssetValidationSchema>;

const assetTypeIcons: Record<string, typeof Server> = {
  server: Server,
  network: Network,
  storage: HardDrive,
  software: Monitor,
  hardware: Monitor,
  security: Shield,
  cloud: Cloud,
  other: Server
};

const assetTypeLabels: Record<string, string> = {
  server: "خادم",
  network: "شبكات",
  storage: "تخزين",
  software: "برمجيات",
  hardware: "أجهزة",
  security: "أمني",
  cloud: "سحابي",
  other: "أخرى"
};

const statusLabels: Record<string, { label: string; color: string }> = {
  active: { label: "نشط", color: "hub-badge-gold hub-stat-gold border-[hsl(43_74%_49%)]/50" },
  maintenance: { label: "صيانة", color: "hub-badge-gold hub-stat-gold border-[hsl(43_74%_49%)]/50" },
  retired: { label: "متقاعد", color: "bg-[hsl(222_47%_11%)]/10 text-muted-foreground border-[hsl(222_47%_11%)]/30" },
  pending_assignment: { label: "في انتظار التعيين", color: "bg-[hsl(222_47%_11%)]/20 text-muted-foreground border-[hsl(222_47%_11%)]/50" }
};

const criticalityLabels: Record<string, { label: string; color: string }> = {
  critical: { label: "حرج", color: "bg-[hsl(222_47%_11%)]/20 text-muted-foreground" },
  high: { label: "عالي", color: "bg-[hsl(43_74%_49%)] text-muted-foreground" },
  medium: { label: "متوسط", color: "hub-badge-gold hub-stat-gold" },
  low: { label: "منخفض", color: "bg-[hsl(222_47%_11%)]/10 text-muted-foreground" }
};


export default function ITAssetsManagement() {
  const { toast } = useToast();
  const { confirm: confirmAction, dialogProps } = useConfirmDialog();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterClassification, setFilterClassification] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<ITAsset | null>(null);

  const { data: assets = [], isLoading } = useQuery<ITAsset[]>({
    queryKey: ["/api/it-assets"],
  });

  const { data: departments = [] } = useQuery<any[]>({
    queryKey: ["/api/it-departments"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<ITAsset>) => {
      const res = await apiRequest("POST", "/api/it-assets", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/it-assets"] });
      invalidateRelatedQueries('/api/it-assets');
      toast({ title: "تم إنشاء الأصل بنجاح" });
      setIsAddDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "خطأ في إنشاء الأصل", description: error.message, variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<ITAsset> }) => {
      const res = await apiRequest("PUT", `/api/it-assets/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/it-assets"] });
      invalidateRelatedQueries('/api/it-assets');
      toast({ title: "تم تحديث الأصل بنجاح" });
      setEditingAsset(null);
    },
    onError: (error: Error) => {
      toast({ title: "خطأ في تحديث الأصل", description: error.message, variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/it-assets/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/it-assets"] });
      invalidateRelatedQueries('/api/it-assets');
      toast({ title: "تم حذف الأصل بنجاح" });
    },
    onError: (error: Error) => {
      toast({ title: "خطأ في حذف الأصل", description: error.message, variant: "destructive" });
    }
  });

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.nameAr?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         asset.assetCode?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || asset.assetType === filterType;
    const matchesClassification = filterClassification === "all" || asset.dataClassification === filterClassification;
    const matchesStatus =
      filterStatus === "all" ? true :
      filterStatus === "active" ? asset.status === "active" :
      filterStatus === "critical" ? asset.criticality === "critical" :
      filterStatus === "unassigned" ? !asset.assignedDepartmentId :
      true;
    return matchesSearch && matchesType && matchesClassification && matchesStatus;
  });

  const stats = {
    total: assets.length,
    active: assets.filter(a => a.status === "active").length,
    critical: assets.filter(a => a.criticality === "critical").length,
    unassigned: assets.filter(a => !a.assignedDepartmentId).length
  };


  const handleExportPDF = () => {
    exportToPDF({
      title: 'تقرير الأصول التقنية',
      subtitle: 'JCSA - Control Hub',
      columns: [{"header":"الأصل","key":"name","width":35},{"header":"النوع","key":"type","width":25},{"header":"الرقم التسلسلي","key":"serialNumber","width":25},{"header":"الموقع","key":"location","width":25},{"header":"الحالة","key":"status","width":20}],
      data: (assets || []).map((item: any) => ({ name: item.name || '', type: item.type || item.assetType || '', serialNumber: item.serialNumber || '', location: item.location || '', status: formatStatus(item.status || '') })),
      filename: 'it-assets-report',
      orientation: 'landscape',
    });
  };

  const handleExportExcel = () => {
    exportToExcel({
      title: 'تقرير الأصول التقنية',
      columns: [{"header":"الأصل","key":"name","width":35},{"header":"النوع","key":"type","width":25},{"header":"الرقم التسلسلي","key":"serialNumber","width":25},{"header":"الموقع","key":"location","width":25},{"header":"الحالة","key":"status","width":20}],
      data: (assets || []).map((item: any) => ({ name: item.name || '', type: item.type || item.assetType || '', serialNumber: item.serialNumber || '', location: item.location || '', status: formatStatus(item.status || '') })),
      filename: 'it-assets-report',
    });
  };

  return (
    <DashboardLayout 
      title="الأصول التقنية" 
      portalName="it_director"
      navGroups={itDirectorNavGroups}
    >
      <div className="space-y-5">
        <PageHeader
          icon={HardDrive}
          title="إدارة أصول تقنية المعلومات"
          subtitle="إدارة وتعيين الأصول للإدارات المختلفة"
          actions={
            <>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportPDF} data-testid="button-export-pdf"><FileDown className="w-3.5 h-3.5" />PDF</Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportExcel} data-testid="button-export-excel"><FileSpreadsheet className="w-3.5 h-3.5" />Excel</Button>
              <Button className="btn-gold h-9 gap-1.5 text-xs" onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-asset"><Plus className="w-3.5 h-3.5" />إضافة أصل جديد</Button>
            </>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label="إجمالي الأصول"
            value={stats.total}
            icon={Server}
            color="navy"
            active={filterStatus === "all"}
            onClick={() => setFilterStatus("all")}
            sublabel="كل الأصول التقنية"
            data-testid="kpi-total-assets"
          />
          <KpiCard
            label="الأصول النشطة"
            value={stats.active}
            icon={CheckCircle}
            color="success"
            active={filterStatus === "active"}
            onClick={() => setFilterStatus(filterStatus === "active" ? "all" : "active")}
            sublabel="تعمل بشكل طبيعي"
            data-testid="kpi-active-assets"
          />
          <KpiCard
            label="أصول حرجة"
            value={stats.critical}
            icon={AlertTriangle}
            color={stats.critical > 0 ? "danger" : "muted"}
            active={filterStatus === "critical"}
            onClick={() => setFilterStatus(filterStatus === "critical" ? "all" : "critical")}
            sublabel="تحتاج إلى متابعة"
            data-testid="kpi-critical-assets"
          />
          <KpiCard
            label="غير معينة"
            value={stats.unassigned}
            icon={Building2}
            color="muted"
            active={filterStatus === "unassigned"}
            onClick={() => setFilterStatus(filterStatus === "unassigned" ? "all" : "unassigned")}
            sublabel="بانتظار التعيين لإدارة"
            data-testid="kpi-unassigned-assets"
          />
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
              <DialogHeader>
                <DialogTitle>إضافة أصل تقني جديد</DialogTitle>
              </DialogHeader>
              <DialogBody>
                <AssetForm 
                onSubmit={(data) => createMutation.mutate(data)}
                departments={departments}
                isLoading={createMutation.isPending}
              />
              </DialogBody>
            </DialogContent>
          </Dialog>

        <Card className="card-premium">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="w-5 h-5 hub-stat-gold" />
                قائمة الأصول
              </CardTitle>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="بحث..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pr-10 w-[200px]"
                    data-testid="input-search-assets"
                  />
                </div>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[150px]" data-testid="select-filter-type">
                    <Filter className="w-4 h-4 ml-2" />
                    <SelectValue placeholder="نوع الأصل" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الأنواع</SelectItem>
                    {Object.entries(assetTypeLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterClassification} onValueChange={setFilterClassification}>
                  <SelectTrigger className="w-[150px]" data-testid="select-filter-classification">
                    <Shield className="w-4 h-4 ml-2" />
                    <SelectValue placeholder="التصنيف" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع التصنيفات</SelectItem>
                    <SelectItem value="top_secret">سري للغاية</SelectItem>
                    <SelectItem value="confidential">سري</SelectItem>
                    <SelectItem value="restricted">مقيد</SelectItem>
                    <SelectItem value="public">عام</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="flex items-center gap-4 p-4 border border-border/30 rounded-lg">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-8 w-8 rounded" />
                  </div>
                ))}
              </div>
            ) : filteredAssets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                لا توجد أصول {searchTerm && "تطابق البحث"}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAssets.map((asset) => {
                  const TypeIcon = assetTypeIcons[asset.assetType || "other"];
                  const status = statusLabels[asset.status || "active"];
                  const criticality = criticalityLabels[asset.criticality || "medium"];
                  const dept = departments.find(d => d.id === asset.assignedDepartmentId);
                  
                  return (
                    <div 
                      key={asset.id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                      data-testid={`asset-item-${asset.id}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-lg hub-icon-gold">
                          <TypeIcon className="w-6 h-6 hub-stat-gold" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{asset.nameAr || asset.nameEn}</span>
                            <Badge variant="outline" className="text-xs">{asset.assetCode}</Badge>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                            <span>{assetTypeLabels[asset.assetType || "other"]}</span>
                            {asset.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {asset.location}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <DataClassificationBadge 
                          classification={asset.dataClassification as DataClassification || "public"} 
                          size="sm"
                        />
                        <Badge variant="outline" className={criticality.color}>
                          {criticality.label}
                        </Badge>
                        <Badge variant="outline" className={status.color}>
                          {status.label}
                        </Badge>
                        {dept ? (
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {dept.nameAr}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            غير معين
                          </Badge>
                        )}
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => setEditingAsset(asset)}
                            data-testid={`button-edit-asset-${asset.id}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => {
                              confirmAction(() => deleteMutation.mutate(asset.id), { title: 'تأكيد الحذف', description: 'هل أنت متأكد من حذف هذا الأصل؟ لا يمكن التراجع عن هذا الإجراء.' });
                            }}
                            data-testid={`button-delete-asset-${asset.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {editingAsset && (
          <Dialog open={!!editingAsset} onOpenChange={() => setEditingAsset(null)}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
              <DialogHeader>
                <DialogTitle>تعديل الأصل: {editingAsset.nameAr}</DialogTitle>
              </DialogHeader>
              <DialogBody>
                <AssetForm 
                  asset={editingAsset}
                  onSubmit={(data) => updateMutation.mutate({ id: editingAsset.id, data })}
                  departments={departments}
                  isLoading={updateMutation.isPending}
                />
              </DialogBody>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <ConfirmDialog {...dialogProps} />
    </DashboardLayout>
  );
}

function AssetForm({ 
  asset, 
  onSubmit, 
  departments,
  isLoading 
}: { 
  asset?: ITAsset; 
  onSubmit: (data: Partial<ITAsset>) => void;
  departments: any[];
  isLoading: boolean;
}) {
  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
    reset
  } = useForm<ITAssetFormData>({
    resolver: zodResolver(itAssetValidationSchema),
    defaultValues: {
      assetCode: asset?.assetCode || "",
      nameAr: asset?.nameAr || "",
      nameEn: asset?.nameEn || "",
      description: asset?.description || "",
      assetType: (asset?.assetType as any) || "hardware",
      dataClassification: (asset?.dataClassification || "public") as DataClassification,
      assignedDepartmentId: asset?.assignedDepartmentId?.toString() || "",
      manufacturer: asset?.manufacturer || "",
      model: asset?.model || "",
      serialNumber: asset?.serialNumber || "",
      location: asset?.location || "",
      status: (asset?.status as any) || "active",
      criticality: (asset?.criticality as any) || "medium",
      ipAddress: asset?.ipAddress || "",
      purchaseDate: asset?.purchaseDate ? new Date(asset.purchaseDate).toISOString().split('T')[0] : "",
      value: asset?.value?.toString() || "",
    }
  });

  const onSubmitForm = (data: ITAssetFormData & Record<string, any>) => {
    onSubmit({
      ...data,
      assignedDepartmentId: data.assignedDepartmentId && data.assignedDepartmentId !== "none" ? parseInt(data.assignedDepartmentId) : null,
      purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null,
      value: data.value ? parseFloat(data.value) : null,
    } as any);
  };

  const getErrorClassName = (error: any) => {
    return error ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "";
  };

  const ErrorMessage = ({ error }: { error?: any }) => {
    if (!error) return null;
    return (
      <div className="flex items-center gap-1 mt-1 text-sm text-red-500">
        <AlertCircle className="w-4 h-4" />
        <span>{error.message}</span>
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmitForm as any)} className="space-y-6">
      {/* Asset Code and Type */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className={errors.assetCode ? "text-red-500" : ""}>كود الأصل *</Label>
          <Controller
            name="assetCode"
            control={control}
            render={({ field }) => (
              <>
                <Input
                  {...field}
                  placeholder="ASSET-001"
                  className={getErrorClassName(errors.assetCode)}
                  data-testid="input-asset-code"
                />
                <ErrorMessage error={errors.assetCode} />
              </>
            )}
          />
        </div>
        <div className="space-y-2">
          <Label className={errors.assetType ? "text-red-500" : ""}>نوع الأصل *</Label>
          <Controller
            name="assetType"
            control={control}
            render={({ field }) => (
              <>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className={getErrorClassName(errors.assetType)} data-testid="select-asset-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(assetTypeLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <ErrorMessage error={errors.assetType} />
              </>
            )}
          />
        </div>
      </div>

      {/* Arabic and English Names */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className={errors.nameAr ? "text-red-500" : ""}>الاسم بالعربي *</Label>
          <Controller
            name="nameAr"
            control={control}
            render={({ field }) => (
              <>
                <Input
                  {...field}
                  placeholder="خادم قاعدة البيانات الرئيسي"
                  className={getErrorClassName(errors.nameAr)}
                  data-testid="input-asset-name-ar"
                />
                <ErrorMessage error={errors.nameAr} />
              </>
            )}
          />
        </div>
        <div className="space-y-2">
          <Label className={errors.nameEn ? "text-red-500" : ""}>الاسم بالإنجليزي</Label>
          <Controller
            name="nameEn"
            control={control}
            render={({ field }) => (
              <>
                <Input
                  {...field}
                  placeholder="Main Database Server"
                  className={getErrorClassName(errors.nameEn)}
                  data-testid="input-asset-name-en"
                />
                <ErrorMessage error={errors.nameEn} />
              </>
            )}
          />
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label>الوصف</Label>
        <Controller
          name="description"
          control={control}
          render={({ field }) => (
            <Textarea
              {...field}
              placeholder="وصف تفصيلي للأصل..."
              data-testid="textarea-asset-description"
            />
          )}
        />
      </div>

      {/* Data Classification */}
      <div className="space-y-2">
        <Label className={errors.dataClassification ? "text-red-500" : ""}>تصنيف البيانات الوطني *</Label>
        <Controller
          name="dataClassification"
          control={control}
          render={({ field }) => (
            <>
              <DataClassificationSelect
                value={field.value}
                onChange={field.onChange}
              />
              <ErrorMessage error={errors.dataClassification} />
            </>
          )}
        />
      </div>

      {/* Department and Status */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>الإدارة المسؤولة</Label>
          <Controller
            name="assignedDepartmentId"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger data-testid="select-assigned-department">
                  <SelectValue placeholder="اختر الإدارة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">غير معين</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id.toString()}>{dept.nameAr}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="space-y-2">
          <Label className={errors.status ? "text-red-500" : ""}>الحالة *</Label>
          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className={getErrorClassName(errors.status)} data-testid="select-asset-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabels).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <ErrorMessage error={errors.status} />
              </>
            )}
          />
        </div>
      </div>

      {/* Manufacturer, Model, Serial Number */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label className={errors.manufacturer ? "text-red-500" : ""}>الشركة المصنعة</Label>
          <Controller
            name="manufacturer"
            control={control}
            render={({ field }) => (
              <>
                <Input
                  {...field}
                  placeholder="Dell, HP, etc."
                  className={getErrorClassName(errors.manufacturer)}
                  data-testid="input-manufacturer"
                />
                <ErrorMessage error={errors.manufacturer} />
              </>
            )}
          />
        </div>
        <div className="space-y-2">
          <Label className={errors.model ? "text-red-500" : ""}>الموديل</Label>
          <Controller
            name="model"
            control={control}
            render={({ field }) => (
              <>
                <Input
                  {...field}
                  placeholder="PowerEdge R750"
                  className={getErrorClassName(errors.model)}
                  data-testid="input-model"
                />
                <ErrorMessage error={errors.model} />
              </>
            )}
          />
        </div>
        <div className="space-y-2">
          <Label className={errors.serialNumber ? "text-red-500" : ""}>الرقم التسلسلي</Label>
          <Controller
            name="serialNumber"
            control={control}
            render={({ field }) => (
              <>
                <Input
                  {...field}
                  placeholder="SN12345678"
                  className={getErrorClassName(errors.serialNumber)}
                  data-testid="input-serial-number"
                />
                <ErrorMessage error={errors.serialNumber} />
              </>
            )}
          />
        </div>
      </div>

      {/* Location, IP Address, Criticality */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label className={errors.location ? "text-red-500" : ""}>الموقع</Label>
          <Controller
            name="location"
            control={control}
            render={({ field }) => (
              <>
                <Input
                  {...field}
                  placeholder="مركز البيانات - الرياض"
                  className={getErrorClassName(errors.location)}
                  data-testid="input-location"
                />
                <ErrorMessage error={errors.location} />
              </>
            )}
          />
        </div>
        <div className="space-y-2">
          <Label className={errors.ipAddress ? "text-red-500" : ""}>عنوان IP</Label>
          <Controller
            name="ipAddress"
            control={control}
            render={({ field }) => (
              <>
                <Input
                  {...field}
                  placeholder="192.168.1.100"
                  className={getErrorClassName(errors.ipAddress)}
                  data-testid="input-ip-address"
                />
                <ErrorMessage error={errors.ipAddress} />
              </>
            )}
          />
        </div>
        <div className="space-y-2">
          <Label className={errors.criticality ? "text-red-500" : ""}>الأهمية</Label>
          <Controller
            name="criticality"
            control={control}
            render={({ field }) => (
              <>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className={getErrorClassName(errors.criticality)} data-testid="select-criticality">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(criticalityLabels).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <ErrorMessage error={errors.criticality} />
              </>
            )}
          />
        </div>
      </div>

      {/* Purchase Date and Purchase Cost */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className={errors.purchaseDate ? "text-red-500" : ""}>تاريخ الشراء</Label>
          <Controller
            name="purchaseDate"
            control={control}
            render={({ field }) => (
              <>
                <Input
                  {...field}
                  type="date"
                  className={getErrorClassName(errors.purchaseDate)}
                  data-testid="input-purchase-date"
                />
                <ErrorMessage error={errors.purchaseDate} />
              </>
            )}
          />
        </div>
        <div className="space-y-2">
          <Label className={errors.value ? "text-red-500" : ""}>تكلفة الشراء</Label>
          <Controller
            name="value"
            control={control}
            render={({ field }) => (
              <>
                <Input
                  {...field}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className={getErrorClassName(errors.value)}
                  data-testid="input-purchase-cost"
                />
                <ErrorMessage error={errors.value} />
              </>
            )}
          />
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button 
          type="button" 
          variant="outline" 
          onClick={() => reset()}
          data-testid="button-reset-form"
        >
          إعادة تعيين
        </Button>
        <Button 
          type="submit" 
          disabled={isLoading} 
          className="bg-[hsl(43_74%_49%)] text-muted-foreground"
          data-testid="button-submit-asset"
        >
          {isLoading ? "جاري الحفظ..." : asset ? "تحديث" : "إنشاء"}
        </Button>
      </div>
    </form>
  );
}
