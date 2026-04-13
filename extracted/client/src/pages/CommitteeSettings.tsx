import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { exportToPDF, exportToExcel} from '@/lib/exports';
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { committeeNavGroups } from "@/lib/navigation";
import {
 Settings, Save, CheckCircle, AlertTriangle, Users, Bell, Calendar,
 Vote, Clock, Zap, Shield, RotateCw, Lock,
 Eye, Sliders,
 FileDown, FileSpreadsheet
} from "lucide-react";
import { WorkflowIndicator } from "@/components/WorkflowIndicator";

const SETTINGS_WORKFLOW_STEPS = [
 { id: 'configure', label: 'تكوين', icon: Settings },
 { id: 'review', label: 'مراجعة', icon: Eye },
 { id: 'save', label: 'حفظ', icon: Save },
 { id: 'activate', label: 'تفعيل', icon: Zap },
 { id: 'active', label: 'نشط', icon: CheckCircle },
];

export default function CommitteeSettings() {
 const { toast } = useToast();
 const [currentStep, setCurrentStep] = useState("configure");
 const [isLoading, setIsLoading] = useState(false);

 // Form state
 const [votingQuorum, setVotingQuorum] = useState(5);
 const [approvalsRequired, setApprovalsRequired] = useState(7);
 const [meetingNotifications, setMeetingNotifications] = useState(true);
 const [decisionNotifications, setDecisionNotifications] = useState(true);
 const [emailNotifications, setEmailNotifications] = useState(true);
 const [defaultMeetingDuration, setDefaultMeetingDuration] = useState(120);
 const [meetingFrequency, setMeetingFrequency] = useState("monthly");
 const [memberRoleManagement, setMemberRoleManagement] = useState(true);
 const [rolePermissions, setRolePermissions] = useState("standard");

 const { data: settings, refetch } = useQuery<any>({
 queryKey: ['/api/committee-settings'],
 });

 const { data: committeeMembers = [] } = useQuery<any[]>({
   queryKey: ['/api/committee-members'],
 });

 useEffect(() => {
   if (settings) {
     if (settings.votingQuorum !== undefined) setVotingQuorum(settings.votingQuorum);
     if (settings.approvalsRequired !== undefined) setApprovalsRequired(settings.approvalsRequired);
     if (settings.meetingNotifications !== undefined) setMeetingNotifications(settings.meetingNotifications);
     if (settings.decisionNotifications !== undefined) setDecisionNotifications(settings.decisionNotifications);
     if (settings.emailNotifications !== undefined) setEmailNotifications(settings.emailNotifications);
     if (settings.defaultMeetingDuration !== undefined) setDefaultMeetingDuration(settings.defaultMeetingDuration);
     if (settings.meetingFrequency !== undefined) setMeetingFrequency(settings.meetingFrequency);
     if (settings.memberRoleManagement !== undefined) setMemberRoleManagement(settings.memberRoleManagement);
     if (settings.rolePermissions !== undefined) setRolePermissions(settings.rolePermissions);
     if (settings.updatedAt) setCurrentStep("active");
   }
 }, [settings]);

 const saveMutation = useMutation({
 mutationFn: async () => {
 setCurrentStep("save");
 await new Promise(resolve => setTimeout(resolve, 1000));
 return apiRequest('POST', '/api/committee-settings', {
 votingQuorum,
 approvalsRequired,
 meetingNotifications,
 decisionNotifications,
 emailNotifications,
 defaultMeetingDuration,
 meetingFrequency,
 memberRoleManagement,
 rolePermissions,
 });
 },
 onSuccess: () => {
 setCurrentStep("activate");
 setTimeout(() => {
 toast({ 
 title: 'تم الحفظ بنجاح', 
 description: 'تم حفظ إعدادات اللجنة بنجاح وتفعيلها',
 duration: 3000
 });
 setCurrentStep("active");
 queryClient.invalidateQueries({ queryKey: ['/api/committee-settings'] });
 }, 800);
 },
 onError: () => {
 toast({ 
 title: 'خطأ', 
 description: 'حدث خطأ أثناء حفظ الإعدادات',
 variant: 'destructive' 
 });
 setCurrentStep("configure");
 },
 });

 const handleSaveSettings = async () => {
 setCurrentStep("review");
 await new Promise(resolve => setTimeout(resolve, 500));
 saveMutation.mutate();
 };

 const handleResetSettings = () => {
 setVotingQuorum(5);
 setApprovalsRequired(7);
 setMeetingNotifications(true);
 setDecisionNotifications(true);
 setEmailNotifications(true);
 setDefaultMeetingDuration(120);
 setMeetingFrequency("monthly");
 setMemberRoleManagement(true);
 setRolePermissions("standard");
 setCurrentStep("configure");
 toast({ 
 title: 'تم إعادة تعيين الإعدادات',
 description: 'تم إعادة تعيين جميع الإعدادات إلى القيم الافتراضية',
 duration: 3000
 });
 };

 const handleExportPDF = () => {
 const data = [{
 votingQuorum: votingQuorum.toString(),
 approvalsRequired: approvalsRequired.toString(),
 defaultMeetingDuration: `${defaultMeetingDuration} دقيقة`,
 meetingFrequency: meetingFrequency === 'weekly' ? 'أسبوعي' : meetingFrequency === 'monthly' ? 'شهري' : meetingFrequency,
 meetingNotifications: meetingNotifications ? 'مفعل' : 'معطل',
 emailNotifications: emailNotifications ? 'مفعل' : 'معطل',
 }];
 const columns = [
 { header: 'نصاب التصويت', key: 'votingQuorum' },
 { header: 'الموافقات المطلوبة', key: 'approvalsRequired' },
 { header: 'مدة الاجتماع', key: 'defaultMeetingDuration' },
 { header: 'تكرار الاجتماعات', key: 'meetingFrequency' },
 { header: 'إشعارات الاجتماع', key: 'meetingNotifications' },
 { header: 'إشعارات البريد', key: 'emailNotifications' },
 ];
 exportToPDF({ data, columns, title: 'تقرير إعدادات اللجنة', filename: 'committee-settings-report', orientation: 'landscape' });
 };

 const handleExportExcel = () => {
 const data = [{
 votingQuorum: votingQuorum.toString(),
 approvalsRequired: approvalsRequired.toString(),
 defaultMeetingDuration: `${defaultMeetingDuration} دقيقة`,
 meetingFrequency: meetingFrequency === 'weekly' ? 'أسبوعي' : meetingFrequency === 'monthly' ? 'شهري' : meetingFrequency,
 meetingNotifications: meetingNotifications ? 'مفعل' : 'معطل',
 emailNotifications: emailNotifications ? 'مفعل' : 'معطل',
 }];
 const columns = [
 { header: 'نصاب التصويت', key: 'votingQuorum' },
 { header: 'الموافقات المطلوبة', key: 'approvalsRequired' },
 { header: 'مدة الاجتماع', key: 'defaultMeetingDuration' },
 { header: 'تكرار الاجتماعات', key: 'meetingFrequency' },
 { header: 'إشعارات الاجتماع', key: 'meetingNotifications' },
 { header: 'إشعارات البريد', key: 'emailNotifications' },
 ];
 exportToExcel({ data, columns, title: 'تقرير إعدادات اللجنة', filename: 'committee-settings-report' });
 };

 return (
 <DashboardLayout
 title="إعدادات اللجنة"
 subtitle="تكوين إعدادات لجنة حوكمة البيانات والتفضيلات"
 navGroups={committeeNavGroups}
 portalName="اللجنة"
 >
 <div className="space-y-6 animate-fadeIn">
 <div className="flex items-center justify-end gap-2">
 <Button variant="outline" size="sm" onClick={handleExportPDF} data-testid="button-export-pdf">
 <FileDown className="w-4 h-4 ml-2" />
 PDF
 </Button>
 <Button variant="outline" size="sm" onClick={handleExportExcel} data-testid="button-export-excel">
 <FileSpreadsheet className="w-4 h-4 ml-2" />
 Excel
 </Button>
 </div>
 {/* Workflow Indicator */}
 <Card className="card-premium border-[hsl(43_74%_49%)]/20 bg-gradient-to-br from-primary/5 to-accent/5 backdrop-blur-sm">
 <CardHeader className="pb-2">
 <CardTitle className="text-lg flex items-center gap-2">
 <Sliders className="w-5 h-5 hub-stat-gold" />
 سير العمل - دورة تكوين الإعدادات
 </CardTitle>
 </CardHeader>
 <CardContent>
 <WorkflowIndicator steps={SETTINGS_WORKFLOW_STEPS} currentStep={currentStep} />
 <p className="text-sm text-muted-foreground mt-3">
 <strong>مراحل التكوين:</strong> تكوين الإعدادات ← مراجعة التغييرات ← حفظ البيانات ← تفعيل الإعدادات ← نشط وجاهز للاستخدام
 </p>
 </CardContent>
 </Card>

 {/* Stats Cards */}
 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
 {[
 { label: "نصاب التصويت", value: votingQuorum, icon: Vote, color: "gold" },
 { label: "الموافقات المطلوبة", value: approvalsRequired, icon: CheckCircle, color: "navy" },
 { label: "مدة الاجتماع", value: `${defaultMeetingDuration} دقيقة`, icon: Clock, color: "gold" },
 { label: "عدد الأعضاء", value: committeeMembers.length, icon: Users, color: "gold" },
 ].map((stat, index) => (
 <Card key={index} className={`card-premium animate-fadeInUp stagger-${index + 1}`}>
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-muted-foreground">{stat.label}</p>
 <p className="text-2xl font-bold">{stat.value}</p>
 </div>
 <div className={`p-3 rounded-xl ${stat.color === 'gold' ? 'hub-icon-gold' : 'bg-muted/30'}`}>
 <stat.icon className={`w-6 h-6 ${stat.color === 'gold' ? 'hub-stat-gold' : 'text-muted-foreground'}`} />
 </div>
 </div>
 </CardContent>
 </Card>
 ))}
 </div>

 {/* Voting Settings */}
 <Card className="card-premium border-[hsl(43_74%_49%)]/20">
 <CardHeader>
 <CardTitle className="text-lg flex items-center gap-2">
 <Vote className="w-5 h-5 hub-stat-gold" />
 إعدادات التصويت والاعتمادات
 </CardTitle>
 <CardDescription>تحديد شروط التصويت والموافقات على القرارات</CardDescription>
 </CardHeader>
 <CardContent className="space-y-6">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div className="space-y-2">
 <Label htmlFor="voting-quorum" className="text-base font-semibold flex items-center gap-2">
 <Vote className="w-4 h-4 hub-stat-gold" />
 نصاب التصويت الأدنى
 </Label>
 <div className="flex items-center gap-3">
 <Input
 id="voting-quorum"
 type="number"
 min="1"
 max="20"
 value={votingQuorum}
 onChange={(e) => setVotingQuorum(parseInt(e.target.value))}
 className="flex-1"
 data-testid="input-voting-quorum"
 />
 <span className="text-sm font-medium text-muted-foreground">من 20 عضو</span>
 </div>
 <p className="text-xs text-muted-foreground">الحد الأدنى لعدد الأعضاء الحاضرين لعقد الاجتماع</p>
 </div>

 <div className="space-y-2">
 <Label htmlFor="approvals-required" className="text-base font-semibold flex items-center gap-2">
 <CheckCircle className="w-4 h-4 hub-stat-gold" />
 عدد الموافقات المطلوبة
 </Label>
 <div className="flex items-center gap-3">
 <Input
 id="approvals-required"
 type="number"
 min="1"
 max="20"
 value={approvalsRequired}
 onChange={(e) => setApprovalsRequired(parseInt(e.target.value))}
 className="flex-1"
 data-testid="input-approvals-required"
 />
 <span className="text-sm font-medium text-muted-foreground">من الأعضاء</span>
 </div>
 <p className="text-xs text-muted-foreground">الحد الأدنى لعدد الموافقات لاعتماد القرار</p>
 </div>
 </div>

 <div className="p-4 hub-icon-gold border border-[hsl(43_74%_49%)]/20 rounded-lg">
 <p className="text-sm text-muted-foreground">
 <strong className="text-muted-foreground">ملاحظة:</strong> سيتم استخدام هذه الإعدادات في جميع التصويتات المستقبلية للجنة
 </p>
 </div>
 </CardContent>
 </Card>

 {/* Notification Preferences */}
 <Card className="card-premium border-[hsl(43_74%_49%)]/20">
 <CardHeader>
 <CardTitle className="text-lg flex items-center gap-2">
 <Bell className="w-5 h-5 hub-stat-gold" />
 تفضيلات الإشعارات
 </CardTitle>
 <CardDescription>اختر أنواع الإشعارات التي تريد استلامها</CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="space-y-4">
 {[
 {
 id: 'meeting-notifications',
 label: 'إشعارات الاجتماعات',
 description: 'تلقي إشعارات عند جدولة اجتماعات جديدة أو تحديثات',
 value: meetingNotifications,
 onChange: setMeetingNotifications,
 },
 {
 id: 'decision-notifications',
 label: 'إشعارات القرارات',
 description: 'تلقي إشعارات عند اقتراح أو اعتماد قرارات جديدة',
 value: decisionNotifications,
 onChange: setDecisionNotifications,
 },
 {
 id: 'email-notifications',
 label: 'الإشعارات البريدية',
 description: 'استلام ملخصات يومية أو أسبوعية عبر البريد الإلكتروني',
 value: emailNotifications,
 onChange: setEmailNotifications,
 },
 ].map((notif) => (
 <div key={notif.id} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
 <div className="space-y-1">
 <Label className="text-base font-semibold">{notif.label}</Label>
 <p className="text-sm text-muted-foreground">{notif.description}</p>
 </div>
 <Switch
 checked={notif.value}
 onCheckedChange={notif.onChange}
 data-testid={`switch-${notif.id}`}
 />
 </div>
 ))}
 </div>
 </CardContent>
 </Card>

 {/* Meeting Defaults */}
 <Card className="card-premium border-[hsl(43_74%_49%)]/20">
 <CardHeader>
 <CardTitle className="text-lg flex items-center gap-2">
 <Calendar className="w-5 h-5 hub-stat-gold" />
 الإعدادات الافتراضية للاجتماعات
 </CardTitle>
 <CardDescription>تحديد المعايير الافتراضية للاجتماعات الجديدة</CardDescription>
 </CardHeader>
 <CardContent className="space-y-6">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div className="space-y-2">
 <Label htmlFor="meeting-duration" className="text-base font-semibold flex items-center gap-2">
 <Clock className="w-4 h-4 hub-stat-gold" />
 المدة الافتراضية للاجتماع
 </Label>
 <Select value={defaultMeetingDuration.toString()} onValueChange={(val) => setDefaultMeetingDuration(parseInt(val))}>
 <SelectTrigger id="meeting-duration" data-testid="select-meeting-duration">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="60">60 دقيقة</SelectItem>
 <SelectItem value="90">90 دقيقة</SelectItem>
 <SelectItem value="120">120 دقيقة (ساعتان)</SelectItem>
 <SelectItem value="150">150 دقيقة</SelectItem>
 <SelectItem value="180">180 دقيقة (ثلاث ساعات)</SelectItem>
 </SelectContent>
 </Select>
 <p className="text-xs text-muted-foreground">المدة الافتراضية للاجتماعات الجديدة</p>
 </div>

 <div className="space-y-2">
 <Label htmlFor="meeting-frequency" className="text-base font-semibold flex items-center gap-2">
 <Calendar className="w-4 h-4 hub-stat-gold" />
 تكرار الاجتماعات
 </Label>
 <Select value={meetingFrequency} onValueChange={setMeetingFrequency}>
 <SelectTrigger id="meeting-frequency" data-testid="select-meeting-frequency">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="weekly">أسبوعية</SelectItem>
 <SelectItem value="biweekly">نصف شهرية</SelectItem>
 <SelectItem value="monthly">شهرية</SelectItem>
 <SelectItem value="quarterly">ربع سنوية</SelectItem>
 </SelectContent>
 </Select>
 <p className="text-xs text-muted-foreground">التكرار المقترح للاجتماعات الدورية</p>
 </div>
 </div>
 </CardContent>
 </Card>

 {/* Member Roles Configuration */}
 <Card className="card-premium border-[hsl(43_74%_49%)]/20">
 <CardHeader>
 <CardTitle className="text-lg flex items-center gap-2">
 <Users className="w-5 h-5 hub-stat-gold" />
 تكوين أدوار الأعضاء
 </CardTitle>
 <CardDescription>إدارة الأدوار والصلاحيات للأعضاء</CardDescription>
 </CardHeader>
 <CardContent className="space-y-6">
 <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
 <div className="space-y-1">
 <Label className="text-base font-semibold flex items-center gap-2">
 <Shield className="w-4 h-4 hub-stat-gold" />
 إدارة أدوار الأعضاء
 </Label>
 <p className="text-sm text-muted-foreground">السماح بتعديل أدوار الأعضاء والصلاحيات</p>
 </div>
 <Switch
 checked={memberRoleManagement}
 onCheckedChange={setMemberRoleManagement}
 data-testid="switch-member-role-management"
 />
 </div>

 <div className="space-y-2">
 <Label htmlFor="role-permissions" className="text-base font-semibold flex items-center gap-2">
 <Lock className="w-4 h-4 hub-stat-gold" />
 مستوى الصلاحيات الافتراضي
 </Label>
 <Select value={rolePermissions} onValueChange={setRolePermissions}>
 <SelectTrigger id="role-permissions" data-testid="select-role-permissions">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="viewer">عارض - قراءة فقط</SelectItem>
 <SelectItem value="standard">معياري - قراءة وتصويت</SelectItem>
 <SelectItem value="editor">محرر - إنشاء ومراجعة</SelectItem>
 <SelectItem value="admin">مسؤول - صلاحيات كاملة</SelectItem>
 </SelectContent>
 </Select>
 <p className="text-xs text-muted-foreground">الصلاحيات الافتراضية للأعضاء الجدد</p>
 </div>

 <div className="p-4 bg-muted/30 border border-white/[0.06] rounded-lg space-y-2">
 <p className="text-sm font-semibold text-muted-foreground">الأدوار المتاحة:</p>
 <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground">
 <div className="flex items-center gap-2">
 <Badge className="bg-muted">الرئيس</Badge>
 </div>
 <div className="flex items-center gap-2">
 <Badge className="bg-muted">نائب الرئيس</Badge>
 </div>
 <div className="flex items-center gap-2">
 <Badge className="bg-muted">الأمين</Badge>
 </div>
 <div className="flex items-center gap-2">
 <Badge className="bg-muted">عضو</Badge>
 </div>
 </div>
 </div>
 </CardContent>
 </Card>

 {/* Action Buttons */}
 <Card className="card-premium">
 <CardContent className="p-6">
 <div className="flex flex-wrap items-center gap-4 justify-end">
 <Button
 variant="outline"
 onClick={handleResetSettings}
 disabled={isLoading || saveMutation.isPending}
 data-testid="button-reset-settings"
 >
 <RotateCw className="w-4 h-4 ml-2" />
 إعادة تعيين
 </Button>
 <Button
 className="btn-gold"
 onClick={handleSaveSettings}
 disabled={saveMutation.isPending}
 data-testid="button-save-settings"
 >
 {saveMutation.isPending ? (
 <>
 <RotateCw className="w-4 h-4 ml-2 animate-spin" />
 جاري الحفظ...
 </>
 ) : (
 <>
 <Save className="w-4 h-4 ml-2" />
 حفظ الإعدادات
 </>
 )}
 </Button>
 </div>
 </CardContent>
 </Card>

 {/* Info Section */}
 <Card className="card-premium bg-gradient-to-br from-primary/5 to-accent/5 border-[hsl(43_74%_49%)]/20">
 <CardHeader>
 <CardTitle className="text-base flex items-center gap-2">
 <AlertTriangle className="w-4 h-4 hub-stat-gold" />
 معلومات مهمة
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-3 text-sm text-muted-foreground">
 <p>
 <strong className="text-muted-foreground">•</strong> جميع التغييرات على الإعدادات تتطلب موافقة من الرئيس قبل التطبيق
 </p>
 <p>
 <strong className="text-muted-foreground">•</strong> ستؤثر التغييرات على الاجتماعات المستقبلية وليس الحالية
 </p>
 <p>
 <strong className="text-muted-foreground">•</strong> يمكن استعادة الإعدادات السابقة من سجل التدقيق
 </p>
 <p>
 <strong className="text-muted-foreground">•</strong> سيتم إرسال إشعار لجميع الأعضاء بالتغييرات الجديدة
 </p>
 </CardContent>
 </Card>
 </div>
 </DashboardLayout>
 );
}
