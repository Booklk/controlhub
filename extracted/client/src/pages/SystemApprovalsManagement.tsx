import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { queryClient, apiRequest } from '@/lib/queryClient';
import DashboardLayout from '@/components/DashboardLayout';
import type { NavGroup } from '@/lib/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { DataClassificationBadge } from '@/components/DataClassificationBadge';
import {
 Form,
 FormControl,
 FormField,
 FormItem,
 FormLabel,
 FormMessage,
} from '@/components/ui/form';
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
 Server, Globe, Database, Cloud, Network, CheckCircle, XCircle,
 Clock, Loader2, Building2, AlertTriangle, Plus
, FileDown, FileSpreadsheet} from 'lucide-react';
import { exportToPDF, exportToExcel, formatStatus} from '@/lib/exports';
import { PageHeader, KpiCard } from '@/components/Quality';

// ==================== Zod Schemas with Arabic Error Messages ====================
const approvalCreationSchema = z.object({
 systemName: z
 .string()
 .min(2, { message: 'اسم النظام مطلوب (2 أحرف على الأقل)' })
 .refine(v => v.trim().length >= 2, { message: 'اسم النظام مطلوب (2 أحرف على الأقل)' }),
 requestType: z
 .enum(['new_system', 'change', 'upgrade', 'decommission'])
 .refine(v => v !== undefined, { message: 'نوع الطلب مطلوب' }),
 justification: z
 .string()
 .min(20, { message: 'المبررات مطلوبة (20 حرف على الأقل)' })
 .refine(v => v.trim().length >= 20, { message: 'المبررات مطلوبة (20 حرف على الأقل)' }),
 businessOwner: z
 .string()
 .min(1, { message: 'مالك العمل مطلوب' })
 .refine(v => v.trim().length > 0, { message: 'مالك العمل مطلوب' }),
 priority: z
 .enum(['low', 'medium', 'high', 'critical'])
 .refine(v => v !== undefined, { message: 'الأولوية مطلوبة' }),
});

type ApprovalCreationFormData = z.infer<typeof approvalCreationSchema>;

interface SystemApprovalsManagementProps {
 navItems: { title: string; href: string; icon: React.ReactNode }[];
 navGroups?: NavGroup[];
}

const systemTypeIcons: Record<string, React.ReactNode> = {
 server: <Server className="w-5 h-5" />,
 application: <Globe className="w-5 h-5" />,
 api: <Cloud className="w-5 h-5" />,
 database: <Database className="w-5 h-5" />,
 network: <Network className="w-5 h-5" />,
};

const systemTypeLabels: Record<string, string> = {
 server: 'خادم',
 application: 'تطبيق',
 api: 'واجهة برمجية',
 database: 'قاعدة بيانات',
 network: 'شبكة',
};

const departmentNames: Record<number, string> = {
 2: 'البنية التحتية',
 3: 'الأمن السيبراني',
 4: 'التحول الرقمي',
 5: 'الدعم الفني',
 6: 'مكتب إدارة البيانات',
};

const requestTypeLabels: Record<string, string> = {
 new_system: 'نظام جديد',
 change: 'تعديل',
 upgrade: 'ترقية',
 decommission: 'إيقاف',
};

const priorityLabels: Record<string, string> = {
 low: 'منخفضة',
 medium: 'متوسطة',
 high: 'عالية',
 critical: 'حرجة',
 urgent: 'عاجلة',
};

const priorityColors: Record<string, string> = {
 low: 'hub-icon-gold hub-stat-gold border-[hsl(43_74%_49%)]/20',
 medium: 'bg-muted/30 text-muted-foreground border-white/[0.06]',
 high: 'hub-icon-gold hub-stat-gold border-[hsl(43_74%_49%)]/30',
 critical: 'bg-muted/30 text-muted-foreground border-white/[0.06]',
 urgent: 'bg-muted/30 text-muted-foreground border-white/[0.06]',
};

export default function SystemApprovalsManagement({ navItems, navGroups }: SystemApprovalsManagementProps) {
 const { toast } = useToast();
 const [selectedSystem, setSelectedSystem] = useState<any>(null);
 const [showRejectDialog, setShowRejectDialog] = useState(false);
 const [rejectReason, setRejectReason] = useState('');
 const [showCreateDialog, setShowCreateDialog] = useState(false);

 const form = useForm<ApprovalCreationFormData>({
 resolver: zodResolver(approvalCreationSchema),
 defaultValues: {
 systemName: '',
 requestType: undefined,
 justification: '',
 businessOwner: '',
 priority: undefined,
 },
 mode: 'onChange',
 });

 const { data: pendingApprovals = [], isLoading } = useQuery<any[]>({
 queryKey: ['/api/external-systems/pending-approvals'],
 queryFn: async () => {
 const res = await apiRequest('GET', '/api/external-systems/pending-approvals');
 return res.json();
 }
 });

 const approveMutation = useMutation({
 mutationFn: async (systemId: number) => {
 const res = await apiRequest('POST', `/api/external-systems/${systemId}/approve`);
 return res.json();
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ['/api/external-systems/pending-approvals'] });
 queryClient.invalidateQueries({ queryKey: ['/api/external-systems'] });
 toast({ title: 'تمت الموافقة على النظام وتفعيله بنجاح' });
 setSelectedSystem(null);
 },
 onError: () => {
 toast({ title: 'حدث خطأ في الموافقة', variant: 'destructive' });
 }
 });

 const rejectMutation = useMutation({
 mutationFn: async ({ systemId, reason }: { systemId: number; reason: string }) => {
 const res = await apiRequest('POST', `/api/external-systems/${systemId}/reject`, { reason });
 return res.json();
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ['/api/external-systems/pending-approvals'] });
 queryClient.invalidateQueries({ queryKey: ['/api/external-systems'] });
 toast({ title: 'تم رفض طلب الربط' });
 setShowRejectDialog(false);
 setSelectedSystem(null);
 setRejectReason('');
 },
 onError: () => {
 toast({ title: 'حدث خطأ في الرفض', variant: 'destructive' });
 }
 });

 const createApprovalMutation = useMutation({
 mutationFn: async (data: ApprovalCreationFormData) => {
 const res = await apiRequest('POST', '/api/system-approvals/create', data);
 return res.json();
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ['/api/external-systems/pending-approvals'] });
 queryClient.invalidateQueries({ queryKey: ['/api/external-systems'] });
 toast({ title: 'تم إنشاء طلب الموافقة بنجاح' });
 form.reset();
 setShowCreateDialog(false);
 },
 onError: () => {
 toast({ title: 'حدث خطأ في إنشاء الطلب', variant: 'destructive' });
 }
 });

 const onSubmit = (data: ApprovalCreationFormData) => {
 createApprovalMutation.mutate(data);
 };

 const getCriticalityBadge = (criticality: string) => {
 const styles: Record<string, string> = {
 critical: 'bg-muted/30 text-muted-foreground border-white/[0.06]',
 high: 'hub-icon-gold hub-stat-gold border-[hsl(43_74%_49%)]/30',
 medium: 'bg-muted/30 text-muted-foreground border-white/[0.06]',
 low: 'hub-icon-gold hub-stat-gold border-[hsl(43_74%_49%)]/20',
 };
 const labels: Record<string, string> = {
 critical: 'حرج',
 high: 'عالي',
 medium: 'متوسط',
 low: 'منخفض',
 };
 return <Badge className={styles[criticality] || styles.medium}>{labels[criticality] || criticality}</Badge>;
 };

 const handleReject = (system: any) => {
 setSelectedSystem(system);
 setShowRejectDialog(true);
 };


 const handleExportPDF = () => {
 exportToPDF({
 title: 'تقرير الموافقات',
 subtitle: 'JCSA - Control Hub',
 columns: [{"header":"العنوان","key":"title","width":35},{"header":"النوع","key":"type","width":25},{"header":"مقدم الطلب","key":"requestedBy","width":25},{"header":"الحالة","key":"status","width":20},{"header":"التاريخ","key":"date","width":25}],
 data: (pendingApprovals || []).map((item: any) => ({ title: item.title || '', type: item.type || item.approvalType || '', requestedBy: item.requestedBy || '', status: formatStatus(item.status || ''), date: item.createdAt ? new Date(item.createdAt).toLocaleDateString('ar-SA') : '' })),
 filename: 'system-approvals-report',
 orientation: 'landscape',
 });
 };

 const handleExportExcel = () => {
 exportToExcel({
 title: 'تقرير الموافقات',
 columns: [{"header":"العنوان","key":"title","width":35},{"header":"النوع","key":"type","width":25},{"header":"مقدم الطلب","key":"requestedBy","width":25},{"header":"الحالة","key":"status","width":20},{"header":"التاريخ","key":"date","width":25}],
 data: (pendingApprovals || []).map((item: any) => ({ title: item.title || '', type: item.type || item.approvalType || '', requestedBy: item.requestedBy || '', status: formatStatus(item.status || ''), date: item.createdAt ? new Date(item.createdAt).toLocaleDateString('ar-SA') : '' })),
 filename: 'system-approvals-report',
 });
 };

 return (
 <DashboardLayout
 title="موافقات الأنظمة الخارجية"
 navItems={navItems}
 navGroups={navGroups}
 portalName="مدير تقنية المعلومات"
 >
 <div className="p-6 space-y-5">
 <PageHeader
  icon={Network}
  title="طلبات موافقة الربط"
  subtitle="مراجعة والموافقة على طلبات ربط الأنظمة الخارجية من الإدارات"
  actions={
   <>
    <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportPDF} data-testid="button-export-pdf"><FileDown className="w-3.5 h-3.5" />PDF</Button>
    <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportExcel} data-testid="button-export-excel"><FileSpreadsheet className="w-3.5 h-3.5" />Excel</Button>
    <Button
     onClick={() => setShowCreateDialog(true)}
     className="btn-gold h-9 gap-1.5 text-xs"
     data-testid="button-create-approval"
    >
     <Plus className="w-3.5 h-3.5" />
     طلب موافقة جديد
    </Button>
   </>
  }
 />
 <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
  <KpiCard label="إجمالي الطلبات" value={pendingApprovals.length} icon={Network} color="navy" />
  <KpiCard label="أولوية عالية" value={pendingApprovals.filter((s: any) => ['high','critical','urgent'].includes(s.priority)).length} icon={AlertTriangle} color="danger" />
  <KpiCard label="أنظمة جديدة" value={pendingApprovals.filter((s: any) => s.requestType === 'new_system').length} icon={Globe} color="info" />
 </div>

 {isLoading ? (
 <div className="flex justify-center py-12">
 <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
 </div>
 ) : pendingApprovals.length === 0 ? (
 <Card>
 <CardContent className="py-12 text-center">
 <CheckCircle className="w-12 h-12 mx-auto hub-stat-gold mb-4" />
 <p className="text-muted-foreground text-lg">لا توجد طلبات قيد الانتظار</p>
 <p className="text-sm text-muted-foreground mt-2">جميع طلبات الربط تمت معالجتها</p>
 </CardContent>
 </Card>
 ) : (
 <div className="grid gap-4">
 {pendingApprovals.map((system: any) => (
 <Card key={system.id} className="overflow-hidden border-r-4 border-r-accent">
 <CardHeader className="pb-3">
 <div className="flex items-start justify-between gap-4">
 <div className="flex items-center gap-4">
 <div className="p-3 rounded-lg bg-muted/30">
 {systemTypeIcons[system.systemType] || <Server className="w-6 h-6" />}
 </div>
 <div>
 <CardTitle className="text-lg">{system.nameAr || system.name}</CardTitle>
 <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
 <Building2 className="w-4 h-4" />
 <span>{departmentNames[system.departmentId] || `إدارة ${system.departmentId}`}</span>
 <span className="mx-2">•</span>
 <span>{systemTypeLabels[system.systemType]}</span>
 </div>
 </div>
 </div>
 <div className="flex gap-2">
 <Button variant="outline" size="icon" onClick={handleExportPDF} data-testid="button-export-pdf"><FileDown className="w-4 h-4" /></Button>
 <Button variant="outline" size="icon" onClick={handleExportExcel} data-testid="button-export-excel"><FileSpreadsheet className="w-4 h-4" /></Button>
 <Button
 variant="outline"
 className="border-border text-muted-foreground hover:bg-muted/30"
 onClick={() => handleReject(system)}
 disabled={rejectMutation.isPending}
 data-testid={`button-reject-${system.id}`}
 >
 <XCircle className="w-4 h-4 ml-2" />
 رفض
 </Button>
 <Button
 className="hub-badge-gold-solid hover:hub-badge-gold-solid text-muted-foreground"
 onClick={() => approveMutation.mutate(system.id)}
 disabled={approveMutation.isPending}
 data-testid={`button-approve-${system.id}`}
 >
 {approveMutation.isPending ? (
 <Loader2 className="w-4 h-4 animate-spin ml-2" />
 ) : (
 <CheckCircle className="w-4 h-4 ml-2" />
 )}
 موافقة وتفعيل
 </Button>
 </div>
 </div>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="flex flex-wrap gap-2">
 {getCriticalityBadge(system.criticality)}
 <DataClassificationBadge classification={system.dataClassification} />
 <Badge variant="outline">{system.environment === 'production' ? 'إنتاج' : system.environment === 'staging' ? 'اختبار' : 'تطوير'}</Badge>
 {system.protocol && <Badge variant="secondary">{system.protocol.toUpperCase()}</Badge>}
 </div>

 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
 {system.ipAddress && (
 <div>
 <span className="text-muted-foreground">العنوان: </span>
 <span className="font-mono">{system.ipAddress}{system.port ? `:${system.port}` : ''}</span>
 </div>
 )}
 {system.apiEndpoint && (
 <div className="col-span-2">
 <span className="text-muted-foreground">Endpoint: </span>
 <span className="font-mono text-xs">{system.apiEndpoint}</span>
 </div>
 )}
 {system.vendor && (
 <div>
 <span className="text-muted-foreground">المورد: </span>
 <span>{system.vendor}</span>
 </div>
 )}
 </div>

 {system.description && (
 <div className="text-sm bg-muted/50 p-3 rounded-lg">
 <span className="text-muted-foreground">الوصف: </span>
 {system.description}
 </div>
 )}

 <div className="text-xs text-muted-foreground">
 تاريخ الطلب: {new Date(system.createdAt).toLocaleDateString('ar-SA')}
 </div>
 </CardContent>
 </Card>
 ))}
 </div>
 )}

 <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
 <DialogContent dir="rtl">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <AlertTriangle className="w-5 h-5 text-muted-foreground" />
 رفض طلب الربط
 </DialogTitle>
 </DialogHeader>
 <div className="space-y-4 py-4">
 <p className="text-sm text-muted-foreground">
 سيتم رفض طلب ربط النظام: <strong>{selectedSystem?.nameAr || selectedSystem?.name}</strong>
 </p>
 <div className="space-y-2">
 <Label>سبب الرفض</Label>
 <Textarea
 value={rejectReason}
 onChange={(e) => setRejectReason(e.target.value)}
 placeholder="اذكر سبب رفض الطلب..."
 data-testid="textarea-reject-reason"
 />
 </div>
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={() => setShowRejectDialog(false)}>إلغاء</Button>
 <Button
 variant="destructive"
 onClick={() => rejectMutation.mutate({ systemId: selectedSystem?.id, reason: rejectReason })}
 disabled={!rejectReason || rejectMutation.isPending}
 data-testid="button-confirm-reject"
 >
 {rejectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
 تأكيد الرفض
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>

 <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
 <DialogContent dir="rtl" className="max-w-2xl">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2 text-xl">
 <Plus className="w-5 h-5 hub-stat-gold" />
 طلب موافقة جديد
 </DialogTitle>
 </DialogHeader>

 <Form {...form}>
 <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
 <FormField
 control={form.control}
 name="systemName"
 render={({ field }) => (
 <FormItem>
 <FormLabel className="text-muted-foreground">اسم النظام</FormLabel>
 <FormControl>
 <Input
 placeholder="أدخل اسم النظام"
 {...field}
 data-testid="input-system-name"
 className="border-white/[0.06] focus:border-[hsl(43_74%_49%)]"
 />
 </FormControl>
 <FormMessage className="text-destructive" data-testid="error-system-name" />
 </FormItem>
 )}
 />

 <FormField
 control={form.control}
 name="requestType"
 render={({ field }) => (
 <FormItem>
 <FormLabel className="text-muted-foreground">نوع الطلب</FormLabel>
 <Select onValueChange={field.onChange} defaultValue={field.value}>
 <FormControl>
 <SelectTrigger
 data-testid="select-request-type"
 className="border-white/[0.06] focus:border-[hsl(43_74%_49%)]"
 >
 <SelectValue placeholder="اختر نوع الطلب" />
 </SelectTrigger>
 </FormControl>
 <SelectContent dir="rtl">
 <SelectItem value="new_system">نظام جديد</SelectItem>
 <SelectItem value="change">تعديل</SelectItem>
 <SelectItem value="upgrade">ترقية</SelectItem>
 <SelectItem value="decommission">إيقاف</SelectItem>
 </SelectContent>
 </Select>
 <FormMessage className="text-destructive" data-testid="error-request-type" />
 </FormItem>
 )}
 />

 <FormField
 control={form.control}
 name="businessOwner"
 render={({ field }) => (
 <FormItem>
 <FormLabel className="text-muted-foreground">مالك العمل</FormLabel>
 <FormControl>
 <Input
 placeholder="أدخل اسم مالك العمل"
 {...field}
 data-testid="input-business-owner"
 className="border-white/[0.06] focus:border-[hsl(43_74%_49%)]"
 />
 </FormControl>
 <FormMessage className="text-destructive" data-testid="error-business-owner" />
 </FormItem>
 )}
 />

 <FormField
 control={form.control}
 name="justification"
 render={({ field }) => (
 <FormItem>
 <FormLabel className="text-muted-foreground">المبررات</FormLabel>
 <FormControl>
 <Textarea
 placeholder="أدخل المبررات التفصيلية (20 حرف على الأقل)"
 {...field}
 data-testid="textarea-justification"
 className="border-white/[0.06] focus:border-[hsl(43_74%_49%)] resize-none"
 rows={4}
 />
 </FormControl>
 <div className="flex justify-between text-xs text-muted-foreground">
 <span>{field.value?.length || 0} / 20 حرف</span>
 </div>
 <FormMessage className="text-destructive" data-testid="error-justification" />
 </FormItem>
 )}
 />

 <FormField
 control={form.control}
 name="priority"
 render={({ field }) => (
 <FormItem>
 <FormLabel className="text-muted-foreground">الأولوية</FormLabel>
 <Select onValueChange={field.onChange} defaultValue={field.value}>
 <FormControl>
 <SelectTrigger
 data-testid="select-priority"
 className="border-white/[0.06] focus:border-[hsl(43_74%_49%)]"
 >
 <SelectValue placeholder="اختر الأولوية" />
 </SelectTrigger>
 </FormControl>
 <SelectContent dir="rtl">
 <SelectItem value="low">منخفضة</SelectItem>
 <SelectItem value="medium">متوسطة</SelectItem>
 <SelectItem value="high">عالية</SelectItem>
 <SelectItem value="critical">حرجة</SelectItem>
 </SelectContent>
 </Select>
 {field.value && (
 <Badge className={priorityColors[field.value] || priorityColors.medium}>
 {priorityLabels[field.value]}
 </Badge>
 )}
 <FormMessage className="text-destructive" data-testid="error-priority" />
 </FormItem>
 )}
 />
 </form>
 </Form>

 <DialogFooter className="gap-2 pt-4">
 <Button
 variant="outline"
 onClick={() => {
 setShowCreateDialog(false);
 form.reset();
 }}
 data-testid="button-cancel-create"
 >
 إلغاء
 </Button>
 <Button
 onClick={form.handleSubmit(onSubmit)}
 disabled={createApprovalMutation.isPending || !form.formState.isValid}
 className="hub-badge-gold-solid hover:hub-badge-gold-solid text-muted-foreground"
 data-testid="button-submit-approval"
 >
 {createApprovalMutation.isPending ? (
 <Loader2 className="w-4 h-4 animate-spin ml-2" />
 ) : null}
 إرسال الطلب
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </div>
 </DashboardLayout>
 );
}
