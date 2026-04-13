import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/LoadingButton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { cybersecurityNavGroups, CYBERSECURITY_DEPT_ID } from "@/lib/navigation";
import { threatReportingSchema, type ThreatReportingFormData } from "@/lib/schemas";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, invalidateRelatedQueries } from "@/lib/queryClient";
import { useConfirmDialog, ConfirmDialog } from '@/components/ConfirmDialog';
import { 
  Shield, Search, RefreshCw, AlertTriangle, Activity, 
  Eye, Lock, Bug, Skull, Wifi, Globe,
  CheckCircle, XCircle, Plus, Pencil, Trash2,
  FileDown, FileSpreadsheet
} from "lucide-react";
import { exportToPDF, exportToExcel, formatStatus} from '@/lib/exports';
import { PageHeader, KpiCard } from "@/components/Quality";
import { WorkflowIndicator } from "@/components/WorkflowIndicator";
import { getStatusBadge, CYBERSECURITY_THREAT_STATUS } from "@/lib/status-utils";

const THREAT_WORKFLOW_STEPS = [
  { id: 'detect', label: 'الاكتشاف', icon: Eye },
  { id: 'analyze', label: 'التحليل', icon: Bug },
  { id: 'contain', label: 'الاحتواء', icon: Lock },
  { id: 'eradicate', label: 'الإزالة', icon: XCircle },
  { id: 'recover', label: 'الاستعادة', icon: CheckCircle },
];

export default function CybersecurityThreats() {
  const { toast } = useToast();
  const { confirm: confirmAction, dialogProps } = useConfirmDialog();
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingThreat, setEditingThreat] = useState<any>(null);
  const [selectedThreat, setSelectedThreat] = useState<any>(null);

  const form = useForm<ThreatReportingFormData>({
    resolver: zodResolver(threatReportingSchema),
    defaultValues: {
      title: "",
      description: "",
      severity: "medium",
      category: "other",
      affectedSystem: "",
    },
    mode: "onChange",
  });

  const { data: threats = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ['/api/security-threats', CYBERSECURITY_DEPT_ID],
  });

  const reportThreatMutation = useMutation({
    mutationFn: async (threatData: ThreatReportingFormData) => {
      const res = await apiRequest('POST', '/api/security-threats', threatData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/security-threats'] });
      invalidateRelatedQueries('/api/security-threats');
      setIsReportDialogOpen(false);
      form.reset({
        title: "",
        description: "",
        severity: "medium",
        category: "other",
        affectedSystem: "",
      });
      toast({ title: "تم تقرير التهديد بنجاح" });
    },
    onError: (error: Error) => {
      toast({ title: "حدث خطأ في تقرير التهديد", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest('PUT', `/api/security-threats/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'تم تحديث التهديد بنجاح' });
      queryClient.invalidateQueries({ queryKey: ['/api/security-threats'] });
      invalidateRelatedQueries('/api/security-threats');
      setIsEditDialogOpen(false);
      setEditingThreat(null);
    },
    onError: (error: Error) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/security-threats/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'تم حذف التهديد بنجاح' });
      queryClient.invalidateQueries({ queryKey: ['/api/security-threats'] });
      invalidateRelatedQueries('/api/security-threats');
    },
    onError: (error: Error) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });

  const onSubmit = (data: ThreatReportingFormData) => {
    if (editingThreat) {
      updateMutation.mutate({ id: editingThreat.id, data });
    } else {
      reportThreatMutation.mutate(data);
    }
  };

  const handleEditThreat = (threat: any) => {
    setEditingThreat(threat);
    form.reset({
      title: threat.name || threat.title || "",
      description: threat.description || "",
      severity: threat.severity || "medium",
      category: threat.threatType || threat.category || "other",
      affectedSystem: threat.targetSystem || threat.affectedSystem || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleDeleteThreat = (id: number) => {
    confirmAction(() => deleteMutation.mutate(id), {
      title: 'تأكيد الحذف',
      description: 'هل أنت متأكد من حذف هذا التهديد؟ لا يمكن التراجع عن هذا الإجراء.',
    });
  };

  const getSeverityBadge = (severity: string) => {
    const styles: Record<string, string> = {
      critical: "bg-[hsl(222_47%_11%)] text-white animate-pulse",
      high: "bg-[hsl(222_47%_11%)]/80 text-white",
      medium: "bg-[hsl(43_74%_49%)] text-muted-foreground",
      low: "bg-muted text-muted-foreground",
    };
    const labels: Record<string, string> = {
      critical: "حرج", high: "عالي", medium: "متوسط", low: "منخفض"
    };
    return <Badge className={styles[severity] || styles.medium}>{labels[severity] || severity}</Badge>;
  };

  const getThreatStatusBadge = (status: string) => getStatusBadge(status, CYBERSECURITY_THREAT_STATUS);

  const getThreatIcon = (type: string) => {
    const icons: Record<string, any> = {
      brute_force: Lock, ddos: Wifi, malware: Bug, phishing: Globe, intrusion: Skull
    };
    const Icon = icons[type] || AlertTriangle;
    return <Icon className="w-5 h-5" />;
  };

  const getWorkflowStep = (status: string) => {
    const map: Record<string, string> = {
      detecting: 'detect', analyzing: 'analyze', contained: 'contain', 
      eradicated: 'eradicate', monitoring: 'recover'
    };
    return map[status] || 'detect';
  };

  const stats = {
    total: threats.length,
    critical: threats.filter((t: any) => t.severity === 'critical').length,
    active: threats.filter((t: any) => ['detecting', 'analyzing'].includes(t.status)).length,
    resolved: threats.filter((t: any) => ['eradicated', 'monitoring'].includes(t.status)).length,
  };


  const handleExportPDF = () => {
    exportToPDF({
      title: 'تقرير التهديدات السيبرانية',
      subtitle: 'JCSA - Control Hub',
      columns: [{"header":"التهديد","key":"title","width":40},{"header":"الخطورة","key":"severity","width":20},{"header":"النوع","key":"type","width":25},{"header":"الحالة","key":"status","width":20}],
      data: (threats || []).map((item: any) => ({ title: item.title || item.name || '', severity: item.severity || '', type: item.threatType || '', status: formatStatus(item.status || '') })),
      filename: 'cybersecurity-threats-report',
      orientation: 'landscape',
    });
  };

  const handleExportExcel = () => {
    exportToExcel({
      title: 'تقرير التهديدات السيبرانية',
      columns: [{"header":"التهديد","key":"title","width":40},{"header":"الخطورة","key":"severity","width":20},{"header":"النوع","key":"type","width":25},{"header":"الحالة","key":"status","width":20}],
      data: (threats || []).map((item: any) => ({ title: item.title || item.name || '', severity: item.severity || '', type: item.threatType || '', status: formatStatus(item.status || '') })),
      filename: 'cybersecurity-threats-report',
    });
  };

  return (
    <DashboardLayout 
      title="التهديدات والحوادث" 
      subtitle="مراقبة وإدارة التهديدات الأمنية"
      navGroups={cybersecurityNavGroups}
      portalName="الأمن السيبراني"
    >
      <div className="space-y-5">
        <PageHeader
          icon={Shield}
          title="التهديدات والحوادث"
          subtitle="مراقبة وإدارة التهديدات الأمنية"
          actions={
            <>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input placeholder="بحث في التهديدات..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pr-10 h-9 text-sm w-48 bg-background" data-testid="input-threat-search" />
              </div>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-36 h-9 text-sm" data-testid="select-severity-filter"><SelectValue placeholder="الخطورة" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع المستويات</SelectItem>
                  <SelectItem value="critical">حرج</SelectItem>
                  <SelectItem value="high">عالي</SelectItem>
                  <SelectItem value="medium">متوسط</SelectItem>
                  <SelectItem value="low">منخفض</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => refetch()} data-testid="button-refresh-threats"><RefreshCw className="w-3.5 h-3.5" /></Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportPDF} data-testid="button-export-pdf"><FileDown className="w-3.5 h-3.5" />PDF</Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportExcel} data-testid="button-export-excel"><FileSpreadsheet className="w-3.5 h-3.5" />Excel</Button>
              <Button className="btn-gold h-9 gap-1.5 text-xs" onClick={() => setIsReportDialogOpen(true)} data-testid="button-report-threat"><Plus className="w-3.5 h-3.5" />تقرير تهديد</Button>
            </>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="إجمالي التهديدات" value={stats.total} icon={AlertTriangle} color="navy" />
          <KpiCard label="حرجة" value={stats.critical} icon={Skull} color={stats.critical > 0 ? "danger" : "muted"} />
          <KpiCard label="نشطة" value={stats.active} icon={Activity} color={stats.active > 0 ? "gold" : "muted"} />
          <KpiCard label="محلولة" value={stats.resolved} icon={CheckCircle} color="success" />
        </div>

        <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
                <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
                  <DialogHeader>
                    <DialogTitle>تقرير تهديد أمني جديد</DialogTitle>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                      <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>عنوان التهديد *</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="مثال: محاولة تسجيل دخول مشبوهة"
                                data-testid="input-threat-title"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage data-testid="error-threat-title" />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>الوصف التفصيلي *</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="اشرح التهديد بالتفصيل، الأعراض، والتأثيرات..."
                                rows={4}
                                data-testid="input-threat-description"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage data-testid="error-threat-description" />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="severity"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>مستوى الخطورة *</FormLabel>
                              <Select value={field.value} onValueChange={field.onChange}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-threat-severity">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="low">منخفض</SelectItem>
                                  <SelectItem value="medium">متوسط</SelectItem>
                                  <SelectItem value="high">عالي</SelectItem>
                                  <SelectItem value="critical">حرج</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage data-testid="error-threat-severity" />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="category"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>تصنيف التهديد *</FormLabel>
                              <Select value={field.value} onValueChange={field.onChange}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-threat-category">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="brute_force">محاولات تسجيل دخول</SelectItem>
                                  <SelectItem value="ddos">هجوم تضخيم الخدمة</SelectItem>
                                  <SelectItem value="malware">برمجيات خبيثة</SelectItem>
                                  <SelectItem value="phishing">تصيد احتيالي</SelectItem>
                                  <SelectItem value="intrusion">اختراق النظام</SelectItem>
                                  <SelectItem value="other">أخرى</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage data-testid="error-threat-category" />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={form.control}
                        name="affectedSystem"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>النظام المتأثر (اختياري)</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="مثال: خادم المصادقة، البوابة الرئيسية"
                                data-testid="input-affected-system"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage data-testid="error-affected-system" />
                          </FormItem>
                        )}
                      />
                      <DialogFooter className="gap-2 pt-4">
                        <Button
                          variant="outline"
                          onClick={() => setIsReportDialogOpen(false)}
                          type="button"
                          data-testid="button-cancel-report"
                        >
                          إلغاء
                        </Button>
                        <LoadingButton
                          type="submit"
                          disabled={!form.formState.isValid}
                          loading={reportThreatMutation.isPending}
                          loadingText="جاري التقرير..."
                          className="btn-gold"
                          data-testid="button-confirm-report"
                        >
                          تقرير التهديد
                        </LoadingButton>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>

        {/* Threats List */}
        <div className="space-y-4">
          {threats.map((threat: any, index: number) => (
            <Card key={threat.id} className={`card-premium card-hover animate-fadeInUp stagger-${(index % 5) + 1} ${
              threat.severity === 'critical' ? 'border-[hsl(222_47%_11%)]/50' : ''
            }`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 rounded-lg ${
                        threat.severity === 'critical' ? 'bg-[hsl(222_47%_11%)]/10' : 'bg-[hsl(43_74%_49%)]/10'
                      }`}>
                        {getThreatIcon(threat.threatType)}
                      </div>
                      <div>
                        <h4 className="font-semibold">{threat.name}</h4>
                        <p className="text-sm text-muted-foreground">{threat.detectedAt}</p>
                      </div>
                      {getSeverityBadge(threat.severity)}
                      {getThreatStatusBadge(threat.status)}
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 p-3 bg-muted/30 rounded-lg">
                      <div>
                        <p className="text-xs text-muted-foreground">المصدر</p>
                        <p className="font-medium">{threat.sourceIp || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">الهدف</p>
                        <p className="font-medium">{threat.targetSystem || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">المحاولات</p>
                        <p className="font-medium">{'-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">النوع</p>
                        <p className="font-medium">{threat.threatType}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-3 mr-4">
                    <WorkflowIndicator steps={THREAT_WORKFLOW_STEPS} currentStep={getWorkflowStep(threat.status)} />
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setSelectedThreat(threat)} data-testid={`button-details-threat-${threat.id}`}>تفاصيل</Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleEditThreat(threat)}
                        data-testid={`button-edit-threat-${threat.id}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDeleteThreat(threat.id)}
                        data-testid={`button-delete-threat-${threat.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      {threat.status !== 'eradicated' && (
                        <Button size="sm" className="btn-gold" onClick={() => {
                          const nextStatus: Record<string, string> = {
                            'detected': 'analyzing',
                            'detecting': 'analyzing',
                            'analyzing': 'contained',
                            'contained': 'eradicated',
                          };
                          const next = nextStatus[threat.status] || 'contained';
                          updateMutation.mutate({ id: threat.id, data: { status: next } });
                        }} data-testid={`button-action-threat-${threat.id}`}>إجراء</Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog open={isEditDialogOpen} onOpenChange={(open) => { setIsEditDialogOpen(open); if (!open) { setEditingThreat(null); form.reset({ title: "", description: "", severity: "medium", category: "other", affectedSystem: "" }); } }}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl" data-testid="dialog-edit-threat">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="w-5 h-5 hub-stat-gold" />
                تعديل التهديد
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>عنوان التهديد *</FormLabel>
                      <FormControl>
                        <Input placeholder="عنوان التهديد" data-testid="input-edit-threat-title" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>الوصف التفصيلي *</FormLabel>
                      <FormControl>
                        <Textarea placeholder="وصف التهديد بالتفصيل..." rows={4} data-testid="input-edit-threat-description" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="severity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>مستوى الخطورة *</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid="select-edit-threat-severity">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">منخفض</SelectItem>
                            <SelectItem value="medium">متوسط</SelectItem>
                            <SelectItem value="high">عالي</SelectItem>
                            <SelectItem value="critical">حرج</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>تصنيف التهديد *</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid="select-edit-threat-category">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="brute_force">محاولات تسجيل دخول</SelectItem>
                            <SelectItem value="ddos">هجوم تضخيم الخدمة</SelectItem>
                            <SelectItem value="malware">برمجيات خبيثة</SelectItem>
                            <SelectItem value="phishing">تصيد احتيالي</SelectItem>
                            <SelectItem value="intrusion">اختراق النظام</SelectItem>
                            <SelectItem value="other">أخرى</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="affectedSystem"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>النظام المتأثر (اختياري)</FormLabel>
                      <FormControl>
                        <Input placeholder="مثال: خادم المصادقة" data-testid="input-edit-affected-system" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter className="gap-2 pt-4">
                  <Button variant="outline" onClick={() => { setIsEditDialogOpen(false); setEditingThreat(null); }} type="button" data-testid="button-cancel-edit-threat">
                    إلغاء
                  </Button>
                  <LoadingButton type="submit" loading={updateMutation.isPending} loadingText="جاري التحديث..." className="btn-gold" data-testid="button-submit-edit-threat">
                    تحديث التهديد
                  </LoadingButton>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      <Dialog open={!!selectedThreat} onOpenChange={(open) => { if (!open) setSelectedThreat(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl" data-testid="dialog-threat-details">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 hub-stat-gold" />
              تفاصيل التهديد
            </DialogTitle>
          </DialogHeader>
          {selectedThreat && (
            <div className="space-y-4 py-4">
              <div>
                <p className="text-xs text-muted-foreground">العنوان</p>
                <p className="font-medium" data-testid="text-threat-detail-title">{selectedThreat.name || selectedThreat.title}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">الوصف</p>
                <p className="text-sm" data-testid="text-threat-detail-description">{selectedThreat.description || 'لا يوجد وصف'}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">الخطورة</p>
                  <div data-testid="text-threat-detail-severity">{getSeverityBadge(selectedThreat.severity)}</div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">الحالة</p>
                  <div data-testid="text-threat-detail-status">{getThreatStatusBadge(selectedThreat.status)}</div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">الهدف</p>
                  <p className="font-medium" data-testid="text-threat-detail-target">{selectedThreat.targetSystem || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">المحاولات</p>
                  <p className="font-medium" data-testid="text-threat-detail-attempts">{'-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">النوع</p>
                  <p className="font-medium" data-testid="text-threat-detail-type">{selectedThreat.threatType || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">المصدر</p>
                  <p className="font-medium" data-testid="text-threat-detail-source">{selectedThreat.sourceIp || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">أول اكتشاف</p>
                  <p className="font-medium" data-testid="text-threat-detail-first-detected">{selectedThreat.createdAt ? new Date(selectedThreat.createdAt).toLocaleDateString('ar-SA') : '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">آخر ظهور</p>
                  <p className="font-medium" data-testid="text-threat-detail-last-seen">{selectedThreat.detectedAt ? new Date(selectedThreat.detectedAt).toLocaleDateString('ar-SA') : '-'}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog {...dialogProps} />
    </DashboardLayout>
  );
}
