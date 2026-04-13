import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import DashboardLayout from '@/components/DashboardLayout';
import { adminNavGroups } from '@/lib/navigation';
import { PageHeader, KpiCard } from '@/components/Quality';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  FileCheck, Activity, Search, Clock, LogIn, LogOut, Edit, Eye, Trash2, RefreshCw,
  Download, UserCircle, FileDown, FileSpreadsheet, Globe, Monitor, Hash, ArrowLeftRight,
  Shield, AlertTriangle, CheckCircle2, XCircle, BarChart3, Users, Server, Database,
  Ticket, FolderKanban, Landmark, Bug, Zap, FileText, Settings, Lock, TrendingUp,
  ChevronRight, ChevronLeft, ChevronsRight, ChevronsLeft
} from 'lucide-react';
import { exportToPDF, exportToExcel } from '@/lib/exports';

interface AuditLog {
  id: number;
  userId: number | null;
  userName?: string;
  userEmail?: string;
  action: string;
  actionCategory: string | null;
  entityType: string;
  entityId: number | null;
  resource: string | null;
  oldValue: any;
  newValue: any;
  changedFields: string[] | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestMethod: string | null;
  requestPath: string | null;
  outcome: string | null;
  severity: string | null;
  details: string | null;
  metadata: any;
  createdAt: string;
}

interface AuditStats {
  total: number;
  byAction: { action: string; count: number }[];
  byEntity: { entityType: string; count: number }[];
  bySeverity: { severity: string; count: number }[];
  byOutcome: { outcome: string; count: number }[];
  byHour: { hour: number; count: number }[];
  topUsers: { userId: number; userName: string; count: number }[];
  entityTypes: string[];
}

const actionLabels: Record<string, { label: string; icon: JSX.Element; color: string }> = {
  login: { label: 'تسجيل دخول', icon: <LogIn className="w-4 h-4" />, color: 'hub-badge-gold' },
  logout: { label: 'تسجيل خروج', icon: <LogOut className="w-4 h-4" />, color: 'hub-badge-navy' },
  login_failed: { label: 'فشل دخول', icon: <XCircle className="w-4 h-4" />, color: 'bg-destructive/20 text-destructive' },
  create: { label: 'إنشاء', icon: <Edit className="w-4 h-4" />, color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  update: { label: 'تعديل', icon: <Edit className="w-4 h-4" />, color: 'hub-badge-navy' },
  delete: { label: 'حذف', icon: <Trash2 className="w-4 h-4" />, color: 'bg-destructive/20 text-destructive' },
  view: { label: 'عرض', icon: <Eye className="w-4 h-4" />, color: 'bg-muted text-muted-foreground' },
  approve: { label: 'موافقة', icon: <CheckCircle2 className="w-4 h-4" />, color: 'bg-emerald-500/15 text-emerald-600' },
  reject: { label: 'رفض', icon: <XCircle className="w-4 h-4" />, color: 'bg-destructive/20 text-destructive' },
  export: { label: 'تصدير', icon: <Download className="w-4 h-4" />, color: 'hub-badge-gold' },
  import: { label: 'استيراد', icon: <Download className="w-4 h-4" />, color: 'hub-badge-navy' },
  permission_denied: { label: 'رفض إذن', icon: <Lock className="w-4 h-4" />, color: 'bg-destructive/20 text-destructive' },
  access_blocked: { label: 'حظر وصول', icon: <Shield className="w-4 h-4" />, color: 'bg-destructive/20 text-destructive' },
  rate_limited: { label: 'حد معدل', icon: <AlertTriangle className="w-4 h-4" />, color: 'bg-amber-500/15 text-amber-600' },
  settings_changed: { label: 'تغيير إعدادات', icon: <Settings className="w-4 h-4" />, color: 'hub-badge-navy' },
  password_changed: { label: 'تغيير كلمة سر', icon: <Lock className="w-4 h-4" />, color: 'hub-badge-gold' },
};

const entityLabels: Record<string, { label: string; icon: JSX.Element }> = {
  user: { label: 'مستخدم', icon: <UserCircle className="w-3.5 h-3.5" /> },
  ticket: { label: 'تذكرة', icon: <Ticket className="w-3.5 h-3.5" /> },
  task: { label: 'مهمة', icon: <FileText className="w-3.5 h-3.5" /> },
  project: { label: 'مشروع', icon: <FolderKanban className="w-3.5 h-3.5" /> },
  session: { label: 'جلسة', icon: <Monitor className="w-3.5 h-3.5" /> },
  planner_board: { label: 'لوحة مخطط', icon: <FolderKanban className="w-3.5 h-3.5" /> },
  planner_task: { label: 'مهمة مخطط', icon: <FileText className="w-3.5 h-3.5" /> },
  planner_bucket: { label: 'مجموعة مخطط', icon: <FolderKanban className="w-3.5 h-3.5" /> },
  planner_comment: { label: 'تعليق مخطط', icon: <FileText className="w-3.5 h-3.5" /> },
  committee: { label: 'لجنة', icon: <Landmark className="w-3.5 h-3.5" /> },
  committee_meeting: { label: 'اجتماع لجنة', icon: <Landmark className="w-3.5 h-3.5" /> },
  committee_decision: { label: 'قرار لجنة', icon: <Landmark className="w-3.5 h-3.5" /> },
  committee_task: { label: 'مهمة لجنة', icon: <Landmark className="w-3.5 h-3.5" /> },
  referral: { label: 'إحالة', icon: <ArrowLeftRight className="w-3.5 h-3.5" /> },
  security_incident: { label: 'حادث أمني', icon: <Shield className="w-3.5 h-3.5" /> },
  security_threat: { label: 'تهديد أمني', icon: <Bug className="w-3.5 h-3.5" /> },
  security_vulnerability: { label: 'ثغرة أمنية', icon: <Bug className="w-3.5 h-3.5" /> },
  security_risk: { label: 'خطر أمني', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  digital_initiative: { label: 'مبادرة رقمية', icon: <Zap className="w-3.5 h-3.5" /> },
  digital_application: { label: 'تطبيق رقمي', icon: <Zap className="w-3.5 h-3.5" /> },
  cloud_service: { label: 'خدمة سحابية', icon: <Server className="w-3.5 h-3.5" /> },
  server: { label: 'خادم', icon: <Server className="w-3.5 h-3.5" /> },
  network: { label: 'شبكة', icon: <Server className="w-3.5 h-3.5" /> },
  dmo_request: { label: 'طلب DMO', icon: <FileText className="w-3.5 h-3.5" /> },
  compliance: { label: 'امتثال', icon: <Shield className="w-3.5 h-3.5" /> },
  data_catalog: { label: 'كتالوج بيانات', icon: <Database className="w-3.5 h-3.5" /> },
  data_dictionary: { label: 'قاموس بيانات', icon: <Database className="w-3.5 h-3.5" /> },
  data_subject_request: { label: 'طلب بيانات', icon: <UserCircle className="w-3.5 h-3.5" /> },
  consent_record: { label: 'سجل موافقة', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  privacy_notice: { label: 'إشعار خصوصية', icon: <Shield className="w-3.5 h-3.5" /> },
  data_breach: { label: 'خرق بيانات', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  vendor: { label: 'مورد', icon: <Users className="w-3.5 h-3.5" /> },
  sla_agreement: { label: 'اتفاقية SLA', icon: <FileText className="w-3.5 h-3.5" /> },
  asset: { label: 'أصل', icon: <Server className="w-3.5 h-3.5" /> },
  evidence: { label: 'دليل', icon: <FileCheck className="w-3.5 h-3.5" /> },
  feature_request: { label: 'طلب ميزة', icon: <Zap className="w-3.5 h-3.5" /> },
  escalation: { label: 'تصعيد', icon: <TrendingUp className="w-3.5 h-3.5" /> },
  alert_rule: { label: 'قاعدة تنبيه', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  automation_rule: { label: 'أتمتة', icon: <Settings className="w-3.5 h-3.5" /> },
  external_system: { label: 'نظام خارجي', icon: <Globe className="w-3.5 h-3.5" /> },
  database_connection: { label: 'اتصال قاعدة بيانات', icon: <Database className="w-3.5 h-3.5" /> },
  kpi_metric: { label: 'مؤشر أداء', icon: <BarChart3 className="w-3.5 h-3.5" /> },
  knowledge_article: { label: 'مقال معرفي', icon: <FileText className="w-3.5 h-3.5" /> },
  document: { label: 'مستند', icon: <FileText className="w-3.5 h-3.5" /> },
  ndmo_assessment: { label: 'تقييم NDMO', icon: <Shield className="w-3.5 h-3.5" /> },
  regulatory_control: { label: 'ضابط تنظيمي', icon: <Shield className="w-3.5 h-3.5" /> },
  voting_session: { label: 'جلسة تصويت', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  admin_action: { label: 'إجراء إداري', icon: <Settings className="w-3.5 h-3.5" /> },
  domain: { label: 'مجال', icon: <Globe className="w-3.5 h-3.5" /> },
  decision: { label: 'قرار', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  team_member: { label: 'عضو فريق', icon: <Users className="w-3.5 h-3.5" /> },
};

const severityConfig: Record<string, { label: string; color: string; icon: JSX.Element }> = {
  debug: { label: 'تتبع', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', icon: <Activity className="w-3 h-3" /> },
  info: { label: 'معلومات', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: <Activity className="w-3 h-3" /> },
  warning: { label: 'تحذير', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: <AlertTriangle className="w-3 h-3" /> },
  error: { label: 'خطأ', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: <XCircle className="w-3 h-3" /> },
  critical: { label: 'حرج', color: 'bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-300', icon: <AlertTriangle className="w-3 h-3" /> },
};

const categoryLabels: Record<string, string> = {
  auth: 'المصادقة',
  access_control: 'التحكم بالوصول',
  data_modification: 'تعديل البيانات',
  data_access: 'الوصول للبيانات',
  system: 'النظام',
  security: 'الأمان',
  admin: 'الإدارة',
  user_action: 'إجراء مستخدم',
};

function LogSkeleton() {
  return (
    <div className="flex items-start gap-4 p-4 rounded-lg border border-border">
      <Skeleton className="w-10 h-10 rounded-lg" />
      <div className="flex-1 space-y-2">
        <div className="flex gap-2"><Skeleton className="w-20 h-5" /><Skeleton className="w-16 h-5" /></div>
        <Skeleton className="w-3/4 h-4" />
        <Skeleton className="w-24 h-3" />
      </div>
      <div className="space-y-1"><Skeleton className="w-16 h-4" /><Skeleton className="w-20 h-3" /></div>
    </div>
  );
}

function ActivityHeatmap({ data }: { data: { hour: number; count: number }[] }) {
  const maxCount = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="flex items-end gap-1 h-20">
      {Array.from({ length: 24 }, (_, hour) => {
        const item = data.find(d => d.hour === hour);
        const count = item?.count || 0;
        const height = Math.max((count / maxCount) * 100, 4);
        const opacity = count === 0 ? 0.1 : 0.3 + (count / maxCount) * 0.7;
        return (
          <div key={hour} className="flex-1 flex flex-col items-center gap-1" title={`${hour}:00 - ${count} عملية`}>
            <div
              className="w-full rounded-t-sm bg-[hsl(43_74%_49%)]"
              style={{ height: `${height}%`, opacity }}
            />
            {hour % 6 === 0 && <span className="text-[9px] text-muted-foreground">{hour}</span>}
          </div>
        );
      })}
    </div>
  );
}

function JsonViewer({ data, label, variant }: { data: any; label: string; variant: 'old' | 'new' }) {
  if (!data) return null;
  const parsed = typeof data === 'string' ? (() => { try { return JSON.parse(data); } catch { return data; } })() : data;
  const borderColor = variant === 'old' ? 'border-destructive/20' : 'border-emerald-500/20';
  const bgColor = variant === 'old' ? 'bg-destructive/5' : 'bg-emerald-500/5';
  const labelColor = variant === 'old' ? 'text-destructive' : 'text-emerald-500';

  if (typeof parsed === 'object' && parsed !== null) {
    return (
      <div className={`p-3 ${bgColor} border ${borderColor} rounded-lg`}>
        <p className={`text-xs ${labelColor} mb-2 font-medium`}>{label}</p>
        <div className="space-y-1">
          {Object.entries(parsed).map(([key, val]) => (
            <div key={key} className="flex justify-between text-xs gap-2">
              <span className="text-muted-foreground font-mono shrink-0">{key}:</span>
              <span className="font-mono text-foreground break-all text-left">{String(val)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className={`p-3 ${bgColor} border ${borderColor} rounded-lg`}>
      <p className={`text-xs ${labelColor} mb-1`}>{label}</p>
      <p className="text-xs font-mono break-all">{String(parsed)}</p>
    </div>
  );
}

export default function AuditLogs() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [serverSearch, setServerSearch] = useState('');
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [actionFilter, setActionFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [outcomeFilter, setOutcomeFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(100);

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    if (searchTimeout) clearTimeout(searchTimeout);
    const timeout = setTimeout(() => {
      setServerSearch(value);
      setCurrentPage(1);
    }, 500);
    setSearchTimeout(timeout);
  }, [searchTimeout]);

  const { data: logsResponse, isLoading, refetch } = useQuery<{ logs: AuditLog[]; total: number; page: number; pageSize: number; totalPages: number }>({
    queryKey: ['/api/audit-logs', { fromDate, toDate, action: actionFilter, entityType: entityFilter, severity: severityFilter, outcome: outcomeFilter, search: serverSearch, page: currentPage, pageSize }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', String(currentPage));
      params.append('pageSize', String(pageSize));
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);
      if (actionFilter !== 'all') params.append('action', actionFilter);
      if (entityFilter !== 'all') params.append('entityType', entityFilter);
      if (severityFilter !== 'all') params.append('severity', severityFilter);
      if (outcomeFilter !== 'all') params.append('outcome', outcomeFilter);
      if (serverSearch.trim()) params.append('search', serverSearch.trim());
      const response = await apiRequest('GET', `/api/audit-logs?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch logs');
      return response.json();
    },
  });

  const logs = logsResponse?.logs || [];
  const totalLogs = logsResponse?.total || 0;
  const totalPages = logsResponse?.totalPages || 1;

  const { data: stats } = useQuery<AuditStats>({
    queryKey: ['/api/audit-logs/stats', { fromDate, toDate }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);
      const response = await apiRequest('GET', `/api/audit-logs/stats?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
  });

  const filteredLogs = useMemo(() => {
    let result = logs;
    if (activeTab !== 'all') {
      const tabMap: Record<string, string[]> = {
        auth: ['login', 'logout', 'login_failed', 'password_changed', 'session_created', 'session_revoked'],
        data: ['create', 'update', 'delete'],
        security: ['permission_denied', 'access_blocked', 'rate_limited'],
      };
      result = result.filter(log => {
        if (activeTab === 'auth') return tabMap.auth.includes(log.action) || log.actionCategory === 'auth';
        if (activeTab === 'data') return tabMap.data.includes(log.action) || log.actionCategory === 'data_modification';
        if (activeTab === 'security') return tabMap.security.includes(log.action) || log.actionCategory === 'security' || log.severity === 'error' || log.severity === 'critical';
        return true;
      });
    }
    return result;
  }, [logs, activeTab]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return {
      date: date.toLocaleDateString('ar-SA'),
      time: date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await apiRequest('GET', '/api/export/audit-logs');
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `سجلات-التدقيق-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: 'تم التصدير بنجاح', description: 'تم تحميل ملف Excel' });
    } catch {
      toast({ title: 'فشل التصدير', description: 'حدث خطأ أثناء تصدير البيانات', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = () => {
    exportToPDF({
      title: 'سجل التدقيق الشامل',
      subtitle: 'نادي سباقات الخيل — مركز التحكم',
      columns: [
        { header: 'الإجراء', key: 'action', width: 25 },
        { header: 'النوع', key: 'entityType', width: 25 },
        { header: 'المستخدم', key: 'userName', width: 25 },
        { header: 'الخطورة', key: 'severity', width: 15 },
        { header: 'النتيجة', key: 'outcome', width: 15 },
        { header: 'التفاصيل', key: 'details', width: 45 },
        { header: 'IP', key: 'ipAddress', width: 25 },
        { header: 'التاريخ', key: 'createdAt', width: 35 },
      ],
      data: filteredLogs.map(log => ({
        ...log,
        action: actionLabels[log.action]?.label || log.action,
        entityType: entityLabels[log.entityType]?.label || log.entityType || '-',
        userName: log.userName || 'النظام',
        severity: severityConfig[log.severity || 'info']?.label || log.severity || '-',
        outcome: log.outcome === 'success' ? 'نجاح' : log.outcome === 'failure' ? 'فشل' : log.outcome || '-',
        details: log.details || '-',
        ipAddress: log.ipAddress || '-',
        createdAt: new Date(log.createdAt).toLocaleDateString('ar-SA') + ' ' + new Date(log.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      })),
      filename: `audit-logs-${new Date().toISOString().split('T')[0]}`,
      orientation: 'landscape',
    });
  };

  const handleExportExcel = () => {
    exportToExcel({
      title: 'سجل التدقيق الشامل',
      columns: [
        { header: 'الإجراء', key: 'action' },
        { header: 'التصنيف', key: 'actionCategory' },
        { header: 'النوع', key: 'entityType' },
        { header: 'رقم الكيان', key: 'entityId' },
        { header: 'المستخدم', key: 'userName' },
        { header: 'البريد', key: 'userEmail' },
        { header: 'الخطورة', key: 'severity' },
        { header: 'النتيجة', key: 'outcome' },
        { header: 'التفاصيل', key: 'details' },
        { header: 'IP', key: 'ipAddress' },
        { header: 'المسار', key: 'requestPath' },
        { header: 'الطريقة', key: 'requestMethod' },
        { header: 'التاريخ', key: 'createdAt' },
      ],
      data: filteredLogs.map(log => ({
        ...log,
        action: actionLabels[log.action]?.label || log.action,
        actionCategory: categoryLabels[log.actionCategory || ''] || log.actionCategory || '-',
        entityType: entityLabels[log.entityType]?.label || log.entityType || '-',
        entityId: log.entityId || '-',
        userName: log.userName || 'النظام',
        userEmail: log.userEmail || '-',
        severity: severityConfig[log.severity || 'info']?.label || '-',
        outcome: log.outcome === 'success' ? 'نجاح' : log.outcome === 'failure' ? 'فشل' : '-',
        details: log.details || '-',
        ipAddress: log.ipAddress || '-',
        requestPath: log.requestPath || '-',
        requestMethod: log.requestMethod || '-',
        createdAt: new Date(log.createdAt).toLocaleDateString('ar-SA') + ' ' + new Date(log.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      })),
      filename: `audit-logs-${new Date().toISOString().split('T')[0]}`,
    });
  };

  const clearFilters = () => {
    setSearchTerm('');
    setServerSearch('');
    setActionFilter('all');
    setEntityFilter('all');
    setSeverityFilter('all');
    setOutcomeFilter('all');
    setFromDate('');
    setToDate('');
    setActiveTab('all');
    setCurrentPage(1);
  };

  const quickStats = useMemo(() => {
    const successCount = stats?.byOutcome?.find(o => o.outcome === 'success')?.count || 0;
    const failureCount = stats?.byOutcome?.find(o => o.outcome === 'failure')?.count || 0;
    const warningCount = stats?.bySeverity?.find(s => s.severity === 'warning')?.count || 0;
    const criticalCount = stats?.bySeverity?.find(s => s.severity === 'critical' || s.severity === 'error')?.count || 0;
    return { successCount, failureCount, warningCount, criticalCount };
  }, [stats]);

  return (
    <DashboardLayout
      title="سجل التدقيق الشامل"
      subtitle="تتبع ومراقبة جميع العمليات والأنشطة في النظام"
      navGroups={adminNavGroups}
      portalName="بوابة مدير النظام"
    >
      <div className="space-y-5">
        <PageHeader
          icon={FileCheck}
          title="سجل التدقيق الشامل"
          subtitle="مراقبة وتتبع جميع عمليات النظام بالتفصيل"
          actions={
            <>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportPDF} data-testid="btn-export-pdf"><FileDown className="w-3.5 h-3.5" />PDF</Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportExcel} data-testid="btn-export-excel"><FileSpreadsheet className="w-3.5 h-3.5" />Excel</Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExport} disabled={isExporting} data-testid="btn-export">
                <Download className="w-3.5 h-3.5" />{isExporting ? 'جاري التصدير...' : 'تصدير'}
              </Button>
            </>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <KpiCard label="إجمالي السجلات" value={stats?.total || 0} icon={FileCheck} color="navy" />
          <KpiCard label="تسجيل دخول" value={stats?.byAction?.find(a => a.action === 'login')?.count || 0} icon={LogIn} color="gold" />
          <KpiCard label="إنشاء" value={stats?.byAction?.find(a => a.action === 'create')?.count || 0} icon={Edit} color="navy" />
          <KpiCard label="تعديل" value={stats?.byAction?.find(a => a.action === 'update')?.count || 0} icon={Edit} color="navy" />
          <KpiCard label="حذف" value={stats?.byAction?.find(a => a.action === 'delete')?.count || 0} icon={Trash2} color="danger" />
          <KpiCard label="ناجحة" value={quickStats.successCount} icon={CheckCircle2} color="navy" />
          <KpiCard label="فاشلة" value={quickStats.failureCount} icon={XCircle} color="danger" />
          <KpiCard label="تحذيرات" value={quickStats.warningCount + quickStats.criticalCount} icon={AlertTriangle} color={quickStats.criticalCount > 0 ? "danger" : "gold"} />
        </div>

        {stats?.byHour && stats.byHour.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="card-premium lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="w-4 h-4 hub-stat-gold" />نشاط النظام حسب الساعة</CardTitle>
              </CardHeader>
              <CardContent><ActivityHeatmap data={stats.byHour} /></CardContent>
            </Card>
            <Card className="card-premium">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Users className="w-4 h-4 hub-stat-gold" />أكثر المستخدمين نشاطاً</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {stats.topUsers?.slice(0, 5).map((user, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[hsl(43_74%_49%)]/20 flex items-center justify-center text-xs font-bold text-[hsl(43_74%_49%)]">{i + 1}</div>
                        <span className="truncate max-w-[120px]">{user.userName}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">{user.count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {stats?.byEntity && stats.byEntity.length > 0 && (
          <Card className="card-premium">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Database className="w-4 h-4 hub-stat-gold" />التوزيع حسب نوع الكيان</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {stats.byEntity.filter(e => e.entityType).slice(0, 15).map((entity, i) => {
                  const info = entityLabels[entity.entityType] || { label: entity.entityType, icon: <Activity className="w-3.5 h-3.5" /> };
                  return (
                    <Badge
                      key={i}
                      variant="outline"
                      className="gap-1.5 py-1.5 px-3 cursor-pointer hover:bg-muted/50 transition-colors"
                      data-testid={`entity-badge-${entity.entityType}`}
                      onClick={() => setEntityFilter(entity.entityType)}
                    >
                      {info.icon}
                      <span>{info.label}</span>
                      <span className="text-muted-foreground font-mono text-xs">({entity.count})</span>
                    </Badge>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 w-full max-w-md">
            <TabsTrigger value="all" data-testid="tab-all">الكل</TabsTrigger>
            <TabsTrigger value="auth" data-testid="tab-auth">المصادقة</TabsTrigger>
            <TabsTrigger value="data" data-testid="tab-data">البيانات</TabsTrigger>
            <TabsTrigger value="security" data-testid="tab-security">الأمان</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="bg-card border border-border rounded-xl px-4 py-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="بحث في السجلات (التفاصيل، المستخدم، IP، المسار)..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pr-10 h-9 text-sm bg-background"
                data-testid="input-search-logs"
              />
            </div>
            <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-32 h-9 text-sm" data-testid="select-action-filter">
                <SelectValue placeholder="الإجراء" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الإجراءات</SelectItem>
                <SelectItem value="login">تسجيل دخول</SelectItem>
                <SelectItem value="logout">تسجيل خروج</SelectItem>
                <SelectItem value="create">إنشاء</SelectItem>
                <SelectItem value="update">تعديل</SelectItem>
                <SelectItem value="delete">حذف</SelectItem>
                <SelectItem value="approve">موافقة</SelectItem>
                <SelectItem value="reject">رفض</SelectItem>
                <SelectItem value="export">تصدير</SelectItem>
                <SelectItem value="permission_denied">رفض إذن</SelectItem>
              </SelectContent>
            </Select>
            <Select value={entityFilter} onValueChange={(v) => { setEntityFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-36 h-9 text-sm" data-testid="select-entity-filter">
                <SelectValue placeholder="نوع الكيان" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأنواع</SelectItem>
                {(stats?.entityTypes || []).map(et => (
                  <SelectItem key={et} value={et}>{entityLabels[et]?.label || et}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={(v) => { setSeverityFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-28 h-9 text-sm" data-testid="select-severity-filter">
                <SelectValue placeholder="الخطورة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الخطورة</SelectItem>
                <SelectItem value="info">معلومات</SelectItem>
                <SelectItem value="warning">تحذير</SelectItem>
                <SelectItem value="error">خطأ</SelectItem>
                <SelectItem value="critical">حرج</SelectItem>
              </SelectContent>
            </Select>
            <Select value={outcomeFilter} onValueChange={(v) => { setOutcomeFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-28 h-9 text-sm" data-testid="select-outcome-filter">
                <SelectValue placeholder="النتيجة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل النتائج</SelectItem>
                <SelectItem value="success">نجاح</SelectItem>
                <SelectItem value="failure">فشل</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setCurrentPage(1); }} className="w-36 h-9 text-sm" data-testid="input-from-date" />
              <span className="text-xs text-muted-foreground shrink-0">إلى</span>
              <Input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setCurrentPage(1); }} className="w-36 h-9 text-sm" data-testid="input-to-date" />
            </div>
            <div className="flex items-center gap-2 ms-auto">
              <Button variant="outline" size="sm" className="h-9 text-xs" onClick={clearFilters} data-testid="button-clear-filters">مسح الفلاتر</Button>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => refetch()} data-testid="button-refresh-logs"><RefreshCw className="w-3.5 h-3.5" /></Button>
            </div>
          </div>
        </div>

        <Card className="card-premium">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileCheck className="w-5 h-5 hub-stat-gold" />
                  سجل الأنشطة
                </CardTitle>
                <CardDescription>
                  عرض {filteredLogs.length} سجل — الصفحة {currentPage} من {totalPages} (إجمالي {totalLogs.toLocaleString('ar-SA')} سجل)
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">{[...Array(5)].map((_, i) => <LogSkeleton key={i} />)}</div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-12">
                <FileCheck className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-medium mb-2">لا توجد سجلات</h3>
                <p className="text-muted-foreground">لم يتم العثور على سجلات تطابق معايير البحث</p>
                <Button variant="outline" className="mt-4" onClick={clearFilters}>مسح الفلاتر</Button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredLogs.map((log) => {
                  const action = actionLabels[log.action] || { label: log.action, icon: <Activity className="w-4 h-4" />, color: 'bg-muted text-muted-foreground' };
                  const entity = entityLabels[log.entityType] || (log.entityType ? { label: log.entityType, icon: <Activity className="w-3.5 h-3.5" /> } : null);
                  const sev = severityConfig[log.severity || 'info'];
                  const { date, time } = formatDate(log.createdAt);

                  return (
                    <div
                      key={log.id}
                      className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-[hsl(43_74%_49%)]/30 hover:bg-muted/30 transition-all cursor-pointer group"
                      data-testid={`log-item-${log.id}`}
                      onClick={() => setSelectedLog(log)}
                    >
                      <div className={`p-2 rounded-lg shrink-0 ${action.color}`}>{action.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <Badge className={`${action.color} text-xs`}>{action.label}</Badge>
                          {entity && (
                            <Badge variant="outline" className="text-xs gap-1">
                              {entity.icon}{entity.label}
                            </Badge>
                          )}
                          {log.entityId && (
                            <span className="text-xs text-muted-foreground font-mono">#{log.entityId}</span>
                          )}
                          {sev && log.severity && log.severity !== 'info' && (
                            <Badge className={`${sev.color} text-[10px] gap-0.5 px-1.5 py-0`}>{sev.icon}{sev.label}</Badge>
                          )}
                          {log.outcome === 'failure' && (
                            <Badge className="bg-destructive/20 text-destructive text-[10px] gap-0.5 px-1.5 py-0"><XCircle className="w-2.5 h-2.5" />فشل</Badge>
                          )}
                        </div>
                        <p className="text-sm text-foreground truncate">{log.details || 'لا توجد تفاصيل'}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><UserCircle className="w-3 h-3" />{log.userName || 'النظام'}</span>
                          {log.ipAddress && <span className="flex items-center gap-1"><Globe className="w-3 h-3" />{log.ipAddress}</span>}
                          {log.requestMethod && <span className="font-mono text-[10px]">{log.requestMethod}</span>}
                        </div>
                      </div>
                      <div className="text-left text-sm text-muted-foreground shrink-0">
                        <div className="flex items-center gap-1"><Clock className="w-3 h-3" />{time}</div>
                        <div className="text-xs mt-0.5">{date}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                <div className="text-sm text-muted-foreground">
                  صفحة {currentPage} من {totalPages} — إجمالي {totalLogs.toLocaleString('ar-SA')} سجل
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(1)}
                    data-testid="btn-first-page"
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    data-testid="btn-prev-page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                  <div className="flex items-center gap-1 mx-2">
                    {(() => {
                      const pages: number[] = [];
                      const start = Math.max(1, currentPage - 2);
                      const end = Math.min(totalPages, currentPage + 2);
                      for (let i = start; i <= end; i++) pages.push(i);
                      return pages.map(p => (
                        <Button
                          key={p}
                          variant={p === currentPage ? "default" : "outline"}
                          size="icon"
                          className="h-8 w-8 text-xs"
                          onClick={() => setCurrentPage(p)}
                          data-testid={`btn-page-${p}`}
                        >
                          {p}
                        </Button>
                      ));
                    })()}
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    data-testid="btn-next-page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(totalPages)}
                    data-testid="btn-last-page"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedLog} onOpenChange={open => { if (!open) setSelectedLog(null); }}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto" dir="rtl" data-testid="dialog-log-detail">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck className="w-5 h-5 hub-stat-gold" />
              تفاصيل سجل التدقيق #{selectedLog?.id}
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (() => {
            const action = actionLabels[selectedLog.action] || { label: selectedLog.action, icon: <Activity className="w-4 h-4" />, color: 'bg-muted text-muted-foreground' };
            const entity = entityLabels[selectedLog.entityType] || (selectedLog.entityType ? { label: selectedLog.entityType, icon: <Activity className="w-3.5 h-3.5" /> } : null);
            const sev = severityConfig[selectedLog.severity || 'info'];
            const { date, time } = formatDate(selectedLog.createdAt);
            return (
              <div className="space-y-4 py-2">
                <div className="flex gap-2 flex-wrap">
                  <Badge className={`${action.color} gap-1 text-sm`}>{action.icon}{action.label}</Badge>
                  {entity && <Badge variant="outline" className="gap-1">{entity.icon}{entity.label}</Badge>}
                  {selectedLog.entityId && <Badge variant="outline" className="text-muted-foreground"><Hash className="w-3 h-3 ml-1" />{selectedLog.entityId}</Badge>}
                  {sev && <Badge className={`${sev.color} gap-1`}>{sev.icon}{sev.label}</Badge>}
                  {selectedLog.outcome && (
                    <Badge className={selectedLog.outcome === 'success' ? 'bg-emerald-500/15 text-emerald-600' : 'bg-destructive/20 text-destructive'}>
                      {selectedLog.outcome === 'success' ? <CheckCircle2 className="w-3 h-3 ml-1" /> : <XCircle className="w-3 h-3 ml-1" />}
                      {selectedLog.outcome === 'success' ? 'نجاح' : 'فشل'}
                    </Badge>
                  )}
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: UserCircle, label: 'المستخدم', value: `${selectedLog.userName || 'النظام'}${selectedLog.userEmail ? ` (${selectedLog.userEmail})` : ''}` },
                    { icon: Clock, label: 'التاريخ والوقت', value: `${date} - ${time}` },
                    { icon: Globe, label: 'عنوان IP', value: selectedLog.ipAddress || 'غير متاح' },
                    { icon: Server, label: 'المسار', value: selectedLog.requestPath ? `${selectedLog.requestMethod || ''} ${selectedLog.requestPath}` : 'غير متاح' },
                    { icon: Shield, label: 'التصنيف', value: categoryLabels[selectedLog.actionCategory || ''] || selectedLog.actionCategory || 'غير محدد' },
                    { icon: Database, label: 'المورد', value: selectedLog.resource || 'غير محدد' },
                  ].map((row, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <row.icon className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">{row.label}</p>
                        <p className="text-sm font-medium break-all">{row.value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {selectedLog.userAgent && (
                  <>
                    <Separator />
                    <div className="flex items-start gap-2">
                      <Monitor className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">المتصفح / الجهاز</p>
                        <p className="text-xs font-mono text-muted-foreground break-all">{selectedLog.userAgent}</p>
                      </div>
                    </div>
                  </>
                )}

                {selectedLog.details && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">التفاصيل</p>
                      <div className="p-3 bg-muted/40 rounded-lg text-sm leading-relaxed">{selectedLog.details}</div>
                    </div>
                  </>
                )}

                {(selectedLog.oldValue || selectedLog.newValue) && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1"><ArrowLeftRight className="w-3 h-3" />التغييرات</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <JsonViewer data={selectedLog.oldValue} label="القيمة القديمة" variant="old" />
                        <JsonViewer data={selectedLog.newValue} label="القيمة الجديدة" variant="new" />
                      </div>
                    </div>
                  </>
                )}

                {selectedLog.changedFields && Array.isArray(selectedLog.changedFields) && selectedLog.changedFields.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">الحقول المعدلة</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedLog.changedFields.map((field, i) => (
                          <Badge key={i} variant="outline" className="text-xs font-mono">{field}</Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {selectedLog.metadata && typeof selectedLog.metadata === 'object' && Object.keys(selectedLog.metadata).length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">بيانات إضافية</p>
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <div className="space-y-1">
                          {Object.entries(selectedLog.metadata).map(([key, val]) => (
                            <div key={key} className="flex justify-between text-xs gap-2">
                              <span className="text-muted-foreground font-mono">{key}:</span>
                              <span className="font-mono text-foreground">{String(val)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
