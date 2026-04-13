import { ReactNode, createElement } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

type StatVariant = 'default' | 'gold' | 'success' | 'danger' | 'info' | 'warning';

interface StatCardProps {
  title: string;
  value: number | string;
  icon?: any;
  trend?: {
    value: number;
    direction?: 'up' | 'down' | 'neutral';
    label?: string;
  };
  variant?: StatVariant;
  suffix?: string;
  loading?: boolean;
  onClick?: () => void;
  className?: string;
  testId?: string;
}

const VARIANT_STYLES: Record<StatVariant, { icon: string; value: string }> = {
  default: {
    icon: 'hub-icon-navy hub-icon-sm',
    value: 'hub-stat-white',
  },
  gold: {
    icon: 'hub-icon-gold',
    value: 'hub-stat-gold',
  },
  success: {
    icon: 'hub-icon-success',
    value: 'hub-stat-success',
  },
  danger: {
    icon: 'hub-icon-danger',
    value: 'hub-stat-danger',
  },
  info: {
    icon: 'hub-icon-info',
    value: 'hub-stat-info',
  },
  warning: {
    icon: 'hub-icon-gold',
    value: 'hub-stat-gold',
  },
};

export function StatCard({
  title,
  value,
  icon,
  trend,
  variant = 'default',
  suffix,
  loading,
  onClick,
  className = '',
  testId,
}: StatCardProps) {
  const styles = VARIANT_STYLES[variant];

  if (loading) return <StatCardSkeleton />;

  return (
    <Card
      className={`hub-card ${onClick ? 'hub-card-interactive' : ''} ${className}`}
      onClick={onClick}
      data-testid={testId}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="hub-stat-label mb-2 truncate">{title}</p>
            <p className={`hub-stat-value ${styles.value}`}>
              {value}
              {suffix && <span className="text-sm font-medium text-white/50 mr-1">{suffix}</span>}
            </p>
            {trend && (
              <div className="flex items-center gap-1 mt-2">
                {trend.direction === 'up' && <TrendingUp className="w-3 h-3 text-emerald-400" />}
                {trend.direction === 'down' && <TrendingDown className="w-3 h-3 text-red-400" />}
                {(!trend.direction || trend.direction === 'neutral') && <Minus className="w-3 h-3 text-white/25" />}
                <span className={`text-[10px] font-medium ${
                  trend.direction === 'up' ? 'text-emerald-400' :
                  trend.direction === 'down' ? 'text-red-400' : 'text-white/50'
                }`}>
                  {trend.value > 0 ? '+' : ''}{trend.value}%
                </span>
                {trend.label && <span className="text-[10px] text-white/20 mr-1">{trend.label}</span>}
              </div>
            )}
          </div>
          {icon && (
            <div className={styles.icon}>
              {createElement(icon, { className: "w-5 h-5" })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function StatCardSkeleton() {
  return (
    <Card className="hub-card">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="space-y-2.5">
            <Skeleton className="h-3 w-24 bg-white/5" />
            <Skeleton className="h-7 w-16 bg-white/5" />
          </div>
          <Skeleton className="h-10 w-10 rounded-lg bg-white/5" />
        </div>
      </CardContent>
    </Card>
  );
}
