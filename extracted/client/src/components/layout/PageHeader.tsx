import { ReactNode, createElement } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: any;
  actions?: ReactNode;
  className?: string;
  testId?: string;
}

export function PageHeader({
  title,
  subtitle,
  icon,
  actions,
  className = '',
  testId,
}: PageHeaderProps) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 ${className}`} data-testid={testId}>
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <div className="hub-icon-gold">
            {createElement(icon, { className: "w-5 h-5" })}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-white/90 truncate">{title}</h1>
          {subtitle && <p className="hub-section-subtitle truncate mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">{actions}</div>
      )}
    </div>
  );
}
