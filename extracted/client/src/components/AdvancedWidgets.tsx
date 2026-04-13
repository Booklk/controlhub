import { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Minus, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EnhancedStatCardProps {
  title: string;
  value: number;
  icon: any;
  color: string;
  bgColor: string;
  description?: string;
  trend?: { value: number; direction: 'up' | 'down' | 'neutral' };
  sparklineData?: number[];
  suffix?: string;
  prefix?: string;
  onClick?: () => void;
  delay?: number;
}

function MiniSparkline({ data, color, width = 80, height = 30 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);

  const points = data.map((v, i) => ({
    x: i * step,
    y: height - ((v - min) / range) * (height - 4) - 2,
  }));

  const pathD = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
  const areaD = `${pathD} L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg width={width} height={height} className="opacity-60">
      <defs>
        <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#spark-${color})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="2.5" fill={color} />
    </svg>
  );
}

function AnimatedNumber({ value, duration = 1200, prefix = '', suffix = '' }: { value: number; duration?: number; prefix?: string; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const animate = (time: number) => {
      const progress = Math.min((time - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value, duration]);

  return <span className="tabular-nums">{prefix}{display.toLocaleString('ar-SA')}{suffix}</span>;
}

export function EnhancedStatCard({ title, value, icon: Icon, color, bgColor, description, trend, sparklineData, suffix, prefix, onClick, delay = 0 }: EnhancedStatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={onClick ? { scale: 0.97 } : undefined}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
      onClick={onClick}
      className={cn("cursor-default select-none", onClick && "cursor-pointer")}
      data-testid={`stat-card-${title.replace(/\s+/g, '-')}`}
    >
      <Card className={cn(
        "hub-card transition-all duration-300 overflow-hidden group relative",
        onClick ? "hub-card-interactive hub-card-gold" : "hub-card-hover"
      )}>
        <CardContent className="p-4 relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[hsl(var(--accent))]/[0.04] to-transparent pointer-events-none rounded-full translate-x-1/2 -translate-y-1/2 group-hover:scale-150 transition-transform duration-500" />

          {onClick && (
            <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:translate-x-0 translate-x-1">
              <div className="w-5 h-5 rounded-full bg-white/8 flex items-center justify-center">
                <ArrowUpRight className="w-3 h-3 text-white/60" />
              </div>
            </div>
          )}

          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <p className="text-xs text-white/55 mb-1 font-medium">{title}</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-white tracking-tight">
                  <AnimatedNumber value={value} prefix={prefix} suffix={suffix} />
                </span>
                {trend && (
                  <div className={cn(
                    "flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full",
                    trend.direction === 'up' ? 'text-emerald-400 bg-emerald-500/10' :
                    trend.direction === 'down' ? 'text-red-400 bg-red-500/10' : 'text-white/60 bg-white/5'
                  )}>
                    {trend.direction === 'up' ? <ArrowUpRight className="w-3 h-3" /> :
                     trend.direction === 'down' ? <ArrowDownRight className="w-3 h-3" /> :
                     <Minus className="w-3 h-3" />}
                    <span>{trend.value}%</span>
                  </div>
                )}
              </div>
              {description && <p className="text-[10px] text-white/45 mt-0.5 leading-snug">{description}</p>}
            </div>
            <div className={cn(
              "w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg",
              bgColor
            )}>
              <Icon className={cn("w-5 h-5", color)} />
            </div>
          </div>

          {sparklineData && sparklineData.length > 1 && (
            <div className="mt-2 opacity-70 group-hover:opacity-100 transition-opacity duration-300">
              <MiniSparkline
                data={sparklineData}
                color={color.includes('gold') || color.includes('43,74') ? '#c9a227' : color.includes('emerald') ? '#34d399' : color.includes('sky') ? '#38bdf8' : color.includes('red') ? '#f87171' : '#94a3b8'}
                width={200}
                height={28}
              />
            </div>
          )}

          {onClick && (
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[hsl(var(--accent)/0.3)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

interface RiskCell {
  likelihood: number;
  impact: number;
  count: number;
  items?: string[];
}

interface RiskHeatMapProps {
  data?: RiskCell[];
  className?: string;
}

export function RiskHeatMap({ data, className }: RiskHeatMapProps) {
  const defaultData: RiskCell[] = useMemo(() => [
    { likelihood: 1, impact: 1, count: 0 }, { likelihood: 1, impact: 2, count: 1 }, { likelihood: 1, impact: 3, count: 0 },
    { likelihood: 2, impact: 1, count: 2 }, { likelihood: 2, impact: 2, count: 3 }, { likelihood: 2, impact: 3, count: 1 },
    { likelihood: 3, impact: 1, count: 1 }, { likelihood: 3, impact: 2, count: 2 }, { likelihood: 3, impact: 3, count: 0 },
  ], []);

  const cells = data || defaultData;
  const impactLabels = ['منخفض', 'متوسط', 'مرتفع'];
  const likelihoodLabels = ['نادر', 'محتمل', 'متكرر'];

  const getCellColor = (likelihood: number, impact: number, count: number) => {
    if (count === 0) return 'bg-white/[0.03] border-white/[0.04]';
    const riskLevel = likelihood * impact;
    if (riskLevel >= 6) return 'bg-red-500/25 border-red-500/30 text-red-300';
    if (riskLevel >= 3) return 'bg-amber-500/20 border-amber-500/25 text-amber-300';
    return 'bg-emerald-500/15 border-emerald-500/20 text-emerald-300';
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.2 }}>
      <Card className={cn("hub-card", className)}>
        <CardHeader className="pb-3 pt-4 px-5">
          <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-red-500/15 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-red-400" />
            </div>
            مصفوفة المخاطر
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <div className="relative">
            <div className="text-[10px] text-white/50 mb-2 text-center">التأثير →</div>
            <div className="flex gap-1 mb-1 pr-14">
              {impactLabels.map(label => (
                <div key={label} className="flex-1 text-center text-[10px] text-white/60">{label}</div>
              ))}
            </div>
            {[3, 2, 1].map((likelihood, rowIdx) => (
              <div key={likelihood} className="flex gap-1 mb-1 items-center">
                <div className="w-12 text-left text-[10px] text-white/60 flex-shrink-0">
                  {likelihoodLabels[likelihood - 1]}
                </div>
                {[1, 2, 3].map(impact => {
                  const cell = cells.find(c => c.likelihood === likelihood && c.impact === impact);
                  const count = cell?.count || 0;
                  return (
                    <motion.div
                      key={`${likelihood}-${impact}`}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.3 + rowIdx * 0.1 + impact * 0.05 }}
                      className={cn(
                        "flex-1 aspect-square rounded-lg border flex items-center justify-center text-sm font-bold transition-transform hover:scale-105",
                        getCellColor(likelihood, impact, count)
                      )}
                    >
                      {count > 0 ? count : '-'}
                    </motion.div>
                  );
                })}
              </div>
            ))}
            <div className="text-[10px] text-white/50 mt-2 text-right">← الاحتمالية</div>
            <div className="flex items-center gap-3 mt-3 justify-center">
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/30" /><span className="text-[10px] text-white/60">منخفض</span></div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500/30" /><span className="text-[10px] text-white/60">متوسط</span></div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-red-500/25 border border-red-500/30" /><span className="text-[10px] text-white/60">مرتفع</span></div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

interface ComplianceRingProps {
  label: string;
  value: number;
  total?: number;
  size?: number;
  color?: string;
  icon?: any;
  className?: string;
}

export function ComplianceRing({ label, value, total = 100, size = 100, color = '#c9a227', icon: Icon, className }: ComplianceRingProps) {
  const [animatedValue, setAnimatedValue] = useState(0);
  const percentage = Math.round((value / total) * 100);

  useEffect(() => {
    const start = performance.now();
    const duration = 1500;
    const animate = (time: number) => {
      const progress = Math.min((time - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedValue(Math.round(eased * percentage));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [percentage]);

  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (animatedValue / 100) * circumference;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className={cn("flex flex-col items-center gap-2", className)}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.06)" strokeWidth="6" fill="none" />
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            stroke={color}
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 0.1s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {Icon && <Icon className="w-4 h-4 mb-0.5" style={{ color }} />}
          <span className="text-lg font-black text-white tabular-nums">{animatedValue}%</span>
        </div>
      </div>
      <span className="text-xs text-white/50 text-center leading-tight">{label}</span>
    </motion.div>
  );
}

interface LiveActivityItem {
  id: number;
  user: string;
  action: string;
  target: string;
  time: string;
  type: 'create' | 'update' | 'delete' | 'login' | 'complete' | 'comment';
  portal?: string;
}

interface LiveActivityFeedProps {
  activities: LiveActivityItem[];
  className?: string;
  maxItems?: number;
}

const activityColors: Record<string, { bg: string; text: string; dot: string }> = {
  create: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  update: { bg: 'bg-sky-500/10', text: 'text-sky-400', dot: 'bg-sky-400' },
  delete: { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-400' },
  login: { bg: 'bg-[hsl(var(--accent))]/10', text: 'hub-stat-gold', dot: 'bg-[hsl(var(--accent))]' },
  complete: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  comment: { bg: 'bg-purple-500/10', text: 'text-purple-400', dot: 'bg-purple-400' },
};

export function LiveActivityFeed({ activities, className, maxItems = 8 }: LiveActivityFeedProps) {
  const visibleActivities = activities.slice(0, maxItems);

  return (
    <Card className={cn("hub-card", className)}>
      <CardHeader className="pb-2 pt-4 px-5">
        <CardTitle className="text-sm font-bold text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-sky-500/15 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-sky-400" />
            </div>
            آخر الأنشطة
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-white/60 font-normal">مباشر</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-4">
        <div className="space-y-1">
          {visibleActivities.map((activity, i) => {
            const colors = activityColors[activity.type] || activityColors.update;
            return (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-start gap-3 py-2 border-b border-white/[0.03] last:border-0 group hover:bg-white/[0.02] rounded-lg px-2 -mx-2 transition-colors"
              >
                <div className={cn("w-2 h-2 rounded-full mt-1.5 flex-shrink-0", colors.dot)} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white/70 leading-relaxed">
                    <span className="text-white/90 font-medium">{activity.user}</span>
                    {' '}{activity.action}{' '}
                    <span className={cn("font-medium", colors.text)}>{activity.target}</span>
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-white/50">{activity.time}</span>
                    {activity.portal && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-white/10 text-white/50">
                        {activity.portal}
                      </Badge>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
          {visibleActivities.length === 0 && (
            <div className="text-center py-6 text-white/50 text-xs">لا توجد أنشطة حديثة</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface QuickActionsHubProps {
  actions: Array<{
    label: string;
    icon: any;
    onClick: () => void;
    color?: string;
    badge?: number;
  }>;
  className?: string;
}

export function QuickActionsHub({ actions, className }: QuickActionsHubProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className={cn("flex items-center gap-2 flex-wrap", className)}
    >
      {actions.map((action, i) => {
        const ActionIcon = action.icon;
        return (
          <motion.button
            key={action.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 + i * 0.05 }}
            whileTap={{ scale: 0.97 }}
            onClick={action.onClick}
            data-testid={`quick-action-${action.label.replace(/\s+/g, '-')}`}
            className={cn(
              "relative flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all duration-200",
              "bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] hover:border-white/[0.12]",
              "text-white/70 hover:text-white"
            )}
          >
            <ActionIcon className={cn("w-3.5 h-3.5", action.color || "hub-stat-gold")} />
            {action.label}
            {action.badge !== undefined && action.badge > 0 && (
              <span className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                {action.badge > 9 ? '9+' : action.badge}
              </span>
            )}
          </motion.button>
        );
      })}
    </motion.div>
  );
}
