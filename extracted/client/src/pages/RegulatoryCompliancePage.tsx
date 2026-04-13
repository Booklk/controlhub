import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient, invalidateRelatedQueries } from '@/lib/queryClient';
import { useAuth } from '@/lib/auth';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Shield, Search, Plus, Upload, CheckCircle2, Clock,
  ChevronDown, ChevronUp, Edit, Trash2, FileText, BarChart3, Target,
  Sparkles, X, BookOpen, ListPlus, ClipboardList,
  Lightbulb, Users
} from 'lucide-react';
import type { NavGroup } from '@/lib/navigation';
import type { RegulatoryControl } from '@shared/schema';

interface RegulatoryCompliancePageProps {
  navGroups: NavGroup[];
  portalName: string;
  portalId: string;
  regulatoryBody: string;
  regulatoryBodyLabel: string;
}

interface ControlStats {
  total: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  complianceRate: number;
  byCategory: Record<string, { total: number; completed: number }>;
  byDomain: Record<string, { total: number; completed: number }>;
}

const STATUS_LABELS: Record<string, string> = {
  not_started: 'لم تبدأ',
  in_progress: 'تحت الإجراء',
  completed: 'مكتمل',
};

const STATUS_COLORS: Record<string, string> = {
  not_started: 'bg-gray-500/15 text-gray-400 border-gray-500/20',
  in_progress: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  completed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'منخفض',
  medium: 'متوسط',
  high: 'عالي',
  urgent: 'عاجل',
  critical: 'حرج',
};

const BODY_INFO: Record<string, { fullName: string; description: string; website: string }> = {
  NCA: {
    fullName: 'الهيئة الوطنية للأمن السيبراني',
    description: 'الضوابط الأساسية للأمن السيبراني (ECC) وضوابط الأمن السيبراني للأنظمة الحساسة (CSCC) والضوابط ذات الصلة',
    website: 'nca.gov.sa',
  },
  NDMO: {
    fullName: 'المكتب الوطني لإدارة البيانات',
    description: 'إطار حوكمة البيانات الوطني والسياسات والمعايير المتعلقة بإدارة البيانات وحمايتها',
    website: 'ndmo.gov.sa',
  },
  DGA: {
    fullName: 'هيئة الحكومة الرقمية',
    description: 'مؤشرات ومعايير التحول الرقمي الحكومي وقياس النضج الرقمي للجهات الحكومية',
    website: 'dga.gov.sa',
  },
};

export default function RegulatoryCompliancePage({ navGroups, portalName, portalId, regulatoryBody, regulatoryBodyLabel }: RegulatoryCompliancePageProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedControl, setSelectedControl] = useState<RegulatoryControl | null>(null);
  const [expandedControl, setExpandedControl] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'controls' | 'import'>('controls');

  const [formData, setFormData] = useState({
    controlNumber: '',
    title: '',
    description: '',
    category: '',
    subcategory: '',
    domain: '',
    status: 'not_started',
    priority: 'medium',
    assignedTo: '',
    notes: '',
    evidence: '',
    completionPercentage: 0,
  });

  const [bulkText, setBulkText] = useState('');
  const [bulkFormat, setBulkFormat] = useState<'lines' | 'json'>('lines');

  const { data: controls = [], isLoading } = useQuery<RegulatoryControl[]>({
    queryKey: ['/api/regulatory-controls', portalId, regulatoryBody],
    queryFn: () => apiRequest('GET', `/api/regulatory-controls?portal=${portalId}&regulatoryBody=${regulatoryBody}`).then(r => r.json()),
  });

  const { data: stats } = useQuery<ControlStats>({
    queryKey: ['/api/regulatory-controls/stats', portalId],
    queryFn: () => apiRequest('GET', `/api/regulatory-controls/stats?portal=${portalId}`).then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/regulatory-controls', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/regulatory-controls'] });
      invalidateRelatedQueries('/api/regulatory-controls');
      toast({ title: 'تم إضافة الضابط بنجاح' });
      setShowAddDialog(false);
      resetForm();
    },
    onError: (error: Error) => toast({ title: 'خطأ في إضافة الضابط', description: error.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest('PATCH', `/api/regulatory-controls/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/regulatory-controls'] });
      invalidateRelatedQueries('/api/regulatory-controls');
      toast({ title: 'تم تحديث الضابط بنجاح' });
      setShowEditDialog(false);
      setSelectedControl(null);
      resetForm();
    },
    onError: (error: Error) => toast({ title: 'خطأ في تحديث الضابط', description: error.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/regulatory-controls/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/regulatory-controls'] });
      invalidateRelatedQueries('/api/regulatory-controls');
      toast({ title: 'تم حذف الضابط بنجاح' });
      setShowDeleteDialog(false);
      setSelectedControl(null);
    },
    onError: (error: Error) => toast({ title: 'خطأ في حذف الضابط', description: error.message, variant: 'destructive' }),
  });

  const bulkImportMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/regulatory-controls/bulk-import', data);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/regulatory-controls'] });
      invalidateRelatedQueries('/api/regulatory-controls');
      toast({ title: `تم استيراد ${data.count} ضابط بنجاح` });
      setShowBulkImport(false);
      setBulkText('');
      setActiveTab('controls');
    },
    onError: (error: Error) => toast({ title: 'خطأ في الاستيراد الجماعي', description: error.message, variant: 'destructive' }),
  });

  const resetForm = () => {
    setFormData({
      controlNumber: '', title: '', description: '', category: '', subcategory: '',
      domain: '', status: 'not_started', priority: 'medium', assignedTo: '', notes: '',
      evidence: '', completionPercentage: 0,
    });
  };

  const handleCreate = () => {
    if (!formData.controlNumber || !formData.title) {
      toast({ title: 'رقم الضابط والعنوان مطلوبان', variant: 'destructive' });
      return;
    }
    createMutation.mutate({
      ...formData,
      regulatoryBody,
      portal: portalId,
    });
  };

  const handleEdit = (control: RegulatoryControl) => {
    setSelectedControl(control);
    setFormData({
      controlNumber: control.controlNumber,
      title: control.title,
      description: control.description || '',
      category: control.category || '',
      subcategory: control.subcategory || '',
      domain: control.domain || '',
      status: control.status,
      priority: control.priority || 'medium',
      assignedTo: control.assignedTo || '',
      notes: control.notes || '',
      evidence: control.evidence || '',
      completionPercentage: control.completionPercentage || 0,
    });
    setShowEditDialog(true);
  };

  const handleUpdate = () => {
    if (!selectedControl) return;
    updateMutation.mutate({ id: selectedControl.id, data: formData });
  };

  const handleStatusChange = (controlId: number, newStatus: string) => {
    const completionPercentage = newStatus === 'completed' ? 100 : newStatus === 'in_progress' ? 50 : 0;
    updateMutation.mutate({ id: controlId, data: { status: newStatus, completionPercentage } });
  };

  const handleBulkImport = () => {
    let parsed: any[] = [];
    if (bulkFormat === 'json') {
      try {
        const jsonData = JSON.parse(bulkText);
        parsed = Array.isArray(jsonData) ? jsonData : [jsonData];
      } catch {
        toast({ title: 'خطأ في تنسيق JSON', variant: 'destructive' });
        return;
      }
    } else {
      const lines = bulkText.split('\n').filter(l => l.trim());
      parsed = lines.map((line, idx) => {
        const parts = line.split('|').map(p => p.trim());
        if (parts.length >= 2) {
          return {
            controlNumber: parts[0],
            title: parts[1],
            description: parts[2] || '',
            category: parts[3] || '',
            domain: parts[4] || '',
          };
        }
        const numberMatch = line.match(/^(\d+[\.\-]?\d*[\.\-]?\d*)\s*[:\-–]?\s*(.+)/);
        if (numberMatch) {
          return {
            controlNumber: numberMatch[1],
            title: numberMatch[2].trim(),
          };
        }
        return {
          controlNumber: `${idx + 1}`,
          title: line.trim(),
        };
      });
    }

    if (parsed.length === 0) {
      toast({ title: 'لا توجد ضوابط للاستيراد', variant: 'destructive' });
      return;
    }

    bulkImportMutation.mutate({ controls: parsed, portal: portalId, regulatoryBody });
  };

  const handleLoadTemplate = (template: string) => {
    setBulkFormat('lines');
    setBulkText(template);
    toast({ title: 'تم تحميل النموذج - يمكنك التعديل عليه قبل الاستيراد' });
  };

  const filteredControls = useMemo(() => {
    return controls.filter(c => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && c.category !== categoryFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          c.controlNumber.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q) ||
          (c.description || '').toLowerCase().includes(q) ||
          (c.category || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [controls, statusFilter, categoryFilter, searchQuery]);

  const categories = useMemo(() => {
    const cats = new Set(controls.map(c => c.category).filter(Boolean));
    return Array.from(cats) as string[];
  }, [controls]);

  const navItems = navGroups.flatMap(g => g.items);
  const bodyInfo = BODY_INFO[regulatoryBody];
  const hasControls = controls.length > 0;

  return (
    <DashboardLayout
      title={`الامتثال التنظيمي - ${regulatoryBodyLabel}`}
      subtitle={`إدارة الضوابط والمواصفات - ${regulatoryBodyLabel}`}
      navItems={navItems}
      navGroups={navGroups}
      portalName={portalName}
    >
      <div className="space-y-4">
        {bodyInfo && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-[hsl(43_74%_49%)]/10 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-5 h-5 hub-stat-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold">{bodyInfo.fullName}</h3>
                    <Badge variant="outline" className="text-[10px]">{regulatoryBody}</Badge>
                    {hasControls && (
                      <Badge variant="secondary" className="text-[10px]">{controls.length} ضابط</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{bodyInfo.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {hasControls && (
            <Button
              variant={activeTab === 'dashboard' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('dashboard')}
              data-testid="tab-dashboard"
            >
              <BarChart3 className="w-4 h-4 ml-1.5" />
              لوحة المعلومات
            </Button>
          )}
          <Button
            variant={activeTab === 'controls' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('controls')}
            data-testid="tab-controls"
          >
            <FileText className="w-4 h-4 ml-1.5" />
            الضوابط
          </Button>
          <Button
            variant={activeTab === 'import' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('import')}
            data-testid="tab-import"
          >
            <Upload className="w-4 h-4 ml-1.5" />
            إضافة جماعية
          </Button>
        </div>

        {activeTab === 'dashboard' && hasControls && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground">إجمالي الضوابط</p>
                      <p className="text-2xl font-bold mt-1" data-testid="text-total-controls">{stats?.total || controls.length}</p>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                      <Shield className="w-5 h-5 text-blue-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground">مكتمل</p>
                      <p className="text-2xl font-bold mt-1 text-emerald-400" data-testid="text-completed-controls">{stats?.completed || 0}</p>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground">تحت الإجراء</p>
                      <p className="text-2xl font-bold mt-1 text-amber-400" data-testid="text-inprogress-controls">{stats?.inProgress || 0}</p>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                      <Clock className="w-5 h-5 text-amber-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground">نسبة الامتثال</p>
                      <p className="text-2xl font-bold mt-1 hub-stat-gold" data-testid="text-compliance-rate">{stats?.complianceRate || 0}%</p>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-[hsl(43_74%_49%)]/10 flex items-center justify-center flex-shrink-0">
                      <Target className="w-5 h-5 hub-stat-gold" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
                  <CardTitle className="text-sm">توزيع الحالات</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: 'مكتمل', value: stats?.completed || 0, total: stats?.total || 1, color: 'bg-emerald-500' },
                    { label: 'تحت الإجراء', value: stats?.inProgress || 0, total: stats?.total || 1, color: 'bg-amber-500' },
                    { label: 'لم تبدأ', value: stats?.notStarted || 0, total: stats?.total || 1, color: 'bg-gray-500' },
                  ].map(item => (
                    <div key={item.label} className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-muted-foreground">{item.label}</span>
                        <span className="font-medium">{item.value} / {stats?.total || 0}</span>
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${item.color}`}
                          style={{ width: `${Math.round((item.value / (stats?.total || 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
                  <CardTitle className="text-sm">حسب التصنيف</CardTitle>
                </CardHeader>
                <CardContent>
                  {stats?.byCategory && Object.keys(stats.byCategory).length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-premium">
                      {Object.entries(stats.byCategory).map(([cat, data]) => (
                        <div key={cat} className="flex items-center justify-between gap-2 py-1.5 border-b border-border/50 last:border-0">
                          <span className="text-xs truncate flex-1">{cat}</span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs text-muted-foreground">{data.completed}/{data.total}</span>
                            <Badge variant="outline" className="text-[10px]">
                              {data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0}%
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-6">لا توجد بيانات بعد</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'controls' && (
          <div className="space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin w-8 h-8 border-2 border-[hsl(43_74%_49%)] border-t-transparent rounded-full" />
              </div>
            ) : !hasControls ? (
              <div className="space-y-4">
                <Card>
                  <CardContent className="py-10 px-6">
                    <div className="flex flex-col items-center text-center gap-4 max-w-lg mx-auto">
                      <div className="w-16 h-16 rounded-2xl bg-[hsl(43_74%_49%)]/10 flex items-center justify-center">
                        <ClipboardList className="w-8 h-8 hub-stat-gold" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold">ابدأ بتسجيل ضوابط {regulatoryBodyLabel}</h2>
                        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                          هذه الصفحة مخصصة لفريقكم لتسجيل ومتابعة جميع ضوابط ومتطلبات {bodyInfo?.fullName || regulatoryBodyLabel}.
                          أضف الضوابط واحداً تلو الآخر أو استخدم الإضافة الجماعية لإدخال عدد كبير دفعة واحدة.
                        </p>
                      </div>

                      <div className="flex flex-wrap justify-center gap-3 mt-2">
                        <Button onClick={() => { resetForm(); setShowAddDialog(true); }} data-testid="button-first-add">
                          <Plus className="w-4 h-4 ml-1.5" />
                          إضافة ضابط
                        </Button>
                        <Button variant="outline" onClick={() => setActiveTab('import')} data-testid="button-go-bulk">
                          <Upload className="w-4 h-4 ml-1.5" />
                          إضافة جماعية
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Card className="hover-elevate cursor-pointer" onClick={() => { resetForm(); setShowAddDialog(true); }}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                          <Plus className="w-4 h-4 text-blue-400" />
                        </div>
                        <div>
                          <h4 className="text-sm font-medium">إضافة يدوية</h4>
                          <p className="text-xs text-muted-foreground mt-0.5">أضف ضابطاً واحداً مع كامل التفاصيل</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="hover-elevate cursor-pointer" onClick={() => setActiveTab('import')}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                          <ListPlus className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div>
                          <h4 className="text-sm font-medium">إضافة جماعية</h4>
                          <p className="text-xs text-muted-foreground mt-0.5">أدخل عشرات الضوابط دفعة واحدة</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="hover-elevate cursor-pointer" onClick={() => {
                    setActiveTab('import');
                    setTimeout(() => {
                      const tpl = regulatoryBody === 'NCA' ? NCA_SAMPLE_TEMPLATE : regulatoryBody === 'NDMO' ? NDMO_SAMPLE_TEMPLATE : DGA_SAMPLE_TEMPLATE;
                      handleLoadTemplate(tpl);
                    }, 100);
                  }}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-[hsl(43_74%_49%)]/10 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-4 h-4 hub-stat-gold" />
                        </div>
                        <div>
                          <h4 className="text-sm font-medium">البدء من نموذج</h4>
                          <p className="text-xs text-muted-foreground mt-0.5">ابدأ بنموذج جاهز وعدّله حسب احتياجك</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 hub-stat-gold" />
                      كيف تبدأ؟
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex gap-3 items-start">
                        <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-[10px] font-bold text-blue-400">1</span>
                        </div>
                        <div>
                          <p className="text-xs font-medium">أحضر قائمة الضوابط</p>
                          <p className="text-[11px] text-muted-foreground">راجع الوثائق الرسمية من {bodyInfo?.fullName || regulatoryBodyLabel} واجمع أرقام ومسميات الضوابط المطلوبة</p>
                        </div>
                      </div>
                      <div className="flex gap-3 items-start">
                        <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-[10px] font-bold text-emerald-400">2</span>
                        </div>
                        <div>
                          <p className="text-xs font-medium">أدخلها في النظام</p>
                          <p className="text-[11px] text-muted-foreground">استخدم الإضافة الجماعية لإدخال الضوابط بسرعة أو أضفها واحداً تلو الآخر</p>
                        </div>
                      </div>
                      <div className="flex gap-3 items-start">
                        <div className="w-6 h-6 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-[10px] font-bold text-amber-400">3</span>
                        </div>
                        <div>
                          <p className="text-xs font-medium">وزّع المسؤوليات</p>
                          <p className="text-[11px] text-muted-foreground">حدد المسؤول عن كل ضابط وابدأ بتحديث حالات التنفيذ</p>
                        </div>
                      </div>
                      <div className="flex gap-3 items-start">
                        <div className="w-6 h-6 rounded-full bg-[hsl(43_74%_49%)]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-[10px] font-bold hub-stat-gold">4</span>
                        </div>
                        <div>
                          <p className="text-xs font-medium">تابع نسبة الامتثال</p>
                          <p className="text-[11px] text-muted-foreground">راقب التقدم من لوحة المعلومات وحدّث الحالات أولاً بأول</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="بحث في الضوابط..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pr-9"
                      data-testid="input-search-controls"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
                      <SelectValue placeholder="الحالة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع الحالات</SelectItem>
                      <SelectItem value="not_started">لم تبدأ</SelectItem>
                      <SelectItem value="in_progress">تحت الإجراء</SelectItem>
                      <SelectItem value="completed">مكتمل</SelectItem>
                    </SelectContent>
                  </Select>
                  {categories.length > 0 && (
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger className="w-[160px]" data-testid="select-category-filter">
                        <SelectValue placeholder="التصنيف" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع التصنيفات</SelectItem>
                        {categories.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button size="sm" onClick={() => { resetForm(); setShowAddDialog(true); }} data-testid="button-add-control">
                    <Plus className="w-4 h-4 ml-1.5" />
                    إضافة ضابط
                  </Button>
                </div>

                <div className="text-xs text-muted-foreground">
                  عرض {filteredControls.length} من {controls.length} ضابط
                </div>

                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin w-8 h-8 border-2 border-[hsl(43_74%_49%)] border-t-transparent rounded-full" />
                  </div>
                ) : filteredControls.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
                      <Search className="w-10 h-10 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">لا توجد نتائج تطابق البحث</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {filteredControls.map(control => (
                      <Card key={control.id} className="hover-elevate" data-testid={`card-control-${control.id}`}>
                        <CardContent className="p-3">
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className="text-[10px] font-mono flex-shrink-0">
                                  {control.controlNumber}
                                </Badge>
                                <Badge className={`text-[10px] ${STATUS_COLORS[control.status] || ''}`}>
                                  {STATUS_LABELS[control.status] || control.status}
                                </Badge>
                                {control.category && (
                                  <Badge variant="secondary" className="text-[10px]">
                                    {control.category}
                                  </Badge>
                                )}
                                {control.priority && control.priority !== 'medium' && (
                                  <Badge variant="outline" className="text-[10px]">
                                    {PRIORITY_LABELS[control.priority] || control.priority}
                                  </Badge>
                                )}
                              </div>
                              <h3 className="text-sm font-medium mt-1.5 leading-relaxed">{control.title}</h3>
                              {control.assignedTo && (
                                <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                                  <Users className="w-3 h-3" />
                                  {control.assignedTo}
                                </p>
                              )}
                              {expandedControl === control.id && (
                                <div className="mt-3 space-y-2 text-xs text-muted-foreground border-t border-border/50 pt-3">
                                  {control.description && (
                                    <div>
                                      <span className="font-medium text-foreground">الوصف: </span>
                                      {control.description}
                                    </div>
                                  )}
                                  {control.domain && (
                                    <div>
                                      <span className="font-medium text-foreground">المجال: </span>
                                      {control.domain}
                                    </div>
                                  )}
                                  {control.subcategory && (
                                    <div>
                                      <span className="font-medium text-foreground">التصنيف الفرعي: </span>
                                      {control.subcategory}
                                    </div>
                                  )}
                                  {control.assignedTo && (
                                    <div>
                                      <span className="font-medium text-foreground">المسؤول: </span>
                                      {control.assignedTo}
                                    </div>
                                  )}
                                  {control.notes && (
                                    <div>
                                      <span className="font-medium text-foreground">ملاحظات: </span>
                                      {control.notes}
                                    </div>
                                  )}
                                  {control.evidence && (
                                    <div>
                                      <span className="font-medium text-foreground">الأدلة: </span>
                                      {control.evidence}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Select
                                value={control.status}
                                onValueChange={(val) => handleStatusChange(control.id, val)}
                              >
                                <SelectTrigger className="w-[110px] h-8 text-[11px]" data-testid={`select-status-${control.id}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="not_started">لم تبدأ</SelectItem>
                                  <SelectItem value="in_progress">تحت الإجراء</SelectItem>
                                  <SelectItem value="completed">مكتمل</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setExpandedControl(expandedControl === control.id ? null : control.id)}
                                data-testid={`button-expand-${control.id}`}
                              >
                                {expandedControl === control.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => handleEdit(control)} data-testid={`button-edit-${control.id}`}>
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-red-400"
                                onClick={() => { setSelectedControl(control); setShowDeleteDialog(true); }}
                                data-testid={`button-delete-${control.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'import' && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 hub-stat-gold" />
                  إضافة ضوابط جماعية
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  أدخل الضوابط والمواصفات الخاصة بإدارتكم. يمكنك نسخ الضوابط من ملفاتكم أو وثائق الجهة التنظيمية مباشرة وإدخالها هنا.
                  كل سطر يمثل ضابطاً واحداً.
                </p>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={bulkFormat === 'lines' ? 'default' : 'outline'}
                    onClick={() => setBulkFormat('lines')}
                    data-testid="button-format-lines"
                  >
                    تنسيق نصي
                  </Button>
                  <Button
                    size="sm"
                    variant={bulkFormat === 'json' ? 'default' : 'outline'}
                    onClick={() => setBulkFormat('json')}
                    data-testid="button-format-json"
                  >
                    تنسيق JSON
                  </Button>
                </div>

                {bulkFormat === 'lines' ? (
                  <div className="space-y-2">
                    <p className="text-[11px] text-muted-foreground">
                      أدخل كل ضابط في سطر. يمكنك استخدام الفاصل | لتحديد الحقول:
                      <br />
                      <span className="font-mono hub-stat-gold">رقم الضابط | العنوان | الوصف | التصنيف | المجال</span>
                      <br />
                      أو ببساطة: <span className="font-mono hub-stat-gold">1.1 - عنوان الضابط</span>
                    </p>
                    <Textarea
                      value={bulkText}
                      onChange={e => setBulkText(e.target.value)}
                      placeholder={`مثال:\n1.1 | حوكمة البيانات الوطنية | ضمان تطبيق معايير حوكمة البيانات | الحوكمة | إدارة البيانات\n1.2 | جودة البيانات | ضمان دقة واكتمال البيانات | الجودة | إدارة البيانات\n1.3 - إدارة البيانات الرئيسية\n1.4 - أمن البيانات وحمايتها`}
                      className="min-h-[250px] font-mono text-xs"
                      dir="ltr"
                      data-testid="textarea-bulk-import"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[11px] text-muted-foreground">
                      أدخل البيانات بتنسيق JSON. كل عنصر يحتوي على: controlNumber, title, description, category, domain
                    </p>
                    <Textarea
                      value={bulkText}
                      onChange={e => setBulkText(e.target.value)}
                      placeholder={`[\n  {"controlNumber": "1.1", "title": "حوكمة البيانات", "category": "الحوكمة", "domain": "إدارة البيانات"},\n  {"controlNumber": "1.2", "title": "جودة البيانات", "category": "الجودة"}\n]`}
                      className="min-h-[250px] font-mono text-xs"
                      dir="ltr"
                      data-testid="textarea-bulk-import-json"
                    />
                  </div>
                )}

                {bulkText.trim() && (
                  <div className="flex items-center justify-between gap-2 p-3 bg-muted/50 rounded-md">
                    <span className="text-xs text-muted-foreground">
                      {bulkFormat === 'lines'
                        ? `${bulkText.split('\n').filter(l => l.trim()).length} ضابط جاهز للاستيراد`
                        : 'بيانات JSON جاهزة'}
                    </span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setBulkText('')}>
                        <X className="w-3 h-3 ml-1" />
                        مسح
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleBulkImport}
                        disabled={bulkImportMutation.isPending}
                        data-testid="button-submit-bulk-import"
                      >
                        {bulkImportMutation.isPending ? (
                          <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full ml-1.5" />
                        ) : (
                          <Upload className="w-4 h-4 ml-1.5" />
                        )}
                        استيراد الضوابط
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-muted-foreground" />
                  نماذج مساعدة للبدء
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  هذه نماذج مبسطة للمساعدة فقط - عدّلها وأضف عليها الضوابط الفعلية الكاملة من وثائق الجهة التنظيمية
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                {regulatoryBody === 'NDMO' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => handleLoadTemplate(NDMO_SAMPLE_TEMPLATE)}
                    data-testid="button-template-ndmo"
                  >
                    <FileText className="w-4 h-4 ml-2" />
                    نموذج أولي لضوابط NDMO (15 بنداً للتعديل والإضافة)
                  </Button>
                )}
                {regulatoryBody === 'NCA' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => handleLoadTemplate(NCA_SAMPLE_TEMPLATE)}
                    data-testid="button-template-nca"
                  >
                    <FileText className="w-4 h-4 ml-2" />
                    نموذج أولي لضوابط NCA (15 بنداً للتعديل والإضافة)
                  </Button>
                )}
                {regulatoryBody === 'DGA' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => handleLoadTemplate(DGA_SAMPLE_TEMPLATE)}
                    data-testid="button-template-dga"
                  >
                    <FileText className="w-4 h-4 ml-2" />
                    نموذج أولي لمؤشرات DGA (15 بنداً للتعديل والإضافة)
                  </Button>
                )}
                <p className="text-[10px] text-muted-foreground pt-1">
                  بعد تحميل النموذج، عدّل الأرقام والمسميات لتطابق الوثائق الرسمية ثم اضغط "استيراد الضوابط"
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>إضافة ضابط جديد - {regulatoryBodyLabel}</DialogTitle>
          </DialogHeader>
          <ControlForm formData={formData} setFormData={setFormData} />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>إلغاء</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending} data-testid="button-submit-add">
              {createMutation.isPending ? 'جاري الإضافة...' : 'إضافة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={v => { if (!v) { setShowEditDialog(false); setSelectedControl(null); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تعديل الضابط</DialogTitle>
          </DialogHeader>
          <ControlForm formData={formData} setFormData={setFormData} />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowEditDialog(false); setSelectedControl(null); }}>إلغاء</Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending} data-testid="button-submit-edit">
              {updateMutation.isPending ? 'جاري التحديث...' : 'تحديث'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={v => { if (!v) { setShowDeleteDialog(false); setSelectedControl(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            هل أنت متأكد من حذف الضابط "{selectedControl?.title}"؟ لا يمكن التراجع عن هذا الإجراء.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowDeleteDialog(false); setSelectedControl(null); }}>إلغاء</Button>
            <Button variant="destructive" onClick={() => selectedControl && deleteMutation.mutate(selectedControl.id)} disabled={deleteMutation.isPending} data-testid="button-confirm-delete">
              {deleteMutation.isPending ? 'جاري الحذف...' : 'حذف'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function ControlForm({ formData, setFormData }: { formData: any; setFormData: (v: any) => void }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium">رقم الضابط <span className="text-red-400">*</span></label>
          <Input
            value={formData.controlNumber}
            onChange={e => setFormData({ ...formData, controlNumber: e.target.value })}
            placeholder="مثال: 1-1-1 أو ECC-1"
            data-testid="input-control-number"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">الحالة</label>
          <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
            <SelectTrigger data-testid="select-control-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="not_started">لم تبدأ</SelectItem>
              <SelectItem value="in_progress">تحت الإجراء</SelectItem>
              <SelectItem value="completed">مكتمل</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium">عنوان الضابط <span className="text-red-400">*</span></label>
        <Input
          value={formData.title}
          onChange={e => setFormData({ ...formData, title: e.target.value })}
          placeholder="المسمى كما ورد في وثائق الجهة التنظيمية"
          data-testid="input-control-title"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium">الوصف</label>
        <Textarea
          value={formData.description}
          onChange={e => setFormData({ ...formData, description: e.target.value })}
          placeholder="وصف تفصيلي للضابط ومتطلبات تحقيقه"
          className="min-h-[60px]"
          data-testid="textarea-control-description"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium">التصنيف</label>
          <Input
            value={formData.category}
            onChange={e => setFormData({ ...formData, category: e.target.value })}
            placeholder="مثل: الحوكمة، الأمن"
            data-testid="input-control-category"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">المجال</label>
          <Input
            value={formData.domain}
            onChange={e => setFormData({ ...formData, domain: e.target.value })}
            placeholder="مثل: إدارة البيانات"
            data-testid="input-control-domain"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium">التصنيف الفرعي</label>
          <Input
            value={formData.subcategory}
            onChange={e => setFormData({ ...formData, subcategory: e.target.value })}
            placeholder="تصنيف فرعي (اختياري)"
            data-testid="input-control-subcategory"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">الأولوية</label>
          <Select value={formData.priority} onValueChange={v => setFormData({ ...formData, priority: v })}>
            <SelectTrigger data-testid="select-control-priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">منخفض</SelectItem>
              <SelectItem value="medium">متوسط</SelectItem>
              <SelectItem value="high">عالي</SelectItem>
              <SelectItem value="critical">حرج</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium">المسؤول عن التطبيق</label>
        <Input
          value={formData.assignedTo}
          onChange={e => setFormData({ ...formData, assignedTo: e.target.value })}
          placeholder="اسم الموظف أو الفريق المسؤول"
          data-testid="input-control-assigned"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium">ملاحظات</label>
        <Textarea
          value={formData.notes}
          onChange={e => setFormData({ ...formData, notes: e.target.value })}
          placeholder="ملاحظات إضافية حول حالة التطبيق"
          className="min-h-[50px]"
          data-testid="textarea-control-notes"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium">الأدلة والمستندات</label>
        <Textarea
          value={formData.evidence}
          onChange={e => setFormData({ ...formData, evidence: e.target.value })}
          placeholder="روابط أو أسماء المستندات الداعمة للامتثال"
          className="min-h-[50px]"
          data-testid="textarea-control-evidence"
        />
      </div>
    </div>
  );
}

const NDMO_SAMPLE_TEMPLATE = `1.1 | حوكمة البيانات | وضع إطار حوكمة بيانات شامل يتضمن السياسات والإجراءات | الحوكمة | حوكمة البيانات
1.2 | إدارة البيانات الوصفية | تعريف وتوثيق البيانات الوصفية لجميع مجموعات البيانات | إدارة البيانات | البيانات الوصفية
1.3 | جودة البيانات | وضع معايير ومقاييس لضمان جودة البيانات | الجودة | جودة البيانات
1.4 | إدارة البيانات الرئيسية | تحديد وإدارة البيانات المرجعية الأساسية | إدارة البيانات | البيانات الرئيسية
1.5 | أمن البيانات | تطبيق سياسات حماية البيانات والخصوصية | الأمن | أمن البيانات
1.6 | تصنيف البيانات | وضع نظام تصنيف للبيانات حسب الحساسية والأهمية | التصنيف | تصنيف البيانات
1.7 | مشاركة البيانات | وضع آليات وسياسات لمشاركة البيانات بين الجهات | المشاركة | مشاركة البيانات
1.8 | البيانات المفتوحة | نشر البيانات المفتوحة وفق المعايير الوطنية | البيانات المفتوحة | البيانات المفتوحة
1.9 | خصوصية البيانات | الامتثال لنظام حماية البيانات الشخصية | الخصوصية | حماية البيانات
1.10 | دورة حياة البيانات | إدارة دورة حياة البيانات من الإنشاء إلى الإتلاف | دورة الحياة | إدارة البيانات
1.11 | معمارية البيانات | تصميم بنية البيانات المؤسسية | المعمارية | هندسة البيانات
1.12 | تكامل البيانات | ضمان تكامل البيانات عبر الأنظمة المختلفة | التكامل | تكامل البيانات
1.13 | مستودعات البيانات | إنشاء وإدارة مستودعات البيانات المركزية | التخزين | مستودعات البيانات
1.14 | تحليلات البيانات | تمكين تحليلات البيانات المتقدمة واتخاذ القرار | التحليلات | تحليل البيانات
1.15 | أدوار ومسؤوليات البيانات | تحديد الأدوار والمسؤوليات في إدارة البيانات | الأدوار | حوكمة البيانات`;

const NCA_SAMPLE_TEMPLATE = `1-1 | حوكمة الأمن السيبراني | وضع إطار حوكمة شامل للأمن السيبراني | الحوكمة | حوكمة أمنية
1-2 | إدارة الأصول المعلوماتية | جرد وتصنيف جميع الأصول المعلوماتية | إدارة الأصول | الأصول
1-3 | إدارة الهوية والوصول | تطبيق ضوابط إدارة الهوية والصلاحيات | الهوية والوصول | التحكم بالوصول
1-4 | حماية الشبكات | تأمين البنية التحتية للشبكات | حماية الشبكات | أمن الشبكات
1-5 | حماية الأنظمة | تأمين أنظمة التشغيل والتطبيقات | حماية الأنظمة | أمن الأنظمة
1-6 | إدارة الثغرات | الكشف عن الثغرات الأمنية ومعالجتها | إدارة الثغرات | الثغرات
1-7 | إدارة التهديدات | رصد ومعالجة التهديدات السيبرانية | إدارة التهديدات | التهديدات
1-8 | إدارة الحوادث السيبرانية | وضع خطة استجابة للحوادث الأمنية | إدارة الحوادث | الحوادث
1-9 | التشفير | تطبيق معايير التشفير لحماية البيانات | التشفير | حماية البيانات
1-10 | الأمن المادي | تأمين المنشآت والأجهزة فيزيائياً | الأمن المادي | الحماية الفيزيائية
1-11 | استمرارية الأعمال | وضع خطط استمرارية الأعمال والتعافي | استمرارية الأعمال | الاستمرارية
1-12 | الامتثال التنظيمي | ضمان الامتثال للأنظمة واللوائح | الامتثال | التنظيم
1-13 | التوعية والتدريب | برامج توعية وتدريب الأمن السيبراني | التوعية | التدريب
1-14 | أمن التطبيقات | تطبيق معايير أمن تطوير البرمجيات | أمن التطبيقات | تطوير آمن
1-15 | إدارة السجلات والمراقبة | تسجيل ومراقبة الأحداث الأمنية | المراقبة | السجلات`;

const DGA_SAMPLE_TEMPLATE = `DG-1 | التحول الرقمي المؤسسي | قياس مستوى التحول الرقمي في الجهة | التحول الرقمي | التحول المؤسسي
DG-2 | الخدمات الرقمية | تقديم الخدمات الحكومية رقمياً | الخدمات الرقمية | الخدمات
DG-3 | تجربة المستخدم | تحسين تجربة المستخدم للخدمات الرقمية | تجربة المستخدم | UX
DG-4 | البنية التحتية الرقمية | تطوير البنية التحتية التقنية | البنية التحتية | التقنية
DG-5 | البيانات والتحليلات | تفعيل البيانات في صنع القرار | البيانات | التحليلات
DG-6 | الابتكار الرقمي | تبني التقنيات الناشئة والابتكار | الابتكار | التقنيات الناشئة
DG-7 | الأمن السيبراني الحكومي | تطبيق معايير الأمن السيبراني الحكومي | الأمن | الأمن السيبراني
DG-8 | الحوكمة الرقمية | وضع إطار حوكمة رقمية شامل | الحوكمة | حوكمة رقمية
DG-9 | القدرات الرقمية | بناء القدرات والكفاءات الرقمية | القدرات | الموارد البشرية
DG-10 | التكامل الحكومي | تكامل الأنظمة والخدمات الحكومية | التكامل | التكامل الحكومي
DG-11 | المنصات المشتركة | استخدام المنصات الحكومية المشتركة | المنصات | المنصات المشتركة
DG-12 | قياس الأداء الرقمي | مؤشرات قياس الأداء الرقمي | الأداء | القياس
DG-13 | الهوية الرقمية | تفعيل الهوية الرقمية الوطنية | الهوية | الهوية الرقمية
DG-14 | إدارة المشاريع الرقمية | منهجيات إدارة المشاريع الرقمية | المشاريع | إدارة المشاريع
DG-15 | الشراكة والتعاون | التعاون مع القطاع الخاص والأكاديمي | الشراكة | التعاون`;
