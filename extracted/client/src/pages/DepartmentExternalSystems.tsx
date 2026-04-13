import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest, invalidateRelatedQueries } from '@/lib/queryClient';
import DashboardLayout from '@/components/DashboardLayout';
import { PageHeader } from '@/components/Quality';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { DataClassificationBadge } from '@/components/DataClassificationBadge';
import {
  Server, Globe, Database, Cloud, Shield, Network, Monitor, Camera, HardDrive, Radio, Cog,
  Plus, Activity, Wifi, WifiOff, RefreshCw, Clock, Loader2,
  ArrowLeftRight, ArrowRight, ArrowLeft, Eye, FileDown, FileSpreadsheet
} from 'lucide-react';
import { exportToPDF, exportToExcel} from '@/lib/exports';

interface DepartmentExternalSystemsProps {
  departmentId: number;
  departmentName: string;
  navItems?: { title: string; href: string; icon: React.ReactNode }[];
  navGroups?: { label: string; items: { title: string; href: string; icon: any }[] }[];
  basePath: string;
}

const systemTypeLabels: Record<string, string> = {
  server: 'خادم',
  application: 'تطبيق',
  api: 'واجهة برمجية',
  database: 'قاعدة بيانات',
  network: 'شبكة',
  monitoring: 'نظام مراقبة',
  camera: 'كاميرات مراقبة',
  storage: 'تخزين',
  firewall: 'جدار حماية',
  switch: 'سويتش شبكة',
};

const systemTypeIcons: Record<string, any> = {
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

const scopeByDepartment: Record<string, string[]> = {
  infrastructure: [
    "server_monitoring", "network_monitoring", "camera_surveillance",
    "storage_management", "backup_recovery", "dns_dhcp",
    "active_directory", "virtualization", "asset_management"
  ],
  cybersecurity: [
    "siem", "vulnerability_scanner", "threat_intelligence",
    "endpoint_protection", "firewall_management", "email_gateway"
  ],
  digital_transformation: [
    "cloud_services", "saas_app", "erp_system", "crm", "custom"
  ],
  support: [
    "helpdesk", "ticketing", "asset_management", "active_directory", "custom"
  ],
};

export default function DepartmentExternalSystems({
  departmentId,
  departmentName,
  navItems,
  navGroups,
  basePath
}: DepartmentExternalSystemsProps) {
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [checkingHealth, setCheckingHealth] = useState<number | null>(null);
  const [selectedSystem, setSelectedSystem] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    nameAr: '',
    systemType: 'server',
    category: 'internal',
    apiEndpoint: '',
    ipAddress: '',
    port: '',
    protocol: 'https',
    healthCheckUrl: '',
    description: '',
    vendor: '',
    version: '',
    environment: 'production',
    criticality: 'medium',
    dataClassification: 'internal',
    integrationDirection: 'read_only',
    integrationScope: '',
  });

  const portalKey = basePath.includes('infrastructure') ? 'infrastructure'
    : basePath.includes('cyber') ? 'cybersecurity'
    : basePath.includes('digital') ? 'digital_transformation'
    : basePath.includes('support') ? 'support'
    : 'infrastructure';

  const availableScopes = scopeByDepartment[portalKey] || Object.keys(scopeLabels);

  const { data: systems = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/external-systems', { departmentId }],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/external-systems?departmentId=${departmentId}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    }
  });

  const createSystem = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/external-systems', {
        ...data,
        departmentId,
        port: data.port ? parseInt(data.port) : null,
        approvalStatus: 'pending',
        isActive: false
      });
      if (!res.ok) throw new Error('Failed to create');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/external-systems'] });
      invalidateRelatedQueries('/api/external-systems');
      toast({ title: 'تم إرسال طلب الربط للموافقة' });
      setShowAddDialog(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: 'حدث خطأ في إرسال الطلب', description: error.message, variant: 'destructive' });
    }
  });

  const checkHealth = async (systemId: number) => {
    setCheckingHealth(systemId);
    try {
      const res = await apiRequest('POST', `/api/external-systems/${systemId}/health-check`);
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ['/api/external-systems'] });
        toast({ title: 'تم فحص النظام بنجاح' });
      }
    } catch {
      toast({ title: 'فشل فحص النظام', variant: 'destructive' });
    } finally {
      setCheckingHealth(null);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '', nameAr: '', systemType: 'server', category: 'internal', apiEndpoint: '', ipAddress: '',
      port: '', protocol: 'https', healthCheckUrl: '', description: '', vendor: '',
      version: '', environment: 'production', criticality: 'medium',
      dataClassification: 'internal', integrationDirection: 'read_only', integrationScope: '',
    });
  };

  const handleExportPDF = () => {
    exportToPDF({
      title: 'الأنظمة الخارجية والربط',
      subtitle: 'نادي سباقات الخيل — مركز التحكم',
      columns: [
        { header: 'الاسم', key: 'displayName', width: 40 },
        { header: 'النوع', key: 'typeLabel', width: 25 },
        { header: 'الحالة', key: 'statusLabel', width: 25 },
      ],
      data: systems.map((s: any) => ({
        ...s,
        displayName: s.nameAr || s.name,
        typeLabel: systemTypeLabels[s.systemType] || s.systemType,
        statusLabel: s.approvalStatus === 'pending' ? 'قيد الموافقة' :
          s.approvalStatus === 'rejected' ? 'مرفوض' :
          s.healthStatus === 'online' ? 'متصل' :
          s.healthStatus === 'offline' ? 'غير متصل' :
          s.healthStatus === 'degraded' ? 'متدهور' : 'غير معروف',
      })),
      filename: `external-systems-${new Date().toISOString().split('T')[0]}`,
      orientation: 'landscape',
    });
  };

  const handleExportExcel = () => {
    exportToExcel({
      title: 'الأنظمة الخارجية والربط',
      columns: [
        { header: 'الاسم', key: 'displayName' },
        { header: 'النوع', key: 'typeLabel' },
        { header: 'الحالة', key: 'statusLabel' },
      ],
      data: systems.map((s: any) => ({
        ...s,
        displayName: s.nameAr || s.name,
        typeLabel: systemTypeLabels[s.systemType] || s.systemType,
        statusLabel: s.approvalStatus === 'pending' ? 'قيد الموافقة' :
          s.approvalStatus === 'rejected' ? 'مرفوض' :
          s.healthStatus === 'online' ? 'متصل' :
          s.healthStatus === 'offline' ? 'غير متصل' :
          s.healthStatus === 'degraded' ? 'متدهور' : 'غير معروف',
      })),
      filename: `external-systems-${new Date().toISOString().split('T')[0]}`,
    });
  };

  const getStatusBadge = (system: any) => {
    if (system.approvalStatus === 'pending') return <Badge className="hub-badge-gold">قيد الموافقة</Badge>;
    if (system.approvalStatus === 'rejected') return <Badge variant="destructive">مرفوض</Badge>;
    if (system.healthStatus === 'online') return <Badge className="hub-badge-success"><Wifi className="w-3 h-3 ml-1" /> متصل</Badge>;
    if (system.healthStatus === 'offline') return <Badge variant="destructive"><WifiOff className="w-3 h-3 ml-1" /> غير متصل</Badge>;
    if (system.healthStatus === 'degraded') return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"><Activity className="w-3 h-3 ml-1" /> متدهور</Badge>;
    return <Badge variant="secondary">غير معروف</Badge>;
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

  const getCriticalityBadge = (criticality: string) => {
    const styles: Record<string, string> = {
      critical: 'hub-badge-navy',
      high: 'hub-badge-gold',
      medium: 'hub-badge-navy',
      low: 'hub-badge-gold',
    };
    const labels: Record<string, string> = { critical: 'حرج', high: 'عالي', medium: 'متوسط', low: 'منخفض' };
    return <Badge className={styles[criticality] || styles.medium}>{labels[criticality] || criticality}</Badge>;
  };

  return (
    <DashboardLayout
      title={`إعدادات API - ${departmentName}`}
      navItems={navItems}
      navGroups={navGroups}
      portalName={departmentName}
    >
      <div className="space-y-5" dir="rtl">
        <PageHeader
          icon={Globe}
          title="الأنظمة الخارجية والربط"
          subtitle="إدارة الربط مع الأنظمة الخارجية - مع تحديد نوع واتجاه الاتصال"
          actions={
            <>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportPDF} data-testid="button-export-pdf"><FileDown className="w-3.5 h-3.5" />PDF</Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportExcel} data-testid="button-export-excel"><FileSpreadsheet className="w-3.5 h-3.5" />Excel</Button>
              <Button className="btn-gold h-9 gap-1.5 text-xs" onClick={() => setShowAddDialog(true)} data-testid="button-add-system"><Plus className="w-3.5 h-3.5" />طلب ربط جديد</Button>
            </>
          }
        />

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : systems.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Server className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">لا توجد أنظمة خارجية مسجلة</p>
              <Button variant="outline" className="mt-4" onClick={() => setShowAddDialog(true)} data-testid="button-add-system-empty">
                إضافة نظام جديد
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {systems.map((system: any) => {
              const TypeIcon = systemTypeIcons[system.systemType] || Cog;
              return (
                <Card key={system.id} className="hover-elevate cursor-pointer" onClick={() => setSelectedSystem(system)}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-muted/50">
                          <TypeIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{system.nameAr || system.name}</CardTitle>
                          <p className="text-sm text-muted-foreground">{systemTypeLabels[system.systemType]}</p>
                        </div>
                      </div>
                      {getStatusBadge(system)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {system.approvalStatus === 'rejected' && system.rejectionReason && (
                      <div className="p-2 bg-destructive/10 rounded-md text-sm text-destructive">
                        سبب الرفض: {system.rejectionReason}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {getDirectionBadge(system.integrationDirection)}
                      {getCriticalityBadge(system.criticality)}
                    </div>

                    {system.integrationScope && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">نطاق الربط: </span>
                        <span className="font-medium">{scopeLabels[system.integrationScope] || system.integrationScope}</span>
                      </div>
                    )}

                    {system.ipAddress && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">العنوان: </span>
                        <span className="font-mono">{system.ipAddress}{system.port ? `:${system.port}` : ''}</span>
                      </div>
                    )}

                    {system.apiEndpoint && (
                      <div className="text-sm truncate">
                        <span className="text-muted-foreground">Endpoint: </span>
                        <span className="font-mono text-xs">{system.apiEndpoint}</span>
                      </div>
                    )}

                    {system.approvalStatus === 'approved' && (
                      <div className="flex items-center justify-between pt-2 border-t">
                        <div className="text-sm text-muted-foreground">
                          {system.responseTime && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {system.responseTime}ms
                            </span>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => { e.stopPropagation(); checkHealth(system.id); }}
                          disabled={checkingHealth === system.id}
                          data-testid={`button-health-check-${system.id}`}
                        >
                          {checkingHealth === system.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <RefreshCw className="w-4 h-4 ml-1" />
                              فحص
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="max-w-2xl" dir="rtl">
            <DialogHeader>
              <DialogTitle>طلب ربط نظام خارجي جديد</DialogTitle>
            </DialogHeader>
            <DialogBody className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>اسم النظام (إنجليزي)</Label>
                  <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Zabbix Server" data-testid="input-system-name" />
                </div>
                <div className="space-y-2">
                  <Label>اسم النظام (عربي)</Label>
                  <Input value={formData.nameAr} onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })} placeholder="خادم المراقبة" data-testid="input-system-name-ar" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>نوع النظام</Label>
                  <Select value={formData.systemType} onValueChange={(v) => setFormData({ ...formData, systemType: v })}>
                    <SelectTrigger data-testid="select-system-type"><SelectValue /></SelectTrigger>
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
                </div>
                <div className="space-y-2">
                  <Label>الفئة</Label>
                  <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                    <SelectTrigger data-testid="select-category"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="internal">داخلي</SelectItem>
                      <SelectItem value="external">خارجي</SelectItem>
                      <SelectItem value="cloud">سحابي</SelectItem>
                      <SelectItem value="partner">شريك</SelectItem>
                      <SelectItem value="government">حكومي</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>البروتوكول</Label>
                  <Select value={formData.protocol} onValueChange={(v) => setFormData({ ...formData, protocol: v })}>
                    <SelectTrigger data-testid="select-protocol"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="https">HTTPS</SelectItem>
                      <SelectItem value="http">HTTP</SelectItem>
                      <SelectItem value="ssh">SSH</SelectItem>
                      <SelectItem value="ftp">FTP</SelectItem>
                      <SelectItem value="tcp">TCP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="p-3 rounded-md bg-muted/50 border space-y-4">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <ArrowLeftRight className="w-4 h-4" />
                  إعدادات الربط والتكامل
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>اتجاه الربط</Label>
                    <Select value={formData.integrationDirection} onValueChange={(v) => setFormData({ ...formData, integrationDirection: v })}>
                      <SelectTrigger data-testid="select-direction"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="read_only">
                          <span className="flex items-center gap-2"><Eye className="w-3 h-3" /> قراءة فقط</span>
                        </SelectItem>
                        <SelectItem value="push">
                          <span className="flex items-center gap-2"><ArrowRight className="w-3 h-3" /> إرسال (اتجاه واحد)</span>
                        </SelectItem>
                        <SelectItem value="pull">
                          <span className="flex items-center gap-2"><ArrowLeft className="w-3 h-3" /> استقبال (اتجاه واحد)</span>
                        </SelectItem>
                        <SelectItem value="bidirectional">
                          <span className="flex items-center gap-2"><ArrowLeftRight className="w-3 h-3" /> اتجاهين</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>نطاق الربط</Label>
                    <Select value={formData.integrationScope} onValueChange={(v) => setFormData({ ...formData, integrationScope: v })}>
                      <SelectTrigger data-testid="select-scope"><SelectValue placeholder="اختر نطاق الربط" /></SelectTrigger>
                      <SelectContent>
                        {availableScopes.map(scope => (
                          <SelectItem key={scope} value={scope}>{scopeLabels[scope]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground p-2 rounded bg-background">
                  {formData.integrationDirection === "read_only" && "النظام يسمح فقط بقراءة البيانات ومراقبة الحالة بدون إجراء تعديلات"}
                  {formData.integrationDirection === "push" && "Control Hub يرسل بيانات وأوامر للنظام الخارجي"}
                  {formData.integrationDirection === "pull" && "Control Hub يستقبل بيانات من النظام الخارجي"}
                  {formData.integrationDirection === "bidirectional" && "تبادل كامل للبيانات بين النظامين (قراءة + كتابة + مزامنة)"}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>عنوان IP</Label>
                  <Input value={formData.ipAddress} onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })} placeholder="192.168.1.1" data-testid="input-ip-address" />
                </div>
                <div className="space-y-2">
                  <Label>المنفذ (Port)</Label>
                  <Input value={formData.port} onChange={(e) => setFormData({ ...formData, port: e.target.value })} placeholder="443" type="number" data-testid="input-port" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>رابط API</Label>
                <Input value={formData.apiEndpoint} onChange={(e) => setFormData({ ...formData, apiEndpoint: e.target.value })} placeholder="https://api.example.com/v1" data-testid="input-api-endpoint" />
              </div>

              <div className="space-y-2">
                <Label>رابط فحص الصحة (Health Check)</Label>
                <Input value={formData.healthCheckUrl} onChange={(e) => setFormData({ ...formData, healthCheckUrl: e.target.value })} placeholder="https://api.example.com/health" data-testid="input-health-check-url" />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>البيئة</Label>
                  <Select value={formData.environment} onValueChange={(v) => setFormData({ ...formData, environment: v })}>
                    <SelectTrigger data-testid="select-environment"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="production">إنتاج</SelectItem>
                      <SelectItem value="staging">اختبار</SelectItem>
                      <SelectItem value="development">تطوير</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>الأهمية</Label>
                  <Select value={formData.criticality} onValueChange={(v) => setFormData({ ...formData, criticality: v })}>
                    <SelectTrigger data-testid="select-criticality"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="critical">حرج</SelectItem>
                      <SelectItem value="high">عالي</SelectItem>
                      <SelectItem value="medium">متوسط</SelectItem>
                      <SelectItem value="low">منخفض</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>تصنيف البيانات</Label>
                  <Select value={formData.dataClassification} onValueChange={(v) => setFormData({ ...formData, dataClassification: v })}>
                    <SelectTrigger data-testid="select-classification"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="top_secret">سري للغاية</SelectItem>
                      <SelectItem value="confidential">سري</SelectItem>
                      <SelectItem value="restricted">مقيد</SelectItem>
                      <SelectItem value="public">عام</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>المورد</Label>
                  <Input value={formData.vendor} onChange={(e) => setFormData({ ...formData, vendor: e.target.value })} placeholder="Zabbix, Nagios, Hikvision..." data-testid="input-vendor" />
                </div>
                <div className="space-y-2">
                  <Label>الإصدار</Label>
                  <Input value={formData.version} onChange={(e) => setFormData({ ...formData, version: e.target.value })} placeholder="v6.4" data-testid="input-version" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>الوصف</Label>
                <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="وصف النظام والغرض منه..." data-testid="textarea-description" />
              </div>
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)} data-testid="button-cancel-system">إلغاء</Button>
              <Button
                onClick={() => createSystem.mutate(formData)}
                disabled={!formData.name || createSystem.isPending}
                data-testid="button-submit-request"
              >
                {createSystem.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                إرسال للموافقة
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
                      <p className="text-sm text-muted-foreground">الحالة</p>
                      {getStatusBadge(selectedSystem)}
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
                      {selectedSystem.integrationDirection === "read_only" && "هذا النظام مربوط للقراءة والمراقبة فقط"}
                      {selectedSystem.integrationDirection === "push" && "Control Hub يرسل بيانات وأوامر لهذا النظام"}
                      {selectedSystem.integrationDirection === "pull" && "Control Hub يستقبل ويسحب بيانات من هذا النظام"}
                      {selectedSystem.integrationDirection === "bidirectional" && "تبادل كامل للبيانات في الاتجاهين"}
                      {!selectedSystem.integrationDirection && "اتجاه الربط غير محدد"}
                    </div>
                  </div>

                  {selectedSystem.ipAddress && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">عنوان IP</p>
                        <p className="font-mono" dir="ltr">{selectedSystem.ipAddress}{selectedSystem.port ? `:${selectedSystem.port}` : ''}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">البروتوكول</p>
                        <p className="font-mono uppercase">{selectedSystem.protocol || '-'}</p>
                      </div>
                    </div>
                  )}

                  {selectedSystem.apiEndpoint && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">رابط API</p>
                      <p className="font-mono text-sm break-all" dir="ltr">{selectedSystem.apiEndpoint}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    {getCriticalityBadge(selectedSystem.criticality || 'medium')}
                    <DataClassificationBadge classification={selectedSystem.dataClassification} />
                  </div>

                  {selectedSystem.vendor && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">المورد: </span>
                      <span>{selectedSystem.vendor} {selectedSystem.version}</span>
                    </div>
                  )}

                  {selectedSystem.description && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">الوصف</p>
                      <p className="text-sm">{selectedSystem.description}</p>
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
