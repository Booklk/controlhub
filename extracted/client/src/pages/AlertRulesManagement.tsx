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
  Bell,
  CheckCircle2,
  XCircle,
  ActivitySquare
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { useConfirmDialog, ConfirmDialog } from "@/components/ConfirmDialog";
import { adminNavGroups, itDirectorNavGroups } from "@/lib/navigation";
import { Checkbox } from "@/components/ui/checkbox";

interface AlertRule {
  id: number;
  name: string;
  description: string | null;
  metric: string;
  operator: string;
  threshold: number;
  itDepartmentId: number | null;
  notifyRoles: string[];
  isActive: boolean;
  createdAt: string;
}

const METRICS = [
  { value: "sla_breached", label: "تذاكر SLA منتهكة" },
  { value: "open_tickets", label: "تذاكر مفتوحة" },
  { value: "overdue_tasks", label: "مهام متأخرة" },
  { value: "pending_tickets", label: "تذاكر معلقة" },
];

const OPERATORS = [
  { value: ">", label: "أكبر من" },
  { value: ">=", label: "أكبر أو يساوي" },
  { value: "<", label: "أصغر من" },
  { value: "<=", label: "أصغر أو يساوي" },
  { value: "=", label: "يساوي" },
];

const DEPARTMENTS = [
  { value: "all", label: "كل الأقسام" },
  { value: "9", label: "البنية التحتية" },
  { value: "10", label: "الأمن السيبراني" },
  { value: "11", label: "التحول الرقمي" },
  { value: "12", label: "الدعم الفني" },
];

const ROLES = [
  { value: "system_admin", label: "مدير النظام" },
  { value: "it_director", label: "مدير تقنية المعلومات" },
  { value: "infrastructure_manager", label: "مدير البنية التحتية" },
  { value: "cybersecurity_manager", label: "مدير الأمن السيبراني" },
  { value: "digital_manager", label: "مدير التحول الرقمي" },
  { value: "support_manager", label: "مدير الدعم الفني" },
  { value: "dmo_manager", label: "مدير مكتب البيانات" },
];

export default function AlertRulesManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { confirm, dialogProps } = useConfirmDialog();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);

  const { data: rules = [], isLoading } = useQuery<AlertRule[]>({
    queryKey: ["/api/alert-rules"],
  });

  const createMutation = useMutation({
    mutationFn: async (newRule: Partial<AlertRule>) => {
      const res = await apiRequest("POST", "/api/alert-rules", newRule);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alert-rules"] });
      toast({ title: "تم إنشاء القاعدة بنجاح" });
      setIsDialogOpen(false);
      setEditingRule(null);
    },
    onError: () => toast({ title: "فشل في إنشاء القاعدة", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (updatedRule: AlertRule) => {
      const res = await apiRequest("PUT", `/api/alert-rules/${updatedRule.id}`, updatedRule);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alert-rules"] });
      toast({ title: "تم تحديث القاعدة بنجاح" });
      setIsDialogOpen(false);
      setEditingRule(null);
    },
    onError: () => toast({ title: "فشل في تحديث القاعدة", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/alert-rules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alert-rules"] });
      toast({ title: "تم حذف القاعدة بنجاح" });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const notifyRoles = ROLES.filter(role => formData.get(`role-${role.value}`) === "on").map(role => role.value);
    const ruleData: any = {
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      metric: formData.get("metric") as string,
      operator: formData.get("operator") as string,
      threshold: Number(formData.get("threshold")),
      itDepartmentId: formData.get("itDepartmentId") === "all" ? null : Number(formData.get("itDepartmentId")),
      notifyRoles,
    };
    if (editingRule) {
      updateMutation.mutate({ ...editingRule, ...ruleData });
    } else {
      createMutation.mutate(ruleData);
    }
  };

  const handleToggleActive = (rule: AlertRule) => {
    updateMutation.mutate({ ...rule, isActive: !rule.isActive });
  };

  const handleDelete = (id: number) => {
    confirm(() => deleteMutation.mutate(id), {
      title: "حذف قاعدة التنبيه",
      description: "هل أنت متأكد من حذف هذه القاعدة؟ لا يمكن التراجع عن هذا الإجراء.",
      confirmText: "حذف",
      variant: "destructive",
    });
  };

  const getNavGroups = () => {
    if (user?.role === "system_admin") return adminNavGroups;
    return itDirectorNavGroups;
  };

  const activeRules = rules.filter(r => r.isActive).length;
  const uniqueMetrics = new Set(rules.map(r => r.metric)).size;

  return (
    <DashboardLayout
      title="قواعد التنبيه الذكي"
      subtitle="إدارة وتخصيص تنبيهات النظام التلقائية بناءً على مؤشرات الأداء"
      navGroups={getNavGroups()}
      portalName={user?.role === 'system_admin' ? 'بوابة مدير النظام' : 'بوابة مدير تقنية المعلومات'}
    >
      <ConfirmDialog {...dialogProps} isPending={deleteMutation.isPending} />
      <div className="space-y-5" dir="rtl">
        <PageHeader
          icon={Bell}
          title="قواعد التنبيه الذكي"
          subtitle="إدارة وتخصيص تنبيهات النظام التلقائية بناءً على مؤشرات الأداء"
          actions={
            <Button className="btn-gold h-9 gap-1.5 text-xs" onClick={() => { setEditingRule(null); setIsDialogOpen(true); }} data-testid="button-add-alert-rule">
              <Plus className="w-3.5 h-3.5" />إضافة قاعدة
            </Button>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="إجمالي القواعد" value={rules.length} icon={Bell} color="navy" />
          <KpiCard label="القواعد النشطة" value={activeRules} icon={CheckCircle2} color="success" />
          <KpiCard label="القواعد المعطلة" value={rules.length - activeRules} icon={XCircle} color={rules.length - activeRules > 0 ? "danger" : "muted"} />
          <KpiCard label="المقاييس المُراقبة" value={uniqueMetrics} icon={ActivitySquare} color="gold" />
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setEditingRule(null);
        }}>
          <DialogContent className="sm:max-w-[600px] bg-[#0a1628] border-white/10 text-white" dir="rtl">
            <DialogHeader>
              <DialogTitle>{editingRule ? "تعديل قاعدة تنبيه" : "إضافة قاعدة تنبيه جديدة"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="name">اسم القاعدة</Label>
                  <Input id="name" name="name" defaultValue={editingRule?.name} required className="bg-white/5 border-white/10" data-testid="input-rule-name" />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="description">الوصف</Label>
                  <Textarea id="description" name="description" defaultValue={editingRule?.description || ""} className="bg-white/5 border-white/10" data-testid="input-rule-description" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="metric">المقياس</Label>
                  <Select name="metric" defaultValue={editingRule?.metric || "sla_breached"}>
                    <SelectTrigger className="bg-white/5 border-white/10">
                      <SelectValue placeholder="اختر المقياس" />
                    </SelectTrigger>
                    <SelectContent>
                      {METRICS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="operator">الشرط</Label>
                  <Select name="operator" defaultValue={editingRule?.operator || ">="}>
                    <SelectTrigger className="bg-white/5 border-white/10">
                      <SelectValue placeholder="اختر الشرط" />
                    </SelectTrigger>
                    <SelectContent>
                      {OPERATORS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="threshold">القيمة الحدية</Label>
                  <Input id="threshold" name="threshold" type="number" defaultValue={editingRule?.threshold} required className="bg-white/5 border-white/10" data-testid="input-rule-threshold" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="itDepartmentId">القسم</Label>
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
              <div className="space-y-3">
                <Label>الأدوار المستهدفة للتنبيه</Label>
                <div className="grid grid-cols-2 gap-2 p-3 bg-white/5 rounded-md border border-white/10">
                  {ROLES.map(role => (
                    <div key={role.value} className="flex items-center space-x-2 space-x-reverse">
                      <Checkbox 
                        id={`role-${role.value}`} 
                        name={`role-${role.value}`} 
                        defaultChecked={editingRule?.notifyRoles.includes(role.value)}
                      />
                      <Label htmlFor={`role-${role.value}`} className="text-sm cursor-pointer">{role.label}</Label>
                    </div>
                  ))}
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" type="button" className="border-white/10" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
                <LoadingButton type="submit" className="btn-gold" data-testid="button-save-rule"
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
                <TableHead className="text-right text-white/70">المقياس</TableHead>
                <TableHead className="text-right text-white/70">الشرط</TableHead>
                <TableHead className="text-right text-white/70">القسم</TableHead>
                <TableHead className="text-right text-white/70">الأدوار</TableHead>
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
                    <Bell className="w-10 h-10 mx-auto mb-3 text-white/20" />
                    <p className="text-white/50 font-medium">لا توجد قواعد تنبيه معرفة حالياً</p>
                    <p className="text-white/30 text-sm mt-1">أضف قاعدة تنبيه لمراقبة مؤشرات الأداء تلقائياً</p>
                  </TableCell>
                </TableRow>
              ) : rules.map((rule) => (
                <TableRow key={rule.id} className="border-white/5 hover:bg-white/5 transition-colors" data-testid={`row-alert-rule-${rule.id}`}>
                  <TableCell className="font-medium text-white">
                    <div>
                      {rule.name}
                      {rule.description && <p className="text-xs text-white/40 mt-0.5">{rule.description}</p>}
                    </div>
                  </TableCell>
                  <TableCell className="text-white/80">
                    {METRICS.find(m => m.value === rule.metric)?.label || rule.metric}
                  </TableCell>
                  <TableCell className="text-white/80" dir="ltr">
                    <Badge variant="secondary" className="bg-white/10 text-white border-none font-mono">
                      {rule.operator} {rule.threshold}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-white/80">
                    {DEPARTMENTS.find(d => d.value === rule.itDepartmentId?.toString())?.label || "كل الأقسام"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {rule.notifyRoles.map(role => (
                        <Badge key={role} variant="outline" className="text-[10px] bg-white/5 border-white/10 text-white/60">
                          {ROLES.find(r => r.value === role)?.label || role}
                        </Badge>
                      ))}
                    </div>
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
