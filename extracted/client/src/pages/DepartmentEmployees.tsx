import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader, KpiCard } from "@/components/Quality";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useAuth, getAuthToken } from "@/lib/auth";
import { UserPlus, Mail, Search, Users, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { NavGroup } from "@/lib/navigation";

interface Employee {
  id: number;
  name: string;
  email: string;
  role: string;
  portal: string;
  jobTitle: string;
  isActive: boolean;
  isActivated: boolean;
  createdAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  it_infrastructure_staff: "موظف إدارة الشبكات والبنية التحتية",
  it_cybersecurity_staff: "موظف إدارة الأمن السيبراني",
  it_digital_staff: "موظف إدارة التحول الرقمي",
  it_support_staff: "موظف إدارة الدعم الفني",
  dmo_staff: "موظف مكتب إدارة البيانات",
};

interface Props {
  navGroups: NavGroup[];
  portalName: string;
}

export default function DepartmentEmployees({ navGroups, portalName }: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: employees = [], isLoading } = useQuery<Employee[]>({
    queryKey: ['/api/department/my-employees'],
    queryFn: async () => {
      const res = await fetch('/api/department/my-employees', {
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }, credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load employees');
      return res.json();
    },
  });

  const addEmployeeMutation = useMutation({
    mutationFn: (data: { name: string; email: string }) =>
      apiRequest('POST', '/api/department/add-employee', data),
    onSuccess: async (res) => {
      const result = await res.json();
      queryClient.invalidateQueries({ queryKey: ['/api/department/my-employees'] });
      setIsAddOpen(false);
      setNewName("");
      setNewEmail("");
      toast({
        title: "تم إضافة الموظف بنجاح",
        description: result.activationEmailSent
          ? `تم إرسال رابط التفعيل إلى ${result.email}`
          : `تم إنشاء الحساب - المسمى: ${result.jobTitle}`,
      });
    },
    onError: async (error: any) => {
      const msg = error.message?.includes(':') ? error.message.split(':').slice(1).join(':').trim() : 'حدث خطأ في إضافة الموظف';
      let parsed = msg;
      try { parsed = JSON.parse(msg)?.error || msg; } catch {}
      toast({ title: "خطأ", description: parsed, variant: "destructive" });
    },
  });

  const filteredEmployees = employees.filter(e =>
    e.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').slice(0, 2);

  const handleSubmit = () => {
    if (!newName.trim()) {
      toast({ title: "الاسم مطلوب", variant: "destructive" });
      return;
    }
    if (!newEmail.trim() || !newEmail.endsWith('@jcsa.sa')) {
      toast({ title: "البريد الإلكتروني يجب أن يكون بنطاق @jcsa.sa", variant: "destructive" });
      return;
    }
    addEmployeeMutation.mutate({ name: newName.trim(), email: newEmail.trim() });
  };

  return (
    <DashboardLayout navGroups={navGroups} portalName={portalName} title="إدارة الموظفين">
      <div className="space-y-5" dir="rtl">
        <PageHeader
          icon={Users}
          title="إدارة الموظفين"
          subtitle="إضافة وإدارة موظفين القسم"
          actions={
            <Button className="btn-gold h-9 gap-1.5 text-xs" onClick={() => setIsAddOpen(true)} data-testid="button-add-employee">
              <UserPlus className="w-3.5 h-3.5" />إضافة موظف
            </Button>
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <KpiCard label="إجمالي الموظفين" value={employees.length} icon={Users} color="navy" data-testid="text-total-count" />
          <KpiCard label="مفعّل" value={employees.filter(e => e.isActivated).length} icon={CheckCircle2} color="success" />
          <KpiCard label="بانتظار التفعيل" value={employees.filter(e => !e.isActivated).length} icon={Clock} color={employees.filter(e => !e.isActivated).length > 0 ? "gold" : "muted"} />
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم أو البريد..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10"
            data-testid="input-search"
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="p-4 border border-border/40 rounded-lg space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            ))}
          </div>
        ) : filteredEmployees.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">لا يوجد موظفين حالياً</p>
              <p className="text-sm text-muted-foreground mt-1">اضغط "إضافة موظف" لإضافة أول موظف</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEmployees.map((emp) => (
              <Card key={emp.id} data-testid={`card-employee-${emp.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {getInitials(emp.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate" data-testid={`text-name-${emp.id}`}>{emp.name}</p>
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                        <Mail className="w-3 h-3 flex-shrink-0" />
                        {emp.email}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {ROLE_LABELS[emp.role] || emp.jobTitle || emp.role}
                      </p>
                      <div className="mt-2">
                        {emp.isActivated ? (
                          <Badge variant="secondary" className="text-xs">
                            <CheckCircle2 className="w-3 h-3 ml-1" />
                            مفعّل
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                            <Clock className="w-3 h-3 ml-1" />
                            بانتظار التفعيل
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogContent className="sm:max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle>إضافة موظف جديد</DialogTitle>
              <DialogDescription>
                أدخل اسم الموظف وبريده الإلكتروني وسيتم تعيينه تلقائياً في قسمك مع إرسال رابط التفعيل
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="emp-name">اسم الموظف</Label>
                <Input
                  id="emp-name"
                  placeholder="مثال: محمد أحمد"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  data-testid="input-employee-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emp-email">البريد الإلكتروني</Label>
                <Input
                  id="emp-email"
                  type="email"
                  placeholder="example@jcsa.sa"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  dir="ltr"
                  className="text-left"
                  data-testid="input-employee-email"
                />
              </div>
              <div className="bg-muted/50 rounded-md p-3 text-sm space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>سيتم تلقائياً:</span>
                </div>
                <ul className="text-xs text-muted-foreground mr-6 space-y-0.5 list-disc">
                  <li>تعيين المسمى الوظيفي حسب قسمك</li>
                  <li>إرسال رابط تفعيل الحساب للبريد</li>
                  <li>إضافته كموظف في إدارتك</li>
                </ul>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setIsAddOpen(false)} data-testid="button-cancel">
                إلغاء
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={addEmployeeMutation.isPending}
                data-testid="button-submit-employee"
              >
                {addEmployeeMutation.isPending ? "جاري الإضافة..." : "إضافة الموظف"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
