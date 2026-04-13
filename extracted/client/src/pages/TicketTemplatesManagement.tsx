import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader, KpiCard } from "@/components/Quality";
import { LoadingButton } from "@/components/LoadingButton";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription,
  CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  Pencil, 
  Trash2, 
  FileStack,
  CheckSquare,
  Layout,
  Tag,
  X,
  ToggleLeft
} from "lucide-react";
import { useState } from "react";
import { useConfirmDialog, ConfirmDialog } from "@/components/ConfirmDialog";
import { adminNavGroups, itDirectorNavGroups } from "@/lib/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";

interface ChecklistItem {
  item: string;
  required: boolean;
}

interface TicketTemplate {
  id: number;
  name: string;
  description: string | null;
  itDepartmentId: number | null;
  defaultPriority: string;
  defaultCategory: string | null;
  defaultTitle: string | null;
  defaultDescription: string | null;
  checklist: ChecklistItem[];
  isActive: boolean;
  createdAt: string;
}

const DEPARTMENTS = [
  { value: "all", label: "كل الأقسام" },
  { value: "9", label: "البنية التحتية" },
  { value: "10", label: "الأمن السيبراني" },
  { value: "11", label: "التحول الرقمي" },
  { value: "12", label: "الدعم الفني" },
];

const PRIORITIES = [
  { value: "low", label: "منخفضة" },
  { value: "medium", label: "متوسطة" },
  { value: "high", label: "عالية" },
  { value: "critical", label: "حرجة" },
];

const getPriorityColor = (p: string) => {
  switch (p) {
    case 'low': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    case 'medium': return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
    case 'high': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    case 'critical': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    default: return 'bg-white/10 text-white border-white/20';
  }
};

export default function TicketTemplatesManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { confirm, dialogProps } = useConfirmDialog();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TicketTemplate | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);

  const { data: templates = [], isLoading } = useQuery<TicketTemplate[]>({
    queryKey: ["/api/ticket-templates/all"],
  });

  const createMutation = useMutation({
    mutationFn: async (newTpl: Partial<TicketTemplate>) => {
      const res = await apiRequest("POST", "/api/ticket-templates", newTpl);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ticket-templates/all"] });
      toast({ title: "تم إنشاء القالب بنجاح" });
      setIsDialogOpen(false);
      setEditingTemplate(null);
    },
    onError: () => toast({ title: "فشل في إنشاء القالب", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (updatedTpl: TicketTemplate) => {
      const res = await apiRequest("PUT", `/api/ticket-templates/${updatedTpl.id}`, updatedTpl);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ticket-templates/all"] });
      toast({ title: "تم تحديث القالب بنجاح" });
      setIsDialogOpen(false);
      setEditingTemplate(null);
    },
    onError: () => toast({ title: "فشل في تحديث القالب", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/ticket-templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ticket-templates/all"] });
      toast({ title: "تم حذف القالب بنجاح" });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const templateData: any = {
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      itDepartmentId: formData.get("itDepartmentId") === "all" ? null : Number(formData.get("itDepartmentId")),
      defaultPriority: formData.get("defaultPriority") as string,
      defaultCategory: formData.get("defaultCategory") as string,
      defaultTitle: formData.get("defaultTitle") as string,
      defaultDescription: formData.get("defaultDescription") as string,
      checklist,
    };
    if (editingTemplate) {
      updateMutation.mutate({ ...editingTemplate, ...templateData });
    } else {
      createMutation.mutate(templateData);
    }
  };

  const addChecklistItem = () => {
    setChecklist([...checklist, { item: "", required: false }]);
  };

  const updateChecklistItem = (index: number, field: keyof ChecklistItem, value: any) => {
    const updated = [...checklist];
    updated[index] = { ...updated[index], [field]: value };
    setChecklist(updated);
  };

  const removeChecklistItem = (index: number) => {
    setChecklist(checklist.filter((_, i) => i !== index));
  };

  const handleToggleActive = (tpl: TicketTemplate) => {
    updateMutation.mutate({ ...tpl, isActive: !tpl.isActive });
  };

  const handleDelete = (id: number) => {
    confirm(() => deleteMutation.mutate(id), {
      title: "حذف قالب التذكرة",
      description: "هل أنت متأكد من حذف هذا القالب؟ لا يمكن التراجع عن هذا الإجراء.",
      confirmText: "حذف",
      variant: "destructive",
    });
  };

  const getNavGroups = () => {
    if (user?.role === "system_admin") return adminNavGroups;
    return itDirectorNavGroups;
  };

  const activeTemplates = templates.filter(t => t.isActive).length;
  const totalChecklist = templates.reduce((sum, t) => sum + (t.checklist || []).length, 0);

  return (
    <DashboardLayout
      title="قوالب التذاكر"
      subtitle="إدارة قوالب التذاكر الجاهزة لتسهيل عملية إنشاء طلبات الدعم"
      navGroups={getNavGroups()}
      portalName={user?.role === 'system_admin' ? 'بوابة مدير النظام' : 'بوابة مدير تقنية المعلومات'}
    >
      <ConfirmDialog {...dialogProps} isPending={deleteMutation.isPending} />
      <div className="space-y-5" dir="rtl">
        <PageHeader
          icon={FileStack}
          title="قوالب التذاكر"
          subtitle="إدارة قوالب التذاكر الجاهزة لتسهيل عملية إنشاء طلبات الدعم"
          actions={
            <Button variant="gold" className="gap-2 h-9 text-xs" onClick={() => { setEditingTemplate(null); setChecklist([]); setIsDialogOpen(true); }} data-testid="button-add-ticket-template">
              <Plus className="w-3.5 h-3.5" />
              إضافة قالب
            </Button>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="إجمالي القوالب" value={templates.length} icon={FileStack} color="navy" />
          <KpiCard label="القوالب النشطة" value={activeTemplates} icon={ToggleLeft} color="success" />
          <KpiCard label="القوالب المعطلة" value={templates.length - activeTemplates} icon={ToggleLeft} color={templates.length - activeTemplates > 0 ? "danger" : "muted"} />
          <KpiCard label="إجمالي خطوات التحقق" value={totalChecklist} icon={CheckSquare} color="gold" />
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingTemplate(null);
            setChecklist([]);
          }
        }}>
          <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto bg-[#0a1628] border-white/10 text-white" dir="rtl">
            <DialogHeader>
              <DialogTitle>{editingTemplate ? "تعديل قالب تذكرة" : "إضافة قالب تذكرة جديد"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-[hsl(var(--gold))] border-b border-white/5 pb-2">المعلومات الأساسية</h3>
                  <div className="space-y-2">
                    <Label htmlFor="name">اسم القالب</Label>
                    <Input id="name" name="name" defaultValue={editingTemplate?.name} required className="bg-white/5 border-white/10" data-testid="input-template-name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">وصف القالب</Label>
                    <Textarea id="description" name="description" defaultValue={editingTemplate?.description || ""} className="bg-white/5 border-white/10" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="itDepartmentId">القسم</Label>
                      <Select name="itDepartmentId" defaultValue={editingTemplate?.itDepartmentId?.toString() || "all"}>
                        <SelectTrigger className="bg-white/5 border-white/10">
                          <SelectValue placeholder="اختر القسم" />
                        </SelectTrigger>
                        <SelectContent>
                          {DEPARTMENTS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="defaultPriority">الأولوية الافتراضية</Label>
                      <Select name="defaultPriority" defaultValue={editingTemplate?.defaultPriority || "medium"}>
                        <SelectTrigger className="bg-white/5 border-white/10">
                          <SelectValue placeholder="اختر الأولوية" />
                        </SelectTrigger>
                        <SelectContent>
                          {PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="defaultCategory">التصنيف الافتراضي</Label>
                    <Input id="defaultCategory" name="defaultCategory" defaultValue={editingTemplate?.defaultCategory || ""} placeholder="مثال: hardware, network" className="bg-white/5 border-white/10" />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-[hsl(var(--gold))] border-b border-white/5 pb-2">محتوى التذكرة الافتراضي</h3>
                  <div className="space-y-2">
                    <Label htmlFor="defaultTitle">عنوان التذكرة الافتراضي</Label>
                    <Input id="defaultTitle" name="defaultTitle" defaultValue={editingTemplate?.defaultTitle || ""} className="bg-white/5 border-white/10" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="defaultDescription">وصف التذكرة الافتراضي</Label>
                    <Textarea id="defaultDescription" name="defaultDescription" defaultValue={editingTemplate?.defaultDescription || ""} rows={6} className="bg-white/5 border-white/10" />
                  </div>
                </div>
              </div>

              <div className="space-y-4 border-t border-white/5 pt-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-semibold text-[hsl(var(--gold))]">خطوات التحقق (Checklist)</h3>
                  <Button type="button" variant="outline" size="sm" onClick={addChecklistItem} className="gap-1 border-white/10 hover:bg-white/5">
                    <Plus className="w-3 h-3" />
                    إضافة خطوة
                  </Button>
                </div>
                <div className="space-y-3">
                  {checklist.map((item, index) => (
                    <div key={index} className="flex items-center gap-3 bg-white/5 p-3 rounded-md border border-white/5 group">
                      <Input 
                        value={item.item} 
                        onChange={(e) => updateChecklistItem(index, "item", e.target.value)}
                        placeholder="وصف الخطوة..."
                        className="flex-1 bg-transparent border-white/10 focus:border-[hsl(var(--gold))]/50"
                      />
                      <div className="flex items-center gap-2">
                        <Checkbox 
                          id={`required-${index}`}
                          checked={item.required}
                          onCheckedChange={(checked) => updateChecklistItem(index, "required", checked === true)}
                        />
                        <Label htmlFor={`required-${index}`} className="text-xs cursor-pointer whitespace-nowrap">إجباري</Label>
                      </div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeChecklistItem(index)} className="h-8 w-8 text-white/40 hover:text-rose-400">
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  {checklist.length === 0 && (
                    <div className="text-center py-6 text-white/30 border border-dashed border-white/10 rounded-md">
                      لا توجد خطوات تحقق مضافة حالياً — اضغط "إضافة خطوة" لإضافة خطوة
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-white/5">
                <Button type="button" variant="outline" className="border-white/10" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
                <LoadingButton type="submit" variant="gold" className="sm:w-auto"
                  loading={createMutation.isPending || updateMutation.isPending}
                  loadingText={editingTemplate ? "جاري التحديث..." : "جاري الإنشاء..."}>
                  {editingTemplate ? "تحديث القالب" : "إنشاء القالب"}
                </LoadingButton>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <Card key={i} className="bg-[#0f1f3d]/50 border-white/10 h-48 animate-pulse" />
            ))}
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-20 bg-[#0f1f3d]/30 rounded-xl border border-dashed border-white/10">
            <FileStack className="w-12 h-12 text-white/10 mx-auto mb-4" />
            <p className="text-white/50 font-medium">لا توجد قوالب تذاكر مضافة حالياً</p>
            <p className="text-white/30 text-sm mt-1">أضف قالباً لتسريع إنشاء تذاكر الدعم الفني</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((tpl) => (
              <Card key={tpl.id} className="bg-[#0f1f3d]/50 border-white/10 hover:border-[hsl(var(--gold))]/30 transition-all duration-300 group overflow-hidden" data-testid={`template-card-${tpl.id}`}>
                <CardHeader className="border-b border-white/5 p-4">
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant="outline" className={`border-none ${getPriorityColor(tpl.defaultPriority)}`}>
                      {PRIORITIES.find(p => p.value === tpl.defaultPriority)?.label}
                    </Badge>
                    <Switch 
                      checked={tpl.isActive} 
                      onCheckedChange={() => handleToggleActive(tpl)}
                      data-testid={`switch-tpl-active-${tpl.id}`}
                    />
                  </div>
                  <CardTitle className="text-lg font-bold text-white group-hover:text-[hsl(var(--gold))] transition-colors">
                    {tpl.name}
                  </CardTitle>
                  <CardDescription className="text-white/40 line-clamp-2">
                    {tpl.description || "لا يوجد وصف"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs text-white/60">
                    <Layout className="w-3.5 h-3.5" />
                    {DEPARTMENTS.find(d => d.value === tpl.itDepartmentId?.toString())?.label || "كل الأقسام"}
                  </div>
                  {tpl.defaultCategory && (
                    <div className="flex items-center gap-2 text-xs text-white/60">
                      <Tag className="w-3.5 h-3.5" />
                      {tpl.defaultCategory}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-white/60">
                    <CheckSquare className="w-3.5 h-3.5" />
                    {(tpl.checklist || []).length} خطوات تحقق
                  </div>
                </CardContent>
                <CardFooter className="p-4 pt-0 flex justify-between gap-2">
                  <Button variant="ghost" size="sm" className="flex-1 gap-2 text-white/60 hover:text-[hsl(var(--gold))] hover:bg-white/5" onClick={() => {
                    setEditingTemplate(tpl);
                    setChecklist(tpl.checklist || []);
                    setIsDialogOpen(true);
                  }} data-testid={`button-edit-template-${tpl.id}`}>
                    <Pencil className="w-3.5 h-3.5" />
                    تعديل
                  </Button>
                  <Button variant="ghost" size="sm" className="flex-1 gap-2 text-white/60 hover:text-rose-400 hover:bg-white/5" onClick={() => handleDelete(tpl.id)} data-testid={`button-delete-template-${tpl.id}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                    حذف
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
