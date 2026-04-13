import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Clock, TrendingUp, Vote, Ticket, CheckCircle2, RefreshCw, ArrowLeft } from 'lucide-react';
import { useLocation } from 'wouter';

interface AttentionItem {
  id: number;
  title?: string;
  reason?: string;
  ticketNumber?: string;
  priority: string;
  status: string;
  slaDeadline?: string;
  dueDate?: string;
  createdAt?: string;
  endDate?: string;
  votesFor?: number;
  votesAgainst?: number;
}

interface AttentionData {
  slaBreachedUnassigned: { count: number; items: AttentionItem[] };
  openEscalations: { count: number; items: AttentionItem[] };
  overdueTasks: { count: number; items: AttentionItem[] };
  urgentVotes: { count: number; items: AttentionItem[] };
  myUrgentTickets: { count: number; items: AttentionItem[] };
  totalAttentionItems: number;
}

const priorityColor: Record<string, string> = {
  urgent: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  low: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
};

const priorityLabel: Record<string, string> = {
  urgent: 'عاجل', critical: 'حرج', high: 'عالي', medium: 'متوسط', low: 'منخفض'
};

function formatTimeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const hours = Math.floor((now.getTime() - d.getTime()) / 3600000);
  if (hours < 1) return 'منذ أقل من ساعة';
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  return `منذ ${days} يوم`;
}

function formatDeadline(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const hours = Math.floor((d.getTime() - now.getTime()) / 3600000);
  if (hours < 0) return `تجاوز بـ ${Math.abs(Math.floor(hours / 24))} يوم`;
  if (hours < 1) return 'أقل من ساعة';
  if (hours < 24) return `${hours} ساعة متبقية`;
  return `${Math.floor(hours / 24)} يوم متبقي`;
}

interface SectionProps {
  icon: React.ReactNode;
  title: string;
  count: number;
  items: AttentionItem[];
  color: string;
  renderItem: (item: AttentionItem) => React.ReactNode;
  linkTo?: string;
}

function Section({ icon, title, count, items, color, renderItem, linkTo }: SectionProps) {
  const [, setLocation] = useLocation();
  if (count === 0) return null;
  return (
    <div className="border border-border/50 rounded-lg overflow-hidden">
      <div className={`flex items-center justify-between px-3 py-2 ${color}`}>
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-semibold">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">{count}</Badge>
          {linkTo && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setLocation(linkTo)} data-testid={`btn-attention-goto-${title}`}>
              <ArrowLeft className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
      <div className="divide-y divide-border/30">
        {items.slice(0, 4).map(item => (
          <div key={item.id} className="px-3 py-2 bg-card hover:bg-muted/30 transition-colors">
            {renderItem(item)}
          </div>
        ))}
        {count > 4 && (
          <div className="px-3 py-1 text-xs text-muted-foreground text-center bg-muted/20">
            + {count - 4} عنصر آخر
          </div>
        )}
      </div>
    </div>
  );
}

export function AttentionRequired() {
  const { toast } = useToast();
  const { data, isLoading, refetch, dataUpdatedAt } = useQuery<AttentionData>({
    queryKey: ['/api/attention-required'],
    refetchInterval: 10 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
  });

  const assignMutation = useMutation({
    mutationFn: ({ ticketId }: { ticketId: number }) =>
      apiRequest('POST', '/api/it-tickets/bulk-assign', { ticketIds: [ticketId], assigneeId: null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/attention-required'] });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </CardContent>
      </Card>
    );
  }

  const total = data?.totalAttentionItems ?? 0;

  return (
    <Card className="border-amber-200/50 dark:border-amber-800/30" data-testid="card-attention-required">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-md ${total > 0 ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
            {total > 0
              ? <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              : <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            }
          </div>
          <CardTitle className="text-base">
            {total > 0 ? `يتطلب انتباهك (${total})` : 'كل شيء على ما يرام'}
          </CardTitle>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => refetch()} data-testid="btn-attention-refresh">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {total === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            لا توجد عناصر تحتاج إلى انتباهك الآن
          </p>
        )}

        {data && (
          <>
            <Section
              icon={<Ticket className="h-3.5 w-3.5 text-red-600" />}
              title="تذاكر بدون إسناد تجاوزت SLA"
              count={data.slaBreachedUnassigned.count}
              items={data.slaBreachedUnassigned.items}
              color="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
              linkTo="/it-director/tickets"
              renderItem={(item) => (
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.ticketNumber} • {formatDeadline(item.slaDeadline)}</p>
                  </div>
                  <Badge className={`text-xs shrink-0 ${priorityColor[item.priority] || ''}`}>
                    {priorityLabel[item.priority] || item.priority}
                  </Badge>
                </div>
              )}
            />

            <Section
              icon={<TrendingUp className="h-3.5 w-3.5 text-orange-600" />}
              title="تصعيدات مفتوحة"
              count={data.openEscalations.count}
              items={data.openEscalations.items}
              color="bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400"
              linkTo="/it-director/escalations"
              renderItem={(item) => (
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs truncate">{item.reason}</p>
                  <Badge className={`text-xs shrink-0 ${priorityColor[item.priority] || ''}`}>
                    {priorityLabel[item.priority] || item.priority}
                  </Badge>
                </div>
              )}
            />

            <Section
              icon={<Clock className="h-3.5 w-3.5 text-yellow-600" />}
              title="مهام متأخرة"
              count={data.overdueTasks.count}
              items={data.overdueTasks.items}
              color="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400"
              linkTo="/it-director/tasks"
              renderItem={(item) => (
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{formatTimeAgo(item.dueDate)}</p>
                  </div>
                  <Badge className={`text-xs shrink-0 ${priorityColor[item.priority] || ''}`}>
                    {priorityLabel[item.priority] || item.priority}
                  </Badge>
                </div>
              )}
            />

            <Section
              icon={<Vote className="h-3.5 w-3.5 text-purple-600" />}
              title="تصويتات تنتهي قريباً"
              count={data.urgentVotes.count}
              items={data.urgentVotes.items}
              color="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400"
              linkTo="/committee"
              renderItem={(item) => (
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{formatDeadline(item.endDate)} • موافق {item.votesFor} | رافض {item.votesAgainst}</p>
                  </div>
                </div>
              )}
            />

            <Section
              icon={<AlertTriangle className="h-3.5 w-3.5 text-blue-600" />}
              title="تذاكر عاجلة معيّنة لك"
              count={data.myUrgentTickets.count}
              items={data.myUrgentTickets.items}
              color="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
              linkTo="/it-director/tickets"
              renderItem={(item) => (
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.ticketNumber}</p>
                  </div>
                  <Badge className={`text-xs shrink-0 ${priorityColor[item.priority] || ''}`}>
                    {priorityLabel[item.priority] || item.priority}
                  </Badge>
                </div>
              )}
            />
          </>
        )}

        {dataUpdatedAt && (
          <p className="text-xs text-muted-foreground text-center pt-1">
            آخر تحديث: {new Date(dataUpdatedAt).toLocaleTimeString('ar-SA')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
