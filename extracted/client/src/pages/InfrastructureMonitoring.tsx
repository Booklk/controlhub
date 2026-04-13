import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { infrastructureNavGroups } from "@/lib/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { 
  Activity, RefreshCw, Server, HardDrive, 
  Cpu, MemoryStick, AlertTriangle, CheckCircle,
  Bell, Clock, TrendingUp, TrendingDown, FileDown, FileSpreadsheet,
  Plus, Pencil, Trash2
} from "lucide-react";
import { exportToPDF, exportToExcel} from '@/lib/exports';
import { PageHeader, KpiCard } from "@/components/Quality";


const defaultFormState = {
  name: "",
  targetType: "server",
  targetId: "",
  metricType: "cpu",
  currentValue: "",
  thresholdWarning: "",
  thresholdCritical: "",
  unit: "%",
  status: "normal",
  alertEnabled: true,
  notes: ""
};

export default function InfrastructureMonitoring() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ ...defaultFormState });
  const [dismissedAlerts, setDismissedAlerts] = useState<(number | string)[]>([]);

  const { toast } = useToast();

  const { data: healthData = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ['/api/infrastructure/monitoring'],
    refetchInterval: autoRefresh ? 30000 : false,
  });

  const createMonitoringMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', '/api/infrastructure/monitoring', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/infrastructure/monitoring'] });
      setIsAddDialogOpen(false);
      setFormData({ ...defaultFormState });
      toast({ title: "تم إضافة التنبيه بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ", description: "فشل في إضافة التنبيه", variant: "destructive" });
    }
  });

  const deleteMonitoringMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/infrastructure/monitoring/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/infrastructure/monitoring'] });
      toast({ title: "تم حذف التنبيه بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ", description: "فشل في حذف التنبيه", variant: "destructive" });
    }
  });

  const updateMonitoringMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest('PUT', `/api/infrastructure/monitoring/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/infrastructure/monitoring'] });
      setIsAddDialogOpen(false);
      setEditing(null);
      setFormData({ ...defaultFormState });
      toast({ title: "تم تعديل التنبيه بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ", description: "فشل في تعديل التنبيه", variant: "destructive" });
    }
  });

  const totalItems = healthData.length;
  const systemMetrics = [
    { label: "استخدام CPU", value: totalItems ? Math.round(healthData.reduce((a: number, h: any) => a + (h.cpuUsage || 0), 0) / totalItems) : 0, icon: Cpu, trend: "stable", change: 0, unit: '%' },
    { label: "استخدام الذاكرة", value: totalItems ? Math.round(healthData.reduce((a: number, h: any) => a + (h.memoryUsage || 0), 0) / totalItems) : 0, icon: MemoryStick, trend: "stable", change: 0, unit: '%' },
    { label: "استخدام التخزين", value: totalItems ? Math.round(healthData.reduce((a: number, h: any) => a + (h.diskUsage || 0), 0) / totalItems) : 0, icon: HardDrive, trend: "stable", change: 0, unit: '%' },
    { label: "الأنظمة المراقبة", value: totalItems, icon: Server, trend: "stable", change: 0, unit: '' },
  ];

  const activeAlerts = healthData
    .filter((h: any) => h.status === 'critical' || h.status === 'warning' || h.status === 'degraded')
    .map((h: any, i: number) => ({
      id: h.id || i,
      severity: h.status === 'critical' ? 'critical' : 'warning',
      message: h.name ? `تنبيه: ${h.name} - ${h.status}` : `تنبيه نظام #${h.id || i}`,
      time: h.lastChecked ? new Date(h.lastChecked).toLocaleString('ar-SA') : 'غير محدد'
    }));

  const handleExportPDF = () => {
    exportToPDF({
      title: 'المراقبة والتنبيهات',
      subtitle: 'نادي سباقات الخيل — مركز التحكم',
      columns: [
        { header: 'الاسم', key: 'name', width: 40 },
        { header: 'النوع', key: 'type', width: 30 },
        { header: 'الحالة', key: 'status', width: 30 },
        { header: 'CPU', key: 'cpuUsage', width: 20 },
        { header: 'الذاكرة', key: 'memoryUsage', width: 20 },
      ],
      data: healthData.map((h: any) => ({
        name: h.name || 'غير مسمى',
        type: h.type || 'خادم',
        status: h.status || 'غير معروف',
        cpuUsage: `${h.cpuUsage || 0}%`,
        memoryUsage: `${h.memoryUsage || 0}%`,
      })),
      filename: `infrastructure-monitoring-${new Date().toISOString().split('T')[0]}`,
      orientation: 'landscape',
    });
  };

  const handleExportExcel = () => {
    exportToExcel({
      title: 'المراقبة والتنبيهات',
      columns: [
        { header: 'الاسم', key: 'name' },
        { header: 'النوع', key: 'type' },
        { header: 'الحالة', key: 'status' },
        { header: 'CPU', key: 'cpuUsage' },
        { header: 'الذاكرة', key: 'memoryUsage' },
      ],
      data: healthData.map((h: any) => ({
        name: h.name || 'غير مسمى',
        type: h.type || 'خادم',
        status: h.status || 'غير معروف',
        cpuUsage: `${h.cpuUsage || 0}%`,
        memoryUsage: `${h.memoryUsage || 0}%`,
      })),
      filename: `infrastructure-monitoring-${new Date().toISOString().split('T')[0]}`,
    });
  };

  return (
    <DashboardLayout 
      title="المراقبة والتنبيهات" 
      subtitle="مراقبة أداء الأنظمة في الوقت الفعلي"
      navGroups={infrastructureNavGroups}
      portalName="البنية التحتية"
    >
      <div className="space-y-5">
        <PageHeader
          icon={Activity}
          title="المراقبة والتنبيهات"
          subtitle="مراقبة أداء الأنظمة في الوقت الفعلي"
          actions={
            <>
              <Button
                variant={autoRefresh ? "default" : "outline"}
                size="sm"
                className="h-9 gap-1.5 text-xs"
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                <div className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-white animate-pulse' : 'bg-muted-foreground'}`} />
                {autoRefresh ? 'إيقاف التحديث' : 'تفعيل التحديث'}
              </Button>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => refetch()}><RefreshCw className="w-3.5 h-3.5" /></Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportPDF} data-testid="button-export-pdf"><FileDown className="w-3.5 h-3.5" />PDF</Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportExcel} data-testid="button-export-excel"><FileSpreadsheet className="w-3.5 h-3.5" />Excel</Button>
              <Button className="btn-gold h-9 gap-1.5 text-xs" onClick={() => { setEditing(null); setFormData({ ...defaultFormState }); setIsAddDialogOpen(true); }} data-testid="button-add-monitoring"><Plus className="w-3.5 h-3.5" />إضافة تنبيه</Button>
            </>
          }
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="إجمالي المراقبة" value={healthData.length} icon={Activity} color="navy" />
          <KpiCard label="تنبيهات حرجة" value={healthData.filter((h: any) => h.status === 'critical').length} icon={AlertTriangle} color="danger" />
          <KpiCard label="تحذيرات" value={healthData.filter((h: any) => h.status === 'warning').length} icon={Bell} color="gold" />
          <KpiCard label="حالة طبيعية" value={healthData.filter((h: any) => h.status === 'normal').length} icon={CheckCircle} color="success" />
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
                  setIsAddDialogOpen(open);
                  if (!open) {
                    setEditing(null);
                    setFormData({ ...defaultFormState });
                  }
                }}>
                  <DialogContent className="max-w-2xl" dir="rtl">
                    <DialogHeader>
                      <DialogTitle>{editing ? 'تعديل التنبيه' : 'إضافة تنبيه جديد'}</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div className="space-y-2">
                        <Label>اسم التنبيه</Label>
                        <Input
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="تنبيه استخدام المعالج"
                          data-testid="input-monitoring-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>نوع الهدف</Label>
                        <Select value={formData.targetType} onValueChange={(v) => setFormData({ ...formData, targetType: v })}>
                          <SelectTrigger data-testid="select-monitoring-target-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="server">خادم</SelectItem>
                            <SelectItem value="network">شبكة</SelectItem>
                            <SelectItem value="storage">تخزين</SelectItem>
                            <SelectItem value="application">تطبيق</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>معرف الهدف</Label>
                        <Input
                          value={formData.targetId}
                          onChange={(e) => setFormData({ ...formData, targetId: e.target.value })}
                          placeholder="معرف الخادم أو النظام"
                          data-testid="input-monitoring-target-id"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>نوع المقياس</Label>
                        <Select value={formData.metricType} onValueChange={(v) => setFormData({ ...formData, metricType: v })}>
                          <SelectTrigger data-testid="select-monitoring-metric-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cpu">CPU</SelectItem>
                            <SelectItem value="memory">الذاكرة</SelectItem>
                            <SelectItem value="disk">التخزين</SelectItem>
                            <SelectItem value="network">الشبكة</SelectItem>
                            <SelectItem value="uptime">وقت التشغيل</SelectItem>
                            <SelectItem value="response_time">وقت الاستجابة</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>القيمة الحالية</Label>
                        <Input
                          value={formData.currentValue}
                          onChange={(e) => setFormData({ ...formData, currentValue: e.target.value })}
                          placeholder="75"
                          data-testid="input-monitoring-current-value"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>الوحدة</Label>
                        <Input
                          value={formData.unit}
                          onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                          placeholder="%"
                          data-testid="input-monitoring-unit"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>حد التحذير</Label>
                        <Input
                          value={formData.thresholdWarning}
                          onChange={(e) => setFormData({ ...formData, thresholdWarning: e.target.value })}
                          placeholder="80"
                          data-testid="input-monitoring-threshold-warning"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>حد الحرج</Label>
                        <Input
                          value={formData.thresholdCritical}
                          onChange={(e) => setFormData({ ...formData, thresholdCritical: e.target.value })}
                          placeholder="95"
                          data-testid="input-monitoring-threshold-critical"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>الحالة</Label>
                        <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                          <SelectTrigger data-testid="select-monitoring-status">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="normal">طبيعي</SelectItem>
                            <SelectItem value="warning">تحذير</SelectItem>
                            <SelectItem value="critical">حرج</SelectItem>
                            <SelectItem value="degraded">متدهور</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2 pt-6">
                        <Switch
                          checked={formData.alertEnabled}
                          onCheckedChange={(v) => setFormData({ ...formData, alertEnabled: v })}
                          data-testid="switch-monitoring-alert-enabled"
                        />
                        <Label>تفعيل التنبيهات</Label>
                      </div>
                      <div className="col-span-2 space-y-2">
                        <Label>ملاحظات</Label>
                        <Textarea
                          value={formData.notes}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                          placeholder="ملاحظات إضافية..."
                          data-testid="input-monitoring-notes"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                      <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>إلغاء</Button>
                      <Button
                        className="btn-gold"
                        onClick={() => {
                          if (!formData.name.trim()) {
                            toast({ title: "تنبيه", description: "يرجى إدخال اسم المقياس", variant: "destructive" });
                            return;
                          }
                          const payload = {
                            ...formData,
                            currentValue: formData.currentValue ? parseFloat(formData.currentValue) : undefined,
                            thresholdWarning: formData.thresholdWarning ? parseFloat(formData.thresholdWarning) : undefined,
                            thresholdCritical: formData.thresholdCritical ? parseFloat(formData.thresholdCritical) : undefined,
                            targetId: formData.targetId ? parseInt(formData.targetId) : undefined,
                          };
                          if (editing) {
                            updateMonitoringMutation.mutate({ id: editing.id, data: payload });
                          } else {
                            createMonitoringMutation.mutate(payload);
                          }
                        }}
                        disabled={editing ? updateMonitoringMutation.isPending : createMonitoringMutation.isPending}
                        data-testid="button-submit-monitoring"
                      >
                        {editing
                          ? (updateMonitoringMutation.isPending ? "جاري التعديل..." : "تعديل التنبيه")
                          : (createMonitoringMutation.isPending ? "جاري الإضافة..." : "إضافة التنبيه")}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

        {/* System Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {systemMetrics.map((metric, index) => (
            <Card key={index} className={`card-premium animate-fadeInUp stagger-${index + 1}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 hub-icon-gold rounded-lg">
                      <metric.icon className="w-5 h-5 hub-stat-gold" />
                    </div>
                    <span className="text-sm text-muted-foreground">{metric.label}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {metric.trend === 'up' && <TrendingUp className="w-4 h-4 text-muted-foreground" />}
                    {metric.trend === 'down' && <TrendingDown className="w-4 h-4 hub-stat-gold" />}
                    {metric.change !== 0 && (
                      <span className={`text-xs ${metric.trend === 'up' ? 'text-muted-foreground' : 'hub-stat-gold'}`}>
                        {metric.change > 0 ? '+' : ''}{metric.change}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-2xl font-bold mb-2">{metric.value}{metric.unit || '%'}</div>
                <Progress value={metric.value} className="h-2" />
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Active Alerts */}
          <Card className="card-premium">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5 hub-stat-gold" />
                التنبيهات النشطة
                <Badge className="mr-2">{activeAlerts.filter((a: any) => !dismissedAlerts.includes(a.id)).length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {activeAlerts.filter((a: any) => !dismissedAlerts.includes(a.id)).map((alert, index) => (
                  <div key={alert.id} className={`flex items-start gap-3 p-3 rounded-lg animate-fadeInUp stagger-${index + 1} ${
                    alert.severity === 'critical' ? 'bg-[hsl(222_47%_11%)]/10 border border-[hsl(222_47%_11%)]/30' :
                    alert.severity === 'warning' ? 'hub-icon-gold border border-[hsl(43_74%_49%)]/30' :
                    'bg-muted/30'
                  }`}>
                    <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${
                      alert.severity === 'critical' ? 'text-muted-foreground' :
                      alert.severity === 'warning' ? 'hub-stat-gold' :
                      'text-muted-foreground'
                    }`} />
                    <div className="flex-1">
                      <p className="font-medium">{alert.message}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" />
                        {alert.time}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { setDismissedAlerts(prev => [...prev, alert.id]); toast({ title: 'تم تجاهل التنبيه' }); }} data-testid={`button-dismiss-alert-${alert.id}`}>تجاهل</Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Server Status */}
          <Card className="card-premium">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="w-5 h-5 hub-stat-gold" />
                حالة الخوادم
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {healthData.map((monitor: any, index: number) => (
                  <div key={monitor.id || index} className={`flex items-center justify-between gap-2 p-3 bg-muted/30 rounded-lg animate-fadeInUp stagger-${index + 1}`}>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        monitor.status === 'online' || monitor.status === 'normal' ? 'bg-[hsl(43_74%_49%)]' :
                        monitor.status === 'maintenance' || monitor.status === 'critical' ? 'bg-[hsl(222_47%_11%)]' :
                        monitor.status === 'warning' || monitor.status === 'degraded' ? 'bg-orange-500' :
                        'bg-muted-foreground'
                      }`} />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{monitor.name || 'خادم غير مسمى'}</p>
                        <p className="text-xs text-muted-foreground">{monitor.uptime || monitor.metricType || 'غير معروف'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {(monitor.status === 'online' || monitor.status === 'normal') ? (
                        <div className="flex items-center gap-4 text-sm">
                          <span className="flex items-center gap-1">
                            <Cpu className="w-3 h-3" />
                            {monitor.cpuUsage || monitor.currentValue || 0}%
                          </span>
                          <span className="flex items-center gap-1">
                            <MemoryStick className="w-3 h-3" />
                            {monitor.memoryUsage || 0}%
                          </span>
                        </div>
                      ) : (
                        <Badge variant="secondary">{monitor.status || 'غير معروف'}</Badge>
                      )}
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          setEditing(monitor);
                          setFormData({
                            name: monitor.name || "",
                            targetType: monitor.targetType || "server",
                            targetId: monitor.targetId ? String(monitor.targetId) : "",
                            metricType: monitor.metricType || "cpu",
                            currentValue: monitor.currentValue ? String(monitor.currentValue) : "",
                            thresholdWarning: monitor.thresholdWarning ? String(monitor.thresholdWarning) : "",
                            thresholdCritical: monitor.thresholdCritical ? String(monitor.thresholdCritical) : "",
                            unit: monitor.unit || "%",
                            status: monitor.status || "normal",
                            alertEnabled: monitor.alertEnabled !== false,
                            notes: monitor.notes || ""
                          });
                          setIsAddDialogOpen(true);
                        }}
                        data-testid={`button-edit-monitoring-${monitor.id}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => deleteMonitoringMutation.mutate(monitor.id)}
                        disabled={deleteMonitoringMutation.isPending}
                        data-testid={`button-delete-monitoring-${monitor.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
