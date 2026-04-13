import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import DashboardLayout from '@/components/DashboardLayout';
import { adminNavGroups } from '@/lib/navigation';
import { KpiCard } from '@/components/Quality';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Lightbulb, Bug, AlertTriangle, Clock, Mail, User, Loader2,
  Sparkles, Trash2, MessageSquare, Filter
} from 'lucide-react';
import type { FeatureRequest } from '@shared/schema';

const TYPE_MAP: Record<string, { label: string; icon: any; color: string }> = {
  feature: { label: 'ميزة جديدة', icon: Lightbulb, color: 'text-blue-400' },
  bug: { label: 'مشكلة تقنية', icon: Bug, color: 'text-red-400' },
  incomplete: { label: 'ميزة غير مكتملة', icon: AlertTriangle, color: 'text-amber-400' },
};

const STATUS_OPTIONS = [
  { value: 'pending', label: 'قيد الانتظار' },
  { value: 'in_review', label: 'قيد المراجعة' },
  { value: 'approved', label: 'تمت الموافقة' },
  { value: 'in_progress', label: 'قيد التنفيذ' },
  { value: 'completed', label: 'مكتمل' },
  { value: 'rejected', label: 'مرفوض' },
];

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: 'قيد الانتظار', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  in_review: { label: 'قيد المراجعة', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  approved: { label: 'تمت الموافقة', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  in_progress: { label: 'قيد التنفيذ', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  completed: { label: 'مكتمل', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  rejected: { label: 'مرفوض', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

const PRIORITY_MAP: Record<string, { label: string; color: string }> = {
  low: { label: 'منخفضة', color: 'text-gray-400' },
  medium: { label: 'متوسطة', color: 'text-blue-400' },
  high: { label: 'عالية', color: 'text-orange-400' },
  urgent: { label: 'عاجلة', color: 'text-red-500' },
  critical: { label: 'حرجة', color: 'text-red-400' },
};

const PORTAL_LABELS: Record<string, string> = {
  system_admin: 'المشرف',
  it_director: 'مدير تقنية المعلومات',
  cybersecurity: 'الأمن السيبراني',
  infrastructure: 'البنية التحتية',
  digital_transformation: 'التحول الرقمي',
  support: 'الدعم الفني',
  dmo: 'إدارة البيانات',
  committee: 'اللجان',
};

export default function AdminFeatureRequestsPage() {
  const { toast } = useToast();
  const [selectedRequest, setSelectedRequest] = useState<FeatureRequest | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const { data: requests = [], isLoading } = useQuery<FeatureRequest[]>({
    queryKey: ['/api/feature-requests'],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, adminNotes }: { id: number; status: string; adminNotes: string }) => {
      const res = await apiRequest('PATCH', `/api/feature-requests/${id}`, { status, adminNotes });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/feature-requests'] });
      toast({ title: 'تم تحديث الطلب بنجاح' });
      setSelectedRequest(null);
    },
    onError: () => {
      toast({ title: 'خطأ', description: 'حدث خطأ أثناء تحديث الطلب', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/feature-requests/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/feature-requests'] });
      toast({ title: 'تم حذف الطلب بنجاح' });
      setDeleteId(null);
    },
    onError: () => {
      toast({ title: 'خطأ', description: 'حدث خطأ أثناء حذف الطلب', variant: 'destructive' });
    },
  });

  const handleUpdate = () => {
    if (!selectedRequest) return;
    updateMutation.mutate({ id: selectedRequest.id, status: editStatus, adminNotes: editNotes });
  };

  const openEditDialog = (request: FeatureRequest) => {
    setSelectedRequest(request);
    setEditStatus(request.status);
    setEditNotes(request.adminNotes || '');
  };

  const filteredRequests = requests.filter(r => {
    if (filterType !== 'all' && r.type !== filterType) return false;
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    return true;
  });

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const inProgressCount = requests.filter(r => r.status === 'in_progress' || r.status === 'in_review').length;
  const completedCount = requests.filter(r => r.status === 'completed').length;

  return (
    <DashboardLayout
      title="إدارة طلبات المميزات"
      subtitle="عرض ومراجعة طلبات المميزات والتحسينات"
      navGroups={adminNavGroups}
      portalName="مشرف النظام"
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <KpiCard label="قيد الانتظار" value={pendingCount} icon={Clock} color={pendingCount > 0 ? "gold" : "muted"} />
          <KpiCard label="قيد التنفيذ" value={inProgressCount} icon={Loader2} color="navy" />
          <KpiCard label="مكتمل" value={completedCount} icon={Sparkles} color="success" />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Filter className="w-4 h-4 text-white/40" />
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-40 bg-white/5 border-white/10 text-white" data-testid="select-filter-type">
              <SelectValue placeholder="نوع الطلب" />
            </SelectTrigger>
            <SelectContent className="bg-navy/80 border-white/10">
              <SelectItem value="all" className="text-white">الكل</SelectItem>
              <SelectItem value="feature" className="text-white">ميزة جديدة</SelectItem>
              <SelectItem value="bug" className="text-white">مشكلة تقنية</SelectItem>
              <SelectItem value="incomplete" className="text-white">ميزة غير مكتملة</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40 bg-white/5 border-white/10 text-white" data-testid="select-filter-status">
              <SelectValue placeholder="الحالة" />
            </SelectTrigger>
            <SelectContent className="bg-navy/80 border-white/10">
              <SelectItem value="all" className="text-white">الكل</SelectItem>
              {STATUS_OPTIONS.map(s => (
                <SelectItem key={s.value} value={s.value} className="text-white">{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin hub-stat-gold" />
          </div>
        ) : filteredRequests.length === 0 ? (
          <Card className="bg-white/5 border-white/10">
            <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
              <Sparkles className="w-12 h-12 hub-stat-gold/40" />
              <p className="text-white/40 text-lg">لا توجد طلبات</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredRequests.map(request => {
              const typeInfo = TYPE_MAP[request.type] || TYPE_MAP.feature;
              const TypeIcon = typeInfo.icon;
              const statusInfo = STATUS_MAP[request.status] || STATUS_MAP.pending;
              const priorityInfo = PRIORITY_MAP[request.priority] || PRIORITY_MAP.medium;

              return (
                <Card key={request.id} className="bg-white/5 border-white/10" data-testid={`card-admin-request-${request.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className={`p-2 rounded-lg bg-white/5 ${typeInfo.color} flex-shrink-0 mt-0.5`}>
                          <TypeIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-white">{request.title}</h3>
                            <Badge variant="outline" className={`text-[10px] ${statusInfo.color}`}>
                              {statusInfo.label}
                            </Badge>
                            <Badge variant="outline" className={`text-[10px] ${priorityInfo.color} border-current/20`}>
                              {priorityInfo.label}
                            </Badge>
                          </div>
                          <p className="text-sm text-white/50 mt-1 line-clamp-2">{request.description}</p>
                          <div className="flex items-center gap-4 mt-2 flex-wrap text-xs text-white/50">
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {request.submitterName}
                            </span>
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {request.submitterEmail}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(request.createdAt).toLocaleDateString('ar-SA')}
                            </span>
                            <Badge variant="outline" className="text-[10px] text-white/40 border-white/10">
                              {PORTAL_LABELS[request.portal] || request.portal}
                            </Badge>
                          </div>
                          {request.adminNotes && (
                            <div className="mt-2 p-2 rounded bg-white/5 border border-white/5">
                              <p className="text-xs text-white/40">ملاحظات:</p>
                              <p className="text-sm text-white/70 mt-0.5">{request.adminNotes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEditDialog(request)}
                          className="text-white/40 hover:text-white"
                          data-testid={`button-edit-request-${request.id}`}
                        >
                          <MessageSquare className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setDeleteId(request.id)}
                          className="text-red-400/40 hover:text-red-400"
                          data-testid={`button-delete-request-${request.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="hub-card border-gold/20 text-white max-w-lg" dir="rtl" data-testid="dialog-edit-request">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 hub-stat-gold" />
              مراجعة الطلب
            </DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4 pt-2">
              <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                <h4 className="font-semibold text-white">{selectedRequest.title}</h4>
                <p className="text-sm text-white/60 mt-1">{selectedRequest.description}</p>
                <p className="text-xs text-white/50 mt-2">مقدم من: {selectedRequest.submitterName}</p>
              </div>

              <div>
                <label className="text-sm text-white/60 mb-1.5 block">تغيير الحالة</label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="select-edit-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-navy/80 border-white/10">
                    {STATUS_OPTIONS.map(s => (
                      <SelectItem key={s.value} value={s.value} className="text-white">{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm text-white/60 mb-1.5 block">ملاحظات المشرف</label>
                <Textarea
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  placeholder="أضف ملاحظة للمستخدم..."
                  rows={3}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/40 resize-none"
                  data-testid="input-admin-notes"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setSelectedRequest(null)} className="text-white/50">
              إلغاء
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updateMutation.isPending}
              className="hub-btn-gold font-semibold"
              data-testid="button-update-request"
            >
              {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
              حفظ التغييرات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="hub-card border-gold/20 text-white" dir="rtl" data-testid="dialog-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription className="text-white/50">
              هل أنت متأكد من حذف هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/10 text-white hover:bg-white/10">
              إلغاء
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-red-500/80 text-white hover:bg-red-500"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}