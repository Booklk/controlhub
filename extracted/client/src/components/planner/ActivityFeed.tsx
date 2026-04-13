import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageSquare, CheckCircle2, AlertCircle, Clock, Activity } from "lucide-react";

interface ActivityItem {
  id: number;
  type: string;
  userName: string;
  taskTitle: string;
  taskId: number;
  content: string;
  createdAt: string;
}

interface Props {
  data: ActivityItem[] | undefined;
  isLoading: boolean;
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2);
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'activity': return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
    case 'comment': return <MessageSquare className="w-3.5 h-3.5 text-blue-400" />;
    case 'alert': return <AlertCircle className="w-3.5 h-3.5 text-amber-400" />;
    default: return <Clock className="w-3.5 h-3.5 text-muted-foreground" />;
  }
}

function getTypeBg(type: string) {
  switch (type) {
    case 'activity': return 'bg-emerald-500/10 border-emerald-500/20';
    case 'comment': return 'bg-blue-500/10 border-blue-500/20';
    case 'alert': return 'bg-amber-500/10 border-amber-500/20';
    default: return 'bg-white/5 border-white/10';
  }
}

function timeAgo(dateStr: string) {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return 'الآن';
  if (diff < 3600) return `منذ ${Math.floor(diff / 60)} د`;
  if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} س`;
  if (diff < 604800) return `منذ ${Math.floor(diff / 86400)} يوم`;
  return date.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' });
}

export default function ActivityFeed({ data, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-3 p-4" data-testid="activity-loading">
        {[1,2,3,4,5].map(i => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-card/30 animate-pulse">
            <div className="w-8 h-8 rounded-full bg-white/5" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-white/5 rounded w-3/4" />
              <div className="h-2.5 bg-white/5 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!data?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground" data-testid="activity-empty">
        <Activity className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-lg font-medium">لا توجد أنشطة حديثة</p>
        <p className="text-sm opacity-60">سجل الأنشطة يظهر هنا فور إجراء أي تعديل</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-4 md:p-6" data-testid="activity-feed">
      <div className="relative">
        <div className="absolute top-4 bottom-4 right-[19px] w-px bg-gradient-to-b from-primary/20 via-white/5 to-transparent" />
        {data.map((item, index) => (
          <div key={item.id} className={`relative flex items-start gap-3 py-3 px-3 rounded-lg hover:bg-card/40 transition-all duration-200 ${index === 0 ? 'bg-card/30' : ''}`}
            data-testid={`activity-item-${item.id}`}
            style={{ animationDelay: `${index * 50}ms` }}>
            <div className={`relative z-10 w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${getTypeBg(item.type)}`}>
              {getTypeIcon(item.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <Avatar className="w-5 h-5 border border-white/10">
                  <AvatarFallback className="text-[8px] bg-primary/10 text-primary font-bold">{getInitials(item.userName)}</AvatarFallback>
                </Avatar>
                <span className="text-xs font-semibold truncate">{item.userName}</span>
                <span className="text-[10px] text-muted-foreground/40 shrink-0">{timeAgo(item.createdAt)}</span>
              </div>
              <p className="text-xs text-muted-foreground/80 leading-relaxed line-clamp-2">{item.content}</p>
              <span className="text-[10px] text-primary/50 truncate block mt-0.5">← {item.taskTitle}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
