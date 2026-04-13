import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingButton } from "@/components/LoadingButton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { 
 Form,
 FormField,
 FormItem,
 FormLabel,
 FormControl,
 FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, invalidateRelatedQueries } from "@/lib/queryClient";
import { committeeNavGroups } from "@/lib/navigation";
import { votingProposalSchema, type VotingProposalFormData } from "@/lib/schemas";
import {
 FileText, Vote, CheckCircle, BarChart3, Users,
 ThumbsUp, ThumbsDown, Minus, Search, RefreshCw,
 AlertTriangle, Gavel, PieChart, Plus,
 FileDown, FileSpreadsheet} from "lucide-react";
import { exportToPDF, exportToExcel, formatStatus} from '@/lib/exports';
import { PageHeader, KpiCard } from "@/components/Quality";


interface VotingSession {
 id: number;
 number: string;
 title: string;
 status: 'voting' | 'closed' | 'announced';
 votesFor: number;
 votesAgainst: number;
 votesAbstain: number;
 totalVoters: number;
 startDate: string;
 endDate: string;
 proposedBy: string;
 voted?: boolean;
}

function VotingProposalForm({ 
 isOpen, 
 onOpenChange, 
 onSubmit 
}: { 
 isOpen: boolean; 
 onOpenChange: (open: boolean) => void;
 onSubmit: (data: VotingProposalFormData) => void;
}) {
 const form = useForm<VotingProposalFormData>({
 resolver: zodResolver(votingProposalSchema),
 defaultValues: {
 title: "",
 description: "",
 votingType: "majority",
 deadline: "",
 minimumQuorum: "",
 },
 });

 const handleSubmit = (data: VotingProposalFormData) => {
 onSubmit(data);
 form.reset();
 };

 return (
 <Dialog open={isOpen} onOpenChange={onOpenChange}>
 <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <Plus className="w-5 h-5 hub-stat-gold" />
 إنشاء مقترح تصويت جديد
 </DialogTitle>
 </DialogHeader>
 
 <Form {...form}>
 <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
 {/* Title Field */}
 <FormField
 control={form.control}
 name="title"
 render={({ field }) => (
 <FormItem>
 <FormLabel className="text-base font-semibold">عنوان المقترح</FormLabel>
 <FormControl>
 <Input
 placeholder="أدخل عنوان المقترح..."
 {...field}
 className="border-[hsl(43_74%_49%)]/20 focus:border-[hsl(43_74%_49%)] focus:ring-accent/20"
 data-testid="input-proposal-title"
 />
 </FormControl>
 <FormMessage className="text-destructive" />
 </FormItem>
 )}
 />

 {/* Description Field */}
 <FormField
 control={form.control}
 name="description"
 render={({ field }) => (
 <FormItem>
 <FormLabel className="text-base font-semibold">وصف المقترح</FormLabel>
 <FormControl>
 <Textarea
 placeholder="أدخل وصف تفصيلي للمقترح..."
 {...field}
 rows={4}
 className="border-[hsl(43_74%_49%)]/20 focus:border-[hsl(43_74%_49%)] focus:ring-accent/20"
 data-testid="textarea-proposal-description"
 />
 </FormControl>
 <FormMessage className="text-destructive" />
 </FormItem>
 )}
 />

 {/* Voting Type Field */}
 <FormField
 control={form.control}
 name="votingType"
 render={({ field }) => (
 <FormItem>
 <FormLabel className="text-base font-semibold">نوع التصويت</FormLabel>
 <FormControl>
 <select
 {...field}
 className="w-full px-3 py-2 border border-[hsl(43_74%_49%)]/20 rounded-md bg-background focus:border-[hsl(43_74%_49%)] focus:ring-1 focus:ring-accent/20 text-right"
 data-testid="select-voting-type"
 >
 <option value="">اختر نوع التصويت</option>
 <option value="majority">أغلبية البسيطة</option>
 <option value="unanimous">الإجماع</option>
 <option value="weighted">التصويت المرجح</option>
 </select>
 </FormControl>
 <FormMessage className="text-destructive" />
 </FormItem>
 )}
 />

 {/* Deadline Field */}
 <FormField
 control={form.control}
 name="deadline"
 render={({ field }) => (
 <FormItem>
 <FormLabel className="text-base font-semibold">تاريخ انتهاء التصويت</FormLabel>
 <FormControl>
 <Input
 type="datetime-local"
 {...field}
 className="border-[hsl(43_74%_49%)]/20 focus:border-[hsl(43_74%_49%)] focus:ring-accent/20"
 data-testid="input-proposal-deadline"
 />
 </FormControl>
 <FormMessage className="text-destructive" />
 </FormItem>
 )}
 />

 {/* Minimum Quorum Field */}
 <FormField
 control={form.control}
 name="minimumQuorum"
 render={({ field }) => (
 <FormItem>
 <FormLabel className="text-base font-semibold">النصاب الأدنى (اختياري)</FormLabel>
 <FormControl>
 <Input
 type="number"
 placeholder="أدخل النصاب الأدنى..."
 {...field}
 className="border-[hsl(43_74%_49%)]/20 focus:border-[hsl(43_74%_49%)] focus:ring-accent/20"
 data-testid="input-minimum-quorum"
 />
 </FormControl>
 <FormMessage className="text-destructive" />
 </FormItem>
 )}
 />

 {/* Action Buttons */}
 <div className="flex gap-3 justify-end pt-4 border-t border-[hsl(43_74%_49%)]/20">
 <Button
 type="button"
 variant="outline"
 onClick={() => onOpenChange(false)}
 data-testid="button-cancel-proposal"
 >
 إلغاء
 </Button>
 <LoadingButton
 type="submit"
 className="hub-badge-gold-solid text-muted-foreground hover:hub-badge-gold-solid"
 loading={form.formState.isSubmitting}
 loadingText="جاري الحفظ..."
 data-testid="button-submit-proposal"
 >
 إنشاء المقترح
 </LoadingButton>
 </div>
 </form>
 </Form>
 </DialogContent>
 </Dialog>
 );
}

function VotingSessionCard({ session, onVote, onClose }: { session: VotingSession; onVote: (id: number, vote: 'approve' | 'reject' | 'abstain') => void; onClose?: (id: number) => void }) {
 const totalVotes = session.votesFor + session.votesAgainst + session.votesAbstain;
 const approvalPercentage = totalVotes > 0 ? Math.round(session.votesFor / totalVotes * 100) : 0;
 const rejectionPercentage = totalVotes > 0 ? Math.round(session.votesAgainst / totalVotes * 100) : 0;
 const abstainPercentage = totalVotes > 0 ? Math.round(session.votesAbstain / totalVotes * 100) : 0;
 const participationPercentage = session.totalVoters > 0 ? Math.round(totalVotes / session.totalVoters * 100) : 0;

 return (
 <Card className="card-premium border-[hsl(43_74%_49%)]/20 hover:border-[hsl(43_74%_49%)]/40 transition-all duration-300 hover:shadow-lg hover:shadow-accent/10">
 <CardHeader className="pb-3">
 <div className="flex items-start justify-between">
 <div className="flex-1">
 <div className="flex items-center gap-2 mb-1">
 <Badge className={`${
 session.status === 'voting' ? 'hub-badge-gold-solid text-muted-foreground' :
 session.status === 'closed' ? 'bg-muted/30 text-muted-foreground' :
 'hub-icon-gold hub-stat-gold'
 }`}>
 {session.status === 'voting' && <Vote className="w-3 h-3 ml-1" />}
 {session.status === 'voting' ? 'تصويت نشط' : session.status === 'closed' ? 'مغلق' : 'معلن'}
 </Badge>
 <span className="text-xs text-muted-foreground">{session.number}</span>
 </div>
 <h3 className="font-semibold text-muted-foreground line-clamp-2">{session.title}</h3>
 <p className="text-sm text-muted-foreground mt-1">من قبل: {session.proposedBy}</p>
 </div>
 </div>
 </CardHeader>

 <CardContent className="space-y-4">
 {/* Voting Results */}
 <div className="space-y-3">
 <div className="space-y-1">
 <div className="flex items-center justify-between text-sm">
 <span className="flex items-center gap-1 font-medium hub-stat-gold">
 <ThumbsUp className="w-4 h-4" />
 موافق
 </span>
 <span className="font-semibold">{session.votesFor} ({approvalPercentage}%)</span>
 </div>
 <div className="h-2 bg-muted rounded-full overflow-hidden">
 <div
 className="h-full bg-gradient-to-r from-accent to-accent rounded-full transition-all duration-500"
 style={{ width: `${approvalPercentage}%` }}
 />
 </div>
 </div>

 <div className="space-y-1">
 <div className="flex items-center justify-between text-sm">
 <span className="flex items-center gap-1 font-medium text-muted-foreground">
 <ThumbsDown className="w-4 h-4" />
 معارض
 </span>
 <span className="font-semibold">{session.votesAgainst} ({rejectionPercentage}%)</span>
 </div>
 <div className="h-2 bg-muted rounded-full overflow-hidden">
 <div
 className="h-full bg-gradient-to-r from-primary to-primary rounded-full transition-all duration-500"
 style={{ width: `${rejectionPercentage}%` }}
 />
 </div>
 </div>

 <div className="space-y-1">
 <div className="flex items-center justify-between text-sm">
 <span className="flex items-center gap-1 font-medium text-muted-foreground">
 <Minus className="w-4 h-4" />
 ممتنع
 </span>
 <span className="font-semibold">{session.votesAbstain} ({abstainPercentage}%)</span>
 </div>
 <div className="h-2 bg-muted rounded-full overflow-hidden">
 <div
 className="h-full bg-gradient-to-r from-muted-foreground/40 to-muted-foreground/60 rounded-full transition-all duration-500"
 style={{ width: `${abstainPercentage}%` }}
 />
 </div>
 </div>
 </div>

 {/* Participation Rate */}
 <div className="p-3 bg-muted/30 rounded-lg border border-white/[0.06]">
 <div className="flex items-center justify-between text-sm mb-2">
 <span className="flex items-center gap-1 text-muted-foreground">
 <Users className="w-4 h-4" />
 معدل المشاركة
 </span>
 <span className="font-semibold text-muted-foreground">{totalVotes}/{session.totalVoters} ({participationPercentage}%)</span>
 </div>
 <Progress value={participationPercentage} className="h-1.5" />
 </div>

 {/* Voting Actions */}
 {session.status === 'voting' && !session.voted && (
 <div className="space-y-2 pt-2 border-t border-white/[0.06]">
   <div className="grid grid-cols-3 gap-2">
     <Button
     size="sm"
     className="hub-badge-gold-solid text-muted-foreground hover:hub-badge-gold-solid gap-1"
     onClick={() => onVote(session.id, 'approve')}
     data-testid={`vote-approve-${session.id}`}
     >
     <ThumbsUp className="w-3.5 h-3.5" />
     موافق
     </Button>
     <Button
     size="sm"
     variant="outline"
     className="gap-1"
     onClick={() => onVote(session.id, 'reject')}
     data-testid={`vote-reject-${session.id}`}
     >
     <ThumbsDown className="w-3.5 h-3.5" />
     معارض
     </Button>
     <Button
     size="sm"
     variant="outline"
     className="gap-1"
     onClick={() => onVote(session.id, 'abstain')}
     data-testid={`vote-abstain-${session.id}`}
     >
     <Minus className="w-3.5 h-3.5" />
     ممتنع
     </Button>
   </div>
   {onClose && (
     <Button
       size="sm"
       variant="outline"
       className="w-full gap-1 text-muted-foreground hover:bg-muted/50"
       onClick={() => onClose(session.id)}
       data-testid={`button-close-session-${session.id}`}
     >
       <Gavel className="w-3.5 h-3.5" />
       إغلاق التصويت وإعلان النتيجة
     </Button>
   )}
 </div>
 )}
 {session.voted && (
 <div className="p-2 hub-icon-gold rounded-lg border border-[hsl(43_74%_49%)]/30 text-center">
 <p className="text-xs font-medium hub-stat-gold">✓ تم تسجيل تصويتك</p>
 </div>
 )}
 </CardContent>
 </Card>
 );
}

export default function CommitteeVoting() {
 const { toast } = useToast();
 const [searchQuery, setSearchQuery] = useState("");
 const [statusFilter, setStatusFilter] = useState("all");
 const [selectedSession, setSelectedSession] = useState<VotingSession | null>(null);
 const [isDetailsOpen, setIsDetailsOpen] = useState(false);
 const [isProposalFormOpen, setIsProposalFormOpen] = useState(false);

 const { data: apiSessions = [], isLoading, refetch } = useQuery<any[]>({
 queryKey: ['/api/voting-sessions'],
 });

 const { data: committeeMembers = [] } = useQuery<any[]>({
 queryKey: ['/api/committee-members'],
 });

 const totalVoterCount = (committeeMembers as any[]).filter((m: any) => m.isActive !== false && m.canVote !== false).length || (committeeMembers as any[]).length;

 // Transform API data to display format
 const displaySessions: VotingSession[] = apiSessions.map((s: any) => ({
 id: s.id,
 number: `TS-${new Date().getFullYear()}-${String(s.id).padStart(3, '0')}`,
 title: s.title,
 status: s.status === 'draft' ? 'voting' : s.status === 'closed' ? 'closed' : s.status === 'announced' ? 'announced' : 'voting',
 votesFor: s.votesFor || 0,
 votesAgainst: s.votesAgainst || 0,
 votesAbstain: s.votesAbstain || 0,
 totalVoters: s.quorumRequired || totalVoterCount || 0,
 startDate: s.startDate ? new Date(s.startDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
 endDate: s.endDate ? new Date(s.endDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
 proposedBy: s.createdBy ? `عضو #${s.createdBy}` : 'مكتب اللجنة',
 voted: false
 }));

 const closeSessionMutation = useMutation({
 mutationFn: async (id: number) => {
   return apiRequest('PUT', `/api/voting-sessions/${id}/finalize`, {});
 },
 onSuccess: () => {
   toast({ title: 'تم إغلاق التصويت بنجاح', description: 'تم تسجيل نتائج التصويت وإغلاق الجلسة' });
   queryClient.invalidateQueries({ queryKey: ['/api/voting-sessions'] });
   invalidateRelatedQueries('/api/voting-sessions');
 },
 onError: () => {
   toast({ title: 'خطأ', description: 'حدث خطأ أثناء إغلاق جلسة التصويت', variant: 'destructive' });
 },
 });

 const createProposalMutation = useMutation({
 mutationFn: async (data: VotingProposalFormData) => {
 return apiRequest('POST', '/api/voting-sessions', {
 title: data.title,
 description: data.description,
 votingType: data.votingType,
 endDate: data.deadline,
 quorumRequired: data.minimumQuorum ? parseInt(String(data.minimumQuorum)) : 50
 });
 },
 onSuccess: () => {
 toast({ 
 title: 'تم إنشاء المقترح بنجاح', 
 description: 'تم إضافة مقترح التصويت الجديد إلى النظام' 
 });
 setIsProposalFormOpen(false);
 queryClient.invalidateQueries({ queryKey: ['/api/voting-sessions'] });
 invalidateRelatedQueries('/api/voting-sessions');
 },
 onError: (error: any) => {
 toast({ 
 title: 'خطأ', 
 description: error?.message || 'حدث خطأ أثناء إنشاء المقترح', 
 variant: 'destructive' 
 });
 },
 });

 const castVoteMutation = useMutation({
 mutationFn: async (data: { sessionId: number; vote: 'approve' | 'reject' | 'abstain' }) => {
 return apiRequest('POST', `/api/voting-sessions/${data.sessionId}/vote`, { vote: data.vote });
 },
 onSuccess: () => {
 toast({ title: 'تم تسجيل تصويتك بنجاح', description: 'شكراً لمشاركتك في التصويت' });
 queryClient.invalidateQueries({ queryKey: ['/api/voting-sessions'] });
 invalidateRelatedQueries('/api/voting-sessions');
 },
 onError: () => {
 toast({ title: 'خطأ', description: 'حدث خطأ أثناء تسجيل التصويت', variant: 'destructive' });
 },
 });

 const handleVote = (sessionId: number, vote: 'approve' | 'reject' | 'abstain') => {
 castVoteMutation.mutate({ sessionId, vote });
 };

 const handleCreateProposal = (data: VotingProposalFormData) => {
 createProposalMutation.mutate(data);
 };

 const filteredSessions = displaySessions.filter((session) => {
 const matchesSearch = session.title.includes(searchQuery) || session.number.includes(searchQuery);
 const matchesStatus = statusFilter === 'all' || session.status === statusFilter;
 return matchesSearch && matchesStatus;
 });

 const stats = {
 activeVoting: displaySessions.filter(s => s.status === 'voting').length,
 closedVoting: displaySessions.filter(s => s.status === 'closed').length,
 announced: displaySessions.filter(s => s.status === 'announced').length,
 totalParticipation: displaySessions.reduce((acc, s) => acc + (s.votesFor + s.votesAgainst + s.votesAbstain), 0),
 };


 const handleExportPDF = () => {
 exportToPDF({
 title: 'تقرير التصويت',
 subtitle: 'JCSA - Control Hub',
 columns: [{"header":"الموضوع","key":"title","width":40},{"header":"النوع","key":"type","width":25},{"header":"الحالة","key":"status","width":20},{"header":"الأصوات","key":"votes","width":20}],
 data: (filteredSessions || apiSessions || []).map((item: any) => ({ title: item.title || '', type: item.type || '', status: formatStatus(item.status || ''), votes: (item.votesFor || 0) + '/' + (item.totalVoters || 0) })),
 filename: 'committee-voting-report',
 orientation: 'landscape',
 });
 };

 const handleExportExcel = () => {
 exportToExcel({
 title: 'تقرير التصويت',
 columns: [{"header":"الموضوع","key":"title","width":40},{"header":"النوع","key":"type","width":25},{"header":"الحالة","key":"status","width":20},{"header":"الأصوات","key":"votes","width":20}],
 data: (filteredSessions || apiSessions || []).map((item: any) => ({ title: item.title || '', type: item.type || '', status: formatStatus(item.status || ''), votes: (item.votesFor || 0) + '/' + (item.totalVoters || 0) })),
 filename: 'committee-voting-report',
 });
 };

 return (
 <DashboardLayout
 title="نظام التصويت"
 subtitle="إدارة وتتبع التصويتات في لجنة حوكمة البيانات"
 navGroups={committeeNavGroups}
 portalName="اللجنة"
 >
 <div className="space-y-5">
 <PageHeader
   icon={Vote}
   title="التصويت والاقتراع"
   subtitle="إدارة جلسات التصويت ومتابعة نتائجها"
   actions={
     <>
       <div className="relative">
         <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
         <Input placeholder="بحث في جلسات التصويت..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pr-10 h-9 text-sm w-44 bg-background" data-testid="input-search-sessions" />
       </div>
       <Select value={statusFilter} onValueChange={setStatusFilter}>
         <SelectTrigger className="w-36 h-9 text-sm" data-testid="select-status-filter"><SelectValue placeholder="الحالة" /></SelectTrigger>
         <SelectContent>
           <SelectItem value="all">جميع الحالات</SelectItem>
           <SelectItem value="voting">تصويت نشط</SelectItem>
           <SelectItem value="closed">مغلق</SelectItem>
           <SelectItem value="announced">معلن</SelectItem>
         </SelectContent>
       </Select>
       <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => refetch()} data-testid="button-refresh-sessions"><RefreshCw className="w-3.5 h-3.5" /></Button>
       <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportPDF} data-testid="button-export-pdf"><FileDown className="w-3.5 h-3.5" />PDF</Button>
       <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportExcel} data-testid="button-export-excel"><FileSpreadsheet className="w-3.5 h-3.5" />Excel</Button>
       <Button className="btn-gold h-9 gap-1.5 text-xs" onClick={() => setIsProposalFormOpen(true)} data-testid="button-create-proposal"><Plus className="w-3.5 h-3.5" />مقترح جديد</Button>
     </>
   }
 />
 <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
   <KpiCard
     label="التصويتات النشطة"
     value={stats.activeVoting}
     icon={Vote}
     color="gold"
     sublabel="جلسات تصويت مفتوحة الآن"
     active={statusFilter === "voting"}
     onClick={() => setStatusFilter(statusFilter === "voting" ? "all" : "voting")}
     data-testid="kpi-active-voting"
   />
   <KpiCard
     label="التصويتات المغلقة"
     value={stats.closedVoting}
     icon={CheckCircle}
     color="success"
     sublabel="اكتمل التصويت عليها"
     active={statusFilter === "closed"}
     onClick={() => setStatusFilter(statusFilter === "closed" ? "all" : "closed")}
     data-testid="kpi-closed-voting"
   />
   <KpiCard
     label="المعلنة"
     value={stats.announced}
     icon={AlertTriangle}
     color="navy"
     sublabel="نتائج معلنة رسمياً"
     active={statusFilter === "announced"}
     onClick={() => setStatusFilter(statusFilter === "announced" ? "all" : "announced")}
     data-testid="kpi-announced-voting"
   />
   <KpiCard
     label="إجمالي الأصوات"
     value={stats.totalParticipation}
     icon={BarChart3}
     color="info"
     sublabel="مجموع أصوات جميع الجلسات"
     data-testid="kpi-total-votes"
   />
 </div>

 {/* Active Voting Sessions */}
 <div className="space-y-4">
 <div className="flex items-center gap-2">
 <div className="w-1 h-6 hub-badge-gold-solid rounded-full" />
 <h2 className="text-xl font-bold">جلسات التصويت</h2>
 </div>

 {isLoading ? (
 <div className="grid grid-cols-1 gap-4">
 {[1, 2, 3, 4].map((i) => (
 <Card key={i} className="card-premium animate-pulse">
 <CardContent className="p-6">
 <div className="space-y-3">
 <div className="h-4 bg-muted rounded w-3/4" />
 <div className="h-2 bg-muted rounded w-full" />
 <div className="h-2 bg-muted rounded w-full" />
 </div>
 </CardContent>
 </Card>
 ))}
 </div>
 ) : filteredSessions.length > 0 ? (
 <div className="grid grid-cols-1 gap-4">
 {filteredSessions.map((session) => (
 <div
 key={session.id}
 onClick={() => {
 setSelectedSession(session);
 setIsDetailsOpen(true);
 }}
 className=""
 >
 <VotingSessionCard session={session} onVote={handleVote} onClose={(id) => closeSessionMutation.mutate(id)} />
 </div>
 ))}
 </div>
 ) : (
 <Card className="card-premium">
 <CardContent className="p-12 text-center">
 <PieChart className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
 <p className="text-muted-foreground">لا توجد جلسات تصويت متطابقة</p>
 </CardContent>
 </Card>
 )}
 </div>

 {/* Session Details Modal */}
 <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
 <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
 <DialogHeader>
 <DialogTitle>{selectedSession?.title}</DialogTitle>
 </DialogHeader>
 {selectedSession && (
 <div className="space-y-4">
 <div className="grid grid-cols-2 gap-4 text-sm">
 <div>
 <p className="text-muted-foreground">الرقم</p>
 <p className="font-semibold">{selectedSession.number}</p>
 </div>
 <div>
 <p className="text-muted-foreground">الحالة</p>
 <Badge className={`${
 selectedSession.status === 'voting' ? 'hub-badge-gold-solid text-muted-foreground' :
 selectedSession.status === 'closed' ? 'bg-muted/30' :
 'hub-icon-gold'
 }`}>
 {selectedSession.status === 'voting' ? 'تصويت نشط' : selectedSession.status === 'closed' ? 'مغلق' : 'معلن'}
 </Badge>
 </div>
 <div>
 <p className="text-muted-foreground">المقترح من</p>
 <p className="font-semibold">{selectedSession.proposedBy}</p>
 </div>
 <div>
 <p className="text-muted-foreground">فترة التصويت</p>
 <p className="font-semibold text-xs">{selectedSession.startDate} - {selectedSession.endDate}</p>
 </div>
 </div>
 </div>
 )}
 </DialogContent>
 </Dialog>

 {/* Voting Proposal Creation Form */}
 <VotingProposalForm 
 isOpen={isProposalFormOpen}
 onOpenChange={setIsProposalFormOpen}
 onSubmit={handleCreateProposal}
 />
 </div>
 </DashboardLayout>
 );
}
