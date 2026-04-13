import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, TrendingUp, Clock, AlertTriangle, CheckCircle2, 
  Zap, Target, Award, Flame, Star, Coffee, Moon, Sun,
  ArrowRight, RefreshCw, Bell, Calendar, Users, FileText,
  Lightbulb, ThumbsUp, Rocket, Trophy, Heart
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

interface SmartInsight {
  id: string;
  type: 'tip' | 'reminder' | 'achievement' | 'suggestion' | 'alert';
  title: string;
  description: string;
  icon: any;
  action?: { label: string; onClick: () => void };
  priority: number;
}

interface SmartInsightsProps {
  userName: string;
  pendingTasks?: number;
  openTickets?: number;
  completedToday?: number;
  upcomingMeetings?: number;
  overdueTasks?: number;
  slaBreaches?: number;
  portalType: string;
  onNavigate?: (path: string) => void;
}

export function SmartInsights({
  userName,
  pendingTasks = 0,
  openTickets = 0,
  completedToday = 0,
  upcomingMeetings = 0,
  overdueTasks = 0,
  slaBreaches = 0,
  portalType,
  onNavigate
}: SmartInsightsProps) {
  const [currentInsightIndex, setCurrentInsightIndex] = useState(0);
  const [showAll, setShowAll] = useState(false);

  const getTimeOfDay = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    return 'evening';
  };

  const getDayOfWeek = () => {
    return new Date().getDay();
  };

  const insights = useMemo(() => {
    const allInsights: SmartInsight[] = [];
    const timeOfDay = getTimeOfDay();
    const dayOfWeek = getDayOfWeek();
    const firstName = userName.split(' ')[0];

    if (overdueTasks > 0) {
      allInsights.push({
        id: 'overdue',
        type: 'alert',
        title: 'مهام متأخرة تحتاج انتباهك',
        description: `عندك ${overdueTasks} مهمة متأخرة. خلنا نخلص منها اليوم!`,
        icon: AlertTriangle,
        priority: 1,
        action: { label: 'عرض المهام', onClick: () => onNavigate?.('/tasks') }
      });
    }

    if (slaBreaches > 0) {
      allInsights.push({
        id: 'sla',
        type: 'alert',
        title: 'تنبيه SLA',
        description: `في ${slaBreaches} اتفاقية خدمة قريبة من الانتهاك. راجعها بسرعة.`,
        icon: Clock,
        priority: 1
      });
    }

    if (completedToday >= 5) {
      allInsights.push({
        id: 'achievement',
        type: 'achievement',
        title: 'ماشاء الله عليك!',
        description: `خلصت ${completedToday} مهمة اليوم. أداء ممتاز يا ${firstName}!`,
        icon: Trophy,
        priority: 2
      });
    } else if (completedToday >= 3) {
      allInsights.push({
        id: 'progress',
        type: 'achievement',
        title: 'شغل طيب!',
        description: `${completedToday} مهام منجزة اليوم. كمّل على هالنفس!`,
        icon: Flame,
        priority: 3
      });
    }

    if (timeOfDay === 'morning' && pendingTasks > 0) {
      allInsights.push({
        id: 'morning-plan',
        type: 'suggestion',
        title: 'خطة الصباح',
        description: `عندك ${pendingTasks} مهمة بانتظارك. ابدأ بالأهم وخلص الباقي بالتدريج.`,
        icon: Sun,
        priority: 4
      });
    }

    if (timeOfDay === 'evening') {
      allInsights.push({
        id: 'evening-wrap',
        type: 'tip',
        title: 'نهاية يوم موفق',
        description: `حان وقت مراجعة الإنجازات. لا تنسى تحضير خطة بكرة.`,
        icon: Moon,
        priority: 5
      });
    }

    if (dayOfWeek === 0) {
      allInsights.push({
        id: 'sunday',
        type: 'suggestion',
        title: 'بداية أسبوع جديد',
        description: `أسبوع جديد = فرص جديدة. حدد أهداف الأسبوع وخلها واضحة.`,
        icon: Rocket,
        priority: 4
      });
    }

    if (dayOfWeek === 4) {
      allInsights.push({
        id: 'thursday',
        type: 'reminder',
        title: 'نهاية الأسبوع',
        description: `بكرة الجمعة! تأكد من إغلاق المهام المعلقة قبل نهاية الدوام.`,
        icon: Calendar,
        priority: 4
      });
    }

    if (openTickets > 10) {
      allInsights.push({
        id: 'tickets-high',
        type: 'suggestion',
        title: 'تذاكر كثيرة مفتوحة',
        description: `${openTickets} تذكرة مفتوحة. فكّر توزع بعضها على الفريق.`,
        icon: Users,
        priority: 3
      });
    }

    if (upcomingMeetings > 0) {
      allInsights.push({
        id: 'meetings',
        type: 'reminder',
        title: 'اجتماعات قادمة',
        description: `عندك ${upcomingMeetings} اجتماع قريب. جهّز ملاحظاتك مسبقاً.`,
        icon: Calendar,
        priority: 4
      });
    }

    const tips = [
      { title: 'نصيحة الإنتاجية', desc: 'استخدم قاعدة 2 دقيقة: لو المهمة تاخذ أقل من دقيقتين، سوها الحين.', icon: Lightbulb },
      { title: 'صحة وعافية', desc: 'خذ استراحة قصيرة كل ساعة. صحتك أولوية.', icon: Heart },
      { title: 'تنظيم الوقت', desc: 'خصص أول ساعة للمهام الصعبة وأنت بكامل تركيزك.', icon: Target },
      { title: 'التواصل الفعّال', desc: 'الرد السريع على الرسائل يبني ثقة الفريق فيك.', icon: Zap },
    ];
    
    const randomTip = tips[Math.floor(Date.now() / 86400000) % tips.length];
    allInsights.push({
      id: 'daily-tip',
      type: 'tip',
      title: randomTip.title,
      description: randomTip.desc,
      icon: randomTip.icon,
      priority: 6
    });

    return allInsights.sort((a, b) => a.priority - b.priority);
  }, [userName, pendingTasks, openTickets, completedToday, upcomingMeetings, overdueTasks, slaBreaches, onNavigate]);

  useEffect(() => {
    if (insights.length > 1 && !showAll) {
      const interval = setInterval(() => {
        setCurrentInsightIndex((prev) => (prev + 1) % Math.min(insights.length, 3));
      }, 8000);
      return () => clearInterval(interval);
    }
  }, [insights.length, showAll]);

  const getTypeStyles = (type: SmartInsight['type']) => {
    switch (type) {
      case 'alert':
        return 'border-[hsl(var(--accent))] bg-[hsl(var(--accent))]/10';
      case 'achievement':
        return 'border-[hsl(var(--accent))]/50 bg-gradient-to-l from-[hsl(var(--accent))]/20 to-transparent';
      case 'suggestion':
        return 'border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/15';
      case 'reminder':
        return 'border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/50';
      default:
        return 'border-gray-700 bg-gray-800/50';
    }
  };

  const displayedInsights = showAll ? insights : [insights[currentInsightIndex]].filter(Boolean);

  if (insights.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[hsl(var(--accent))]/20">
            <Sparkles className="w-4 h-4 hub-stat-gold" />
          </div>
          <span className="text-sm font-medium hub-stat-gold">رؤى ذكية</span>
        </div>
        {insights.length > 1 && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-xs text-gray-400 hover:text-white"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? 'إخفاء' : `عرض الكل (${insights.length})`}
          </Button>
        )}
      </div>

      <AnimatePresence mode="wait">
        <div className={showAll ? 'space-y-2' : ''}>
          {displayedInsights.map((insight, idx) => (
            <motion.div
              key={insight.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, delay: idx * 0.1 }}
              className={`p-4 rounded-xl border ${getTypeStyles(insight.type)} backdrop-blur-sm`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${
                  insight.type === 'alert' ? 'bg-[hsl(var(--accent))]/30' :
                  insight.type === 'achievement' ? 'bg-[hsl(var(--accent))]/20' :
                  'bg-[hsl(var(--primary))]/30'
                }`}>
                  <insight.icon className={`w-4 h-4 ${
                    insight.type === 'alert' || insight.type === 'achievement' 
                      ? 'hub-stat-gold' 
                      : 'text-gray-300'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-white">{insight.title}</h4>
                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{insight.description}</p>
                </div>
                {insight.action && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="hub-stat-gold hover:bg-[hsl(var(--accent))]/10 text-xs shrink-0"
                    onClick={insight.action.onClick}
                  >
                    {insight.action.label}
                    <ArrowRight className="w-3 h-3 mr-1" />
                  </Button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </AnimatePresence>

      {!showAll && insights.length > 1 && (
        <div className="flex justify-center gap-1">
          {insights.slice(0, 3).map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentInsightIndex(idx)}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                idx === currentInsightIndex ? 'bg-[hsl(var(--accent))]' : 'bg-gray-600'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function QuickActions({ 
  portalType, 
  onAction 
}: { 
  portalType: string; 
  onAction: (action: string) => void;
}) {
  const hour = new Date().getHours();
  
  const getContextualActions = () => {
    const baseActions = [];
    
    if (hour >= 8 && hour < 10) {
      baseActions.push({ id: 'review', label: 'مراجعة المهام', icon: FileText, highlight: true });
    }
    
    if (hour >= 14 && hour < 16) {
      baseActions.push({ id: 'followup', label: 'متابعة التصعيدات', icon: AlertTriangle, highlight: true });
    }

    switch (portalType) {
      case 'it_director':
        return [
          ...baseActions,
          { id: 'assign-task', label: 'تكليف مهمة', icon: Zap },
          { id: 'view-escalations', label: 'التصعيدات', icon: TrendingUp },
          { id: 'department-status', label: 'حالة الأقسام', icon: Users },
        ];
      case 'dmo':
        return [
          ...baseActions,
          { id: 'data-quality', label: 'جودة البيانات', icon: Target },
          { id: 'requests', label: 'طلبات البيانات', icon: FileText },
        ];
      case 'cybersecurity':
        return [
          ...baseActions,
          { id: 'threats', label: 'التهديدات', icon: AlertTriangle },
          { id: 'vulnerabilities', label: 'الثغرات', icon: Target },
        ];
      default:
        return [
          ...baseActions,
          { id: 'tickets', label: 'التذاكر', icon: FileText },
          { id: 'tasks', label: 'المهام', icon: CheckCircle2 },
        ];
    }
  };

  const actions = getContextualActions().slice(0, 4);

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <motion.div
          key={action.id}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAction(action.id)}
            className={`gap-2 ${
              action.highlight 
                ? 'border-[hsl(var(--accent))] hub-stat-gold bg-[hsl(var(--accent))]/10' 
                : 'border-[hsl(var(--primary))]/30 text-gray-300 hover:border-[hsl(var(--accent))]/50'
            }`}
          >
            <action.icon className="w-3.5 h-3.5" />
            {action.label}
          </Button>
        </motion.div>
      ))}
    </div>
  );
}

export function ProductivityScore({ 
  completedTasks, 
  totalTasks,
  onTimeRate 
}: { 
  completedTasks: number;
  totalTasks: number;
  onTimeRate: number;
}) {
  const score = totalTasks > 0 
    ? Math.round((completedTasks / totalTasks) * 50 + onTimeRate * 0.5) 
    : 0;

  const getScoreLabel = () => {
    if (score >= 90) return { text: 'ممتاز', color: 'hub-stat-gold' };
    if (score >= 70) return { text: 'جيد جداً', color: 'hub-stat-gold' };
    if (score >= 50) return { text: 'جيد', color: 'text-gray-300' };
    return { text: 'يحتاج تحسين', color: 'text-gray-400' };
  };

  const label = getScoreLabel();

  return (
    <Card className="bg-gradient-to-br from-[hsl(var(--primary))]/90 to-[hsl(var(--primary))]/60 border-[hsl(var(--primary))]/20">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 hub-stat-gold" />
            <span className="text-sm text-gray-400">مؤشر الإنتاجية</span>
          </div>
          <span className={`text-lg font-bold ${label.color}`}>{score}%</span>
        </div>
        <Progress value={score} className="h-2 bg-[hsl(var(--primary))]/20" />
        <p className={`text-xs mt-2 ${label.color}`}>{label.text}</p>
      </CardContent>
    </Card>
  );
}
