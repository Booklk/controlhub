import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest, invalidateRelatedQueries } from '@/lib/queryClient';
import { externalSystemSchema, type ExternalSystemFormData } from '@/lib/schemas';
import { itDirectorNavGroups } from '@/lib/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogBody, DialogFooter } from '@/components/ui/dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { DataClassificationBadge } from '@/components/DataClassificationBadge';
import {
  Server, ExternalLink, Plus, Activity, Wifi, WifiOff, RefreshCw,
  Globe, Database, Cloud, Shield, Network,
  FileDown, FileSpreadsheet,
  ArrowLeftRight, ArrowRight, ArrowLeft, Eye,
  Camera, Monitor, HardDrive, Radio, Cog,
  Pencil, Trash2
} from 'lucide-react';
import { useConfirmDialog, ConfirmDialog } from '@/components/ConfirmDialog';
import { exportToPDF, exportToExcel} from '@/lib/exports';

interface ExternalSystem {
  id: number;
  name: string;
  nameAr: string | null;
  systemType: string;
  category: string;
  departmentId: number | null;
  apiEndpoint: string | null;
  ipAddress: string | null;
  port: number | null;
  protocol: string | null;
  healthCheckUrl: string | null;
  healthStatus: string | null;
  responseTime: number | null;
  lastHealthCheck: string | null;
  description: string | null;
  vendor: string | null;
  version: string | null;
  environment: string | null;
  criticality: string | null;
  dataClassification: string | null;
  integrationDirection: string | null;
  integrationScope: string | null;
  isActive: boolean | null;
}

const systemTypeLabels: Record<string, string> = {
  server: "خادم",
  application: "تطبيق",
  api: "واجهة برمجية",
  database: "قاعدة بيانات",
  network: "شبكة",
  monitoring: "نظام مراقبة",
  camera: "كاميرات مراقبة",
  storage: "تخزين",
  firewall: "جدار حماية",
  switch: "سويتش شبكة",
};

const categoryLabels: Record<string, string> = {
  infrastructure: "البنية التحتية",
  digital_transformation: "التحول الرقمي",
  security: "الأمن السيبراني",
  business: "أنظمة الأعمال"
};

const directionLabels: Record<string, string> = {
  read_only: "قراءة فقط",
  push: "إرسال (اتجاه واحد)",
  pull: "استقبال (اتجاه واحد)",
  bidirectional: "اتجاهين (إرسال واستقبال)",
};

const directionIcons: Record<string, any> = {
  read_only: Eye,
  push: ArrowRight,
  pull: ArrowLeft,
  bidirectional: ArrowLeftRight,
};

const directionColors: Record<string, string> = {
  read_only: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  push: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  pull: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  bidirectional: "hub-badge-success",
};

const scopeLabels: Record<string, string> = {
  server_monitoring: "مراقبة الخوادم",
  network_monitoring: "مراقبة الشبكات",
  camera_surveillance: "كاميرات المراقبة (CCTV)",
  storage_management: "إدارة التخزين",
  backup_recovery: "النسخ الاحتياطي والاستعادة",
  dns_dhcp: "خدمات DNS/DHCP",
  active_directory: "Active Directory / LDAP",
  virtualization: "المحاكاة الافتراضية (VMware/Hyper-V)",
  siem: "SIEM (إدارة الأحداث الأمنية)",
  vulnerability_scanner: "فاحص الثغرات",
  threat_intelligence: "استخبارات التهديدات",
  endpoint_protection: "حماية الأجهزة الطرفية",
  firewall_management: "إدارة جدران الحماية",
  erp_system: "نظام ERP",
  hr_system: "نظام الموارد البشرية",
  finance_system: "النظام المالي",
  crm: "إدارة علاقات العملاء (CRM)",
  email_gateway: "بوابة البريد الإلكتروني",
  cloud_services: "الخدمات السحابية",
  saas_app: "تطبيق SaaS",
  helpdesk: "نظام الدعم الفني",
  ticketing: "نظام التذاكر",
  asset_management: "إدارة الأصول",
  custom: "مخصص",
};

const scopeByCategory: Record<string, string[]> = {
  infrastructure: [
    "server_monitoring", "network_monitoring", "camera_surveillance",
    "storage_management", "backup_recovery", "dns_dhcp",
    "active_directory", "virtualization", "asset_management"
  ],
  security: [
    "siem", "vulnerability_scanner", "threat_intelligence",
    "endpoint_protection", "firewall_management", "email_gateway"
  ],
  digital_transformation: [
    "cloud_services", "saas_app", "erp_system", "crm", "custom"
  ],
  business: [
    "erp_system", "hr_system", "finance_system",
    "crm", "helpdesk", "ticketing", "custom"
  ],
};

const getSystemIcon = (type: string) => {
  const icons: Record<string, any> = {
    server: Server,
    application: Globe,
    api: Cloud,
    database: Database,
    network: Network,
    monitoring: Monitor,
    camera: Camera,
    storage: HardDrive,
    firewall: Shield,
    switch: Radio,
  };
  const Icon = icons[type] || Cog;
  return <Icon className="w-5 h-5" />;
};

export default function ExternalSystemsManagement() {
  const { toast } = useToast();
  const { confirm: confirmAction, dialogProps } = useConfirmDialog();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterDirection, setFilterDirection] = useState("all");
  const [checkingHealth, setCheckingHealth] = useState<number | null>(null);
  const [selectedSystem, setSelectedSystem] = useState<ExternalSystem | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null);

  const form = useForm<ExternalSystemFormData>({
    resolver: zodResolver(externalSystemSchema),
    defaultValues: {
      name: "",
      nameAr: "",
      systemType: "server",
      integrationStatus: "active",
      category: "infrastructure",
      apiEndpoint: "",
      ipAddress: "",
      port: "",
      protocol: "https",
      healthCheckUrl: "",
      description: "",
      vendor: "",
      version: "",
      environment: "production",
      criticality: "medium",
      dataClassification: "internal",
      integrationDirection: "read_only",
      integrationScope: "",
    }
  });

  const watchedCategory = form.watch("category");

  const { data: systems = [], isLoading } = useQuery<ExternalSystem[]>({
    queryKey: ["/api/external-systems"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: ExternalSystemFormData) => {
      return apiRequest("POST", "/api/external-systems", {
        ...data,
        port: data.port ? parseInt(data.port as string) : null
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/external-systems"] });
      invalidateRelatedQueries('/api/external-systems');
      setIsAddDialogOpen(false);
      form.reset();
      toast({ title: "تم إضافة النظام بنجاح" });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في إضافة النظام", variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (data: ExternalSystemFormData) => {
      return apiRequest("PUT", `/api/external-systems/${editingItem?.id}`, {
        ...data,
        port: data.port ? parseInt(data.port as string) : null
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/external-systems"] });
      invalidateRelatedQueries('/api/external-systems');
      setIsAddDialogOpen(false);
      setEditingItem(null);
      form.reset();
      toast({ title: "تم تحديث النظام بنجاح" });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في تحديث النظام", variant: "destructive" });
    }
  });

  const deleteSystemMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/external-systems/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/external-systems"] });
      invalidateRelatedQueries('/api/external-systems');
      toast({ title: "تم حذف النظام بنجاح" });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل حذف النظام", variant: "destructive" });
    },
  });

  const handleEdit = (system: any) => {
    setEditingItem(system);
    form.reset({
      name: system.name || "",
      nameAr: system.nameAr || "",
      systemType: system.systemType || "server",
      integrationStatus: system.integrationStatus || "active",
      category: system.category || "infrastructure",
      apiEndpoint: system.apiEndpoint || "",
      ipAddress: system.ipAddress || "",
      port: system.port?.toString() || "",
      protocol: system.protocol || "https",
      healthCheckUrl: system.healthCheckUrl || "",
      description: system.description || "",
      vendor: system.vendor || "",
      version: system.version || "",
      environment: system.environment || "production",
      criticality: system.criticality || "medium",
      dataClassification: system.dataClassification || "internal",
      integrationDirection: system.integrationDirection || "read_only",
      integrationScope: system.integrationScope || "",
    });
    setIsAddDialogOpen(true);
  };

  const healthCheckMutation = useMutation({
    mutationFn: async (systemId: number) => {
      setCheckingHealth(systemId);
      return apiRequest("POST", `/api/external-systems/${systemId}/health-check`);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/external-systems"] });
      invalidateRelatedQueries('/api/external-systems');
      setCheckingHealth(null);
      toast({
        title: "تم فحص النظام",
        description: `الحالة: ${data.status === 'online' ? 'متصل' : data.status === 'offline' ? 'غير متصل' : 'متدهور'}`
      });
    },
    onError: () => {
      setCheckingHealth(null);
      toast({ title: "خطأ", description: "فشل في فحص النظام", variant: "destructive" });
    }
  });

  const getHealthBadge = (status: string | null) => {
    switch (status) {
      case 'online':
        return <Badge className="bg-[hsl(43_74%_49%)] text-[hsl(222_47%_11%)]"><Wifi className="w-3 h-3 ml-1" /> متصل</Badge>;
      case 'offline':
        return <Badge className="bg-[hsl(222_47%_11%)]"><WifiOff className="w-3 h-3 ml-1" /> غير متصل</Badge>;
      case 'degraded':
        return <Badge className="bg-[hsl(43_74%_49%)]/60 text-[hsl(222_47%_11%)]"><Activity className="w-3 h-3 ml-1" /> متدهور</Badge>;
      default:
        return <Badge variant="outline">غير معروف</Badge>;
    }
  };

  const getCriticalityBadge = (criticality: string | null) => {
    const colors: Record<string, string> = {
      critical: "bg-[hsl(222_47%_11%)] text-white",
      high: "bg-[hsl(43_74%_49%)] text-[hsl(222_47%_11%)]",
      medium: "bg-[hsl(43_74%_49%)]/60 text-[hsl(222_47%_11%)]",
      low: "bg-[hsl(43_74%_49%)]/20 text-[hsl(43_74%_35%)]"
    };
    const labels: Record<string, string> = { critical: "حرج", high: "عالي", medium: "متوسط", low: "منخفض" };
    return <Badge className={colors[criticality || 'medium']}>{labels[criticality || 'medium']}</Badge>;
  };

  const getDirectionBadge = (direction: string | null) => {
    const dir = direction || 'read_only';
    const Icon = directionIcons[dir] || Eye;
    return (
      <Badge className={directionColors[dir] || directionColors.read_only}>
        <Icon className="w-3 h-3 ml-1" />
        {directionLabels[dir] || dir}
      </Badge>
    );
  };

  const filteredSystems = systems.filter(s => {
    if (filterCategory !== "all" && s.category !== filterCategory) return false;
    if (filterDirection !== "all" && s.integrationDirection !== filterDirection) return false;
    return true;
  });

  const stats = {
    total: systems.length,
    online: systems.filter(s => s.healthStatus === "online").length,
    offline: systems.filter(s => s.healthStatus === "offline").length,
    bidirectional: systems.filter(s => s.integrationDirection === "bidirectional").length,
    readOnly: systems.filter(s => !s.integrationDirection || s.integrationDirection === "read_only").length,
  };

  const handleExportPDF = () => {
    exportToPDF({
      title: 'تقرير الأنظمة الخارجية',
      subtitle: 'JCSA - Control Hub',
      columns: [
        { header: "النظام", key: "name", width: 30 },
        { header: "النوع", key: "type", width: 20 },
        { header: "اتجاه الربط", key: "direction", width: 20 },
        { header: "النطاق", key: "scope", width: 20 },
        { header: "الحالة", key: "status", width: 15 },
      ],
      data: (systems || []).map((s: any) => ({
        name: s.nameAr || s.name || '',
        type: systemTypeLabels[s.systemType] || s.systemType || '',
        direction: directionLabels[s.integrationDirection] || 'قراءة فقط',
        scope: scopeLabels[s.integrationScope] || s.integrationScope || '',
        status: s.healthStatus === 'online' ? 'متصل' : s.healthStatus === 'offline' ? 'غير متصل' : 'غير معروف',
      })),
      filename: 'external-systems-report',
      orientation: 'landscape',
    });
  };

  const handleExportExcel = () => {
    exportToExcel({
      title: 'تقرير الأنظمة الخارجية',
      columns: [
        { header: "النظام", key: "name", width: 30 },
        { header: "النوع", key: "type", width: 20 },
        { header: "اتجاه الربط", key: "direction", width: 25 },
        { header: "النطاق", key: "scope", width: 25 },
        { header: "IP", key: "ip", width: 18 },
        { header: "الحالة", key: "status", width: 15 },
      ],
      data: (systems || []).map((s: any) => ({
        name: s.nameAr || s.name || '',
        type: systemTypeLabels[s.systemType] || s.systemType || '',
        direction: directionLabels[s.integrationDirection] || 'قراءة فقط',
        scope: scopeLabels[s.integrationScope] || s.integrationScope || '',
        ip: s.ipAddress ? `${s.ipAddress}${s.port ? ':' + s.port : ''}` : '',
        status: s.healthStatus === 'online' ? 'متصل' : s.healthStatus === 'offline' ? 'غير متصل' : 'غير معروف',
      })),
      filename: 'external-systems-report',
    });
  };

  if (isLoading) {
    return (
      <DashboardLayout title="الأنظمة الخارجية" portalName="it_director" navGroups={itDirectorNavGroups}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[hsl(43_74%_49%)]"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="الأنظمة الخارجية" portalName="it_director" navGroups={itDirectorNavGroups}>
      <div className="space-y-6">
        <Card className="card-premium bg-gradient-to-r from-[hsl(222_47%_11%)] to-[hsl(222_47%_15%)] text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-2xl font-bold mb-2">إدارة الأنظمة الخارجية والربط</h2>
                <p className="text-white/70">ربط ومراقبة الأنظمة والخوادم والكاميرات وأجهزة الشبكة</p>
              </div>
              <div className="flex gap-6 flex-wrap">
                <div className="text-center">
                  <div className="text-3xl font-bold hub-stat-gold">{stats.total}</div>
                  <p className="text-white/70 text-sm">إجمالي الأنظمة</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-emerald-400">{stats.online}</div>
                  <p className="text-white/70 text-sm">أنظمة متصلة</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="icon" onClick={handleExportPDF} data-testid="button-export-pdf"><FileDown className="w-4 h-4" /></Button>
            <Button variant="outline" size="icon" onClick={handleExportExcel} data-testid="button-export-excel"><FileSpreadsheet className="w-4 h-4" /></Button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Dialog open={isAddDialogOpen} onOpenChange={(open) => { setIsAddDialogOpen(open); if (!open) { setEditingItem(null); form.reset(); } }}>
              <DialogTrigger asChild>
                <Button className="btn-gold" onClick={() => { setEditingItem(null); form.reset(); }} data-testid="button-add-system">
                  <Plus className="w-4 h-4 ml-2" />
                  إضافة نظام جديد
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl" dir="rtl">
                <DialogHeader>
                  <DialogTitle>{editingItem ? "تعديل النظام" : "إضافة نظام خارجي"}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit((data) => editingItem ? updateMutation.mutate(data) : createMutation.mutate(data))}>
                    <DialogBody className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="name" render={({ field }) => (
                          <FormItem>
                            <FormLabel>اسم النظام (إنجليزي)</FormLabel>
                            <FormControl><Input placeholder="Zabbix Server" data-testid="input-system-name" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="nameAr" render={({ field }) => (
                          <FormItem>
                            <FormLabel>اسم النظام (عربي)</FormLabel>
                            <FormControl><Input placeholder="خادم المراقبة" data-testid="input-system-name-ar" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="systemType" render={({ field }) => (
                          <FormItem>
                            <FormLabel>نوع النظام</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl><SelectTrigger data-testid="select-system-type"><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="server">خادم</SelectItem>
                                <SelectItem value="application">تطبيق</SelectItem>
                                <SelectItem value="api">واجهة برمجية (API)</SelectItem>
                                <SelectItem value="database">قاعدة بيانات</SelectItem>
                                <SelectItem value="network">شبكة</SelectItem>
                                <SelectItem value="monitoring">نظام مراقبة</SelectItem>
                                <SelectItem value="camera">كاميرات مراقبة</SelectItem>
                                <SelectItem value="storage">تخزين</SelectItem>
                                <SelectItem value="firewall">جدار حماية</SelectItem>
                                <SelectItem value="switch">سويتش شبكة</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="category" render={({ field }) => (
                          <FormItem>
                            <FormLabel>الفئة / الإدارة</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl><SelectTrigger data-testid="select-category"><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="infrastructure">البنية التحتية</SelectItem>
                                <SelectItem value="digital_transformation">التحول الرقمي</SelectItem>
                                <SelectItem value="security">الأمن السيبراني</SelectItem>
                                <SelectItem value="business">أنظمة الأعمال</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>

                      <div className="p-3 rounded-md bg-muted/50 border space-y-4">
                        <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                          <ArrowLeftRight className="w-4 h-4" />
                          إعدادات الربط والتكامل
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                          <FormField control={form.control} name="integrationDirection" render={({ field }) => (
                            <FormItem>
                              <FormLabel>اتجاه الربط</FormLabel>
                              <Select value={field.value} onValueChange={field.onChange}>
                                <FormControl><SelectTrigger data-testid="select-direction"><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                  <SelectItem value="read_only">
                                    <span className="flex items-center gap-2"><Eye className="w-3 h-3" /> قراءة فقط - مشاهدة البيانات بدون تعديل</span>
                                  </SelectItem>
                                  <SelectItem value="push">
                                    <span className="flex items-center gap-2"><ArrowRight className="w-3 h-3" /> إرسال - نرسل بيانات للنظام الخارجي</span>
                                  </SelectItem>
                                  <SelectItem value="pull">
                                    <span className="flex items-center gap-2"><ArrowLeft className="w-3 h-3" /> استقبال - نستقبل بيانات من النظام</span>
                                  </SelectItem>
                                  <SelectItem value="bidirectional">
                                    <span className="flex items-center gap-2"><ArrowLeftRight className="w-3 h-3" /> اتجاهين - إرسال واستقبال</span>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="integrationScope" render={({ field }) => (
                            <FormItem>
                              <FormLabel>نطاق الربط</FormLabel>
                              <Select value={field.value || undefined} onValueChange={field.onChange}>
                                <FormControl><SelectTrigger data-testid="select-scope"><SelectValue placeholder="اختر نطاق الربط" /></SelectTrigger></FormControl>
                                <SelectContent>
                                  {(scopeByCategory[watchedCategory] || Object.keys(scopeLabels)).map(scope => (
                                    <SelectItem key={scope} value={scope}>{scopeLabels[scope]}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>
                        <div className="text-xs text-muted-foreground p-2 rounded bg-background">
                          {form.watch("integrationDirection") === "read_only" && "النظام يسمح فقط بقراءة البيانات ومراقبة الحالة بدون إجراء تعديلات"}
                          {form.watch("integrationDirection") === "push" && "Control Hub يرسل بيانات وأوامر للنظام الخارجي (مثل: إرسال تنبيهات، تحديث إعدادات)"}
                          {form.watch("integrationDirection") === "pull" && "Control Hub يستقبل بيانات من النظام الخارجي (مثل: سحب سجلات، استيراد بيانات المراقبة)"}
                          {form.watch("integrationDirection") === "bidirectional" && "تبادل كامل للبيانات بين النظامين (قراءة + كتابة + مزامنة)"}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <FormField control={form.control} name="ipAddress" render={({ field }) => (
                          <FormItem>
                            <FormLabel>عنوان IP</FormLabel>
                            <FormControl><Input placeholder="192.168.1.100" data-testid="input-ip" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="port" render={({ field }) => (
                          <FormItem>
                            <FormLabel>المنفذ</FormLabel>
                            <FormControl><Input type="number" placeholder="443" data-testid="input-port" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="protocol" render={({ field }) => (
                          <FormItem>
                            <FormLabel>البروتوكول</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="https">HTTPS</SelectItem>
                                <SelectItem value="http">HTTP</SelectItem>
                                <SelectItem value="ssh">SSH</SelectItem>
                                <SelectItem value="ftp">FTP</SelectItem>
                                <SelectItem value="tcp">TCP</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>

                      <FormField control={form.control} name="apiEndpoint" render={({ field }) => (
                        <FormItem>
                          <FormLabel>رابط API</FormLabel>
                          <FormControl><Input placeholder="https://api.example.com/v1" data-testid="input-api-endpoint" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />

                      <FormField control={form.control} name="healthCheckUrl" render={({ field }) => (
                        <FormItem>
                          <FormLabel>رابط فحص الصحة (Health Check)</FormLabel>
                          <FormControl><Input placeholder="https://api.example.com/health" data-testid="input-health-url" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="vendor" render={({ field }) => (
                          <FormItem>
                            <FormLabel>المورد</FormLabel>
                            <FormControl><Input placeholder="Zabbix, Nagios, Hikvision..." {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="version" render={({ field }) => (
                          <FormItem>
                            <FormLabel>الإصدار</FormLabel>
                            <FormControl><Input placeholder="v6.4" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <FormField control={form.control} name="environment" render={({ field }) => (
                          <FormItem>
                            <FormLabel>البيئة</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="production">إنتاج</SelectItem>
                                <SelectItem value="staging">اختبار</SelectItem>
                                <SelectItem value="development">تطوير</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="criticality" render={({ field }) => (
                          <FormItem>
                            <FormLabel>الأهمية</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="critical">حرج</SelectItem>
                                <SelectItem value="high">عالي</SelectItem>
                                <SelectItem value="medium">متوسط</SelectItem>
                                <SelectItem value="low">منخفض</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="dataClassification" render={({ field }) => (
                          <FormItem>
                            <FormLabel>تصنيف البيانات</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="top_secret">سري للغاية</SelectItem>
                                <SelectItem value="confidential">سري</SelectItem>
                                <SelectItem value="restricted">مقيد</SelectItem>
                                <SelectItem value="public">عام</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>

                      <FormField control={form.control} name="integrationStatus" render={({ field }) => (
                        <FormItem className="hidden">
                          <FormControl><input type="hidden" {...field} /></FormControl>
                        </FormItem>
                      )} />

                      <FormField control={form.control} name="description" render={({ field }) => (
                        <FormItem>
                          <FormLabel>الوصف</FormLabel>
                          <FormControl><Textarea placeholder="وصف النظام ووظائفه..." data-testid="input-description" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </DialogBody>
                    <DialogFooter>
                      <Button type="submit" className="w-full btn-gold" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-system">
                        {(createMutation.isPending || updateMutation.isPending) ? "جاري الحفظ..." : editingItem ? "تحديث النظام" : "إضافة النظام"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="card-premium">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-1">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">إجمالي الأنظمة</p>
                  <p className="text-2xl font-bold hub-stat-gold">{stats.total}</p>
                </div>
                <Server className="w-8 h-8 hub-stat-gold" />
              </div>
            </CardContent>
          </Card>
          <Card className="card-premium">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-1">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">متصل</p>
                  <p className="text-2xl font-bold text-emerald-600">{stats.online}</p>
                </div>
                <Wifi className="w-8 h-8 text-emerald-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="card-premium">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-1">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">ربط اتجاهين</p>
                  <p className="text-2xl font-bold hub-stat-gold">{stats.bidirectional}</p>
                </div>
                <ArrowLeftRight className="w-8 h-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card className="card-premium">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-1">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">قراءة فقط</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.readOnly}</p>
                </div>
                <Eye className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-48" data-testid="select-filter-category">
              <SelectValue placeholder="تصفية حسب الفئة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الفئات</SelectItem>
              <SelectItem value="infrastructure">البنية التحتية</SelectItem>
              <SelectItem value="digital_transformation">التحول الرقمي</SelectItem>
              <SelectItem value="security">الأمن السيبراني</SelectItem>
              <SelectItem value="business">أنظمة الأعمال</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterDirection} onValueChange={setFilterDirection}>
            <SelectTrigger className="w-52" data-testid="select-filter-direction">
              <SelectValue placeholder="تصفية حسب اتجاه الربط" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الاتجاهات</SelectItem>
              <SelectItem value="read_only">قراءة فقط</SelectItem>
              <SelectItem value="push">إرسال (اتجاه واحد)</SelectItem>
              <SelectItem value="pull">استقبال (اتجاه واحد)</SelectItem>
              <SelectItem value="bidirectional">اتجاهين</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSystems.map((system) => (
            <Card key={system.id} className="hover-elevate cursor-pointer" data-testid={`card-system-${system.id}`} onClick={() => setSelectedSystem(system)}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {getSystemIcon(system.systemType)}
                    <CardTitle className="text-lg">{system.nameAr || system.name}</CardTitle>
                  </div>
                  {getHealthBadge(system.healthStatus)}
                </div>
                <div className="flex items-center gap-2 flex-wrap mt-2">
                  <Badge variant="outline">{systemTypeLabels[system.systemType] || system.systemType}</Badge>
                  {getDirectionBadge(system.integrationDirection)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {system.integrationScope && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">نطاق الربط</span>
                      <span className="font-medium">{scopeLabels[system.integrationScope] || system.integrationScope}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">الفئة</span>
                    <span>{categoryLabels[system.category] || system.category}</span>
                  </div>
                  {system.ipAddress && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">IP</span>
                      <span dir="ltr" className="font-mono">{system.ipAddress}:{system.port || '-'}</span>
                    </div>
                  )}
                  {system.apiEndpoint && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">API</span>
                      <span className="text-blue-600 truncate max-w-[200px]">{system.apiEndpoint}</span>
                    </div>
                  )}
                  {system.vendor && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">المورد</span>
                      <span>{system.vendor} {system.version}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    {getCriticalityBadge(system.criticality)}
                    {system.dataClassification && (
                      <DataClassificationBadge classification={system.dataClassification as any} />
                    )}
                  </div>

                  <div className="flex gap-2 mt-4 pt-3 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => { e.stopPropagation(); healthCheckMutation.mutate(system.id); }}
                      disabled={checkingHealth === system.id}
                      data-testid={`button-health-check-${system.id}`}
                    >
                      <RefreshCw className={`w-4 h-4 ml-1 ${checkingHealth === system.id ? 'animate-spin' : ''}`} />
                      فحص الاتصال
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); handleEdit(system); }}
                      data-testid={`button-edit-system-${system.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); confirmAction(
                        () => deleteSystemMutation.mutate(system.id),
                        { title: "حذف النظام", description: `هل أنت متأكد من حذف النظام "${system.nameAr || system.name}"؟` }
                      ); }}
                      data-testid={`button-delete-system-${system.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredSystems.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Server className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>لا توجد أنظمة مسجلة حالياً</p>
            <p className="text-sm mt-2">اضغط على "إضافة نظام جديد" للبدء</p>
          </div>
        )}

        <ConfirmDialog {...dialogProps} />

        <Dialog open={!!selectedSystem} onOpenChange={() => setSelectedSystem(null)}>
          <DialogContent className="max-w-lg" dir="rtl">
            <DialogHeader>
              <DialogTitle>{selectedSystem?.nameAr || selectedSystem?.name}</DialogTitle>
            </DialogHeader>
            <DialogBody className="space-y-4">
              {selectedSystem && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">نوع النظام</p>
                      <p className="font-medium">{systemTypeLabels[selectedSystem.systemType] || selectedSystem.systemType}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">الفئة</p>
                      <p className="font-medium">{categoryLabels[selectedSystem.category] || selectedSystem.category}</p>
                    </div>
                  </div>

                  <div className="p-3 rounded-md bg-muted/50 border space-y-3">
                    <p className="text-sm font-semibold flex items-center gap-2">
                      <ArrowLeftRight className="w-4 h-4" />
                      تفاصيل الربط
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">اتجاه الربط</p>
                        {getDirectionBadge(selectedSystem.integrationDirection)}
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">النطاق</p>
                        <p className="font-medium">{scopeLabels[selectedSystem.integrationScope || ''] || selectedSystem.integrationScope || 'غير محدد'}</p>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {selectedSystem.integrationDirection === "read_only" && "هذا النظام مربوط للقراءة والمراقبة فقط - لا يتم إجراء تعديلات عليه"}
                      {selectedSystem.integrationDirection === "push" && "Control Hub يرسل بيانات وأوامر لهذا النظام"}
                      {selectedSystem.integrationDirection === "pull" && "Control Hub يستقبل ويسحب بيانات من هذا النظام"}
                      {selectedSystem.integrationDirection === "bidirectional" && "تبادل كامل للبيانات في الاتجاهين بين Control Hub وهذا النظام"}
                      {!selectedSystem.integrationDirection && "اتجاه الربط غير محدد - يعامل كقراءة فقط"}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">عنوان IP</p>
                      <p className="font-mono" dir="ltr">{selectedSystem.ipAddress || '-'}{selectedSystem.port ? `:${selectedSystem.port}` : ''}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">البروتوكول</p>
                      <p className="font-mono uppercase">{selectedSystem.protocol || '-'}</p>
                    </div>
                  </div>

                  {selectedSystem.apiEndpoint && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">رابط API</p>
                      <p className="font-mono text-sm break-all" dir="ltr">{selectedSystem.apiEndpoint}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">المورد</p>
                      <p>{selectedSystem.vendor || '-'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">الإصدار</p>
                      <p>{selectedSystem.version || '-'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">البيئة</p>
                      <p>{selectedSystem.environment === 'production' ? 'إنتاج' : selectedSystem.environment === 'staging' ? 'اختبار' : 'تطوير'}</p>
                    </div>
                  </div>

                  {selectedSystem.description && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">الوصف</p>
                      <p className="text-sm">{selectedSystem.description}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    {getHealthBadge(selectedSystem.healthStatus)}
                    {getCriticalityBadge(selectedSystem.criticality)}
                    {selectedSystem.dataClassification && (
                      <DataClassificationBadge classification={selectedSystem.dataClassification as any} />
                    )}
                  </div>

                  {selectedSystem.responseTime !== null && selectedSystem.responseTime !== undefined && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">زمن الاستجابة</p>
                      <p className="font-mono">{selectedSystem.responseTime}ms</p>
                    </div>
                  )}
                </>
              )}
            </DialogBody>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
