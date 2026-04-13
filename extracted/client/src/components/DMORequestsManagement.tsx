import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Send, Clock, CheckCircle2, XCircle, AlertTriangle, Loader2,
  Eye, Edit, Trash2, Search, Filter, Calendar, User, FileText, Tag
} from "lucide-react";

const defaultRequestTypes = [
  { id: 'data_update', name: 'تحديث بيانات', nameEn: 'Data Update' },
  { id: 'data_quality', name: 'جودة البيانات', nameEn: 'Data Quality' },
  { id: 'access_request', name: 'طلب وصول', nameEn: 'Access Request' },
  { id: 'report', name: 'تقرير', nameEn: 'Report' },
  { id: 'review', name: 'مراجعة', nameEn: 'Review' },
  { id: 'clarification', name: 'استفسار', nameEn: 'Clarification' },
  { id: 'other', name: 'أخرى', nameEn: 'Other' },
];

const priorityOptions = [
  { id: 'low', name: 'منخفضة', color: 'hub-badge-navy' },
  { id: 'medium', name: 'متوسطة', color: 'hub-badge-gold' },
  { id: 'high', name: 'عالية', color: 'hub-btn-gold' },
  { id: 'critical', name: 'حرجة', color: 'hub-card text-white' },
  { id: 'urgent', name: 'عاجلة', color: 'bg-red-600/20 text-red-800 border border-red-600/40' },
];

const statusOptions = [
  { id: 'pending', name: 'قيد الانتظار', icon: Clock, color: 'hub-badge-gold' },
  { id: 'in_progress', name: 'قيد التنفيذ', icon: Loader2, color: 'hub-btn-gold' },
  { id: 'completed', name: 'مكتمل', icon: CheckCircle2, color: 'bg-navy/60 text-white' },
  { id: 'rejected', name: 'مرفوض', icon: XCircle, color: 'hub-card text-white' },
  { id: 'cancelled', name: 'ملغي', icon: AlertTriangle, color: 'bg-muted-foreground text-white' },
];

interface DmoRequest {
  id: number;
  title: string;
  description?: string;
  requestType: string;
  priority: string;
  status: string;
  stewardId: number;
  requestedBy: number;
  dueDate?: string;
  response?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

interface DataSteward {
  id: number;
  name: string;
  nameEn?: string;
  email: string;
  department?: string;
}

export default function DMORequestsManagement() {
  const { toast } = useToast();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<DmoRequest | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [customRequestType, setCustomRequestType] = useState('');
  const [useCustomType, setUseCustomType] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    requestType: '',
    customType: '',
    priority: 'medium',
    stewardId: '',
    dueDate: '',
  });

  const { data: requests = [], isLoading: requestsLoading } = useQuery<DmoRequest[]>({
    queryKey: ['/api/dmo-requests'],
  });

  const { data: stewards = [] } = useQuery<DataSteward[]>({
    queryKey: ['/api/data-stewards'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/dmo-requests', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dmo-requests'] });
      toast({ title: 'تم إرسال الطلب بنجاح' });
      setIsAddOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: 'حدث خطأ في إرسال الطلب', description: error.message, variant: 'destructive' });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest('PUT', `/api/dmo-requests/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dmo-requests'] });
      toast({ title: 'تم تحديث الطلب بنجاح' });
      setIsEditOpen(false);
      setSelectedRequest(null);
    },
    onError: (error: Error) => {
      toast({ title: 'حدث خطأ في تحديث الطلب', description: error.message, variant: 'destructive' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/dmo-requests/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dmo-requests'] });
      toast({ title: 'تم حذف الطلب بنجاح' });
    },
    onError: (error: Error) => {
      toast({ title: 'حدث خطأ في حذف الطلب', description: error.message, variant: 'destructive' });
    }
  });

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      requestType: '',
      customType: '',
      priority: 'medium',
      stewardId: '',
      dueDate: '',
    });
    setUseCustomType(false);
    setCustomRequestType('');
  };

  const handleSubmit = () => {
    if (!formData.title || !formData.stewardId) {
      toast({ title: 'يرجى ملء جميع الحقول المطلوبة', variant: 'destructive' });
      return;
    }

    const requestType = useCustomType ? customRequestType : formData.requestType;
    if (!requestType) {
      toast({ title: 'يرجى تحديد نوع الطلب', variant: 'destructive' });
      return;
    }

    createMutation.mutate({
      title: formData.title,
      description: formData.description,
      requestType,
      priority: formData.priority,
      stewardId: parseInt(formData.stewardId),
      dueDate: formData.dueDate ? new Date(formData.dueDate) : null,
    });
  };

  const handleUpdate = () => {
    if (!selectedRequest) return;
    
    const requestType = useCustomType ? customRequestType : formData.requestType;
    
    updateMutation.mutate({
      id: selectedRequest.id,
      data: {
        title: formData.title,
        description: formData.description,
        requestType: requestType || selectedRequest.requestType,
        priority: formData.priority,
        stewardId: parseInt(formData.stewardId),
        dueDate: formData.dueDate ? new Date(formData.dueDate) : null,
      }
    });
  };

  const openEditDialog = (request: DmoRequest) => {
    setSelectedRequest(request);
    const isCustom = !defaultRequestTypes.find(t => t.id === request.requestType);
    setUseCustomType(isCustom);
    setCustomRequestType(isCustom ? request.requestType : '');
    setFormData({
      title: request.title,
      description: request.description || '',
      requestType: isCustom ? '' : request.requestType,
      customType: isCustom ? request.requestType : '',
      priority: request.priority,
      stewardId: request.stewardId.toString(),
      dueDate: request.dueDate ? new Date(request.dueDate).toISOString().split('T')[0] : '',
    });
    setIsEditOpen(true);
  };

  const getRequestTypeName = (typeId: string) => {
    const type = defaultRequestTypes.find(t => t.id === typeId);
    return type ? type.name : typeId;
  };

  const getPriorityBadge = (priority: string) => {
    const opt = priorityOptions.find(p => p.id === priority);
    return opt ? (
      <Badge className={`${opt.color} border-0`}>{opt.name}</Badge>
    ) : (
      <Badge>{priority}</Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const opt = statusOptions.find(s => s.id === status);
    if (!opt) return <Badge>{status}</Badge>;
    const Icon = opt.icon;
    return (
      <Badge className={`${opt.color} border-0 gap-1`}>
        <Icon className="w-3 h-3" />
        {opt.name}
      </Badge>
    );
  };

  const getStewardName = (stewardId: number) => {
    const steward = stewards.find(s => s.id === stewardId);
    return steward?.name || 'غير محدد';
  };

  const filteredRequests = requests.filter(req => {
    const matchesSearch = req.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || req.status === filterStatus;
    const matchesPriority = filterPriority === 'all' || req.priority === filterPriority;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    inProgress: requests.filter(r => r.status === 'in_progress').length,
    completed: requests.filter(r => r.status === 'completed').length,
  };

  if (requestsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin hub-stat-gold" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">طلبات ممثلي البيانات</h2>
          <p className="text-muted-foreground">إرسال وإدارة الطلبات لممثلي بيانات الأعمال</p>
        </div>
        <Button 
          onClick={() => setIsAddOpen(true)}
          className="hub-btn-gold gap-2"
          data-testid="button-add-request"
        >
          <Plus className="w-4 h-4" />
          طلب جديد
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-foreground/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg hub-icon-navy">
                <FileText className="w-5 h-5 text-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي الطلبات</p>
                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-gold/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg hub-icon-gold">
                <Clock className="w-5 h-5 hub-stat-gold" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">قيد الانتظار</p>
                <p className="text-2xl font-bold hub-stat-gold">{stats.pending}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-gold/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg hub-icon-gold">
                <Loader2 className="w-5 h-5 text-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">قيد التنفيذ</p>
                <p className="text-2xl font-bold text-foreground">{stats.inProgress}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-foreground/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg hub-icon-navy">
                <CheckCircle2 className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">مكتملة</p>
                <p className="text-2xl font-bold text-muted-foreground">{stats.completed}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="بحث في الطلبات..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-9 text-right"
                data-testid="input-search-requests"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]" data-testid="select-filter-status">
                <Filter className="w-4 h-4 ml-2" />
                <SelectValue placeholder="الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                {statusOptions.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-[150px]" data-testid="select-filter-priority">
                <SelectValue placeholder="الأولوية" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الأولويات</SelectItem>
                {priorityOptions.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredRequests.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">لا توجد طلبات</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">العنوان</TableHead>
                  <TableHead className="text-right">نوع الطلب</TableHead>
                  <TableHead className="text-right">ممثل البيانات</TableHead>
                  <TableHead className="text-right">الأولوية</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">تاريخ الاستحقاق</TableHead>
                  <TableHead className="text-right">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((request) => (
                  <TableRow key={request.id} data-testid={`row-request-${request.id}`}>
                    <TableCell className="font-medium">{request.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1">
                        <Tag className="w-3 h-3" />
                        {getRequestTypeName(request.requestType)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3 text-muted-foreground" />
                        {getStewardName(request.stewardId)}
                      </div>
                    </TableCell>
                    <TableCell>{getPriorityBadge(request.priority)}</TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                    <TableCell>
                      {request.dueDate ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="w-3 h-3" />
                          {new Date(request.dueDate).toLocaleDateString('ar-SA')}
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => { setSelectedRequest(request); setIsViewOpen(true); }}
                          data-testid={`button-view-request-${request.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEditDialog(request)}
                          data-testid={`button-edit-request-${request.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteMutation.mutate(request.id)}
                          data-testid={`button-delete-request-${request.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
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

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">طلب جديد لممثل البيانات</DialogTitle>
            <DialogDescription className="text-right">
              أرسل طلباً لممثل بيانات الأعمال لتنفيذه
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-right block mb-2">عنوان الطلب *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="أدخل عنوان الطلب"
                className="text-right"
                data-testid="input-request-title"
              />
            </div>
            <div>
              <Label className="text-right block mb-2">الوصف</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="وصف تفصيلي للطلب"
                className="text-right min-h-[100px]"
                data-testid="input-request-description"
              />
            </div>
            <div>
              <Label className="text-right block mb-2">نوع الطلب *</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={useCustomType}
                    onChange={(e) => setUseCustomType(e.target.checked)}
                    className="rounded border-foreground"
                    data-testid="checkbox-custom-type"
                  />
                  <span className="text-sm text-muted-foreground">استخدام نوع مخصص</span>
                </div>
                {useCustomType ? (
                  <Input
                    value={customRequestType}
                    onChange={(e) => setCustomRequestType(e.target.value)}
                    placeholder="أدخل نوع الطلب المخصص"
                    className="text-right"
                    data-testid="input-custom-type"
                  />
                ) : (
                  <Select 
                    value={formData.requestType} 
                    onValueChange={(v) => setFormData({ ...formData, requestType: v })}
                  >
                    <SelectTrigger data-testid="select-request-type">
                      <SelectValue placeholder="اختر نوع الطلب" />
                    </SelectTrigger>
                    <SelectContent>
                      {defaultRequestTypes.map(type => (
                        <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
            <div>
              <Label className="text-right block mb-2">ممثل البيانات *</Label>
              <Select 
                value={formData.stewardId} 
                onValueChange={(v) => setFormData({ ...formData, stewardId: v })}
              >
                <SelectTrigger data-testid="select-steward">
                  <SelectValue placeholder="اختر ممثل البيانات" />
                </SelectTrigger>
                <SelectContent>
                  {stewards.map(steward => (
                    <SelectItem key={steward.id} value={steward.id.toString()}>
                      {steward.name} - {steward.department || 'غير محدد'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-right block mb-2">الأولوية</Label>
                <Select 
                  value={formData.priority} 
                  onValueChange={(v) => setFormData({ ...formData, priority: v })}
                >
                  <SelectTrigger data-testid="select-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {priorityOptions.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-right block mb-2">تاريخ الاستحقاق</Label>
                <Input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  data-testid="input-due-date"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setIsAddOpen(false); resetForm(); }}>
              إلغاء
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={createMutation.isPending}
              className="hub-btn-gold gap-2"
              data-testid="button-submit-request"
            >
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              إرسال الطلب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">تفاصيل الطلب</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-sm">العنوان</Label>
                  <p className="font-medium">{selectedRequest.title}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm">نوع الطلب</Label>
                  <p>{getRequestTypeName(selectedRequest.requestType)}</p>
                </div>
              </div>
              {selectedRequest.description && (
                <div>
                  <Label className="text-muted-foreground text-sm">الوصف</Label>
                  <p className="text-sm">{selectedRequest.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-sm">ممثل البيانات</Label>
                  <p>{getStewardName(selectedRequest.stewardId)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm">الأولوية</Label>
                  <div className="mt-1">{getPriorityBadge(selectedRequest.priority)}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-sm">الحالة</Label>
                  <div className="mt-1">{getStatusBadge(selectedRequest.status)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm">تاريخ الاستحقاق</Label>
                  <p>{selectedRequest.dueDate ? new Date(selectedRequest.dueDate).toLocaleDateString('ar-SA') : '-'}</p>
                </div>
              </div>
              {selectedRequest.response && (
                <div className="p-3 rounded-lg bg-muted/30 border border-foreground/10">
                  <Label className="text-muted-foreground text-sm">رد ممثل البيانات</Label>
                  <p className="text-sm mt-1">{selectedRequest.response}</p>
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                تاريخ الإنشاء: {new Date(selectedRequest.createdAt).toLocaleString('ar-SA')}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewOpen(false)}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">تعديل الطلب</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-right block mb-2">عنوان الطلب *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="text-right"
                data-testid="input-edit-title"
              />
            </div>
            <div>
              <Label className="text-right block mb-2">الوصف</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="text-right min-h-[100px]"
                data-testid="input-edit-description"
              />
            </div>
            <div>
              <Label className="text-right block mb-2">نوع الطلب</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={useCustomType}
                    onChange={(e) => setUseCustomType(e.target.checked)}
                    className="rounded border-foreground"
                  />
                  <span className="text-sm text-muted-foreground">استخدام نوع مخصص</span>
                </div>
                {useCustomType ? (
                  <Input
                    value={customRequestType}
                    onChange={(e) => setCustomRequestType(e.target.value)}
                    placeholder="أدخل نوع الطلب المخصص"
                    className="text-right"
                  />
                ) : (
                  <Select 
                    value={formData.requestType} 
                    onValueChange={(v) => setFormData({ ...formData, requestType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر نوع الطلب" />
                    </SelectTrigger>
                    <SelectContent>
                      {defaultRequestTypes.map(type => (
                        <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
            <div>
              <Label className="text-right block mb-2">ممثل البيانات</Label>
              <Select 
                value={formData.stewardId} 
                onValueChange={(v) => setFormData({ ...formData, stewardId: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stewards.map(steward => (
                    <SelectItem key={steward.id} value={steward.id.toString()}>
                      {steward.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-right block mb-2">الأولوية</Label>
                <Select 
                  value={formData.priority} 
                  onValueChange={(v) => setFormData({ ...formData, priority: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {priorityOptions.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-right block mb-2">تاريخ الاستحقاق</Label>
                <Input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>إلغاء</Button>
            <Button 
              onClick={handleUpdate}
              disabled={updateMutation.isPending}
              className="hub-btn-gold"
              data-testid="button-update-request"
            >
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              حفظ التعديلات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
