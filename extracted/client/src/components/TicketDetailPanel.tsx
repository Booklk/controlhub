import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Ticket, Clock, User, MessageSquare, Activity, CheckCircle2, AlertTriangle,
  ArrowRight, Edit2, Trash2, ExternalLink, CalendarDays, Hash, Shield,
  TrendingUp, Eye, ChevronDown
} from "lucide-react";
import { SLACountdown } from "@/components/SLACountdown";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

interface TicketDetailPanelProps {
  ticket: any | null;
  open: boolean;
  onClose: () => void;
  departmentId?: number;
  onEdit?: (ticket: any) => void;
  onDelete?: (ticketId: number) => void;
  queryKey?: string;
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  open: { label: 'مفتوحة', cls: 'hub-badge-info' },
  new: { label: 'جديدة', cls: 'hub-badge-navy' },
  assigned: { label: 'مسندة', cls: 'hub-badge-navy' },
  in_progress: { label: 'قيد العمل', cls: 'hub-badge-warning' },
  pending: { label: 'في الانتظار', cls: 'hub-badge-neutral' },
  resolved: { label: 'محلولة', cls: 'hub-badge-success' },
  closed: { label: 'مغلقة', cls: 'hub-badge-neutral' },
};

const PRIORITY_CONFIG: Record<string, { label: string; cls: string; icon: string }> = {
  urgent: { label: 'عاجلة', cls: 'text-red-500 bg-red-500/15 border-red-500/30 font-semibold', icon: '🚨' },
  critical: { label: 'حرجة', cls: 'text-red-400 bg-red-500/10 border-red-500/20', icon: '🔴' },
  high: { label: 'عالية', cls: 'text-orange-400 bg-orange-500/10 border-orange-500/20', icon: '🟠' },
  medium: { label: 'متوسطة', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20', icon: '🟡' },
  low: { label: 'منخفضة', cls: 'text-slate-400 bg-slate-500/10 border-slate-500/20', icon: '🟢' },
};

const ACTION_ICONS: Record<string, any> = {
  create: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
  update: <Edit2 className="w-3.5 h-3.5 text-blue-400" />,
  status_change: <ArrowRight className="w-3.5 h-3.5 text-amber-400" />,
  comment: <MessageSquare className="w-3.5 h-3.5 text-purple-400" />,
  delete: <Trash2 className="w-3.5 h-3.5 text-red-400" />,
};

function ActivityTimeline({ ticketId }: { ticketId: number }) {
  const { data: activities = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/it-tickets/${ticketId}/activities`],
    enabled: !!ticketId,
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="space-y-3 py-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-6 h-6 rounded-full bg-muted shrink-0" />
            <div className="flex-1 space-y-1">
              <div className="h-3 bg-muted rounded w-3/4" />
              <div className="h-2 bg-muted rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!activities.length) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <Activity className="w-8 h-8 mx-auto mb-2 opacity-20" />
        <p className="text-xs">لا يوجد سجل نشاط بعد</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {(activities as any[]).map((activity, idx) => (
        <div key={activity.id} className="flex gap-3 group" data-testid={`activity-item-${activity.id}`}>
          <div className="flex flex-col items-center">
            <div className={cn(
              "w-7 h-7 rounded-full border flex items-center justify-center shrink-0",
              "bg-card border-border/50 group-hover:border-[hsl(43_74%_49%)]/30 transition-colors"
            )}>
              {ACTION_ICONS[activity.action] || <Activity className="w-3.5 h-3.5 text-muted-foreground" />}
            </div>
            {idx < activities.length - 1 && (
              <div className="w-px h-full min-h-[20px] bg-border/30 my-1" />
            )}
          </div>
          <div className="pb-4 flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-xs font-medium text-foreground">
                  {activity.user?.name || 'النظام'}
                </span>
                <span className="text-xs text-muted-foreground mr-1">
                  {activity.actionLabel}
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground/60 shrink-0">
                {activity.createdAt ? formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true, locale: ar }) : ''}
              </span>
            </div>
            {activity.details && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{activity.details}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function TicketDetailPanel({
  ticket, open, onClose, departmentId, onEdit, onDelete, queryKey
}: TicketDetailPanelProps) {
  const { toast } = useToast();
  const [comment, setComment] = useState('');
  const [activeTab, setActiveTab] = useState<'details' | 'activity'>('details');

  const statusMutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await apiRequest('PUT', `/api/it-tickets/${ticket?.id}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/it-tickets'] });
      if (queryKey) queryClient.invalidateQueries({ queryKey: [queryKey] });
      toast({ title: 'تم تحديث الحالة بنجاح' });
    },
    onError: (e: any) => toast({ title: 'خطأ في التحديث', description: e?.message, variant: 'destructive' }),
  });

  if (!ticket) return null;

  const statusConf = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
  const priorityConf = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.medium;
  const isResolved = ticket.status === 'resolved' || ticket.status === 'closed';

  const ticketAge = ticket.createdAt ? formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true, locale: ar }) : '';

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent
        side="left"
        className="w-full sm:max-w-2xl p-0 bg-card border-r border-border/50 flex flex-col"
        dir="rtl"
      >
        {/* Header */}
        <div className="shrink-0">
          <div className="h-0.5 bg-gradient-to-l from-[hsl(43_74%_49%)] via-amber-400/50 to-transparent" />
          <SheetHeader className="px-6 py-4 border-b border-border/30">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {ticket.ticketNumber && (
                    <span className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                      <Hash className="w-3 h-3" />{ticket.ticketNumber}
                    </span>
                  )}
                  <Badge className={cn(priorityConf.cls, "text-[10px] border")}>
                    {priorityConf.icon} {priorityConf.label}
                  </Badge>
                  <Badge className={cn(statusConf.cls, "text-[10px]")}>{statusConf.label}</Badge>
                </div>
                <SheetTitle className="text-base font-semibold leading-tight">{ticket.title}</SheetTitle>
              </div>
              <div className="flex gap-1 shrink-0">
                {onEdit && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { onEdit(ticket); onClose(); }} data-testid="panel-edit-ticket">
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>

            {/* SLA Bar */}
            {ticket.slaDeadline && !isResolved && (
              <div className="mt-2">
                <SLACountdown deadline={ticket.slaDeadline} status={ticket.status} />
              </div>
            )}
          </SheetHeader>

          {/* Tab Navigation */}
          <div className="flex border-b border-border/30 px-6">
            {[
              { id: 'details', label: 'التفاصيل', icon: <Eye className="w-3.5 h-3.5" /> },
              { id: 'activity', label: 'سجل النشاط', icon: <Activity className="w-3.5 h-3.5" /> },
            ].map(tab => (
              <button key={tab.id}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors",
                  activeTab === tab.id
                    ? "border-[hsl(43_74%_49%)] text-[hsl(43_74%_49%)]"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setActiveTab(tab.id as any)}
                data-testid={`panel-tab-${tab.id}`}
              >
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Content */}
        <ScrollArea className="flex-1">
          <div className="p-6">
            {activeTab === 'details' && (
              <div className="space-y-5">
                {/* Description */}
                {ticket.description && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">الوصف</h4>
                    <p className="text-sm leading-relaxed bg-muted/30 rounded-lg p-3">{ticket.description}</p>
                  </div>
                )}

                {/* Meta Info Grid */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'المقدم', value: ticket.requesterName || ticket.requesterId, icon: <User className="w-3.5 h-3.5" /> },
                    { label: 'التصنيف', value: ticket.category, icon: <Shield className="w-3.5 h-3.5" /> },
                    { label: 'تاريخ الإنشاء', value: ticketAge, icon: <CalendarDays className="w-3.5 h-3.5" /> },
                    { label: 'آخر تحديث', value: ticket.updatedAt ? formatDistanceToNow(new Date(ticket.updatedAt), { addSuffix: true, locale: ar }) : '-', icon: <Clock className="w-3.5 h-3.5" /> },
                  ].filter(item => item.value).map(({ label, value, icon }) => (
                    <div key={label} className="bg-muted/20 rounded-lg p-3 border border-border/30">
                      <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] mb-1">
                        {icon}{label}
                      </div>
                      <p className="text-xs font-medium truncate">{value}</p>
                    </div>
                  ))}
                </div>

                {/* Change Status */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">تغيير الحالة</h4>
                  <Select
                    value={ticket.status}
                    onValueChange={(v) => statusMutation.mutate(v)}
                    disabled={statusMutation.isPending}
                  >
                    <SelectTrigger className="w-full border-border/50 h-9 text-sm" data-testid="panel-status-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent dir="rtl">
                      <SelectItem value="open">مفتوحة</SelectItem>
                      <SelectItem value="in_progress">قيد العمل</SelectItem>
                      <SelectItem value="pending">في الانتظار</SelectItem>
                      <SelectItem value="resolved">محلولة</SelectItem>
                      <SelectItem value="closed">مغلقة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Quick Action Buttons */}
                {!isResolved && (
                  <div className="flex gap-2">
                    {ticket.status === 'open' && (
                      <Button size="sm" className="flex-1 h-8 text-xs bg-amber-500 hover:bg-amber-600 text-black"
                        onClick={() => statusMutation.mutate('in_progress')} disabled={statusMutation.isPending}
                        data-testid="panel-start-work">
                        <ArrowRight className="w-3.5 h-3.5 ml-1" />بدء العمل
                      </Button>
                    )}
                    {ticket.status === 'in_progress' && (
                      <Button size="sm" className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => statusMutation.mutate('resolved')} disabled={statusMutation.isPending}
                        data-testid="panel-resolve">
                        <CheckCircle2 className="w-3.5 h-3.5 ml-1" />إغلاق كمحلولة
                      </Button>
                    )}
                  </div>
                )}

                {/* Resolution info */}
                {ticket.resolution && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                    <h4 className="text-xs font-semibold text-emerald-400 mb-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />الحل
                    </h4>
                    <p className="text-xs text-emerald-300/80">{ticket.resolution}</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'activity' && (
              <ActivityTimeline ticketId={ticket.id} />
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
