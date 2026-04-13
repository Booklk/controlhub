import { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  height?: number;
  loading?: boolean;
  actions?: ReactNode;
  className?: string;
  testId?: string;
}

export function ChartCard({
  title,
  subtitle,
  children,
  height = 250,
  loading,
  actions,
  className = '',
  testId,
}: ChartCardProps) {
  return (
    <Card className={`hub-card hub-card-gold ${className}`} data-testid={testId}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 px-5 pt-4">
        <div className="min-w-0">
          <CardTitle className="text-sm font-semibold text-white/80">{title}</CardTitle>
          {subtitle && <p className="hub-section-subtitle mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-1 flex-shrink-0">{actions}</div>}
      </CardHeader>
      <CardContent className="px-5 pb-4">
        {loading ? (
          <Skeleton className="bg-white/5 rounded-lg" style={{ height }} />
        ) : (
          <div style={{ height }}>{children}</div>
        )}
      </CardContent>
    </Card>
  );
}
