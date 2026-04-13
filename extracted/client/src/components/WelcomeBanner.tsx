import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sun, Moon, Cloud, Coffee, Sparkles, TrendingUp, AlertTriangle, 
  CheckCircle2, Clock, Calendar, Zap, ArrowLeft, Rocket, Target,
  Shield, Bell, Activity, Server, Database, Headphones, Code,
  Users, FileText, BarChart3, Briefcase, ArrowRight
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useLocation } from 'wouter';

interface QuickStat {
  label: string;
  value: number;
  icon: any;
  trend?: 'up' | 'down' | 'neutral';
  urgent?: boolean;
}

interface QuickAction {
  label: string;
  href: string;
  icon: any;
  color: string;
}

interface WelcomeBannerProps {
  userName?: string;
  portalName?: string;
  portal?: string;
  stats?: {
    pendingTasks?: number;
    openTickets?: number;
    completedToday?: number;
    overdueItems?: number;
    slaBreaches?: number;
    activeProjects?: number;
    criticalTickets?: number;
    openIncidents?: number;
    pendingReferrals?: number;
    pendingDSR?: number;
    downServers?: number;
    criticalVulns?: number;
  };
  className?: string;
}

const PORTAL_QUICK_ACTIONS: Record<string, QuickAction[]> = {
  cybersecurity: [
    { label: 'الحوادث الأمنية', href: '/department/cybersecurity/incidents', icon: Shield, color: 'text-red-400' },
    { label: 'الثغرات', href: '/department/cybersecurity/vulnerabilities', icon: AlertTriangle, color: 'text-orange-400' },
    { label: 'الامتثال', href: '/department/cybersecurity/regulatory-compliance', icon: BarChart3, color: 'text-blue-400' },
  ],
  infrastructure: [
    { label: 'الخوادم', href: '/department/infrastructure/servers', icon: Server, color: 'text-green-400' },
    { label: 'التذاكر', href: '/department/infrastructure/tickets', icon: FileText, color: 'text-blue-400' },
    { label: 'المهام', href: '/department/infrastructure/tasks', icon: CheckCircle2, color: 'text-amber-400' },
  ],
  dmo: [
    { label: 'كتالوج البيانات', href: '/dmo/data-catalog', icon: Database, color: 'text-teal-400' },
    { label: 'الامتثال التنظيمي', href: '/dmo/regulatory-compliance', icon: Shield, color: 'text-blue-400' },
    { label: 'طلبات DSR', href: '/dmo', icon: Users, color: 'text-purple-400' },
  ],
  support: [
    { label: 'التذاكر', href: '/department/support/tickets', icon: Headphones, color: 'text-orange-400' },
    { label: 'الإحالات', href: '/department/support/referrals', icon: ArrowRight, color: 'text-blue-400' },
    { label: 'المهام', href: '/department/support/tasks', icon: CheckCircle2, color: 'text-green-400' },
  ],
  digital_transformation: [
    { label: 'المشاريع', href: '/department/digital-transformation/projects', icon: Briefcase, color: 'text-indigo-400' },
    { label: 'المبادرات', href: '/department/digital-transformation/initiatives', icon: Rocket, color: 'text-purple-400' },
    { label: 'التطبيقات', href: '/department/digital-transformation/applications', icon: Code, color: 'text-cyan-400' },
  ],
  it_director: [
    { label: 'مركز القيادة', href: '/it-director/command-center', icon: Activity, color: 'text-blue-400' },
    { label: 'KPI', href: '/it-director/kpi', icon: BarChart3, color: 'text-amber-400' },
    { label: 'التصعيدات', href: '/it-director/escalations', icon: AlertTriangle, color: 'text-red-400' },
  ],
  admin: [
    { label: 'المستخدمون', href: '/admin/users', icon: Users, color: 'text-blue-400' },
    { label: 'سجل التدقيق', href: '/admin/audit', icon: FileText, color: 'text-purple-400' },
    { label: 'KPI', href: '/admin/kpi', icon: BarChart3, color: 'text-amber-400' },
  ],
  committee: [
    { label: 'الاجتماعات', href: '/committee/meetings', icon: Calendar, color: 'text-blue-400' },
    { label: 'التصويت', href: '/committee/voting', icon: Users, color: 'text-purple-400' },
    { label: 'القرارات', href: '/committee/decisions', icon: CheckCircle2, color: 'text-green-400' },
  ],
};

export function WelcomeBanner({ userName, portalName, portal = 'admin', stats, className }: WelcomeBannerProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [, setLocation] = useLocation();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const timeOfDay = useMemo(() => {
    const hour = currentTime.getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  }, [currentTime]);

  const greeting = useMemo(() => {
    const firstName = userName?.split(' ')[0] || 'مستخدم';
    const greetings = {
      morning: [`صباح الخير ${firstName}`, `أهلاً ${firstName}، يوم موفق`],
      afternoon: [`مساء الخير ${firstName}`, `أهلاً ${firstName}`],
      evening: [`مساء النور ${firstName}`, `أهلاً ${firstName}`],
      night: [`مساء الخير ${firstName}`, `أهلاً ${firstName}`],
    };
    return greetings[timeOfDay][0];
  }, [userName, timeOfDay]);

  const TimeIcon = timeOfDay === 'morning' ? Sun : timeOfDay === 'night' ? Moon : Cloud;

  const smartMessage = useMemo(() => {
    if (stats?.downServers && stats.downServers > 0) {
      return { text: `${stats.downServers} خادم متوقف يحتاج تدخل فوري!`, icon: Server, color: 'text-red-400' };
    }
    if (stats?.criticalVulns && stats.criticalVulns > 0) {
      return { text: `${stats.criticalVulns} ثغرة حرجة تحتاج معالجة عاجلة`, icon: Shield, color: 'text-red-400' };
    }
    if (stats?.openIncidents && stats.openIncidents > 0) {
      return { text: `${stats.openIncidents} حادثة أمنية قيد التحقيق`, icon: Shield, color: 'text-orange-400' };
    }
    if (stats?.overdueItems && stats.overdueItems > 0) {
      return { text: `عندك ${stats.overdueItems} عنصر متأخر يحتاج متابعة`, icon: AlertTriangle, color: 'text-red-400' };
    }
    if (stats?.slaBreaches && stats.slaBreaches > 0) {
      return { text: `${stats.slaBreaches} اتفاقية خدمة تحتاج اهتمام عاجل`, icon: Shield, color: 'text-amber-400' };
    }
    if (stats?.criticalTickets && stats.criticalTickets > 0) {
      return { text: `${stats.criticalTickets} تذكرة حرجة مفتوحة — أولوية قصوى`, icon: AlertTriangle, color: 'text-orange-400' };
    }
    if (stats?.pendingReferrals && stats.pendingReferrals > 0) {
      return { text: `${stats.pendingReferrals} إحالة واردة تنتظر تأكيد الاستلام`, icon: Bell, color: 'text-amber-400' };
    }
    if (stats?.pendingDSR && stats.pendingDSR > 0) {
      return { text: `${stats.pendingDSR} طلب حقوق بيانات بانتظار المعالجة`, icon: Database, color: 'text-purple-400' };
    }
    if (stats?.completedToday && stats.completedToday >= 5) {
      return { text: `أداء ممتاز! أنجزت ${stats.completedToday} مهمة اليوم`, icon: Rocket, color: 'text-emerald-400' };
    }
    if (stats?.pendingTasks && stats.pendingTasks > 10) {
      return { text: `${stats.pendingTasks} مهمة في الانتظار - ركز على الأولويات`, icon: Target, color: 'text-sky-400' };
    }
    const dayOfWeek = currentTime.getDay();
    if (dayOfWeek === 0) return { text: 'بداية أسبوع جديد - حدد أهدافك وانطلق!', icon: Sparkles, color: 'hub-stat-gold' };
    if (dayOfWeek === 4) return { text: 'آخر يوم في الأسبوع - أنهِ المعلقات', icon: CheckCircle2, color: 'text-emerald-400' };
    return { text: 'كل شي تمام، استمر بنفس الأداء', icon: Zap, color: 'hub-stat-gold' };
  }, [stats, currentTime]);

  const quickStats: QuickStat[] = useMemo(() => {
    const items: QuickStat[] = [];
    if (portal === 'cybersecurity') {
      if (stats?.openIncidents !== undefined) items.push({ label: 'حوادث مفتوحة', value: stats.openIncidents, icon: Shield, urgent: stats.openIncidents > 0 });
      if (stats?.criticalVulns !== undefined) items.push({ label: 'ثغرات حرجة', value: stats.criticalVulns, icon: AlertTriangle, urgent: stats.criticalVulns > 0 });
      if (stats?.openTickets !== undefined) items.push({ label: 'تذاكر', value: stats.openTickets, icon: Activity });
    } else if (portal === 'infrastructure') {
      if (stats?.downServers !== undefined) items.push({ label: 'خوادم متوقفة', value: stats.downServers, icon: Server, urgent: stats.downServers > 0 });
      if (stats?.openTickets !== undefined) items.push({ label: 'تذاكر مفتوحة', value: stats.openTickets, icon: Activity, urgent: stats.openTickets > 20 });
      if (stats?.overdueItems !== undefined) items.push({ label: 'مهام متأخرة', value: stats.overdueItems, icon: Clock, urgent: stats.overdueItems > 0 });
    } else if (portal === 'dmo') {
      if (stats?.pendingDSR !== undefined) items.push({ label: 'طلبات DSR', value: stats.pendingDSR, icon: Users, urgent: stats.pendingDSR > 0 });
      if (stats?.pendingTasks !== undefined) items.push({ label: 'مهام معلقة', value: stats.pendingTasks, icon: Clock });
      if (stats?.activeProjects !== undefined) items.push({ label: 'مشاريع', value: stats.activeProjects, icon: Target });
    } else if (portal === 'support') {
      if (stats?.openTickets !== undefined) items.push({ label: 'تذاكر مفتوحة', value: stats.openTickets, icon: Headphones, urgent: stats.openTickets > 20 });
      if (stats?.slaBreaches !== undefined) items.push({ label: 'تجاوز SLA', value: stats.slaBreaches, icon: Clock, urgent: stats.slaBreaches > 0 });
      if (stats?.pendingReferrals !== undefined) items.push({ label: 'إحالات', value: stats.pendingReferrals, icon: ArrowRight });
    } else if (portal === 'committee') {
      if (stats?.pendingTasks !== undefined) items.push({ label: 'قرارات معلقة', value: stats.pendingTasks, icon: Clock, urgent: stats.pendingTasks > 0 });
      if (stats?.openTickets !== undefined) items.push({ label: 'تحت التصويت', value: stats.openTickets, icon: CheckCircle2, urgent: stats.openTickets > 0 });
      if (stats?.activeProjects !== undefined) items.push({ label: 'اجتماعات قادمة', value: stats.activeProjects, icon: Target });
    } else if (portal === 'digital_transformation') {
      if (stats?.activeProjects !== undefined) items.push({ label: 'مبادرات نشطة', value: stats.activeProjects, icon: Rocket, urgent: false });
      if (stats?.openTickets !== undefined) items.push({ label: 'تذاكر مفتوحة', value: stats.openTickets, icon: Activity, urgent: stats.openTickets > 20 });
      if (stats?.pendingTasks !== undefined) items.push({ label: 'مهام معلقة', value: stats.pendingTasks, icon: Clock, urgent: stats.pendingTasks > 10 });
    } else {
      if (stats?.pendingTasks !== undefined) items.push({ label: 'مهام معلقة', value: stats.pendingTasks, icon: Clock, urgent: stats.pendingTasks > 10 });
      if (stats?.openTickets !== undefined) items.push({ label: 'تذاكر مفتوحة', value: stats.openTickets, icon: Activity, urgent: stats.openTickets > 20 });
      if (stats?.completedToday !== undefined) items.push({ label: 'منجز اليوم', value: stats.completedToday, icon: CheckCircle2, trend: 'up' });
      if (stats?.activeProjects !== undefined) items.push({ label: 'مشاريع نشطة', value: stats.activeProjects, icon: Target });
    }
    return items.slice(0, 4);
  }, [stats, portal]);

  const quickActions = PORTAL_QUICK_ACTIONS[portal] || PORTAL_QUICK_ACTIONS.admin;

  const formattedDate = currentTime.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const MessageIcon = smartMessage.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={cn("relative overflow-hidden hub-card", className)}
      data-testid="welcome-banner"
    >
      <div className="absolute inset-0 bg-gradient-to-l from-[hsl(var(--accent))]/[0.04] via-transparent to-[hsl(var(--primary))]/20 pointer-events-none" />
      <div className="absolute top-0 left-0 w-32 h-32 bg-[hsl(var(--accent))]/[0.03] rounded-full blur-3xl pointer-events-none" />

      <div className="relative p-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                className="w-10 h-10 rounded-xl bg-gradient-to-br from-[hsl(var(--accent))]/20 to-[hsl(var(--accent))]/5 flex items-center justify-center"
              >
                <TimeIcon className="w-5 h-5 hub-stat-gold" />
              </motion.div>
              <div>
                <h2 className="text-lg font-bold text-white" data-testid="welcome-greeting">{greeting}</h2>
                <p className="text-xs text-white/40">{portalName} • {formattedDate}</p>
              </div>
            </div>
            
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="flex items-center gap-2 mt-3 pr-1"
            >
              <MessageIcon className={cn("w-4 h-4 flex-shrink-0", smartMessage.color)} />
              <span className="text-sm text-white/60" data-testid="welcome-smart-message">{smartMessage.text}</span>
            </motion.div>
          </div>

          {quickStats.length > 0 && (
            <div className="flex items-center gap-3 flex-wrap">
              {quickStats.map((stat, i) => {
                const StatIcon = stat.icon;
                return (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 + i * 0.1 }}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg border",
                      stat.urgent 
                        ? "bg-red-500/10 border-red-500/20" 
                        : "bg-white/[0.03] border-white/[0.06]"
                    )}
                    data-testid={`welcome-stat-${i}`}
                  >
                    <StatIcon className={cn("w-3.5 h-3.5", stat.urgent ? "text-red-400" : "text-white/40")} />
                    <div className="flex flex-col">
                      <span className={cn("text-base font-bold tabular-nums leading-none", stat.urgent ? "text-red-400" : "text-white")}>
                        {stat.value}
                      </span>
                      <span className="text-[10px] text-white/50 leading-none mt-0.5">{stat.label}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex items-center gap-2 mt-4 pt-3 border-t border-white/[0.06]"
        >
          <span className="text-[10px] text-white/30 shrink-0">وصول سريع:</span>
          {quickActions.map((action, i) => {
            const ActionIcon = action.icon;
            return (
              <motion.button
                key={action.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.7 + i * 0.05 }}
                onClick={() => setLocation(action.href)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.15] transition-all text-xs text-white/60 hover:text-white/80"
                data-testid={`welcome-quick-action-${i}`}
              >
                <ActionIcon className={cn("w-3 h-3", action.color)} />
                <span>{action.label}</span>
              </motion.button>
            );
          })}
        </motion.div>
      </div>
    </motion.div>
  );
}
