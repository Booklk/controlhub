import { useState, useMemo, useRef } from "react";
import { useConfirmDialog, ConfirmDialog } from '@/components/ConfirmDialog';
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth, getAuthToken } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { exportToPDF, exportToExcel, formatStatus} from '@/lib/exports';
import DashboardLayout from "@/components/DashboardLayout";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { dmoNavGroups } from "@/lib/navigation";
import { SmartDailyOps } from '@/components/SmartDailyOps';
import { QuickNotes } from '@/components/QuickNotes';
import { SmartBookmarks } from '@/components/SmartBookmarks';
import DMORequestsManagement from "@/components/DMORequestsManagement";
import { StorytellingTour, TourTriggerButton } from "@/components/StorytellingTour";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { FormSuccessPanel, FieldHint } from "@/components/ui/form-guide";
import {
  Database, FileText, CheckCircle2, Clock, AlertTriangle, Loader2, RefreshCw,
  Plus, Shield, ClipboardCheck, BarChart3, TrendingUp, Target, Calendar, Bell,
  Lock, Users, Building2, Layers, Activity, Settings, FileCheck, AlertCircle,
  Award, FolderOpen, Search, BookOpen, Briefcase, Scale, Archive, FileWarning,
  Vote, UserCheck, Eye, Edit, Trash2, Download, Upload, Filter, MoreVertical,
  ChevronLeft, ChevronRight, Mail, Phone, MapPin, Hash, Tag, Workflow,
  FileSpreadsheet, PieChart, LineChart, Gauge, Timer, CheckSquare, XCircle,
  MessageSquare, Gavel, ClipboardList, GraduationCap, HelpCircle, Zap,
  ShieldAlert, FileKey, Server, Folder, ListChecks, Send, Sparkles,
  FileDown, ArrowLeftRight
} from "lucide-react";

const DMO_DEPARTMENT_ID = 5;
export { DMO_DEPARTMENT_ID };

// Data Classification Levels (NDMO)
const classificationLevels = [
  { id: 'public', name: 'عام', nameEn: 'Public', color: 'hub-badge-gold-solid', textColor: 'hub-stat-gold', bgLight: 'bg-accent/10' },
  { id: 'restricted', name: 'مقيد', nameEn: 'Restricted', color: 'hub-badge-gold-solid', textColor: 'hub-stat-gold', bgLight: 'bg-accent/10' },
  { id: 'confidential', name: 'سري', nameEn: 'Confidential', color: 'hub-badge-navy', textColor: 'text-muted-foreground', bgLight: 'bg-primary/10' },
  { id: 'top_secret', name: 'سري للغاية', nameEn: 'Top Secret', color: 'hub-badge-neutral', textColor: 'text-muted-foreground', bgLight: 'bg-primary/10' },
];

export default function DMOPortal() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { confirm: confirmAction, dialogProps: confirmDialogProps } = useConfirmDialog();
  const [showTour, setShowTour] = useState(false);
  
  // Detail view dialog state
  const [detailDialog, setDetailDialog] = useState<{ open: boolean; title: string; content: { label: string; value: string }[] } | null>(null);

  // Form dialog states
  const [isAddIncidentOpen, setIsAddIncidentOpen] = useState(false);
  const [isBreachReportOpen, setIsBreachReportOpen] = useState(false);
  const [isAddRiskOpen, setIsAddRiskOpen] = useState(false);
  const [isAddAgreementOpen, setIsAddAgreementOpen] = useState(false);
  const [isStartAssessmentOpen, setIsStartAssessmentOpen] = useState(false);
  const [isAddCourseOpen, setIsAddCourseOpen] = useState(false);
  const [editingStewardUser, setEditingStewardUser] = useState<any>(null);

  // Form data for new dialogs
  const [incidentForm, setIncidentForm] = useState({ title: '', severity: 'medium', description: '' });
  const [breachForm, setBreachForm] = useState({ title: '', type: '', description: '', severity: 'medium', affectedRecords: '', affectedDataTypes: '' });
  const [riskForm, setRiskForm] = useState({ title: '', riskLevel: 'medium', description: '', mitigation: '' });
  const [agreementForm, setAgreementForm] = useState({ title: '', partyName: '', agreementType: '', startDate: '', endDate: '' });
  const [courseForm, setCourseForm] = useState({ title: '', duration: '', level: 'مبتدئ', category: '' });

  // Dialogs state
  const [isAddAssetOpen, setIsAddAssetOpen] = useState(false);
  const [isAddStewardOpen, setIsAddStewardOpen] = useState(false);
  const [isAddDictionaryOpen, setIsAddDictionaryOpen] = useState(false);
  const [isAddQualityOpen, setIsAddQualityOpen] = useState(false);

  // Form states
  const [assetForm, setAssetForm] = useState({
    name: '', nameEn: '', description: '', system: '', owner: '', 
    classification: 'restricted', dataType: 'structured', status: 'active',
    databaseName: '', schemaName: '', tableName: '', connectionType: ''
  });
  const [stewardForm, setStewardForm] = useState({
    name: '', email: '', phone: '', department: '', role: 'steward'
  });
  const [dictionaryForm, setDictionaryForm] = useState({
    term: '', termEn: '', definition: '', category: '', dataType: '',
    dataAssetId: '', columnName: '', businessRule: ''
  });
  const [qualityForm, setQualityForm] = useState({
    name: '', dimension: 'الدقة', ruleType: 'validation', threshold: 90,
    currentScore: 0, description: '', status: 'active',
    targetTable: '', targetColumn: '', systemName: '', severity: 'medium',
    validationPattern: '', sqlExpression: '', connectionId: 0
  });
  const [selectedTerm, setSelectedTerm] = useState<any>(null);
  const [editingDictionaryTerm, setEditingDictionaryTerm] = useState<any>(null);
  const [editingAsset, setEditingAsset] = useState<any>(null);
  const [editingSteward, setEditingSteward] = useState<any>(null);
  const [editingQualityRule, setEditingQualityRule] = useState<any>(null);
  // DSR Create state
  const [isDsrCreateOpen, setIsDsrCreateOpen] = useState(false);
  const [dsrForm, setDsrForm] = useState({
    requestType: 'access', subjectName: '', subjectEmail: '', subjectPhone: '',
    subjectIdNumber: '', description: '', priority: 'normal',
  });
  // DSR Dispatch state
  const [isDsrDispatchOpen, setIsDsrDispatchOpen] = useState(false);
  const [selectedDsrForDispatch, setSelectedDsrForDispatch] = useState<any>(null);
  const [dsrDispatchSystems, setDsrDispatchSystems] = useState<any[]>([]);
  const [dsrDispatchActionType, setDsrDispatchActionType] = useState('');
  const [selectedDsrForDetail, setSelectedDsrForDetail] = useState<any>(null);
  const [isDsrDetailOpen, setIsDsrDetailOpen] = useState(false);
  const [editingDecision, setEditingDecision] = useState<any>(null);
  const [showLinkedSystemsDialog, setShowLinkedSystemsDialog] = useState(false);
  const [showEvidenceFilter, setShowEvidenceFilter] = useState(false);
  const [evidenceSearch, setEvidenceSearch] = useState("");
  const [isAddEvidenceOpen, setIsAddEvidenceOpen] = useState(false);
  const [evidenceForm, setEvidenceForm] = useState({ title: '', requirementId: '', description: '' });
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const evidenceFileInputRef = useRef<HTMLInputElement>(null);
  const [stewardAttachment, setStewardAttachment] = useState<File | null>(null);
  const stewardFileInputRef = useRef<HTMLInputElement>(null);
  const [isAddComplianceReportOpen, setIsAddComplianceReportOpen] = useState(false);
  const [complianceReportForm, setComplianceReportForm] = useState({ title: '', framework: 'PDPL', period: '', score: '', status: 'draft', findings: '', recommendations: '' });
  const [dictionarySearch, setDictionarySearch] = useState("");
  const [archiveSearch, setArchiveSearch] = useState("");
  const [isAddRequirementOpen, setIsAddRequirementOpen] = useState(false);
  const [requirementForm, setRequirementForm] = useState({ domainId: '', code: '', titleAr: '', titleEn: '', description: '', priority: 'medium', complianceLevel: 'mandatory', evidenceType: 'document' });
  const [isAddFlowMappingOpen, setIsAddFlowMappingOpen] = useState(false);
  const [flowMappingForm, setFlowMappingForm] = useState({ sourceSystem: '', targetSystem: '', dataCategory: '', transferMethod: '', frequency: 'daily', sensitivity: 'internal', purpose: '', legalBasis: '' });
  const [successComplianceReport, setSuccessComplianceReport] = useState<{ id: number; title: string } | null>(null);
  const [successEvidence, setSuccessEvidence] = useState<{ id: number; title: string } | null>(null);
  const [successFlowMapping, setSuccessFlowMapping] = useState<{ id: number; source: string; target: string } | null>(null);
  const [successSteward, setSuccessSteward] = useState<{ id: number; name: string } | null>(null);

  // Data queries — staleTime set per query based on how often data changes
  const { data: domains = [], isLoading: domainsLoading, dataUpdatedAt: dashboardUpdatedAt } = useQuery<any[]>({
    queryKey: ['/api/domains'],
    staleTime: 10 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: requirements = [], isLoading: requirementsLoading } = useQuery<any[]>({
    queryKey: ['/api/requirements'],
    staleTime: 10 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: complianceReports = [] } = useQuery<any[]>({
    queryKey: ['/api/compliance/reports'],
    staleTime: 3 * 60 * 1000,
    refetchInterval: 3 * 60 * 1000,
  });

  const { data: evidences = [], isLoading: evidencesLoading } = useQuery<any[]>({
    queryKey: ['/api/evidences'],
    staleTime: 3 * 60 * 1000,
    refetchInterval: 3 * 60 * 1000,
  });

  const { data: tasks = [] } = useQuery<any[]>({
    queryKey: ['/api/tasks'],
    staleTime: 2 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  });

  const { data: decisions = [] } = useQuery<any[]>({
    queryKey: ['/api/committee/decisions'],
    staleTime: 5 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  });

  const { data: meetings = [] } = useQuery<any[]>({
    queryKey: ['/api/committee-meetings'],
    staleTime: 5 * 60 * 1000,
    refetchInterval: 3 * 60 * 1000,
  });

  const { data: members = [] } = useQuery<any[]>({
    queryKey: ['/api/committee-members'],
    staleTime: 10 * 60 * 1000,
  });

  const { data: dataAssetsList = [] } = useQuery<any[]>({
    queryKey: ['/api/data-assets'],
    staleTime: 5 * 60 * 1000,
  });

  const { data: trainingCoursesList = [] } = useQuery<any[]>({
    queryKey: ['/api/training-courses'],
    staleTime: 5 * 60 * 1000,
  });

  const { data: dictionaryTerms = [] } = useQuery<any[]>({
    queryKey: ['/api/data-dictionary'],
    staleTime: 5 * 60 * 1000,
  });

  const { data: stewardsList = [] } = useQuery<any[]>({
    queryKey: ['/api/data-stewards'],
    staleTime: 5 * 60 * 1000,
  });

  const { data: businessDepartments = [] } = useQuery<any[]>({
    queryKey: ['/api/departments'],
    staleTime: 15 * 60 * 1000,
  });

  const { data: qualityRules = [] } = useQuery<any[]>({
    queryKey: ['/api/data-quality'],
    staleTime: 5 * 60 * 1000,
  });

  const { data: securityIncidentsList = [] } = useQuery<any[]>({
    queryKey: ['/api/security-incidents'],
    staleTime: 2 * 60 * 1000,
  });

  const { data: risksList = [] } = useQuery<any[]>({
    queryKey: ['/api/data-risks'],
    staleTime: 5 * 60 * 1000,
  });

  const { data: agreementsList = [] } = useQuery<any[]>({
    queryKey: ['/api/data-agreements'],
    staleTime: 5 * 60 * 1000,
  });

  const { data: breachesList = [] } = useQuery<any[]>({
    queryKey: ['/api/data-breaches'],
    staleTime: 3 * 60 * 1000,
  });

  const { data: dsrList = [] } = useQuery<any[]>({
    queryKey: ['/api/dsr'],
    staleTime: 3 * 60 * 1000,
  });

  const { data: dsrStats } = useQuery<any>({
    queryKey: ['/api/dsr/stats/overview'],
    staleTime: 2 * 60 * 1000,
  });

  const { data: dsrDetailActions = [], refetch: refetchDsrActions } = useQuery<any[]>({
    queryKey: ['/api/dsr', String(selectedDsrForDetail?.id || ''), 'system-actions'],
    enabled: !!selectedDsrForDetail?.id,
    staleTime: 0,
  });

  const dispatchDsrMutation = useMutation({
    mutationFn: (data: { dsrId: number; systems: any[]; actionType: string }) =>
      apiRequest('POST', `/api/dsr/${data.dsrId}/dispatch`, { systems: data.systems, actionType: data.actionType }),
    onSuccess: () => {
      toast({ title: 'تم الإرسال', description: 'تم إرسال الطلب إلى الأنظمة المحددة بنجاح' });
      queryClient.invalidateQueries({ queryKey: ['/api/dsr'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dsr/stats/overview'] });
      if (selectedDsrForDetail?.id) queryClient.invalidateQueries({ queryKey: ['/api/dsr', String(selectedDsrForDetail.id), 'system-actions'] });
      setIsDsrDispatchOpen(false);
      setDsrDispatchSystems([]);
    },
    onError: (e: any) => toast({ title: 'خطأ', description: e.message || 'حدث خطأ في الإرسال', variant: 'destructive' }),
  });

  const updateDsrActionMutation = useMutation({
    mutationFn: (data: { dsrId: number; actionId: number; status: string; notes?: string }) =>
      apiRequest('PUT', `/api/dsr/${data.dsrId}/system-actions/${data.actionId}`, { status: data.status, notes: data.notes }),
    onSuccess: () => {
      toast({ title: 'تم التحديث' });
      if (selectedDsrForDetail?.id) queryClient.invalidateQueries({ queryKey: ['/api/dsr', String(selectedDsrForDetail.id), 'system-actions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dsr'] });
    },
    onError: (e: any) => toast({ title: 'خطأ', description: e.message, variant: 'destructive' }),
  });

  const deleteDsrActionMutation = useMutation({
    mutationFn: (data: { dsrId: number; actionId: number }) =>
      apiRequest('DELETE', `/api/dsr/${data.dsrId}/system-actions/${data.actionId}`),
    onSuccess: () => {
      toast({ title: 'تم الحذف' });
      if (selectedDsrForDetail?.id) queryClient.invalidateQueries({ queryKey: ['/api/dsr', String(selectedDsrForDetail.id), 'system-actions'] });
    },
    onError: (e: any) => toast({ title: 'خطأ', description: e.message, variant: 'destructive' }),
  });

  const createDsrMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/dsr', data),
    onSuccess: () => {
      toast({ title: 'تم الإنشاء', description: 'تم تسجيل طلب صاحب البيانات بنجاح' });
      queryClient.invalidateQueries({ queryKey: ['/api/dsr'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dsr/stats/overview'] });
      setIsDsrCreateOpen(false);
      setDsrForm({ requestType: 'access', subjectName: '', subjectEmail: '', subjectPhone: '', subjectIdNumber: '', description: '', priority: 'normal' });
    },
    onError: (e: any) => toast({ title: 'خطأ', description: e.message || 'حدث خطأ في إنشاء الطلب', variant: 'destructive' }),
  });

  const { data: dataFlowMappings = [] } = useQuery<any[]>({
    queryKey: ['/api/data-flow-mappings'],
    staleTime: 5 * 60 * 1000,
  });

  const { data: notificationsData = [], refetch: refetchNotifications } = useQuery<any[]>({
    queryKey: ['/api/notifications'],
    staleTime: 60 * 1000,
    refetchInterval: 3 * 60 * 1000,
  });

  // Mutations
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('PUT', '/api/notifications/read-all');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      toast({ title: 'تم تحديد جميع الإشعارات كمقروءة' });
    },
    onError: () => {
      toast({ title: 'حدث خطأ', variant: 'destructive' });
    }
  });

  const createEvidenceMutation = useMutation({
    mutationFn: async (data: any) => {
      if (evidenceFile) {
        const formData = new FormData();
        formData.append('title', data.title);
        if (data.requirementId) formData.append('requirementId', String(data.requirementId));
        if (data.description) formData.append('description', data.description);
        formData.append('file', evidenceFile);
        const token = getAuthToken() || '';
        const csrfRes = await fetch('/api/csrf-token');
        const { csrfToken } = await csrfRes.json();
        const res = await fetch('/api/evidences', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'X-CSRF-Token': csrfToken },
          body: formData,
        });
        if (!res.ok) throw new Error('فشل رفع الدليل');
        return res.json();
      }
      const payload: any = { title: data.title };
      if (data.requirementId) payload.requirementId = data.requirementId;
      if (data.description) payload.description = data.description;
      const res = await apiRequest('POST', '/api/evidences', payload);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/evidences'] });
      queryClient.invalidateQueries({ queryKey: ['/api/requirements'] });
      toast({ title: `تم رفع الدليل: ${data.title || evidenceForm.title}` });
      setEvidenceForm({ title: '', requirementId: '', description: '' });
      setEvidenceFile(null);
      setIsAddEvidenceOpen(false);
      setSuccessEvidence(null);
    },
    onError: () => {
      toast({ title: 'حدث خطأ في رفع الدليل', variant: 'destructive' });
    }
  });

  const createAssetMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/data-assets', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/data-assets'] });
      toast({ title: 'تم إضافة الأصل البياني بنجاح' });
      setIsAddAssetOpen(false);
      setAssetForm({ name: '', nameEn: '', description: '', system: '', owner: '', classification: 'restricted', dataType: 'structured', status: 'active', databaseName: '', schemaName: '', tableName: '', connectionType: '' });
    },
    onError: () => {
      toast({ title: 'حدث خطأ في إضافة الأصل', variant: 'destructive' });
    }
  });

  const updateAssetMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      await apiRequest('PUT', `/api/data-assets/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/data-assets'] });
      toast({ title: 'تم تحديث الأصل البياني بنجاح' });
      setEditingAsset(null);
      setIsAddAssetOpen(false);
    },
    onError: () => {
      toast({ title: 'حدث خطأ في تحديث الأصل', variant: 'destructive' });
    }
  });

  const deleteAssetMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/data-assets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/data-assets'] });
      toast({ title: 'تم حذف الأصل البياني بنجاح' });
    },
    onError: () => {
      toast({ title: 'حدث خطأ في حذف الأصل', variant: 'destructive' });
    }
  });

  const updateDsrStatusMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: number; status: string; notes?: string }) => {
      const res = await apiRequest('PUT', `/api/dsr/${id}`, { status, processingNotes: notes });
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['/api/dsr'] });
      const statusAr: Record<string, string> = { pending: 'قيد الانتظار', in_progress: 'قيد المعالجة', completed: 'مكتمل', rejected: 'مرفوض' };
      toast({ title: `تم تحديث حالة الطلب إلى: ${statusAr[vars.status] || vars.status}` });
    },
    onError: () => {
      toast({ title: 'حدث خطأ في تحديث الحالة', variant: 'destructive' });
    }
  });

  const reviewEvidenceMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: number; status: 'approved' | 'rejected'; notes?: string }) => {
      const res = await apiRequest('PUT', `/api/evidences/${id}/review`, { status, reviewNotes: notes });
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['/api/evidences'] });
      toast({ title: vars.status === 'approved' ? '✓ تم اعتماد الدليل' : 'تم رفض الدليل' });
    },
    onError: () => {
      toast({ title: 'حدث خطأ في مراجعة الدليل', variant: 'destructive' });
    }
  });

  const createComplianceReportMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/compliance/reports', data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/compliance/reports'] });
      toast({ title: `تم إنشاء التقرير: ${data.title}`, description: `رقم التقرير: RPT-${String(data.id).padStart(4, '0')}` });
      setComplianceReportForm({ title: '', framework: 'PDPL', period: '', score: '', status: 'draft', findings: '', recommendations: '' });
      setIsAddComplianceReportOpen(false);
      setSuccessComplianceReport(null);
    },
    onError: () => {
      toast({ title: 'حدث خطأ في إنشاء التقرير', variant: 'destructive' });
    }
  });

  const createRequirementMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/requirements', data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/requirements'] });
      toast({ title: `تم إنشاء المتطلب: ${data.code}` });
      setRequirementForm({ domainId: '', code: '', titleAr: '', titleEn: '', description: '', priority: 'medium', complianceLevel: 'mandatory', evidenceType: 'document' });
      setIsAddRequirementOpen(false);
    },
    onError: (err: any) => {
      toast({ title: err?.message || 'حدث خطأ في إنشاء المتطلب', variant: 'destructive' });
    }
  });

  const updateDecisionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      await apiRequest('PUT', `/api/committee/decisions/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/committee/decisions'] });
      toast({ title: 'تم تحديث القرار بنجاح' });
      setEditingDecision(null);
    },
    onError: () => {
      toast({ title: 'حدث خطأ في تحديث القرار', variant: 'destructive' });
    }
  });

  const deleteDecisionMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/committee/decisions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/committee/decisions'] });
      toast({ title: 'تم حذف القرار بنجاح' });
    },
    onError: () => {
      toast({ title: 'حدث خطأ في حذف القرار', variant: 'destructive' });
    }
  });

  const createRiskMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/data-risks', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/data-risks'] });
      toast({ title: 'تم إضافة المخاطرة بنجاح' });
      setIsAddRiskOpen(false);
      setRiskForm({ title: '', riskLevel: 'medium', description: '', mitigation: '' });
    },
    onError: () => {
      toast({ title: 'حدث خطأ في إضافة المخاطرة', variant: 'destructive' });
    }
  });

  const createStewardMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/data-stewards', data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/data-stewards'] });
      setSuccessSteward({ id: data.id, name: stewardForm.name });
      setStewardForm({ name: '', email: '', phone: '', department: '', role: 'steward' });
      setStewardAttachment(null);
    },
    onError: (err: any) => {
      const msg = err?.message || 'حدث خطأ في إضافة ممثل البيانات';
      toast({ title: msg, variant: 'destructive' });
    }
  });

  const updateStewardMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      await apiRequest('PUT', `/api/data-stewards/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/data-stewards'] });
      toast({ title: 'تم تحديث ممثل البيانات بنجاح' });
      setIsAddStewardOpen(false);
    },
    onError: () => {
      toast({ title: 'حدث خطأ في تحديث ممثل البيانات', variant: 'destructive' });
    }
  });

  const deleteStewardMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/data-stewards/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/data-stewards'] });
      toast({ title: 'تم حذف ممثل البيانات بنجاح' });
    },
    onError: () => {
      toast({ title: 'حدث خطأ في حذف ممثل البيانات', variant: 'destructive' });
    }
  });

  const createDictionaryMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/data-dictionary', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/data-dictionary'] });
      toast({ title: 'تم إضافة المصطلح بنجاح' });
      setIsAddDictionaryOpen(false);
      setDictionaryForm({ term: '', termEn: '', definition: '', category: '', dataType: '', dataAssetId: '', columnName: '', businessRule: '' });
    },
    onError: () => {
      toast({ title: 'حدث خطأ في إضافة المصطلح', variant: 'destructive' });
    }
  });

  const updateDictionaryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      await apiRequest('PUT', `/api/data-dictionary/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/data-dictionary'] });
      toast({ title: 'تم تحديث المصطلح بنجاح' });
      setEditingDictionaryTerm(null);
    },
    onError: () => {
      toast({ title: 'حدث خطأ في تحديث المصطلح', variant: 'destructive' });
    }
  });

  const deleteDictionaryMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/data-dictionary/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/data-dictionary'] });
      toast({ title: 'تم حذف المصطلح بنجاح' });
    },
    onError: () => {
      toast({ title: 'حدث خطأ في حذف المصطلح', variant: 'destructive' });
    }
  });

  const createQualityRuleMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/data-quality', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/data-quality'] });
      toast({ title: 'تم إضافة قاعدة الجودة بنجاح' });
      setIsAddQualityOpen(false);
      setEditingQualityRule(null);
      setTableColumns([]);
      setQualityForm({ name: '', dimension: 'الدقة', ruleType: 'validation', threshold: 90, currentScore: 0, description: '', status: 'active', targetTable: '', targetColumn: '', systemName: '', severity: 'medium', validationPattern: '', sqlExpression: '', connectionId: 0 });
    },
    onError: () => {
      toast({ title: 'حدث خطأ في إضافة قاعدة الجودة', variant: 'destructive' });
    }
  });

  const updateQualityRuleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      await apiRequest('PUT', `/api/data-quality/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/data-quality'] });
      toast({ title: 'تم تحديث القاعدة بنجاح' });
      setIsAddQualityOpen(false);
      setEditingQualityRule(null);
      setTableColumns([]);
      setQualityForm({ name: '', dimension: 'الدقة', ruleType: 'validation', threshold: 90, currentScore: 0, description: '', status: 'active', targetTable: '', targetColumn: '', systemName: '', severity: 'medium', validationPattern: '', sqlExpression: '', connectionId: 0 });
    },
    onError: () => {
      toast({ title: 'حدث خطأ في تحديث القاعدة', variant: 'destructive' });
    }
  });

  const deleteQualityRuleMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/data-quality/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/data-quality'] });
      toast({ title: 'تم حذف القاعدة بنجاح' });
    },
    onError: () => {
      toast({ title: 'حدث خطأ في حذف القاعدة', variant: 'destructive' });
    }
  });

  // ============== DATA QUALITY TOOL ==============
  const [qualityTab, setQualityTab] = useState('dashboard');
  const [selectedCheckRule, setSelectedCheckRule] = useState<any>(null);
  const [showCheckResult, setShowCheckResult] = useState(false);
  const [lastCheckResult, setLastCheckResult] = useState<any>(null);
  const [runningCheckId, setRunningCheckId] = useState<number | null>(null);
  const [runningAll, setRunningAll] = useState(false);
  const [selectedTableForStats, setSelectedTableForStats] = useState('');
  const [tableStats, setTableStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [isAddSystemOpen, setIsAddSystemOpen] = useState(false);
  const [checkingHealthId, setCheckingHealthId] = useState<number | null>(null);
  const [systemForm, setSystemForm] = useState({
    name: '', nameAr: '', systemType: 'database', category: 'internal',
    ipAddress: '', port: 5432, protocol: 'https', description: '',
    vendor: '', version: '', environment: 'production', criticality: 'medium',
    dataClassification: 'internal', apiEndpoint: '', healthCheckUrl: ''
  });

  const [selectedProfileTable, setSelectedProfileTable] = useState('');
  const [profileData, setProfileData] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [applyingSuggestion, setApplyingSuggestion] = useState(false);
  const [tableColumns, setTableColumns] = useState<{ column_name: string; data_type: string }[]>([]);
  const [loadingColumns, setLoadingColumns] = useState(false);
  const [bulkDiscovering, setBulkDiscovering] = useState(false);

  const { data: qualityChecks = [] } = useQuery<any[]>({ queryKey: ['/api/data-quality/checks'] });
  const { data: dbConnectivity } = useQuery<any>({ queryKey: ['/api/data-quality/connectivity'] });
  const { data: systemTables = [] } = useQuery<any[]>({ queryKey: ['/api/data-quality/tables'] });
  const { data: externalSystemsList = [] } = useQuery<any[]>({ queryKey: ['/api/external-systems'] });
  const { data: databaseConnectionsList = [] } = useQuery<any[]>({ queryKey: ['/api/database-connections'], staleTime: 5 * 60 * 1000 });
  const { data: dbHealth } = useQuery<any>({ queryKey: ['/api/data-quality/health'] });
  const { data: ruleSuggestions = [] } = useQuery<any[]>({ queryKey: ['/api/data-quality/suggest-rules'] });

  const createSystemMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/external-systems', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/external-systems'] });
      setIsAddSystemOpen(false);
      setSystemForm({ name: '', nameAr: '', systemType: 'database', category: 'internal', ipAddress: '', port: 5432, protocol: 'https', description: '', vendor: '', version: '', environment: 'production', criticality: 'medium', dataClassification: 'internal', apiEndpoint: '', healthCheckUrl: '' });
      toast({ title: 'تم إضافة النظام بنجاح' });
    },
    onError: () => { toast({ title: 'خطأ في إضافة النظام', variant: 'destructive' }); }
  });

  const deleteSystemMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest('DELETE', `/api/external-systems/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/external-systems'] }); toast({ title: 'تم حذف النظام' }); },
    onError: () => { toast({ title: 'خطأ في حذف النظام', variant: 'destructive' }); }
  });

  const createBreachMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/data-breaches', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/data-breaches'] });
      toast({ title: 'تم تسجيل بلاغ الاختراق بنجاح' });
      setIsBreachReportOpen(false);
      setBreachForm({ title: '', type: '', description: '', severity: 'medium', affectedRecords: '', affectedDataTypes: '' });
    },
    onError: () => {
      toast({ title: 'حدث خطأ في تسجيل البلاغ', variant: 'destructive' });
    }
  });

  const startAssessmentMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/ndmo-assessments', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ndmo-assessments'] });
      toast({ title: 'تم بدء التقييم الذاتي بنجاح', description: 'يمكنك متابعة التقييم من لوحة المعلومات' });
      setIsStartAssessmentOpen(false);
    },
    onError: () => {
      toast({ title: 'حدث خطأ في بدء التقييم', variant: 'destructive' });
    }
  });

  const createIncidentMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/security-incidents', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/security-incidents'] });
      toast({ title: 'تم تسجيل البلاغ الأمني بنجاح' });
      setIsAddIncidentOpen(false);
      setIncidentForm({ title: '', severity: 'medium', description: '' });
    },
    onError: () => {
      toast({ title: 'حدث خطأ في تسجيل البلاغ', variant: 'destructive' });
    }
  });

  const createCourseMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/training-courses', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/training-courses'] });
      toast({ title: 'تم إضافة الدورة التدريبية بنجاح' });
      setIsAddCourseOpen(false);
      setCourseForm({ title: '', duration: '', level: 'مبتدئ', category: '' });
    },
    onError: () => {
      toast({ title: 'حدث خطأ في إضافة الدورة', variant: 'destructive' });
    }
  });

  const createAgreementMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/data-agreements', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/data-agreements'] });
      toast({ title: 'تم إضافة الاتفاقية بنجاح' });
      setIsAddAgreementOpen(false);
      setAgreementForm({ title: '', partyName: '', agreementType: '', startDate: '', endDate: '' });
    },
    onError: () => {
      toast({ title: 'حدث خطأ في إضافة الاتفاقية', variant: 'destructive' });
    }
  });

  const checkSystemHealth = async (systemId: number) => {
    setCheckingHealthId(systemId);
    try {
      const res = await apiRequest('POST', `/api/external-systems/${systemId}/health-check`);
      const result = await res.json();
      queryClient.invalidateQueries({ queryKey: ['/api/external-systems'] });
      toast({ title: result.status === 'healthy' ? 'النظام يعمل بشكل طبيعي' : 'النظام غير متاح', variant: result.status === 'healthy' ? 'default' : 'destructive' });
    } catch { toast({ title: 'خطأ في فحص النظام', variant: 'destructive' }); }
    setCheckingHealthId(null);
  };

  const SIX_DIMS = [
    { id: 'الدقة', name: 'الدقة', nameEn: 'Accuracy', icon: Target, desc: 'مدى مطابقة البيانات للواقع الفعلي' },
    { id: 'الاكتمال', name: 'الاكتمال', nameEn: 'Completeness', icon: CheckCircle2, desc: 'مدى اكتمال البيانات المطلوبة بدون قيم فارغة' },
    { id: 'الاتساق', name: 'الاتساق', nameEn: 'Consistency', icon: RefreshCw, desc: 'مدى توافق البيانات عبر الأنظمة المختلفة' },
    { id: 'الحداثة', name: 'الحداثة', nameEn: 'Timeliness', icon: Clock, desc: 'مدى تحديث البيانات في الوقت المناسب' },
    { id: 'التفرد', name: 'التفرد', nameEn: 'Uniqueness', icon: Hash, desc: 'عدم وجود سجلات مكررة في البيانات' },
    { id: 'الصلاحية', name: 'الصلاحية', nameEn: 'Validity', icon: ShieldAlert, desc: 'مطابقة البيانات للقواعد والأنماط المحددة' },
  ];

  const dimScores = useMemo(() => {
    return SIX_DIMS.map(dim => {
      const rules = qualityRules.filter((r: any) => r.dimension === dim.id);
      const withScore = rules.filter((r: any) => r.currentScore != null && Number(r.currentScore) > 0);
      const avg = withScore.length > 0 ? Math.round(withScore.reduce((s: number, r: any) => s + Number(r.currentScore), 0) / withScore.length) : 0;
      return { ...dim, score: avg, rulesCount: rules.length, checkedCount: withScore.length };
    });
  }, [qualityRules]);

  const overallScore = useMemo(() => {
    const scored = dimScores.filter(d => d.score > 0);
    return scored.length > 0 ? Math.round(scored.reduce((s, d) => s + d.score, 0) / scored.length) : 0;
  }, [dimScores]);

  const systemsBreakdown = useMemo(() => {
    const systems: Record<string, { name: string; rules: any[]; avgScore: number; errors: number; isExternal: boolean }> = {};
    externalSystemsList.forEach((es: any) => {
      const sysName = es.nameAr || es.name;
      if (!systems[sysName]) systems[sysName] = { name: sysName, rules: [], avgScore: 0, errors: 0, isExternal: true };
    });
    qualityRules.forEach((r: any) => {
      const sysName = r.systemName || r.targetTable || 'غير محدد';
      if (!systems[sysName]) systems[sysName] = { name: sysName, rules: [], avgScore: 0, errors: 0, isExternal: false };
      systems[sysName].rules.push(r);
    });
    Object.values(systems).forEach(sys => {
      const scored = sys.rules.filter((r: any) => Number(r.currentScore) > 0);
      sys.avgScore = scored.length > 0 ? Math.round(scored.reduce((s: number, r: any) => s + Number(r.currentScore), 0) / scored.length) : 0;
      sys.errors = sys.rules.reduce((s: number, r: any) => s + (r.failedRecords || 0), 0);
    });
    return Object.values(systems);
  }, [qualityRules, externalSystemsList]);

  const recentErrors = useMemo(() => {
    return qualityChecks
      .filter((c: any) => !c.passed || c.failedRecords > 0 || c.errorMessage)
      .slice(0, 20);
  }, [qualityChecks]);

  const runSingleCheck = async (ruleId: number) => {
    setRunningCheckId(ruleId);
    try {
      const res = await apiRequest('POST', `/api/data-quality/run-check/${ruleId}`);
      const result = await res.json();
      setLastCheckResult(result);
      setShowCheckResult(true);
      queryClient.invalidateQueries({ queryKey: ['/api/data-quality'] });
      queryClient.invalidateQueries({ queryKey: ['/api/data-quality/checks'] });
      toast({ title: result.passed ? 'الفحص ناجح' : 'الفحص كشف مشاكل', description: `النتيجة: ${Number(result.score).toFixed(1)}% | السجلات الفاشلة: ${result.failedRecords}` });
    } catch (err: any) {
      toast({ title: 'خطأ في تشغيل الفحص', variant: 'destructive' });
    }
    setRunningCheckId(null);
  };

  const runAllChecks = async () => {
    setRunningAll(true);
    try {
      const res = await apiRequest('POST', '/api/data-quality/run-all');
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ['/api/data-quality'] });
      queryClient.invalidateQueries({ queryKey: ['/api/data-quality/checks'] });
      toast({ title: `تم تشغيل ${data.totalChecks} فحص بنجاح` });
    } catch {
      toast({ title: 'خطأ في تشغيل الفحوصات', variant: 'destructive' });
    }
    setRunningAll(false);
  };

  const loadProfile = async (tableName: string) => {
    setSelectedProfileTable(tableName);
    setLoadingProfile(true);
    try {
      const res = await apiRequest('GET', `/api/data-quality/profile/${tableName}`);
      setProfileData(await res.json());
    } catch { toast({ title: 'خطأ في جلب ملف الجدول', variant: 'destructive' }); }
    setLoadingProfile(false);
  };

  const applySuggestion = async (suggestion: any) => {
    setApplyingSuggestion(true);
    try {
      const dimAr = suggestion.dimensionAr || suggestion.dimension;
      const ruleName = suggestion.ruleName || `فحص ${dimAr} - ${suggestion.tableName}.${suggestion.columnName}`;
      await apiRequest('POST', '/api/data-quality', {
        name: ruleName,
        dimension: dimAr,
        targetTable: suggestion.tableName,
        targetColumn: suggestion.columnName,
        threshold: suggestion.suggestedThreshold || (dimAr === 'الاكتمال' ? 95 : dimAr === 'التفرد' ? 99 : 90),
        status: 'active',
        description: suggestion.reason,
        ruleType: 'validation'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/data-quality'] });
      queryClient.invalidateQueries({ queryKey: ['/api/data-quality/suggest-rules'] });
      toast({ title: 'تم إضافة القاعدة المقترحة بنجاح' });
    } catch { toast({ title: 'خطأ في إضافة القاعدة', variant: 'destructive' }); }
    setApplyingSuggestion(false);
  };

  const deleteRuleMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest('DELETE', `/api/data-quality/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/data-quality'] }); toast({ title: 'تم حذف القاعدة' }); },
  });

  const createFlowMappingMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/data-flow-mappings', data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/data-flow-mappings'] });
      setSuccessFlowMapping({ id: data.id, source: flowMappingForm.sourceSystem, target: flowMappingForm.targetSystem });
      setFlowMappingForm({ sourceSystem: '', targetSystem: '', dataCategory: '', transferMethod: '', frequency: 'daily', sensitivity: 'internal', purpose: '', legalBasis: '' });
    },
    onError: () => { toast({ title: 'حدث خطأ في إضافة الخريطة', variant: 'destructive' }); }
  });

  const deleteFlowMappingMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest('DELETE', `/api/data-flow-mappings/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/data-flow-mappings'] });
      toast({ title: 'تم حذف خريطة تدفق البيانات' });
    },
    onError: () => { toast({ title: 'حدث خطأ في الحذف', variant: 'destructive' }); }
  });

  const fetchTableColumns = async (tableName: string) => {
    if (!tableName) { setTableColumns([]); return; }
    setLoadingColumns(true);
    try {
      const res = await apiRequest('GET', `/api/data-quality/tables/${tableName}/columns`);
      const cols = await res.json();
      setTableColumns(cols);
    } catch { setTableColumns([]); }
    setLoadingColumns(false);
  };

  const bulkDiscover = async () => {
    setBulkDiscovering(true);
    try {
      const res = await apiRequest('POST', '/api/data-quality/bulk-discover', {
        dimensions: ['الاكتمال', 'التفرد']
      });
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ['/api/data-quality'] });
      queryClient.invalidateQueries({ queryKey: ['/api/data-quality/checks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/data-quality/suggest-rules'] });
      toast({
        title: `تم اكتشاف ${data.created} قاعدة جديدة`,
        description: `من أصل ${data.total} جدول | تم تخطي ${data.skipped} (موجودة أو فارغة)`
      });
    } catch {
      toast({ title: 'خطأ في الاكتشاف التلقائي', variant: 'destructive' });
    }
    setBulkDiscovering(false);
  };

  const loadTableStats = async (tableName: string) => {
    setSelectedTableForStats(tableName);
    setLoadingStats(true);
    try {
      const res = await apiRequest('GET', `/api/data-quality/tables/${tableName}/stats`);
      setTableStats(await res.json());
    } catch { toast({ title: 'خطأ في جلب إحصائيات الجدول', variant: 'destructive' }); }
    setLoadingStats(false);
  };

  const isLoading = domainsLoading || requirementsLoading || evidencesLoading;

  // Calculate stats
  const stats = useMemo(() => {
    const completedReqs = requirements.filter((r: any) => r.status === 'compliant').length;
    const complianceRate = requirements.length > 0 ? Math.round((completedReqs / requirements.length) * 100) : 0;
    
    return {
      totalDomains: domains.length,
      totalRequirements: requirements.length,
      complianceRate,
      completedReqs,
      pendingReqs: requirements.filter((r: any) => r.status === 'pending').length,
      totalEvidences: evidences.length,
      approvedEvidences: evidences.filter((e: any) => e.status === 'approved').length,
      pendingEvidences: evidences.filter((e: any) => e.status === 'pending').length,
      totalTasks: tasks.length,
      pendingTasks: tasks.filter((t: any) => t.status === 'pending').length,
      totalDecisions: decisions.length,
      pendingDecisions: decisions.filter((d: any) => d.status === 'pending').length,
      upcomingMeetings: meetings.filter((m: any) => new Date(m.scheduledDate) > new Date()).length,
      totalMembers: members.length,
    };
  }, [domains, requirements, evidences, tasks, decisions, meetings, members]);

  // Get current page based on URL
  const getCurrentPage = () => {
    const path = location.replace('/dmo', '').replace('/', '') || 'dashboard';
    return path;
  };

  const currentPage = getCurrentPage();

  if (isLoading) {
    return (
      <DashboardLayout 
        title="مكتب إدارة البيانات" 
        subtitle="مكتب إدارة البيانات"
        navGroups={dmoNavGroups}
        portalName="DMO"
      >
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-12 h-12 animate-spin hub-stat-gold" />
        </div>
      </DashboardLayout>
    );
  }

  // Render page content based on current route
  const renderPageContent = () => {
    switch (currentPage) {
      case 'dashboard':
      case '':
        return renderDashboard();
      case 'compliance-monitoring':
        return renderComplianceMonitoring();
      case 'office-manager-dashboard':
        return renderOfficeManagerDashboard();
      case 'evidence':
        return renderEvidenceRepository();
      case 'decision-approvals':
        return renderDecisionApprovals();
      case 'data-assets':
        return renderDataAssets();
      case 'data-dictionary':
        return renderDataDictionary();
      case 'data-quality':
        return renderDataQuality();
      case 'data-classifications':
        return renderDataClassifications();
      case 'data-flow-mapping':
        return renderDataFlowMapping();
      case 'compliance':
        return renderComplianceMonitoring();
      case 'governance-requests':
        return <DMORequestsManagement />;
      case 'reports':
        return renderReportsCenter();
      case 'stewards':
        return renderStewards();
      case 'steward-requests':
        return <DMORequestsManagement />;
      case 'assets':
        return renderAssetsRegistry();
      case 'dsr':
        return renderDSR();
      case 'incidents':
        return renderIncidents();
      case 'reports-management':
        return renderReportsManagement();
      case 'risks':
        return renderRisks();
      case 'agreements':
        return renderAgreements();
      case 'assessment':
        return renderAssessment();
      case 'performance':
        return renderPerformance();
      case 'reports-center':
        return renderReportsCenter();
      case 'notifications':
        return renderNotifications();
      case 'teams':
        return renderTeams();
      case 'learning':
        return renderLearning();
      case 'users':
        return renderUsers();
      case 'settings':
        return renderSettings();
      case 'archive':
        return renderArchive();
      default:
        return renderDashboard();
    }
  };

  const handleExportPDF = () => {
    const data = dataAssetsList.map((a: any) => ({
      name: a.name || '',
      classification: a.classification || '',
      system: a.system || '',
      owner: a.owner || '',
      status: formatStatus(a.status || ''),
    }));
    const columns = [
      { header: 'اسم الأصل', key: 'name' },
      { header: 'التصنيف', key: 'classification' },
      { header: 'النظام', key: 'system' },
      { header: 'المالك', key: 'owner' },
      { header: 'الحالة', key: 'status' },
    ];
    exportToPDF({ data, columns, title: 'تقرير مكتب إدارة البيانات', filename: 'dmo-report', orientation: 'landscape' });
  };

  const handleExportExcel = () => {
    const data = dataAssetsList.map((a: any) => ({
      name: a.name || '',
      classification: a.classification || '',
      system: a.system || '',
      owner: a.owner || '',
      status: formatStatus(a.status || ''),
    }));
    const columns = [
      { header: 'اسم الأصل', key: 'name' },
      { header: 'التصنيف', key: 'classification' },
      { header: 'النظام', key: 'system' },
      { header: 'المالك', key: 'owner' },
      { header: 'الحالة', key: 'status' },
    ];
    exportToExcel({ data, columns, title: 'تقرير مكتب إدارة البيانات', filename: 'dmo-report' });
  };

  // ============== DASHBOARD ==============
  const renderDashboard = () => (
    <div className="space-y-6">
      <SmartDailyOps
        portal="dmo"
        portalLabel="مكتب إدارة البيانات"
        onNavigate={setLocation}
        ticketsPath="/dmo/tickets"
        tasksPath="/dmo/tasks"
        referralsPath="/dmo/referrals"
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SmartBookmarks portal="dmo" onNavigate={setLocation} />
        <QuickNotes portal="dmo" />
      </div>
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
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="card-premium">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">نسبة الامتثال</p>
                <AnimatedNumber value={stats.complianceRate} suffix="%" className="text-3xl font-bold hub-stat-gold" />
              </div>
              <div className="hub-icon-gold">
                <Target className="w-6 h-6 hub-stat-gold" />
              </div>
            </div>
            <Progress value={stats.complianceRate} className="mt-3 h-2" />
          </CardContent>
        </Card>

        <Card className="card-premium">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">النطاقات</p>
                <AnimatedNumber value={stats.totalDomains} className="text-3xl font-bold" />
              </div>
              <div className="hub-icon-navy">
                <Layers className="w-6 h-6 text-muted-foreground" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">15 نطاق حوكمة</p>
          </CardContent>
        </Card>

        <Card className="card-premium">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">المتطلبات</p>
                <AnimatedNumber value={stats.totalRequirements} className="text-3xl font-bold" />
              </div>
              <div className="hub-icon-navy">
                <ListChecks className="w-6 h-6 text-muted-foreground" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">{stats.completedReqs} مكتمل</p>
          </CardContent>
        </Card>

        <Card className="card-premium">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">الأدلة</p>
                <p className="text-3xl font-bold">{stats.totalEvidences}</p>
              </div>
              <div className="hub-icon-gold">
                <FolderOpen className="w-6 h-6 hub-stat-gold" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">{stats.pendingEvidences} بانتظار المراجعة</p>
          </CardContent>
        </Card>
      </div>

      {/* Tasks from IT Director */}
      {stats.pendingTasks > 0 && (
        <Card className="border-accent border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 hub-stat-gold">
              <Send className="w-5 h-5" />
              مهام واردة من مدير التقنية
              <Badge className="hub-badge-gold-solid text-foreground">{stats.pendingTasks}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tasks.filter((t: any) => t.status === 'pending').slice(0, 3).map((task: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium">{task.title}</p>
                    <p className="text-sm text-muted-foreground">{task.description?.substring(0, 50)}...</p>
                  </div>
                  <Badge variant="outline">{task.priority}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Domains Progress */}
      <Card className="card-premium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5 hub-stat-gold" />
            تقدم النطاقات الـ 15
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {domains.slice(0, 6).map((domain: any, idx: number) => {
              const domainReqs = requirements.filter((r: any) => r.domainId === domain.id);
              const domainCompliance = domainReqs.length > 0 ? Math.round(domainReqs.filter((r: any) => r.status === 'compliant').length / domainReqs.length * 100) : 0;
              return (
              <div key={idx} className="p-4 rounded-lg border border-border hover:border-accent/50 transition-all">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-xs">{domain.code}</Badge>
                  <span className="font-medium text-sm">{domain.nameAr}</span>
                </div>
                <Progress value={domainCompliance} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">{domainReqs.length} متطلب</p>
              </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gavel className="w-5 h-5 hub-stat-gold" />
              القرارات الأخيرة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {decisions.slice(0, 3).map((decision: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium">{decision.title}</p>
                    <p className="text-xs text-muted-foreground">{decision.decisionNumber}</p>
                  </div>
                  <Badge className={decision.status === 'approved' ? 'hub-badge-gold-solid' : 'hub-badge-gold-solid'}>
                    {decision.status === 'approved' ? 'معتمد' : 'قيد المراجعة'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 hub-stat-gold" />
              الاجتماعات القادمة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {meetings.slice(0, 3).map((meeting: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium">{meeting.title}</p>
                    <p className="text-xs text-muted-foreground">{new Date(meeting.scheduledDate).toLocaleDateString('ar-SA')}</p>
                  </div>
                  <Badge variant="outline">{meeting.meetingType}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  // ============== COMPLIANCE MONITORING ==============
  const renderComplianceMonitoring = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold">مراقبة الامتثال</h2>
        <div className="flex gap-2">
          <Button className="btn-gold" data-testid="button-create-compliance-report" onClick={() => setIsAddComplianceReportOpen(true)}>
            <Plus className="w-4 h-4 ml-2" />
            إنشاء تقرير امتثال
          </Button>
          <Button variant="outline" data-testid="button-export-compliance-report" onClick={() => { window.open('/api/export/compliance-report', '_blank'); toast({ title: 'جاري تصدير تقرير الامتثال...' }); }}>
            <Download className="w-4 h-4 ml-2" />
            تصدير PDF
          </Button>
        </div>
      </div>

      <Dialog open={isAddComplianceReportOpen} onOpenChange={(open) => { setIsAddComplianceReportOpen(open); if (!open) setSuccessComplianceReport(null); }}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>{successComplianceReport ? 'تم إنشاء التقرير' : 'إنشاء تقرير امتثال جديد'}</DialogTitle>
          </DialogHeader>
          {successComplianceReport ? (
            <FormSuccessPanel
              title="تم إنشاء تقرير الامتثال بنجاح!"
              subtitle={successComplianceReport.title}
              referenceNumber={`RPT-${String(successComplianceReport.id).padStart(4, '0')}`}
              referenceLabel="رقم التقرير"
              nextSteps={[
                { title: "مراجعة التقرير وتدقيقه", description: "سيتولى مكتب إدارة البيانات مراجعة التقرير والتحقق من دقة النتائج" },
                { title: "رفع الأدلة الداعمة", description: "أضف الأدلة والوثائق الداعمة من قسم 'الأدلة' لتقوية التقرير" },
                { title: "اعتماد التقرير", description: "بعد المراجعة سيُرفع التقرير للاعتماد من مدير تقنية المعلومات" },
                { title: "خطة المعالجة", description: "ستُوضع خطة لمعالجة الفجوات المكتشفة في التقرير مع جداول زمنية" },
              ]}
              actions={[
                {
                  label: "إنشاء تقرير آخر",
                  variant: "default",
                  icon: <Plus className="w-4 h-4" />,
                  onClick: () => setSuccessComplianceReport(null),
                },
                {
                  label: "إغلاق",
                  variant: "outline",
                  onClick: () => { setIsAddComplianceReportOpen(false); setSuccessComplianceReport(null); },
                },
              ]}
            />
          ) : (
          <>
          <div className="space-y-4">
            <div>
              <Label>عنوان التقرير *</Label>
              <Input placeholder="مثال: تقرير امتثال PDPL الفصل الأول 2026" value={complianceReportForm.title} onChange={e => setComplianceReportForm(f => ({ ...f, title: e.target.value }))} data-testid="input-compliance-report-title" />
              <FieldHint>اختر عنواناً يتضمن الإطار التنظيمي والفترة الزمنية لسهولة الرجوع إليه لاحقاً.</FieldHint>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>الإطار التنظيمي</Label>
                <Select value={complianceReportForm.framework} onValueChange={v => setComplianceReportForm(f => ({ ...f, framework: v }))}>
                  <SelectTrigger data-testid="select-compliance-framework">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PDPL">PDPL - حماية البيانات الشخصية</SelectItem>
                    <SelectItem value="NDMO">NDMO - إدارة البيانات الوطنية</SelectItem>
                    <SelectItem value="NCA">NCA - الأمن السيبراني</SelectItem>
                    <SelectItem value="ISO27001">ISO 27001 - أمن المعلومات</SelectItem>
                    <SelectItem value="COBIT">COBIT - حوكمة تقنية المعلومات</SelectItem>
                    <SelectItem value="other">أخرى</SelectItem>
                  </SelectContent>
                </Select>
                <FieldHint>اختر الإطار الذي يغطيه هذا التقرير.</FieldHint>
              </div>
              <div>
                <Label>الفترة الزمنية</Label>
                <Input placeholder="مثال: Q1-2026" value={complianceReportForm.period} onChange={e => setComplianceReportForm(f => ({ ...f, period: e.target.value }))} data-testid="input-compliance-period" />
                <FieldHint>الربع أو السنة التي يغطيها التقرير.</FieldHint>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>نسبة الامتثال الحالية (٪)</Label>
                <Input type="number" min="0" max="100" placeholder="مثال: 85" value={complianceReportForm.score} onChange={e => setComplianceReportForm(f => ({ ...f, score: e.target.value }))} data-testid="input-compliance-score" />
                <FieldHint>النسبة المئوية للمتطلبات المستوفاة. يمكن التحديث لاحقاً.</FieldHint>
              </div>
              <div>
                <Label>حالة التقرير</Label>
                <Select value={complianceReportForm.status} onValueChange={v => setComplianceReportForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger data-testid="select-compliance-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">مسودة — قيد الإعداد</SelectItem>
                    <SelectItem value="in_progress">قيد المراجعة</SelectItem>
                    <SelectItem value="completed">مكتمل — معتمد</SelectItem>
                    <SelectItem value="rejected">مرفوض — يحتاج تعديل</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>النتائج والفجوات المكتشفة</Label>
              <Textarea rows={3} placeholder="اذكر النتائج الرئيسية للتقييم، والمتطلبات غير المستوفاة، والمخاطر المرتبطة..." value={complianceReportForm.findings} onChange={e => setComplianceReportForm(f => ({ ...f, findings: e.target.value }))} data-testid="textarea-compliance-findings" />
              <FieldHint>كن محدداً — رقم المتطلب + وصف الفجوة + مستوى المخاطرة.</FieldHint>
            </div>
            <div>
              <Label>التوصيات والإجراءات التصحيحية</Label>
              <Textarea rows={2} placeholder="اقترح الإجراءات اللازمة لسد الفجوات مع أصحاب العمل والجداول الزمنية المقترحة..." value={complianceReportForm.recommendations} onChange={e => setComplianceReportForm(f => ({ ...f, recommendations: e.target.value }))} data-testid="textarea-compliance-recommendations" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddComplianceReportOpen(false)} data-testid="button-cancel-compliance-report">إلغاء</Button>
            <Button className="btn-gold" disabled={!complianceReportForm.title.trim() || createComplianceReportMutation.isPending} onClick={() => { createComplianceReportMutation.mutate({ title: complianceReportForm.title, reportType: complianceReportForm.framework || 'general', framework: complianceReportForm.framework, period: complianceReportForm.period, score: complianceReportForm.score ? parseFloat(complianceReportForm.score) : undefined, status: complianceReportForm.status, findings: complianceReportForm.findings, recommendations: complianceReportForm.recommendations }); }} data-testid="button-confirm-compliance-report">
              {createComplianceReportMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Plus className="w-4 h-4 ml-1" />}
              إنشاء التقرير
            </Button>
          </DialogFooter>
          </>
          )}
        </DialogContent>
      </Dialog>

      <Card className="card-premium">
        <CardHeader>
          <CardTitle>التقارير المُنشأة ({complianceReports.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {complianceReports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-lg mb-2">لا توجد تقارير امتثال</p>
              <p className="text-sm">أنشئ تقرير امتثال جديد من الزر أعلاه لتتبع حالة الامتثال التنظيمي</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الرقم</TableHead>
                  <TableHead className="text-right">العنوان</TableHead>
                  <TableHead className="text-right">الإطار</TableHead>
                  <TableHead className="text-right">الفترة</TableHead>
                  <TableHead className="text-right">النتيجة</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">التاريخ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {complianceReports.map((report: any, idx: number) => (
                  <TableRow key={report.id || idx}>
                    <TableCell className="font-mono text-xs">RPT-{String(report.id || idx + 1).padStart(4, '0')}</TableCell>
                    <TableCell className="font-medium">{report.title}</TableCell>
                    <TableCell><Badge variant="outline">{report.framework || report.reportType || '—'}</Badge></TableCell>
                    <TableCell>{report.period || '—'}</TableCell>
                    <TableCell>{report.score != null ? <span className="font-bold">{report.score}%</span> : '—'}</TableCell>
                    <TableCell>
                      <Badge className={report.status === 'completed' ? 'hub-badge-gold-solid' : report.status === 'in_progress' ? 'hub-badge-neutral' : report.status === 'rejected' ? 'bg-red-900/30 text-red-400' : 'bg-white/5 text-white/60'}>
                        {report.status === 'completed' ? 'مكتمل' : report.status === 'in_progress' ? 'قيد المراجعة' : report.status === 'draft' ? 'مسودة' : report.status === 'rejected' ? 'مرفوض' : report.status || '—'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(report.createdAt || Date.now()).toLocaleDateString('ar-SA')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {['ممتثل', 'ممتثل جزئياً', 'غير ممتثل', 'غير قابل للتطبيق'].map((status, idx) => {
          const statusCounts = [
            requirements.filter((r: any) => r.status === 'compliant').length,
            requirements.filter((r: any) => r.status === 'partially_compliant' || r.status === 'in_progress').length,
            requirements.filter((r: any) => r.status === 'non_compliant' || r.status === 'pending').length,
            requirements.filter((r: any) => r.status === 'not_applicable').length,
          ];
          return (
          <Card key={idx} className="card-premium">
            <CardContent className="p-6 text-center">
              <p className="text-3xl font-bold">{statusCounts[idx]}</p>
              <p className="text-sm text-muted-foreground">{status}</p>
            </CardContent>
          </Card>
          );
        })}
      </div>

      <Card className="card-premium">
        <CardHeader>
          <CardTitle>حالة الامتثال حسب النطاق</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">الكود</TableHead>
                <TableHead className="text-right">النطاق</TableHead>
                <TableHead className="text-right">المتطلبات</TableHead>
                <TableHead className="text-right">نسبة الامتثال</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {domains.map((domain: any, idx: number) => {
                const domainReqs = requirements.filter((r: any) => r.domainId === domain.id);
                const compliance = domainReqs.length > 0 ? Math.round(domainReqs.filter((r: any) => r.status === 'compliant').length / domainReqs.length * 100) : 0;
                return (
                  <TableRow key={idx}>
                    <TableCell className="font-mono">{domain.code}</TableCell>
                    <TableCell>{domain.nameAr}</TableCell>
                    <TableCell>{domainReqs.length}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={compliance} className="w-20 h-2" />
                        <span>{compliance}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={compliance >= 80 ? 'hub-badge-gold-solid' : compliance >= 50 ? 'hub-badge-gold-solid' : 'hub-badge-neutral'}>
                        {compliance >= 80 ? 'ممتثل' : compliance >= 50 ? 'جزئي' : 'غير ممتثل'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="card-premium">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>إدارة المتطلبات ({requirements.length})</CardTitle>
          <Button className="btn-gold" size="sm" onClick={() => setIsAddRequirementOpen(true)} data-testid="button-add-requirement">
            <Plus className="w-4 h-4 ml-2" />
            إضافة متطلب
          </Button>
        </CardHeader>
        <CardContent>
          {requirements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-lg mb-2">لا توجد متطلبات مسجّلة</p>
              <p className="text-sm">أضف متطلبات الامتثال التنظيمي لتتمكن من تتبع حالة الامتثال ورفع الأدلة</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الكود</TableHead>
                  <TableHead className="text-right">المتطلب</TableHead>
                  <TableHead className="text-right">النطاق</TableHead>
                  <TableHead className="text-right">الأولوية</TableHead>
                  <TableHead className="text-right">المستوى</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requirements.map((req: any) => {
                  const domain = domains.find((d: any) => d.id === req.domainId);
                  return (
                    <TableRow key={req.id}>
                      <TableCell className="font-mono text-xs">{req.code}</TableCell>
                      <TableCell className="font-medium">{req.titleAr}</TableCell>
                      <TableCell>{domain?.nameAr || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={req.priority === 'high' ? 'border-red-500 text-red-400' : req.priority === 'medium' ? 'border-yellow-500 text-yellow-400' : ''}>
                          {req.priority === 'high' ? 'عالية' : req.priority === 'medium' ? 'متوسطة' : 'منخفضة'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{req.complianceLevel === 'mandatory' ? 'إلزامي' : req.complianceLevel === 'recommended' ? 'موصى به' : 'اختياري'}</TableCell>
                      <TableCell>
                        <Badge className={req.status === 'compliant' ? 'hub-badge-gold-solid' : req.status === 'partially_compliant' || req.status === 'in_progress' ? 'hub-badge-neutral' : 'bg-white/5 text-white/60'}>
                          {req.status === 'compliant' ? 'ممتثل' : req.status === 'partially_compliant' ? 'جزئي' : req.status === 'in_progress' ? 'قيد التنفيذ' : 'قيد المراجعة'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isAddRequirementOpen} onOpenChange={setIsAddRequirementOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة متطلب امتثال جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">النطاق *</label>
              <Select value={requirementForm.domainId} onValueChange={v => setRequirementForm(f => ({ ...f, domainId: v }))}>
                <SelectTrigger data-testid="select-req-domain"><SelectValue placeholder="اختر النطاق" /></SelectTrigger>
                <SelectContent>
                  {domains.map((d: any) => (
                    <SelectItem key={d.id} value={String(d.id)}>{d.nameAr || d.code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {domains.length === 0 && <p className="text-xs text-yellow-500 mt-1">أضف نطاقات أولاً من قسم الامتثال</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">كود المتطلب *</label>
                <Input placeholder="مثال: PDPL-01" value={requirementForm.code} onChange={e => setRequirementForm(f => ({ ...f, code: e.target.value }))} data-testid="input-req-code" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">الأولوية</label>
                <Select value={requirementForm.priority} onValueChange={v => setRequirementForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger data-testid="select-req-priority"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">عالية</SelectItem>
                    <SelectItem value="medium">متوسطة</SelectItem>
                    <SelectItem value="low">منخفضة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">العنوان بالعربي *</label>
              <Input placeholder="مثال: تعيين مسؤول حوكمة البيانات" value={requirementForm.titleAr} onChange={e => setRequirementForm(f => ({ ...f, titleAr: e.target.value }))} data-testid="input-req-title-ar" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">العنوان بالإنجليزي (اختياري)</label>
              <Input placeholder="e.g. Appoint Data Governance Officer" value={requirementForm.titleEn} onChange={e => setRequirementForm(f => ({ ...f, titleEn: e.target.value }))} data-testid="input-req-title-en" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">الوصف</label>
              <Textarea rows={2} placeholder="وصف تفصيلي للمتطلب..." value={requirementForm.description} onChange={e => setRequirementForm(f => ({ ...f, description: e.target.value }))} data-testid="textarea-req-description" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">مستوى الإلزام</label>
                <Select value={requirementForm.complianceLevel} onValueChange={v => setRequirementForm(f => ({ ...f, complianceLevel: v }))}>
                  <SelectTrigger data-testid="select-req-compliance"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mandatory">إلزامي</SelectItem>
                    <SelectItem value="recommended">موصى به</SelectItem>
                    <SelectItem value="optional">اختياري</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">نوع الدليل</label>
                <Select value={requirementForm.evidenceType} onValueChange={v => setRequirementForm(f => ({ ...f, evidenceType: v }))}>
                  <SelectTrigger data-testid="select-req-evidence-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="document">مستند</SelectItem>
                    <SelectItem value="screenshot">لقطة شاشة</SelectItem>
                    <SelectItem value="report">تقرير</SelectItem>
                    <SelectItem value="policy">سياسة</SelectItem>
                    <SelectItem value="other">أخرى</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsAddRequirementOpen(false)}>إلغاء</Button>
            <Button className="btn-gold" disabled={!requirementForm.domainId || !requirementForm.code.trim() || !requirementForm.titleAr.trim() || createRequirementMutation.isPending} onClick={() => createRequirementMutation.mutate({ domainId: Number(requirementForm.domainId), code: requirementForm.code, titleAr: requirementForm.titleAr, titleEn: requirementForm.titleEn || undefined, description: requirementForm.description || undefined, priority: requirementForm.priority, complianceLevel: requirementForm.complianceLevel, evidenceType: requirementForm.evidenceType })} data-testid="button-confirm-requirement">
              {createRequirementMutation.isPending ? 'جاري الإنشاء...' : 'إضافة المتطلب'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  // ============== EXECUTIVE DASHBOARD ==============
  const renderOfficeManagerDashboard = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">لوحة مدير المكتب</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="card-premium col-span-2">
          <CardHeader>
            <CardTitle>مؤشر الامتثال الشامل</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-12">
              <div className="relative">
                <div className="w-48 h-48 rounded-full border-8 border-accent flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-5xl font-bold hub-stat-gold">{stats.complianceRate}%</p>
                    <p className="text-sm text-muted-foreground">نسبة الامتثال</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-premium">
          <CardHeader>
            <CardTitle>ملخص الحالة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(() => {
              const domainStats = domains.map((d: any) => {
                const dReqs = requirements.filter((r: any) => r.domainId === d.id);
                const comp = dReqs.length > 0 ? Math.round(dReqs.filter((r: any) => r.status === 'compliant').length / dReqs.length * 100) : 0;
                return comp;
              });
              const completedDomains = domainStats.filter((c: number) => c >= 80).length;
              const inProgressDomains = domainStats.filter((c: number) => c >= 30 && c < 80).length;
              const delayedDomains = domainStats.filter((c: number) => c < 30).length;
              return (
                <>
                  <div className="flex justify-between items-center hub-icon-gold">
                    <span>نطاقات مكتملة</span>
                    <span className="font-bold hub-stat-gold">{completedDomains}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-accent/10">
                    <span>قيد العمل</span>
                    <span className="font-bold hub-stat-gold">{inProgressDomains}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-primary/10">
                    <span>متأخرة</span>
                    <span className="font-bold text-muted-foreground">{delayedDomains}</span>
                  </div>
                </>
              );
            })()}
          </CardContent>
        </Card>
      </div>
    </div>
  );

  // ============== EVIDENCE REPOSITORY ==============
  const renderEvidenceRepository = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">مستودع الأدلة</h2>
        <Button className="btn-gold" data-testid="button-upload-evidence" onClick={() => setIsAddEvidenceOpen(true)}>
          <Upload className="w-4 h-4 ml-2" />
          رفع دليل جديد
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="card-premium">
          <CardContent className="p-6 text-center">
            <FolderOpen className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-2xl font-bold">{stats.totalEvidences}</p>
            <p className="text-sm text-muted-foreground">إجمالي الأدلة</p>
          </CardContent>
        </Card>
        <Card className="card-premium">
          <CardContent className="p-6 text-center">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 hub-stat-gold" />
            <p className="text-2xl font-bold">{stats.approvedEvidences}</p>
            <p className="text-sm text-muted-foreground">معتمدة</p>
          </CardContent>
        </Card>
        <Card className="card-premium">
          <CardContent className="p-6 text-center">
            <Clock className="w-8 h-8 mx-auto mb-2 hub-stat-gold" />
            <p className="text-2xl font-bold">{stats.pendingEvidences}</p>
            <p className="text-sm text-muted-foreground">بانتظار المراجعة</p>
          </CardContent>
        </Card>
        <Card className="card-premium">
          <CardContent className="p-6 text-center">
            <XCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-2xl font-bold">0</p>
            <p className="text-sm text-muted-foreground">مرفوضة</p>
          </CardContent>
        </Card>
      </div>

      <Card className="card-premium">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>قائمة الأدلة</CardTitle>
            <div className="flex gap-2">
              <Input placeholder="بحث..." className="w-64" value={evidenceSearch} onChange={e => setEvidenceSearch(e.target.value)} data-testid="input-evidence-search" />
              <Button className="btn-icon-navy" size="icon" data-testid="button-filter-evidence" onClick={() => setShowEvidenceFilter(!showEvidenceFilter)}><Filter className="w-4 h-4" /></Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">اسم الدليل</TableHead>
                <TableHead className="text-right">المتطلب</TableHead>
                <TableHead className="text-right">النطاق</TableHead>
                <TableHead className="text-right">تاريخ الرفع</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {evidences.filter((e: any) => !evidenceSearch || (e.fileName || e.title || '').toLowerCase().includes(evidenceSearch.toLowerCase())).slice(0, 10).map((evidence: any, idx: number) => (
                <TableRow key={evidence.id || idx} data-testid={`row-evidence-${evidence.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="font-medium text-sm">{evidence.title || evidence.fileName || `دليل ${idx + 1}`}</p>
                        {evidence.fileName && <p className="text-xs text-muted-foreground">{evidence.fileName}</p>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {evidence.requirementId ? `REQ-${String(evidence.requirementId).padStart(3, '0')}` : '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {evidence.fileType ? (
                      <Badge variant="outline" className="text-xs">{evidence.fileType.split('/').pop()?.toUpperCase()}</Badge>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(evidence.createdAt || Date.now()).toLocaleDateString('ar-SA')}
                  </TableCell>
                  <TableCell>
                    {evidence.status === 'approved' ? (
                      <Badge className="hub-badge-gold-solid text-xs">✓ معتمد</Badge>
                    ) : evidence.status === 'rejected' ? (
                      <Badge variant="destructive" className="text-xs">مرفوض</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">قيد المراجعة</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button className="btn-icon-gold" size="icon" data-testid={`button-view-evidence-${evidence.id}`} title="عرض التفاصيل" onClick={() => setDetailDialog({ open: true, title: 'تفاصيل الدليل', content: [{ label: 'العنوان', value: evidence.title || `دليل ${idx + 1}` }, { label: 'اسم الملف', value: evidence.fileName || '—' }, { label: 'نوع الملف', value: evidence.fileType || '—' }, { label: 'الحجم', value: evidence.fileSize ? `${Math.round(evidence.fileSize / 1024)} KB` : '—' }, { label: 'المتطلب', value: evidence.requirementId ? `REQ-${String(evidence.requirementId).padStart(3, '0')}` : '—' }, { label: 'الحالة', value: evidence.status === 'approved' ? 'معتمد' : evidence.status === 'rejected' ? 'مرفوض' : 'قيد المراجعة' }, { label: 'تاريخ الرفع', value: new Date(evidence.createdAt || Date.now()).toLocaleDateString('ar-SA') }, { label: 'الوصف', value: evidence.description || '—' }] })}><Eye className="w-4 h-4" /></Button>
                      {evidence.fileKey && (
                        <Button className="btn-icon-gold" size="icon" data-testid={`button-download-evidence-${evidence.id}`} title="تحميل الملف" onClick={() => { window.open(`/api/evidences/${evidence.id}/download`, '_blank'); }}><Download className="w-4 h-4" /></Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card className="card-premium">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>إدارة المتطلبات ({requirements.length})</CardTitle>
            <Button className="btn-gold" size="sm" onClick={() => setIsAddRequirementOpen(true)} data-testid="button-add-requirement-evidence">
              <Plus className="w-4 h-4 ml-2" />
              إضافة متطلب
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {requirements.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <p className="text-sm">لا توجد متطلبات — أضف متطلبات الامتثال لتتمكن من ربط الأدلة بها</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الكود</TableHead>
                  <TableHead className="text-right">المتطلب</TableHead>
                  <TableHead className="text-right">النطاق</TableHead>
                  <TableHead className="text-right">الأولوية</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requirements.map((req: any) => {
                  const domain = domains.find((d: any) => d.id === req.domainId);
                  return (
                    <TableRow key={req.id}>
                      <TableCell className="font-mono text-xs">{req.code}</TableCell>
                      <TableCell className="font-medium text-sm">{req.titleAr}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{domain?.nameAr || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={req.priority === 'high' ? 'border-red-500 text-red-400' : req.priority === 'medium' ? 'border-yellow-500 text-yellow-400' : ''}>
                          {req.priority === 'high' ? 'عالية' : req.priority === 'medium' ? 'متوسطة' : 'منخفضة'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={req.status === 'compliant' ? 'hub-badge-gold-solid' : req.status === 'partially_compliant' || req.status === 'in_progress' ? 'hub-badge-neutral' : 'bg-white/5 text-white/60'}>
                          {req.status === 'compliant' ? 'ممتثل' : req.status === 'partially_compliant' ? 'جزئي' : req.status === 'in_progress' ? 'قيد التنفيذ' : 'قيد المراجعة'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isAddRequirementOpen} onOpenChange={setIsAddRequirementOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة متطلب امتثال جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">النطاق *</label>
              <Select value={requirementForm.domainId} onValueChange={v => setRequirementForm(f => ({ ...f, domainId: v }))}>
                <SelectTrigger data-testid="select-req-domain-ev"><SelectValue placeholder="اختر النطاق" /></SelectTrigger>
                <SelectContent>
                  {domains.map((d: any) => (
                    <SelectItem key={d.id} value={String(d.id)}>{d.nameAr || d.code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">كود المتطلب *</label>
                <Input placeholder="مثال: PDPL-01" value={requirementForm.code} onChange={e => setRequirementForm(f => ({ ...f, code: e.target.value }))} data-testid="input-req-code-ev" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">الأولوية</label>
                <Select value={requirementForm.priority} onValueChange={v => setRequirementForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger data-testid="select-req-priority-ev"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">عالية</SelectItem>
                    <SelectItem value="medium">متوسطة</SelectItem>
                    <SelectItem value="low">منخفضة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">العنوان بالعربي *</label>
              <Input placeholder="مثال: تعيين مسؤول حوكمة البيانات" value={requirementForm.titleAr} onChange={e => setRequirementForm(f => ({ ...f, titleAr: e.target.value }))} data-testid="input-req-title-ar-ev" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">العنوان بالإنجليزي (اختياري)</label>
              <Input placeholder="e.g. Appoint Data Governance Officer" value={requirementForm.titleEn} onChange={e => setRequirementForm(f => ({ ...f, titleEn: e.target.value }))} data-testid="input-req-title-en-ev" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">الوصف</label>
              <Textarea rows={2} placeholder="وصف تفصيلي للمتطلب..." value={requirementForm.description} onChange={e => setRequirementForm(f => ({ ...f, description: e.target.value }))} data-testid="textarea-req-description-ev" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">مستوى الإلزام</label>
                <Select value={requirementForm.complianceLevel} onValueChange={v => setRequirementForm(f => ({ ...f, complianceLevel: v }))}>
                  <SelectTrigger data-testid="select-req-compliance-ev"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mandatory">إلزامي</SelectItem>
                    <SelectItem value="recommended">موصى به</SelectItem>
                    <SelectItem value="optional">اختياري</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">نوع الدليل</label>
                <Select value={requirementForm.evidenceType} onValueChange={v => setRequirementForm(f => ({ ...f, evidenceType: v }))}>
                  <SelectTrigger data-testid="select-req-evidence-type-ev"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="document">مستند</SelectItem>
                    <SelectItem value="screenshot">لقطة شاشة</SelectItem>
                    <SelectItem value="report">تقرير</SelectItem>
                    <SelectItem value="policy">سياسة</SelectItem>
                    <SelectItem value="other">أخرى</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsAddRequirementOpen(false)}>إلغاء</Button>
            <Button className="btn-gold" disabled={!requirementForm.domainId || !requirementForm.code.trim() || !requirementForm.titleAr.trim() || createRequirementMutation.isPending} onClick={() => createRequirementMutation.mutate({ domainId: Number(requirementForm.domainId), code: requirementForm.code, titleAr: requirementForm.titleAr, titleEn: requirementForm.titleEn || undefined, description: requirementForm.description || undefined, priority: requirementForm.priority, complianceLevel: requirementForm.complianceLevel, evidenceType: requirementForm.evidenceType })} data-testid="button-confirm-requirement-ev">
              {createRequirementMutation.isPending ? 'جاري الإنشاء...' : 'إضافة المتطلب'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddEvidenceOpen} onOpenChange={(open) => { setIsAddEvidenceOpen(open); if (!open) setSuccessEvidence(null); }}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>{successEvidence ? 'تم رفع الدليل' : 'رفع دليل امتثال جديد'}</DialogTitle>
          </DialogHeader>
          {successEvidence ? (
            <FormSuccessPanel
              title="تم رفع الدليل بنجاح!"
              subtitle={successEvidence.title}
              referenceNumber={`EVI-${String(successEvidence.id).padStart(4, '0')}`}
              referenceLabel="رقم الدليل"
              nextSteps={[
                { title: "مراجعة الدليل", description: "سيراجع مدير الامتثال الدليل المرفوع ويتحقق من ارتباطه بالمتطلب" },
                { title: "الاعتماد أو طلب التعديل", description: "إما اعتماد الدليل أو إرجاعه مع ملاحظات تطوير" },
                { title: "تحديث حالة الامتثال", description: "عند الاعتماد سيُحدَّث مستوى الامتثال للمتطلب المرتبط تلقائياً" },
              ]}
              actions={[
                {
                  label: "رفع دليل آخر",
                  variant: "default",
                  icon: <Plus className="w-4 h-4" />,
                  onClick: () => setSuccessEvidence(null),
                },
                {
                  label: "إغلاق",
                  variant: "outline",
                  onClick: () => { setIsAddEvidenceOpen(false); setSuccessEvidence(null); },
                },
              ]}
            />
          ) : (
          <>
          <div className="space-y-4">
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 text-sm text-blue-800 dark:text-blue-300">
              📎 يمكنك رفع ملف مع الدليل (PDF، Word، صور) أو الاكتفاء بالعنوان والوصف.
            </div>
            <div>
              <Label>عنوان الدليل *</Label>
              <Input placeholder="مثال: شهادة اعتماد PDPL من الجهة المانحة" value={evidenceForm.title} onChange={e => setEvidenceForm(f => ({ ...f, title: e.target.value }))} data-testid="input-evidence-title" />
              <FieldHint>اختر عنواناً يصف الدليل بوضوح وارتباطه بالمتطلب.</FieldHint>
            </div>
            <div>
              <Label>المتطلب المرتبط *</Label>
              <Select value={evidenceForm.requirementId} onValueChange={v => setEvidenceForm(f => ({ ...f, requirementId: v }))}>
                <SelectTrigger data-testid="select-evidence-requirement">
                  <SelectValue placeholder="اختر المتطلب التنظيمي" />
                </SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto">
                  {requirements.length > 0 ? requirements.map((r: any) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      <span className="font-mono text-xs ml-2">{r.code}</span>
                      {r.titleAr || r.title || `متطلب ${r.id}`}
                    </SelectItem>
                  )) : (
                    <SelectItem value="no-data" disabled>لا توجد متطلبات — أضفها من قسم "إدارة المتطلبات" أدناه</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <FieldHint>كل دليل يجب أن يرتبط بمتطلب تنظيمي محدد. أضف المتطلبات أولاً من قسم "إدارة المتطلبات" في هذه الصفحة.</FieldHint>
            </div>
            <div>
              <Label>الوصف (اختياري)</Label>
              <Textarea placeholder="وصف مختصر للدليل" value={evidenceForm.description} onChange={e => setEvidenceForm(f => ({ ...f, description: e.target.value }))} data-testid="textarea-evidence-description" />
            </div>
            <div>
              <Label>ملف الدليل <span className="text-muted-foreground text-xs">(اختياري — PDF، Word، صورة، حتى 10MB)</span></Label>
              <div className="mt-1.5">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => evidenceFileInputRef.current?.click()}
                  onKeyDown={e => e.key === 'Enter' && evidenceFileInputRef.current?.click()}
                  className={`flex items-center gap-2 px-3 py-2 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${evidenceFile ? 'border-gold/60 bg-gold/5' : 'border-border hover:border-gold/40 hover:bg-muted/30'}`}
                  data-testid="label-evidence-file"
                >
                  <Upload className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate text-muted-foreground">
                    {evidenceFile ? evidenceFile.name : 'اضغط لاختيار ملف أو اسحبه هنا'}
                  </span>
                  {evidenceFile && (
                    <button
                      type="button"
                      className="mr-auto text-xs text-red-500 hover:text-red-700 shrink-0"
                      onClick={e => { e.stopPropagation(); setEvidenceFile(null); }}
                    >✕</button>
                  )}
                </div>
                <input
                  ref={evidenceFileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.zip,.txt"
                  onChange={e => setEvidenceFile(e.target.files?.[0] || null)}
                  data-testid="input-evidence-file"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsAddEvidenceOpen(false); setEvidenceFile(null); }} data-testid="button-cancel-evidence">إلغاء</Button>
            <Button className="btn-gold" disabled={!evidenceForm.title.trim() || !evidenceForm.requirementId || evidenceForm.requirementId === 'no-data' || createEvidenceMutation.isPending} onClick={() => { createEvidenceMutation.mutate({ title: evidenceForm.title, requirementId: parseInt(evidenceForm.requirementId), description: evidenceForm.description }); }} data-testid="button-confirm-evidence">
              {createEvidenceMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin ml-1" />جاري الرفع...</>
              ) : (
                <><Upload className="w-4 h-4 ml-1" />رفع الدليل</>
              )}
            </Button>
          </DialogFooter>
          </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );

  // ============== DECISION APPROVALS ==============
  const renderDecisionApprovals = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">الاعتماد الإلكتروني للقرارات</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="card-premium">
          <CardContent className="p-6 text-center">
            <Clock className="w-8 h-8 mx-auto mb-2 hub-stat-gold" />
            <p className="text-2xl font-bold">{stats.pendingDecisions}</p>
            <p className="text-sm text-muted-foreground">بانتظار الاعتماد</p>
          </CardContent>
        </Card>
        <Card className="card-premium">
          <CardContent className="p-6 text-center">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 hub-stat-gold" />
            <p className="text-2xl font-bold">{decisions.filter((d: any) => d.status === 'approved').length}</p>
            <p className="text-sm text-muted-foreground">معتمدة</p>
          </CardContent>
        </Card>
        <Card className="card-premium">
          <CardContent className="p-6 text-center">
            <Vote className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-2xl font-bold">{decisions.filter((d: any) => d.status === 'voting').length}</p>
            <p className="text-sm text-muted-foreground">قيد التصويت</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  // ============== DATA ASSETS ==============
  const renderDataAssets = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">أصول البيانات</h2>
        <Button className="btn-gold" data-testid="button-add-asset" onClick={() => {
          setEditingAsset(null);
          setAssetForm({ name: '', nameEn: '', description: '', system: '', owner: '', classification: 'restricted', dataType: 'structured', status: 'active', databaseName: '', schemaName: '', tableName: '', connectionType: '' });
          setIsAddAssetOpen(true);
        }}>
          <Plus className="w-4 h-4 ml-2" />
          إضافة أصل
        </Button>
        <Dialog open={isAddAssetOpen} onOpenChange={(open) => { setIsAddAssetOpen(open); if (!open) setEditingAsset(null); }}>
          <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle>{editingAsset ? 'تعديل الأصل البياني' : 'إضافة أصل بياني جديد'}</DialogTitle>
              <DialogDescription>{editingAsset ? 'تعديل تفاصيل الأصل البياني' : 'أدخل تفاصيل الأصل البياني وربطه بالنظام المصدر'}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>اسم الأصل (عربي)</Label>
                  <Input value={assetForm.name} onChange={e => setAssetForm({...assetForm, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>اسم الأصل (إنجليزي)</Label>
                  <Input value={assetForm.nameEn} onChange={e => setAssetForm({...assetForm, nameEn: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>الوصف</Label>
                <Textarea value={assetForm.description} onChange={e => setAssetForm({...assetForm, description: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>النظام</Label>
                  <Input value={assetForm.system} onChange={e => setAssetForm({...assetForm, system: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>المالك</Label>
                  <Input value={assetForm.owner} onChange={e => setAssetForm({...assetForm, owner: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>تصنيف البيانات (NDMO)</Label>
                  <Select value={assetForm.classification} onValueChange={v => setAssetForm({...assetForm, classification: v})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {classificationLevels.map(level => (
                        <SelectItem key={level.id} value={level.id}>
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${level.color}`} />
                            {level.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>نوع البيانات</Label>
                  <Select value={assetForm.dataType} onValueChange={v => setAssetForm({...assetForm, dataType: v})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="structured">مهيكلة</SelectItem>
                      <SelectItem value="unstructured">غير مهيكلة</SelectItem>
                      <SelectItem value="semi_structured">شبه مهيكلة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="border-t pt-4 mt-2">
                <Label className="text-sm font-semibold text-muted-foreground mb-3 block">ربط بالأنظمة</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>اسم قاعدة البيانات</Label>
                    <Input placeholder="مثال: JCSA_Production" value={assetForm.databaseName} onChange={e => setAssetForm({...assetForm, databaseName: e.target.value})} data-testid="input-asset-database" />
                  </div>
                  <div className="space-y-2">
                    <Label>اسم المخطط (Schema)</Label>
                    <Input placeholder="مثال: dbo" value={assetForm.schemaName} onChange={e => setAssetForm({...assetForm, schemaName: e.target.value})} data-testid="input-asset-schema" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div className="space-y-2">
                    <Label>اسم الجدول</Label>
                    <Input placeholder="مثال: Members" value={assetForm.tableName} onChange={e => setAssetForm({...assetForm, tableName: e.target.value})} data-testid="input-asset-table" />
                  </div>
                  <div className="space-y-2">
                    <Label>نوع الاتصال</Label>
                    <Select value={assetForm.connectionType} onValueChange={v => setAssetForm({...assetForm, connectionType: v})}>
                      <SelectTrigger data-testid="select-asset-connection-type">
                        <SelectValue placeholder="اختر نوع الاتصال" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sql_server">SQL Server</SelectItem>
                        <SelectItem value="oracle">Oracle</SelectItem>
                        <SelectItem value="postgresql">PostgreSQL</SelectItem>
                        <SelectItem value="mysql">MySQL</SelectItem>
                        <SelectItem value="api">API</SelectItem>
                        <SelectItem value="file">ملفات</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsAddAssetOpen(false); setEditingAsset(null); }} data-testid="button-cancel-asset">إلغاء</Button>
              <Button 
                className="btn-navy"
                disabled={createAssetMutation.isPending || updateAssetMutation.isPending}
                onClick={() => {
                  if (!assetForm.name.trim()) {
                    toast({ title: 'يرجى إدخال اسم الأصل', variant: 'destructive' });
                    return;
                  }
                  const payload = { ...assetForm };
                  if (editingAsset) {
                    updateAssetMutation.mutate({ id: editingAsset.id, data: payload });
                  } else {
                    createAssetMutation.mutate(payload);
                  }
                }}
                data-testid="button-save-asset"
              >
                {(createAssetMutation.isPending || updateAssetMutation.isPending) ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                {editingAsset ? 'تحديث' : 'حفظ'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Classification Legend */}
      <Card className="card-premium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            تصنيف البيانات الوطني (NDMO)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {classificationLevels.map(level => (
              <div key={level.id} className={`flex items-center gap-2 px-4 py-2 rounded-lg ${level.bgLight}`}>
                <div className={`w-4 h-4 rounded-full ${level.color}`} />
                <span className={level.textColor}>{level.name}</span>
                <span className="text-xs text-muted-foreground">({level.nameEn})</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="card-premium">
        <CardHeader>
          <CardTitle>سجل الأصول البيانية</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">اسم الأصل</TableHead>
                <TableHead className="text-right">النظام</TableHead>
                <TableHead className="text-right">قاعدة البيانات</TableHead>
                <TableHead className="text-right">الجدول</TableHead>
                <TableHead className="text-right">التصنيف</TableHead>
                <TableHead className="text-right">نوع الاتصال</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dataAssetsList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    لا توجد أصول بيانية. قم بإضافة أصل جديد لربطه بالأنظمة.
                  </TableCell>
                </TableRow>
              ) : dataAssetsList.map((asset: any, idx: number) => {
                const classLevel = classificationLevels.find(l => l.id === asset.classification);
                const connTypeLabels: Record<string, string> = { sql_server: 'SQL Server', oracle: 'Oracle', postgresql: 'PostgreSQL', mysql: 'MySQL', api: 'API', file: 'ملفات' };
                return (
                  <TableRow key={asset.id || idx}>
                    <TableCell className="font-medium">{asset.name}</TableCell>
                    <TableCell>{asset.system || '-'}</TableCell>
                    <TableCell className="font-mono text-sm">{asset.databaseName || asset.database_name || '-'}</TableCell>
                    <TableCell className="font-mono text-sm">{asset.tableName || asset.table_name || '-'}</TableCell>
                    <TableCell>
                      <Badge className={`${classLevel?.color} text-white`}>{classLevel?.name || asset.classification}</Badge>
                    </TableCell>
                    <TableCell>
                      {(asset.connectionType || asset.connection_type) ? (
                        <Badge variant="outline">{connTypeLabels[asset.connectionType || asset.connection_type] || asset.connectionType || asset.connection_type}</Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell><Badge className="hub-badge-gold-solid">نشط</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button className="btn-icon-gold" size="icon" data-testid="button-view-asset" onClick={() => setDetailDialog({ open: true, title: 'تفاصيل الأصل البياني', content: [{ label: 'الاسم', value: asset.name }, { label: 'الاسم بالإنجليزية', value: asset.nameEn || asset.name_en || '-' }, { label: 'النظام', value: asset.system || '-' }, { label: 'قاعدة البيانات', value: asset.databaseName || asset.database_name || '-' }, { label: 'الجدول', value: asset.tableName || asset.table_name || '-' }, { label: 'التصنيف', value: classificationLevels.find(c => c.id === asset.classification)?.name || asset.classification || '-' }, { label: 'المالك', value: asset.owner || '-' }, { label: 'نوع الاتصال', value: asset.connectionType || asset.connection_type || '-' }, { label: 'الوصف', value: asset.description || '-' }] })}><Eye className="w-4 h-4" /></Button>
                        <Button className="btn-icon-gold" size="icon" data-testid="button-edit-asset" onClick={() => {
                          setEditingAsset(asset);
                          setAssetForm({
                            name: asset.name || '',
                            nameEn: asset.nameEn || asset.name_en || '',
                            description: asset.description || '',
                            system: asset.system || '',
                            owner: asset.owner || '',
                            classification: asset.classification || 'restricted',
                            dataType: asset.dataType || asset.data_type || 'structured',
                            status: asset.status || 'active',
                            databaseName: asset.databaseName || asset.database_name || '',
                            schemaName: asset.schemaName || asset.schema_name || '',
                            tableName: asset.tableName || asset.table_name || '',
                            connectionType: asset.connectionType || asset.connection_type || '',
                          });
                          setIsAddAssetOpen(true);
                        }}><Edit className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-300 hover:bg-red-500/10" data-testid={`button-delete-asset-${asset.id}`} onClick={() => confirmAction(() => deleteAssetMutation.mutate(asset.id), { title: 'تأكيد الحذف', description: 'هل أنت متأكد من حذف هذا الأصل البياني؟ لا يمكن التراجع عن هذا الإجراء.' })}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );

  // ============== DATA DICTIONARY ==============
  const renderDataDictionary = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">قاموس البيانات</h2>
        <Button className="btn-gold" data-testid="button-add-term" onClick={() => {
          setEditingDictionaryTerm(null);
          setDictionaryForm({ term: '', termEn: '', definition: '', category: '', dataType: '', dataAssetId: '', columnName: '', businessRule: '' });
          setIsAddDictionaryOpen(true);
        }}>
          <Plus className="w-4 h-4 ml-2" />
          إضافة مصطلح
        </Button>
      </div>

      <div className="flex gap-4">
        <Input placeholder="بحث في القاموس..." className="flex-1" value={dictionarySearch} onChange={e => setDictionarySearch(e.target.value)} data-testid="input-dictionary-search" />
        <Select defaultValue="all">
          <SelectTrigger className="w-48">
            <SelectValue placeholder="الفئة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الفئات</SelectItem>
            <SelectItem value="business">مصطلحات الأعمال</SelectItem>
            <SelectItem value="technical">مصطلحات تقنية</SelectItem>
            <SelectItem value="governance">مصطلحات الحوكمة</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="card-premium">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">المصطلح</TableHead>
                <TableHead className="text-right">Term (EN)</TableHead>
                <TableHead className="text-right">التعريف</TableHead>
                <TableHead className="text-right">الفئة</TableHead>
                <TableHead className="text-right">نوع البيانات</TableHead>
                <TableHead className="text-right">الأصل البياني</TableHead>
                <TableHead className="text-right">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dictionaryTerms.filter((t: any) => !dictionarySearch || (t.term || '').includes(dictionarySearch) || (t.termEn || t.term_en || '').toLowerCase().includes(dictionarySearch.toLowerCase()) || (t.definition || '').includes(dictionarySearch)).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {dictionarySearch ? 'لا توجد نتائج مطابقة للبحث' : 'لا توجد مصطلحات في قاموس البيانات. قم بإضافة مصطلح جديد.'}
                  </TableCell>
                </TableRow>
              ) : (
                dictionaryTerms.filter((t: any) => !dictionarySearch || (t.term || '').includes(dictionarySearch) || (t.termEn || t.term_en || '').toLowerCase().includes(dictionarySearch.toLowerCase()) || (t.definition || '').includes(dictionarySearch)).map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.term}</TableCell>
                    <TableCell className="font-mono text-sm">{item.termEn || item.term_en || '-'}</TableCell>
                    <TableCell className="max-w-xs truncate">{item.definition}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        item.category === 'governance' ? 'border-accent hub-stat-gold' :
                        item.category === 'technical' ? 'border-primary/30 text-muted-foreground' :
                        'border-primary/50 text-muted-foreground'
                      }>
                        {item.category === 'governance' ? 'حوكمة' : item.category === 'technical' ? 'تقنية' : 'أعمال'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{item.dataType || item.data_type || '-'}</TableCell>
                    <TableCell>
                      {item.dataAssetId || item.data_asset_id ? (
                        <Badge variant="outline" className="gap-1">
                          <Database className="w-3 h-3" />
                          {dataAssetsList.find((a: any) => a.id === (item.dataAssetId || item.data_asset_id))?.name || `أصل #${item.dataAssetId || item.data_asset_id}`}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">غير مرتبط</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button className="btn-icon-gold" size="icon" data-testid="button-view-term" onClick={() => setDetailDialog({ open: true, title: 'تفاصيل المصطلح', content: [{ label: 'المصطلح', value: item.term }, { label: 'المصطلح بالإنجليزية', value: item.termEn || item.term_en || '-' }, { label: 'التعريف', value: item.definition || '-' }, { label: 'الفئة', value: item.category || '-' }, { label: 'نوع البيانات', value: item.dataType || item.data_type || '-' }, { label: 'اسم العمود', value: item.columnName || item.column_name || '-' }, { label: 'القاعدة التجارية', value: item.businessRule || item.business_rule || '-' }, { label: 'الأصل المرتبط', value: dataAssetsList.find((a: any) => a.id === (item.dataAssetId || item.data_asset_id))?.name || '-' }] })}><Eye className="w-4 h-4" /></Button>
                        <Button className="btn-icon-gold" size="icon" data-testid="button-edit-term" onClick={() => {
                          setEditingDictionaryTerm(item);
                          setDictionaryForm({
                            term: item.term || '',
                            termEn: item.termEn || item.term_en || '',
                            definition: item.definition || '',
                            category: item.category || '',
                            dataType: item.dataType || item.data_type || '',
                            dataAssetId: item.dataAssetId || item.data_asset_id || '',
                            columnName: item.columnName || item.column_name || '',
                            businessRule: item.businessRule || item.business_rule || '',
                          });
                          setIsAddDictionaryOpen(true);
                        }}><Edit className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-300 hover:bg-red-500/10" data-testid={`button-delete-term-${item.id}`} onClick={() => confirmAction(() => deleteDictionaryMutation.mutate(item.id), { title: 'تأكيد الحذف', description: 'هل أنت متأكد من حذف هذا المصطلح؟ لا يمكن التراجع عن هذا الإجراء.' })}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isAddDictionaryOpen} onOpenChange={(open) => { setIsAddDictionaryOpen(open); if (!open) { setEditingDictionaryTerm(null); setDictionaryForm({ term: '', termEn: '', definition: '', category: '', dataType: '', dataAssetId: '', columnName: '', businessRule: '' }); } }}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingDictionaryTerm ? 'تعديل المصطلح' : 'إضافة مصطلح جديد'}</DialogTitle>
            <DialogDescription>{editingDictionaryTerm ? 'تعديل تفاصيل المصطلح في القاموس' : 'أدخل تفاصيل المصطلح وربطه بالأصل البياني في الفهرس'}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>المصطلح (عربي)</Label>
                <Input value={dictionaryForm.term} onChange={e => setDictionaryForm({...dictionaryForm, term: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>المصطلح (إنجليزي)</Label>
                <Input value={dictionaryForm.termEn} onChange={e => setDictionaryForm({...dictionaryForm, termEn: e.target.value})} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>التعريف</Label>
              <Textarea value={dictionaryForm.definition} onChange={e => setDictionaryForm({...dictionaryForm, definition: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الفئة</Label>
                <Select value={dictionaryForm.category} onValueChange={v => setDictionaryForm({...dictionaryForm, category: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الفئة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="business">مصطلحات الأعمال</SelectItem>
                    <SelectItem value="technical">مصطلحات تقنية</SelectItem>
                    <SelectItem value="governance">مصطلحات الحوكمة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>نوع البيانات</Label>
                <Input value={dictionaryForm.dataType} onChange={e => setDictionaryForm({...dictionaryForm, dataType: e.target.value})} data-testid="input-dict-datatype" />
              </div>
            </div>
            <div className="border-t pt-4 mt-2">
              <Label className="text-sm font-semibold text-muted-foreground mb-3 block">ربط بالفهرس (أصل بياني)</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>الأصل البياني المرتبط</Label>
                  <Select value={dictionaryForm.dataAssetId} onValueChange={v => setDictionaryForm({...dictionaryForm, dataAssetId: v})}>
                    <SelectTrigger data-testid="select-dict-asset">
                      <SelectValue placeholder="اختر أصل بياني" />
                    </SelectTrigger>
                    <SelectContent>
                      {dataAssetsList.map((asset: any) => (
                        <SelectItem key={asset.id} value={String(asset.id)}>
                          {asset.name} {asset.system ? `(${asset.system})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>اسم العمود</Label>
                  <Input placeholder="مثال: member_id" value={dictionaryForm.columnName} onChange={e => setDictionaryForm({...dictionaryForm, columnName: e.target.value})} data-testid="input-dict-column" />
                </div>
              </div>
              <div className="space-y-2 mt-3">
                <Label>القاعدة التجارية</Label>
                <Textarea placeholder="مثال: يجب أن يكون رقم العضوية فريداً ولا يتكرر" value={dictionaryForm.businessRule} onChange={e => setDictionaryForm({...dictionaryForm, businessRule: e.target.value})} data-testid="input-dict-business-rule" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsAddDictionaryOpen(false); setEditingDictionaryTerm(null); }}>إلغاء</Button>
            <Button 
              className="btn-navy"
              disabled={createDictionaryMutation.isPending || updateDictionaryMutation.isPending}
              onClick={() => {
                if (!dictionaryForm.term.trim() || !dictionaryForm.definition.trim()) {
                  toast({ title: 'يرجى إدخال المصطلح والتعريف', variant: 'destructive' });
                  return;
                }
                const payload = { ...dictionaryForm, dataAssetId: dictionaryForm.dataAssetId ? parseInt(dictionaryForm.dataAssetId) : undefined };
                if (editingDictionaryTerm) {
                  updateDictionaryMutation.mutate({ id: editingDictionaryTerm.id, data: payload });
                } else {
                  createDictionaryMutation.mutate(payload);
                }
              }}
              data-testid="button-save-term"
            >
              {(createDictionaryMutation.isPending || updateDictionaryMutation.isPending) ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
              {editingDictionaryTerm ? 'تحديث' : 'حفظ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showLinkedSystemsDialog} onOpenChange={setShowLinkedSystemsDialog}>
        <DialogContent className="sm:max-w-[500px]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right flex items-center gap-2">
              <Server className="w-5 h-5 hub-stat-gold" />
              الأنظمة المرتبطة بـ "{selectedTerm?.term}"
            </DialogTitle>
            <DialogDescription className="text-right">
              الأنظمة التي تستخدم هذا المصطلح في قاعدة بياناتها
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {(selectedTerm?.linkedSystems || selectedTerm?.linked_systems || []).map((system: string, idx: number) => (
              <div key={idx} className="flex items-center gap-3 p-3 rounded-lg border border-primary/10 bg-primary/5">
                <div className="hub-icon-gold">
                  <Database className="w-4 h-4 hub-stat-gold" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">{system}</p>
                  <p className="text-xs text-muted-foreground">متصل ونشط</p>
                </div>
                <Badge className="hub-badge-navy">مرتبط</Badge>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkedSystemsDialog(false)} data-testid="button-close-linked-systems">إغلاق</Button>
            <Button className="btn-gold" data-testid="button-link-new-system" onClick={() => {
              setShowLinkedSystemsDialog(false);
              setEditingAsset(null);
              setAssetForm({ name: '', nameEn: '', description: '', system: '', owner: '', classification: 'restricted', dataType: 'structured', status: 'active', databaseName: '', schemaName: '', tableName: '', connectionType: '' });
              setIsAddAssetOpen(true);
            }}>
              <Plus className="w-4 h-4 ml-2" />
              ربط نظام جديد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  // ============== DATA CLASSIFICATIONS ==============
  const renderDataClassifications = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-bold">تصنيفات البيانات</h2>
        <p className="text-muted-foreground">إدارة مستويات تصنيف البيانات وفق معايير NDMO</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {classificationLevels.map((level) => {
          const count = dataAssetsList.filter((a: any) => a.classification === level.id).length;
          return (
            <Card key={level.id} className="card-premium">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <Badge className={level.color + ' text-white'}>{level.name}</Badge>
                  <span className="text-2xl font-bold">{count}</span>
                </div>
                <p className="text-sm text-muted-foreground">{level.nameEn}</p>
                <Progress value={dataAssetsList.length > 0 ? (count / dataAssetsList.length) * 100 : 0} className="mt-3 h-2" />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="card-premium">
        <CardHeader>
          <CardTitle>الأصول حسب التصنيف</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">اسم الأصل</TableHead>
                <TableHead className="text-right">النظام</TableHead>
                <TableHead className="text-right">المالك</TableHead>
                <TableHead className="text-right">التصنيف</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dataAssetsList.length > 0 ? dataAssetsList.map((asset: any, idx: number) => {
                const cl = classificationLevels.find(c => c.id === asset.classification) || classificationLevels[1];
                return (
                  <TableRow key={idx} data-testid={`row-classification-asset-${idx}`}>
                    <TableCell className="font-medium">{asset.name}</TableCell>
                    <TableCell>{asset.system || '-'}</TableCell>
                    <TableCell>{asset.owner || '-'}</TableCell>
                    <TableCell><Badge className={cl.color + ' text-white'}>{cl.name}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={asset.status === 'active' ? 'default' : 'secondary'}>
                        {asset.status === 'active' ? 'نشط' : 'غير نشط'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              }) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    لا توجد أصول بيانات. أضف أصولاً من صفحة فهرس البيانات.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="card-premium">
        <CardHeader>
          <CardTitle>سياسات التصنيف</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {classificationLevels.map((level) => (
              <div key={level.id} className="flex items-start gap-4 p-4 rounded-md border">
                <Badge className={level.color + ' text-white min-w-[80px] justify-center'}>{level.name}</Badge>
                <div>
                  <p className="font-medium">{level.nameEn} - {level.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {level.id === 'public' && 'بيانات متاحة للعامة ولا تتطلب حماية خاصة'}
                    {level.id === 'restricted' && 'بيانات داخلية تتطلب صلاحيات وصول محددة'}
                    {level.id === 'confidential' && 'بيانات حساسة تتطلب حماية عالية وتشفير'}
                    {level.id === 'top_secret' && 'بيانات سرية للغاية تتطلب أعلى مستويات الحماية والمراقبة'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderDataQuality = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-quality-title">أداة فحص جودة البيانات</h2>
          <p className="text-sm text-muted-foreground">المعايير الوطنية الستة لجودة البيانات - NDMO</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={bulkDiscover} disabled={bulkDiscovering} data-testid="button-bulk-discover">
            {bulkDiscovering ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Database className="w-4 h-4 ml-2" />}
            اكتشاف تلقائي لكل الجداول
          </Button>
          <Button variant="outline" onClick={runAllChecks} disabled={runningAll || qualityRules.length === 0} data-testid="button-run-all-checks">
            {runningAll ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Zap className="w-4 h-4 ml-2" />}
            تشغيل كل الفحوصات
          </Button>
          <Dialog open={isAddQualityOpen} onOpenChange={(open) => { setIsAddQualityOpen(open); if (!open) { setEditingQualityRule(null); setTableColumns([]); setQualityForm({ name: '', dimension: 'الدقة', ruleType: 'validation', threshold: 90, currentScore: 0, description: '', status: 'active', targetTable: '', targetColumn: '', systemName: '', severity: 'medium', validationPattern: '', sqlExpression: '', connectionId: 0 }); } }}>
            <DialogTrigger asChild>
              <Button className="btn-gold" data-testid="button-add-quality-rule">
                <Plus className="w-4 h-4 ml-2" />
                إضافة قاعدة فحص
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto" dir="rtl">
              <DialogHeader>
                <DialogTitle>{editingQualityRule ? 'تعديل قاعدة فحص الجودة' : 'إضافة قاعدة فحص جودة'}</DialogTitle>
                <DialogDescription>{editingQualityRule ? 'تعديل إعدادات قاعدة الفحص' : 'تعريف قاعدة فحص جديدة مرتبطة بجدول وعمود في النظام'}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>اسم القاعدة *</Label>
                  <Input value={qualityForm.name} onChange={e => setQualityForm({...qualityForm, name: e.target.value})} placeholder="مثال: التحقق من اكتمال بيانات المستخدمين" data-testid="input-quality-name" />
                </div>

                {/* مصدر قاعدة البيانات */}
                <div className="space-y-2 p-3 rounded-lg border border-primary/20 bg-primary/5">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Database className="w-4 h-4 text-primary" />
                    مصدر قاعدة البيانات
                  </Label>
                  <Select
                    value={String(qualityForm.connectionId)}
                    onValueChange={v => setQualityForm({...qualityForm, connectionId: Number(v), targetTable: '', targetColumn: ''})}
                  >
                    <SelectTrigger data-testid="select-quality-connection">
                      <SelectValue placeholder="اختر مصدر البيانات" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">
                        <div className="flex items-center gap-2">
                          <Database className="w-3.5 h-3.5 text-primary" />
                          Control Hub (قاعدة البيانات الداخلية)
                        </div>
                      </SelectItem>
                      {(databaseConnectionsList as any[]).filter((c: any) => c.isActive && c.approvalStatus === 'approved').map((conn: any) => (
                        <SelectItem key={conn.id} value={String(conn.id)}>
                          <div className="flex items-center gap-2">
                            <Database className="w-3.5 h-3.5 text-amber-500" />
                            {conn.connectionNameAr || conn.connectionName} ({conn.databaseType} — {conn.databaseName})
                          </div>
                        </SelectItem>
                      ))}
                      {(databaseConnectionsList as any[]).filter((c: any) => c.isActive && c.approvalStatus !== 'approved').length > 0 && (
                        <SelectItem value="-1" disabled>
                          — اتصالات بانتظار الموافقة —
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {qualityForm.connectionId > 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      سيتم تشغيل الفحص مباشرة على قاعدة البيانات الخارجية المختارة
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>معيار الجودة *</Label>
                    <Select value={qualityForm.dimension} onValueChange={v => setQualityForm({...qualityForm, dimension: v})}>
                      <SelectTrigger data-testid="select-quality-dimension"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SIX_DIMS.map(d => <SelectItem key={d.id} value={d.id}>{d.name} ({d.nameEn})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>الحد الأدنى المطلوب (%)</Label>
                    <Input type="number" min={0} max={100} value={qualityForm.threshold} onChange={e => setQualityForm({...qualityForm, threshold: Number(e.target.value)})} data-testid="input-quality-threshold" />
                  </div>
                </div>

                {/* الجدول والعمود - يتغير حسب نوع الاتصال */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>الجدول المستهدف *</Label>
                    {qualityForm.connectionId === 0 ? (
                      <>
                        <Select value={qualityForm.targetTable} onValueChange={v => { setQualityForm({...qualityForm, targetTable: v, targetColumn: ''}); fetchTableColumns(v); }}>
                          <SelectTrigger data-testid="select-quality-table"><SelectValue placeholder="اختر الجدول" /></SelectTrigger>
                          <SelectContent>
                            {systemTables.map((t: any) => <SelectItem key={t.table_name} value={t.table_name}>{t.table_name} ({t.row_count} سجل)</SelectItem>)}
                          </SelectContent>
                        </Select>
                        {systemTables.length > 0 && <p className="text-xs text-muted-foreground">{systemTables.length} جدول متاح</p>}
                      </>
                    ) : (
                      <Input
                        value={qualityForm.targetTable}
                        onChange={e => setQualityForm({...qualityForm, targetTable: e.target.value})}
                        placeholder="اسم الجدول (مثال: users)"
                        dir="ltr"
                        data-testid="input-quality-table-ext"
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>العمود المستهدف (اختياري)</Label>
                    {qualityForm.connectionId === 0 ? (
                      loadingColumns ? (
                        <div className="flex items-center gap-2 h-10 px-3 border rounded-md text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> جارٍ تحميل الأعمدة...</div>
                      ) : tableColumns.length > 0 ? (
                        <Select value={qualityForm.targetColumn || 'all_columns'} onValueChange={v => setQualityForm({...qualityForm, targetColumn: v === 'all_columns' ? '' : v})}>
                          <SelectTrigger data-testid="select-quality-column"><SelectValue placeholder="اختر العمود" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all_columns">كل الأعمدة (فحص شامل)</SelectItem>
                            {tableColumns.map(c => <SelectItem key={c.column_name} value={c.column_name}>{c.column_name} ({c.data_type})</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input value={qualityForm.targetColumn} onChange={e => setQualityForm({...qualityForm, targetColumn: e.target.value})} placeholder={qualityForm.targetTable ? 'لم يتم العثور على أعمدة' : 'اختر الجدول أولاً'} disabled={!qualityForm.targetTable} data-testid="input-quality-column" />
                      )
                    ) : (
                      <Input
                        value={qualityForm.targetColumn}
                        onChange={e => setQualityForm({...qualityForm, targetColumn: e.target.value})}
                        placeholder="اسم العمود (مثال: email)"
                        dir="ltr"
                        data-testid="input-quality-column-ext"
                      />
                    )}
                    {qualityForm.connectionId === 0 && tableColumns.length > 0 && <p className="text-xs text-muted-foreground">{tableColumns.length} عمود متاح</p>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>النظام / المصدر</Label>
                    <Select value={qualityForm.systemName} onValueChange={v => setQualityForm({...qualityForm, systemName: v})}>
                      <SelectTrigger data-testid="select-quality-system"><SelectValue placeholder="اختر النظام" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="control_hub">Control Hub (النظام الداخلي)</SelectItem>
                        {externalSystemsList.filter((s: any) => s.isActive).map((sys: any) => (
                          <SelectItem key={sys.id} value={sys.nameAr || sys.name}>{sys.nameAr || sys.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>درجة الخطورة</Label>
                    <Select value={qualityForm.severity} onValueChange={v => setQualityForm({...qualityForm, severity: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="critical">حرج</SelectItem>
                        <SelectItem value="high">عالي</SelectItem>
                        <SelectItem value="medium">متوسط</SelectItem>
                        <SelectItem value="low">منخفض</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>نمط التحقق (Regex) - اختياري</Label>
                  <Input value={qualityForm.validationPattern} onChange={e => setQualityForm({...qualityForm, validationPattern: e.target.value})} placeholder="مثال: ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+$" dir="ltr" data-testid="input-quality-pattern" />
                </div>
                <div className="space-y-2">
                  <Label>استعلام SQL مخصص (اختياري)</Label>
                  <Textarea value={qualityForm.sqlExpression} onChange={e => setQualityForm({...qualityForm, sqlExpression: e.target.value})} placeholder="SELECT COUNT(*) as total, COUNT(CASE WHEN email IS NOT NULL THEN 1 END) as passed FROM users" dir="ltr" className="font-mono text-xs" data-testid="input-quality-sql" />
                  {qualityForm.connectionId > 0 && (
                    <p className="text-xs text-muted-foreground">الاستعلام يُشغَّل على قاعدة البيانات الخارجية المختارة — يجب أن يُرجع: total, passed (أو total, failed)</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>الوصف</Label>
                  <Textarea value={qualityForm.description} onChange={e => setQualityForm({...qualityForm, description: e.target.value})} data-testid="input-quality-description" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddQualityOpen(false)}>إلغاء</Button>
                <Button
                  className="btn-navy"
                  disabled={createQualityRuleMutation.isPending || updateQualityRuleMutation.isPending || !qualityForm.name.trim() || !qualityForm.targetTable}
                  onClick={() => {
                    if (!qualityForm.name.trim()) { toast({ title: 'يرجى إدخال اسم القاعدة', variant: 'destructive' }); return; }
                    if (!qualityForm.targetTable) { toast({ title: 'يرجى إدخال/اختيار الجدول المستهدف', variant: 'destructive' }); return; }
                    const payload = { ...qualityForm, connectionId: qualityForm.connectionId > 0 ? qualityForm.connectionId : null };
                    if (editingQualityRule) {
                      updateQualityRuleMutation.mutate({ id: editingQualityRule.id, data: payload });
                    } else {
                      createQualityRuleMutation.mutate(payload);
                    }
                  }}
                  data-testid="button-save-quality"
                >
                  {(createQualityRuleMutation.isPending || updateQualityRuleMutation.isPending) ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                  {editingQualityRule ? 'تحديث القاعدة' : 'حفظ القاعدة'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Quality Tool Tabs */}
      <Tabs value={qualityTab} onValueChange={setQualityTab} dir="rtl">
        <TabsList className="flex flex-wrap w-full gap-1">
          <TabsTrigger value="dashboard" data-testid="tab-quality-dashboard">لوحة القيادة</TabsTrigger>
          <TabsTrigger value="rules" data-testid="tab-quality-rules">قواعد الفحص</TabsTrigger>
          <TabsTrigger value="errors" data-testid="tab-quality-errors">الأخطاء</TabsTrigger>
          <TabsTrigger value="profiling" data-testid="tab-quality-profiling">تحليل البيانات</TabsTrigger>
          <TabsTrigger value="suggest" data-testid="tab-quality-suggest">اقتراحات ذكية</TabsTrigger>
          <TabsTrigger value="systems" data-testid="tab-quality-systems">الأنظمة</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-quality-history">السجل</TabsTrigger>
        </TabsList>

        {/* ===== TAB: Dashboard ===== */}
        <TabsContent value="dashboard" className="space-y-4 mt-4">
          {/* Overall Score */}
          <Card className="card-premium">
            <CardContent className="p-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">النتيجة الإجمالية لجودة البيانات</p>
                  <div className="text-4xl font-bold">{overallScore}%</div>
                  <p className="text-xs text-muted-foreground mt-1">{qualityRules.filter((r: any) => r.status === 'active').length} قاعدة نشطة | {qualityChecks.length} فحص منفذ</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full ${overallScore >= 90 ? 'bg-emerald-500' : overallScore >= 70 ? 'bg-yellow-500' : overallScore >= 50 ? 'bg-orange-500' : 'bg-red-500'}`} />
                  <span className="text-sm font-medium">{overallScore >= 90 ? 'ممتاز' : overallScore >= 70 ? 'جيد' : overallScore >= 50 ? 'يحتاج تحسين' : 'ضعيف'}</span>
                </div>
              </div>
              <Progress value={overallScore} className="mt-4 h-3" />
            </CardContent>
          </Card>

          {/* 6 Dimensions Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dimScores.map((dim) => (
              <Card key={dim.id} className="card-premium" data-testid={`card-dim-${dim.id}`}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between flex-wrap gap-1 mb-3">
                    <div className="flex items-center gap-2">
                      <dim.icon className="w-5 h-5 hub-stat-gold" />
                      <span className="font-semibold">{dim.name}</span>
                    </div>
                    <span className="text-2xl font-bold">{dim.score}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{dim.desc}</p>
                  <Progress value={dim.score} className="h-2 mb-2" />
                  <div className="flex items-center justify-between flex-wrap gap-1 text-xs text-muted-foreground">
                    <span>{dim.nameEn}</span>
                    <span>{dim.checkedCount}/{dim.rulesCount} قاعدة مفحوصة</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Systems Overview */}
          {systemsBreakdown.length > 0 && (
            <Card className="card-premium">
              <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
                <CardTitle className="flex items-center gap-2"><Server className="w-5 h-5" /> الأنظمة ونسبة الجودة</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">النظام</TableHead>
                      <TableHead className="text-right">النوع</TableHead>
                      <TableHead className="text-right">عدد القواعد</TableHead>
                      <TableHead className="text-right">نسبة الجودة</TableHead>
                      <TableHead className="text-right">الأخطاء</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {systemsBreakdown.map((sys, idx) => (
                      <TableRow key={idx} data-testid={`row-system-${idx}`}>
                        <TableCell className="font-medium">{sys.name}</TableCell>
                        <TableCell>{sys.isExternal ? <Badge variant="outline">خارجي</Badge> : <Badge variant="outline">داخلي</Badge>}</TableCell>
                        <TableCell><Badge variant="outline">{sys.rules.length}</Badge></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={sys.avgScore} className="w-20 h-2" />
                            <span className="font-semibold">{sys.avgScore}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {sys.errors > 0 ? <Badge variant="destructive">{sys.errors.toLocaleString()} خطأ</Badge> : <Badge variant="outline">لا أخطاء</Badge>}
                        </TableCell>
                        <TableCell>
                          <div className={`w-3 h-3 rounded-full ${sys.avgScore >= 90 ? 'bg-emerald-500' : sys.avgScore >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* DB Connectivity */}
          <Card className="card-premium">
            <CardContent className="p-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${dbConnectivity?.connected ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  <div>
                    <p className="font-medium">{dbConnectivity?.connected ? 'متصل بقاعدة البيانات' : 'غير متصل'}</p>
                    <p className="text-xs text-muted-foreground">{dbConnectivity?.version} | {dbConnectivity?.tables} جدول</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== TAB: Rules ===== */}
        <TabsContent value="rules" className="space-y-4 mt-4">
          <Card className="card-premium">
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <CardTitle>قواعد فحص الجودة ({qualityRules.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {qualityRules.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ListChecks className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">لا توجد قواعد فحص</p>
                  <p className="text-sm mt-2">أضف قواعد فحص لبدء مراقبة جودة البيانات عبر الأنظمة</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">القاعدة</TableHead>
                      <TableHead className="text-right">المعيار</TableHead>
                      <TableHead className="text-right">الجدول</TableHead>
                      <TableHead className="text-right">العمود</TableHead>
                      <TableHead className="text-right">الحد الأدنى</TableHead>
                      <TableHead className="text-right">النتيجة</TableHead>
                      <TableHead className="text-right">الأخطاء</TableHead>
                      <TableHead className="text-right">آخر فحص</TableHead>
                      <TableHead className="text-right">إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {qualityRules.map((rule: any) => (
                      <TableRow key={rule.id} data-testid={`row-rule-${rule.id}`}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{rule.name}</p>
                            {rule.connectionId ? (
                              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                <Database className="w-3 h-3" />
                                {(databaseConnectionsList as any[]).find((c: any) => c.id === rule.connectionId)?.connectionName || `اتصال #${rule.connectionId}`}
                              </p>
                            ) : rule.systemName ? (
                              <p className="text-xs text-muted-foreground">{rule.systemName}</p>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="outline">{rule.dimension}</Badge></TableCell>
                        <TableCell className="font-mono text-xs">{rule.targetTable || '-'}</TableCell>
                        <TableCell className="font-mono text-xs">{rule.targetColumn || 'الكل'}</TableCell>
                        <TableCell>{rule.threshold}%</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={Number(rule.currentScore) || 0} className="w-16 h-2" />
                            <span className={`font-semibold ${Number(rule.currentScore) >= Number(rule.threshold) ? 'text-emerald-600' : 'text-red-600'}`}>
                              {rule.currentScore ? `${Number(rule.currentScore).toFixed(1)}%` : '-'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {rule.failedRecords > 0 ? <Badge variant="destructive">{rule.failedRecords}</Badge> : <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {rule.lastChecked ? new Date(rule.lastChecked).toLocaleDateString('ar-SA') : 'لم يفحص'}
                          {rule.lastCheckDuration ? ` (${rule.lastCheckDuration}ms)` : ''}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="ghost" onClick={() => runSingleCheck(rule.id)} disabled={runningCheckId === rule.id} data-testid={`button-run-check-${rule.id}`}>
                              {runningCheckId === rule.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => {
                              setEditingQualityRule(rule);
                              setQualityForm({ name: rule.name, dimension: rule.dimension || 'الدقة', ruleType: rule.ruleType || 'validation', threshold: rule.threshold || 90, currentScore: rule.currentScore || 0, description: rule.description || '', status: rule.status || 'active', targetTable: rule.targetTable || '', targetColumn: rule.targetColumn || '', systemName: rule.systemName || '', severity: rule.severity || 'medium', validationPattern: rule.validationPattern || '', sqlExpression: rule.sqlExpression || '', connectionId: rule.connectionId || 0 });
                              if (rule.targetTable) fetchTableColumns(rule.targetTable);
                              setIsAddQualityOpen(true);
                            }} data-testid={`button-edit-rule-${rule.id}`}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => confirmAction(() => deleteQualityRuleMutation.mutate(rule.id), { title: 'تأكيد الحذف', description: 'هل أنت متأكد من حذف هذه القاعدة؟ لا يمكن التراجع عن هذا الإجراء.' })} data-testid={`button-delete-rule-${rule.id}`}>
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== TAB: Errors ===== */}
        <TabsContent value="errors" className="space-y-4 mt-4">
          <Card className="card-premium">
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <CardTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-red-500" /> الأخطاء والمشاكل المكتشفة</CardTitle>
              <Badge variant="destructive">{recentErrors.length} مشكلة</Badge>
            </CardHeader>
            <CardContent>
              {recentErrors.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="w-16 h-16 mx-auto mb-4 opacity-50 text-emerald-500" />
                  <p className="text-lg font-medium">لا توجد أخطاء مكتشفة</p>
                  <p className="text-sm mt-2">شغّل فحوصات الجودة لاكتشاف المشاكل في البيانات</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">القاعدة</TableHead>
                      <TableHead className="text-right">المعيار</TableHead>
                      <TableHead className="text-right">الجدول</TableHead>
                      <TableHead className="text-right">النتيجة</TableHead>
                      <TableHead className="text-right">سجلات فاشلة</TableHead>
                      <TableHead className="text-right">رسالة الخطأ</TableHead>
                      <TableHead className="text-right">عينة أخطاء</TableHead>
                      <TableHead className="text-right">التاريخ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentErrors.map((check: any, idx: number) => (
                      <TableRow key={check.id || idx} data-testid={`row-error-${idx}`} className="bg-red-50/30 dark:bg-red-950/10">
                        <TableCell className="font-medium">{check.ruleName || '-'}</TableCell>
                        <TableCell><Badge variant="outline">{check.dimension}</Badge></TableCell>
                        <TableCell className="font-mono text-xs">{check.targetTable}</TableCell>
                        <TableCell>
                          <span className="font-bold text-red-600">{Number(check.score).toFixed(1)}%</span>
                          <span className="text-xs text-muted-foreground mr-1">/ {check.threshold}%</span>
                        </TableCell>
                        <TableCell><Badge variant="destructive">{check.failedRecords?.toLocaleString()}</Badge></TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{check.errorMessage || 'لم يجتز الحد الأدنى'}</TableCell>
                        <TableCell className="max-w-[150px]">
                          {check.sampleFailures ? (
                            <Button variant="ghost" size="sm" onClick={() => { setLastCheckResult(check); setShowCheckResult(true); }}>
                              <Eye className="w-3 h-3 ml-1" /> عرض
                            </Button>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(check.executedAt).toLocaleDateString('ar-SA')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== TAB: Profiling ===== */}
        <TabsContent value="profiling" className="space-y-4 mt-4">
          <Card className="card-premium">
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 hub-stat-gold" />
                تحليل بنية البيانات
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>اختر جدول للتحليل</Label>
                  <Select value={selectedProfileTable} onValueChange={v => loadProfile(v)}>
                    <SelectTrigger data-testid="select-profile-table"><SelectValue placeholder="اختر جدول..." /></SelectTrigger>
                    <SelectContent>
                      {systemTables.map((t: any) => (
                        <SelectItem key={t.table_name} value={t.table_name}>{t.table_name} ({t.row_count} سجل)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {loadingProfile && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> جاري التحليل...</div>}
                </div>
                <div className="lg:col-span-2">
                  {!profileData ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p>اختر جدول من القائمة لعرض تحليل شامل لأعمدته وبياناته</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-4 flex-wrap">
                        <Badge variant="outline">{profileData.tableName}</Badge>
                        <Badge variant="outline">{profileData.totalRecords?.toLocaleString()} سجل</Badge>
                        <Badge variant="outline">{profileData.columns?.length} عمود</Badge>
                      </div>
                      <div className="max-h-[500px] overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-right">العمود</TableHead>
                              <TableHead className="text-right">النوع</TableHead>
                              <TableHead className="text-right">الفارغة %</TableHead>
                              <TableHead className="text-right">القيم الفريدة</TableHead>
                              <TableHead className="text-right">النمط المكتشف</TableHead>
                              <TableHead className="text-right">عينة</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {profileData.columns?.map((col: any) => (
                              <TableRow key={col.columnName}>
                                <TableCell className="font-mono text-xs font-medium">{col.columnName}</TableCell>
                                <TableCell className="text-xs">{col.dataType}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Progress value={100 - Number(col.nullPercent || 0)} className="w-12 h-2" />
                                    <span className={`text-xs ${Number(col.nullPercent) > 20 ? 'text-red-600 font-bold' : ''}`}>{col.nullPercent}%</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs">{col.distinctCount?.toLocaleString()}</TableCell>
                                <TableCell>
                                  {col.detectedPattern ? (
                                    <Badge variant="outline" className="text-xs">{col.detectedPattern}</Badge>
                                  ) : <span className="text-xs text-muted-foreground">-</span>}
                                </TableCell>
                                <TableCell className="text-xs max-w-[150px] truncate" dir="ltr">{col.sampleValues?.slice(0, 2).join(', ')}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {dbHealth && (
            <Card className="card-premium">
              <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 hub-stat-gold" />
                  صحة قاعدة البيانات الشاملة
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="p-4 border rounded-md text-center">
                    <p className="text-3xl font-bold">{dbHealth.totalTables}</p>
                    <p className="text-xs text-muted-foreground">إجمالي الجداول</p>
                  </div>
                  <div className="p-4 border rounded-md text-center">
                    <p className="text-3xl font-bold">{dbHealth.totalRecords?.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">إجمالي السجلات</p>
                  </div>
                  <div className="p-4 border rounded-md text-center">
                    <p className="text-3xl font-bold">{Number(dbHealth.overallCompleteness || 0).toFixed(1)}%</p>
                    <p className="text-xs text-muted-foreground">الاكتمال الشامل</p>
                  </div>
                  <div className="p-4 border rounded-md text-center">
                    <p className={`text-3xl font-bold ${(dbHealth.healthScore || 0) >= 80 ? 'text-emerald-600' : (dbHealth.healthScore || 0) >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>{Number(dbHealth.healthScore || 0).toFixed(0)}%</p>
                    <p className="text-xs text-muted-foreground">مؤشر الصحة</p>
                  </div>
                </div>
                {dbHealth.tablesWithIssues?.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2"><AlertCircle className="w-4 h-4 text-yellow-500" /> جداول تحتاج اهتمام ({dbHealth.tablesWithIssues.length})</h4>
                    <div className="max-h-[200px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-right">الجدول</TableHead>
                            <TableHead className="text-right">المشكلة</TableHead>
                            <TableHead className="text-right">الاكتمال</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dbHealth.tablesWithIssues.map((t: any, idx: number) => (
                            <TableRow key={idx}>
                              <TableCell className="font-mono text-xs">{t.tableName}</TableCell>
                              <TableCell className="text-xs">{t.issue}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Progress value={t.completeness} className="w-12 h-2" />
                                  <span className="text-xs">{Number(t.completeness).toFixed(0)}%</span>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ===== TAB: Smart Suggestions ===== */}
        <TabsContent value="suggest" className="space-y-4 mt-4">
          <Card className="card-premium">
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 hub-stat-gold" />
                اقتراحات ذكية لقواعد الفحص ({ruleSuggestions.length})
              </CardTitle>
              <p className="text-sm text-muted-foreground">تحليل تلقائي للجداول واكتشاف نقاط الضعف المحتملة في جودة البيانات</p>
            </CardHeader>
            <CardContent>
              {ruleSuggestions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Sparkles className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">لا توجد اقتراحات حالياً</p>
                  <p className="text-sm mt-2">المحرك يحلل البيانات تلقائياً ويقترح قواعد فحص بناءً على بنية الجداول</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {ruleSuggestions.map((suggestion: any, idx: number) => (
                    <div key={idx} className="flex items-start justify-between gap-4 p-4 border rounded-md" data-testid={`suggestion-${idx}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-medium">{suggestion.ruleName || `فحص ${suggestion.dimensionAr || suggestion.dimension} - ${suggestion.tableName}.${suggestion.columnName}`}</span>
                          <Badge variant="outline">{suggestion.dimensionAr || suggestion.dimension}</Badge>
                          <Badge variant={suggestion.priority === 'عالية' ? 'destructive' : suggestion.priority === 'متوسطة' ? 'default' : 'outline'}>
                            {suggestion.priority}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{suggestion.reason}</p>
                        <p className="text-xs text-muted-foreground mt-1 font-mono" dir="ltr">{suggestion.tableName}.{suggestion.columnName}</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => applySuggestion(suggestion)} disabled={applyingSuggestion} data-testid={`button-apply-suggestion-${idx}`}>
                        {applyingSuggestion ? <Loader2 className="w-3 h-3 animate-spin ml-1" /> : <Plus className="w-3 h-3 ml-1" />}
                        تطبيق
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== TAB: Systems ===== */}
        <TabsContent value="systems" className="space-y-4 mt-4">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
            <div>
              <h3 className="text-lg font-bold">أنظمة المنظمة</h3>
              <p className="text-sm text-muted-foreground">إدارة الأنظمة المرتبطة بأداة فحص جودة البيانات</p>
            </div>
            <Dialog open={isAddSystemOpen} onOpenChange={(open) => { setIsAddSystemOpen(open); if (!open) setSystemForm({ name: '', nameAr: '', systemType: 'database', category: 'internal', ipAddress: '', port: 5432, protocol: 'https', description: '', vendor: '', version: '', environment: 'production', criticality: 'medium', dataClassification: 'internal', apiEndpoint: '', healthCheckUrl: '' }); }}>
              <DialogTrigger asChild>
                <Button className="btn-gold" data-testid="button-add-system">
                  <Plus className="w-4 h-4 ml-2" />
                  إضافة نظام
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto" dir="rtl">
                <DialogHeader>
                  <DialogTitle>إضافة نظام جديد</DialogTitle>
                  <DialogDescription>سجّل نظام جديد من أنظمة المنظمة لفحص جودة بياناته</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>اسم النظام (عربي)</Label>
                      <Input value={systemForm.nameAr} onChange={e => setSystemForm({...systemForm, nameAr: e.target.value})} placeholder="مثال: نظام إدارة الخيول" data-testid="input-system-name-ar" />
                    </div>
                    <div className="space-y-2">
                      <Label>اسم النظام (إنجليزي)</Label>
                      <Input value={systemForm.name} onChange={e => setSystemForm({...systemForm, name: e.target.value})} placeholder="e.g. Horse Management System" dir="ltr" data-testid="input-system-name" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>نوع النظام</Label>
                      <Select value={systemForm.systemType} onValueChange={v => setSystemForm({...systemForm, systemType: v})}>
                        <SelectTrigger data-testid="select-system-type"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="database">قاعدة بيانات</SelectItem>
                          <SelectItem value="erp">نظام ERP</SelectItem>
                          <SelectItem value="crm">نظام CRM</SelectItem>
                          <SelectItem value="hr">نظام الموارد البشرية</SelectItem>
                          <SelectItem value="financial">نظام مالي</SelectItem>
                          <SelectItem value="operational">نظام تشغيلي</SelectItem>
                          <SelectItem value="monitoring">نظام مراقبة</SelectItem>
                          <SelectItem value="web_application">تطبيق ويب</SelectItem>
                          <SelectItem value="mobile_application">تطبيق جوال</SelectItem>
                          <SelectItem value="api_service">خدمة API</SelectItem>
                          <SelectItem value="other">أخرى</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>التصنيف</Label>
                      <Select value={systemForm.category} onValueChange={v => setSystemForm({...systemForm, category: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="internal">داخلي</SelectItem>
                          <SelectItem value="external">خارجي</SelectItem>
                          <SelectItem value="cloud">سحابي</SelectItem>
                          <SelectItem value="hybrid">هجين</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>عنوان IP</Label>
                      <Input value={systemForm.ipAddress} onChange={e => setSystemForm({...systemForm, ipAddress: e.target.value})} placeholder="192.168.1.100" dir="ltr" data-testid="input-system-ip" />
                    </div>
                    <div className="space-y-2">
                      <Label>المنفذ (Port)</Label>
                      <Input type="number" value={systemForm.port} onChange={e => setSystemForm({...systemForm, port: Number(e.target.value)})} dir="ltr" />
                    </div>
                    <div className="space-y-2">
                      <Label>البروتوكول</Label>
                      <Select value={systemForm.protocol} onValueChange={v => setSystemForm({...systemForm, protocol: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="https">HTTPS</SelectItem>
                          <SelectItem value="http">HTTP</SelectItem>
                          <SelectItem value="tcp">TCP</SelectItem>
                          <SelectItem value="ssh">SSH</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>رابط API (اختياري)</Label>
                    <Input value={systemForm.apiEndpoint} onChange={e => setSystemForm({...systemForm, apiEndpoint: e.target.value})} placeholder="https://api.system.com/v1" dir="ltr" />
                  </div>
                  <div className="space-y-2">
                    <Label>رابط فحص الصحة (اختياري)</Label>
                    <Input value={systemForm.healthCheckUrl} onChange={e => setSystemForm({...systemForm, healthCheckUrl: e.target.value})} placeholder="https://api.system.com/health" dir="ltr" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>درجة الأهمية</Label>
                      <Select value={systemForm.criticality} onValueChange={v => setSystemForm({...systemForm, criticality: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="critical">حرج</SelectItem>
                          <SelectItem value="high">عالي</SelectItem>
                          <SelectItem value="medium">متوسط</SelectItem>
                          <SelectItem value="low">منخفض</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>البيئة</Label>
                      <Select value={systemForm.environment} onValueChange={v => setSystemForm({...systemForm, environment: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="production">إنتاج</SelectItem>
                          <SelectItem value="staging">اختبار</SelectItem>
                          <SelectItem value="development">تطوير</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>المورد / الشركة المطورة</Label>
                      <Input value={systemForm.vendor} onChange={e => setSystemForm({...systemForm, vendor: e.target.value})} placeholder="اسم الشركة المطورة" />
                    </div>
                    <div className="space-y-2">
                      <Label>الإصدار</Label>
                      <Input value={systemForm.version} onChange={e => setSystemForm({...systemForm, version: e.target.value})} placeholder="v2.1.0" dir="ltr" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>وصف النظام</Label>
                    <Textarea value={systemForm.description} onChange={e => setSystemForm({...systemForm, description: e.target.value})} placeholder="وصف مختصر عن النظام ووظيفته" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddSystemOpen(false)}>إلغاء</Button>
                  <Button className="btn-navy" disabled={createSystemMutation.isPending || !systemForm.name} onClick={() => { if (!systemForm.name.trim()) { toast({ title: 'يرجى إدخال اسم النظام', variant: 'destructive' }); return; } createSystemMutation.mutate(systemForm); }} data-testid="button-save-system">
                    {createSystemMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                    حفظ النظام
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {externalSystemsList.length === 0 ? (
            <Card className="card-premium">
              <CardContent className="p-12">
                <div className="text-center text-muted-foreground">
                  <Server className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">لا توجد أنظمة مسجلة</p>
                  <p className="text-sm mt-2">أضف أنظمة المنظمة لبدء فحص جودة بياناتها</p>
                  <Button className="btn-gold mt-4" onClick={() => setIsAddSystemOpen(true)} data-testid="button-add-system-empty">
                    <Plus className="w-4 h-4 ml-2" />
                    إضافة نظام
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {externalSystemsList.map((sys: any) => {
                const sysRules = qualityRules.filter((r: any) => r.systemName === (sys.nameAr || sys.name));
                const sysChecked = sysRules.filter((r: any) => Number(r.currentScore) > 0);
                const sysAvg = sysChecked.length > 0 ? Math.round(sysChecked.reduce((s: number, r: any) => s + Number(r.currentScore), 0) / sysChecked.length) : 0;
                const sysErrors = sysRules.reduce((s: number, r: any) => s + (r.failedRecords || 0), 0);
                return (
                  <Card key={sys.id} className="card-premium" data-testid={`card-system-${sys.id}`}>
                    <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate">{sys.nameAr || sys.name}</CardTitle>
                        {sys.nameAr && sys.name && <p className="text-xs text-muted-foreground mt-1" dir="ltr">{sys.name}</p>}
                      </div>
                      <div className="flex items-center gap-1">
                        <div className={`w-3 h-3 rounded-full ${sys.healthStatus === 'healthy' ? 'bg-emerald-500' : sys.healthStatus === 'unhealthy' ? 'bg-red-500' : 'bg-gray-400'}`} />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline">{sys.systemType === 'database' ? 'قاعدة بيانات' : sys.systemType === 'erp' ? 'ERP' : sys.systemType === 'crm' ? 'CRM' : sys.systemType === 'hr' ? 'موارد بشرية' : sys.systemType === 'financial' ? 'مالي' : sys.systemType === 'operational' ? 'تشغيلي' : sys.systemType === 'monitoring' ? 'مراقبة' : sys.systemType === 'web_application' ? 'تطبيق ويب' : sys.systemType}</Badge>
                        <Badge variant={sys.criticality === 'critical' ? 'destructive' : 'outline'}>{sys.criticality === 'critical' ? 'حرج' : sys.criticality === 'high' ? 'عالي' : sys.criticality === 'medium' ? 'متوسط' : 'منخفض'}</Badge>
                        <Badge variant="outline">{sys.category === 'internal' ? 'داخلي' : sys.category === 'external' ? 'خارجي' : sys.category === 'cloud' ? 'سحابي' : 'هجين'}</Badge>
                      </div>
                      {sys.description && <p className="text-xs text-muted-foreground line-clamp-2">{sys.description}</p>}
                      {sys.ipAddress && <p className="text-xs text-muted-foreground font-mono" dir="ltr">{sys.ipAddress}{sys.port ? `:${sys.port}` : ''}</p>}
                      {sys.vendor && <p className="text-xs text-muted-foreground">المورد: {sys.vendor} {sys.version ? `(${sys.version})` : ''}</p>}
                      <div className="border-t pt-3 space-y-2">
                        <div className="flex items-center justify-between flex-wrap gap-1">
                          <span className="text-xs text-muted-foreground">قواعد الفحص: {sysRules.length}</span>
                          {sysAvg > 0 && (
                            <div className="flex items-center gap-2">
                              <Progress value={sysAvg} className="w-16 h-2" />
                              <span className={`text-xs font-bold ${sysAvg >= 90 ? 'text-emerald-600' : sysAvg >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>{sysAvg}%</span>
                            </div>
                          )}
                        </div>
                        {sysErrors > 0 && <p className="text-xs text-red-600">{sysErrors.toLocaleString()} خطأ مكتشف</p>}
                      </div>
                    </CardContent>
                    <CardFooter className="flex items-center gap-1 pt-0">
                      <Button size="sm" variant="ghost" onClick={() => checkSystemHealth(sys.id)} disabled={checkingHealthId === sys.id} data-testid={`button-health-${sys.id}`}>
                        {checkingHealthId === sys.id ? <Loader2 className="w-3 h-3 animate-spin ml-1" /> : <Activity className="w-3 h-3 ml-1" />}
                        فحص الاتصال
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => confirmAction(() => deleteSystemMutation.mutate(sys.id), { title: 'تأكيد الحذف', description: 'هل أنت متأكد من حذف هذا النظام المتصل؟ لا يمكن التراجع عن هذا الإجراء.' })} data-testid={`button-delete-system-${sys.id}`}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Database Tables Inspector */}
          <Card className="card-premium mt-4">
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <CardTitle className="flex items-center gap-2"><Database className="w-5 h-5" /> استكشاف جداول قاعدة البيانات الداخلية ({systemTables.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">الجدول</TableHead>
                        <TableHead className="text-right">السجلات</TableHead>
                        <TableHead className="text-right">الأعمدة</TableHead>
                        <TableHead className="text-right">فحص</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {systemTables.map((t: any) => (
                        <TableRow key={t.table_name} className={selectedTableForStats === t.table_name ? 'bg-muted/50' : ''}>
                          <TableCell className="font-mono text-xs font-medium">{t.table_name}</TableCell>
                          <TableCell>{t.row_count?.toLocaleString()}</TableCell>
                          <TableCell>{t.column_count}</TableCell>
                          <TableCell>
                            <Button size="sm" variant="ghost" onClick={() => loadTableStats(t.table_name)} data-testid={`button-inspect-${t.table_name}`}>
                              {loadingStats && selectedTableForStats === t.table_name ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div>
                  {!tableStats ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>اضغط على زر الفحص بجانب أي جدول لعرض تحليل الأعمدة</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="font-semibold">{tableStats.tableName}</p>
                      <div className="flex items-center gap-4 flex-wrap">
                        <Badge variant="outline">{tableStats.totalRecords?.toLocaleString()} سجل</Badge>
                        <Badge variant="outline">{tableStats.totalColumns} عمود</Badge>
                      </div>
                      <div className="max-h-[300px] overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-right">العمود</TableHead>
                              <TableHead className="text-right">النوع</TableHead>
                              <TableHead className="text-right">الفارغة</TableHead>
                              <TableHead className="text-right">الاكتمال</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {tableStats.columns?.map((col: any) => (
                              <TableRow key={col.column}>
                                <TableCell className="font-mono text-xs">{col.column}</TableCell>
                                <TableCell className="text-xs">{col.dataType}</TableCell>
                                <TableCell>
                                  {col.nullCount > 0 ? <Badge variant="destructive">{col.nullCount}</Badge> : <Badge variant="outline">0</Badge>}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Progress value={100 - Number(col.nullPercent || 0)} className="w-16 h-2" />
                                    <span className={`text-xs font-medium ${Number(col.nullPercent || 0) > 20 ? 'text-red-600' : ''}`}>
                                      {(100 - Number(col.nullPercent || 0)).toFixed(1)}%
                                    </span>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== TAB: History ===== */}
        <TabsContent value="history" className="space-y-4 mt-4">
          <Card className="card-premium">
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <CardTitle>سجل الفحوصات ({qualityChecks.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {qualityChecks.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>لا توجد فحوصات سابقة</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">القاعدة</TableHead>
                      <TableHead className="text-right">المعيار</TableHead>
                      <TableHead className="text-right">الجدول</TableHead>
                      <TableHead className="text-right">إجمالي</TableHead>
                      <TableHead className="text-right">ناجح</TableHead>
                      <TableHead className="text-right">فاشل</TableHead>
                      <TableHead className="text-right">النتيجة</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right">المدة</TableHead>
                      <TableHead className="text-right">التاريخ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {qualityChecks.map((check: any) => (
                      <TableRow key={check.id} data-testid={`row-check-${check.id}`} className={!check.passed ? 'bg-red-50/20 dark:bg-red-950/10' : ''}>
                        <TableCell className="font-medium">{check.ruleName || '-'}</TableCell>
                        <TableCell><Badge variant="outline">{check.dimension}</Badge></TableCell>
                        <TableCell className="font-mono text-xs">{check.targetTable}</TableCell>
                        <TableCell>{check.totalRecords?.toLocaleString()}</TableCell>
                        <TableCell className="text-emerald-600">{check.passedRecords?.toLocaleString()}</TableCell>
                        <TableCell className="text-red-600">{check.failedRecords?.toLocaleString()}</TableCell>
                        <TableCell>
                          <span className={`font-bold ${check.passed ? 'text-emerald-600' : 'text-red-600'}`}>
                            {Number(check.score).toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge className={check.passed ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}>
                            {check.passed ? 'ناجح' : 'فاشل'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{check.executionTime}ms</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(check.executedAt).toLocaleString('ar-SA')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Check Result Dialog */}
      <Dialog open={showCheckResult} onOpenChange={setShowCheckResult}>
        <DialogContent className="sm:max-w-[600px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>تفاصيل نتيجة الفحص</DialogTitle>
          </DialogHeader>
          {lastCheckResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 border rounded-md">
                  <p className="text-xs text-muted-foreground">القاعدة</p>
                  <p className="font-medium">{lastCheckResult.ruleName}</p>
                </div>
                <div className="p-3 border rounded-md">
                  <p className="text-xs text-muted-foreground">النتيجة</p>
                  <p className={`text-2xl font-bold ${lastCheckResult.passed ? 'text-emerald-600' : 'text-red-600'}`}>
                    {Number(lastCheckResult.score).toFixed(1)}%
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 border rounded-md text-center">
                  <p className="text-xs text-muted-foreground">إجمالي السجلات</p>
                  <p className="text-lg font-bold">{lastCheckResult.totalRecords?.toLocaleString()}</p>
                </div>
                <div className="p-3 border rounded-md text-center">
                  <p className="text-xs text-muted-foreground">ناجح</p>
                  <p className="text-lg font-bold text-emerald-600">{lastCheckResult.passedRecords?.toLocaleString()}</p>
                </div>
                <div className="p-3 border rounded-md text-center">
                  <p className="text-xs text-muted-foreground">فاشل</p>
                  <p className="text-lg font-bold text-red-600">{lastCheckResult.failedRecords?.toLocaleString()}</p>
                </div>
              </div>
              {lastCheckResult.errorMessage && (
                <div className="p-3 border border-red-200 rounded-md bg-red-50/50 dark:bg-red-950/20">
                  <p className="text-xs text-red-600 font-medium">رسالة الخطأ:</p>
                  <p className="text-sm mt-1">{lastCheckResult.errorMessage}</p>
                </div>
              )}
              {lastCheckResult.sampleFailures && (
                <div className="p-3 border rounded-md">
                  <p className="text-xs text-muted-foreground font-medium mb-2">عينة من البيانات الفاشلة:</p>
                  <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-[200px]" dir="ltr">
                    {JSON.stringify(JSON.parse(lastCheckResult.sampleFailures), null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );

  // ============== STEWARDS ==============
  const renderStewards = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">ممثلو بيانات الأعمال</h2>
        <Dialog open={isAddStewardOpen} onOpenChange={(open) => { setIsAddStewardOpen(open); if (!open) { setEditingSteward(null); setStewardForm({ name: '', email: '', phone: '', department: '', role: 'steward' }); setSuccessSteward(null); } }}>
          <DialogTrigger asChild>
            <Button className="btn-gold" data-testid="button-add-steward">
              <Plus className="w-4 h-4 ml-2" />
              إضافة ممثل
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]" dir="rtl">
            <DialogHeader>
              <DialogTitle>{successSteward ? 'تم إضافة ممثل البيانات' : (editingSteward ? 'تعديل ممثل بيانات' : 'إضافة ممثل بيانات أعمال')}</DialogTitle>
            </DialogHeader>
            {successSteward && !editingSteward ? (
              <FormSuccessPanel
                title="تم إضافة ممثل البيانات بنجاح!"
                subtitle={successSteward.name}
                referenceNumber={`STW-${String(successSteward.id).padStart(4, '0')}`}
                referenceLabel="رقم الممثل"
                nextSteps={[
                  { title: "إشعار ممثل البيانات", description: "سيُرسل إشعار تلقائي للممثل الجديد ببياناته ومسؤولياته" },
                  { title: "تحديد أصول البيانات", description: "يُعيَّن للممثل مجموعة من أصول البيانات ضمن إدارته لرعايتها" },
                  { title: "تدريب وتأهيل", description: "يُنصح بإتمام برنامج تأهيل حوكمة البيانات قبل بدء المهام" },
                ]}
                actions={[
                  {
                    label: "إضافة ممثل آخر",
                    variant: "default",
                    icon: <Plus className="w-4 h-4" />,
                    onClick: () => setSuccessSteward(null),
                  },
                  {
                    label: "إغلاق",
                    variant: "outline",
                    onClick: () => { setIsAddStewardOpen(false); setSuccessSteward(null); },
                  },
                ]}
              />
            ) : (
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>الاسم الكامل *</Label>
                <Input placeholder="مثال: أحمد بن محمد الحارثي" value={stewardForm.name} onChange={e => setStewardForm({...stewardForm, name: e.target.value})} data-testid="input-steward-name" />
                <FieldHint>الاسم الرسمي كما يظهر في سجلات الموظفين.</FieldHint>
              </div>
              <div className="space-y-2">
                <Label>البريد الإلكتروني الرسمي *</Label>
                <Input
                  type="email"
                  placeholder="مثال: ahmed.alharith@jcsa.sa"
                  value={stewardForm.email}
                  onChange={e => setStewardForm({...stewardForm, email: e.target.value})}
                  data-testid="input-steward-email"
                />
                {stewardForm.email && !/^[^\s@]+@jcsa\.sa$/.test(stewardForm.email) && (
                  <p className="text-xs text-red-500">يجب أن يكون البريد الإلكتروني بصيغة @jcsa.sa</p>
                )}
                <FieldHint>سيُستخدم للإشعارات وتقارير حوكمة البيانات.</FieldHint>
              </div>
              <div className="space-y-2">
                <Label>رقم الجوال <span className="text-muted-foreground text-xs">(05xxxxxxxx)</span></Label>
                <Input
                  placeholder="مثال: 0512345678"
                  value={stewardForm.phone}
                  onChange={e => {
                    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
                    setStewardForm({...stewardForm, phone: val});
                  }}
                  maxLength={10}
                  data-testid="input-steward-phone"
                />
                {stewardForm.phone && !/^05\d{8}$/.test(stewardForm.phone) && (
                  <p className="text-xs text-red-500">يجب أن يبدأ رقم الجوال بـ 05 ويتكون من 10 أرقام</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>الإدارة</Label>
                <Select value={stewardForm.department} onValueChange={v => setStewardForm({...stewardForm, department: v})}>
                  <SelectTrigger data-testid="select-steward-department">
                    <SelectValue placeholder="اختر الإدارة" />
                  </SelectTrigger>
                  <SelectContent>
                    {businessDepartments.filter((d: any) => d.isActive).map((dept: any) => (
                      <SelectItem key={dept.id} value={dept.nameAr}>{dept.nameAr}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>الدور في حوكمة البيانات</Label>
                <Select value={stewardForm.role} onValueChange={v => setStewardForm({...stewardForm, role: v})}>
                  <SelectTrigger data-testid="select-steward-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="steward">👤 ممثل بيانات — مسؤول عن جودة بيانات إدارته</SelectItem>
                    <SelectItem value="owner">👑 مالك بيانات — صلاحية الاعتماد والوصول</SelectItem>
                    <SelectItem value="custodian">🔐 أمين بيانات — مسؤول عن حفظ وأمان البيانات</SelectItem>
                  </SelectContent>
                </Select>
                <FieldHint>حدد الدور الوظيفي للممثل في إطار حوكمة البيانات.</FieldHint>
              </div>
              <div className="space-y-2">
                <Label>المرفقات <span className="text-muted-foreground text-xs">(اختياري — وثيقة الهوية أو التعيين)</span></Label>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => stewardFileInputRef.current?.click()}
                  onKeyDown={e => e.key === 'Enter' && stewardFileInputRef.current?.click()}
                  className={`flex items-center gap-2 px-3 py-2 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${stewardAttachment ? 'border-gold/60 bg-gold/5' : 'border-border hover:border-gold/40 hover:bg-muted/30'}`}
                  data-testid="label-steward-attachment"
                >
                  <Upload className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate text-muted-foreground">
                    {stewardAttachment ? stewardAttachment.name : 'اضغط لاختيار ملف (PDF، Word، صورة)'}
                  </span>
                  {stewardAttachment && (
                    <button type="button" className="mr-auto text-xs text-red-500 hover:text-red-700 shrink-0"
                      onClick={e => { e.stopPropagation(); setStewardAttachment(null); }}>✕</button>
                  )}
                </div>
                <input
                  ref={stewardFileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                  onChange={e => setStewardAttachment(e.target.files?.[0] || null)}
                  data-testid="input-steward-attachment"
                />
              </div>
            </div>
            )}
            {!successSteward && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddStewardOpen(false)} data-testid="button-cancel-steward">إلغاء</Button>
              <Button
                className="btn-navy"
                disabled={createStewardMutation.isPending || updateStewardMutation.isPending}
                onClick={() => {
                  if (!stewardForm.name.trim() || !stewardForm.email.trim()) {
                    toast({ title: 'يرجى إدخال الاسم والبريد الإلكتروني', variant: 'destructive' });
                    return;
                  }
                  if (!/^[^\s@]+@jcsa\.sa$/.test(stewardForm.email)) {
                    toast({ title: 'يجب أن يكون البريد الإلكتروني بصيغة: اسم@jcsa.sa', variant: 'destructive' });
                    return;
                  }
                  if (stewardForm.phone && !/^05\d{8}$/.test(stewardForm.phone)) {
                    toast({ title: 'رقم الجوال يجب أن يبدأ بـ 05 ويتكون من 10 أرقام', variant: 'destructive' });
                    return;
                  }
                  if (editingSteward) {
                    updateStewardMutation.mutate({ id: editingSteward.id, data: stewardForm });
                  } else {
                    createStewardMutation.mutate(stewardForm);
                  }
                }}
                data-testid="button-save-steward"
              >
                {(createStewardMutation.isPending || updateStewardMutation.isPending) ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                {editingSteward ? 'حفظ التعديلات' : 'إضافة الممثل'}
              </Button>
            </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stewardsList.length === 0 && (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">لا يوجد ممثلو بيانات حالياً - قم بإضافة ممثل بيانات جديد</p>
          </div>
        )}
        {stewardsList.map((steward: any, idx: number) => (
          <Card key={idx} className="card-premium">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white font-bold">
                  {steward.name?.charAt(0) || '?'}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold">{steward.name}</h3>
                  <p className="text-sm text-muted-foreground">{steward.department}</p>
                  <Badge className="mt-2" variant="outline">
                    {steward.role === 'steward' ? 'ممثل بيانات' : steward.role === 'owner' ? 'مالك بيانات' : 'أمين بيانات'}
                  </Badge>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="w-4 h-4" />
                  {steward.email}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Database className="w-4 h-4" />
                  {steward.assets} أصول بيانية
                </div>
              </div>
              <div className="mt-3 pt-3 border-t flex gap-1 justify-end">
                <Button size="icon" variant="ghost" data-testid={`button-edit-steward-${steward.id}`} onClick={() => {
                  setEditingSteward(steward);
                  setStewardForm({ name: steward.name, email: steward.email, phone: steward.phone || '', department: steward.department || '', role: steward.role || 'steward' });
                  setIsAddStewardOpen(true);
                }}><Edit className="w-4 h-4" /></Button>
                <Button size="icon" variant="ghost" data-testid={`button-delete-steward-${steward.id}`} onClick={() => confirmAction(() => deleteStewardMutation.mutate(steward.id), { title: 'تأكيد الحذف', description: 'هل أنت متأكد من حذف هذا الممثل؟ لا يمكن التراجع عن هذا الإجراء.' })}><Trash2 className="w-4 h-4" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  // ============== SIMPLE PAGE RENDERS ==============
  const renderAssetsRegistry = () => renderDataAssets();
  
  const renderDSR = () => {
    const typeLabels: Record<string, string> = {
      access: 'طلب وصول',
      rectification: 'طلب تصحيح',
      erasure: 'طلب حذف',
      portability: 'طلب نقل',
      restriction: 'تقييد معالجة',
      objection: 'اعتراض',
      other: 'أخرى',
    };
    const statusLabels: Record<string, string> = {
      pending: 'قيد الانتظار',
      in_progress: 'قيد المعالجة',
      completed: 'مكتمل',
      rejected: 'مرفوض',
    };
    const statusColors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-blue-100 text-blue-800',
      completed: 'hub-badge-success',
      rejected: 'bg-red-100 text-red-800',
    };
    const actionStatusLabels: Record<string, string> = {
      pending: 'قيد الانتظار', sent: 'تم الإرسال', acknowledged: 'مستلم', completed: 'مكتمل',
      failed: 'فشل', not_found: 'غير موجود', not_applicable: 'لا ينطبق',
    };
    const actionStatusColors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800', sent: 'bg-blue-100 text-blue-800',
      acknowledged: 'bg-purple-100 text-purple-800', completed: 'hub-badge-success',
      failed: 'bg-red-100 text-red-800', not_found: 'bg-gray-100 text-gray-700',
      not_applicable: 'bg-gray-100 text-gray-500',
    };

    const totalCount = (dsrList as any[]).length;
    const pendingCount = (dsrList as any[]).filter((r: any) => r.status === 'pending').length;
    const inProgressCount = (dsrList as any[]).filter((r: any) => r.status === 'in_progress').length;
    const completedCount = (dsrList as any[]).filter((r: any) => r.status === 'completed').length;
    const systemActionsTotal = dsrStats?.systemActions?.total || 0;
    const systemActionsSent = dsrStats?.systemActions?.sent || 0;

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-bold" data-testid="text-dsr-title">طلبات أصحاب البيانات (DSR)</h2>
            <p className="text-sm text-muted-foreground mt-1">إدارة طلبات الخصوصية وإرسالها للأنظمة الخارجية وفق متطلبات نظام PDPL</p>
          </div>
          <Button onClick={() => setIsDsrCreateOpen(true)} data-testid="button-add-dsr" className="gap-2">
            <Plus className="w-4 h-4" />
            طلب جديد
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card data-testid="card-dsr-total" className="border-navy/20 hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[hsl(var(--hub-navy)/0.15)]">
                <FileKey className="w-5 h-5 hub-stat-gold" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">إجمالي الطلبات</p>
                <p className="text-2xl font-bold">{totalCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="card-dsr-pending" className="border-yellow-200 hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">قيد الانتظار</p>
                <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="card-dsr-inprogress" className="border-blue-200 hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                <Activity className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">قيد المعالجة</p>
                <p className="text-2xl font-bold text-blue-600">{inProgressCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="card-dsr-completed" className="border-green-200 hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">مكتملة</p>
                <p className="text-2xl font-bold text-green-600">{completedCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="card-dsr-sysactions" className="border-purple-200 hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                <Send className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">مُرسَلة للأنظمة</p>
                <p className="text-2xl font-bold text-purple-600">{systemActionsSent}</p>
                {systemActionsTotal > 0 && <p className="text-xs text-muted-foreground">من {systemActionsTotal}</p>}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* DSR Table */}
        <Card>
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">قائمة الطلبات</CardTitle>
              <Badge variant="outline" className="text-xs">{totalCount} طلب</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">رقم الطلب</TableHead>
                  <TableHead className="text-right">المصدر</TableHead>
                  <TableHead className="text-right">النوع</TableHead>
                  <TableHead className="text-right">مقدم الطلب</TableHead>
                  <TableHead className="text-right">البريد</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">التاريخ</TableHead>
                  <TableHead className="text-right">الأنظمة</TableHead>
                  <TableHead className="text-right">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(dsrList as any[]).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                      <FileKey className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="font-medium">لا توجد طلبات حالياً</p>
                      <p className="text-xs mt-1">يمكن إنشاء طلب جديد من زر "طلب جديد" أعلاه</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  (dsrList as any[]).map((req: any) => (
                    <TableRow key={req.id} data-testid={`row-dsr-${req.id}`} className="hover:bg-muted/40">
                      <TableCell className="font-mono text-xs font-bold">{req.requestNumber || `DSR-${String(req.id).padStart(4,'0')}`}</TableCell>
                      <TableCell>
                        <Badge variant={req.source === 'website' ? 'default' : 'secondary'} className={req.source === 'website' ? 'bg-emerald-600 text-white text-xs' : 'text-xs'}>
                          {req.source === 'website' ? '🌐 الموقع' : '🏢 داخلي'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{typeLabels[req.requestType] || req.requestType}</TableCell>
                      <TableCell className="font-medium text-sm">{req.subjectName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{req.subjectEmail || '-'}</TableCell>
                      <TableCell>
                        <Select
                          value={req.status}
                          onValueChange={(newStatus) => updateDsrStatusMutation.mutate({ id: req.id, status: newStatus })}
                          disabled={updateDsrStatusMutation.isPending}
                        >
                          <SelectTrigger className="h-7 text-xs w-36" data-testid={`select-dsr-status-${req.id}`}>
                            <SelectValue>
                              <Badge className={`${statusColors[req.status] || ''} text-xs`}>
                                {statusLabels[req.status] || req.status}
                              </Badge>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(statusLabels).map(([val, label]) => (
                              <SelectItem key={val} value={val}><span className="text-xs">{label}</span></SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(req.createdAt).toLocaleDateString('ar-SA')}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1 border-purple-300 text-purple-700 hover:bg-purple-50"
                          data-testid={`button-dsr-dispatch-${req.id}`}
                          onClick={() => {
                            setSelectedDsrForDispatch(req);
                            setDsrDispatchActionType(req.requestType || 'erasure');
                            setDsrDispatchSystems([]);
                            setIsDsrDispatchOpen(true);
                          }}
                        >
                          <Send className="w-3 h-3" />
                          إرسال
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs gap-1"
                          data-testid={`button-dsr-details-${req.id}`}
                          onClick={() => {
                            setSelectedDsrForDetail(req);
                            setIsDsrDetailOpen(true);
                          }}
                        >
                          <Eye className="w-3 h-3" />
                          تفاصيل
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* ====== Dispatch Dialog ====== */}
        <Dialog open={isDsrDispatchOpen} onOpenChange={setIsDsrDispatchOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Send className="w-5 h-5 text-purple-600" />
                إرسال الطلب للأنظمة الخارجية
              </DialogTitle>
              <DialogDescription>
                اختر الأنظمة التي تحتاج للتحقق منها وإرسال طلب {selectedDsrForDispatch ? (typeLabels[selectedDsrForDispatch.requestType] || selectedDsrForDispatch.requestType) : ''} للمعالجة
              </DialogDescription>
            </DialogHeader>

            {selectedDsrForDispatch && (
              <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1 mb-2">
                <div className="flex gap-4 flex-wrap">
                  <span><strong>الطلب:</strong> {selectedDsrForDispatch.requestNumber || `DSR-${selectedDsrForDispatch.id}`}</span>
                  <span><strong>صاحب البيانات:</strong> {selectedDsrForDispatch.subjectName}</span>
                  <span><strong>النوع:</strong> {typeLabels[selectedDsrForDispatch.requestType] || selectedDsrForDispatch.requestType}</span>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <Label>نوع الإجراء المطلوب</Label>
              <Select value={dsrDispatchActionType} onValueChange={setDsrDispatchActionType}>
                <SelectTrigger data-testid="select-dispatch-action-type">
                  <SelectValue placeholder="اختر نوع الإجراء" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="erasure">حذف البيانات</SelectItem>
                  <SelectItem value="access">تقرير البيانات المخزنة</SelectItem>
                  <SelectItem value="restriction">تقييد معالجة البيانات</SelectItem>
                  <SelectItem value="portability">تصدير البيانات</SelectItem>
                  <SelectItem value="rectification">تصحيح البيانات</SelectItem>
                  <SelectItem value="notify">إشعار بالطلب</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Server className="w-4 h-4" />
                الأنظمة الخارجية المتاحة
              </Label>
              {externalSystemsList.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground border rounded-lg bg-muted/30">
                  <Server className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">لا توجد أنظمة خارجية مسجّلة</p>
                  <p className="text-xs mt-1">يمكنك إضافة الأنظمة الخارجية من إعدادات التكاملات</p>
                </div>
              ) : (
                <div className="max-h-52 overflow-y-auto space-y-2 border rounded-lg p-2">
                  {externalSystemsList.map((sys: any) => {
                    const isSelected = dsrDispatchSystems.some((s: any) => s.systemName === (sys.name || sys.systemName));
                    return (
                      <div
                        key={sys.id}
                        className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors ${isSelected ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' : 'hover:bg-muted/50'}`}
                        onClick={() => {
                          const sysEntry = { systemId: sys.id, systemName: sys.name || sys.systemName, systemType: sys.type || sys.systemType || 'external', apiEndpoint: sys.apiUrl || sys.apiEndpoint || '' };
                          if (isSelected) {
                            setDsrDispatchSystems(prev => prev.filter((s: any) => s.systemName !== sysEntry.systemName));
                          } else {
                            setDsrDispatchSystems(prev => [...prev, sysEntry]);
                          }
                        }}
                        data-testid={`checkbox-dispatch-system-${sys.id}`}
                      >
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-purple-600 border-purple-600' : 'border-gray-300'}`}>
                          {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{sys.name || sys.systemName}</p>
                          <p className="text-xs text-muted-foreground truncate">{sys.type || sys.systemType || 'نظام خارجي'}{sys.apiUrl ? ` — ${sys.apiUrl}` : ''}</p>
                        </div>
                        <Badge variant="outline" className="text-xs flex-shrink-0">
                          {sys.status === 'active' ? '✅ نشط' : sys.status === 'inactive' ? '⏸ معطّل' : '—'}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
              {dsrDispatchSystems.length > 0 && (
                <p className="text-xs text-purple-600 font-medium">تم اختيار {dsrDispatchSystems.length} نظام</p>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setIsDsrDispatchOpen(false)}>إلغاء</Button>
              <Button
                disabled={dsrDispatchSystems.length === 0 || !dsrDispatchActionType || dispatchDsrMutation.isPending}
                onClick={() => {
                  if (!selectedDsrForDispatch) return;
                  dispatchDsrMutation.mutate({ dsrId: selectedDsrForDispatch.id, systems: dsrDispatchSystems, actionType: dsrDispatchActionType });
                }}
                className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
                data-testid="button-confirm-dispatch"
              >
                {dispatchDsrMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />جاري الإرسال...</>
                ) : (
                  <><Send className="w-4 h-4" />إرسال للأنظمة المحددة</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ====== DSR Detail Dialog with System Actions ====== */}
        <Dialog open={isDsrDetailOpen} onOpenChange={(open) => { setIsDsrDetailOpen(open); if (!open) setSelectedDsrForDetail(null); }}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileKey className="w-5 h-5 hub-stat-gold" />
                تفاصيل الطلب — {selectedDsrForDetail?.requestNumber || (selectedDsrForDetail ? `DSR-${selectedDsrForDetail.id}` : '')}
              </DialogTitle>
            </DialogHeader>

            {selectedDsrForDetail && (
              <div className="space-y-5">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    { label: 'رقم الطلب', value: selectedDsrForDetail.requestNumber || `DSR-${selectedDsrForDetail.id}` },
                    { label: 'صاحب البيانات', value: selectedDsrForDetail.subjectName },
                    { label: 'البريد الإلكتروني', value: selectedDsrForDetail.subjectEmail || '—' },
                    { label: 'الجوال', value: selectedDsrForDetail.subjectPhone || '—' },
                    { label: 'رقم الهوية', value: selectedDsrForDetail.subjectIdNumber || '—' },
                    { label: 'نوع الطلب', value: typeLabels[selectedDsrForDetail.requestType] || selectedDsrForDetail.requestType },
                    { label: 'المصدر', value: selectedDsrForDetail.source === 'website' ? 'الموقع الإلكتروني' : 'داخلي' },
                    { label: 'الحالة', value: statusLabels[selectedDsrForDetail.status] || selectedDsrForDetail.status },
                    { label: 'تاريخ الطلب', value: new Date(selectedDsrForDetail.createdAt).toLocaleDateString('ar-SA') },
                    { label: 'الموعد النهائي', value: selectedDsrForDetail.dueDate ? new Date(selectedDsrForDetail.dueDate).toLocaleDateString('ar-SA') : '—' },
                  ].map((item, i) => (
                    <div key={i} className="p-2 rounded bg-muted/40">
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className="font-medium mt-0.5">{item.value}</p>
                    </div>
                  ))}
                </div>
                {selectedDsrForDetail.requestDescription && (
                  <div className="p-3 rounded-lg border bg-muted/30">
                    <p className="text-xs text-muted-foreground mb-1">وصف الطلب</p>
                    <p className="text-sm">{selectedDsrForDetail.requestDescription}</p>
                  </div>
                )}

                {/* System Actions Section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold flex items-center gap-2 text-sm">
                      <Server className="w-4 h-4 text-purple-600" />
                      إجراءات الأنظمة الخارجية
                      {dsrDetailActions.length > 0 && <Badge variant="outline">{dsrDetailActions.length}</Badge>}
                    </h3>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1 border-purple-300 text-purple-700"
                      onClick={() => { setIsDsrDetailOpen(false); setSelectedDsrForDispatch(selectedDsrForDetail); setDsrDispatchActionType(selectedDsrForDetail.requestType || 'erasure'); setDsrDispatchSystems([]); setIsDsrDispatchOpen(true); }}
                    >
                      <Send className="w-3 h-3" />
                      إرسال لنظام إضافي
                    </Button>
                  </div>

                  {dsrDetailActions.length === 0 ? (
                    <div className="text-center py-6 border rounded-lg bg-muted/30 text-muted-foreground">
                      <Server className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">لم يُرسَل الطلب لأي نظام خارجي بعد</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {dsrDetailActions.map((action: any) => (
                        <div key={action.id} className="border rounded-lg p-3 space-y-2">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <Server className="w-4 h-4 text-muted-foreground" />
                              <span className="font-medium text-sm">{action.systemName}</span>
                              {action.systemType && <Badge variant="outline" className="text-xs">{action.systemType}</Badge>}
                            </div>
                            <Badge className={`text-xs ${actionStatusColors[action.status] || ''}`}>
                              {actionStatusLabels[action.status] || action.status}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                            <span>الإجراء: {action.actionType}</span>
                            <span>تاريخ الإرسال: {action.requestSentAt ? new Date(action.requestSentAt).toLocaleDateString('ar-SA') : '—'}</span>
                            {action.responseCode && <span>رمز الاستجابة: {action.responseCode}</span>}
                          </div>

                          {action.errorMessage && (
                            <div className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 rounded p-2">
                              ⚠️ {action.errorMessage}
                            </div>
                          )}
                          {action.notes && (
                            <div className="text-xs text-muted-foreground bg-muted/40 rounded p-2">{action.notes}</div>
                          )}

                          {/* Status update controls */}
                          <div className="flex gap-2 pt-1">
                            {['acknowledged', 'completed', 'not_found', 'not_applicable', 'failed'].filter(s => s !== action.status).map(nextStatus => (
                              <Button
                                key={nextStatus}
                                size="sm"
                                variant="outline"
                                className="h-6 text-xs px-2"
                                disabled={updateDsrActionMutation.isPending}
                                onClick={() => updateDsrActionMutation.mutate({ dsrId: selectedDsrForDetail.id, actionId: action.id, status: nextStatus })}
                                data-testid={`button-action-status-${action.id}-${nextStatus}`}
                              >
                                {actionStatusLabels[nextStatus]}
                              </Button>
                            ))}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-xs px-2 text-red-600 hover:text-red-700 mr-auto"
                              disabled={deleteDsrActionMutation.isPending}
                              onClick={() => deleteDsrActionMutation.mutate({ dsrId: selectedDsrForDetail.id, actionId: action.id })}
                            >
                              حذف
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDsrDetailOpen(false)}>إغلاق</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* DSR Create Dialog */}
        <Dialog open={isDsrCreateOpen} onOpenChange={setIsDsrCreateOpen}>
          <DialogContent className="max-w-lg" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileKey className="w-5 h-5" />
                طلب جديد لصاحب بيانات
              </DialogTitle>
              <DialogDescription>تسجيل طلب خصوصية جديد وفق نظام حماية البيانات الشخصية (PDPL)</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <Label>نوع الطلب *</Label>
                <Select value={dsrForm.requestType} onValueChange={v => setDsrForm({...dsrForm, requestType: v})}>
                  <SelectTrigger data-testid="select-dsr-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="access">الاطلاع على البيانات</SelectItem>
                    <SelectItem value="rectification">تصحيح البيانات</SelectItem>
                    <SelectItem value="erasure">حذف البيانات</SelectItem>
                    <SelectItem value="portability">نقل البيانات</SelectItem>
                    <SelectItem value="restriction">تقييد المعالجة</SelectItem>
                    <SelectItem value="objection">الاعتراض</SelectItem>
                    <SelectItem value="other">أخرى</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>اسم صاحب البيانات *</Label>
                <Input value={dsrForm.subjectName} onChange={e => setDsrForm({...dsrForm, subjectName: e.target.value})} placeholder="الاسم الكامل" data-testid="input-dsr-name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>البريد الإلكتروني</Label>
                  <Input value={dsrForm.subjectEmail} onChange={e => setDsrForm({...dsrForm, subjectEmail: e.target.value})} placeholder="email@example.com" dir="ltr" data-testid="input-dsr-email" />
                </div>
                <div>
                  <Label>رقم الهاتف</Label>
                  <Input value={dsrForm.subjectPhone} onChange={e => setDsrForm({...dsrForm, subjectPhone: e.target.value})} placeholder="05xxxxxxxx" dir="ltr" data-testid="input-dsr-phone" />
                </div>
              </div>
              <div>
                <Label>رقم الهوية / الإقامة</Label>
                <Input value={dsrForm.subjectIdNumber} onChange={e => setDsrForm({...dsrForm, subjectIdNumber: e.target.value})} placeholder="10 أرقام" dir="ltr" data-testid="input-dsr-id" />
              </div>
              <div>
                <Label>الأولوية</Label>
                <Select value={dsrForm.priority} onValueChange={v => setDsrForm({...dsrForm, priority: v})}>
                  <SelectTrigger data-testid="select-dsr-priority"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">منخفضة</SelectItem>
                    <SelectItem value="normal">عادية</SelectItem>
                    <SelectItem value="high">عالية</SelectItem>
                    <SelectItem value="urgent">عاجلة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>الوصف / التفاصيل</Label>
                <Textarea value={dsrForm.description} onChange={e => setDsrForm({...dsrForm, description: e.target.value})} rows={3} placeholder="تفاصيل الطلب..." data-testid="input-dsr-description" />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setIsDsrCreateOpen(false)}>إلغاء</Button>
              <Button
                disabled={!dsrForm.subjectName.trim() || createDsrMutation.isPending}
                onClick={() => createDsrMutation.mutate(dsrForm)}
                data-testid="button-submit-dsr"
              >
                {createDsrMutation.isPending ? 'جاري الإنشاء...' : 'تسجيل الطلب'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  };

  const renderDataFlowMapping = () => {
    const sensitivityColors: Record<string, string> = {
      public: 'bg-green-100 text-green-800',
      internal: 'bg-blue-100 text-blue-800',
      confidential: 'bg-yellow-100 text-yellow-800',
      restricted: 'bg-red-100 text-red-800',
    };
    const sensitivityLabels: Record<string, string> = { public: 'عام', restricted: 'مقيد', confidential: 'سري', top_secret: 'سري للغاية' };
    const frequencyLabels: Record<string, string> = { realtime: 'فوري', hourly: 'كل ساعة', daily: 'يومي', weekly: 'أسبوعي', monthly: 'شهري', ondemand: 'عند الطلب' };

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-bold">تخطيط تدفق البيانات</h2>
            <p className="text-muted-foreground text-sm mt-1">خريطة تدفقات البيانات بين الأنظمة — PDPL / NDMO</p>
          </div>
          <Button className="btn-gold" data-testid="button-add-flow-mapping" onClick={() => setIsAddFlowMappingOpen(true)}>
            <Plus className="w-4 h-4 ml-2" />
            إضافة خريطة تدفق
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20"><ArrowLeftRight className="w-5 h-5 hub-stat-gold" /></div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي التدفقات</p>
                <p className="text-2xl font-bold">{(dataFlowMappings as any[]).length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20"><ShieldAlert className="w-5 h-5 text-yellow-400" /></div>
              <div>
                <p className="text-sm text-muted-foreground">تدفقات سرية/مقيّدة</p>
                <p className="text-2xl font-bold">{(dataFlowMappings as any[]).filter((f: any) => f.sensitivity === 'confidential' || f.sensitivity === 'restricted').length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20"><Activity className="w-5 h-5 text-emerald-400" /></div>
              <div>
                <p className="text-sm text-muted-foreground">تدفقات فورية</p>
                <p className="text-2xl font-bold">{(dataFlowMappings as any[]).filter((f: any) => f.frequency === 'realtime').length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-0">
            {(dataFlowMappings as any[]).length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <ArrowLeftRight className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">لا توجد خرائط تدفق بيانات بعد</p>
                <p className="text-sm mt-2">أضف أول خريطة تدفق لتوثيق انتقال البيانات بين الأنظمة</p>
                <Button className="btn-gold mt-4" onClick={() => setIsAddFlowMappingOpen(true)} data-testid="button-add-first-flow">
                  <Plus className="w-4 h-4 ml-2" />
                  إضافة خريطة تدفق
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">النظام المصدر</TableHead>
                    <TableHead className="text-right">النظام الهدف</TableHead>
                    <TableHead className="text-right">فئة البيانات</TableHead>
                    <TableHead className="text-right">طريقة النقل</TableHead>
                    <TableHead className="text-right">التكرار</TableHead>
                    <TableHead className="text-right">مستوى الحساسية</TableHead>
                    <TableHead className="text-right">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(dataFlowMappings as any[]).map((flow: any, idx: number) => {
                    const meta = flow.transformationRules || {};
                    const sourceSystem = meta.sourceSystem || flow.flowName?.split(' → ')[0] || '—';
                    const targetSystem = meta.targetSystem || flow.flowName?.split(' → ')[1] || '—';
                    const sensitivity = meta.sensitivity || flow.sensitivity || '';
                    return (
                    <TableRow key={flow.id || idx} data-testid={`row-flow-${flow.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="font-medium">{sourceSystem}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-blue-500" />
                          <span className="font-medium">{targetSystem}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{meta.dataCategory || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{flow.flowType || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{frequencyLabels[flow.frequency] || flow.frequency || '—'}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${sensitivityColors[sensitivity] || 'bg-gray-100 text-gray-700'}`}>
                          {sensitivityLabels[sensitivity] || sensitivity || '—'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" data-testid={`button-view-flow-${flow.id}`} onClick={() => setDetailDialog({ open: true, title: 'تفاصيل تدفق البيانات', content: [
                            { label: 'اسم التدفق', value: flow.flowName || '—' },
                            { label: 'النظام المصدر', value: sourceSystem },
                            { label: 'النظام الهدف', value: targetSystem },
                            { label: 'فئة البيانات', value: meta.dataCategory || '—' },
                            { label: 'نوع التدفق', value: flow.flowType || '—' },
                            { label: 'التكرار', value: frequencyLabels[flow.frequency] || flow.frequency || '—' },
                            { label: 'مستوى الحساسية', value: sensitivityLabels[sensitivity] || sensitivity || '—' },
                            { label: 'الغرض', value: meta.purpose || '—' },
                            { label: 'الأساس القانوني', value: meta.legalBasis || '—' },
                          ]})}>
                            <Eye className="w-3 h-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" data-testid={`button-delete-flow-${flow.id}`} onClick={() => { if (confirm('هل أنت متأكد من حذف هذا التدفق؟')) deleteFlowMappingMutation.mutate(flow.id); }}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={isAddFlowMappingOpen} onOpenChange={(open) => { setIsAddFlowMappingOpen(open); if (!open) setSuccessFlowMapping(null); }}>
          <DialogContent className="max-w-lg" dir="rtl">
            <DialogHeader>
              <DialogTitle>{successFlowMapping ? 'تم توثيق التدفق' : 'إضافة خريطة تدفق بيانات'}</DialogTitle>
            </DialogHeader>
            {successFlowMapping ? (
              <FormSuccessPanel
                title="تم توثيق تدفق البيانات بنجاح!"
                subtitle={`${successFlowMapping.source} ← ${successFlowMapping.target}`}
                referenceNumber={`DFM-${String(successFlowMapping.id).padStart(4, '0')}`}
                referenceLabel="رقم التدفق"
                nextSteps={[
                  { title: "مراجعة خريطة التدفق", description: "سيراجع مشرف البيانات التدفق للتأكد من صحة المعلومات والتصنيف" },
                  { title: "تقييم المخاطر", description: "إذا كانت البيانات حساسة سيُجرى تقييم لمخاطر الخصوصية (DPIA)" },
                  { title: "توثيق في سجل المعالجة", description: "سيُضاف التدفق إلى سجل أنشطة معالجة البيانات (ROPA) وفق PDPL" },
                ]}
                actions={[
                  {
                    label: "إضافة تدفق آخر",
                    variant: "default",
                    icon: <Plus className="w-4 h-4" />,
                    onClick: () => setSuccessFlowMapping(null),
                  },
                  {
                    label: "إغلاق",
                    variant: "outline",
                    onClick: () => { setIsAddFlowMappingOpen(false); setSuccessFlowMapping(null); },
                  },
                ]}
              />
            ) : (
            <>
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 text-sm text-blue-800 dark:text-blue-300 mb-4">
              🗺️ خريطة تدفق البيانات توثّق كيفية انتقال البيانات بين الأنظمة — مطلب أساسي في PDPL وNDMO.
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>النظام المصدر *</Label>
                  <Input placeholder="مثال: SAP ERP" value={flowMappingForm.sourceSystem} onChange={e => setFlowMappingForm(f => ({ ...f, sourceSystem: e.target.value }))} data-testid="input-flow-source" />
                  <FieldHint>النظام الذي تنشأ منه البيانات أو يُصدرها.</FieldHint>
                </div>
                <div>
                  <Label>النظام الهدف *</Label>
                  <Input placeholder="مثال: Data Warehouse" value={flowMappingForm.targetSystem} onChange={e => setFlowMappingForm(f => ({ ...f, targetSystem: e.target.value }))} data-testid="input-flow-target" />
                  <FieldHint>النظام الذي تصل إليه البيانات أو يستقبلها.</FieldHint>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>فئة البيانات</Label>
                  <Input placeholder="مثال: بيانات الموظفين، سجلات العمليات" value={flowMappingForm.dataCategory} onChange={e => setFlowMappingForm(f => ({ ...f, dataCategory: e.target.value }))} data-testid="input-flow-category" />
                </div>
                <div>
                  <Label>طريقة النقل</Label>
                  <Input placeholder="مثال: API REST / ETL / SFTP" value={flowMappingForm.transferMethod} onChange={e => setFlowMappingForm(f => ({ ...f, transferMethod: e.target.value }))} data-testid="input-flow-method" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>تكرار نقل البيانات</Label>
                  <Select value={flowMappingForm.frequency} onValueChange={v => setFlowMappingForm(f => ({ ...f, frequency: v }))}>
                    <SelectTrigger data-testid="select-flow-frequency"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="realtime">⚡ فوري (Real-time)</SelectItem>
                      <SelectItem value="hourly">🕐 كل ساعة</SelectItem>
                      <SelectItem value="daily">📅 يومي</SelectItem>
                      <SelectItem value="weekly">📆 أسبوعي</SelectItem>
                      <SelectItem value="monthly">🗓️ شهري</SelectItem>
                      <SelectItem value="ondemand">🔔 عند الطلب</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>تصنيف حساسية البيانات</Label>
                  <Select value={flowMappingForm.sensitivity} onValueChange={v => setFlowMappingForm(f => ({ ...f, sensitivity: v }))}>
                    <SelectTrigger data-testid="select-flow-sensitivity"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">🌐 عام — متاح للجميع</SelectItem>
                      <SelectItem value="restricted">🔒 مقيد — وصول محدود</SelectItem>
                      <SelectItem value="confidential">🛡️ سري — للمختصين</SelectItem>
                      <SelectItem value="top_secret">🚫 سري للغاية — عدد محدود جداً</SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldHint>تصنيف البيانات وفق سياسة NDMO.</FieldHint>
                </div>
              </div>
              <div>
                <Label>الغرض من التدفق</Label>
                <Textarea rows={2} placeholder="مثال: مزامنة بيانات الموظفين لأغراض إعداد التقارير المالية الشهرية" value={flowMappingForm.purpose} onChange={e => setFlowMappingForm(f => ({ ...f, purpose: e.target.value }))} data-testid="textarea-flow-purpose" />
                <FieldHint>وضح الغرض التجاري من هذا التدفق بشكل محدد.</FieldHint>
              </div>
              <div>
                <Label>الأساس القانوني (PDPL)</Label>
                <Input placeholder="مثال: عقد عمل / موافقة صريحة / مصلحة مشروعة / التزام قانوني" value={flowMappingForm.legalBasis} onChange={e => setFlowMappingForm(f => ({ ...f, legalBasis: e.target.value }))} data-testid="input-flow-legal" />
                <FieldHint>مطلوب وفق PDPL — ما المسوّغ القانوني لمعالجة هذه البيانات؟</FieldHint>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddFlowMappingOpen(false)} data-testid="button-cancel-flow">إلغاء</Button>
              <Button className="btn-gold" disabled={!flowMappingForm.sourceSystem.trim() || !flowMappingForm.targetSystem.trim() || createFlowMappingMutation.isPending} onClick={() => createFlowMappingMutation.mutate({ flowName: `${flowMappingForm.sourceSystem} → ${flowMappingForm.targetSystem}`, flowNameAr: `${flowMappingForm.sourceSystem} إلى ${flowMappingForm.targetSystem}`, flowType: flowMappingForm.transferMethod || 'batch', frequency: flowMappingForm.frequency, transformationRules: { sourceSystem: flowMappingForm.sourceSystem, targetSystem: flowMappingForm.targetSystem, dataCategory: flowMappingForm.dataCategory, sensitivity: flowMappingForm.sensitivity, purpose: flowMappingForm.purpose, legalBasis: flowMappingForm.legalBasis } })} data-testid="button-confirm-flow">
                {createFlowMappingMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Plus className="w-4 h-4 ml-1" />}
                توثيق التدفق
              </Button>
            </DialogFooter>
            </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  };

  const renderIncidents = () => {
    const incidentStatusLabels: Record<string, string> = { open: 'مفتوح', investigating: 'قيد التحقيق', contained: 'محتوى', resolved: 'تم الحل', closed: 'مغلق' };
    const incidentStatusColors: Record<string, string> = { open: 'bg-red-600', investigating: 'bg-yellow-600', contained: 'bg-blue-600', resolved: 'hub-badge-gold-solid', closed: 'bg-muted-foreground' };
    const severityLabels: Record<string, string> = { critical: 'حرج', high: 'عالي', medium: 'متوسط', low: 'منخفض' };
    const openCount = securityIncidentsList.filter((i: any) => i.status === 'open' || i.status === 'investigating').length;
    const resolvedCount = securityIncidentsList.filter((i: any) => i.status === 'resolved' || i.status === 'closed').length;
    const criticalCount = securityIncidentsList.filter((i: any) => i.severity === 'critical').length;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-2xl font-bold" data-testid="text-incidents-title">مركز حوادث البيانات والخصوصية</h2>
          <Button className="btn-gold" data-testid="button-add-incident" onClick={() => setIsAddIncidentOpen(true)}>
            <Plus className="w-4 h-4 ml-2" />
            حادثة بيانات جديدة
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="card-premium">
            <CardContent className="p-6 text-center">
              <ShieldAlert className="w-8 h-8 mx-auto mb-2 text-red-500" />
              <p className="text-2xl font-bold">{securityIncidentsList.length}</p>
              <p className="text-sm text-muted-foreground">إجمالي الحوادث</p>
            </CardContent>
          </Card>
          <Card className="card-premium">
            <CardContent className="p-6 text-center">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
              <p className="text-2xl font-bold">{openCount}</p>
              <p className="text-sm text-muted-foreground">حوادث مفتوحة</p>
            </CardContent>
          </Card>
          <Card className="card-premium">
            <CardContent className="p-6 text-center">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 hub-stat-gold" />
              <p className="text-2xl font-bold">{resolvedCount}</p>
              <p className="text-sm text-muted-foreground">تم حلها</p>
            </CardContent>
          </Card>
          <Card className="card-premium">
            <CardContent className="p-6 text-center">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-700" />
              <p className="text-2xl font-bold">{criticalCount}</p>
              <p className="text-sm text-muted-foreground">حرجة</p>
            </CardContent>
          </Card>
        </div>

        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 hub-stat-gold" />
              سجل حوادث البيانات والخصوصية
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">رقم الحادثة</TableHead>
                  <TableHead className="text-right">العنوان</TableHead>
                  <TableHead className="text-right">الخطورة</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">التاريخ</TableHead>
                  <TableHead className="text-right">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {securityIncidentsList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      <ShieldAlert className="w-10 h-10 mx-auto mb-3 opacity-50" />
                      لا توجد حوادث بيانات حالياً
                    </TableCell>
                  </TableRow>
                ) : securityIncidentsList.map((incident: any) => (
                  <TableRow key={incident.id} data-testid={`row-incident-${incident.id}`}>
                    <TableCell className="font-mono text-sm">{incident.incidentNumber || `INC-${incident.id}`}</TableCell>
                    <TableCell className="font-medium">{incident.title}</TableCell>
                    <TableCell>
                      <Badge className={incident.severity === 'critical' ? 'bg-red-700 text-white' : incident.severity === 'high' ? 'bg-red-500 text-white' : incident.severity === 'medium' ? 'bg-yellow-600 text-white' : 'bg-muted'}>
                        {severityLabels[incident.severity] || incident.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${incidentStatusColors[incident.status] || 'bg-muted'} text-white`}>
                        {incidentStatusLabels[incident.status] || incident.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{new Date(incident.createdAt).toLocaleDateString('ar-SA')}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" className="btn-icon-gold" data-testid={`button-view-incident-${incident.id}`} onClick={() => setDetailDialog({ open: true, title: 'تفاصيل حادثة البيانات', content: [{ label: 'رقم الحادثة', value: incident.incidentNumber || `INC-${incident.id}` }, { label: 'العنوان', value: incident.title }, { label: 'الخطورة', value: severityLabels[incident.severity] || incident.severity }, { label: 'الحالة', value: incidentStatusLabels[incident.status] || incident.status }, { label: 'التاريخ', value: new Date(incident.createdAt).toLocaleDateString('ar-SA') }, { label: 'الوصف', value: incident.description || '-' }, { label: 'المُبلِّغ', value: incident.reportedBy || '-' }] })}><Eye className="w-4 h-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderReportsManagement = () => {
    const criticalBreaches = breachesList.filter((b: any) => b.severity === 'critical').length;
    const highBreaches = breachesList.filter((b: any) => b.severity === 'high').length;
    const mediumBreaches = breachesList.filter((b: any) => b.severity === 'medium').length;
    const detectedBreaches = breachesList.filter((b: any) => b.status === 'detected' || b.status === 'investigating').length;

    const breachSeverityLabels: Record<string, string> = {
      critical: 'حرج', high: 'عالي', medium: 'متوسط', low: 'منخفض',
    };
    const breachStatusLabels: Record<string, string> = {
      detected: 'تم الاكتشاف', investigating: 'قيد التحقيق', contained: 'تم الاحتواء',
      resolved: 'تم الحل', reported: 'تم الإبلاغ', closed: 'مغلق',
    };

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-2xl font-bold">إدارة البلاغات وإخطارات الاختراق</h2>
          <Button className="btn-gold" data-testid="button-new-breach-report" onClick={() => setIsBreachReportOpen(true)}>
            <Plus className="w-4 h-4 ml-2" />
            بلاغ اختراق جديد
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="card-premium">
            <CardContent className="p-6 text-center">
              <FileWarning className="w-8 h-8 mx-auto mb-2 hub-stat-gold" />
              <p className="text-2xl font-bold">{breachesList.length}</p>
              <p className="text-sm text-muted-foreground">إجمالي البلاغات</p>
            </CardContent>
          </Card>
          <Card className="card-premium">
            <CardContent className="p-6 text-center">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-700" />
              <p className="text-2xl font-bold">{criticalBreaches}</p>
              <p className="text-sm text-muted-foreground">حرجة</p>
            </CardContent>
          </Card>
          <Card className="card-premium">
            <CardContent className="p-6 text-center">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-red-500" />
              <p className="text-2xl font-bold">{highBreaches}</p>
              <p className="text-sm text-muted-foreground">عالية</p>
            </CardContent>
          </Card>
          <Card className="card-premium">
            <CardContent className="p-6 text-center">
              <Clock className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
              <p className="text-2xl font-bold">{detectedBreaches}</p>
              <p className="text-sm text-muted-foreground">قيد المعالجة</p>
            </CardContent>
          </Card>
        </div>

        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileWarning className="w-5 h-5 hub-stat-gold" />
              سجل بلاغات الاختراق
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">العنوان</TableHead>
                  <TableHead className="text-right">النوع</TableHead>
                  <TableHead className="text-right">الخطورة</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">السجلات المتأثرة</TableHead>
                  <TableHead className="text-right">تاريخ الاكتشاف</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {breachesList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      <FileWarning className="w-10 h-10 mx-auto mb-3 opacity-50" />
                      لا توجد بلاغات اختراق حالياً
                    </TableCell>
                  </TableRow>
                ) : breachesList.map((breach: any) => (
                  <TableRow key={breach.id} data-testid={`row-breach-${breach.id}`}>
                    <TableCell className="font-medium">{breach.title || 'بلاغ اختراق'}</TableCell>
                    <TableCell><Badge variant="outline">{breach.breachType || '-'}</Badge></TableCell>
                    <TableCell>
                      <Badge className={breach.severity === 'critical' ? 'bg-red-700 text-white' : breach.severity === 'high' ? 'bg-red-500 text-white' : breach.severity === 'medium' ? 'bg-yellow-600 text-white' : 'bg-muted'}>
                        {breachSeverityLabels[breach.severity] || breach.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{breachStatusLabels[breach.status] || breach.status}</Badge>
                    </TableCell>
                    <TableCell>{breach.affectedRecords || '-'}</TableCell>
                    <TableCell className="text-sm">{breach.detectedAt ? new Date(breach.detectedAt).toLocaleDateString('ar-SA') : '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileWarning className="w-5 h-5 hub-stat-gold" />
              إجراءات الإخطار بالاختراق (PDPL)
            </CardTitle>
            <CardDescription>وفق المادة 20 من نظام حماية البيانات الشخصية</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { step: '1', title: 'اكتشاف الاختراق', desc: 'تحديد نوع الاختراق والبيانات المتأثرة', time: 'فوري', icon: AlertCircle },
                { step: '2', title: 'تقييم الأثر', desc: 'تقييم حجم الاختراق والمخاطر على أصحاب البيانات', time: '24 ساعة', icon: Target },
                { step: '3', title: 'إخطار الجهة المختصة', desc: 'إبلاغ الهيئة السعودية للبيانات والذكاء الاصطناعي', time: '72 ساعة', icon: Send },
                { step: '4', title: 'إخطار المتضررين', desc: 'إبلاغ أصحاب البيانات المتأثرين بالاختراق', time: '5 أيام', icon: Users },
              ].map((item, idx) => (
                <div key={idx} className="flex items-start gap-4 p-4 rounded-lg border border-border">
                  <div className="hub-icon-gold rounded-full">
                    <span className="font-bold hub-stat-gold">{item.step}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">{item.title}</h4>
                      <Badge variant="outline" className="text-xs">{item.time}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderRisks = () => {
    const riskLevels = [
      { level: 'حرج', count: risksList.filter((r: any) => r.riskLevel === 'critical').length || 1, color: 'bg-red-700' },
      { level: 'عالي', count: risksList.filter((r: any) => r.riskLevel === 'high').length || 3, color: 'bg-red-500' },
      { level: 'متوسط', count: risksList.filter((r: any) => r.riskLevel === 'medium').length || 5, color: 'bg-yellow-600' },
      { level: 'منخفض', count: risksList.filter((r: any) => r.riskLevel === 'low').length || 4, color: 'hub-badge-gold-solid' },
    ];
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-2xl font-bold">سجل المخاطر</h2>
          <Button className="btn-gold" data-testid="button-add-risk" onClick={() => setIsAddRiskOpen(true)}>
            <Plus className="w-4 h-4 ml-2" />
            إضافة خطر
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {riskLevels.map((item, idx) => (
            <Card key={idx} className="card-premium">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <Badge className={`${item.color} text-white`}>{item.level}</Badge>
                  <span className="text-2xl font-bold">{item.count}</span>
                </div>
                <Progress value={(item.count / 13) * 100} className="h-2" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 hub-stat-gold" />
              مصفوفة المخاطر
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">المخاطرة</TableHead>
                  <TableHead className="text-right">الفئة</TableHead>
                  <TableHead className="text-right">الاحتمالية</TableHead>
                  <TableHead className="text-right">الأثر</TableHead>
                  <TableHead className="text-right">المستوى</TableHead>
                  <TableHead className="text-right">إجراء التخفيف</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {risksList.length > 0 ? risksList.map((risk: any) => (
                  <TableRow key={risk.id} data-testid={`row-risk-${risk.id}`}>
                    <TableCell className="font-medium">{risk.title || risk.riskName}</TableCell>
                    <TableCell><Badge variant="outline">{risk.category || 'تشغيلي'}</Badge></TableCell>
                    <TableCell>{risk.likelihood || 'متوسط'}</TableCell>
                    <TableCell>{risk.impact || 'عالي'}</TableCell>
                    <TableCell>
                      <Badge className={risk.riskLevel === 'critical' ? 'bg-red-700 text-white' : risk.riskLevel === 'high' ? 'bg-red-500 text-white' : risk.riskLevel === 'medium' ? 'bg-yellow-600 text-white' : 'hub-badge-gold-solid'}>
                        {risk.riskLevel === 'critical' ? 'حرج' : risk.riskLevel === 'high' ? 'عالي' : risk.riskLevel === 'medium' ? 'متوسط' : 'منخفض'}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{risk.mitigationAction || risk.mitigation || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={risk.status === 'mitigated' ? 'default' : 'secondary'}>
                        {risk.status === 'mitigated' ? 'تم التخفيف' : risk.status === 'active' ? 'نشط' : 'قيد المراجعة'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-50" />
                      لا توجد مخاطر مسجلة حالياً
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderAgreements = () => {
    const agreementStatusLabels: Record<string, string> = { active: 'نشطة', pending: 'قيد المراجعة', expired: 'منتهية', draft: 'مسودة' };
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-2xl font-bold">اتفاقيات مشاركة البيانات</h2>
          <Button className="btn-gold" data-testid="button-add-agreement" onClick={() => setIsAddAgreementOpen(true)}>
            <Plus className="w-4 h-4 ml-2" />
            اتفاقية جديدة
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="card-premium">
            <CardContent className="p-6 text-center">
              <FileCheck className="w-8 h-8 mx-auto mb-2 hub-stat-gold" />
              <p className="text-2xl font-bold">{agreementsList.length}</p>
              <p className="text-sm text-muted-foreground">إجمالي الاتفاقيات</p>
            </CardContent>
          </Card>
          <Card className="card-premium">
            <CardContent className="p-6 text-center">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 hub-stat-gold" />
              <p className="text-2xl font-bold">{agreementsList.filter((a: any) => a.status === 'active').length}</p>
              <p className="text-sm text-muted-foreground">نشطة</p>
            </CardContent>
          </Card>
          <Card className="card-premium">
            <CardContent className="p-6 text-center">
              <Clock className="w-8 h-8 mx-auto mb-2 hub-stat-gold" />
              <p className="text-2xl font-bold">{agreementsList.filter((a: any) => a.status === 'pending').length}</p>
              <p className="text-sm text-muted-foreground">قيد المراجعة</p>
            </CardContent>
          </Card>
        </div>
        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="w-5 h-5 hub-stat-gold" />
              سجل الاتفاقيات
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">عنوان الاتفاقية</TableHead>
                  <TableHead className="text-right">الجهة الثانية</TableHead>
                  <TableHead className="text-right">النوع</TableHead>
                  <TableHead className="text-right">تاريخ البداية</TableHead>
                  <TableHead className="text-right">تاريخ الانتهاء</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agreementsList.length > 0 ? agreementsList.map((agreement: any) => (
                  <TableRow key={agreement.id} data-testid={`row-agreement-${agreement.id}`}>
                    <TableCell className="font-medium">{agreement.title}</TableCell>
                    <TableCell>{agreement.partyName || agreement.secondParty || '-'}</TableCell>
                    <TableCell><Badge variant="outline">{agreement.agreementType || 'مشاركة بيانات'}</Badge></TableCell>
                    <TableCell className="text-sm">{agreement.startDate ? new Date(agreement.startDate).toLocaleDateString('ar-SA') : '-'}</TableCell>
                    <TableCell className="text-sm">{agreement.endDate ? new Date(agreement.endDate).toLocaleDateString('ar-SA') : '-'}</TableCell>
                    <TableCell>
                      <Badge className={agreement.status === 'active' ? 'hub-badge-gold-solid' : agreement.status === 'expired' ? 'bg-red-500 text-white' : 'hub-badge-navy'}>
                        {agreementStatusLabels[agreement.status] || agreement.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="icon" className="btn-icon-gold" data-testid={`button-view-agreement-${agreement.id}`} onClick={() => setDetailDialog({ open: true, title: 'تفاصيل الاتفاقية', content: [{ label: 'العنوان', value: agreement.title }, { label: 'الجهة', value: agreement.partyName || agreement.secondParty || '-' }, { label: 'نوع الاتفاقية', value: agreement.agreementType || 'مشاركة بيانات' }, { label: 'تاريخ البدء', value: agreement.startDate ? new Date(agreement.startDate).toLocaleDateString('ar-SA') : '-' }, { label: 'تاريخ الانتهاء', value: agreement.endDate ? new Date(agreement.endDate).toLocaleDateString('ar-SA') : '-' }, { label: 'الحالة', value: agreementStatusLabels[agreement.status] || agreement.status }] })}><Eye className="w-4 h-4" /></Button>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      <Scale className="w-10 h-10 mx-auto mb-3 opacity-50" />
                      لا توجد اتفاقيات حالياً. أضف اتفاقية مشاركة بيانات جديدة.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderAssessment = () => {
    const assessmentDomains = [
      { domain: 'حوكمة البيانات', score: 78, total: 15, completed: 12 },
      { domain: 'جودة البيانات', score: 85, total: 12, completed: 10 },
      { domain: 'حماية البيانات', score: 92, total: 18, completed: 17 },
      { domain: 'إدارة البيانات الرئيسية', score: 65, total: 10, completed: 7 },
      { domain: 'بيانات مفتوحة', score: 45, total: 8, completed: 4 },
      { domain: 'البنية التحتية', score: 88, total: 14, completed: 12 },
    ];
    const overallScore = Math.round(assessmentDomains.reduce((a, b) => a + b.score, 0) / assessmentDomains.length);
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-2xl font-bold">محاكي التقييم الذاتي (NDMO)</h2>
          <Button className="btn-gold" data-testid="button-start-assessment" onClick={() => setIsStartAssessmentOpen(true)}>
            <ClipboardCheck className="w-4 h-4 ml-2" />
            بدء تقييم جديد
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="card-premium col-span-1 md:col-span-1">
            <CardContent className="p-6 flex flex-col items-center justify-center">
              <div className="w-36 h-36 rounded-full border-8 border-accent flex items-center justify-center mb-4">
                <div className="text-center">
                  <p className="text-4xl font-bold hub-stat-gold">{overallScore}%</p>
                  <p className="text-xs text-muted-foreground">التقييم الشامل</p>
                </div>
              </div>
              <Badge className={overallScore >= 80 ? 'hub-badge-gold-solid' : overallScore >= 60 ? 'bg-yellow-600 text-white' : 'bg-red-500 text-white'}>
                {overallScore >= 80 ? 'ممتثل' : overallScore >= 60 ? 'ممتثل جزئياً' : 'غير ممتثل'}
              </Badge>
            </CardContent>
          </Card>
          <Card className="card-premium col-span-1 md:col-span-2">
            <CardHeader>
              <CardTitle>نتائج التقييم حسب النطاق</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {assessmentDomains.map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{item.domain}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{item.completed}/{item.total} متطلب</span>
                        <span className="font-bold">{item.score}%</span>
                      </div>
                    </div>
                    <Progress value={item.score} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        <Card className="card-premium">
          <CardHeader>
            <CardTitle>توصيات التحسين</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { title: 'تحسين سياسات البيانات المفتوحة', priority: 'عالية', domain: 'بيانات مفتوحة' },
                { title: 'تطوير إطار إدارة البيانات الرئيسية', priority: 'عالية', domain: 'إدارة البيانات الرئيسية' },
                { title: 'تحديث سياسة تصنيف البيانات', priority: 'متوسطة', domain: 'حوكمة البيانات' },
              ].map((rec, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5 hub-stat-gold" />
                    <div>
                      <p className="font-medium">{rec.title}</p>
                      <p className="text-xs text-muted-foreground">{rec.domain}</p>
                    </div>
                  </div>
                  <Badge variant="outline">{rec.priority}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderPerformance = () => {
    const deptPerformance = [
      { dept: 'إدارة السباقات', compliance: 92, quality: 88, tasks: 15, completed: 13 },
      { dept: 'إدارة العضوية', compliance: 85, quality: 90, tasks: 12, completed: 10 },
      { dept: 'الشؤون المالية', compliance: 78, quality: 82, tasks: 18, completed: 12 },
      { dept: 'تقنية المعلومات', compliance: 95, quality: 93, tasks: 20, completed: 19 },
      { dept: 'الموارد البشرية', compliance: 70, quality: 75, tasks: 10, completed: 7 },
      { dept: 'الشؤون القانونية', compliance: 88, quality: 85, tasks: 8, completed: 7 },
    ];
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-2xl font-bold">مؤشرات أداء الإدارات</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" data-testid="button-export-perf-pdf" onClick={() => { exportToPDF({ data: deptPerformance.map(d => ({ dept: d.dept, compliance: `${d.compliance}%`, quality: `${d.quality}%`, tasks: `${d.completed}/${d.tasks}` })), columns: [{ header: 'الإدارة', key: 'dept' }, { header: 'الامتثال', key: 'compliance' }, { header: 'الجودة', key: 'quality' }, { header: 'المهام', key: 'tasks' }], title: 'تقرير أداء الإدارات', filename: 'dept-performance', orientation: 'landscape' }); }}>
              <FileDown className="w-4 h-4 ml-2" />
              PDF
            </Button>
            <Button variant="outline" size="sm" data-testid="button-export-perf-excel" onClick={() => { exportToExcel({ data: deptPerformance.map(d => ({ dept: d.dept, compliance: `${d.compliance}%`, quality: `${d.quality}%`, tasks: `${d.completed}/${d.tasks}` })), columns: [{ header: 'الإدارة', key: 'dept' }, { header: 'الامتثال', key: 'compliance' }, { header: 'الجودة', key: 'quality' }, { header: 'المهام', key: 'tasks' }], title: 'تقرير أداء الإدارات', filename: 'dept-performance' }); }}>
              <FileSpreadsheet className="w-4 h-4 ml-2" />
              Excel
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="card-premium">
            <CardContent className="p-6 text-center">
              <Target className="w-8 h-8 mx-auto mb-2 hub-stat-gold" />
              <p className="text-2xl font-bold">{Math.round(deptPerformance.reduce((a, b) => a + b.compliance, 0) / deptPerformance.length)}%</p>
              <p className="text-sm text-muted-foreground">متوسط الامتثال</p>
            </CardContent>
          </Card>
          <Card className="card-premium">
            <CardContent className="p-6 text-center">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 hub-stat-gold" />
              <p className="text-2xl font-bold">{Math.round(deptPerformance.reduce((a, b) => a + b.quality, 0) / deptPerformance.length)}%</p>
              <p className="text-sm text-muted-foreground">متوسط الجودة</p>
            </CardContent>
          </Card>
          <Card className="card-premium">
            <CardContent className="p-6 text-center">
              <ListChecks className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-2xl font-bold">{deptPerformance.reduce((a, b) => a + b.completed, 0)}</p>
              <p className="text-sm text-muted-foreground">مهام مكتملة</p>
            </CardContent>
          </Card>
          <Card className="card-premium">
            <CardContent className="p-6 text-center">
              <Building2 className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-2xl font-bold">{deptPerformance.length}</p>
              <p className="text-sm text-muted-foreground">إدارات</p>
            </CardContent>
          </Card>
        </div>
        <Card className="card-premium">
          <CardHeader>
            <CardTitle>أداء الإدارات</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الإدارة</TableHead>
                  <TableHead className="text-right">نسبة الامتثال</TableHead>
                  <TableHead className="text-right">جودة البيانات</TableHead>
                  <TableHead className="text-right">المهام المكتملة</TableHead>
                  <TableHead className="text-right">التقييم</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deptPerformance.map((dept, idx) => (
                  <TableRow key={idx} data-testid={`row-dept-perf-${idx}`}>
                    <TableCell className="font-medium">{dept.dept}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={dept.compliance} className="w-20 h-2" />
                        <span className="text-sm">{dept.compliance}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={dept.quality} className="w-20 h-2" />
                        <span className="text-sm">{dept.quality}%</span>
                      </div>
                    </TableCell>
                    <TableCell>{dept.completed}/{dept.tasks}</TableCell>
                    <TableCell>
                      <Badge className={dept.compliance >= 90 ? 'hub-badge-gold-solid' : dept.compliance >= 70 ? 'bg-yellow-600 text-white' : 'bg-red-500 text-white'}>
                        {dept.compliance >= 90 ? 'ممتاز' : dept.compliance >= 70 ? 'جيد' : 'يحتاج تحسين'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderReportsCenter = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold">مركز التقارير والتحليلات</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title: 'تقرير الامتثال الشامل', desc: 'تقرير شامل عن حالة الامتثال لمعايير NDMO', icon: BarChart3, ready: true, action: () => { window.open('/api/export/compliance-report', '_blank'); toast({ title: 'جاري تصدير تقرير الامتثال...' }); } },
          { title: 'تقرير جودة البيانات', desc: 'تحليل مؤشرات جودة البيانات عبر الأنظمة', icon: PieChart, ready: true, action: () => { handleExportPDF(); toast({ title: 'جاري إنشاء تقرير الجودة...' }); } },
          { title: 'تقرير المخاطر', desc: 'مصفوفة المخاطر وإجراءات التخفيف', icon: AlertTriangle, ready: true, action: () => {
            const riskData = risksList.map((r: any) => ({
              title: r.title || r.name || 'مخاطرة',
              level: r.riskLevel || r.level || 'متوسط',
              status: r.status || 'مفتوح',
              owner: r.owner || '-',
              mitigation: r.mitigationPlan || r.mitigation || '-',
            }));
            exportToPDF({
              title: 'تقرير مصفوفة المخاطر - JCSA',
              data: riskData,
              columns: [{ header: 'المخاطرة', key: 'title' }, { header: 'المستوى', key: 'level' }, { header: 'الحالة', key: 'status' }, { header: 'المسؤول', key: 'owner' }, { header: 'خطة التخفيف', key: 'mitigation' }],
              filename: 'risk-matrix-report',
              orientation: 'landscape',
            });
            toast({ title: 'تم تصدير تقرير المخاطر بنجاح' });
          } },
          { title: 'تقرير الأصول البيانية', desc: 'جرد شامل للأصول البيانية وتصنيفاتها', icon: Database, ready: true, action: () => handleExportExcel() },
          { title: 'تقرير DSR', desc: 'طلبات أصحاب البيانات وأوقات الاستجابة', icon: FileKey, ready: true, action: () => {
            const dsrData = dsrList.map((r: any) => ({
              id: r.id || '-',
              type: r.requestType || r.type || '-',
              status: r.status || '-',
              subject: r.dataSubjectName || r.subject || '-',
              submitted: r.submittedAt ? new Date(r.submittedAt).toLocaleDateString('ar-SA') : '-',
              deadline: r.deadline ? new Date(r.deadline).toLocaleDateString('ar-SA') : '-',
            }));
            exportToExcel({
              title: 'تقرير طلبات أصحاب البيانات (DSR)',
              data: dsrData,
              columns: [{ header: '#', key: 'id' }, { header: 'النوع', key: 'type' }, { header: 'الحالة', key: 'status' }, { header: 'صاحب البيانات', key: 'subject' }, { header: 'تاريخ التقديم', key: 'submitted' }, { header: 'الموعد النهائي', key: 'deadline' }],
              filename: 'dsr-report',
            });
            toast({ title: 'تم تصدير تقرير DSR بنجاح' });
          } },
          { title: 'تقرير أداء الإدارات', desc: 'مؤشرات أداء الإدارات في حوكمة البيانات', icon: TrendingUp, ready: true, action: () => {
            const perfData = [
              { dept: 'إدارة السباقات', compliance: '92%', quality: '88%', tasks: '13/15' },
              { dept: 'إدارة العضوية', compliance: '85%', quality: '90%', tasks: '10/12' },
              { dept: 'الشؤون المالية', compliance: '78%', quality: '82%', tasks: '12/18' },
              { dept: 'تقنية المعلومات', compliance: '95%', quality: '93%', tasks: '19/20' },
              { dept: 'الموارد البشرية', compliance: '70%', quality: '75%', tasks: '7/10' },
              { dept: 'الشؤون القانونية', compliance: '88%', quality: '85%', tasks: '7/8' },
            ];
            exportToPDF({
              title: 'تقرير أداء الإدارات في حوكمة البيانات',
              data: perfData,
              columns: [{ header: 'الإدارة', key: 'dept' }, { header: 'الامتثال', key: 'compliance' }, { header: 'جودة البيانات', key: 'quality' }, { header: 'المهام المنجزة', key: 'tasks' }],
              filename: 'dept-governance-performance',
              orientation: 'landscape',
            });
            toast({ title: 'تم تصدير تقرير الأداء بنجاح' });
          } },
        ].map((report, idx) => (
          <Card key={idx} className={`card-premium ${report.ready ? 'cursor-pointer' : 'opacity-70 cursor-not-allowed'}`} onClick={report.ready ? report.action : undefined} data-testid={`card-report-${idx}`}>
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="hub-icon-gold flex-shrink-0">
                  <report.icon className="w-6 h-6 hub-stat-gold" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{report.title}</h3>
                    {!report.ready && <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">قريباً</span>}
                  </div>
                  <p className="text-sm text-muted-foreground">{report.desc}</p>
                </div>
              </div>
              {report.ready && (
                <div className="flex items-center justify-end mt-4 gap-2">
                  <Button variant="outline" size="sm" data-testid={`button-download-report-${idx}`} onClick={e => { e.stopPropagation(); report.action(); }}>
                    <Download className="w-4 h-4 ml-1" />
                    تحميل
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderNotifications = () => {
    const notifications = notificationsData;
    const typeIcons: Record<string, any> = { update: Activity, request: FileKey, task: ClipboardList, meeting: Calendar, evidence: FolderOpen, risk: AlertTriangle, ticket: FileText, compliance: Shield, sla: Clock, alert: AlertCircle };
    const unreadCount = notifications.filter((n: any) => !n.isRead).length;
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">الإشعارات</h2>
            {unreadCount > 0 && <Badge className="hub-badge-gold-solid text-foreground">{unreadCount} جديد</Badge>}
          </div>
          <Button variant="outline" size="sm" data-testid="button-mark-all-read" disabled={markAllReadMutation.isPending || unreadCount === 0} onClick={() => markAllReadMutation.mutate()}>
            <CheckSquare className="w-4 h-4 ml-2" />
            تحديد الكل كمقروء
          </Button>
        </div>
        <Card className="card-premium">
          <CardContent className="p-0">
            <div className="divide-y">
              {notifications.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">لا توجد إشعارات</p>
                </div>
              )}
              {notifications.map((notif: any) => {
                const NotifIcon = typeIcons[notif.type] || Bell;
                const timeAgo = notif.createdAt ? new Date(notif.createdAt).toLocaleDateString('ar-SA') : '';
                return (
                  <div key={notif.id} className={`flex items-start gap-4 p-4 ${!notif.isRead ? 'bg-accent/5' : ''}`} data-testid={`notification-${notif.id}`}>
                    <div className={`p-2 rounded-lg flex-shrink-0 ${!notif.isRead ? 'bg-accent/20' : 'bg-muted/50'}`}>
                      <NotifIcon className={`w-5 h-5 ${!notif.isRead ? 'hub-stat-gold' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`font-medium ${!notif.isRead ? '' : 'text-muted-foreground'}`}>{notif.title}</p>
                        {!notif.isRead && <div className="w-2 h-2 rounded-full bg-accent rounded-full" />}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{notif.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">{timeAgo}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderTeams = () => {
    const teams = stewardsList.map((s: any) => ({
      name: s.department || s.specialization || 'فريق البيانات',
      lead: s.displayName || s.name || s.username || 'غير محدد',
      members: 1,
      role: s.roleInDMO || 'ممثل بيانات',
      status: s.isActive !== false ? 'active' : 'inactive',
    }));
    const roles = [
      { role: 'مالك البيانات (Data Owner)', desc: 'مسؤول عن تحديد سياسات البيانات والموافقة على الوصول', permissions: ['قراءة', 'كتابة', 'إدارة', 'موافقة'] },
      { role: 'ممثل البيانات (Data Steward)', desc: 'مسؤول عن جودة البيانات وتطبيق السياسات', permissions: ['قراءة', 'كتابة', 'تقارير'] },
      { role: 'أمين البيانات (Data Custodian)', desc: 'مسؤول عن الحماية التقنية وإدارة الوصول', permissions: ['قراءة', 'إدارة تقنية'] },
    ];
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">إدارة الفرق والصلاحيات</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {teams.length > 0 ? teams.map((team, idx) => (
            <Card key={idx} className="card-premium" data-testid={`card-team-${idx}`}>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="hub-icon-gold">
                    <Users className="w-5 h-5 hub-stat-gold" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{team.name}</h3>
                    <p className="text-xs text-muted-foreground">قائد الفريق: {team.lead}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Users className="w-4 h-4" />
                    {team.members} أعضاء
                  </div>
                  <Badge className="hub-badge-gold-solid">نشط</Badge>
                </div>
              </CardContent>
            </Card>
          )) : (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">لم يتم إنشاء فرق بعد - قم بإضافة فرق من خلال إدارة الفرق</p>
            </div>
          )}
        </div>
        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 hub-stat-gold" />
              مصفوفة الأدوار والصلاحيات (RACI)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {roles.map((item, idx) => (
                <div key={idx} className="p-4 rounded-lg border border-border">
                  <h4 className="font-semibold mb-1">{item.role}</h4>
                  <p className="text-sm text-muted-foreground mb-3">{item.desc}</p>
                  <div className="flex flex-wrap gap-2">
                    {item.permissions.map((perm, pidx) => (
                      <Badge key={pidx} variant="outline" className="text-xs">{perm}</Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderLearning = () => {
    const courses = trainingCoursesList.length > 0 ? trainingCoursesList : [];
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-2xl font-bold">مركز التدريب والتوعية</h2>
          <Button className="btn-gold" data-testid="button-add-course" onClick={() => setIsAddCourseOpen(true)}>
            <Plus className="w-4 h-4 ml-2" />
            دورة جديدة
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="card-premium">
            <CardContent className="p-6 text-center">
              <GraduationCap className="w-8 h-8 mx-auto mb-2 hub-stat-gold" />
              <p className="text-2xl font-bold">{courses.length}</p>
              <p className="text-sm text-muted-foreground">دورة تدريبية</p>
            </CardContent>
          </Card>
          <Card className="card-premium">
            <CardContent className="p-6 text-center">
              <Users className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-2xl font-bold">{courses.reduce((a: number, b: any) => a + (b.enrolled || 0), 0)}</p>
              <p className="text-sm text-muted-foreground">إجمالي المسجلين</p>
            </CardContent>
          </Card>
          <Card className="card-premium">
            <CardContent className="p-6 text-center">
              <Award className="w-8 h-8 mx-auto mb-2 hub-stat-gold" />
              <p className="text-2xl font-bold">{courses.reduce((a: number, b: any) => a + (b.completed || 0), 0)}</p>
              <p className="text-sm text-muted-foreground">شهادة إتمام</p>
            </CardContent>
          </Card>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium">لا توجد دورات تدريبية بعد</p>
              <p className="text-sm">اضغط على "دورة جديدة" لإضافة أول دورة</p>
            </div>
          )}
          {courses.map((course: any, idx: number) => (
            <Card key={course.id || idx} className="card-premium" data-testid={`card-course-${course.id || idx}`}>
              <CardContent className="p-6">
                <div className="flex items-start gap-3 mb-4">
                  <div className="hub-icon-gold flex-shrink-0">
                    <BookOpen className="w-5 h-5 hub-stat-gold" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{course.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{course.duration || '-'} - {course.level || '-'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  {course.category && <Badge variant="outline" className="text-xs">{course.category}</Badge>}
                  {course.level && <Badge variant="outline" className="text-xs">{course.level}</Badge>}
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{course.completed || 0}/{course.enrolled || 0} أتموا الدورة</span>
                    <span>{course.enrolled > 0 ? Math.round(((course.completed || 0) / course.enrolled) * 100) : 0}%</span>
                  </div>
                  <Progress value={course.enrolled > 0 ? ((course.completed || 0) / course.enrolled) * 100 : 0} className="h-1.5" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  const renderUsers = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold">إدارة المستخدمين (ممثلو بيانات الأعمال)</h2>
        <Button className="btn-gold" data-testid="button-add-user-steward" onClick={() => setIsAddStewardOpen(true)}>
          <Plus className="w-4 h-4 ml-2" />
          إضافة ممثل بيانات
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="card-premium">
          <CardContent className="p-6 text-center">
            <Users className="w-8 h-8 mx-auto mb-2 hub-stat-gold" />
            <p className="text-2xl font-bold">{stewardsList.length || 3}</p>
            <p className="text-sm text-muted-foreground">إجمالي الممثلين</p>
          </CardContent>
        </Card>
        <Card className="card-premium">
          <CardContent className="p-6 text-center">
            <UserCheck className="w-8 h-8 mx-auto mb-2 hub-stat-gold" />
            <p className="text-2xl font-bold">{stewardsList.filter((s: any) => s.role === 'steward').length || 1}</p>
            <p className="text-sm text-muted-foreground">ممثلو بيانات</p>
          </CardContent>
        </Card>
        <Card className="card-premium">
          <CardContent className="p-6 text-center">
            <Building2 className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-2xl font-bold">{businessDepartments.filter((d: any) => d.isActive).length}</p>
            <p className="text-sm text-muted-foreground">إدارات نشطة</p>
          </CardContent>
        </Card>
      </div>
      <Card className="card-premium">
        <CardHeader>
          <CardTitle>قائمة ممثلي بيانات الأعمال</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">الاسم</TableHead>
                <TableHead className="text-right">البريد الإلكتروني</TableHead>
                <TableHead className="text-right">الإدارة</TableHead>
                <TableHead className="text-right">الدور</TableHead>
                <TableHead className="text-right">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stewardsList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    لا يوجد ممثلو بيانات حالياً - قم بإضافة ممثل بيانات جديد
                  </TableCell>
                </TableRow>
              ) : stewardsList.map((steward: any) => (
                <TableRow key={steward.id} data-testid={`row-user-${steward.id}`}>
                  <TableCell className="font-medium">{steward.name}</TableCell>
                  <TableCell className="text-sm">{steward.email}</TableCell>
                  <TableCell>{steward.department}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {steward.role === 'steward' ? 'ممثل بيانات' : steward.role === 'owner' ? 'مالك بيانات' : 'أمين بيانات'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" className="btn-icon-gold" data-testid={`button-edit-user-${steward.id}`} onClick={() => setEditingStewardUser({ ...steward })}><Edit className="w-4 h-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">الإعدادات العامة</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 hub-stat-gold" />
              إعدادات النظام
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: 'اسم المنظمة', value: 'نادي سباقات الخيل (JCSA)', type: 'text' },
              { label: 'اللغة الافتراضية', value: 'العربية (RTL)', type: 'text' },
              { label: 'المنطقة الزمنية', value: 'Asia/Riyadh (GMT+3)', type: 'text' },
              { label: 'تنسيق التاريخ', value: 'هجري / ميلادي', type: 'text' },
            ].map((setting, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-border">
                <span className="text-sm font-medium">{setting.label}</span>
                <span className="text-sm text-muted-foreground">{setting.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 hub-stat-gold" />
              إعدادات الإشعارات
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: 'إشعارات البريد الإلكتروني', enabled: true },
              { label: 'إشعارات المتصفح', enabled: true },
              { label: 'تنبيهات المواعيد النهائية', enabled: true },
              { label: 'تنبيهات المخاطر العالية', enabled: true },
              { label: 'ملخص يومي', enabled: false },
            ].map((notif, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-border">
                <span className="text-sm font-medium">{notif.label}</span>
                <Badge className={notif.enabled ? 'hub-badge-gold-solid' : 'bg-muted'}>
                  {notif.enabled ? 'مفعّل' : 'معطّل'}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 hub-stat-gold" />
              إعدادات الأمان
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: 'مدة الجلسة', value: '30 دقيقة' },
              { label: 'المصادقة الثنائية', value: 'مفعّلة' },
              { label: 'سياسة كلمة المرور', value: 'قوية (8+ أحرف)' },
              { label: 'تسجيل النشاطات', value: 'مفعّل' },
            ].map((sec, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-border">
                <span className="text-sm font-medium">{sec.label}</span>
                <span className="text-sm text-muted-foreground">{sec.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 hub-stat-gold" />
              إعدادات قاعدة البيانات
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: 'النسخ الاحتياطي التلقائي', value: 'يومي - 02:00 AM' },
              { label: 'الاحتفاظ بالنسخ', value: '30 يوم' },
              { label: 'حجم قاعدة البيانات', value: '2.4 GB' },
              { label: 'آخر نسخة احتياطية', value: new Date().toLocaleDateString('ar-SA') },
            ].map((db, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-border">
                <span className="text-sm font-medium">{db.label}</span>
                <span className="text-sm text-muted-foreground">{db.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderArchive = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold">الأرشيف</h2>
        <Input placeholder="بحث في الأرشيف..." className="w-64" value={archiveSearch} onChange={e => setArchiveSearch(e.target.value)} data-testid="input-archive-search" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="card-premium">
          <CardContent className="p-6 text-center">
            <Archive className="w-8 h-8 mx-auto mb-2 hub-stat-gold" />
            <p className="text-2xl font-bold">{evidences.length + decisions.length}</p>
            <p className="text-sm text-muted-foreground">إجمالي الوثائق</p>
          </CardContent>
        </Card>
        <Card className="card-premium">
          <CardContent className="p-6 text-center">
            <FolderOpen className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-2xl font-bold">{evidences.length}</p>
            <p className="text-sm text-muted-foreground">أدلة مؤرشفة</p>
          </CardContent>
        </Card>
        <Card className="card-premium">
          <CardContent className="p-6 text-center">
            <Gavel className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-2xl font-bold">{decisions.length}</p>
            <p className="text-sm text-muted-foreground">قرارات مؤرشفة</p>
          </CardContent>
        </Card>
        <Card className="card-premium">
          <CardContent className="p-6 text-center">
            <Calendar className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-2xl font-bold">{meetings.filter((m: any) => m.status === 'completed').length}</p>
            <p className="text-sm text-muted-foreground">محاضر مؤرشفة</p>
          </CardContent>
        </Card>
      </div>
      <Card className="card-premium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Archive className="w-5 h-5 hub-stat-gold" />
            الوثائق المؤرشفة
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">الوثيقة</TableHead>
                <TableHead className="text-right">النوع</TableHead>
                <TableHead className="text-right">تاريخ الأرشفة</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {evidences.filter((e: any) => !archiveSearch || (e.fileName || '').includes(archiveSearch)).slice(0, 5).map((evidence: any, idx: number) => (
                <TableRow key={idx} data-testid={`row-archive-${idx}`}>
                  <TableCell className="font-medium">{evidence.fileName || `وثيقة ${idx + 1}`}</TableCell>
                  <TableCell><Badge variant="outline">دليل امتثال</Badge></TableCell>
                  <TableCell className="text-sm">{new Date(evidence.createdAt || Date.now()).toLocaleDateString('ar-SA')}</TableCell>
                  <TableCell><Badge className="hub-badge-gold-solid">مؤرشف</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" className="btn-icon-gold" data-testid={`button-view-archive-${idx}`} onClick={() => setDetailDialog({ open: true, title: 'تفاصيل الوثيقة المؤرشفة', content: [{ label: 'اسم الوثيقة', value: evidence.fileName || `وثيقة ${idx + 1}` }, { label: 'النوع', value: 'دليل امتثال' }, { label: 'تاريخ الأرشفة', value: new Date(evidence.createdAt || Date.now()).toLocaleDateString('ar-SA') }, { label: 'الحالة', value: 'مؤرشف' }] })}><Eye className="w-4 h-4" /></Button>
                      <Button size="icon" className="btn-icon-gold" data-testid={`button-download-archive-${idx}`} onClick={() => { toast({ title: 'جاري تحميل الوثيقة...' }); if (evidence.id) window.open(`/api/evidences/${evidence.id}/download`, '_blank'); }}><Download className="w-4 h-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {decisions.filter((d: any) => !archiveSearch || (d.title || '').includes(archiveSearch)).slice(0, 3).map((decision: any, idx: number) => (
                <TableRow key={`d-${idx}`} data-testid={`row-archive-decision-${idx}`}>
                  <TableCell className="font-medium">{decision.title}</TableCell>
                  <TableCell><Badge variant="outline">قرار لجنة</Badge></TableCell>
                  <TableCell className="text-sm">{new Date(decision.createdAt).toLocaleDateString('ar-SA')}</TableCell>
                  <TableCell><Badge className="hub-badge-gold-solid">مؤرشف</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" className="btn-icon-gold" onClick={() => setDetailDialog({ open: true, title: 'تفاصيل القرار المؤرشف', content: [{ label: 'العنوان', value: decision.title }, { label: 'رقم القرار', value: decision.decisionNumber || '-' }, { label: 'النوع', value: 'قرار لجنة' }, { label: 'التاريخ', value: new Date(decision.createdAt).toLocaleDateString('ar-SA') }, { label: 'الحالة', value: 'مؤرشف' }] })}><Eye className="w-4 h-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <DashboardLayout 
      title="مكتب إدارة البيانات" 
      subtitle="مكتب إدارة البيانات"
      navGroups={dmoNavGroups}
      portalName="DMO"
    >
      <StorytellingTour 
        portalType="dmo" 
        isOpen={showTour} 
        onComplete={() => setShowTour(false)} 
      />
      <div className="mb-4 flex justify-end">
        <TourTriggerButton onClick={() => setShowTour(true)} />
      </div>
      {renderPageContent()}

      {/* View Detail Dialog */}
      <Dialog open={detailDialog?.open || false} onOpenChange={(open) => { if (!open) setDetailDialog(null); }}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>{detailDialog?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            {detailDialog?.content.map((item, idx) => (
              <div key={idx} className="flex items-start gap-3 py-2 border-b last:border-b-0">
                <span className="text-sm font-medium text-muted-foreground min-w-[120px]">{item.label}:</span>
                <span className="text-sm flex-1">{item.value || '-'}</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Incident Dialog */}
      <Dialog open={isAddIncidentOpen} onOpenChange={setIsAddIncidentOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>بلاغ أمني جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>عنوان البلاغ</Label>
              <Input value={incidentForm.title} onChange={(e) => setIncidentForm({ ...incidentForm, title: e.target.value })} data-testid="input-incident-title" />
            </div>
            <div className="space-y-2">
              <Label>مستوى الخطورة</Label>
              <Select value={incidentForm.severity} onValueChange={(v) => setIncidentForm({ ...incidentForm, severity: v })}>
                <SelectTrigger data-testid="select-incident-severity"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">حرج</SelectItem>
                  <SelectItem value="high">عالي</SelectItem>
                  <SelectItem value="medium">متوسط</SelectItem>
                  <SelectItem value="low">منخفض</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الوصف</Label>
              <Textarea value={incidentForm.description} onChange={(e) => setIncidentForm({ ...incidentForm, description: e.target.value })} data-testid="input-incident-description" />
            </div>
            <Button className="btn-gold w-full" data-testid="button-submit-incident" disabled={createIncidentMutation.isPending || !incidentForm.title.trim()} onClick={() => {
              if (!incidentForm.title.trim()) {
                toast({ title: 'يرجى إدخال عنوان البلاغ', variant: 'destructive' });
                return;
              }
              createIncidentMutation.mutate({
                title: incidentForm.title,
                severity: incidentForm.severity,
                description: incidentForm.description,
                incidentType: 'data_incident',
              });
            }}>{createIncidentMutation.isPending ? 'جاري التسجيل...' : 'تسجيل البلاغ'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Breach Report Dialog */}
      <Dialog open={isBreachReportOpen} onOpenChange={setIsBreachReportOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>بلاغ اختراق جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>عنوان البلاغ</Label>
              <Input value={breachForm.title} onChange={(e) => setBreachForm({ ...breachForm, title: e.target.value })} data-testid="input-breach-title" />
            </div>
            <div className="space-y-2">
              <Label>نوع الاختراق</Label>
              <Select value={breachForm.type} onValueChange={(v) => setBreachForm({ ...breachForm, type: v })}>
                <SelectTrigger data-testid="select-breach-type"><SelectValue placeholder="اختر النوع" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="data_leak">تسريب بيانات</SelectItem>
                  <SelectItem value="unauthorized_access">وصول غير مصرح</SelectItem>
                  <SelectItem value="data_loss">فقدان بيانات</SelectItem>
                  <SelectItem value="privacy_violation">انتهاك خصوصية</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>مستوى الخطورة</Label>
              <Select value={breachForm.severity} onValueChange={(v) => setBreachForm({ ...breachForm, severity: v })}>
                <SelectTrigger data-testid="select-breach-severity"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">حرج</SelectItem>
                  <SelectItem value="high">عالي</SelectItem>
                  <SelectItem value="medium">متوسط</SelectItem>
                  <SelectItem value="low">منخفض</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>عدد السجلات المتأثرة (تقديري)</Label>
              <Input type="number" value={breachForm.affectedRecords} onChange={(e) => setBreachForm({ ...breachForm, affectedRecords: e.target.value })} placeholder="مثال: 100" data-testid="input-breach-affected-records" />
            </div>
            <div className="space-y-2">
              <Label>أنواع البيانات المتأثرة</Label>
              <Input value={breachForm.affectedDataTypes} onChange={(e) => setBreachForm({ ...breachForm, affectedDataTypes: e.target.value })} placeholder="مثال: بيانات شخصية، بيانات مالية" data-testid="input-breach-data-types" />
            </div>
            <div className="space-y-2">
              <Label>الوصف</Label>
              <Textarea value={breachForm.description} onChange={(e) => setBreachForm({ ...breachForm, description: e.target.value })} data-testid="input-breach-description" />
            </div>
            <Button className="btn-gold w-full" data-testid="button-submit-breach" disabled={createBreachMutation.isPending || !breachForm.title || !breachForm.description || !breachForm.severity} onClick={() => {
              createBreachMutation.mutate({
                title: breachForm.title,
                breachType: breachForm.type,
                severity: breachForm.severity,
                description: breachForm.description,
                descriptionAr: breachForm.description,
                affectedRecords: breachForm.affectedRecords ? parseInt(breachForm.affectedRecords) : null,
                affectedDataTypes: breachForm.affectedDataTypes ? breachForm.affectedDataTypes.split('،').map((s: string) => s.trim()).filter(Boolean) : null,
                detectedAt: new Date().toISOString(),
              });
            }}>{createBreachMutation.isPending ? 'جاري التسجيل...' : 'تسجيل البلاغ'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Risk Dialog */}
      <Dialog open={isAddRiskOpen} onOpenChange={setIsAddRiskOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة خطر جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>عنوان الخطر</Label>
              <Input value={riskForm.title} onChange={(e) => setRiskForm({ ...riskForm, title: e.target.value })} data-testid="input-risk-title" />
            </div>
            <div className="space-y-2">
              <Label>مستوى الخطر</Label>
              <Select value={riskForm.riskLevel} onValueChange={(v) => setRiskForm({ ...riskForm, riskLevel: v })}>
                <SelectTrigger data-testid="select-risk-level"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">حرج</SelectItem>
                  <SelectItem value="high">عالي</SelectItem>
                  <SelectItem value="medium">متوسط</SelectItem>
                  <SelectItem value="low">منخفض</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الوصف</Label>
              <Textarea value={riskForm.description} onChange={(e) => setRiskForm({ ...riskForm, description: e.target.value })} data-testid="input-risk-description" />
            </div>
            <div className="space-y-2">
              <Label>خطة المعالجة</Label>
              <Textarea value={riskForm.mitigation} onChange={(e) => setRiskForm({ ...riskForm, mitigation: e.target.value })} data-testid="input-risk-mitigation" />
            </div>
            <Button
              className="btn-gold w-full"
              data-testid="button-submit-risk"
              disabled={createRiskMutation.isPending || !riskForm.title.trim()}
              onClick={() => {
                if (!riskForm.title.trim()) {
                  toast({ title: 'يرجى إدخال عنوان المخاطرة', variant: 'destructive' });
                  return;
                }
                createRiskMutation.mutate(riskForm);
              }}>
              {createRiskMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin ml-2" />جاري الحفظ...</> : 'إضافة الخطر'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Agreement Dialog */}
      <Dialog open={isAddAgreementOpen} onOpenChange={setIsAddAgreementOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>اتفاقية مشاركة بيانات جديدة</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>عنوان الاتفاقية</Label>
              <Input value={agreementForm.title} onChange={(e) => setAgreementForm({ ...agreementForm, title: e.target.value })} data-testid="input-agreement-title" />
            </div>
            <div className="space-y-2">
              <Label>اسم الجهة</Label>
              <Input value={agreementForm.partyName} onChange={(e) => setAgreementForm({ ...agreementForm, partyName: e.target.value })} data-testid="input-agreement-party" />
            </div>
            <div className="space-y-2">
              <Label>نوع الاتفاقية</Label>
              <Select value={agreementForm.agreementType} onValueChange={(v) => setAgreementForm({ ...agreementForm, agreementType: v })}>
                <SelectTrigger data-testid="select-agreement-type"><SelectValue placeholder="اختر النوع" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sharing">مشاركة بيانات</SelectItem>
                  <SelectItem value="processing">معالجة بيانات</SelectItem>
                  <SelectItem value="transfer">نقل بيانات</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>تاريخ البدء</Label>
                <Input type="date" value={agreementForm.startDate} onChange={(e) => setAgreementForm({ ...agreementForm, startDate: e.target.value })} data-testid="input-agreement-start" />
              </div>
              <div className="space-y-2">
                <Label>تاريخ الانتهاء</Label>
                <Input type="date" value={agreementForm.endDate} onChange={(e) => setAgreementForm({ ...agreementForm, endDate: e.target.value })} data-testid="input-agreement-end" />
              </div>
            </div>
            <Button className="btn-gold w-full" data-testid="button-submit-agreement" disabled={createAgreementMutation.isPending || !agreementForm.title} onClick={() => {
              createAgreementMutation.mutate({
                title: agreementForm.title,
                parties: agreementForm.partyName,
                agreementType: agreementForm.agreementType,
                startDate: agreementForm.startDate || null,
                endDate: agreementForm.endDate || null,
              });
            }}>{createAgreementMutation.isPending ? 'جاري الإضافة...' : 'إضافة الاتفاقية'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Start Assessment Dialog */}
      <Dialog open={isStartAssessmentOpen} onOpenChange={setIsStartAssessmentOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>بدء تقييم ذاتي جديد (NDMO)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">سيتم إنشاء تقييم ذاتي جديد بناءً على معايير الهيئة الوطنية للبيانات والذكاء الاصطناعي (NDMO). يشمل التقييم جميع النطاقات الـ 15.</p>
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <ClipboardCheck className="w-5 h-5 hub-stat-gold" />
                <span className="text-sm">حوكمة البيانات - 15 متطلب</span>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <Target className="w-5 h-5 hub-stat-gold" />
                <span className="text-sm">جودة البيانات - 12 متطلب</span>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <Shield className="w-5 h-5 hub-stat-gold" />
                <span className="text-sm">حماية البيانات - 18 متطلب</span>
              </div>
            </div>
            <Button className="btn-gold w-full" data-testid="button-confirm-assessment" disabled={startAssessmentMutation.isPending} onClick={() => {
              const currentYear = new Date().getFullYear();
              const currentQuarter = `Q${Math.ceil((new Date().getMonth() + 1) / 3)}`;
              startAssessmentMutation.mutate({
                domainId: 'data-governance',
                fiscalQuarter: currentQuarter,
                fiscalYear: currentYear,
                specifications: [],
                notes: 'تقييم ذاتي جديد - حوكمة البيانات',
              });
            }}>{startAssessmentMutation.isPending ? 'جاري البدء...' : 'بدء التقييم'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Course Dialog */}
      <Dialog open={isAddCourseOpen} onOpenChange={setIsAddCourseOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة دورة تدريبية جديدة</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>عنوان الدورة</Label>
              <Input value={courseForm.title} onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })} data-testid="input-course-title" />
            </div>
            <div className="space-y-2">
              <Label>المدة</Label>
              <Input value={courseForm.duration} onChange={(e) => setCourseForm({ ...courseForm, duration: e.target.value })} placeholder="مثال: 3 ساعات" data-testid="input-course-duration" />
            </div>
            <div className="space-y-2">
              <Label>المستوى</Label>
              <Select value={courseForm.level} onValueChange={(v) => setCourseForm({ ...courseForm, level: v })}>
                <SelectTrigger data-testid="select-course-level"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="مبتدئ">مبتدئ</SelectItem>
                  <SelectItem value="متوسط">متوسط</SelectItem>
                  <SelectItem value="متقدم">متقدم</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الفئة</Label>
              <Input value={courseForm.category} onChange={(e) => setCourseForm({ ...courseForm, category: e.target.value })} placeholder="مثال: حوكمة، امتثال، خصوصية" data-testid="input-course-category" />
            </div>
            <Button className="btn-gold w-full" data-testid="button-submit-course" disabled={createCourseMutation.isPending || !courseForm.title.trim()} onClick={() => {
              if (!courseForm.title.trim()) {
                toast({ title: 'يرجى إدخال عنوان الدورة', variant: 'destructive' });
                return;
              }
              createCourseMutation.mutate({
                title: courseForm.title,
                duration: courseForm.duration,
                level: courseForm.level,
                category: courseForm.category,
              });
            }}>{createCourseMutation.isPending ? 'جاري الإضافة...' : 'إضافة الدورة'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Steward User Dialog */}
      <Dialog open={!!editingStewardUser} onOpenChange={(open) => { if (!open) setEditingStewardUser(null); }}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل بيانات الممثل</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>الاسم</Label>
              <Input value={editingStewardUser?.name || ''} onChange={(e) => setEditingStewardUser({ ...editingStewardUser, name: e.target.value })} data-testid="input-edit-steward-name" />
            </div>
            <div className="space-y-2">
              <Label>البريد الإلكتروني</Label>
              <Input value={editingStewardUser?.email || ''} onChange={(e) => setEditingStewardUser({ ...editingStewardUser, email: e.target.value })} data-testid="input-edit-steward-email" />
            </div>
            <div className="space-y-2">
              <Label>الإدارة</Label>
              <Input value={editingStewardUser?.department || ''} onChange={(e) => setEditingStewardUser({ ...editingStewardUser, department: e.target.value })} data-testid="input-edit-steward-department" />
            </div>
            <div className="space-y-2">
              <Label>الدور</Label>
              <Select value={editingStewardUser?.role || 'steward'} onValueChange={(v) => setEditingStewardUser({ ...editingStewardUser, role: v })}>
                <SelectTrigger data-testid="select-edit-steward-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="steward">ممثل بيانات</SelectItem>
                  <SelectItem value="owner">مالك بيانات</SelectItem>
                  <SelectItem value="custodian">أمين بيانات</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="btn-gold w-full" data-testid="button-save-steward" onClick={() => {
              if (editingStewardUser?.id) {
                updateStewardMutation.mutate({ id: editingStewardUser.id, data: editingStewardUser });
              }
              setEditingStewardUser(null);
            }}>حفظ التعديلات</Button>
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmDialog {...confirmDialogProps} />
    </DashboardLayout>
  );
}
