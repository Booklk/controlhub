import { Badge } from "@/components/ui/badge";

export interface StatusConfig {
  styles: Record<string, string>;
  labels: Record<string, string>;
  defaultKey?: string;
}

export function getStatusBadge(status: string, config: StatusConfig) {
  const defaultKey = config.defaultKey || Object.keys(config.styles)[0];
  return (
    <Badge className={config.styles[status] || config.styles[defaultKey] || ""}>
      {config.labels[status] || status}
    </Badge>
  );
}

export const COMMITTEE_DECISION_STATUS: StatusConfig = {
  styles: {
    draft: "bg-muted text-muted-foreground",
    pending_review: "bg-amber-500/20 text-amber-700 dark:text-amber-400",
    pending: "bg-amber-500/20 text-amber-700 dark:text-amber-400",
    review: "bg-primary/20 text-primary",
    voting: "bg-blue-500/20 text-blue-700 dark:text-blue-400",
    approved: "hub-badge-gold-solid",
    rejected: "bg-destructive/20 text-destructive",
    implemented: "bg-accent/30 hub-stat-gold",
  },
  labels: {
    draft: "مسودة", pending_review: "بانتظار المراجعة", pending: "بانتظار المراجعة",
    review: "قيد المراجعة", voting: "قيد التصويت",
    approved: "معتمد", rejected: "مرفوض", implemented: "منفذ",
  },
  defaultKey: "draft",
};

export const MEETING_STATUS: StatusConfig = {
  styles: {
    scheduled: "hub-badge-gold",
    in_progress: "hub-badge-navy",
    completed: "hub-badge-gold-solid",
    cancelled: "bg-destructive/20 text-destructive",
  },
  labels: {
    scheduled: "مجدولة", in_progress: "جارية", completed: "مكتملة", cancelled: "ملغية",
  },
  defaultKey: "scheduled",
};

export const MINUTES_STATUS: StatusConfig = {
  styles: {
    draft: "bg-muted text-muted-foreground",
    approved: "hub-badge-gold",
    published: "hub-badge-gold-solid",
    archived: "bg-primary/10 text-muted-foreground",
  },
  labels: {
    draft: "قيد الإعداد", approved: "معتمد", published: "منشور", archived: "مؤرشف",
  },
  defaultKey: "draft",
};

export const TASK_STATUS: StatusConfig = {
  styles: {
    assigned: "bg-muted text-muted-foreground",
    in_progress: "bg-[hsl(222_47%_11%)]/20 text-muted-foreground",
    review: "hub-badge-gold hub-stat-gold",
    completed: "bg-[hsl(43_74%_49%)] text-muted-foreground",
    archived: "bg-[hsl(222_47%_11%)]/10 text-muted-foreground",
    overdue: "bg-destructive/20 text-destructive",
  },
  labels: {
    assigned: "إسناد", in_progress: "قيد التنفيذ", review: "مراجعة",
    completed: "مكتمل", archived: "مؤرشف", overdue: "متأخرة",
  },
  defaultKey: "assigned",
};

export const MEMBER_STATUS: StatusConfig = {
  styles: {
    nominate: "bg-muted text-muted-foreground",
    review: "bg-muted/30 text-muted-foreground",
    assign: "hub-icon-gold hub-stat-gold",
    activate: "hub-icon-gold hub-stat-gold",
    active: "hub-badge-gold-solid text-muted-foreground",
    inactive: "bg-muted text-muted-foreground",
    pending: "hub-badge-gold",
  },
  labels: {
    nominate: "مرشح", review: "قيد المراجعة", assign: "مُعيّن",
    activate: "قيد التفعيل", active: "نشط", inactive: "غير نشط", pending: "قيد الانتظار",
  },
  defaultKey: "nominate",
};

export const CYBERSECURITY_THREAT_STATUS: StatusConfig = {
  styles: {
    detecting: "bg-[hsl(43_74%_49%)]/20 hub-stat-gold",
    analyzing: "bg-[hsl(222_47%_11%)]/20 text-muted-foreground",
    contained: "bg-[hsl(43_74%_49%)]/30 hub-stat-gold",
    eradicated: "bg-[hsl(43_74%_49%)] text-muted-foreground",
    monitoring: "bg-muted text-muted-foreground",
  },
  labels: {
    detecting: "جاري الاكتشاف", analyzing: "جاري التحليل",
    contained: "تم الاحتواء", eradicated: "تمت الإزالة", monitoring: "قيد المراقبة",
  },
  defaultKey: "monitoring",
};

export const SERVER_STATUS: StatusConfig = {
  styles: {
    running: "hub-badge-gold-solid",
    stopped: "bg-destructive/20 text-destructive",
    maintenance: "hub-badge-gold",
    provisioning: "hub-badge-navy",
  },
  labels: {
    running: "يعمل", stopped: "متوقف", maintenance: "صيانة", provisioning: "قيد التجهيز",
  },
  defaultKey: "running",
};

export const VENDOR_STATUS: StatusConfig = {
  styles: {
    active: "hub-badge-gold-solid",
    inactive: "bg-muted text-muted-foreground",
    pending: "hub-badge-gold",
    suspended: "bg-destructive/20 text-destructive",
    expired: "bg-muted text-muted-foreground",
  },
  labels: {
    active: "نشط", inactive: "غير نشط", pending: "قيد الانتظار",
    suspended: "موقوف", expired: "منتهي",
  },
  defaultKey: "active",
};

export const KPI_STATUS: StatusConfig = {
  styles: {
    on_track: "hub-badge-gold-solid",
    at_risk: "hub-badge-gold",
    behind: "bg-destructive/20 text-destructive",
    completed: "hub-badge-navy",
  },
  labels: {
    on_track: "على المسار", at_risk: "معرض للخطر", behind: "متأخر", completed: "مكتمل",
  },
  defaultKey: "on_track",
};

export const REFERRAL_ESCALATION_STATUS: StatusConfig = {
  styles: {
    pending: "hub-badge-gold",
    accepted: "hub-badge-navy",
    rejected: "bg-red-500/15 text-red-700 border border-red-500/30",
    completed: "hub-badge-gold-solid",
    in_progress: "hub-badge-navy",
  },
  labels: {
    pending: "قيد الانتظار", accepted: "مقبولة", rejected: "مرفوضة",
    completed: "مكتملة", in_progress: "قيد التنفيذ",
  },
  defaultKey: "pending",
};

export const EXTERNAL_SYSTEM_STATUS: StatusConfig = {
  styles: {
    active: "hub-badge-gold-solid",
    pending: "hub-badge-gold",
    inactive: "bg-muted text-muted-foreground",
    maintenance: "hub-badge-navy",
  },
  labels: {
    active: "نشط", pending: "قيد الموافقة", inactive: "غير نشط", maintenance: "صيانة",
  },
  defaultKey: "active",
};
