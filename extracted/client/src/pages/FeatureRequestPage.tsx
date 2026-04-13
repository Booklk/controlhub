import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Lightbulb, Bug, AlertTriangle, Send, Clock, CheckCircle2, XCircle,
  Plus, FileText, Loader2, Sparkles, Pencil
} from 'lucide-react';
import type { FeatureRequest } from '@shared/schema';

const TYPE_OPTIONS = [
  { value: 'feature', label: 'ميزة جديدة', icon: Lightbulb, color: 'text-blue-400' },
  { value: 'bug', label: 'مشكلة تقنية', icon: Bug, color: 'text-red-400' },
  { value: 'incomplete', label: 'ميزة غير مكتملة', icon: AlertTriangle, color: 'text-amber-400' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'منخفضة' },
  { value: 'medium', label: 'متوسطة' },
  { value: 'high', label: 'عالية' },
  { value: 'urgent', label: 'عاجلة' },
  { value: 'critical', label: 'حرجة' },
];

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: 'قيد الانتظار', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  in_review: { label: 'قيد المراجعة', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  approved: { label: 'تمت الموافقة', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  in_progress: { label: 'قيد التنفيذ', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  completed: { label: 'مكتمل', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  rejected: { label: 'مرفوض', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

interface FeatureRequestPageProps {
  navGroups: any[];
  portalName: string;
  portalId: string;
}

export default function FeatureRequestPage({ navGroups, portalName, portalId }: FeatureRequestPageProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'feature',
    priority: 'medium',
  });

  const { data: requests = [], isLoading } = useQuery<FeatureRequest[]>({
    queryKey: ['/api/feature-requests'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest('POST', '/api/feature-requests', {
        ...data,
        portal: portalId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/feature-requests'] });
      toast({ title: 'تم إرسال الطلب بنجاح', description: 'سيتم إشعار المشرف بطلبك' });
      setDialogOpen(false);
      setFormData({ title: '', description: '', type: 'feature', priority: 'medium' });
    },
    onError: () => {
      toast({ title: 'خطأ', description: 'حدث خطأ أثناء إرسال الطلب', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest('PATCH', `/api/feature-requests/${editingItem?.id}`, {
        ...data,
        portal: portalId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/feature-requests'] });
      toast({ title: 'تم تحديث الطلب بنجاح' });
      setDialogOpen(false);
      setEditingItem(null);
      setFormData({ title: '', description: '', type: 'feature', priority: 'medium' });
    },
    onError: (error: Error) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });

  const handleSubmit = () => {
    if (!formData.title.trim() || !formData.description.trim()) {
      toast({ title: 'تنبيه', description: 'يرجى تعبئة جميع الحقول المطلوبة', variant: 'destructive' });
      return;
    }
    if (editingItem) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const getTypeInfo = (type: string) => TYPE_OPTIONS.find(t => t.value === type) || TYPE_OPTIONS[0];

  return (
    <DashboardLayout
      title="طلب مميزات"
      subtitle="إرسال طلب ميزة جديدة أو الإبلاغ عن مشكلة"
      navGroups={navGroups}
      portalName={portalName}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-white" data-testid="text-page-title">طلب مميزات وتحسينات</h1>
            <p className="text-sm text-white/50 mt-1">أرسل طلب ميزة جديدة، بلّغ عن مشكلة تقنية، أو أبلغ عن ميزة غير مكتملة</p>
          </div>
          <Button
            onClick={() => setDialogOpen(true)}
            className="hub-btn-gold font-semibold"
            data-testid="button-new-request"
          >
            <Plus className="w-4 h-4 ml-2" />
            طلب جديد
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TYPE_OPTIONS.map(typeOpt => {
            const Icon = typeOpt.icon;
            const count = requests.filter(r => r.type === typeOpt.value).length;
            return (
              <Card key={typeOpt.value} className="bg-white/5 border-white/10">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className={`p-2.5 rounded-lg bg-white/5 ${typeOpt.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm text-white/50">{typeOpt.label}</p>
                    <p className="text-2xl font-bold text-white" data-testid={`text-count-${typeOpt.value}`}>{count}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin hub-stat-gold" />
          </div>
        ) : requests.length === 0 ? (
          <Card className="bg-white/5 border-white/10">
            <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
              <Sparkles className="w-12 h-12 hub-stat-gold/40" />
              <p className="text-white/40 text-lg">لا توجد طلبات حالياً</p>
              <p className="text-white/50 text-sm">اضغط على "طلب جديد" لإرسال أول طلب</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {requests.map(request => {
              const typeInfo = getTypeInfo(request.type);
              const TypeIcon = typeInfo.icon;
              const statusInfo = STATUS_MAP[request.status] || STATUS_MAP.pending;

              return (
                <Card key={request.id} className="bg-white/5 border-white/10" data-testid={`card-request-${request.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className={`p-2 rounded-lg bg-white/5 ${typeInfo.color} flex-shrink-0 mt-0.5`}>
                          <TypeIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-white truncate" data-testid={`text-request-title-${request.id}`}>{request.title}</h3>
                          <p className="text-sm text-white/50 mt-1 line-clamp-2">{request.description}</p>
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            <span className="text-xs text-white/50 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(request.createdAt).toLocaleDateString('ar-SA')}
                            </span>
                            <Badge variant="outline" className={`text-[10px] ${statusInfo.color}`} data-testid={`badge-status-${request.id}`}>
                              {statusInfo.label}
                            </Badge>
                          </div>
                          {request.adminNotes && (
                            <div className="mt-2 p-2 rounded bg-white/5 border border-white/5">
                              <p className="text-xs text-white/40">ملاحظات المشرف:</p>
                              <p className="text-sm text-white/70 mt-0.5">{request.adminNotes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="hub-card border-gold/20 text-white max-w-lg" dir="rtl" data-testid="dialog-new-request">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 hub-stat-gold" />
              طلب جديد
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm text-white/60 mb-1.5 block">نوع الطلب *</label>
              <Select value={formData.type} onValueChange={v => setFormData(p => ({ ...p, type: v }))}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="select-request-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-navy/80 border-white/10">
                  {TYPE_OPTIONS.map(opt => {
                    const Icon = opt.icon;
                    return (
                      <SelectItem key={opt.value} value={opt.value} className="text-white hover:bg-white/10">
                        <span className="flex items-center gap-2">
                          <Icon className={`w-4 h-4 ${opt.color}`} />
                          {opt.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-white/60 mb-1.5 block">الأولوية *</label>
              <Select value={formData.priority} onValueChange={v => setFormData(p => ({ ...p, priority: v }))}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="select-request-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-navy/80 border-white/10">
                  {PRIORITY_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value} className="text-white hover:bg-white/10">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-white/60 mb-1.5 block">العنوان *</label>
              <Input
                value={formData.title}
                onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
                placeholder="عنوان مختصر للطلب..."
                className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                data-testid="input-request-title"
              />
            </div>

            <div>
              <label className="text-sm text-white/60 mb-1.5 block">الوصف التفصيلي *</label>
              <Textarea
                value={formData.description}
                onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                placeholder="وصف دقيق للميزة المطلوبة أو المشكلة..."
                rows={5}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/40 resize-none"
                data-testid="input-request-description"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setDialogOpen(false)} className="text-white/50" data-testid="button-cancel-request">
              إلغاء
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending}
              className="hub-btn-gold font-semibold"
              data-testid="button-submit-request"
            >
              {createMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin ml-2" />
              ) : (
                <Send className="w-4 h-4 ml-2" />
              )}
              إرسال الطلب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}