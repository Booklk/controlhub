import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, invalidateRelatedQueries } from "@/lib/queryClient";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Lightbulb, TrendingUp, Target, Calendar, FileDown, FileSpreadsheet } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { digitalTransformationNavGroups } from "@/lib/navigation";
import { exportToPDF, exportToExcel, formatStatus} from '@/lib/exports';
import { useConfirmDialog, ConfirmDialog } from '@/components/ConfirmDialog';
import { PageHeader, KpiCard } from "@/components/Quality";
import { LoadingButton } from "@/components/LoadingButton";

const statusLabels: Record<string, string> = {
  proposed: "مقترح",
  approved: "معتمد",
  in_progress: "قيد التنفيذ",
  completed: "مكتمل",
  on_hold: "معلق",
  cancelled: "ملغي"
};

const categoryLabels: Record<string, string> = {
  automation: "أتمتة العمليات",
  ai_ml: "الذكاء الاصطناعي",
  cloud: "الحوسبة السحابية",
  mobile: "التطبيقات الجوالة",
  analytics: "التحليلات",
  integration: "التكامل",
  security: "الأمن الرقمي",
  customer_experience: "تجربة العميل"
};

const priorityLabels: Record<string, string> = {
  urgent: "عاجل",
  low: "منخفض",
  medium: "متوسط",
  high: "عالي",
  critical: "حرج"
};

export default function DigitalInitiatives() {
  const { toast } = useToast();
  const { confirm: confirmAction, dialogProps } = useConfirmDialog();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: "",
    titleEn: "",
    description: "",
    objectives: "",
    category: "automation",
    priority: "medium",
    status: "proposed",
    budget: "",
    startDate: "",
    targetEndDate: "",
    benefitsMeasured: "",
    roiTarget: ""
  });

  const { data: initiatives = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/digital-initiatives"]
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/digital-initiatives", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/digital-initiatives"] });
      invalidateRelatedQueries('/api/digital-initiatives');
      setIsDialogOpen(false);
      resetForm();
      toast({ title: "تم إنشاء المبادرة بنجاح" });
    },
    onError: () => {
      toast({ title: 'خطأ في إنشاء المبادرة', variant: 'destructive' });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => 
      apiRequest("PUT", `/api/digital-initiatives/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/digital-initiatives"] });
      invalidateRelatedQueries('/api/digital-initiatives');
      setIsDialogOpen(false);
      setEditingItem(null);
      resetForm();
      toast({ title: "تم تحديث المبادرة بنجاح" });
    },
    onError: () => {
      toast({ title: 'خطأ في تحديث المبادرة', variant: 'destructive' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/digital-initiatives/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/digital-initiatives"] });
      invalidateRelatedQueries('/api/digital-initiatives');
      toast({ title: "تم حذف المبادرة بنجاح" });
    },
    onError: () => {
      toast({ title: 'خطأ في حذف المبادرة', variant: 'destructive' });
    }
  });

  const resetForm = () => {
    setFormData({
      title: "", titleEn: "", description: "", objectives: "",
      category: "automation", priority: "medium", status: "proposed",
      budget: "", startDate: "", targetEndDate: "", benefitsMeasured: "", roiTarget: ""
    });
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setFormData({
      title: item.title || "",
      titleEn: item.titleEn || "",
      description: item.description || "",
      objectives: item.objectives || "",
      category: item.category || "automation",
      priority: item.priority || "medium",
      status: item.status || "proposed",
      budget: item.budget?.toString() || "",
      startDate: item.startDate ? new Date(item.startDate).toISOString().split('T')[0] : "",
      targetEndDate: item.targetEndDate ? new Date(item.targetEndDate).toISOString().split('T')[0] : "",
      benefitsMeasured: item.benefitsMeasured || "",
      roiTarget: item.roiTarget?.toString() || ""
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.title.trim()) {
      toast({ title: "تنبيه", description: "يرجى إدخال عنوان المبادرة", variant: "destructive" });
      return;
    }
    const data = {
      ...formData,
      budget: formData.budget ? parseFloat(formData.budget) : null,
      roiTarget: formData.roiTarget ? parseFloat(formData.roiTarget) : null,
      startDate: formData.startDate || null,
      targetEndDate: formData.targetEndDate || null
    };

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      proposed: "hub-badge-info",
      approved: "hub-badge-success",
      in_progress: "hub-badge-gold",
      completed: "hub-badge-success",
      on_hold: "hub-badge-warning",
      cancelled: "hub-badge-danger"
    };
    return colors[status] || "hub-badge-neutral";
  };

  const stats = {
    total: initiatives.length,
    inProgress: initiatives.filter((i: any) => i.status === "in_progress").length,
    completed: initiatives.filter((i: any) => i.status === "completed").length,
    totalBudget: initiatives.reduce((sum: number, i: any) => sum + (parseFloat(i.budget) || 0), 0)
  };


  const handleExportPDF = () => {
    exportToPDF({
      title: 'تقرير المبادرات الرقمية',
      subtitle: 'JCSA - Control Hub',
      columns: [{"header":"المبادرة","key":"title","width":40},{"header":"الحالة","key":"status","width":20},{"header":"التقدم","key":"progress","width":20},{"header":"تاريخ البدء","key":"startDate","width":25}],
      data: (initiatives || []).map((item: any) => ({ title: item.title || '', status: formatStatus(item.status || ''), progress: (item.progress?.toString() || '0') + '%', startDate: item.startDate ? new Date(item.startDate).toLocaleDateString('ar-SA') : '' })),
      filename: 'digital-initiatives-report',
      orientation: 'landscape',
    });
  };

  const handleExportExcel = () => {
    exportToExcel({
      title: 'تقرير المبادرات الرقمية',
      columns: [{"header":"المبادرة","key":"title","width":40},{"header":"الحالة","key":"status","width":20},{"header":"التقدم","key":"progress","width":20},{"header":"تاريخ البدء","key":"startDate","width":25}],
      data: (initiatives || []).map((item: any) => ({ title: item.title || '', status: formatStatus(item.status || ''), progress: (item.progress?.toString() || '0') + '%', startDate: item.startDate ? new Date(item.startDate).toLocaleDateString('ar-SA') : '' })),
      filename: 'digital-initiatives-report',
    });
  };

  return (
    <DashboardLayout
      title="مبادرات التحول الرقمي"
      subtitle="إدارة ومتابعة مبادرات التحول الرقمي"
      navGroups={digitalTransformationNavGroups}
      portalName="التحول الرقمي"
    >
      <div className="space-y-5">
        <PageHeader
          icon={Lightbulb}
          title="مبادرات التحول الرقمي"
          subtitle="إدارة ومتابعة مبادرات التحول الرقمي"
          actions={
            <>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportPDF} data-testid="button-export-pdf"><FileDown className="w-3.5 h-3.5" />PDF</Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportExcel} data-testid="button-export-excel"><FileSpreadsheet className="w-3.5 h-3.5" />Excel</Button>
              <Button onClick={() => { resetForm(); setEditingItem(null); setIsDialogOpen(true); }} className="btn-gold h-9 gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" />
                إضافة مبادرة
              </Button>
            </>
          }
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="إجمالي المبادرات" value={stats.total} icon={Lightbulb} color="navy" />
          <KpiCard label="قيد التنفيذ" value={stats.inProgress} icon={TrendingUp} color="gold" />
          <KpiCard label="مكتملة" value={stats.completed} icon={Target} color="success" />
          <KpiCard label="الميزانية" value={`${stats.totalBudget.toLocaleString()} ر`} icon={Calendar} color="info" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>قائمة المبادرات</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="flex items-center gap-4 p-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>
            ) : initiatives.length === 0 ? (
              <div className="text-center py-12">
                <Lightbulb className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
                <p className="text-muted-foreground font-medium">لا توجد مبادرات رقمية</p>
                <p className="text-sm text-muted-foreground/60 mt-1">اضغط على "إضافة مبادرة" لإنشاء أول مبادرة</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الكود</TableHead>
                    <TableHead>المبادرة</TableHead>
                    <TableHead>الفئة</TableHead>
                    <TableHead>الأولوية</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>التقدم</TableHead>
                    <TableHead>الميزانية</TableHead>
                    <TableHead>الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {initiatives.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-sm">{item.initiativeCode}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{item.title}</div>
                          {item.titleEn && <div className="text-sm text-muted-foreground">{item.titleEn}</div>}
                        </div>
                      </TableCell>
                      <TableCell>{categoryLabels[item.category] || item.category}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{priorityLabels[item.priority] || item.priority}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(item.status)}>
                          {statusLabels[item.status] || item.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="w-20">
                          <Progress value={item.progress || 0} className="h-2" />
                          <span className="text-xs text-muted-foreground">{item.progress || 0}%</span>
                        </div>
                      </TableCell>
                      <TableCell>{item.budget ? `${parseFloat(item.budget).toLocaleString()} ريال` : "-"}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="icon" variant="ghost" onClick={() => handleEdit(item)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-red-600" disabled={deleteMutation.isPending} onClick={() => confirmAction(() => deleteMutation.mutate(item.id), { title: 'تأكيد الحذف', description: 'هل أنت متأكد من حذف هذه المبادرة؟ لا يمكن التراجع عن هذا الإجراء.' })}>
                            <Trash2 className="h-4 w-4" />
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

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle>{editingItem ? "تعديل المبادرة" : "إضافة مبادرة جديدة"}</DialogTitle>
            </DialogHeader>
            <DialogBody className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>اسم المبادرة (عربي) *</Label>
                  <Input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                </div>
                <div>
                  <Label>اسم المبادرة (إنجليزي)</Label>
                  <Input value={formData.titleEn} onChange={e => setFormData({...formData, titleEn: e.target.value})} />
                </div>
              </div>
              <div>
                <Label>الوصف</Label>
                <Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows={3} />
              </div>
              <div>
                <Label>الأهداف</Label>
                <Textarea value={formData.objectives} onChange={e => setFormData({...formData, objectives: e.target.value})} rows={2} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>الفئة</Label>
                  <Select value={formData.category} onValueChange={v => setFormData({...formData, category: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(categoryLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>الأولوية</Label>
                  <Select value={formData.priority} onValueChange={v => setFormData({...formData, priority: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(priorityLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>الحالة</Label>
                  <Select value={formData.status} onValueChange={v => setFormData({...formData, status: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(statusLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>الميزانية (ريال)</Label>
                  <Input type="number" value={formData.budget} onChange={e => setFormData({...formData, budget: e.target.value})} />
                </div>
                <div>
                  <Label>تاريخ البدء</Label>
                  <Input type="date" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} />
                </div>
                <div>
                  <Label>تاريخ الانتهاء المتوقع</Label>
                  <Input type="date" value={formData.targetEndDate} onChange={e => setFormData({...formData, targetEndDate: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>الفوائد المتوقعة</Label>
                  <Textarea value={formData.benefitsMeasured} onChange={e => setFormData({...formData, benefitsMeasured: e.target.value})} rows={2} />
                </div>
                <div>
                  <Label>العائد على الاستثمار المستهدف (%)</Label>
                  <Input type="number" value={formData.roiTarget} onChange={e => setFormData({...formData, roiTarget: e.target.value})} />
                </div>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
              <LoadingButton onClick={handleSubmit} className="btn-gold"
                loading={createMutation.isPending || updateMutation.isPending}
                loadingText={editingItem ? "جاري التحديث..." : "جاري الإنشاء..."}>
                {editingItem ? "تحديث المبادرة" : "إضافة المبادرة"}
              </LoadingButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <ConfirmDialog {...dialogProps} />
    </DashboardLayout>
  );
}
