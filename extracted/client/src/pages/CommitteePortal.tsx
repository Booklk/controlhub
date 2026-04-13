import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { exportToPDF, exportToExcel, formatStatus} from '@/lib/exports';
import DashboardLayout from "@/components/DashboardLayout";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { SmartDailyOps } from '@/components/SmartDailyOps';
import { SmartBookmarks } from '@/components/SmartBookmarks';
import { QuickNotes } from '@/components/QuickNotes';
import { WelcomeBanner } from '@/components/WelcomeBanner';
import MyDayWidget from '@/components/MyDayWidget';
import { committeeNavGroups } from "@/lib/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { FormSuccessPanel, FieldHint } from "@/components/ui/form-guide";
import { FileAttachment, type FileAttachmentData } from "@/components/FileAttachment";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Vote,
  Users,
  Calendar,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  Settings,
  RefreshCw,
  BarChart3,
  Gavel,
  ClipboardCheck,
  Eye,
  ThumbsUp,
  ThumbsDown,
  TrendingUp,
  Sparkles,
  FileDown,
  FileSpreadsheet,
  XCircle,
  Search,
} from "lucide-react";


function StatCardSkeleton() {
  return (
    <Card className="stat-card pl-4">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-8 w-16" /></div>
          <Skeleton className="h-12 w-12 rounded-lg" />
        </div>
      </CardContent>
    </Card>
  );
}

function DecisionCardSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl">
      <Skeleton className="h-10 w-10 rounded-lg" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between"><Skeleton className="h-5 w-40" /><Skeleton className="h-5 w-16 rounded-full" /></div>
        <Skeleton className="h-4 w-full" />
      </div>
      <Skeleton className="h-8 w-8 rounded-lg" />
    </div>
  );
}

function ListItemSkeleton({ circle }: { circle?: boolean }) {
  return (
    <div className="flex items-center gap-3 p-3 border-b last:border-0">
      <Skeleton className={`h-10 w-10 ${circle ? 'rounded-full' : 'rounded-lg'}`} />
      <div className="flex-1 space-y-1"><Skeleton className="h-4 w-28" /><Skeleton className="h-3 w-20" /></div>
      <Skeleton className="h-5 w-14 rounded-full" />
    </div>
  );
}

function DashboardStat({ label, value, icon: Icon, gold, testId, delay, children, urgent, accent }: { label: string; value: number; icon: any; gold?: boolean; testId: string; delay: string; children?: any; urgent?: boolean; accent?: string }) {
  const stripeColor = urgent && value > 0 ? 'bg-red-500' : gold ? 'bg-amber-400/70' : accent ? accent : 'bg-primary/30';
  const iconBg = urgent && value > 0 ? 'bg-red-500/15' : gold ? 'bg-amber-400/15' : 'bg-primary/10';
  const iconColor = urgent && value > 0 ? 'text-red-500' : gold ? 'hub-stat-gold' : 'text-foreground dark:text-white';
  const valueColor = urgent && value > 0 ? 'text-red-500' : gold ? 'hub-stat-gold' : 'text-foreground dark:text-white';
  return (
    <Card className={`hub-card hub-card-hover fadeInUp relative overflow-hidden ${urgent && value > 0 ? 'hub-critical-pulse' : ''}`} style={{ animationDelay: delay }}>
      <div className={`absolute inset-y-0 right-0 w-[3px] rounded-l-sm ${stripeColor}`} />
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-xs text-muted-foreground font-medium leading-tight">{label}</p>
          <div className={`p-2 rounded-lg ${iconBg}`}>
            <Icon className={`w-4 h-4 ${iconColor}`} />
          </div>
        </div>
        <AnimatedNumber value={value} className={`text-3xl font-bold hub-stat-number ${valueColor}`} data-testid={testId} />
        {children}
      </CardContent>
    </Card>
  );
}

function VoteBar({ label, icon: Icon, count, pct, colorClass, gradientClass }: { label: string; icon: any; count: number; pct: number; colorClass: string; gradientClass: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className={`flex items-center gap-1 ${colorClass}`}><Icon className="w-3.5 h-3.5" />{label}</span>
        <span className="font-medium">{count} ({pct}%)</span>
      </div>
      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${gradientClass} rounded-full transition-all duration-700 ease-out`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function VotingProgressCard({ decision, onVote }: { decision: any; onVote: (id: number, vote: 'approve' | 'reject') => void }) {
  const totalVotes = (decision.votesFor || 0) + (decision.votesAgainst || 0);
  const approvalPct = totalVotes > 0 ? Math.round((decision.votesFor || 0) / totalVotes * 100) : 0;
  const rejectionPct = totalVotes > 0 ? Math.round((decision.votesAgainst || 0) / totalVotes * 100) : 0;
  return (
    <div className="p-5 bg-gradient-to-br from-[hsl(222_47%_11%)]/5 to-[hsl(43_74%_49%)]/5 rounded-xl border border-[hsl(222_47%_11%)]/10 hover:border-[hsl(43_74%_49%)]/30 transition-all duration-300">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Vote className="w-4 h-4 hub-stat-gold" />
            <span className="font-semibold text-foreground">{decision.title}</span>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2">{decision.description}</p>
        </div>
        <Badge className="bg-[hsl(43_74%_49%)]/20 hub-stat-gold border-[hsl(43_74%_49%)]/30">
          <Sparkles className="w-3 h-3 ml-1" />
          تصويت نشط
        </Badge>
      </div>
      <div className="space-y-3 mb-4">
        <VoteBar label="موافق" icon={ThumbsUp} count={decision.votesFor || 0} pct={approvalPct} colorClass="hub-stat-gold" gradientClass="bg-gradient-to-r from-[hsl(43_74%_49%)] to-[hsl(43_74%_55%)]" />
        <VoteBar label="رافض" icon={ThumbsDown} count={decision.votesAgainst || 0} pct={rejectionPct} colorClass="text-foreground" gradientClass="bg-gradient-to-r from-[hsl(222_47%_11%)] to-[hsl(222_47%_20%)]" />
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-[hsl(222_47%_11%)]/10">
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Users className="w-3.5 h-3.5" /><span>{totalVotes} صوت</span></div>
        <div className="flex gap-2">
          <Button size="sm" className="btn-gold gap-1" onClick={() => onVote(decision.id, 'approve')} data-testid={`vote-approve-${decision.id}`}><ThumbsUp className="w-3.5 h-3.5" />موافق</Button>
          <Button size="sm" className="btn-navy-outline gap-1" onClick={() => onVote(decision.id, 'reject')} data-testid={`vote-reject-${decision.id}`}><ThumbsDown className="w-3.5 h-3.5" />رفض</Button>
        </div>
      </div>
    </div>
  );
}

export default function CommitteePortal() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isAddDecisionOpen, setIsAddDecisionOpen] = useState(false);
  const [isViewDecisionOpen, setIsViewDecisionOpen] = useState(false);
  const [selectedDecision, setSelectedDecision] = useState<any>(null);
  const [newDecision, setNewDecision] = useState({ title: '', description: '', type: '' });
  const [decisionAttachments, setDecisionAttachments] = useState<FileAttachmentData[]>([]);
  const [successDecision, setSuccessDecision] = useState<{ id: number; title: string } | null>(null);

  const { data: decisions = [], isLoading: decisionsLoading, refetch: refetchDecisions, dataUpdatedAt: dashboardUpdatedAt } = useQuery<any[]>({
    queryKey: ['/api/committee/decisions'],
    refetchInterval: 2 * 60 * 1000,
    staleTime: 60 * 1000,
  });

  const { data: meetings = [], isLoading: meetingsLoading } = useQuery<any[]>({
    queryKey: ['/api/committee-meetings'],
    refetchInterval: 3 * 60 * 1000,
  });

  const { data: members = [], isLoading: membersLoading } = useQuery<any[]>({
    queryKey: ['/api/committee-members'],
    staleTime: 5 * 60 * 1000,
  });

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery<{
    decisions: { total: number; approved: number; rejected: number; pending: number; inReview: number };
    meetings: { total: number; scheduled: number; completed: number };
    members: { total: number; active: number };
    votes: { total: number };
    minutes: { total: number };
  }>({
    queryKey: ['/api/dashboard/committee'],
    refetchInterval: 2 * 60 * 1000,
    staleTime: 60 * 1000,
  });

  const createDecisionMutation = useMutation({
    mutationFn: async (data: { title: string; description: string; type: string }) => {
      const res = await apiRequest('POST', '/api/committee/decisions', data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/committee/decisions'] });
      setSuccessDecision({ id: data.id, title: newDecision.title });
      setNewDecision({ title: '', description: '', type: '' });
      setDecisionAttachments([]);
    },
    onError: (error: Error) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });

  const handleCreateDecision = () => {
    if (!newDecision.title.trim()) {
      toast({ title: 'تنبيه', description: 'يرجى إدخال عنوان القرار', variant: 'destructive' });
      return;
    }
    if (!newDecision.type) {
      toast({ title: 'تنبيه', description: 'يرجى اختيار نوع القرار', variant: 'destructive' });
      return;
    }
    createDecisionMutation.mutate({ ...newDecision, attachments: decisionAttachments } as any);
  };

  const handleViewDecision = (decision: any) => {
    setSelectedDecision(decision);
    setIsViewDecisionOpen(true);
  };

  const voteMutation = useMutation({
    mutationFn: async ({ decisionId, vote }: { decisionId: number; vote: 'approve' | 'reject' }) => {
      const res = await apiRequest('POST', `/api/committee/decisions/${decisionId}/vote`, { vote });
      return res.json();
    },
    onSuccess: (_, variables) => {
      toast({
        title: variables.vote === 'approve' ? 'تم التصويت بالموافقة' : 'تم التصويت بالرفض',
        description: 'تم تسجيل صوتك بنجاح'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/committee/decisions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/committee'] });
    },
    onError: (error: Error) => {
      const msg = error.message || 'حدث خطأ أثناء التصويت';
      toast({ title: 'خطأ', description: msg.includes('مسبقاً') ? 'لقد قمت بالتصويت مسبقاً' : msg, variant: 'destructive' });
    },
  });

  const handleVote = (decisionId: number, vote: 'approve' | 'reject') => {
    voteMutation.mutate({ decisionId, vote });
  };

  const isLoading = decisionsLoading || meetingsLoading || membersLoading;

  const stats = {
    totalDecisions: decisions.length,
    pendingDecisions: decisions.filter((d: any) => d.status === 'pending' || d.status === 'under_review').length,
    approvedDecisions: decisions.filter((d: any) => d.status === 'approved').length,
    upcomingMeetings: meetings.filter((m: any) => new Date(m.date) > new Date()).length,
    totalMembers: members.length,
    activeVotings: decisions.filter((d: any) => d.status === 'voting').length,
  };

  const activeVotingDecisions = decisions.filter((d: any) => d.status === 'voting');

  return (
    <DashboardLayout 
      title="بوابة اللجنة" 
      subtitle="بوابة لجنة حوكمة البيانات"
      navGroups={committeeNavGroups}
      portalName="اللجنة"
    >
      <div className="space-y-6">
        <WelcomeBanner portal="committee" />
        <MyDayWidget portal="committee" />
        <SmartDailyOps
          portal="committee"
          portalLabel="اللجنة"
          onNavigate={setLocation}
          ticketsPath="/committee/tasks"
          tasksPath="/committee/tasks"
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SmartBookmarks portal="committee" onNavigate={setLocation} />
          <QuickNotes portal="committee" />
        </div>
        <div className="flex items-center justify-between fadeInUp" style={{ animationDelay: '0ms' }}>
          <div>
            <h1 className="text-2xl font-bold text-foreground dark:text-white flex items-center gap-2">
              مرحباً، {user?.name || 'المستخدم'}
              <Sparkles className="w-5 h-5 hub-stat-gold" />
            </h1>
            <div className="flex items-center gap-2">
              <p className="text-muted-foreground text-sm">لوحة تحكم لجنة حوكمة البيانات</p>
              {dashboardUpdatedAt > 0 && (
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground/50 bg-muted/40 px-2 py-0.5 rounded-full border border-border/30">
                  ⟳ آخر تحديث {new Date(dashboardUpdatedAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => {
              const data = decisions.map((d: any) => ({
                title: d.title || '',
                description: d.description || '',
                type: d.type || '',
                status: formatStatus(d.status || ''),
                createdAt: d.createdAt ? new Date(d.createdAt).toLocaleDateString('ar-SA') : '',
              }));
              const columns = [
                { header: 'القرار', key: 'title' },
                { header: 'الوصف', key: 'description' },
                { header: 'النوع', key: 'type' },
                { header: 'الحالة', key: 'status' },
                { header: 'التاريخ', key: 'createdAt' },
              ];
              exportToPDF({ data, columns, title: 'تقرير قرارات اللجنة', filename: 'committee-report', orientation: 'landscape' });
            }} data-testid="button-export-pdf">
              <FileDown className="w-4 h-4 ml-2" />
              PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              const data = decisions.map((d: any) => ({
                title: d.title || '',
                description: d.description || '',
                type: d.type || '',
                status: formatStatus(d.status || ''),
                createdAt: d.createdAt ? new Date(d.createdAt).toLocaleDateString('ar-SA') : '',
              }));
              const columns = [
                { header: 'القرار', key: 'title' },
                { header: 'الوصف', key: 'description' },
                { header: 'النوع', key: 'type' },
                { header: 'الحالة', key: 'status' },
                { header: 'التاريخ', key: 'createdAt' },
              ];
              exportToExcel({ data, columns, title: 'تقرير قرارات اللجنة', filename: 'committee-report' });
            }} data-testid="button-export-excel">
              <FileSpreadsheet className="w-4 h-4 ml-2" />
              Excel
            </Button>
            <Button 
              className="btn-navy-outline" 
              size="sm" 
              onClick={() => refetchDecisions()} 
              data-testid="button-refresh"
            >
              <RefreshCw className="w-4 h-4 ml-2" />
              تحديث
            </Button>
            <Button 
              className="btn-gold" 
              size="sm" 
              onClick={() => setIsAddDecisionOpen(true)} 
              data-testid="button-new-decision"
            >
              <Plus className="w-4 h-4 ml-2" />
              قرار جديد
            </Button>
          </div>
        </div>

        {dashboardLoading ? (
          <div className="space-y-4 fadeInUp" style={{ animationDelay: '30ms' }}>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {Array.from({ length: 5 }).map((_, i) => <StatCardSkeleton key={i} />)}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
            </div>
          </div>
        ) : dashboardData ? (
          <div className="space-y-4" data-testid="committee-dashboard-overview">
            <h2 className="text-lg font-semibold text-foreground dark:text-white flex items-center gap-2 fadeInUp" style={{ animationDelay: '30ms' }}>
              <BarChart3 className="w-5 h-5 hub-stat-gold" />
              نظرة عامة على اللجنة
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4" data-testid="committee-decisions-overview">
              <DashboardStat label="اجمالي القرارات" value={dashboardData.decisions.total} icon={Gavel} testId="stat-decisions-total" delay="40ms" accent="bg-primary/40" />
              <DashboardStat label="معتمدة" value={dashboardData.decisions.approved} icon={CheckCircle2} testId="stat-decisions-approved" delay="60ms" accent="bg-emerald-500" />
              <DashboardStat label="مرفوضة" value={dashboardData.decisions.rejected} icon={XCircle} testId="stat-decisions-rejected" delay="80ms" urgent />
              <DashboardStat label="معلقة" value={dashboardData.decisions.pending} icon={Clock} gold testId="stat-decisions-pending" delay="100ms" />
              <DashboardStat label="قيد المراجعة" value={dashboardData.decisions.inReview} icon={Search} testId="stat-decisions-inreview" delay="120ms" accent="bg-blue-400/60" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="committee-activity-summary">
              <DashboardStat label="الاجتماعات" value={dashboardData.meetings.total} icon={Calendar} testId="stat-meetings-total" delay="140ms">
                {dashboardData.meetings.scheduled > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    <Calendar className="w-3 h-3 hub-stat-gold" />
                    <span className="text-xs hub-stat-gold" data-testid="stat-meetings-scheduled">{dashboardData.meetings.scheduled} مجدولة</span>
                  </div>
                )}
              </DashboardStat>
              <DashboardStat label="الاعضاء النشطون" value={dashboardData.members.active} icon={Users} gold testId="stat-members-active" delay="160ms" />
              <DashboardStat label="اجمالي التصويتات" value={dashboardData.votes.total} icon={Vote} testId="stat-votes-total" delay="180ms" />
              <DashboardStat label="محاضر الجلسات" value={dashboardData.minutes.total} icon={FileText} gold testId="stat-minutes-total" delay="200ms" />
            </div>

            {dashboardData.meetings.scheduled > 0 && (
              <Card className="border-[hsl(43_74%_49%)]/30 bg-[hsl(43_74%_49%)]/5 fadeInUp" style={{ animationDelay: '220ms' }}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="hub-icon-gold">
                      <Calendar className="w-5 h-5 hub-stat-gold" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground dark:text-white" data-testid="text-upcoming-meetings">
                        {dashboardData.meetings.scheduled} اجتماع قادم مجدول
                      </p>
                      <p className="text-sm text-muted-foreground">يرجى مراجعة جدول الاجتماعات القادمة</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {isLoading ? (
            <>
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </>
          ) : (
            <>
              <Card className="hub-card hub-card-hover fadeInUp relative overflow-hidden" style={{ animationDelay: '50ms' }}>
                <div className="absolute inset-y-0 right-0 w-[3px] bg-primary/40" />
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-xs text-muted-foreground font-medium">إجمالي القرارات</p>
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Gavel className="w-4 h-4 text-foreground dark:text-white" />
                    </div>
                  </div>
                  <p className="text-3xl font-bold hub-stat-number text-foreground dark:text-white">{stats.totalDecisions}</p>
                  <p className="text-[10px] text-muted-foreground/50 mt-1">{stats.activeVotings} تحت التصويت</p>
                </CardContent>
              </Card>

              <Card className="hub-card hub-card-hover fadeInUp relative overflow-hidden" style={{ animationDelay: '100ms' }}>
                <div className="absolute inset-y-0 right-0 w-[3px] bg-amber-400/70" />
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-xs text-muted-foreground font-medium">قرارات معلقة</p>
                    <div className="p-2 bg-amber-400/15 rounded-lg">
                      <Clock className="w-4 h-4 hub-stat-gold" />
                    </div>
                  </div>
                  <p className="text-3xl font-bold hub-stat-number hub-stat-gold">{stats.pendingDecisions}</p>
                  <p className="text-[10px] text-muted-foreground/50 mt-1">تحتاج مراجعة</p>
                </CardContent>
              </Card>

              <Card className="hub-card hub-card-hover fadeInUp relative overflow-hidden" style={{ animationDelay: '150ms' }}>
                <div className="absolute inset-y-0 right-0 w-[3px] bg-emerald-500" />
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-xs text-muted-foreground font-medium">قرارات معتمدة</p>
                    <div className="p-2 bg-emerald-500/15 rounded-lg">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    </div>
                  </div>
                  <p className="text-3xl font-bold hub-stat-number text-emerald-500">{stats.approvedDecisions}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <TrendingUp className="w-3 h-3 hub-stat-gold" />
                    <span className="text-[10px] hub-stat-gold">معدل الاعتماد جيد</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="hub-card hub-card-hover fadeInUp relative overflow-hidden" style={{ animationDelay: '200ms' }}>
                <div className="absolute inset-y-0 right-0 w-[3px] bg-primary/30" />
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-xs text-muted-foreground font-medium">أعضاء اللجنة</p>
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Users className="w-4 h-4 text-foreground dark:text-white" />
                    </div>
                  </div>
                  <p className="text-3xl font-bold hub-stat-number text-foreground dark:text-white">{stats.totalMembers}</p>
                  <p className="text-[10px] text-muted-foreground/50 mt-1">{stats.upcomingMeetings} اجتماع قادم</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {activeVotingDecisions.length > 0 && (
          <Card className="card-premium-gold fadeInUp" style={{ animationDelay: '250ms' }}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Vote className="w-5 h-5 hub-stat-gold" />
                    التصويت النشط
                  </CardTitle>
                  <CardDescription>{activeVotingDecisions.length} قرار يتطلب تصويتك</CardDescription>
                </div>
                <Badge className="hub-badge-gold-solid text-foreground">
                  {activeVotingDecisions.length} نشط
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeVotingDecisions.slice(0, 4).map((decision: any, index: number) => (
                  <div key={decision.id} className="fadeInUp" style={{ animationDelay: `${300 + index * 50}ms` }}>
                    <VotingProgressCard decision={decision} onVote={handleVote} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 card-premium fadeInUp" style={{ animationDelay: '300ms' }}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Gavel className="w-5 h-5 hub-stat-gold" />
                    أحدث القرارات
                  </CardTitle>
                  <CardDescription>قرارات تحتاج إلى مراجعة أو تصويت</CardDescription>
                </div>
                <Button 
                  className="btn-navy-outline"
                  size="sm" 
                  onClick={() => setLocation('/committee/decisions')}
                  data-testid="button-view-all-decisions"
                >
                  عرض الكل
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {decisionsLoading ? (
                  <>
                    <DecisionCardSkeleton />
                    <DecisionCardSkeleton />
                    <DecisionCardSkeleton />
                  </>
                ) : decisions.length > 0 ? (
                  decisions.slice(0, 5).map((decision: any, index: number) => (
                    <div 
                      key={decision.id} 
                      className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl hover:bg-muted/50 transition-all duration-300 fadeInUp" 
                      style={{ animationDelay: `${350 + index * 50}ms` }}
                      data-testid={`decision-${decision.id}`}
                    >
                      <div className={`p-2.5 rounded-xl ${
                        decision.status === 'approved' ? 'bg-[hsl(43_74%_49%)]/20' : 
                        decision.status === 'rejected' ? 'bg-[hsl(222_47%_11%)]/20' : 
                        decision.status === 'voting' ? 'bg-[hsl(43_74%_49%)]/30' : 'bg-muted'
                      }`}>
                        {decision.status === 'approved' ? <CheckCircle2 className="w-5 h-5 hub-stat-gold" /> :
                         decision.status === 'rejected' ? <AlertTriangle className="w-5 h-5 text-foreground" /> :
                         decision.status === 'voting' ? <Vote className="w-5 h-5 hub-stat-gold" /> :
                         <Clock className="w-5 h-5 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
                          <span className="font-medium text-foreground dark:text-white truncate">{decision.title}</span>
                          <Badge variant={
                            decision.status === 'approved' ? 'default' : 
                            decision.status === 'rejected' ? 'destructive' : 
                            decision.status === 'voting' ? 'secondary' : 'outline'
                          } className={
                            decision.status === 'approved' ? 'hub-badge-gold-solid text-foreground' :
                            decision.status === 'voting' ? 'bg-[hsl(43_74%_49%)]/20 hub-stat-gold border-[hsl(43_74%_49%)]/30' : ''
                          }>
                            {decision.status === 'approved' ? 'معتمد' : 
                             decision.status === 'rejected' ? 'مرفوض' : 
                             decision.status === 'voting' ? 'تصويت' : 'معلق'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-1">{decision.description}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button 
                          size="icon" 
                          className="btn-icon-navy"
                          onClick={() => handleViewDecision(decision)}
                          data-testid={`view-decision-${decision.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10 text-muted-foreground">
                    <Gavel className="w-14 h-14 mx-auto mb-4 opacity-50" />
                    <p className="font-medium">لا توجد قرارات</p>
                    <p className="text-sm mt-1">ابدأ بإضافة قرار جديد</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="card-premium fadeInUp" style={{ animationDelay: '400ms' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 hub-stat-gold" />
                الإجراءات السريعة
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                className="btn-navy-outline w-full justify-start gap-2 h-11" 
                onClick={() => setLocation('/committee/decisions')}
                data-testid="quick-action-decisions"
              >
                <Gavel className="w-4 h-4 hub-stat-gold" />
                إدارة القرارات
              </Button>
              <Button 
                className="btn-navy-outline w-full justify-start gap-2 h-11" 
                onClick={() => setLocation('/committee/meetings')}
                data-testid="quick-action-meetings"
              >
                <Calendar className="w-4 h-4 text-foreground" />
                جدولة اجتماع
              </Button>
              <Button 
                className="btn-navy-outline w-full justify-start gap-2 h-11" 
                onClick={() => setLocation('/committee/voting')}
                data-testid="quick-action-voting"
              >
                <Vote className="w-4 h-4 hub-stat-gold" />
                التصويت النشط
              </Button>
              <Button 
                className="btn-navy-outline w-full justify-start gap-2 h-11" 
                onClick={() => setLocation('/committee/members')}
                data-testid="quick-action-members"
              >
                <Users className="w-4 h-4 text-foreground" />
                أعضاء اللجنة
              </Button>
              <Button 
                className="btn-navy-outline w-full justify-start gap-2 h-11" 
                onClick={() => setLocation('/committee/minutes')}
                data-testid="quick-action-minutes"
              >
                <FileText className="w-4 h-4 hub-stat-gold" />
                محاضر الجلسات
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="card-premium fadeInUp" style={{ animationDelay: '450ms' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-foreground dark:text-white" />
                الاجتماعات القادمة
              </CardTitle>
              <CardDescription>{stats.upcomingMeetings} اجتماع قادم</CardDescription>
            </CardHeader>
            <CardContent>
              {meetingsLoading ? (
                <>
                  <ListItemSkeleton />
                  <ListItemSkeleton />
                  <ListItemSkeleton />
                </>
              ) : meetings.filter((m: any) => new Date(m.date) > new Date()).length > 0 ? (
                meetings.filter((m: any) => new Date(m.date) > new Date()).slice(0, 3).map((meeting: any, index: number) => (
                  <div 
                    key={meeting.id} 
                    className="flex items-center gap-3 p-3 border-b last:border-0 hover:bg-muted/30 transition-colors rounded-lg fadeInUp"
                    style={{ animationDelay: `${500 + index * 50}ms` }}
                    onClick={() => setLocation('/committee/meetings')}
                    data-testid={`meeting-item-${meeting.id}`}
                  >
                    <div className="hub-icon-navy">
                      <Calendar className="w-4 h-4 text-foreground dark:text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm text-foreground dark:text-white">{meeting.title}</p>
                      <p className="text-xs text-muted-foreground">{meeting.date}</p>
                    </div>
                    <Badge variant="outline" className="border-[hsl(222_47%_11%)]/20">{meeting.type || 'عادي'}</Badge>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">لا توجد اجتماعات قادمة</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="card-premium fadeInUp" style={{ animationDelay: '500ms' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 hub-stat-gold" />
                أعضاء اللجنة
              </CardTitle>
            </CardHeader>
            <CardContent>
              {membersLoading ? (
                <>
                  <ListItemSkeleton circle />
                  <ListItemSkeleton circle />
                  <ListItemSkeleton circle />
                  <ListItemSkeleton circle />
                </>
              ) : members.length > 0 ? (
                members.slice(0, 4).map((member: any, index: number) => (
                  <div 
                    key={member.id} 
                    className="flex items-center gap-3 p-3 border-b last:border-0 hover:bg-muted/30 transition-colors rounded-lg fadeInUp"
                    style={{ animationDelay: `${550 + index * 50}ms` }}
                    onClick={() => setLocation('/committee/members')}
                    data-testid={`member-item-${member.id}`}
                  >
                    <Avatar className="h-10 w-10 ring-2 ring-[hsl(222_47%_11%)]/10">
                      <AvatarFallback className="bg-[hsl(222_47%_11%)] text-white font-semibold">
                        {member.name?.charAt(0) || 'م'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium text-sm text-foreground dark:text-white">{member.name}</p>
                      <p className="text-xs text-muted-foreground">{member.role}</p>
                    </div>
                    <Badge 
                      variant={member.status === 'active' ? 'default' : 'secondary'}
                      className={member.status === 'active' ? 'hub-badge-gold-solid text-foreground' : ''}
                    >
                      {member.status === 'active' ? 'نشط' : 'غير نشط'}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">لا يوجد أعضاء</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isAddDecisionOpen} onOpenChange={(open) => { setIsAddDecisionOpen(open); if (!open) setSuccessDecision(null); }}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gavel className="w-5 h-5 hub-stat-gold" />
              {successDecision ? 'تم إنشاء القرار' : 'قرار جديد'}
            </DialogTitle>
          </DialogHeader>
          {successDecision ? (
            <FormSuccessPanel
              title="تم إنشاء القرار بنجاح!"
              subtitle={successDecision.title}
              referenceNumber={`DEC-${String(successDecision.id).padStart(4, '0')}`}
              referenceLabel="رقم القرار"
              nextSteps={[
                { title: "مراجعة اللجنة", description: "سيُحال القرار لمراجعة أعضاء اللجنة المختصين" },
                { title: "التصويت الإلكتروني", description: "سيُفتح باب التصويت للأعضاء خلال الجلسة القادمة أو عبر البوابة" },
                { title: "الاعتماد والإخطار", description: "عند اكتمال النصاب سيُعتمد القرار وتُرسل إشعارات لجميع المعنيين" },
              ]}
              actions={[
                {
                  label: "إنشاء قرار آخر",
                  variant: "default",
                  icon: <Plus className="w-4 h-4" />,
                  onClick: () => setSuccessDecision(null),
                },
                {
                  label: "إغلاق",
                  variant: "outline",
                  onClick: () => { setIsAddDecisionOpen(false); setSuccessDecision(null); },
                },
              ]}
            />
          ) : (
          <>
          <DialogBody className="space-y-4">
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-300">
              ⚖️ سيتم إنشاء القرار كمسودة. بعد ذلك يمكنك تقديمه للمراجعة من قبل رئيس اللجنة، ثم يُطرح للتصويت ويُعتمد.
            </div>
            <div>
              <Label>عنوان القرار *</Label>
              <Input 
                value={newDecision.title}
                onChange={(e) => setNewDecision({...newDecision, title: e.target.value})}
                placeholder="مثال: اعتماد سياسة الأمن السيبراني للعام 2026" 
                data-testid="input-decision-title" 
                className="mt-1"
              />
              <FieldHint>صَغ العنوان بوضوح وتحديد — سيظهر في تقارير اللجنة الرسمية.</FieldHint>
            </div>
            <div>
              <Label>نوع القرار</Label>
              <Select value={newDecision.type} onValueChange={(v) => setNewDecision({...newDecision, type: v})}>
                <SelectTrigger data-testid="select-decision-type" className="mt-1">
                  <SelectValue placeholder="اختر النوع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="policy">📋 سياسة — وثيقة تنظيمية تُعتمد رسمياً</SelectItem>
                  <SelectItem value="procedure">🔄 إجراء — خطوات تشغيلية تفصيلية</SelectItem>
                  <SelectItem value="approval">✅ موافقة — اعتماد مبادرة أو طلب</SelectItem>
                  <SelectItem value="exception">⚠️ استثناء — استثناء مؤقت من سياسة معمول بها</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>تفاصيل القرار</Label>
              <Textarea 
                value={newDecision.description}
                onChange={(e) => setNewDecision({...newDecision, description: e.target.value})}
                placeholder="اشرح خلفية القرار، ومبرراته، وتأثيره المتوقع بشكل مفصل..." 
                data-testid="textarea-decision-description"
                className="mt-1 min-h-[100px]"
              />
              <FieldHint>كلما كان الوصف أوضح كانت عملية التصويت أسرع وأكثر فاعلية.</FieldHint>
            </div>
            <div>
              <FileAttachment
                attachments={decisionAttachments}
                onAttachmentsChange={setDecisionAttachments}
                maxFiles={10}
                label="المرفقات (وثائق داعمة للقرار)"
                compact
              />
            </div>
          </DialogBody>
          <DialogFooter className="gap-2">
            <Button 
              className="btn-navy-outline"
              onClick={() => {
                setIsAddDecisionOpen(false);
                setNewDecision({ title: '', description: '', type: '' });
                setDecisionAttachments([]);
              }}
              data-testid="button-cancel-decision"
            >
              إلغاء
            </Button>
            <Button 
              className="btn-gold"
              onClick={handleCreateDecision}
              disabled={createDecisionMutation.isPending}
              data-testid="button-submit-decision"
            >
              {createDecisionMutation.isPending ? (
                <RefreshCw className="w-4 h-4 ml-2 animate-spin" />
              ) : (
                <Gavel className="w-4 h-4 ml-2" />
              )}
              إنشاء كمسودة
            </Button>
          </DialogFooter>
          </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isViewDecisionOpen} onOpenChange={setIsViewDecisionOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 hub-stat-gold" />
              تفاصيل القرار
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
          {selectedDecision && (
            <div className="space-y-4">
              <div className="p-4 bg-muted/30 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-foreground dark:text-white">{selectedDecision.title}</h3>
                  <Badge variant={
                    selectedDecision.status === 'approved' ? 'default' : 
                    selectedDecision.status === 'rejected' ? 'destructive' : 'secondary'
                  } className={
                    selectedDecision.status === 'approved' ? 'hub-badge-gold-solid text-foreground' : ''
                  }>
                    {selectedDecision.status === 'approved' ? 'معتمد' : 
                     selectedDecision.status === 'rejected' ? 'مرفوض' : 
                     selectedDecision.status === 'voting' ? 'تصويت' : 'معلق'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{selectedDecision.description}</p>
              </div>

              {Array.isArray(selectedDecision.attachments) && selectedDecision.attachments.length > 0 && (
                <FileAttachment
                  attachments={selectedDecision.attachments}
                  readonly
                  compact
                  label={`المرفقات (${selectedDecision.attachments.length})`}
                />
              )}

              {selectedDecision.status === 'voting' && (
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">نتائج التصويت الحالية</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1">
                        <ThumbsUp className="w-4 h-4 hub-stat-gold" />
                        موافق
                      </span>
                      <span>{selectedDecision.votesFor || 0}</span>
                    </div>
                    <Progress 
                      value={((selectedDecision.votesFor || 0) / ((selectedDecision.votesFor || 0) + (selectedDecision.votesAgainst || 0) || 1)) * 100} 
                      className="h-2"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1">
                        <ThumbsDown className="w-4 h-4 text-foreground" />
                        رافض
                      </span>
                      <span>{selectedDecision.votesAgainst || 0}</span>
                    </div>
                    <Progress 
                      value={((selectedDecision.votesAgainst || 0) / ((selectedDecision.votesFor || 0) + (selectedDecision.votesAgainst || 0) || 1)) * 100} 
                      className="h-2 [&>div]:bg-[hsl(222_47%_11%)]"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
          </DialogBody>
          <DialogFooter>
            <Button className="btn-navy-outline" onClick={() => setIsViewDecisionOpen(false)} data-testid="button-close-view">
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
