import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingButton } from "@/components/LoadingButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { itDirectorNavGroups } from "@/lib/navigation";
import { 
  Users, Plus, Mail, Phone, Building2, UserPlus, Shield, Server,
  LayoutDashboard, FolderKanban, Ticket, BarChart3, AlertTriangle,
  Smartphone, Headphones, Database, Search,
  FileDown, FileSpreadsheet, Pencil, Trash2} from "lucide-react";
import { useConfirmDialog, ConfirmDialog } from '@/components/ConfirmDialog';
import { exportToPDF, exportToExcel, formatStatus} from '@/lib/exports';
import { PageHeader, KpiCard } from "@/components/Quality";

// Zod schemas for team and team member creation with Arabic validation messages

// Team creation schema
const teamCreationSchema = z.object({
  name: z.string()
    .min(2, { message: "اسم الفريق مطلوب (2 أحرف على الأقل)" })
    .max(200, { message: "اسم الفريق لا يجب أن يزيد عن 200 حرف" }),
  description: z.string()
    .max(300, { message: "الوصف لا يجب أن يزيد عن 300 حرف" })
    .optional()
    .or(z.literal("")),
  managerId: z.string()
    .min(1, { message: "يجب اختيار مدير الفريق" }),
  departmentId: z.string()
    .min(1, { message: "القسم مطلوب" })
});

const DEPT_TO_ROLE: Record<string, string> = {
  '1': 'it_infrastructure_staff',
  '2': 'it_cybersecurity_staff',
  '3': 'it_digital_staff',
  '4': 'it_support_staff',
  '5': 'dmo_staff',
};

const ROLE_TO_DEPT: Record<string, string> = {
  'it_infrastructure_manager': '1',
  'it_infrastructure_staff': '1',
  'it_cybersecurity_manager': '2',
  'it_cybersecurity_staff': '2',
  'it_digital_manager': '3',
  'it_digital_staff': '3',
  'it_support_manager': '4',
  'it_support_staff': '4',
  'dmo_manager': '5',
  'dmo_staff': '5',
  'it_director': '1',
  'system_admin': '1',
};

const teamMemberFormSchema = z.object({
  name: z.string()
    .min(2, { message: "اسم الموظف مطلوب (2 أحرف على الأقل)" })
    .max(200, { message: "اسم الموظف لا يجب أن يزيد عن 200 حرف" }),
  email: z.string()
    .email({ message: "البريد الإلكتروني غير صحيح" })
    .min(1, { message: "البريد الإلكتروني مطلوب" })
    .refine((email) => email.endsWith('@jcsa.sa'), {
      message: 'البريد الإلكتروني يجب أن يكون بنطاق @jcsa.sa'
    }),
  itDepartmentId: z.string().optional().default('')
});

type TeamCreationFormData = z.infer<typeof teamCreationSchema>;
type TeamMemberFormData = z.infer<typeof teamMemberFormSchema>;


interface TeamMember {
  id: number;
  name: string;
  nameEn?: string;
  email: string;
  phone?: string;
  role: string;
  jobTitle?: string;
  departmentId?: number;
  itDepartmentId?: number;
  isActive: boolean;
  avatar?: string;
}

interface ITDepartment {
  id: number;
  nameAr: string;
  nameEn?: string;
  departmentType: string;
  color?: string;
}

const departmentIcons: Record<string, JSX.Element> = {
  infrastructure: <Server className="w-5 h-5" />,
  cybersecurity: <Shield className="w-5 h-5" />,
  digital_transformation: <Smartphone className="w-5 h-5" />,
  technical_support: <Headphones className="w-5 h-5" />,
  dmo: <Database className="w-5 h-5" />,
};

const roleLabels: Record<string, string> = {
  system_admin: "مدير النظام",
  it_director: "المدير العام للتقنية",
  it_infrastructure_manager: "مدير البنية التحتية",
  it_cybersecurity_manager: "مدير الأمن السيبراني",
  it_digital_manager: "مدير التحول الرقمي",
  it_support_manager: "مدير الدعم الفني",
  it_infrastructure_staff: "موظف البنية التحتية",
  it_cybersecurity_staff: "موظف الأمن السيبراني",
  it_digital_staff: "موظف التحول الرقمي",
  it_support_staff: "موظف الدعم الفني",
  dmo_manager: "مدير مكتب البيانات",
  dmo_staff: "موظف مكتب البيانات",
  department_manager: "مدير إدارة",
  team_leader: "قائد فريق",
  specialist: "متخصص",
  technician: "فني",
  user: "مستخدم"
};

export default function TeamsManagement() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { confirm: confirmAction, dialogProps } = useConfirmDialog();
  const [isAddMemberDialogOpen, setIsAddMemberDialogOpen] = useState(false);
  const [isCreateTeamDialogOpen, setIsCreateTeamDialogOpen] = useState(false);
  const [isEditMemberDialogOpen, setIsEditMemberDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("all");

  const managerDeptId = user?.role ? (ROLE_TO_DEPT[user.role] || '') : '';

  const memberForm = useForm<TeamMemberFormData>({
    resolver: zodResolver(teamMemberFormSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      email: "",
      itDepartmentId: managerDeptId
    }
  });

  // Team creation form
  const teamForm = useForm<TeamCreationFormData>({
    resolver: zodResolver(teamCreationSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      description: "",
      managerId: "",
      departmentId: ""
    }
  });

  const { data: members = [], isLoading } = useQuery<TeamMember[]>({
    queryKey: ["/api/team-members"],
  });

  const { data: departments = [] } = useQuery<ITDepartment[]>({
    queryKey: ["/api/it-departments"],
  });

  const createMemberMutation = useMutation({
    mutationFn: async (data: TeamMemberFormData) => {
      return apiRequest("POST", "/api/team-members", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-members"] });
      toast({ title: "تم إضافة العضو بنجاح" });
      setIsAddMemberDialogOpen(false);
      memberForm.reset({ name: "", email: "", itDepartmentId: managerDeptId });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في إضافة العضو", variant: "destructive" });
    }
  });

  const createTeamMutation = useMutation({
    mutationFn: async (data: TeamCreationFormData) => {
      return apiRequest("POST", "/api/teams", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-members"] });
      toast({ title: "تم إنشاء الفريق بنجاح" });
      setIsCreateTeamDialogOpen(false);
      teamForm.reset();
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في إنشاء الفريق", variant: "destructive" });
    }
  });

  const editMemberForm = useForm<TeamMemberFormData>({
    resolver: zodResolver(teamMemberFormSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      email: "",
      itDepartmentId: ""
    }
  });

  const updateMemberMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: TeamMemberFormData }) => {
      return apiRequest("PUT", `/api/team-members/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-members"] });
      toast({ title: "تم تحديث بيانات العضو بنجاح" });
      setIsEditMemberDialogOpen(false);
      setEditingMember(null);
      editMemberForm.reset();
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في تحديث بيانات العضو", variant: "destructive" });
    }
  });

  const deleteMemberMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/team-members/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-members"] });
      toast({ title: "تم حذف العضو بنجاح" });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في حذف العضو", variant: "destructive" });
    }
  });

  const handleEditMember = (member: TeamMember) => {
    setEditingMember(member);
    editMemberForm.reset({
      name: member.name || "",
      email: member.email || "",
      itDepartmentId: member.itDepartmentId?.toString() || ""
    });
    setIsEditMemberDialogOpen(true);
  };

  const onEditMemberSubmit = (data: TeamMemberFormData) => {
    if (editingMember) {
      const role = DEPT_TO_ROLE[data.itDepartmentId] || 'it_infrastructure_staff';
      updateMemberMutation.mutate({ id: editingMember.id, data: { ...data, role } as any });
    }
  };

  const onMemberSubmit = (data: TeamMemberFormData) => {
    const role = DEPT_TO_ROLE[data.itDepartmentId] || 'it_infrastructure_staff';
    createMemberMutation.mutate({ ...data, role } as any);
  };

  const onTeamSubmit = (data: TeamCreationFormData) => {
    createTeamMutation.mutate(data);
  };

  const isMemberFormValid = memberForm.formState.isValid;
  const isTeamFormValid = teamForm.formState.isValid;

  const filteredMembers = members.filter(member => {
    const matchesSearch = member.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDepartment = filterDepartment === "all" || 
                              member.itDepartmentId?.toString() === filterDepartment;
    return matchesSearch && matchesDepartment;
  });

  const getDepartmentName = (departmentId?: number) => {
    const dept = departments.find(d => d.id === departmentId);
    return dept?.nameAr || "غير محدد";
  };

  const getDepartmentIcon = (departmentId?: number) => {
    const dept = departments.find(d => d.id === departmentId);
    return departmentIcons[dept?.departmentType || ""] || <Building2 className="w-5 h-5" />;
  };

  const stats = {
    total: members.length,
    active: members.filter(m => m.isActive).length,
    managers: members.filter(m => m.role === "department_manager" || m.role === "team_leader").length,
    byDepartment: departments.map(dept => ({
      ...dept,
      count: members.filter(m => m.itDepartmentId === dept.id).length
    }))
  };

  if (isLoading) {
    return (
      <DashboardLayout title="إدارة الفرق" portalName="it_director" navGroups={itDirectorNavGroups}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold" />
        </div>
      </DashboardLayout>
    );
  }


  const handleExportPDF = () => {
    exportToPDF({
      title: 'تقرير الفرق',
      subtitle: 'JCSA - Control Hub',
      columns: [{"header":"الفريق","key":"name","width":40},{"header":"القسم","key":"department","width":30},{"header":"عدد الأعضاء","key":"membersCount","width":20},{"header":"الحالة","key":"status","width":20}],
      data: (members || []).map((item: any) => ({ name: item.name || '', department: item.department || '', membersCount: item.membersCount?.toString() || '0', status: formatStatus(item.status || '') })),
      filename: 'teams-report',
      orientation: 'landscape',
    });
  };

  const handleExportExcel = () => {
    exportToExcel({
      title: 'تقرير الفرق',
      columns: [{"header":"الفريق","key":"name","width":40},{"header":"القسم","key":"department","width":30},{"header":"عدد الأعضاء","key":"membersCount","width":20},{"header":"الحالة","key":"status","width":20}],
      data: (members || []).map((item: any) => ({ name: item.name || '', department: item.department || '', membersCount: item.membersCount?.toString() || '0', status: formatStatus(item.status || '') })),
      filename: 'teams-report',
    });
  };

  return (
    <DashboardLayout 
      title="إدارة الفرق والموظفين" 
      portalName="it_director"
      navGroups={itDirectorNavGroups}
    >
      <div className="p-6 space-y-5">
        <PageHeader
          icon={Users}
          title="إدارة الفرق والموظفين"
          subtitle="إدارة موظفي الإدارات التقنية وتوزيع المهام"
          actions={
            <>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportPDF} data-testid="button-export-pdf"><FileDown className="w-3.5 h-3.5" />PDF</Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportExcel} data-testid="button-export-excel"><FileSpreadsheet className="w-3.5 h-3.5" />Excel</Button>
              <Button className="btn-gold h-9 gap-1.5 text-xs" onClick={() => { setIsCreateTeamDialogOpen(true); teamForm.reset(); }} data-testid="button-create-team"><Plus className="w-3.5 h-3.5" />إنشاء فريق جديد</Button>
            </>
          }
        />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KpiCard label="إجمالي الموظفين" value={stats.total} icon={Users} color="navy" />
          <KpiCard label="الموظفون النشطون" value={stats.active} icon={UserPlus} color="success" />
          <KpiCard label="المدراء والقادة" value={stats.managers} icon={Shield} color="gold" />
        </div>

        <Dialog open={isCreateTeamDialogOpen} onOpenChange={(open) => {
              setIsCreateTeamDialogOpen(open);
              if (!open) {
                teamForm.reset();
              }
            }}>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
                <DialogHeader>
                  <DialogTitle>إنشاء فريق جديد</DialogTitle>
                </DialogHeader>
                <Form {...teamForm}>
                  <form onSubmit={teamForm.handleSubmit(onTeamSubmit)} className="space-y-4 mt-4">
                    <FormField
                      control={teamForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>اسم الفريق</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="فريق التطوير"
                              data-testid="input-team-name"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={teamForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>الوصف (اختياري)</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="وصف الفريق والمسؤوليات"
                              data-testid="input-team-description"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={teamForm.control}
                        name="managerId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>مدير الفريق</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger data-testid="select-team-manager">
                                  <SelectValue placeholder="اختر المدير" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {members.filter(m => m.role === "department_manager" || m.role === "team_leader").map((member) => (
                                  <SelectItem key={member.id} value={member.id.toString()}>{member.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={teamForm.control}
                        name="departmentId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>الإدارة</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger data-testid="select-team-department">
                                  <SelectValue placeholder="اختر الإدارة" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {departments.map((dept) => (
                                  <SelectItem key={dept.id} value={dept.id.toString()}>{dept.nameAr}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <LoadingButton
                      type="submit"
                      className="w-full btn-gold"
                      disabled={!isTeamFormValid}
                      loading={createTeamMutation.isPending}
                      loadingText="جاري الإنشاء..."
                      data-testid="button-save-team"
                    >
                      إنشاء الفريق
                    </LoadingButton>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>

            <Dialog open={isAddMemberDialogOpen} onOpenChange={(open) => {
              setIsAddMemberDialogOpen(open);
              if (!open) {
                memberForm.reset({ name: "", email: "", itDepartmentId: managerDeptId });
              } else {
                memberForm.setValue('itDepartmentId', managerDeptId, { shouldValidate: true });
              }
            }}>
              <DialogTrigger asChild>
                <Button className="btn-gold" data-testid="button-add-member">
                  <UserPlus className="w-4 h-4 ml-2" />
                  إضافة موظف جديد
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
                <DialogHeader>
                  <DialogTitle>إضافة موظف جديد</DialogTitle>
                </DialogHeader>
                <Form {...memberForm}>
                  <form onSubmit={memberForm.handleSubmit(onMemberSubmit)} className="space-y-4 mt-4">
                    <p className="text-sm text-muted-foreground">أدخل اسم الموظف وبريده الإلكتروني فقط - سيتم تعيين الإدارة والدور والبوابة تلقائياً</p>
                    <FormField
                      control={memberForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>الاسم</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="أحمد محمد"
                              data-testid="input-member-name"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={memberForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>البريد الإلكتروني</FormLabel>
                          <FormControl>
                            <Input 
                              type="email"
                              placeholder="user@jcsa.sa"
                              data-testid="input-member-email"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {managerDeptId ? (
                      <div className="rounded-md border p-3 space-y-1">
                        <p className="text-sm font-medium">الإدارة: <span className="text-muted-foreground">{departments.find(d => d.id.toString() === managerDeptId)?.nameAr || 'إدارتك'}</span></p>
                        <p className="text-xs text-muted-foreground">الدور: {roleLabels[DEPT_TO_ROLE[managerDeptId] || ''] || 'موظف'}</p>
                      </div>
                    ) : (
                      <FormField
                        control={memberForm.control}
                        name="itDepartmentId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>الإدارة</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger data-testid="select-member-department">
                                  <SelectValue placeholder="اختر الإدارة" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {departments.map((dept) => (
                                  <SelectItem key={dept.id} value={dept.id.toString()}>{dept.nameAr}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <LoadingButton
                      type="submit"
                      className="w-full btn-gold"
                      disabled={!isMemberFormValid}
                      loading={createMemberMutation.isPending}
                      loadingText="جاري الحفظ..."
                      data-testid="button-save-member"
                    >
                      حفظ الموظف
                    </LoadingButton>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="card-premium">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">إجمالي الموظفين</p>
                  <p className="text-2xl font-bold hub-stat-gold">{stats.total}</p>
                </div>
                <Users className="w-8 h-8 hub-stat-gold" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="card-premium">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">الموظفين النشطين</p>
                  <p className="text-2xl font-bold text-emerald-600">{stats.active}</p>
                </div>
                <Users className="w-8 h-8 hub-stat-gold" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="card-premium">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">المدراء والقادة</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.managers}</p>
                </div>
                <Shield className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="card-premium">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">الإدارات</p>
                  <p className="text-2xl font-bold text-purple-600">{departments.length}</p>
                </div>
                <Building2 className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input 
              placeholder="بحث بالاسم أو البريد الإلكتروني..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10"
              data-testid="input-search-members"
            />
          </div>
          <Select value={filterDepartment} onValueChange={setFilterDepartment}>
            <SelectTrigger className="w-48" data-testid="select-filter-department">
              <SelectValue placeholder="تصفية حسب الإدارة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الإدارات</SelectItem>
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id.toString()}>{dept.nameAr}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMembers.map((member) => (
            <Card key={member.id} className="card-premium hover-elevate" data-testid={`card-member-${member.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={member.avatar} />
                    <AvatarFallback className="hub-card text-white">
                      {member.name?.charAt(0) || "م"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-foreground truncate">
                        {member.name}
                      </h3>
                      <Badge variant={member.isActive ? "default" : "secondary"}>
                        {member.isActive ? "نشط" : "غير نشط"}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                      {member.jobTitle || roleLabels[member.role] || member.role}
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                      {getDepartmentIcon(member.itDepartmentId)}
                      <span>{getDepartmentName(member.itDepartmentId)}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-xs">
                      <div className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        <span className="truncate max-w-[120px]">{member.email}</span>
                      </div>
                      {member.phone && (
                        <div className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          <span>{member.phone}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-3">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleEditMember(member)}
                        data-testid={`button-edit-member-${member.id}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-red-600"
                        onClick={() => {
                          confirmAction(() => deleteMemberMutation.mutate(member.id), {
                            title: 'تأكيد الحذف',
                            description: 'هل أنت متأكد من حذف هذا العضو؟ لا يمكن التراجع عن هذا الإجراء.'
                          });
                        }}
                        data-testid={`button-delete-member-${member.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredMembers.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>لا يوجد موظفين</p>
            <p className="text-sm mt-2">اضغط على "إضافة موظف جديد" للبدء</p>
          </div>
        )}

        <div className="mt-8">
          <h2 className="text-xl font-bold text-foreground mb-4">
            توزيع الموظفين حسب الإدارات
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.byDepartment.map((dept) => (
              <Card key={dept.id} className="hover-elevate" data-testid={`card-dept-${dept.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${dept.color || 'hub-card'} text-white`}>
                      {departmentIcons[dept.departmentType] || <Building2 className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{dept.nameAr}</p>
                      <p className="text-2xl font-bold hub-stat-gold">{dept.count}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

      <Dialog open={isEditMemberDialogOpen} onOpenChange={(open) => {
        setIsEditMemberDialogOpen(open);
        if (!open) {
          setEditingMember(null);
          editMemberForm.reset();
        }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل بيانات الموظف</DialogTitle>
          </DialogHeader>
          <Form {...editMemberForm}>
            <form onSubmit={editMemberForm.handleSubmit(onEditMemberSubmit)} className="space-y-4 mt-4">
              <FormField
                control={editMemberForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الاسم</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="أحمد محمد"
                        data-testid="input-edit-member-name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editMemberForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>البريد الإلكتروني</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="user@jcsa.sa"
                        data-testid="input-edit-member-email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editMemberForm.control}
                name="itDepartmentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الإدارة</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-member-department">
                          <SelectValue placeholder="اختر الإدارة" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id.toString()}>{dept.nameAr}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                    {field.value && (
                      <p className="text-xs text-muted-foreground mt-1">
                        الدور: {roleLabels[DEPT_TO_ROLE[field.value] || ''] || 'موظف'}
                      </p>
                    )}
                  </FormItem>
                )}
              />

              <LoadingButton
                type="submit"
                className="w-full btn-gold"
                disabled={!editMemberForm.formState.isValid}
                loading={updateMemberMutation.isPending}
                loadingText="جاري التحديث..."
                data-testid="button-update-member"
              >
                تحديث بيانات الموظف
              </LoadingButton>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog {...dialogProps} />
    </DashboardLayout>
  );
}
