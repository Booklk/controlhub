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
  CardTitle 
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
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Zap,
  Clock,
  CheckCircle2,
  XCircle,
  Play
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { useConfirmDialog, ConfirmDialog } from "@/components/ConfirmDialog";
import { adminNavGroups, itDirectorNavGroups } from "@/lib/navigation";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

interface AutomationRule {
  id: number;
  name: string;
  description: string | null;
  triggerType: string;
  triggerValue: string;
  action: string;
  actionValue: string | null;
  itDepartmentId: number | null;
  isActive: boolean;
  lastRunAt: string | null;
  createdAt: string;
}

const TRIGGER_TYPES = [
  { value: "ticket_pending_days", label: "إذا كانت التذكرة معلقة لأكثر من... (أيام)" },
  { value: "overdue_tasks", label: "إذا كان عدد المهام المتأخرة أكثر من..." },
  { value: "sla_breach_risk", label: "إذا اقتربت تذكرة من انتهاك SLA بـ... ساعات" },
  { value: "open_tickets_count", label: "إذا تجاوز عدد التذاكر المفتوحة..." },
];

const ACTIONS = [
  { value: "escalate", label: "تصعيد التذكرة" },
  { value: "change_priority", label: "تغيير الأولوية" },
  { value: "notify_manager", label: "إشعار المدير" },
];

const PRIORITIES = [
  { value: "low", label: "منخفضة" },
  { value: "medium", label: "متوسطة" },
  { value: "high", label: "عالية" },
  { value: "urgent", label: "عاجلة" },
  { value: "critical", label: "حرجة" },
];

const DEPARTMENTS = [
  { value: "all", label: "كل الأقسام" },
  { value: "9", label: "البنية التحتية" },
  { value: "10", label: "الأمن السيبراني" },
  { value: "11", label: "التحول الرقمي" },
  { value: "12", label: "الدعم الفني" },
];

const getTriggerValueLabel = (triggerType: string) => {
  switch (triggerType) {
    case "ticket_pending_days": return "القيمة (أيام)";
    case "overdue_tasks": return "الحد (مهام)";
    case "sla_breach_risk": return "التحذير المسبق (ساعات)";
    case "open_tickets_count": return "الحد (تذاكر)";
    default: return "القيمة";
  }
};

export default function AutomationRulesManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { confirm, dialogProps } = useConfirmDialog();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [selectedAction, setSelectedAction] = useState<string>("escalate");
  const [selectedTrigger, setSelectedTrigger] = useState<string>("ticket_pending_days");

  const { data: rules = [], isLoading } = useQuery<AutomationRule[]>({
    queryKey: ["/api/automation-rules"],
  });

  const createMutation = useMutation({
    mutationFn: async (newRule: Partial<AutomationRule>) => {
      const res = await apiRequest("POST", "/api/automation-rules", newRule);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation-rules"] });
      toast({ title: "تم إنشاء قاعدة الأتمتة بنجاح" });
      setIsDialogOpen(false);
      setEditingRule(null);
    },
    onError: (error: Error) => toast({ title: "فشل في إنشاء القاعدة", description: error.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (updatedRule: AutomationRule) => {
      const res = await apiRequest("PUT", `/api/automation-rules/${updatedRule.id}`, updatedRule);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation-rules"] });
      toast({ title: "تم تحديث قاعدة الأتمتة بنجاح" });
      setIsDialogOpen(false);
      setEditingRule(null);
    },
    onError: (error: Error) => toast({ title: "فشل في تحديث القاعدة", description: error.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/automation-rules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation-rules"] });
      toast({ title: "تم حذف قاعدة الأتمتة بنجاح" });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const ruleData: any = {
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      triggerType: formData.get("triggerType") as string,
      triggerValue: formData.get("triggerValue") as string,
      action: formData.get("action") as string,
      actionValue: formData.get("actionValue") as string,
      itDepartmentId: formData.get("itDepartmentId") === "all" ? null : Number(formData.get("itDepartmentId")),
    };
    if (editingRule) {
      updateMutation.mutate({ ...editingRule, ...ruleData });
    } else {
      createMutation.mutate(ruleData);
    }
  };

  const handleToggleActive = (rule: AutomationRule) => {
    updateMutation.mutate({ ...rule, isActive: !rule.isActive });
  };

  const handleDelete = (id: number) => {
    confirm(() => deleteMutation.mutate(id), {
      title: "حذف قاعدة الأتمتة",
      description: "هل أنت متأكد من حذف هذه القاعدة؟ لا يمكن التراجع عن هذا الإجراء.",
      confirmText: "حذف",
      variant: "destructive",
    });
  };

  const getNavGroups = () => {
    if (user?.role === "system_admin") return adminNavGroups;
    return itDirectorNavGroups;
  };

  const getTriggerDescription = (rule: AutomationRule) => {
    const label = TRIGGER_TYPES.find(t => t.value === rule.triggerType)?.label || rule.triggerType;
    return `${label.replace("...", rule.triggerValue)}`;
  };

  const getActionDescription = (rule: AutomationRule) => {
    const actionLabel = ACTIONS.find(a => a.value === rule.action)?.label || rule.action;
    if (rule.action === 'change_priority' && rule.actionValue) {
      const priorityLabel = PRIORITIES.find(p => p.value === rule.actionValue)?.label || rule.actionValue;
      return `${actionLabel} إلى ${priorityLabel}`;
    }
    return actionLabel;
  };

  const activeRules = rules.filter(r => r.isActive).length;
  const rulesRunToday = rules.filter(r => {
    if (!r.lastRunAt) return false;
    const today = new Date();
    const runDate = new Date(r.lastRunAt);
    return runDate.toDateString() === today.toDateString();
  }).length;
  const lastRun = rules.reduce((latest, r) => {
    if (!r.lastRunAt) return latest;
    if (!latest) return r.lastRunAt;
    return new Date(r.lastRunAt) > new Date(latest) ? r.lastRunAt : latest;
  }, null as string | null);

  return (
    <DashboardLayout
      title="أتمتة سير العمل"
      subtitle="تطبيق قواعد ذكية لتصعيد التذاكر وإرسال التنبيهات تلقائياً"
      navGroups={getNavGroups()}
      portalName={user?.role === 'system_admin' ? 'بوابة مدير النظام' : 'بوابة مدير تقنية المعلومات'}
    >
      <ConfirmDialog {...dialogProps} isPending={deleteMutation.isPending} />
      <div className="space-y-5" dir="rtl">
        <PageHeader
          icon={Zap}
          title="أتمتة سير العمل"
          subtitle="تطبيق قواعد ذكية لتصعيد التذاكر وإرسال التنبيهات تلقائياً"
          actions={
            <Button className="btn-gold h-9 gap-1.5 text-xs" onClick={() => { setEditingRule(null); setSelectedAction("escalate"); setSelectedTrigger("ticket_pending_days"); setIsDialogOpen(true); }} data-testid="button-add-automation-rule">
              <Plus className="w-3.5 h-3.5" />إضافة قاعدة
            </Button>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="إجمالي القواعد" value={rules.length} icon={Zap} color="navy" />
          <KpiCard label="القواعد النشطة" value={activeRules} icon={CheckCircle2} color="success" />
          <KpiCard label="القواعد المعطلة" value={rules.length - activeRules} icon={XCircle} color={rules.length - activeRules > 0 ? "danger" : "muted"} />
          <KpiCard label="نشطت اليوم" value={rulesRunToday} icon={Play} color="gold" />
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingRule(null);
            setSelectedAction("escalate");
            setSelectedTrigger("ticket_pending_days");
          }
        }}>
          <DialogContent className="sm:max-w-[600px] bg-[#0a1628] border-white/10 text-white" dir="rtl">
            <DialogHeader>
              <DialogTitle>{editingRule ? "تعديل قاعدة أتمتة" : "إضافة قاعدة أتمتة جديدة"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="name">اسم القاعدة</Label>
                  <Input id="name" name="name" defaultValue={editingRule?.name} required className="bg-white/5 border-white/10" data-testid="input-rule-name" />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="description">الوصف</Label>
                  <Textarea id="description" name="description" defaultValue={editingRule?.description || ""} className="bg-white/5 border-white/10" />
                </div>

                <div className="space-y-2 col-span-2 border-t border-white/5 pt-4">
                  <Label className="text-[hsl(var(--gold))] text-xs font-bold uppercase tracking-wider">الزناد (Trigger)</Label>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2 space-y-2">
                      <Label htmlFor="triggerType">الشرط</Label>
                      <Select name="triggerType" defaultValue={editingRule?.triggerType || "ticket_pending_days"} onValueChange={setSelectedTrigger}>
                        <SelectTrigger className="bg-white/5 border-white/10">
                          <SelectValue placeholder="اختر نوع الزناد" />
                        </SelectTrigger>
                        <SelectContent>
                          {TRIGGER_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="triggerValue">{getTriggerValueLabel(selectedTrigger)}</Label>
                      <Input id="triggerValue" name="triggerValue" type="number" defaultValue={editingRule?.triggerValue || "3"} required className="bg-white/5 border-white/10" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2 col-span-2 border-t border-white/5 pt-4">
                  <Label className="text-[hsl(var(--gold))] text-xs font-bold uppercase tracking-wider">الإجراء (Action)</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="action">نوع الإجراء</Label>
                      <Select name="action" defaultValue={editingRule?.action || "escalate"} onValueChange={setSelectedAction}>
                        <SelectTrigger className="bg-white/5 border-white/10">
                          <SelectValue placeholder="اختر الإجراء" />
                        </SelectTrigger>
                        <SelectContent>
                          {ACTIONS.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      {selectedAction === 'change_priority' ? (
                        <>
                          <Label htmlFor="actionValue">الأولوية الجديدة</Label>
                          <Select name="actionValue" defaultValue={editingRule?.actionValue || "high"}>
                            <SelectTrigger className="bg-white/5 border-white/10">
                              <SelectValue placeholder="اختر الأولوية" />
                            </SelectTrigger>
                            <SelectContent>
                              {PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </>
                      ) : (
                        <div className="h-full flex flex-col justify-end">
                          <p className="text-[10px] text-white/40 mb-2">
                            {selectedAction === 'escalate' ? "سيتم تغيير حالة التذكرة إلى 'تصعيد'" : "سيتم إرسال إشعار فوري لمدير القسم"}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 border-t border-white/5 pt-4">
                  <Label htmlFor="itDepartmentId">القسم المستهدف</Label>
                  <Select name="itDepartmentId" defaultValue={editingRule?.itDepartmentId?.toString() || "all"}>
                    <SelectTrigger className="bg-white/5 border-white/10">
                      <SelectValue placeholder="اختر القسم" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0 mt-6 border-t border-white/5 pt-4">
                <Button type="button" variant="outline" className="border-white/10" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
                <LoadingButton type="submit" className="btn-gold sm:w-auto" data-testid="button-save-rule"
                  loading={createMutation.isPending || updateMutation.isPending}
                  loadingText={editingRule ? "جاري التحديث..." : "جاري الإنشاء..."}>
                  {editingRule ? "تحديث القاعدة" : "إنشاء القاعدة"}
                </LoadingButton>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Card className="bg-[#0f1f3d]/50 border-white/10 overflow-hidden">
          <Table>
            <TableHeader className="bg-white/5">
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-right text-white/70">اسم القاعدة</TableHead>
                <TableHead className="text-right text-white/70">الزناد (الشرط)</TableHead>
                <TableHead className="text-right text-white/70">الإجراء</TableHead>
                <TableHead className="text-right text-white/70">القسم</TableHead>
                <TableHead className="text-right text-white/70">آخر تشغيل</TableHead>
                <TableHead className="text-right text-white/70">الحالة</TableHead>
                <TableHead className="text-left text-white/70">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <>
                  {[1, 2, 3].map(i => (
                    <TableRow key={i} className="border-white/5">
                      {[1,2,3,4,5,6,7].map(j => (
                        <TableCell key={j}><Skeleton className="h-4 w-full opacity-30" /></TableCell>
                      ))}
                    </TableRow>
                  ))}
                </>
              ) : rules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <Zap className="w-10 h-10 mx-auto mb-3 text-white/20" />
                    <p className="text-white/50 font-medium">لا توجد قواعد أتمتة معرفة حالياً</p>
                    <p className="text-white/30 text-sm mt-1">أضف قاعدة لتشغيل إجراءات تلقائية عند تحقق شروط معينة</p>
                  </TableCell>
                </TableRow>
              ) : rules.map((rule) => (
                <TableRow key={rule.id} className="border-white/5 hover:bg-white/5 transition-colors" data-testid={`row-automation-rule-${rule.id}`}>
                  <TableCell className="font-medium text-white">
                    <div>
                      {rule.name}
                      {rule.description && <p className="text-xs text-white/40 mt-0.5">{rule.description}</p>}
                    </div>
                  </TableCell>
                  <TableCell className="text-white/80">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-[hsl(var(--gold))]" />
                      <span className="text-xs">{getTriggerDescription(rule)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-[hsl(var(--gold))]/5 border-[hsl(var(--gold))]/20 text-[hsl(var(--gold))] font-normal">
                      {getActionDescription(rule)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-white/60 text-xs">
                    {DEPARTMENTS.find(d => d.value === rule.itDepartmentId?.toString())?.label || "كل الأقسام"}
                  </TableCell>
                  <TableCell className="text-white/40 text-[10px]">
                    {rule.lastRunAt ? formatDistanceToNow(new Date(rule.lastRunAt), { addSuffix: true, locale: ar }) : "لم يتم التشغيل بعد"}
                  </TableCell>
                  <TableCell>
                    <Switch 
                      checked={rule.isActive} 
                      onCheckedChange={() => handleToggleActive(rule)}
                      data-testid={`switch-rule-active-${rule.id}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-white/60 hover:text-[hsl(var(--gold))] hover:bg-white/5" onClick={() => {
                        setEditingRule(rule);
                        setSelectedAction(rule.action);
                        setSelectedTrigger(rule.triggerType);
                        setIsDialogOpen(true);
                      }} data-testid={`button-edit-rule-${rule.id}`}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-white/60 hover:text-rose-400 hover:bg-white/5" onClick={() => handleDelete(rule.id)} data-testid={`button-delete-rule-${rule.id}`}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </DashboardLayout>
  );
}
