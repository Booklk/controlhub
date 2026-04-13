import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import DashboardLayout from '@/components/DashboardLayout';
import { itDirectorNavGroups, supportNavGroups } from '@/lib/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  Mail, Plus, Key, Copy, Trash2, CheckCircle, Clock,
  Shield, ExternalLink, AlertCircle, Eye, EyeOff, RefreshCw,
  ArrowRight, Server, Globe
} from 'lucide-react';

interface EmailIntegrationKey {
  id: number;
  name: string;
  apiKey: string;
  createdById: number;
  departmentId: number | null;
  defaultPriority: string;
  defaultCategory: string;
  isActive: boolean;
  lastUsedAt: string | null;
  usageCount: number;
  createdAt: string;
}

interface EmailIntegrationPageProps {
  portal?: 'it_director' | 'support';
}

export default function EmailIntegrationPage({ portal = 'it_director' }: EmailIntegrationPageProps) {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [showApiKey, setShowApiKey] = useState<number | null>(null);
  const [newKey, setNewKey] = useState({
    name: '',
    defaultPriority: 'medium',
    defaultCategory: 'support',
  });

  const navGroups = portal === 'support' ? supportNavGroups : itDirectorNavGroups;

  const { data: keys = [], isLoading } = useQuery<EmailIntegrationKey[]>({
    queryKey: ['/api/email-integration-keys'],
  });

  const createKeyMutation = useMutation({
    mutationFn: async (data: typeof newKey) => {
      const res = await apiRequest('POST', '/api/email-integration-keys', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-integration-keys'] });
      setIsCreateDialogOpen(false);
      setNewKey({ name: '', defaultPriority: 'medium', defaultCategory: 'support' });
      toast({ title: 'تم إنشاء مفتاح الربط بنجاح' });
    },
    onError: () => {
      toast({ title: 'حدث خطأ', description: 'تعذر إنشاء مفتاح الربط', variant: 'destructive' });
    },
  });

  const deleteKeyMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/email-integration-keys/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-integration-keys'] });
      toast({ title: 'تم حذف مفتاح الربط' });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'تم النسخ للحافظة' });
  };

  const webhookUrl = `${window.location.origin}/api/public/email-to-ticket`;

  return (
    <DashboardLayout title="ربط البريد الإلكتروني" portalName={portal === 'support' ? 'الدعم الفني' : 'مدير تقنية المعلومات'} navGroups={navGroups}>
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">ربط البريد الإلكتروني</h1>
            <p className="text-muted-foreground mt-1">ربط Outlook أو أي بريد إلكتروني لتحويل الرسائل إلى تذاكر تلقائياً</p>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-key">
            <Plus className="w-4 h-4 ml-2" />
            إنشاء مفتاح جديد
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              كيفية الربط مع Outlook
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                <div className="flex items-center gap-2 font-semibold">
                  <Badge variant="outline">1</Badge>
                  إنشاء مفتاح API
                </div>
                <p className="text-sm text-muted-foreground">أنشئ مفتاح ربط جديد من الزر أعلاه وحدد الأولوية والتصنيف الافتراضي للتذاكر</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                <div className="flex items-center gap-2 font-semibold">
                  <Badge variant="outline">2</Badge>
                  إعداد Power Automate
                </div>
                <p className="text-sm text-muted-foreground">في Microsoft Power Automate، أنشئ Flow جديد يعمل عند استلام بريد في صندوق الدعم</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                <div className="flex items-center gap-2 font-semibold">
                  <Badge variant="outline">3</Badge>
                  ربط الـ Webhook
                </div>
                <p className="text-sm text-muted-foreground">أضف خطوة HTTP POST في الـ Flow باستخدام الرابط والمفتاح لتحويل كل بريد لتذكرة</p>
              </div>
            </div>

            <div className="border rounded-lg p-4 space-y-3 bg-card">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Server className="w-4 h-4" />
                رابط الـ Webhook (API Endpoint)
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2.5 bg-muted rounded text-sm font-mono overflow-x-auto" dir="ltr" data-testid="text-webhook-url">
                  POST {webhookUrl}
                </code>
                <Button size="icon" variant="outline" onClick={() => copyToClipboard(webhookUrl)} data-testid="button-copy-url">
                  <Copy className="w-4 h-4" />
                </Button>
              </div>

              <div className="text-sm font-medium mt-3">Headers المطلوبة:</div>
              <div className="bg-muted p-3 rounded font-mono text-xs space-y-1" dir="ltr">
                <div>Content-Type: application/json</div>
                <div>X-API-Key: {"<your_api_key>"}</div>
              </div>

              <div className="text-sm font-medium mt-3">Body (JSON):</div>
              <div className="bg-muted p-3 rounded font-mono text-xs whitespace-pre" dir="ltr">
{`{
  "subject": "عنوان البريد",
  "body": "محتوى البريد",
  "from": "sender@example.com",
  "fromName": "اسم المرسل",
  "messageId": "<unique-msg-id>",
  "receivedDate": "2024-01-15T10:30:00Z",
  "importance": "normal"
}`}
              </div>

              <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg text-sm mt-3">
                <AlertCircle className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                <div className="text-muted-foreground">
                  الحقل <code className="bg-muted px-1 rounded">messageId</code> يمنع تكرار التذاكر لنفس البريد.
                  حقل <code className="bg-muted px-1 rounded">importance</code> يحدد الأولوية تلقائياً (high = عالي، low = منخفض).
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              مفاتيح الربط
              <Badge variant="secondary">{keys.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center p-8 text-muted-foreground">
                <RefreshCw className="w-5 h-5 animate-spin ml-2" />
                جاري التحميل...
              </div>
            ) : keys.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground">
                <Mail className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>لا توجد مفاتيح ربط بعد</p>
                <p className="text-sm mt-1">أنشئ مفتاح جديد لبدء استقبال التذاكر من البريد الإلكتروني</p>
              </div>
            ) : (
              <div className="space-y-3">
                {keys.map((key) => (
                  <div key={key.id} className="border rounded-lg p-4 space-y-3" data-testid={`card-key-${key.id}`}>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-muted">
                          <Key className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-medium" data-testid={`text-key-name-${key.id}`}>{key.name}</div>
                          <div className="text-xs text-muted-foreground">
                            أُنشئ: {new Date(key.createdAt).toLocaleDateString('ar-SA')}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={key.isActive ? 'default' : 'secondary'}>
                          {key.isActive ? (
                            <><CheckCircle className="w-3 h-3 ml-1" /> نشط</>
                          ) : (
                            'معطل'
                          )}
                        </Badge>
                        <Badge variant="outline">
                          {key.usageCount || 0} تذكرة
                        </Badge>
                        {key.lastUsedAt && (
                          <Badge variant="outline">
                            <Clock className="w-3 h-3 ml-1" />
                            آخر استخدام: {new Date(key.lastUsedAt).toLocaleDateString('ar-SA')}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <code className="flex-1 p-2 bg-muted rounded text-xs font-mono overflow-hidden" dir="ltr" data-testid={`text-api-key-${key.id}`}>
                        {showApiKey === key.id ? key.apiKey : `${key.apiKey.substring(0, 8)}${'*'.repeat(40)}`}
                      </code>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setShowApiKey(showApiKey === key.id ? null : key.id)}
                        data-testid={`button-toggle-key-${key.id}`}
                      >
                        {showApiKey === key.id ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => copyToClipboard(key.apiKey)}
                        data-testid={`button-copy-key-${key.id}`}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteKeyMutation.mutate(key.id)}
                        data-testid={`button-delete-key-${key.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      <span>الأولوية الافتراضية: {key.defaultPriority === 'high' ? 'عالي' : key.defaultPriority === 'low' ? 'منخفض' : key.defaultPriority === 'critical' ? 'حرج' : 'متوسط'}</span>
                      <span>التصنيف: {key.defaultCategory === 'technical' ? 'تقني' : key.defaultCategory === 'network' ? 'شبكات' : key.defaultCategory === 'security' ? 'أمني' : 'دعم'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="w-5 h-5" />
              مثال Power Automate Flow
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Badge>Trigger</Badge>
                <ArrowRight className="w-4 h-4" />
                <span className="text-sm">When a new email arrives in shared mailbox (Outlook 365)</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Badge variant="outline">Condition</Badge>
                <ArrowRight className="w-4 h-4" />
                <span className="text-sm">Check if subject doesn't start with "RE:" (لتجاهل الردود)</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Badge variant="secondary">Action</Badge>
                <ArrowRight className="w-4 h-4" />
                <span className="text-sm">HTTP POST to webhook URL with email subject, body, and sender</span>
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg text-sm mt-3">
              <Shield className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
              <div className="text-muted-foreground">
                يمكنك أيضاً استخدام Outlook Rules مع خدمة مثل Zapier أو Make.com لنفس الغرض.
                المفتاح يعمل مع أي أداة يمكنها إرسال HTTP requests.
              </div>
            </div>
          </CardContent>
        </Card>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>إنشاء مفتاح ربط جديد</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>اسم المفتاح</Label>
                <Input
                  placeholder="مثال: بريد الدعم الفني"
                  value={newKey.name}
                  onChange={(e) => setNewKey({ ...newKey, name: e.target.value })}
                  data-testid="input-key-name"
                />
              </div>
              <div className="space-y-2">
                <Label>الأولوية الافتراضية</Label>
                <Select value={newKey.defaultPriority} onValueChange={(v) => setNewKey({ ...newKey, defaultPriority: v })}>
                  <SelectTrigger data-testid="select-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">منخفض</SelectItem>
                    <SelectItem value="medium">متوسط</SelectItem>
                    <SelectItem value="high">عالي</SelectItem>
                    <SelectItem value="critical">حرج</SelectItem>
                    <SelectItem value="urgent">عاجل</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>التصنيف الافتراضي</Label>
                <Select value={newKey.defaultCategory} onValueChange={(v) => setNewKey({ ...newKey, defaultCategory: v })}>
                  <SelectTrigger data-testid="select-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="support">دعم فني</SelectItem>
                    <SelectItem value="technical">تقني</SelectItem>
                    <SelectItem value="network">شبكات</SelectItem>
                    <SelectItem value="security">أمني</SelectItem>
                    <SelectItem value="hardware">أجهزة</SelectItem>
                    <SelectItem value="software">برمجيات</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>إلغاء</Button>
              <Button
                onClick={() => createKeyMutation.mutate(newKey)}
                disabled={!newKey.name || createKeyMutation.isPending}
                data-testid="button-submit-key"
              >
                {createKeyMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin ml-2" /> : <Key className="w-4 h-4 ml-2" />}
                إنشاء المفتاح
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
