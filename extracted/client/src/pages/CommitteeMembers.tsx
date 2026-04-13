import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useConfirmDialog, ConfirmDialog } from '@/components/ConfirmDialog';
import { apiRequest, queryClient, invalidateRelatedQueries } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingButton } from "@/components/LoadingButton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { committeeNavGroups } from "@/lib/navigation";
import { memberCreationSchema, MemberCreationFormData } from "@/lib/schemas";
import {
 Form,
 FormControl,
 FormField,
 FormItem,
 FormLabel,
 FormMessage,
} from "@/components/ui/form";
import {
 Users, Plus, Search, RefreshCw, CheckCircle, Clock,
 AlertTriangle, Phone, Mail, Calendar,
 UserPlus, Eye, Star,
 Zap, Pencil, FileDown, FileSpreadsheet
} from "lucide-react";
import { exportToPDF, exportToExcel, formatStatus} from '@/lib/exports';
import { PageHeader, KpiCard } from "@/components/Quality";

import { getStatusBadge, MEMBER_STATUS } from "@/lib/status-utils";

interface CommitteeMember {
 id: number;
 name: string;
 role: string;
 email: string;
 phone: string;
 status: 'nominate' | 'review' | 'assign' | 'activate' | 'active';
 joinDate: string;
 attendanceRate: number;
 meetingsAttended: number;
 totalMeetings: number;
 department: string;
 expertise: string[];
}

export default function CommitteeMembers() {
 const { toast } = useToast();
 const { confirm: confirmAction, dialogProps } = useConfirmDialog();
 const [searchQuery, setSearchQuery] = useState("");
 const [statusFilter, setStatusFilter] = useState("all");
 const [selectedMember, setSelectedMember] = useState<CommitteeMember | null>(null);
 const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
 const [isAddMemberDialogOpen, setIsAddMemberDialogOpen] = useState(false);
 const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
 const [editingMember, setEditingMember] = useState<any>(null);
 const [isSubmitting, setIsSubmitting] = useState(false);

 const form = useForm<MemberCreationFormData>({
 resolver: zodResolver(memberCreationSchema),
 defaultValues: {
 fullName: "",
 email: "",
 phone: "",
 memberRole: "member",
 department: "",
 startDate: "",
 },
 });

 const { data: apiMembers = [], isLoading, refetch } = useQuery<any[]>({
 queryKey: ['/api/committee-members'],
 });

 const { data: allAttendance = [] } = useQuery<any[]>({
   queryKey: ['/api/meeting-attendance'],
 });

 const { data: allMeetings = [] } = useQuery<any[]>({
   queryKey: ['/api/committee-meetings'],
 });

 const totalMeetings = allMeetings.length;

 // Transform API data to display format
 const displayMembers: CommitteeMember[] = apiMembers.map((m: any) => {
   const memberAttendance = (allAttendance as any[]).filter((a: any) => a.memberId === m.id);
   const attended = memberAttendance.filter((a: any) => a.status === 'attended' || a.status === 'present').length;
   const meetingsAttended = memberAttendance.length > 0 ? attended : 0;
   const effectiveTotal = totalMeetings > 0 ? totalMeetings : memberAttendance.length;
   const attendanceRate = effectiveTotal > 0 ? Math.round((meetingsAttended / effectiveTotal) * 100) : 0;
   return {
     id: m.id,
     name: m.name,
     role: m.committeeRole === 'chair' || m.committeeRole === 'chairman' ? 'رئيس اللجنة' : m.committeeRole === 'vice_chair' || m.committeeRole === 'vice_chairman' ? 'نائب الرئيس' : m.committeeRole === 'rapporteur' || m.committeeRole === 'specialist_member' || m.committeeRole === 'specialist' ? 'عضو متخصص (مقرر)' : 'عضو',
     email: m.email,
     phone: m.phone || '',
     status: m.isActive ? 'active' : 'nominate',
     joinDate: m.joinDate ? new Date(m.joinDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
     attendanceRate,
     meetingsAttended,
     totalMeetings: effectiveTotal,
     department: m.department || '',
     expertise: []
   };
 });

 // Create member mutation
 const createMemberMutation = useMutation({
 mutationFn: async (data: MemberCreationFormData) => {
 return apiRequest('POST', '/api/committee-members', {
 name: data.fullName,
 email: data.email,
 phone: data.phone,
 department: data.department,
 committeeRole: data.memberRole,
 position: data.memberRole === 'chairman' ? 'رئيس اللجنة' : data.memberRole === 'vice_chairman' ? 'نائب الرئيس' : data.memberRole === 'specialist_member' ? 'عضو متخصص (مقرر)' : 'عضو'
 });
 },
 onSuccess: () => {
 toast({ title: 'تم إضافة العضو بنجاح' });
 queryClient.invalidateQueries({ queryKey: ['/api/committee-members'] });
 invalidateRelatedQueries('/api/committee-members');
 setIsAddMemberDialogOpen(false);
 form.reset();
 },
 onError: () => {
 toast({ title: 'خطأ', description: 'فشل في إضافة العضو', variant: 'destructive' });
 }
 });

 const updateMemberMutation = useMutation({
 mutationFn: async ({ id, data }: { id: number; data: any }) => {
 return apiRequest('PUT', `/api/committee-members/${id}`, data);
 },
 onSuccess: () => {
 toast({ title: 'تم تحديث العضو بنجاح' });
 queryClient.invalidateQueries({ queryKey: ['/api/committee-members'] });
 invalidateRelatedQueries('/api/committee-members');
 setIsEditDialogOpen(false);
 setEditingMember(null);
 },
 onError: () => {
 toast({ title: 'خطأ', description: 'فشل في تحديث العضو', variant: 'destructive' });
 }
 });

 // Delete member mutation
 const deleteMemberMutation = useMutation({
 mutationFn: async (id: number) => {
 return apiRequest('DELETE', `/api/committee-members/${id}`);
 },
 onSuccess: () => {
 toast({ title: 'تم حذف العضو بنجاح' });
 queryClient.invalidateQueries({ queryKey: ['/api/committee-members'] });
 invalidateRelatedQueries('/api/committee-members');
 setIsDetailDialogOpen(false);
 },
 onError: () => {
 toast({ title: 'خطأ', description: 'فشل في حذف العضو', variant: 'destructive' });
 }
 });

 const filteredMembers = displayMembers.filter(member => {
 const matchesSearch = member.name.includes(searchQuery) ||
 member.email.includes(searchQuery) ||
 member.department.includes(searchQuery) ||
 member.role.includes(searchQuery);
 const matchesStatus = statusFilter === 'all' || member.status === statusFilter;
 return matchesSearch && matchesStatus;
 });

 const getMemberStatusBadge = (status: string) => getStatusBadge(status, MEMBER_STATUS);

 const getRoleColor = (role: string) => {
 if (role.includes("رئيس")) return "hub-icon-gold hub-stat-gold";
 if (role.includes("نائب")) return "bg-muted/30 text-muted-foreground";
 return "bg-muted text-muted-foreground";
 };

 const stats = {
 total: displayMembers.length,
 active: displayMembers.filter(m => m.status === 'active').length,
 pending: displayMembers.filter(m => m.status === 'nominate' || m.status === 'review').length,
 inProcess: displayMembers.filter(m => m.status === 'assign' || m.status === 'activate').length,
 };

 const handleViewMember = (member: CommitteeMember) => {
 setSelectedMember(member);
 setIsDetailDialogOpen(true);
 };

 const onSubmit = async (data: MemberCreationFormData) => {
 createMemberMutation.mutate(data);
 };

 const handleEditMember = (member: CommitteeMember) => {
 const apiMember = apiMembers.find((m: any) => m.id === member.id);
 setEditingMember(apiMember || member);
 form.reset({
 fullName: member.name || "",
 email: member.email || "",
 phone: member.phone || "",
 memberRole: apiMember?.committeeRole || "member",
 department: member.department || "",
 startDate: member.joinDate || "",
 });
 setIsEditDialogOpen(true);
 };

 const handleEditSubmit = async (data: MemberCreationFormData) => {
 if (editingMember) {
 updateMemberMutation.mutate({
 id: editingMember.id,
 data: {
 name: data.fullName,
 email: data.email,
 phone: data.phone,
 department: data.department,
 committeeRole: data.memberRole,
 position: data.memberRole === 'chairman' ? 'رئيس اللجنة' : data.memberRole === 'vice_chairman' ? 'نائب الرئيس' : data.memberRole === 'specialist_member' ? 'عضو متخصص (مقرر)' : 'عضو'
 }
 });
 }
 };

 const handleDeleteMember = (id: number) => {
 confirmAction(() => deleteMemberMutation.mutate(id), { title: 'تأكيد الحذف', description: 'هل أنت متأكد من حذف هذا العضو؟ لا يمكن التراجع عن هذا الإجراء.' });
 };


 const handleExportPDF = () => {
 exportToPDF({
 title: 'تقرير أعضاء اللجنة',
 subtitle: 'JCSA - Control Hub',
 columns: [{"header":"العضو","key":"name","width":35},{"header":"الدور","key":"role","width":25},{"header":"القسم","key":"department","width":25},{"header":"الحالة","key":"status","width":20}],
 data: (filteredMembers || apiMembers || []).map((item: any) => ({ name: item.name || '', role: item.role || '', department: item.department || '', status: formatStatus(item.status || '') })),
 filename: 'committee-members-report',
 orientation: 'landscape',
 });
 };

 const handleExportExcel = () => {
 exportToExcel({
 title: 'تقرير أعضاء اللجنة',
 columns: [{"header":"العضو","key":"name","width":35},{"header":"الدور","key":"role","width":25},{"header":"القسم","key":"department","width":25},{"header":"الحالة","key":"status","width":20}],
 data: (filteredMembers || apiMembers || []).map((item: any) => ({ name: item.name || '', role: item.role || '', department: item.department || '', status: formatStatus(item.status || '') })),
 filename: 'committee-members-report',
 });
 };

 return (
 <DashboardLayout
 title="أعضاء اللجنة"
 subtitle="إدارة وعرض معلومات أعضاء لجنة حوكمة البيانات"
 navGroups={committeeNavGroups}
 portalName="اللجنة"
 >
 <div className="space-y-5">
 <PageHeader
   icon={Users}
   title="أعضاء اللجان"
   subtitle="إدارة عضوية اللجان والأدوار"
   actions={
     <>
       <div className="relative">
         <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
         <Input placeholder="بحث في الأعضاء..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pr-10 h-9 text-sm w-44 bg-background" data-testid="input-search-members" />
       </div>
       <Select value={statusFilter} onValueChange={setStatusFilter}>
         <SelectTrigger className="w-36 h-9 text-sm" data-testid="select-status-filter"><SelectValue placeholder="الحالة" /></SelectTrigger>
         <SelectContent>
           <SelectItem value="all">جميع الحالات</SelectItem>
           <SelectItem value="nominate">مرشح</SelectItem>
           <SelectItem value="review">قيد المراجعة</SelectItem>
           <SelectItem value="assign">مُعيّن</SelectItem>
           <SelectItem value="activate">قيد التفعيل</SelectItem>
           <SelectItem value="active">نشط</SelectItem>
         </SelectContent>
       </Select>
       <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => refetch()} data-testid="button-refresh-members"><RefreshCw className="w-3.5 h-3.5" /></Button>
       <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportPDF} data-testid="button-export-pdf"><FileDown className="w-3.5 h-3.5" />PDF</Button>
       <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportExcel} data-testid="button-export-excel"><FileSpreadsheet className="w-3.5 h-3.5" />Excel</Button>
       <Button className="btn-gold h-9 gap-1.5 text-xs" onClick={() => setIsAddMemberDialogOpen(true)} data-testid="button-add-member"><Plus className="w-3.5 h-3.5" />عضو جديد</Button>
     </>
   }
 />
 <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
   <KpiCard
     label="إجمالي الأعضاء"
     value={stats.total}
     icon={Users}
     color="navy"
     sublabel="جميع أعضاء اللجنة"
     active={statusFilter === "all"}
     onClick={() => setStatusFilter("all")}
     data-testid="kpi-total-members"
   />
   <KpiCard
     label="أعضاء نشطون"
     value={stats.active}
     icon={CheckCircle}
     color="success"
     sublabel="يشاركون في أعمال اللجنة"
     active={statusFilter === "active"}
     onClick={() => setStatusFilter(statusFilter === "active" ? "all" : "active")}
     data-testid="kpi-active-members"
   />
   <KpiCard
     label="قيد المراجعة"
     value={stats.pending}
     icon={Clock}
     color="gold"
     sublabel="ترشيحات بانتظار اعتماد"
     active={statusFilter === "nominate" || statusFilter === "review"}
     onClick={() => setStatusFilter(statusFilter === "nominate" ? "all" : "nominate")}
     data-testid="kpi-pending-members"
   />
   <KpiCard
     label="قيد التعيين"
     value={stats.inProcess}
     icon={AlertTriangle}
     color="info"
     sublabel="في مرحلة الإنهاء والتفعيل"
     active={statusFilter === "assign" || statusFilter === "activate"}
     onClick={() => setStatusFilter(statusFilter === "assign" ? "all" : "assign")}
     data-testid="kpi-inprocess-members"
   />
 </div>

 <Dialog open={isAddMemberDialogOpen} onOpenChange={setIsAddMemberDialogOpen}>
 <DialogContent className="max-w-2xl" data-testid="dialog-add-member">
 <DialogHeader>
 <DialogTitle className="text-lg flex items-center gap-2">
 <UserPlus className="w-5 h-5 hub-stat-gold" />
 إضافة عضو جديد إلى اللجنة
 </DialogTitle>
 </DialogHeader>
 <Form {...form}>
 <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" dir="rtl">
 {/* Full Name */}
 <FormField
 control={form.control}
 name="fullName"
 render={({ field }) => (
 <FormItem>
 <FormLabel className="text-sm font-medium">اسم العضو *</FormLabel>
 <FormControl>
 <Input
 placeholder="أدخل اسم العضو الكامل"
 {...field}
 data-testid="input-member-fullname"
 className="border-[hsl(43_74%_49%)]/30 focus:ring-accent"
 />
 </FormControl>
 <FormMessage className="text-red-500 text-xs" />
 </FormItem>
 )}
 />

 {/* Email */}
 <FormField
 control={form.control}
 name="email"
 render={({ field }) => (
 <FormItem>
 <FormLabel className="text-sm font-medium">البريد الإلكتروني *</FormLabel>
 <FormControl>
 <Input
 placeholder="example@jcsa.sa"
 type="email"
 {...field}
 data-testid="input-member-email"
 className="border-[hsl(43_74%_49%)]/30 focus:ring-accent"
 />
 </FormControl>
 <FormMessage className="text-red-500 text-xs" />
 </FormItem>
 )}
 />

 {/* Phone */}
 <FormField
 control={form.control}
 name="phone"
 render={({ field }) => (
 <FormItem>
 <FormLabel className="text-sm font-medium">رقم الهاتف</FormLabel>
 <FormControl>
 <Input
 placeholder="+966 50 123 4567"
 type="tel"
 {...field}
 data-testid="input-member-phone"
 className="border-[hsl(43_74%_49%)]/30 focus:ring-accent"
 />
 </FormControl>
 <FormMessage className="text-red-500 text-xs" />
 </FormItem>
 )}
 />

 {/* Member Role */}
 <FormField
 control={form.control}
 name="memberRole"
 render={({ field }) => (
 <FormItem>
 <FormLabel className="text-sm font-medium">دور العضو *</FormLabel>
 <Select value={field.value} onValueChange={field.onChange}>
 <FormControl>
 <SelectTrigger data-testid="select-member-role" className="border-[hsl(43_74%_49%)]/30">
 <SelectValue placeholder="اختر دور العضو" />
 </SelectTrigger>
 </FormControl>
 <SelectContent>
 <SelectItem value="chairman">رئيس اللجنة</SelectItem>
 <SelectItem value="vice_chairman">نائب رئيس اللجنة</SelectItem>
 <SelectItem value="specialist_member">عضو متخصص (مقرر)</SelectItem>
 <SelectItem value="member">عضو</SelectItem>
 </SelectContent>
 </Select>
 <FormMessage className="text-red-500 text-xs" />
 </FormItem>
 )}
 />

 {/* Department */}
 <FormField
 control={form.control}
 name="department"
 render={({ field }) => (
 <FormItem>
 <FormLabel className="text-sm font-medium">الإدارة</FormLabel>
 <FormControl>
 <Input
 placeholder="اختر الإدارة أو اكتبها"
 {...field}
 data-testid="input-member-department"
 className="border-[hsl(43_74%_49%)]/30 focus:ring-accent"
 />
 </FormControl>
 <FormMessage className="text-red-500 text-xs" />
 </FormItem>
 )}
 />

 {/* Start Date */}
 <FormField
 control={form.control}
 name="startDate"
 render={({ field }) => (
 <FormItem>
 <FormLabel className="text-sm font-medium">تاريخ البداية *</FormLabel>
 <FormControl>
 <Input
 type="date"
 {...field}
 data-testid="input-member-startdate"
 className="border-[hsl(43_74%_49%)]/30 focus:ring-accent"
 />
 </FormControl>
 <FormMessage className="text-red-500 text-xs" />
 </FormItem>
 )}
 />

 {/* Submit Buttons */}
 <div className="flex gap-3 justify-end pt-4 border-t">
 <Button
 type="button"
 variant="outline"
 onClick={() => {
 form.reset();
 setIsAddMemberDialogOpen(false);
 }}
 data-testid="button-cancel-member"
 disabled={isSubmitting}
 >
 إلغاء
 </Button>
 <LoadingButton
 type="submit"
 className="hub-badge-gold-solid text-muted-foreground hover:hub-badge-gold-solid"
 data-testid="button-submit-member"
 loading={isSubmitting}
 loadingText="جاري الحفظ..."
 >
 إضافة العضو
 </LoadingButton>
 </div>
 </form>
 </Form>
 </DialogContent>
 </Dialog>

 {/* Members List */}
 <div className="space-y-3">
 {filteredMembers.length > 0 ? (
 filteredMembers.map((member, index) => (
 <Card
 key={member.id}
 className={`card-premium hover:border-[hsl(43_74%_49%)]/40 transition-all duration-300 animate-fadeInUp stagger-${Math.min(index + 1, 5)}`}
 >
 <CardContent className="p-4">
 <div className="flex items-start justify-between gap-4">
 <div className="flex items-start gap-4 flex-1">
 {/* Avatar */}
 <Avatar className="h-12 w-12 border-2 border-[hsl(43_74%_49%)]/30 shadow-lg shadow-accent/10 flex-shrink-0">
 <AvatarFallback className="bg-gradient-to-br from-accent to-accent text-muted-foreground font-bold text-sm">
 {member.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
 </AvatarFallback>
 </Avatar>

 {/* Member Info */}
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-3 mb-2">
 <h3 className="font-bold text-base text-white truncate">{member.name}</h3>
 <Badge className={getRoleColor(member.role)}>
 {member.role}
 </Badge>
 {getMemberStatusBadge(member.status)}
 </div>

 <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
 <div className="flex items-center gap-2 text-muted-foreground">
 <Mail className="w-4 h-4 flex-shrink-0 hub-stat-gold" />
 <span className="truncate">{member.email}</span>
 </div>
 <div className="flex items-center gap-2 text-muted-foreground">
 <Phone className="w-4 h-4 flex-shrink-0 hub-stat-gold" />
 <span className="truncate">{member.phone}</span>
 </div>
 <div className="flex items-center gap-2 text-muted-foreground">
 <Building2Icon className="w-4 h-4 flex-shrink-0 hub-stat-gold" />
 <span className="truncate">{member.department}</span>
 </div>
 <div className="flex items-center gap-2 text-muted-foreground">
 <Calendar className="w-4 h-4 flex-shrink-0 hub-stat-gold" />
 <span className="whitespace-nowrap">{new Date(member.joinDate).toLocaleDateString('ar-SA')}</span>
 </div>
 </div>

 {/* Skills and Attendance */}
 <div className="space-y-2">
 {member.expertise.length > 0 && (
 <div className="flex flex-wrap gap-1">
 {member.expertise.map((skill) => (
 <Badge key={skill} variant="outline" className="text-xs hub-icon-gold border-[hsl(43_74%_49%)]/30 hub-stat-gold">
 {skill}
 </Badge>
 ))}
 </div>
 )}
 {member.status === 'active' && member.totalMeetings > 0 && (
 <div className="flex items-center gap-3">
 <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
 <div
 className="h-full bg-gradient-to-r from-accent to-accent"
 style={{ width: `${member.attendanceRate}%` }}
 />
 </div>
 <span className="text-xs font-medium whitespace-nowrap">
 حضور: {member.attendanceRate}% ({member.meetingsAttended}/{member.totalMeetings})
 </span>
 </div>
 )}
 </div>
 </div>
 </div>

 {/* Actions */}
 <div className="flex items-center gap-2 flex-shrink-0">
 {member.status === 'active' && member.attendanceRate >= 90 && (
 <div className="flex items-center gap-1 px-2 py-1 rounded-lg hub-icon-gold border border-[hsl(43_74%_49%)]/20">
 <Star className="w-4 h-4 hub-stat-gold fill-[hsl(43_74%_49%)]" />
 </div>
 )}
 <Button
 variant="ghost"
 size="icon"
 onClick={() => handleEditMember(member)}
 data-testid={`button-edit-member-${member.id}`}
 >
 <Pencil className="w-4 h-4" />
 </Button>
 <Dialog open={isDetailDialogOpen && selectedMember?.id === member.id} onOpenChange={setIsDetailDialogOpen}>
 <DialogTrigger asChild>
 <Button
 variant="ghost"
 size="icon"
 onClick={() => handleViewMember(member)}
 className="hover-elevate"
 data-testid={`button-view-member-${member.id}`}
 >
 <Eye className="w-4 h-4" />
 </Button>
 </DialogTrigger>
 {selectedMember?.id === member.id && (
 <DialogContent className="max-w-2xl" data-testid={`dialog-member-details-${member.id}`}>
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <Avatar className="h-10 w-10 border-2 border-[hsl(43_74%_49%)]">
 <AvatarFallback className="bg-gradient-to-br from-accent to-accent text-muted-foreground font-bold">
 {selectedMember.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
 </AvatarFallback>
 </Avatar>
 <div>
 <div>{selectedMember.name}</div>
 <div className="text-sm font-normal text-muted-foreground">{selectedMember.role}</div>
 </div>
 </DialogTitle>
 </DialogHeader>
 <div className="space-y-4">
 <div className="grid grid-cols-2 gap-4">
 <div>
 <p className="text-sm text-muted-foreground">البريد الإلكتروني</p>
 <p className="font-medium">{selectedMember.email}</p>
 </div>
 <div>
 <p className="text-sm text-muted-foreground">رقم الهاتف</p>
 <p className="font-medium">{selectedMember.phone}</p>
 </div>
 <div>
 <p className="text-sm text-muted-foreground">الإدارة</p>
 <p className="font-medium">{selectedMember.department}</p>
 </div>
 <div>
 <p className="text-sm text-muted-foreground">تاريخ الانضمام</p>
 <p className="font-medium">{new Date(selectedMember.joinDate).toLocaleDateString('ar-SA')}</p>
 </div>
 </div>

 <div className="border-t pt-4">
 <p className="text-sm text-muted-foreground mb-2">الحالة الحالية</p>
 <div className="flex items-center gap-2">
 {getMemberStatusBadge(selectedMember.status)}
 <span className="text-sm text-muted-foreground">
 {selectedMember.status === 'active' ? 'العضو نشط وممارس' :
 selectedMember.status === 'activate' ? 'قيد تفعيل حساب العضو' :
 selectedMember.status === 'assign' ? 'تم تعيين العضو ينتظر التفعيل' :
 selectedMember.status === 'review' ? 'الطلب قيد المراجعة' :
 'العضو مرشح ينتظر المراجعة'}
 </span>
 </div>
 </div>

 {selectedMember.status === 'active' && (
 <div className="border-t pt-4">
 <p className="text-sm text-muted-foreground mb-3">إحصائيات الحضور</p>
 <div className="space-y-2">
 <div>
 <div className="flex items-center justify-between text-sm mb-1">
 <span>معدل الحضور</span>
 <span className="font-bold hub-stat-gold">{selectedMember.attendanceRate}%</span>
 </div>
 <div className="h-3 bg-muted rounded-full overflow-hidden">
 <div
 className="h-full bg-gradient-to-r from-accent to-accent"
 style={{ width: `${selectedMember.attendanceRate}%` }}
 />
 </div>
 </div>
 <div className="grid grid-cols-2 gap-2">
 <div className="bg-muted/30 rounded-lg p-2">
 <p className="text-xs text-muted-foreground">الاجتماعات الحاضرة</p>
 <p className="text-lg font-bold">{selectedMember.meetingsAttended}</p>
 </div>
 <div className="bg-muted/30 rounded-lg p-2">
 <p className="text-xs text-muted-foreground">إجمالي الاجتماعات</p>
 <p className="text-lg font-bold">{selectedMember.totalMeetings}</p>
 </div>
 </div>
 </div>
 </div>
 )}

 {selectedMember.expertise.length > 0 && (
 <div className="border-t pt-4">
 <p className="text-sm text-muted-foreground mb-2">مجالات الخبرة</p>
 <div className="flex flex-wrap gap-2">
 {selectedMember.expertise.map((skill) => (
 <Badge key={skill} className="hub-icon-gold hub-stat-gold border-[hsl(43_74%_49%)]/30">
 {skill}
 </Badge>
 ))}
 </div>
 </div>
 )}

 <div className="border-t pt-4 flex justify-end">
 <LoadingButton
 variant="outline"
 onClick={() => handleDeleteMember(selectedMember.id)}
 loading={deleteMemberMutation.isPending}
 loadingText="جاري الحذف..."
 data-testid={`button-delete-member-${selectedMember.id}`}
 >
 حذف العضو
 </LoadingButton>
 </div>
 </div>
 </DialogContent>
 )}
 </Dialog>
 </div>
 </div>
 </CardContent>
 </Card>
 ))
 ) : (
 <Card className="card-premium">
 <CardContent className="p-12 text-center">
 <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
 <p className="text-muted-foreground">لم يتم العثور على أعضاء مطابقين</p>
 </CardContent>
 </Card>
 )}
 </div>
 </div>
 <Dialog open={isEditDialogOpen} onOpenChange={(open) => { setIsEditDialogOpen(open); if (!open) setEditingMember(null); }}>
 <DialogContent className="max-w-2xl" data-testid="dialog-edit-member">
 <DialogHeader>
 <DialogTitle className="text-lg flex items-center gap-2">
 <Pencil className="w-5 h-5 hub-stat-gold" />
 تعديل بيانات العضو
 </DialogTitle>
 </DialogHeader>
 <Form {...form}>
 <form onSubmit={form.handleSubmit(handleEditSubmit)} className="space-y-5" dir="rtl">
 <FormField
 control={form.control}
 name="fullName"
 render={({ field }) => (
 <FormItem>
 <FormLabel className="text-sm font-medium">اسم العضو *</FormLabel>
 <FormControl>
 <Input placeholder="أدخل اسم العضو الكامل" {...field} data-testid="input-edit-member-fullname" className="border-[hsl(43_74%_49%)]/30 focus:ring-accent" />
 </FormControl>
 <FormMessage className="text-red-500 text-xs" />
 </FormItem>
 )}
 />
 <FormField
 control={form.control}
 name="email"
 render={({ field }) => (
 <FormItem>
 <FormLabel className="text-sm font-medium">البريد الإلكتروني *</FormLabel>
 <FormControl>
 <Input placeholder="example@company.com" type="email" {...field} data-testid="input-edit-member-email" className="border-[hsl(43_74%_49%)]/30 focus:ring-accent" />
 </FormControl>
 <FormMessage className="text-red-500 text-xs" />
 </FormItem>
 )}
 />
 <FormField
 control={form.control}
 name="phone"
 render={({ field }) => (
 <FormItem>
 <FormLabel className="text-sm font-medium">رقم الهاتف</FormLabel>
 <FormControl>
 <Input placeholder="+966 50 123 4567" type="tel" {...field} data-testid="input-edit-member-phone" className="border-[hsl(43_74%_49%)]/30 focus:ring-accent" />
 </FormControl>
 <FormMessage className="text-red-500 text-xs" />
 </FormItem>
 )}
 />
 <FormField
 control={form.control}
 name="memberRole"
 render={({ field }) => (
 <FormItem>
 <FormLabel className="text-sm font-medium">دور العضو *</FormLabel>
 <Select value={field.value} onValueChange={field.onChange}>
 <FormControl>
 <SelectTrigger data-testid="select-edit-member-role" className="border-[hsl(43_74%_49%)]/30">
 <SelectValue placeholder="اختر دور العضو" />
 </SelectTrigger>
 </FormControl>
 <SelectContent>
 <SelectItem value="chairman">رئيس اللجنة</SelectItem>
 <SelectItem value="vice_chairman">نائب رئيس اللجنة</SelectItem>
 <SelectItem value="specialist_member">عضو متخصص (مقرر)</SelectItem>
 <SelectItem value="member">عضو</SelectItem>
 </SelectContent>
 </Select>
 <FormMessage className="text-red-500 text-xs" />
 </FormItem>
 )}
 />
 <FormField
 control={form.control}
 name="department"
 render={({ field }) => (
 <FormItem>
 <FormLabel className="text-sm font-medium">الإدارة</FormLabel>
 <FormControl>
 <Input placeholder="اختر الإدارة أو اكتبها" {...field} data-testid="input-edit-member-department" className="border-[hsl(43_74%_49%)]/30 focus:ring-accent" />
 </FormControl>
 <FormMessage className="text-red-500 text-xs" />
 </FormItem>
 )}
 />
 <div className="flex gap-3 justify-end pt-4 border-t">
 <Button type="button" variant="outline" onClick={() => { setIsEditDialogOpen(false); setEditingMember(null); }} data-testid="button-cancel-edit-member">
 إلغاء
 </Button>
 <LoadingButton type="submit" className="hub-badge-gold-solid text-muted-foreground hover:hub-badge-gold-solid" data-testid="button-submit-edit-member" loading={updateMemberMutation.isPending} loadingText="جاري التحديث...">
 تحديث العضو
 </LoadingButton>
 </div>
 </form>
 </Form>
 </DialogContent>
 </Dialog>
 <ConfirmDialog {...dialogProps} />
 </DashboardLayout>
 );
}

// Icon component for building
function Building2Icon(props: any) {
 return (
 <svg
 xmlns="http://www.w3.org/2000/svg"
 width="24"
 height="24"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="2"
 strokeLinecap="round"
 strokeLinejoin="round"
 {...props}
 >
 <path d="M3 21h18M3 10h18M5 6h14M7 3h10M9 21v-8h6v8" />
 </svg>
 );
}
