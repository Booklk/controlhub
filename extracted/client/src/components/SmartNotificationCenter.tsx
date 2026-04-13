import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Bell, Check, AlertTriangle, Info, Clock, CheckCircle2,
  Ticket, FolderKanban, ClipboardList, Shield, X, Trash2,
  ChevronRight, ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { apiRequest, queryClient } from "@/lib/queryClient";
import shieldLogo from "@assets/jcsa-shield-logo.png";

interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  priority: string;
  isRead: boolean;
  createdAt: string;
  actionUrl?: string;
  entityType?: string;
  entityId?: number;
}

const typeConfig: Record<string, { icon: typeof Bell; color: string; bg: string; border: string; label: string }> = {
  ticket_assigned:       { icon: Ticket,        color: 'text-blue-500',   bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   label: 'تذكرة' },
  ticket_created:        { icon: Ticket,        color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-400/30',   label: 'تذكرة' },
  ticket_status_changed: { icon: Ticket,        color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-400/30', label: 'تذكرة' },
  ticket_sla_breach:     { icon: AlertTriangle, color: 'text-red-500',    bg: 'bg-red-500/10',    border: 'border-red-500/30',    label: 'SLA' },
  project_assigned:      { icon: FolderKanban,  color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/30', label: 'مشروع' },
  project_status_changed:{ icon: FolderKanban,  color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-400/30', label: 'مشروع' },
  task_assigned:         { icon: ClipboardList, color: 'text-emerald-500',bg: 'bg-emerald-500/10',border: 'border-emerald-500/30',label: 'مهمة' },
  task_overdue:          { icon: Clock,         color: 'text-red-500',    bg: 'bg-red-500/10',    border: 'border-red-500/30',    label: 'مهمة' },
  sla_breach:            { icon: AlertTriangle, color: 'text-red-500',    bg: 'bg-red-500/10',    border: 'border-red-500/30',    label: 'SLA' },
  sla_expiring:          { icon: Clock,         color: 'text-amber-500',  bg: 'bg-amber-500/10',  border: 'border-amber-500/30',  label: 'SLA' },
  sla_warning:           { icon: Shield,        color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-400/30',  label: 'SLA' },
  info:                  { icon: Info,          color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-400/30',   label: 'عام' },
};

function getTimeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'الآن';
  if (diff < 3600) return `${Math.floor(diff / 60)}د`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}س`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}ي`;
  return new Date(dateStr).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' });
}

export default function SmartNotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [hasNew, setHasNew] = useState(false);
  const [prevCount, setPrevCount] = useState(0);
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['/api/notifications'],
    refetchInterval: 3 * 60 * 1000,
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    if (notifications.length > prevCount && prevCount > 0) setHasNew(true);
    setPrevCount(notifications.length);
  }, [notifications.length]);

  useEffect(() => {
    const handler = () => setIsOpen(true);
    window.addEventListener('open-notifications', handler);
    return () => window.removeEventListener('open-notifications', handler);
  }, []);

  const markReadMutation = useMutation({
    mutationFn: (id: number) => apiRequest('PUT', `/api/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/notifications'] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiRequest('PUT', '/api/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/notifications'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/notifications/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/notifications'] }),
  });

  const clearAllMutation = useMutation({
    mutationFn: () => apiRequest('DELETE', '/api/notifications/clear-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/notifications'] }),
  });

  const unread = notifications.filter(n => !n.isRead).length;
  const highPriority = notifications.filter(n => n.priority === 'high' && !n.isRead).length;

  const slaList = notifications.filter(n => ['sla_breach','sla_expiring','sla_warning','ticket_sla_breach'].includes(n.type));
  const taskList = notifications.filter(n => ['task_assigned','task_overdue'].includes(n.type));
  const reminderList = notifications.filter(n => ['ticket_assigned','project_assigned'].includes(n.type));

  const getList = () => {
    if (activeTab === 'sla') return slaList;
    if (activeTab === 'tasks') return taskList;
    if (activeTab === 'reminders') return reminderList;
    return notifications;
  };

  const handleClick = (n: Notification) => {
    if (!n.isRead) markReadMutation.mutate(n.id);
    if (n.actionUrl) { window.location.href = n.actionUrl; setIsOpen(false); }
  };

  const cfg = (type: string) => typeConfig[type] || typeConfig.info;

  return (
    <Popover open={isOpen} onOpenChange={(v) => { setIsOpen(v); if (v) setHasNew(false); }}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          data-testid="button-notifications"
        >
          <Bell className="w-5 h-5" />
          {unread > 0 && (
            <span
              className={`absolute -top-1 -left-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full
                ${highPriority > 0 ? 'bg-red-500 text-white' : 'bg-[hsl(43_74%_49%)] text-[hsl(222_47%_11%)]'}
                ${hasNew ? 'animate-bounce' : ''}`}
              data-testid="badge-notification-count"
            >
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={8} className="w-[400px] p-0 overflow-hidden shadow-2xl border border-border/50">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Bell className="w-4 h-4 hub-stat-gold" />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </div>
            <span className="font-semibold text-sm">الإشعارات</span>
            {unread > 0 && (
              <Badge className="bg-[hsl(43_74%_49%)]/20 text-[hsl(43_74%_49%)] border-[hsl(43_74%_49%)]/30 text-[10px] px-1.5 h-4" variant="outline" data-testid="badge-unread-total">
                {unread} جديد
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unread > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                className="text-[11px] h-7 px-2 gap-1 text-muted-foreground hover:text-foreground"
                data-testid="button-mark-all-read"
              >
                <Check className="w-3 h-3" />
                قراءة الكل
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => clearAllMutation.mutate()}
                disabled={clearAllMutation.isPending}
                className="text-[11px] h-7 px-2 gap-1 text-muted-foreground hover:text-destructive"
                data-testid="button-clear-all"
              >
                <Trash2 className="w-3 h-3" />
                حذف الكل
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b bg-muted/30 h-9 p-0 gap-0">
            {[
              { key: 'all', label: 'الكل', count: unread },
              { key: 'sla', label: 'SLA', count: slaList.filter(n=>!n.isRead).length },
              { key: 'tasks', label: 'مهام', count: taskList.filter(n=>!n.isRead).length },
              { key: 'reminders', label: 'تذكيرات', count: reminderList.filter(n=>!n.isRead).length },
            ].map(tab => (
              <TabsTrigger
                key={tab.key}
                value={tab.key}
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-[hsl(43_74%_49%)] data-[state=active]:bg-transparent text-[11px] h-full gap-1"
                data-testid={`tab-notifications-${tab.key}`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold
                    ${tab.key === 'sla' ? 'bg-red-500/20 text-red-500' : 'bg-[hsl(43_74%_49%)]/20 text-[hsl(43_74%_49%)]'}`}>
                    {tab.count}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={activeTab} className="m-0">
            <ScrollArea className="h-[360px]">
              <NotificationList
                items={getList()}
                cfg={cfg}
                hoveredId={hoveredId}
                setHoveredId={setHoveredId}
                onClick={handleClick}
                onDelete={(id) => deleteMutation.mutate(id)}
                tabKey={activeTab}
              />
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="border-t bg-muted/20 px-4 py-2 flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">
              {notifications.length} إشعار • {unread} غير مقروء
            </span>
            {highPriority > 0 && (
              <Badge variant="destructive" className="text-[10px] h-4 px-1.5 gap-0.5">
                <AlertTriangle className="w-2.5 h-2.5" />
                {highPriority} عاجل
              </Badge>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function NotificationList({
  items, cfg, hoveredId, setHoveredId, onClick, onDelete, tabKey,
}: {
  items: Notification[];
  cfg: (type: string) => typeof typeConfig[string];
  hoveredId: number | null;
  setHoveredId: (id: number | null) => void;
  onClick: (n: Notification) => void;
  onDelete: (id: number) => void;
  tabKey: string;
}) {
  const emptyMessages: Record<string, { icon: typeof Bell; text: string }> = {
    all:       { icon: CheckCircle2, text: 'لا توجد إشعارات — كل شيء تمام' },
    sla:       { icon: Shield,       text: 'لا توجد تنبيهات SLA' },
    tasks:     { icon: ClipboardList,text: 'لا توجد إشعارات مهام' },
    reminders: { icon: Bell,         text: 'لا توجد تذكيرات' },
  };

  if (items.length === 0) {
    const empty = emptyMessages[tabKey] || emptyMessages.all;
    const EmptyIcon = empty.icon;
    return (
      <div className="flex flex-col items-center justify-center py-14 text-muted-foreground gap-3" data-testid={`empty-state-${tabKey}`}>
        <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
          <EmptyIcon className="w-6 h-6 text-muted-foreground/50" />
        </div>
        <p className="text-xs text-center text-muted-foreground/70">{empty.text}</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/30">
      {items.map((n) => {
        const config = cfg(n.type);
        const Icon = config.icon;
        const isHigh = n.priority === 'high';
        const isHovered = hoveredId === n.id;

        return (
          <div
            key={n.id}
            className={`relative flex gap-3 px-4 py-3 cursor-pointer transition-all duration-150 group
              ${!n.isRead ? 'bg-[hsl(43_74%_49%)]/[0.04]' : 'hover:bg-muted/40'}
              ${isHigh ? 'border-r-[3px] border-r-red-500' : ''}`}
            onClick={() => onClick(n)}
            onMouseEnter={() => setHoveredId(n.id)}
            onMouseLeave={() => setHoveredId(null)}
            data-testid={`notification-item-${n.id}`}
          >
            {/* Icon */}
            <div className={`mt-0.5 w-8 h-8 rounded-lg ${config.bg} border ${config.border} flex items-center justify-center flex-shrink-0 relative`}>
              <Icon className={`w-3.5 h-3.5 ${config.color}`} />
              {isHigh && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" data-testid={`priority-dot-${n.id}`} />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Sender row */}
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <div className="flex items-center gap-1.5">
                  <img src={shieldLogo} alt="Control Hub" className="w-3.5 h-3.5 rounded-sm object-contain opacity-70" />
                  <span className="text-[10px] font-medium text-muted-foreground/80 tracking-wide">Control Hub</span>
                  <span className="text-[10px] text-muted-foreground/40">·</span>
                  <span className="text-[10px] text-muted-foreground/50">{getTimeAgo(n.createdAt)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className={`text-[9px] px-1 py-0 h-4 ${config.color} border-current/20`}>
                    {config.label}
                  </Badge>
                  {!n.isRead && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[hsl(43_74%_49%)] flex-shrink-0" />
                  )}
                </div>
              </div>

              {/* Title */}
              <p className={`text-[13px] font-semibold leading-snug truncate
                ${!n.isRead ? 'text-foreground' : 'text-foreground/70'}`}>
                {n.title}
              </p>

              {/* Message - one line only */}
              <p className="text-[11px] text-muted-foreground leading-snug truncate mt-0.5">
                {n.message}
              </p>

              {/* Action link */}
              {n.actionUrl && (
                <button
                  className="mt-1 flex items-center gap-0.5 text-[10px] text-[hsl(43_74%_49%)] hover:underline"
                  onClick={(e) => { e.stopPropagation(); window.location.href = n.actionUrl!; }}
                  data-testid={`action-button-${n.id}`}
                >
                  عرض التفاصيل
                  <ArrowUpRight className="w-2.5 h-2.5" />
                </button>
              )}
            </div>

            {/* Delete button - appears on hover */}
            {isHovered && (
              <button
                className="absolute top-2 left-2 w-5 h-5 rounded-full bg-muted hover:bg-destructive/10 hover:text-destructive flex items-center justify-center transition-colors"
                onClick={(e) => { e.stopPropagation(); onDelete(n.id); }}
                data-testid={`delete-notification-${n.id}`}
              >
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
