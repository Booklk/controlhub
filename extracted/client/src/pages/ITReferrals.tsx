import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, invalidateRelatedQueries } from "@/lib/queryClient";
import DashboardLayout from "@/components/DashboardLayout";
import { itDirectorNavGroups } from "@/lib/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingButton } from "@/components/LoadingButton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeftRight, Plus, Send, CheckCircle, XCircle, Clock, Search,
  ArrowRight, ArrowLeft, Building2, Calendar, User, FileText, AlertCircle,
  RefreshCw, Sparkles, Eye, RotateCcw, FileDown, FileSpreadsheet,
  Mail, Download, Wifi, WifiOff, Timer, TrendingUp, AlertTriangle,
  ChevronDown, MoreHorizontal, PlayCircle, CheckSquare, Forward, Inbox,
  History, MessageSquare, Star, Zap, Shield, Activity, Pencil
} from "lucide-react";
import { exportToPDF, exportToExcel } from "@/lib/exports";
import { PageHeader, KpiCard } from "@/components/Quality";
import { IT_DEPARTMENTS_LIST } from "@/lib/permissions";
import { FileAttachment, type FileAttachmentData } from "@/components/FileAttachment";
import { FormSuccessPanel } from "@/components/ui/form-guide";
import { useAuth } from "@/lib/auth";

interface Referral {
  id: number;
  referralNumber: string;
  type: string;
  entityId: number;
  title: string;
  description: string;
  priority: string;
  fromDepartmentId: number;
  toDepartmentId: number;
  referredById: number;
  assignedToId: number | null;
  delegatedToDepartmentId: number | null;
  status: string;
  reason: string | null;
  responseNote: string | null;
  dueDate: string | null;
  slaHours: number | null;
  acceptedAt: string | null;
  completedAt: string | null;
  isEmailImported: boolean | null;
  emailSource: string | null;
  emailSubject: string | null;
  emailReceivedAt: string | null;
  createdAt: string;
  history?: any[];
  attachments?: FileAttachmentData[];
}

interface Stats {
  total: number;
  pending: number;
  accepted: number;
  inProgress: number;
  completed: number;
  rejected: number;
  overdue: number;
  emailImported: number;
}

interface OutlookStatus {
  configured: boolean;
  host: string;
  user: string;
  lastImport: string | null;
}

// SLA countdown hook
function useSLACountdown(referral: Referral) {
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number; isBreached: boolean; totalSecondsLeft: number } | null>(null);

  useEffect(() => {
    const calculate = () => {
      if (referral.status === 'completed' || referral.status === 'rejected') {
        setTimeLeft(null);
        return;
      }
      let deadline: Date | null = null;
      if (referral.dueDate) {
        deadline = new Date(referral.dueDate);
      } else if (referral.slaHours && referral.createdAt) {
        deadline = new Date(new Date(referral.createdAt).getTime() + referral.slaHours * 3600000);
      }
      if (!deadline) { setTimeLeft(null); return; }

      const diff = deadline.getTime() - Date.now();
      const isBreached = diff < 0;
      const abs = Math.abs(diff) / 1000;
      const hours = Math.floor(abs / 3600);
      const minutes = Math.floor((abs % 3600) / 60);
      const seconds = Math.floor(abs % 60);
      setTimeLeft({ hours, minutes, seconds, isBreached, totalSecondsLeft: diff / 1000 });
    };
    calculate();
    const timer = setInterval(calculate, 1000);
    return () => clearInterval(timer);
  }, [referral]);

  return timeLeft;
}

function SLABadge({ referral }: { referral: Referral }) {
  const time = useSLACountdown(referral);
  if (!time) return null;
  const { hours, minutes, seconds, isBreached, totalSecondsLeft } = time;
  const totalSla = (referral.slaHours || 48) * 3600;
  const pct = isBreached ? 100 : Math.max(0, 100 - ((totalSla - totalSecondsLeft) / totalSla) * 100);
  const color = isBreached ? "text-red-600 bg-red-50 border-red-200" : pct < 25 ? "text-amber-600 bg-amber-50 border-amber-200" : "text-emerald-600 bg-emerald-50 border-emerald-200";

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono border ${color}`} data-testid="sla-badge">
      <Timer className="w-3 h-3" />
      {isBreached ? `تجاوز` : `${hours}س ${minutes}د ${seconds}ث`}
    </span>
  );
}

export default function ITReferrals() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [tab, setTab] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [createdRefNumber, setCreatedRefNumber] = useState<string | null>(null);
  const [selectedReferral, setSelectedReferral] = useState<Referral | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isDelegateOpen, setIsDelegateOpen] = useState(false);
  const [isOutlookOpen, setIsOutlookOpen] = useState(false);

  const [newReferral, setNewReferral] = useState({
    type: "ticket", title: "", description: "", priority: "medium",
    fromDepartmentId: 9, toDepartmentId: 10, reason: "", dueDate: "", slaHours: 48,
    attachments: [] as FileAttachmentData[]
  });
  const [statusUpdate, setStatusUpdate] = useState({ status: "", responseNote: "" });
  const [delegateData, setDelegateData] = useState({ delegatedToDepartmentId: "", reason: "" });
  const [outlookConfig, setOutlookConfig] = useState({
    subjectFilter: "إحالة", toDepartmentId: "9", fromDepartmentId: "10"
  });

  const { data: referrals = [], isLoading } = useQuery<Referral[]>({ queryKey: ['/api/it-referrals'] });
  const { data: stats } = useQuery<Stats>({ queryKey: ['/api/it-referrals/stats'], refetchInterval: 30000 });
  const { data: outlookStatus } = useQuery<OutlookStatus>({ queryKey: ['/api/it-referrals/outlook-status'] });
  const { data: referralDetail } = useQuery<Referral>({
    queryKey: ['/api/it-referrals', selectedReferral?.id],
    enabled: !!selectedReferral?.id && isDetailOpen
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newReferral) => {
      const res = await apiRequest('POST', '/api/it-referrals', data);
      return res.json();
    },
    onSuccess: (data: any) => {
      invalidateRelatedQueries('/api/it-referrals');
      setCreatedRefNumber(data?.referralNumber || `REF-${data?.id || Date.now()}`);
      setNewReferral({ type: "ticket", title: "", description: "", priority: "medium", fromDepartmentId: 9, toDepartmentId: 10, reason: "", dueDate: "", slaHours: 48, attachments: [] });
    },
    onError: (error: Error) => toast({ title: "خطأ في إنشاء الإحالة", description: error.message, variant: "destructive" })
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; status: string; responseNote: string }) => {
      const res = await apiRequest('PUT', `/api/it-referrals/${id}/status`, data);
      return res.json();
    },
    onSuccess: () => {
      invalidateRelatedQueries('/api/it-referrals');
      setIsStatusOpen(false);
      toast({ title: "✅ تم تحديث حالة الإحالة" });
    },
    onError: (error: Error) => toast({ title: "خطأ في تحديث الحالة", description: error.message, variant: "destructive" })
  });

  const delegateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; delegatedToDepartmentId: string; reason: string }) => {
      const res = await apiRequest('POST', `/api/it-referrals/${id}/delegate`, data);
      return res.json();
    },
    onSuccess: () => {
      invalidateRelatedQueries('/api/it-referrals');
      setIsDelegateOpen(false);
      toast({ title: "✅ تم تفويض الإحالة" });
    },
    onError: (error: Error) => toast({ title: "خطأ في التفويض", description: error.message, variant: "destructive" })
  });

  const importMutation = useMutation({
    mutationFn: async (data: typeof outlookConfig) => {
      const res = await apiRequest('POST', '/api/it-referrals/import-outlook', data);
      return res.json();
    },
    onSuccess: (data: any) => {
      invalidateRelatedQueries('/api/it-referrals');
      setIsOutlookOpen(false);
      toast({
        title: `✅ تم الاستيراد`,
        description: `استُوردت ${data.imported} إحالة جديدة${data.skipped ? `، وتم تخطي ${data.skipped} مكررة` : ''}`
      });
    },
    onError: (error: Error) => toast({
      title: "خطأ في الاستيراد من Outlook",
      description: error.message,
      variant: "destructive"
    })
  });

  const addAttachmentsMutation = useMutation({
    mutationFn: async ({ id, attachments }: { id: number; attachments: FileAttachmentData[] }) => {
      const res = await apiRequest('POST', `/api/it-referrals/${id}/attachments`, { attachments });
      return res.json();
    },
    onSuccess: () => {
      invalidateRelatedQueries('/api/it-referrals');
      if (selectedReferral?.id) queryClient.invalidateQueries({ queryKey: ['/api/it-referrals', selectedReferral.id] });
      toast({ title: "✅ تم حفظ المرفقات" });
    },
    onError: (error: Error) => toast({ title: "خطأ في حفظ المرفقات", description: error.message, variant: "destructive" })
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof newReferral) => {
      const res = await apiRequest('PUT', `/api/it-referrals/${editingItem?.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      invalidateRelatedQueries('/api/it-referrals');
      toast({ title: "✅ تم تحديث الإحالة بنجاح" });
      setIsCreateOpen(false);
      setEditingItem(null);
      setNewReferral({ type: "ticket", title: "", description: "", priority: "medium", fromDepartmentId: 9, toDepartmentId: 10, reason: "", dueDate: "", slaHours: 48, attachments: [] });
    },
    onError: (error: Error) => toast({ title: "خطأ", description: error.message, variant: "destructive" })
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/it-referrals/${id}`);
      return res.json();
    },
    onSuccess: () => {
      invalidateRelatedQueries('/api/it-referrals');
      setIsDetailOpen(false);
      toast({ title: "تم حذف الإحالة" });
    },
    onError: (error: Error) => toast({ title: "خطأ في حذف الإحالة", description: error.message, variant: "destructive" })
  });

  const getDeptName = (id: number) => IT_DEPARTMENTS_LIST.find(d => d.id === id)?.nameAr || `إدارة ${id}`;
  const getDeptColor = (id: number) => IT_DEPARTMENTS_LIST.find(d => d.id === id)?.color || '#666';

  const STATUS_MAP: Record<string, { label: string; icon: any; cls: string }> = {
    pending: { label: "قيد الانتظار", icon: Clock, cls: "bg-slate-100 text-slate-700 border-slate-200" },
    accepted: { label: "تم القبول", icon: CheckCircle, cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    in_progress: { label: "قيد التنفيذ", icon: RefreshCw, cls: "bg-blue-50 text-blue-700 border-blue-200" },
    completed: { label: "مكتملة", icon: CheckSquare, cls: "bg-gold/20 text-navy border-gold/40" },
    rejected: { label: "مرفوضة", icon: XCircle, cls: "bg-red-50 text-red-700 border-red-200" },
    returned: { label: "مُرجعة", icon: RotateCcw, cls: "bg-orange-50 text-orange-700 border-orange-200" },
  };

  const PRIORITY_MAP: Record<string, { label: string; cls: string; dot: string }> = {
    low: { label: "منخفضة", cls: "bg-slate-50 text-slate-600", dot: "bg-slate-400" },
    medium: { label: "متوسطة", cls: "bg-blue-50 text-blue-700", dot: "bg-blue-500" },
    high: { label: "عالية", cls: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
    urgent: { label: "عاجلة", cls: "bg-red-50 text-red-700", dot: "bg-red-500" },
    critical: { label: "حرجة", cls: "bg-red-100 text-red-800 font-semibold", dot: "bg-red-600" },
  };

  function isOverdue(r: Referral) {
    if (r.status === 'completed' || r.status === 'rejected') return false;
    if (r.dueDate) return new Date(r.dueDate) < new Date();
    if (r.slaHours && r.createdAt) return new Date(r.createdAt).getTime() + r.slaHours * 3600000 < Date.now();
    return false;
  }

  const filtered = referrals.filter(r => {
    const matchSearch = r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.referralNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.emailSource || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchPriority = priorityFilter === 'all' || r.priority === priorityFilter;
    const matchTab = tab === 'all' ? true
      : tab === 'overdue' ? isOverdue(r)
      : tab === 'email' ? r.isEmailImported
      : tab === 'incoming' ? r.toDepartmentId === newReferral.fromDepartmentId
      : tab === 'outgoing' ? r.fromDepartmentId === newReferral.fromDepartmentId
      : true;
    return matchSearch && matchPriority && matchTab;
  });

  const openDetail = (r: Referral) => {
    setSelectedReferral(r);
    setIsDetailOpen(true);
  };

  const openStatus = (r: Referral, initialStatus?: string) => {
    setSelectedReferral(r);
    setStatusUpdate({ status: initialStatus || r.status, responseNote: '' });
    setIsStatusOpen(true);
  };

  const openDelegate = (r: Referral) => {
    setSelectedReferral(r);
    setDelegateData({ delegatedToDepartmentId: '', reason: '' });
    setIsDelegateOpen(true);
  };

  const handleExportPDF = () => exportToPDF({
    title: 'إحالات بين الإدارات', subtitle: 'نادي سباقات الخيل — مركز التحكم',
    columns: [
      { header: 'رقم الإحالة', key: 'referralNumber', width: 30 },
      { header: 'العنوان', key: 'title', width: 60 },
      { header: 'الحالة', key: 'statusLabel', width: 25 },
      { header: 'الأولوية', key: 'priorityLabel', width: 20 },
      { header: 'من', key: 'fromDept', width: 30 },
      { header: 'إلى', key: 'toDept', width: 30 },
    ],
    data: filtered.map(r => ({
      ...r,
      statusLabel: STATUS_MAP[r.status]?.label || r.status,
      priorityLabel: PRIORITY_MAP[r.priority]?.label || r.priority,
      fromDept: getDeptName(r.fromDepartmentId),
      toDept: getDeptName(r.toDepartmentId),
    })),
    filename: `referrals-${new Date().toISOString().split('T')[0]}`,
    orientation: 'landscape'
  });

  const handleExportExcel = () => exportToExcel({
    title: 'إحالات بين الإدارات',
    columns: [
      { header: 'رقم الإحالة', key: 'referralNumber' },
      { header: 'العنوان', key: 'title' },
      { header: 'الحالة', key: 'statusLabel' },
      { header: 'الأولوية', key: 'priorityLabel' },
      { header: 'من', key: 'fromDept' },
      { header: 'إلى', key: 'toDept' },
      { header: 'البريد الإلكتروني', key: 'emailSource' },
      { header: 'تاريخ الإنشاء', key: 'createdAt' },
    ],
    data: filtered.map(r => ({
      ...r,
      statusLabel: STATUS_MAP[r.status]?.label || r.status,
      priorityLabel: PRIORITY_MAP[r.priority]?.label || r.priority,
      fromDept: getDeptName(r.fromDepartmentId),
      toDept: getDeptName(r.toDepartmentId),
    })),
    filename: `referrals-${new Date().toISOString().split('T')[0]}`
  });

  return (
    <DashboardLayout title="إحالات بين الإدارات" portalName="it_director" navGroups={itDirectorNavGroups}>
      <div className="p-6 space-y-5">
        <PageHeader
          icon={ArrowLeftRight}
          title="إحالات بين الإدارات"
          subtitle="إدارة الإحالات المشتركة بين الإدارات التقنية واستيرادها من Outlook"
          actions={
            <>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportPDF} data-testid="button-export-pdf"><FileDown className="w-3.5 h-3.5" />PDF</Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportExcel} data-testid="button-export-excel"><FileSpreadsheet className="w-3.5 h-3.5" />Excel</Button>
              <Button
                variant="outline" size="sm"
                className="h-9 gap-1.5 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                onClick={() => setIsOutlookOpen(true)}
                data-testid="button-outlook-import"
              >
                {outlookStatus?.configured
                  ? <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                  : <WifiOff className="w-3.5 h-3.5 text-slate-400" />
                }
                Outlook
              </Button>
              <Button
                onClick={() => setIsCreateOpen(true)}
                className="btn-gold h-9 gap-1.5 text-xs"
                data-testid="button-create-referral"
              >
                <Plus className="h-3.5 w-3.5" /> إحالة جديدة
              </Button>
            </>
          }
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="الإجمالي" value={stats?.total ?? referrals.length} icon={ArrowLeftRight} color="navy" />
          <KpiCard label="قيد الانتظار" value={stats?.pending ?? 0} icon={Clock} color="gold" />
          <KpiCard label="مكتملة" value={stats?.completed ?? 0} icon={CheckCircle} color="success" />
          <KpiCard label="متأخرة" value={stats?.overdue ?? 0} icon={AlertTriangle} color="danger" />
        </div>

        {/* Filters & Tabs */}
        <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center">
          <Tabs value={tab} onValueChange={setTab} className="w-full lg:w-auto">
            <TabsList className="bg-navy/5 border border-navy/10">
              <TabsTrigger value="all" data-testid="tab-all">الكل</TabsTrigger>
              <TabsTrigger value="overdue" data-testid="tab-overdue" className="data-[state=active]:bg-red-500 data-[state=active]:text-white">
                متأخرة {(stats?.overdue ?? 0) > 0 && <span className="mr-1 bg-red-200 text-red-800 text-[10px] px-1 rounded-full">{stats?.overdue}</span>}
              </TabsTrigger>
              <TabsTrigger value="email" data-testid="tab-email">
                <Mail className="w-3 h-3 ml-1" /> Outlook
              </TabsTrigger>
              <TabsTrigger value="incoming" data-testid="tab-incoming">واردة</TabsTrigger>
              <TabsTrigger value="outgoing" data-testid="tab-outgoing">صادرة</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex gap-2 flex-1 w-full lg:w-auto">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-navy/40" />
              <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                placeholder="بحث بالعنوان أو الرقم أو الإيميل..."
                className="pr-9 border-navy/20 focus:border-gold text-sm" data-testid="input-search" />
            </div>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-32 border-navy/20 text-sm" data-testid="select-priority-filter">
                <SelectValue placeholder="الأولوية" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الأولويات</SelectItem>
                <SelectItem value="urgent">عاجلة</SelectItem>
                <SelectItem value="high">عالية</SelectItem>
                <SelectItem value="medium">متوسطة</SelectItem>
                <SelectItem value="low">منخفضة</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Referrals Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="h-52 rounded-xl bg-navy/5 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed border-navy/20 bg-white/60">
            <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
              <ArrowLeftRight className="w-12 h-12 text-navy/20" />
              <p className="text-navy/40 font-medium">لا توجد إحالات</p>
              <Button variant="outline" size="sm" onClick={() => setIsCreateOpen(true)}>
                <Plus className="w-4 h-4 ml-1.5" /> إنشاء إحالة جديدة
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(ref => {
              const sc = STATUS_MAP[ref.status] || STATUS_MAP.pending;
              const pc = PRIORITY_MAP[ref.priority] || PRIORITY_MAP.medium;
              const overdue = isOverdue(ref);
              const StatusIcon = sc.icon;

              return (
                <Card
                  key={ref.id}
                  className={`relative overflow-hidden border cursor-pointer hover:shadow-lg transition-all duration-300 group ${overdue ? 'border-red-200 bg-red-50/30' : 'border-navy/10 bg-white/80 hover:border-gold/40'}`}
                  onClick={() => openDetail(ref)}
                  data-testid={`card-referral-${ref.id}`}
                >
                  {/* Overdue indicator */}
                  {overdue && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 to-red-400" />
                  )}
                  {!overdue && ref.isEmailImported && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-blue-400" />
                  )}
                  {!overdue && !ref.isEmailImported && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-gold to-gold/70" />
                  )}

                  <CardContent className="p-4 space-y-3">
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs font-mono text-navy/50 shrink-0">{ref.referralNumber}</span>
                          {ref.isEmailImported && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                              <Mail className="w-2.5 h-2.5" /> Outlook
                            </span>
                          )}
                          {overdue && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">
                              <AlertTriangle className="w-2.5 h-2.5" /> متأخرة
                            </span>
                          )}
                        </div>
                        <h3 className="font-semibold text-navy text-sm leading-snug line-clamp-2">{ref.title}</h3>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border font-medium ${sc.cls}`}>
                          <StatusIcon className="w-3 h-3" />
                          {sc.label}
                        </span>
                        <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full ${pc.cls}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${pc.dot}`} />
                          {pc.label}
                        </span>
                      </div>
                    </div>

                    {/* Departments flow */}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-navy/5 text-navy/70 font-medium">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getDeptColor(ref.fromDepartmentId) }} />
                        {getDeptName(ref.fromDepartmentId)}
                      </span>
                      <ArrowLeft className="w-3.5 h-3.5 text-navy/30 shrink-0" />
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gold/10 text-navy/70 font-medium">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getDeptColor(ref.toDepartmentId) }} />
                        {getDeptName(ref.toDepartmentId)}
                      </span>
                    </div>

                    {/* Description */}
                    {ref.description && (
                      <p className="text-xs text-navy/50 line-clamp-2 leading-relaxed">{ref.description}</p>
                    )}

                    {/* Email source */}
                    {ref.emailSource && (
                      <div className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                        <Mail className="w-3 h-3 shrink-0" />
                        <span className="truncate">{ref.emailSource}</span>
                      </div>
                    )}

                    {/* SLA + Date */}
                    <div className="flex items-center justify-between pt-1 border-t border-navy/5">
                      <SLABadge referral={ref} />
                      <span className="text-[11px] text-navy/40">
                        {new Date(ref.createdAt).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>

                    {/* Quick actions (appear on hover) */}
                    <div className="grid grid-cols-3 gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer" onClick={e => e.stopPropagation()}>
                      {ref.status === 'pending' && (
                        <Button size="sm" variant="outline"
                          className="text-[11px] h-7 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          onClick={() => openStatus(ref, 'accepted')}
                          data-testid={`button-accept-${ref.id}`}>
                          <CheckCircle className="w-3 h-3 ml-1" /> قبول
                        </Button>
                      )}
                      {(ref.status === 'accepted' || ref.status === 'in_progress') && (
                        <Button size="sm" variant="outline"
                          className="text-[11px] h-7 border-gold/40 text-navy hover:bg-gold/10"
                          onClick={() => openStatus(ref, 'completed')}
                          data-testid={`button-complete-${ref.id}`}>
                          <CheckSquare className="w-3 h-3 ml-1" /> إنجاز
                        </Button>
                      )}
                      {(ref.status === 'pending' || ref.status === 'accepted') && (
                        <Button size="sm" variant="outline"
                          className="text-[11px] h-7 border-red-200 text-red-700 hover:bg-red-50"
                          onClick={() => openStatus(ref, 'rejected')}
                          data-testid={`button-reject-${ref.id}`}>
                          <XCircle className="w-3 h-3 ml-1" /> رفض
                        </Button>
                      )}
                      <Button size="sm" variant="outline"
                        className="text-[11px] h-7 border-blue-200 text-blue-700 hover:bg-blue-50"
                        onClick={() => openDelegate(ref)}
                        data-testid={`button-delegate-${ref.id}`}>
                        <Forward className="w-3 h-3 ml-1" /> تفويض
                      </Button>
                      {user?.id === ref.referredById && (
                        <Button size="sm" variant="outline"
                          className="text-[11px] h-7 border-amber-200 text-amber-700 hover:bg-amber-50"
                          onClick={() => {
                            setEditingItem(ref);
                            setNewReferral({
                              type: ref.type, title: ref.title, description: ref.description || '', priority: ref.priority,
                              fromDepartmentId: ref.fromDepartmentId, toDepartmentId: ref.toDepartmentId,
                              reason: ref.reason || '', dueDate: ref.dueDate ? ref.dueDate.split('T')[0] : '',
                              slaHours: ref.slaHours || 48, attachments: ref.attachments || [],
                            });
                            setIsCreateOpen(true);
                          }}
                          data-testid={`button-edit-${ref.id}`}>
                          <Pencil className="w-3 h-3 ml-1" /> تعديل
                        </Button>
                      )}
                      <Button size="sm" variant="outline"
                        className="text-[11px] h-7 border-navy/20 text-navy/70"
                        onClick={() => openDetail(ref)}
                        data-testid={`button-view-${ref.id}`}>
                        <Eye className="w-3 h-3 ml-1" /> تفاصيل
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ===================== CREATE DIALOG ===================== */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => {
        setIsCreateOpen(open);
        if (!open) { setNewReferral({ type: "ticket", title: "", description: "", priority: "medium", fromDepartmentId: 9, toDepartmentId: 10, reason: "", dueDate: "", slaHours: 48, attachments: [] }); setCreatedRefNumber(null); setEditingItem(null); }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-white/98 backdrop-blur-xl border-navy/10" data-testid="dialog-create-referral">
          {createdRefNumber ? (
            <FormSuccessPanel
              title="تم إنشاء الإحالة بنجاح"
              subtitle="تم إرسال الإحالة للإدارة المستهدفة وبدأ عداد SLA"
              referenceNumber={createdRefNumber}
              referenceLabel="رقم الإحالة"
              nextSteps={[
                { title: "تم إرسال الإحالة للإدارة المستقبِلة", description: "يجب تأكيد الاستلام خلال 4 ساعات وإلا يتم التصعيد تلقائياً" },
                { title: "تابع الحالة من قائمة الإحالات", description: "ستتلقى إشعاراً عند تحديث الحالة أو الرد" },
              ]}
              actions={[
                { label: "إنشاء إحالة أخرى", icon: <Plus className="w-4 h-4" />, onClick: () => setCreatedRefNumber(null), testId: "button-create-another-ref" },
                { label: "إغلاق", variant: "outline", onClick: () => { setIsCreateOpen(false); setCreatedRefNumber(null); }, testId: "button-close-ref-success" },
              ]}
            />
          ) : (
          <>
          <DialogHeader>
            <DialogTitle className="text-navy text-xl flex items-center gap-2">
              {editingItem ? <><Pencil className="h-5 w-5 text-gold" /> تعديل الإحالة</> : <><Sparkles className="h-5 w-5 text-gold" /> إنشاء إحالة جديدة</>}
            </DialogTitle>
            <DialogDescription className="text-navy/60">{editingItem ? 'تعديل بيانات الإحالة' : 'أدخل تفاصيل الإحالة لإرسالها للإدارة المستهدفة'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-navy/80 text-sm font-medium">نوع الإحالة</Label>
                <Select value={newReferral.type} onValueChange={v => setNewReferral({ ...newReferral, type: v })}>
                  <SelectTrigger className="border-navy/20" data-testid="select-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ticket">تذكرة</SelectItem>
                    <SelectItem value="task">مهمة</SelectItem>
                    <SelectItem value="project">مشروع</SelectItem>
                    <SelectItem value="request">طلب</SelectItem>
                    <SelectItem value="consultation">استشارة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-navy/80 text-sm font-medium">الأولوية</Label>
                <Select value={newReferral.priority} onValueChange={v => setNewReferral({ ...newReferral, priority: v })}>
                  <SelectTrigger className="border-navy/20" data-testid="select-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">منخفضة</SelectItem>
                    <SelectItem value="medium">متوسطة</SelectItem>
                    <SelectItem value="high">عالية</SelectItem>
                    <SelectItem value="urgent">🔴 عاجلة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-navy/80 text-sm font-medium">عنوان الإحالة *</Label>
              <Input
                value={newReferral.title}
                onChange={e => setNewReferral({ ...newReferral, title: e.target.value })}
                placeholder="أدخل عنواناً واضحاً للإحالة"
                className="border-navy/20 focus:border-gold"
                data-testid="input-referral-title"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-navy/80 text-sm font-medium">الوصف التفصيلي</Label>
              <Textarea
                value={newReferral.description}
                onChange={e => setNewReferral({ ...newReferral, description: e.target.value })}
                placeholder="اشرح تفاصيل الإحالة والمتطلبات..."
                className="border-navy/20 focus:border-gold min-h-[80px]"
                data-testid="input-description"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-navy/80 text-sm font-medium flex items-center gap-1">
                  <ArrowRight className="w-3 h-3" /> من إدارة
                </Label>
                <Select value={String(newReferral.fromDepartmentId)} onValueChange={v => setNewReferral({ ...newReferral, fromDepartmentId: parseInt(v) })}>
                  <SelectTrigger className="border-navy/20" data-testid="select-from-dept">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IT_DEPARTMENTS_LIST.map(d => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                          {d.nameAr}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-navy/80 text-sm font-medium flex items-center gap-1">
                  <ArrowLeft className="w-3 h-3" /> إلى إدارة
                </Label>
                <Select value={String(newReferral.toDepartmentId)} onValueChange={v => setNewReferral({ ...newReferral, toDepartmentId: parseInt(v) })}>
                  <SelectTrigger className="border-navy/20" data-testid="select-to-dept">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IT_DEPARTMENTS_LIST.map(d => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                          {d.nameAr}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-navy/80 text-sm font-medium">تاريخ الاستحقاق</Label>
                <Input type="date" value={newReferral.dueDate}
                  onChange={e => setNewReferral({ ...newReferral, dueDate: e.target.value })}
                  className="border-navy/20 focus:border-gold" data-testid="input-due-date" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-navy/80 text-sm font-medium flex items-center gap-1">
                  <Timer className="w-3 h-3" /> SLA (ساعات)
                </Label>
                <Select value={String(newReferral.slaHours)} onValueChange={v => setNewReferral({ ...newReferral, slaHours: parseInt(v) })}>
                  <SelectTrigger className="border-navy/20" data-testid="select-sla">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4">4 ساعات (عاجل)</SelectItem>
                    <SelectItem value="8">8 ساعات</SelectItem>
                    <SelectItem value="24">24 ساعة (يوم)</SelectItem>
                    <SelectItem value="48">48 ساعة (يومان)</SelectItem>
                    <SelectItem value="72">72 ساعة (3 أيام)</SelectItem>
                    <SelectItem value="168">168 ساعة (أسبوع)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-navy/80 text-sm font-medium">سبب الإحالة</Label>
              <Textarea
                value={newReferral.reason}
                onChange={e => setNewReferral({ ...newReferral, reason: e.target.value })}
                placeholder="ما سبب الإحالة لهذه الإدارة؟"
                className="border-navy/20 focus:border-gold"
                data-testid="input-reason"
              />
            </div>

            {/* Attachments */}
            <div className="border-t border-navy/10 pt-3">
              <FileAttachment
                label="مرفقات الإحالة"
                attachments={newReferral.attachments}
                onAttachmentsChange={(files) => setNewReferral({ ...newReferral, attachments: files })}
                maxFiles={5}
                maxFileSize={10 * 1024 * 1024}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setIsCreateOpen(false); setEditingItem(null); }} className="border-navy/20">إلغاء</Button>
            <LoadingButton
              className="bg-gradient-to-r from-gold to-gold/90 text-navy font-semibold"
              onClick={() => editingItem ? updateMutation.mutate(newReferral) : createMutation.mutate(newReferral)}
              disabled={!newReferral.title || newReferral.fromDepartmentId === newReferral.toDepartmentId}
              loading={editingItem ? updateMutation.isPending : createMutation.isPending}
              loadingText={editingItem ? "جاري التحديث..." : "جاري الإرسال..."}
              data-testid="button-submit-referral"
            >
              {editingItem ? <><Pencil className="h-4 w-4 ml-2" /> تحديث الإحالة</> : <><Send className="h-4 w-4 ml-2" /> إرسال الإحالة</>}
            </LoadingButton>
          </DialogFooter>
          </>
          )}
        </DialogContent>
      </Dialog>

      {/* ===================== STATUS UPDATE DIALOG ===================== */}
      <Dialog open={isStatusOpen} onOpenChange={setIsStatusOpen}>
        <DialogContent className="max-w-md bg-white/98 border-navy/10" data-testid="dialog-status-update">
          <DialogHeader>
            <DialogTitle className="text-navy flex items-center gap-2">
              <Activity className="w-5 h-5 text-gold" /> تحديث حالة الإحالة
            </DialogTitle>
            {selectedReferral && (
              <DialogDescription className="text-navy/60 text-xs">{selectedReferral.referralNumber} — {selectedReferral.title}</DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-navy/80 text-sm font-medium">الحالة الجديدة</Label>
              <Select value={statusUpdate.status} onValueChange={v => setStatusUpdate({ ...statusUpdate, status: v })}>
                <SelectTrigger className="border-navy/20" data-testid="select-new-status">
                  <SelectValue placeholder="اختر الحالة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">قيد الانتظار</SelectItem>
                  <SelectItem value="accepted">تم القبول</SelectItem>
                  <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
                  <SelectItem value="completed">مكتملة</SelectItem>
                  <SelectItem value="rejected">مرفوضة</SelectItem>
                  <SelectItem value="returned">مُرجعة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-navy/80 text-sm font-medium">ملاحظات الرد</Label>
              <Textarea
                value={statusUpdate.responseNote}
                onChange={e => setStatusUpdate({ ...statusUpdate, responseNote: e.target.value })}
                placeholder="أضف ملاحظاتك على هذا التحديث..."
                className="border-navy/20 focus:border-gold min-h-[80px]"
                data-testid="input-response-note"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsStatusOpen(false)}>إلغاء</Button>
            <LoadingButton
              className="bg-gradient-to-r from-gold to-gold/90 text-navy font-semibold"
              onClick={() => selectedReferral && statusMutation.mutate({ id: selectedReferral.id, ...statusUpdate })}
              disabled={!statusUpdate.status}
              loading={statusMutation.isPending}
              loadingText="جاري الحفظ..."
              data-testid="button-submit-status"
            >
              <CheckCircle className="w-4 h-4 ml-2" /> حفظ الحالة
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===================== DELEGATE DIALOG ===================== */}
      <Dialog open={isDelegateOpen} onOpenChange={setIsDelegateOpen}>
        <DialogContent className="max-w-md bg-white/98 border-navy/10" data-testid="dialog-delegate">
          <DialogHeader>
            <DialogTitle className="text-navy flex items-center gap-2">
              <Forward className="w-5 h-5 text-blue-600" /> تفويض الإحالة
            </DialogTitle>
            {selectedReferral && (
              <DialogDescription className="text-navy/60 text-xs">{selectedReferral.referralNumber} — {selectedReferral.title}</DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-navy/80 text-sm font-medium">الإدارة المستهدفة للتفويض</Label>
              <Select value={delegateData.delegatedToDepartmentId} onValueChange={v => setDelegateData({ ...delegateData, delegatedToDepartmentId: v })}>
                <SelectTrigger className="border-navy/20" data-testid="select-delegate-dept">
                  <SelectValue placeholder="اختر الإدارة" />
                </SelectTrigger>
                <SelectContent>
                  {IT_DEPARTMENTS_LIST.map(d => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                        {d.nameAr}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-navy/80 text-sm font-medium">سبب التفويض</Label>
              <Textarea
                value={delegateData.reason}
                onChange={e => setDelegateData({ ...delegateData, reason: e.target.value })}
                placeholder="لماذا تُفوِّض هذه الإحالة؟"
                className="border-navy/20 focus:border-gold"
                data-testid="input-delegate-reason"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDelegateOpen(false)}>إلغاء</Button>
            <LoadingButton
              className="bg-blue-600 text-white hover:bg-blue-700"
              onClick={() => selectedReferral && delegateMutation.mutate({ id: selectedReferral.id, ...delegateData })}
              disabled={!delegateData.delegatedToDepartmentId}
              loading={delegateMutation.isPending}
              loadingText="جاري التفويض..."
              data-testid="button-submit-delegate"
            >
              <Forward className="w-4 h-4 ml-2" /> تفويض الإحالة
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===================== OUTLOOK IMPORT DIALOG ===================== */}
      <Dialog open={isOutlookOpen} onOpenChange={setIsOutlookOpen}>
        <DialogContent className="max-w-md bg-white/98 border-navy/10" data-testid="dialog-outlook-import">
          <DialogHeader>
            <DialogTitle className="text-navy flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-600" /> استيراد الإحالات من Outlook
            </DialogTitle>
          </DialogHeader>

          {/* Connection status */}
          <div className={`p-3 rounded-lg border text-sm flex items-start gap-3 ${outlookStatus?.configured ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
            {outlookStatus?.configured
              ? <Wifi className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              : <WifiOff className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            }
            <div>
              <p className={`font-medium ${outlookStatus?.configured ? 'text-emerald-800' : 'text-amber-800'}`}>
                {outlookStatus?.configured ? 'الاتصال بـ Outlook مُهيَّأ' : 'يتطلب تكوين بيانات الاعتماد'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {outlookStatus?.configured
                  ? `الخادم: ${outlookStatus.host} | المستخدم: ${outlookStatus.user}`
                  : 'يرجى ضبط SMTP_USER وSMTP_PASS في متغيرات البيئة لتفعيل IMAP'}
              </p>
            </div>
          </div>

          <div className="space-y-4 py-1">
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 text-xs text-blue-800 space-y-1">
              <p className="font-medium">كيف يعمل الاستيراد؟</p>
              <ul className="list-disc list-inside space-y-0.5 text-blue-700">
                <li>يتصل النظام بصندوق بريد Outlook عبر IMAP</li>
                <li>يقرأ الرسائل غير المقروءة خلال آخر 7 أيام</li>
                <li>يُنشئ إحالة لكل رسالة تحتوي على كلمة الفلتر</li>
                <li>يتجاهل الرسائل المستوردة مسبقاً تلقائياً</li>
              </ul>
            </div>

            <div className="space-y-1.5">
              <Label className="text-navy/80 text-sm font-medium">فلتر الموضوع (Subject)</Label>
              <Input
                value={outlookConfig.subjectFilter}
                onChange={e => setOutlookConfig({ ...outlookConfig, subjectFilter: e.target.value })}
                placeholder='مثال: إحالة، referral'
                className="border-navy/20 focus:border-gold"
                data-testid="input-subject-filter"
              />
              <p className="text-xs text-navy/40">استورد فقط الإيميلات التي يحتوي موضوعها على هذا النص</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-navy/80 text-sm font-medium">من إدارة (افتراضي)</Label>
                <Select value={outlookConfig.fromDepartmentId} onValueChange={v => setOutlookConfig({ ...outlookConfig, fromDepartmentId: v })}>
                  <SelectTrigger className="border-navy/20" data-testid="select-import-from">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IT_DEPARTMENTS_LIST.map(d => (
                      <SelectItem key={d.id} value={String(d.id)}>{d.nameAr}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-navy/80 text-sm font-medium">إلى إدارة (افتراضي)</Label>
                <Select value={outlookConfig.toDepartmentId} onValueChange={v => setOutlookConfig({ ...outlookConfig, toDepartmentId: v })}>
                  <SelectTrigger className="border-navy/20" data-testid="select-import-to">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IT_DEPARTMENTS_LIST.map(d => (
                      <SelectItem key={d.id} value={String(d.id)}>{d.nameAr}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsOutlookOpen(false)}>إغلاق</Button>
            <LoadingButton
              className="bg-blue-600 text-white hover:bg-blue-700"
              onClick={() => importMutation.mutate(outlookConfig)}
              disabled={!outlookStatus?.configured}
              loading={importMutation.isPending}
              loadingText="جاري الاستيراد..."
              data-testid="button-start-import"
            >
              <Download className="w-4 h-4 ml-2" /> بدء الاستيراد
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===================== DETAIL SHEET ===================== */}
      <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <SheetContent side="left" className="w-full sm:max-w-xl p-0 flex flex-col" data-testid="sheet-referral-detail">
          <SheetHeader className="p-6 pb-4 border-b border-navy/10">
            <SheetTitle className="text-navy flex items-center gap-2">
              <FileText className="w-5 h-5 text-gold" />
              {selectedReferral?.referralNumber}
            </SheetTitle>
          </SheetHeader>

          <ScrollArea className="flex-1">
            {selectedReferral && (
              <div className="p-6 space-y-6">
                {/* Title & Status */}
                <div className="space-y-2">
                  <h2 className="text-lg font-bold text-navy leading-snug">{selectedReferral.title}</h2>
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      const sc = STATUS_MAP[selectedReferral.status] || STATUS_MAP.pending;
                      const pc = PRIORITY_MAP[selectedReferral.priority] || PRIORITY_MAP.medium;
                      const StatusIcon = sc.icon;
                      return (
                        <>
                          <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium ${sc.cls}`}>
                            <StatusIcon className="w-3.5 h-3.5" /> {sc.label}
                          </span>
                          <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full ${pc.cls}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${pc.dot}`} /> {pc.label}
                          </span>
                          {selectedReferral.isEmailImported && (
                            <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full">
                              <Mail className="w-3.5 h-3.5" /> مستورد من Outlook
                            </span>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* SLA status */}
                <div className="flex items-center justify-between p-3 bg-navy/3 rounded-lg border border-navy/10">
                  <span className="text-sm text-navy/60">مؤقت SLA</span>
                  <SLABadge referral={selectedReferral} />
                </div>

                {/* Departments */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-navy/3 rounded-lg border border-navy/10">
                    <p className="text-xs text-navy/50 mb-1">من إدارة</p>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: getDeptColor(selectedReferral.fromDepartmentId) }} />
                      <span className="text-sm font-semibold text-navy">{getDeptName(selectedReferral.fromDepartmentId)}</span>
                    </div>
                  </div>
                  <div className="p-3 bg-gold/5 rounded-lg border border-gold/20">
                    <p className="text-xs text-navy/50 mb-1">إلى إدارة</p>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: getDeptColor(selectedReferral.toDepartmentId) }} />
                      <span className="text-sm font-semibold text-navy">{getDeptName(selectedReferral.toDepartmentId)}</span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                {selectedReferral.description && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-navy/50 uppercase tracking-wider">الوصف</p>
                    <p className="text-sm text-navy/70 leading-relaxed whitespace-pre-wrap">{selectedReferral.description}</p>
                  </div>
                )}

                {/* Reason */}
                {selectedReferral.reason && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-navy/50 uppercase tracking-wider">سبب الإحالة</p>
                    <p className="text-sm text-navy/70 leading-relaxed">{selectedReferral.reason}</p>
                  </div>
                )}

                {/* Response note */}
                {selectedReferral.responseNote && (
                  <div className="p-3 bg-gold/5 rounded-lg border border-gold/20 space-y-1">
                    <p className="text-xs font-medium text-navy/50">ملاحظة الرد</p>
                    <p className="text-sm text-navy/70">{selectedReferral.responseNote}</p>
                  </div>
                )}

                {/* Email info */}
                {selectedReferral.isEmailImported && (
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 space-y-1.5">
                    <p className="text-xs font-medium text-blue-700 flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" /> معلومات البريد الإلكتروني
                    </p>
                    {selectedReferral.emailSource && (
                      <p className="text-xs text-blue-600">من: {selectedReferral.emailSource}</p>
                    )}
                    {selectedReferral.emailSubject && (
                      <p className="text-xs text-blue-600">الموضوع: {selectedReferral.emailSubject}</p>
                    )}
                    {selectedReferral.emailReceivedAt && (
                      <p className="text-xs text-blue-500">وُصِل: {new Date(selectedReferral.emailReceivedAt).toLocaleString('ar-SA')}</p>
                    )}
                  </div>
                )}

                {/* Dates */}
                <div className="grid grid-cols-2 gap-2 text-xs text-navy/50">
                  <div>
                    <Calendar className="w-3 h-3 inline ml-1" />
                    <span>أُنشئت: {new Date(selectedReferral.createdAt).toLocaleDateString('ar-SA')}</span>
                  </div>
                  {selectedReferral.dueDate && (
                    <div>
                      <Clock className="w-3 h-3 inline ml-1" />
                      <span>الاستحقاق: {new Date(selectedReferral.dueDate).toLocaleDateString('ar-SA')}</span>
                    </div>
                  )}
                  {selectedReferral.acceptedAt && (
                    <div>
                      <CheckCircle className="w-3 h-3 inline ml-1" />
                      <span>قُبلت: {new Date(selectedReferral.acceptedAt).toLocaleDateString('ar-SA')}</span>
                    </div>
                  )}
                  {selectedReferral.completedAt && (
                    <div>
                      <CheckSquare className="w-3 h-3 inline ml-1" />
                      <span>أُنجزت: {new Date(selectedReferral.completedAt).toLocaleDateString('ar-SA')}</span>
                    </div>
                  )}
                </div>

                {/* ── Attachments section ─────────────────────────────── */}
                <div className="space-y-3">
                  <Separator className="bg-navy/10" />
                  <FileAttachment
                    label="مرفقات الإحالة"
                    attachments={referralDetail?.attachments || selectedReferral?.attachments || []}
                    onAttachmentsChange={(newFiles) => {
                      const existing = referralDetail?.attachments || selectedReferral?.attachments || [];
                      const added = newFiles.filter(f => !existing.includes(f));
                      if (added.length > 0 && selectedReferral?.id) {
                        addAttachmentsMutation.mutate({ id: selectedReferral.id, attachments: added });
                      }
                    }}
                    readonly={false}
                    maxFiles={10}
                    maxFileSize={20 * 1024 * 1024}
                  />
                </div>

                {/* History timeline */}
                {referralDetail?.history && referralDetail.history.length > 0 && (
                  <div className="space-y-3">
                    <Separator className="bg-navy/10" />
                    <p className="text-xs font-medium text-navy/50 uppercase tracking-wider flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5" /> سجل النشاط
                    </p>
                    <div className="space-y-3">
                      {referralDetail.history.map((h: any, i: number) => (
                        <div key={i} className="flex gap-3">
                          <div className="w-6 h-6 rounded-full bg-navy/10 flex items-center justify-center shrink-0 mt-0.5">
                            <Activity className="w-3 h-3 text-navy/50" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-navy">{h.action}</p>
                            {h.notes && <p className="text-xs text-navy/50 mt-0.5">{h.notes}</p>}
                            {(h.fromStatus || h.toStatus) && (
                              <div className="flex items-center gap-1.5 mt-1">
                                {h.fromStatus && <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 rounded">{STATUS_MAP[h.fromStatus]?.label || h.fromStatus}</span>}
                                {h.fromStatus && h.toStatus && <ArrowLeft className="w-3 h-3 text-navy/30" />}
                                {h.toStatus && <span className="text-[10px] px-1.5 py-0.5 bg-gold/20 text-navy rounded">{STATUS_MAP[h.toStatus]?.label || h.toStatus}</span>}
                              </div>
                            )}
                            <p className="text-[10px] text-navy/30 mt-1">
                              {new Date(h.createdAt).toLocaleString('ar-SA')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <Separator className="bg-navy/10" />
                <div className="grid grid-cols-2 gap-2">
                  {selectedReferral.status === 'pending' && (
                    <Button
                      variant="outline"
                      className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                      onClick={() => { setIsDetailOpen(false); setTimeout(() => openStatus(selectedReferral, 'accepted'), 200); }}
                      data-testid="button-detail-accept"
                    >
                      <CheckCircle className="w-4 h-4 ml-2" /> قبول الإحالة
                    </Button>
                  )}
                  {(selectedReferral.status === 'accepted' || selectedReferral.status === 'in_progress') && (
                    <Button
                      variant="outline"
                      className="border-gold/40 text-navy hover:bg-gold/10"
                      onClick={() => { setIsDetailOpen(false); setTimeout(() => openStatus(selectedReferral, 'completed'), 200); }}
                      data-testid="button-detail-complete"
                    >
                      <CheckSquare className="w-4 h-4 ml-2" /> إنجاز الإحالة
                    </Button>
                  )}
                  {(selectedReferral.status === 'pending' || selectedReferral.status === 'accepted') && (
                    <Button
                      variant="outline"
                      className="border-red-200 text-red-700 hover:bg-red-50"
                      onClick={() => { setIsDetailOpen(false); setTimeout(() => openStatus(selectedReferral, 'rejected'), 200); }}
                      data-testid="button-detail-reject"
                    >
                      <XCircle className="w-4 h-4 ml-2" /> رفض الإحالة
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="border-blue-200 text-blue-700 hover:bg-blue-50"
                    onClick={() => { setIsDetailOpen(false); setTimeout(() => openDelegate(selectedReferral), 200); }}
                    data-testid="button-detail-delegate"
                  >
                    <Forward className="w-4 h-4 ml-2" /> تفويض
                  </Button>
                  <Button
                    variant="outline"
                    className="border-navy/20 text-navy/70"
                    onClick={() => { setIsDetailOpen(false); setTimeout(() => openStatus(selectedReferral), 200); }}
                    data-testid="button-detail-status"
                  >
                    <Activity className="w-4 h-4 ml-2" /> تغيير الحالة
                  </Button>
                  <Button
                    variant="outline"
                    className="border-red-100 text-red-600 hover:bg-red-50 col-span-2"
                    onClick={() => deleteMutation.mutate(selectedReferral.id)}
                    data-testid="button-detail-delete"
                  >
                    <XCircle className="w-4 h-4 ml-2" /> حذف الإحالة
                  </Button>
                </div>
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}
