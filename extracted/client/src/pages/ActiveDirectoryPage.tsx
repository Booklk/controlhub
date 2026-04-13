import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useAuth, getAuthToken } from "@/lib/auth";
import {
  Network, Shield, CheckCircle2, XCircle, Loader2, Search,
  RefreshCw, Settings, Users, Server, AlertTriangle, Eye, EyeOff,
  Building2, Phone, Mail, UserCheck, Database, Wifi, WifiOff, Save,
  Info
} from "lucide-react";
import { supportNavGroups } from "@/lib/navigation";
import type { NavGroup } from "@/lib/navigation";

interface AdConfig {
  url: string;
  baseDN: string;
  bindDN: string;
  bindPassword: string;
  userSearchBase: string;
  userSearchFilter: string;
  usernameAttribute: string;
  emailAttribute: string;
  displayNameAttribute: string;
  groupSearchBase: string;
  tlsEnabled: boolean;
}

interface AdUser {
  username: string;
  email: string;
  displayName: string;
  department?: string;
  title?: string;
  phone?: string;
  dn?: string;
}

interface ConfigResponse {
  configured: boolean;
  config: Partial<AdConfig> | null;
}

const DEFAULT_CONFIG: AdConfig = {
  url: 'ldap://172.19.101.24:389',
  baseDN: 'dc=jcsa,dc=sa',
  bindDN: 'cn=admin,dc=jcsa,dc=sa',
  bindPassword: '',
  userSearchBase: 'ou=users,dc=jcsa,dc=sa',
  userSearchFilter: '(objectClass=person)',
  usernameAttribute: 'sAMAccountName',
  emailAttribute: 'mail',
  displayNameAttribute: 'displayName',
  groupSearchBase: 'ou=groups,dc=jcsa,dc=sa',
  tlsEnabled: false,
};

function getInitials(name: string) {
  const parts = name.split(' ');
  return parts.length > 1 ? parts[0][0] + parts[1][0] : name.substring(0, 2);
}

interface Props {
  navGroups?: NavGroup[];
}

export default function ActiveDirectoryPage({ navGroups }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();

  const isManager = ['system_admin', 'it_director', 'it_support_manager'].includes(user?.role || '');

  const [form, setForm] = useState<AdConfig>(DEFAULT_CONFIG);
  const [showPassword, setShowPassword] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; details?: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<AdUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);

  const { data: configData, isLoading: loadingConfig } = useQuery<ConfigResponse>({
    queryKey: ['/api/support/ad/config'],
    queryFn: async () => {
      const res = await fetch('/api/support/ad/config', {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load AD config');
      return res.json();
    },
  });

  useEffect(() => {
    if (configData?.configured && configData.config && !configLoaded) {
      setForm(prev => ({ ...prev, ...(configData.config as AdConfig), bindPassword: '' }));
      setConfigLoaded(true);
    }
  }, [configData, configLoaded]);

  const saveMutation = useMutation({
    mutationFn: (body: AdConfig) => apiRequest('POST', '/api/support/ad/config', body),
    onSuccess: () => {
      toast({ title: 'تم الحفظ', description: 'تم حفظ إعدادات Active Directory بنجاح' });
      queryClient.invalidateQueries({ queryKey: ['/api/support/ad/config'] });
    },
    onError: (e: any) => {
      toast({ title: 'خطأ في الحفظ', description: e.message, variant: 'destructive' });
    },
  });

  const syncMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/support/ad/sync', {}),
    onSuccess: (data: any) => {
      if (data.success) {
        toast({
          title: 'تمت المزامنة بنجاح',
          description: `مُعالج: ${data.synced} | جديد: ${data.created} | محدَّث: ${data.updated}`,
        });
      } else {
        toast({ title: 'فشل المزامنة', description: data.errors?.join(', ') || 'خطأ غير معروف', variant: 'destructive' });
      }
    },
    onError: (e: any) => {
      toast({ title: 'خطأ في المزامنة', description: e.message, variant: 'destructive' });
    },
  });

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/support/ad/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('فشل اختبار الاتصال');
      const data = await res.json();
      setTestResult(data);
    } catch (e: any) {
      setTestResult({ success: false, message: e.message });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim() || searchTerm.length < 2) return;
    setIsSearching(true);
    setSearchResults([]);
    try {
      const res = await fetch('/api/support/ad/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
        credentials: 'include',
        body: JSON.stringify({ term: searchTerm }),
      });
      if (!res.ok) throw new Error('فشل البحث');
      const data = await res.json();
      setSearchResults(Array.isArray(data) ? data : []);
    } catch (e: any) {
      toast({ title: 'خطأ في البحث', description: e.message, variant: 'destructive' });
    } finally {
      setIsSearching(false);
    }
  };

  const upd = (k: keyof AdConfig, v: any) => setForm(p => ({ ...p, [k]: v }));

  const isConfigured = configData?.configured;

  return (
    <DashboardLayout navGroups={navGroups || supportNavGroups} title="Active Directory" portalName="الدعم الفني">
      <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Network className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Active Directory</h1>
              <p className="text-sm text-muted-foreground">إدارة وربط خادم LDAP / Active Directory</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {loadingConfig ? (
              <Badge variant="secondary" className="gap-1"><Loader2 className="w-3 h-3 animate-spin" />جاري التحقق...</Badge>
            ) : isConfigured ? (
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 gap-1 border-0"><Wifi className="w-3 h-3" />مُعدّ ومتصل</Badge>
            ) : (
              <Badge variant="secondary" className="gap-1 text-amber-600 bg-amber-500/10"><WifiOff className="w-3 h-3" />غير مُعدّ</Badge>
            )}
          </div>
        </div>

        <Tabs defaultValue="config">
          <TabsList className="bg-transparent gap-0.5 h-auto p-0 border-b w-full justify-start rounded-none">
            {[
              { value: 'config', label: 'الإعدادات', icon: Settings },
              { value: 'search', label: 'البحث عن مستخدمين', icon: Search },
              { value: 'sync', label: 'مزامنة المستخدمين', icon: RefreshCw },
              { value: 'guide', label: 'دليل الإعداد', icon: Info },
            ].map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:font-semibold rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:shadow-none px-4 py-2.5 text-muted-foreground"
                data-testid={`tab-ad-${value}`}
              >
                <Icon className="w-4 h-4 ml-1.5" />{label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ─── CONFIG TAB ─── */}
          <TabsContent value="config" className="mt-6 space-y-6">
            {!isManager && (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-700 dark:text-amber-400">فقط مدراء الدعم الفني يمكنهم تعديل إعدادات Active Directory.</p>
              </div>
            )}

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2"><Server className="w-4 h-4 text-blue-500" />إعدادات الخادم</CardTitle>
                <CardDescription>بيانات الاتصال بخادم Active Directory / LDAP</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5 md:col-span-2">
                    <Label>رابط الخادم (URL) <span className="text-red-500">*</span></Label>
                    <Input
                      value={form.url}
                      onChange={e => upd('url', e.target.value)}
                      placeholder="ldap://172.19.101.24:389 أو ldaps://..."
                      disabled={!isManager}
                      data-testid="input-ad-url"
                      dir="ltr"
                    />
                    <p className="text-[11px] text-muted-foreground">استخدم ldap:// للاتصال العادي أو ldaps:// للاتصال المشفر (المنفذ الافتراضي: 389 أو 636)</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Base DN <span className="text-red-500">*</span></Label>
                    <Input value={form.baseDN} onChange={e => upd('baseDN', e.target.value)} placeholder="dc=jcsa,dc=sa" disabled={!isManager} data-testid="input-ad-basedn" dir="ltr" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-2">TLS مشفر <Switch checked={form.tlsEnabled} onCheckedChange={v => upd('tlsEnabled', v)} disabled={!isManager} data-testid="switch-ad-tls" /></Label>
                    <p className="text-[11px] text-muted-foreground mt-2">تفعيل التشفير TLS/SSL (LDAPS)</p>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Bind DN (حساب الاتصال) <span className="text-red-500">*</span></Label>
                    <Input value={form.bindDN} onChange={e => upd('bindDN', e.target.value)} placeholder="cn=admin,dc=jcsa,dc=sa" disabled={!isManager} data-testid="input-ad-binddn" dir="ltr" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>كلمة مرور الاتصال <span className="text-red-500">*</span></Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={form.bindPassword}
                        onChange={e => upd('bindPassword', e.target.value)}
                        placeholder={configData?.configured ? '••••••••' : 'كلمة المرور'}
                        disabled={!isManager}
                        data-testid="input-ad-password"
                        dir="ltr"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute left-3 top-2.5 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>User Search Base</Label>
                    <Input value={form.userSearchBase} onChange={e => upd('userSearchBase', e.target.value)} placeholder="ou=users,dc=jcsa,dc=sa" disabled={!isManager} data-testid="input-ad-searchbase" dir="ltr" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>User Search Filter</Label>
                    <Input value={form.userSearchFilter} onChange={e => upd('userSearchFilter', e.target.value)} placeholder="(objectClass=person)" disabled={!isManager} data-testid="input-ad-searchfilter" dir="ltr" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Username Attribute</Label>
                    <Input value={form.usernameAttribute} onChange={e => upd('usernameAttribute', e.target.value)} placeholder="sAMAccountName" disabled={!isManager} data-testid="input-ad-username-attr" dir="ltr" />
                    <p className="text-[11px] text-muted-foreground">sAMAccountName للـ AD، uid للـ OpenLDAP</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email Attribute</Label>
                    <Input value={form.emailAttribute} onChange={e => upd('emailAttribute', e.target.value)} placeholder="mail" disabled={!isManager} data-testid="input-ad-email-attr" dir="ltr" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Display Name Attribute</Label>
                    <Input value={form.displayNameAttribute} onChange={e => upd('displayNameAttribute', e.target.value)} placeholder="displayName" disabled={!isManager} data-testid="input-ad-displayname-attr" dir="ltr" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Group Search Base</Label>
                    <Input value={form.groupSearchBase} onChange={e => upd('groupSearchBase', e.target.value)} placeholder="ou=groups,dc=jcsa,dc=sa" disabled={!isManager} data-testid="input-ad-groupbase" dir="ltr" />
                  </div>
                </div>

                {/* Test Result */}
                {testResult && (
                  <div className={`flex items-start gap-3 p-4 rounded-lg border ${testResult.success ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                    {testResult.success
                      ? <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                      : <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />}
                    <div>
                      <p className={`text-sm font-medium ${testResult.success ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>{testResult.message}</p>
                      {testResult.details && <p className="text-[11px] text-muted-foreground mt-1">{testResult.details}</p>}
                    </div>
                  </div>
                )}

                {isManager && (
                  <div className="flex items-center gap-3 pt-2">
                    <Button
                      variant="outline"
                      onClick={handleTest}
                      disabled={isTesting || !form.url}
                      className="gap-2"
                      data-testid="button-ad-test"
                    >
                      {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
                      اختبار الاتصال
                    </Button>
                    <Button
                      onClick={() => saveMutation.mutate(form)}
                      disabled={saveMutation.isPending || !form.url || !form.bindDN || !form.baseDN}
                      className="gap-2"
                      data-testid="button-ad-save"
                    >
                      {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      حفظ الإعدادات
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── SEARCH TAB ─── */}
          <TabsContent value="search" className="mt-6 space-y-6">
            {!isConfigured && (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-700 dark:text-amber-400">يجب إعداد Active Directory أولاً من تبويب "الإعدادات" قبل البحث عن مستخدمين.</p>
              </div>
            )}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2"><Search className="w-4 h-4 text-blue-500" />البحث عن مستخدمين في AD</CardTitle>
                <CardDescription>ابحث عن أي موظف في Active Directory باسمه أو بريده الإلكتروني أو اسم المستخدم</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Input
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    placeholder="ابحث بالاسم أو البريد الإلكتروني أو اسم المستخدم..."
                    disabled={!isConfigured}
                    data-testid="input-ad-search"
                  />
                  <Button onClick={handleSearch} disabled={isSearching || searchTerm.length < 2 || !isConfigured} data-testid="button-ad-search" className="gap-2">
                    {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    بحث
                  </Button>
                </div>

                {isSearching && (
                  <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm">جاري البحث في Active Directory...</span>
                  </div>
                )}

                {!isSearching && searchResults.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">تم العثور على {searchResults.length} مستخدم</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {searchResults.map((u, i) => (
                        <Card key={i} className="hover-elevate" data-testid={`card-ad-user-${i}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <Avatar className="w-10 h-10 flex-shrink-0">
                                <AvatarFallback className="bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold">
                                  {getInitials(u.displayName || u.username)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1 space-y-1">
                                <p className="font-semibold text-sm truncate">{u.displayName || u.username}</p>
                                {u.email && (
                                  <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                                    <Mail className="w-3 h-3 flex-shrink-0" />{u.email}
                                  </p>
                                )}
                                {u.title && (
                                  <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                                    <UserCheck className="w-3 h-3 flex-shrink-0" />{u.title}
                                  </p>
                                )}
                                {u.department && (
                                  <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                                    <Building2 className="w-3 h-3 flex-shrink-0" />{u.department}
                                  </p>
                                )}
                                {u.phone && (
                                  <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                                    <Phone className="w-3 h-3 flex-shrink-0" />{u.phone}
                                  </p>
                                )}
                                <Badge variant="secondary" className="text-[9px] px-1.5 h-4 mt-1">{u.username}</Badge>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {!isSearching && searchTerm && searchResults.length === 0 && (
                  <div className="py-10 text-center text-muted-foreground">
                    <Search className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">لم يتم العثور على نتائج لـ "{searchTerm}"</p>
                    <p className="text-xs mt-1">تأكد من صحة إعدادات الاتصال وتوفر الاتصال بالخادم</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── SYNC TAB ─── */}
          <TabsContent value="sync" className="mt-6 space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2"><RefreshCw className="w-4 h-4 text-blue-500" />مزامنة المستخدمين</CardTitle>
                <CardDescription>استيراد وتحديث حسابات المستخدمين من Active Directory إلى Control Hub</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {!isConfigured && (
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-700 dark:text-amber-400">يجب إعداد Active Directory أولاً قبل المزامنة.</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { icon: Users, title: 'استيراد المستخدمين الجدد', desc: 'إنشاء حسابات جديدة في Control Hub للمستخدمين الموجودين في AD', color: 'text-blue-500', bg: 'bg-blue-500/10' },
                    { icon: RefreshCw, title: 'تحديث البيانات', desc: 'تحديث بيانات المستخدمين الحاليين (الاسم، المسمى الوظيفي) من AD', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                    { icon: Shield, title: 'حسابات آمنة', desc: 'يتم إنشاء كلمات مرور مؤقتة عشوائية للحسابات الجديدة', color: 'text-amber-500', bg: 'bg-amber-500/10' },
                  ].map(({ icon: Icon, title, desc, color, bg }) => (
                    <div key={title} className="flex items-start gap-3 p-4 rounded-lg border bg-card">
                      <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-5 h-5 ${color}`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-4 rounded-lg bg-muted/50 border space-y-2">
                  <p className="text-sm font-medium flex items-center gap-2"><Database className="w-4 h-4 text-muted-foreground" />ملاحظات هامة قبل المزامنة</p>
                  <ul className="text-[12px] text-muted-foreground space-y-1 pr-4 list-disc">
                    <li>المستخدمون الجدد سيحصلون على دور "موظف دعم فني" بشكل افتراضي</li>
                    <li>لن يتم حذف أي حسابات موجودة — فقط إضافة وتحديث</li>
                    <li>كلمات المرور الموجودة لن تتأثر</li>
                    <li>يمكن تغيير الأدوار يدوياً بعد الاستيراد من صفحة إدارة المستخدمين</li>
                  </ul>
                </div>

                {isManager && (
                  <Button
                    onClick={() => syncMutation.mutate()}
                    disabled={syncMutation.isPending || !isConfigured}
                    className="gap-2 w-full md:w-auto"
                    data-testid="button-ad-sync"
                  >
                    {syncMutation.isPending
                      ? <><Loader2 className="w-4 h-4 animate-spin" />جاري المزامنة...</>
                      : <><RefreshCw className="w-4 h-4" />بدء المزامنة مع Active Directory</>}
                  </Button>
                )}

                {!isManager && (
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-700 dark:text-amber-400">فقط مدراء الدعم الفني يمكنهم تشغيل المزامنة.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── GUIDE TAB ─── */}
          <TabsContent value="guide" className="mt-6 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Info className="w-4 h-4 text-blue-500" />دليل إعداد Active Directory</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5 text-sm">
                <div className="space-y-3">
                  <h3 className="font-semibold">1. متطلبات الاتصال</h3>
                  <ul className="space-y-1.5 text-muted-foreground pr-4 list-disc">
                    <li>تأكد من إمكانية الوصول إلى خادم AD من شبكة الإنتاج (172.19.101.24)</li>
                    <li>المنفذ الافتراضي للـ LDAP: <code className="bg-muted px-1 rounded text-xs">389</code></li>
                    <li>المنفذ الافتراضي للـ LDAPS (مشفر): <code className="bg-muted px-1 rounded text-xs">636</code></li>
                  </ul>
                </div>
                <Separator />
                <div className="space-y-3">
                  <h3 className="font-semibold">2. إعداد حساب الاتصال (Service Account)</h3>
                  <p className="text-muted-foreground">يُنصح بإنشاء حساب خدمة مخصص في AD بصلاحيات قراءة فقط. مثال:</p>
                  <div className="bg-muted rounded-lg p-3 font-mono text-xs space-y-1" dir="ltr">
                    <p>Bind DN: <span className="text-blue-400">CN=ControlHub-Service,OU=ServiceAccounts,DC=jcsa,DC=sa</span></p>
                    <p>أو: <span className="text-blue-400">controlhub-svc@jcsa.sa</span></p>
                  </div>
                </div>
                <Separator />
                <div className="space-y-3">
                  <h3 className="font-semibold">3. أمثلة على إعدادات AD الشائعة</h3>
                  <div className="bg-muted rounded-lg p-4 font-mono text-xs space-y-2" dir="ltr">
                    <p className="text-muted-foreground"># Windows Active Directory</p>
                    <p>URL: <span className="text-emerald-400">ldap://dc.jcsa.sa:389</span></p>
                    <p>Base DN: <span className="text-emerald-400">DC=jcsa,DC=sa</span></p>
                    <p>Bind DN: <span className="text-emerald-400">cn=svc-account,ou=service,DC=jcsa,DC=sa</span></p>
                    <p>Username Attr: <span className="text-amber-400">sAMAccountName</span></p>
                    <p>Email Attr: <span className="text-amber-400">mail</span></p>
                    <p>Search Filter: <span className="text-blue-400">(&amp;(objectClass=user)(objectCategory=person)(!(userAccountControl:1.2.840.113556.1.4.803:=2)))</span></p>
                  </div>
                </div>
                <Separator />
                <div className="space-y-3">
                  <h3 className="font-semibold">4. استكشاف الأخطاء</h3>
                  <div className="space-y-2">
                    {[
                      { err: 'Connection refused', fix: 'تأكد من صحة عنوان الخادم والمنفذ وأن جدار الحماية يسمح بالاتصال' },
                      { err: 'Invalid credentials', fix: 'تحقق من Bind DN وكلمة المرور — تأكد من الصياغة الصحيحة للـ DN' },
                      { err: 'No entries found', fix: 'تحقق من User Search Base وSearch Filter — تأكد من وجود مستخدمين في المسار المحدد' },
                      { err: 'Timeout', fix: 'تأكد من إمكانية الوصول للشبكة ومن أن الخادم يعمل' },
                    ].map(({ err, fix }) => (
                      <div key={err} className="flex items-start gap-2 text-[12px]">
                        <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="font-mono text-red-600 dark:text-red-400">{err}</span>
                          <span className="text-muted-foreground"> — {fix}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
