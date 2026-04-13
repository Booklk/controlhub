import { ReactNode, useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean;
  borderGold?: boolean;
}

export function GlassCard({ children, className, hover = true, glow = false, borderGold = true }: GlassCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-visible rounded-xl",
        "hub-card/40 backdrop-blur-xl",
        borderGold ? "border border-gold/20" : "border border-white/10",
        hover && "hover-elevate transition-colors duration-300",
        glow && "shadow-lg shadow-gold/20",
        className
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-navy/20 pointer-events-none rounded-xl" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}

export function AnimatedCounter({ value, duration = 1500, className, prefix = '', suffix = '' }: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const animate = (currentTime: number) => {
      if (!startTimeRef.current) startTimeRef.current = currentTime;
      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      
      const easeOutExpo = 1 - Math.pow(2, -10 * progress);
      setDisplayValue(Math.floor(easeOutExpo * value));
      
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    startTimeRef.current = null;
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  return (
    <span className={cn("tabular-nums font-bold", className)}>
      {prefix}{displayValue.toLocaleString('ar-SA')}{suffix}
    </span>
  );
}

interface PremiumBadgeProps {
  children: ReactNode;
  variant?: 'gold' | 'navy' | 'success' | 'warning' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
  className?: string;
}

export function PremiumBadge({ children, variant = 'gold', size = 'md', pulse = false, className }: PremiumBadgeProps) {
  const variants = {
    gold: "bg-gradient-to-r from-gold to-gold-dark text-navy shadow-lg shadow-gold/30",
    navy: "bg-gradient-to-r from-navy/80 to-navy text-white border border-gold/30",
    success: "hub-badge-gold border border-gold/30",
    warning: "hub-card/60 hub-stat-gold border border-gold/40",
    outline: "bg-transparent border-2 border-gold hub-stat-gold",
  };

  const sizes = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-3 py-1 text-sm",
    lg: "px-4 py-1.5 text-base",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium transition-all duration-300",
        variants[variant],
        sizes[size],
        pulse && "animate-pulse",
        className
      )}
    >
      {children}
    </span>
  );
}

interface GradientButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg' | 'icon';
  className?: string;
  loading?: boolean;
  icon?: ReactNode;
}

export function GradientButton({ 
  children, 
  onClick, 
  disabled, 
  variant = 'primary', 
  size = 'default',
  className,
  loading,
  icon
}: GradientButtonProps) {
  const variants = {
    primary: "bg-gradient-to-r from-gold to-gold-dark text-navy shadow-lg shadow-gold/30",
    secondary: "bg-gradient-to-r from-navy/80 to-navy/70 text-white border border-gold/30",
    outline: "bg-transparent border-2 border-gold hub-stat-gold",
    ghost: "bg-transparent hub-stat-gold",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center font-medium rounded-lg transition-opacity",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        size === 'sm' && "min-h-8 px-3 text-sm gap-1.5",
        size === 'default' && "min-h-9 px-4 text-sm gap-2",
        size === 'lg' && "min-h-10 px-6 text-base gap-2",
        size === 'icon' && "h-9 w-9",
        className
      )}
    >
      {loading ? (
        <LoadingSpinner size={size === 'sm' ? 'sm' : 'md'} />
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  );
}

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  const sizes = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-8 h-8",
  };

  return (
    <div className={cn("relative", sizes[size], className)}>
      <div className="absolute inset-0 rounded-full border-2 border-gold/20" />
      <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-hub-gold animate-spin" />
    </div>
  );
}

interface ShimmerProps {
  className?: string;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
}

export function Shimmer({ className, rounded = 'md' }: ShimmerProps) {
  const roundedClasses = {
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full',
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-navy/50",
        roundedClasses[rounded],
        className
      )}
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-gold/10 to-transparent" />
    </div>
  );
}

interface PremiumStatsCardProps {
  title: string;
  value: number;
  icon: ReactNode;
  trend?: { value: number; isPositive: boolean };
  subtitle?: string;
  className?: string;
  delay?: number;
}

export function PremiumStatsCard({ 
  title, 
  value, 
  icon, 
  trend, 
  subtitle,
  className,
  delay = 0
}: PremiumStatsCardProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <GlassCard 
      className={cn(
        "p-6 transition-all duration-700",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gold/80 font-medium truncate">{title}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <AnimatedCounter 
              value={isVisible ? value : 0} 
              className="text-3xl text-white"
            />
            {trend && (
              <span className={cn(
                "text-xs font-medium px-1.5 py-0.5 rounded",
                trend.isPositive 
                  ? "hub-badge-gold" 
                  : "hub-card/40 text-white/70"
              )}>
                {trend.isPositive ? '+' : ''}{trend.value}%
              </span>
            )}
          </div>
          {subtitle && (
            <p className="mt-1 text-xs text-white/50">{subtitle}</p>
          )}
        </div>
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-gold/30 to-gold/10 flex items-center justify-center flex-shrink-0 transition-transform duration-300 hover:scale-110">
          <div className="hub-stat-gold">{icon}</div>
        </div>
      </div>
    </GlassCard>
  );
}

interface ProgressRingProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  showValue?: boolean;
}

export function ProgressRing({ 
  value, 
  max = 100, 
  size = 80, 
  strokeWidth = 8,
  className,
  showValue = true
}: ProgressRingProps) {
  const [animatedValue, setAnimatedValue] = useState(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percent = (animatedValue / max) * 100;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedValue(value), 100);
    return () => clearTimeout(timer);
  }, [value]);

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#goldGradient)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
        <defs>
          <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(43, 74%, 49%)" />
            <stop offset="100%" stopColor="hsl(43, 74%, 39%)" />
          </linearGradient>
        </defs>
      </svg>
      {showValue && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold text-white">{Math.round(percent)}%</span>
        </div>
      )}
    </div>
  );
}

interface FloatingLabelInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  className?: string;
  id?: string;
}

export function FloatingLabelInput({
  label,
  value,
  onChange,
  type = 'text',
  required,
  className,
  id
}: FloatingLabelInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const hasValue = value.length > 0;

  return (
    <div className={cn("relative", className)}>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        required={required}
        className={cn(
          "w-full px-4 py-3 bg-navy/50 border rounded-lg transition-all duration-300",
          "text-white placeholder-transparent",
          "focus:outline-none focus:ring-2 focus:ring-gold/50",
          isFocused || hasValue
            ? "border-gold/50"
            : "border-gold/20"
        )}
        placeholder={label}
      />
      <label
        htmlFor={id}
        className={cn(
          "absolute right-4 transition-all duration-300 pointer-events-none",
          isFocused || hasValue
            ? "-top-2.5 text-xs bg-navy px-2 hub-stat-gold"
            : "top-3 text-sm text-white/50"
        )}
      >
        {label}
        {required && <span className="hub-stat-gold mr-1">*</span>}
      </label>
    </div>
  );
}

interface PulseIndicatorProps {
  active?: boolean;
  color?: 'gold' | 'navy';
  size?: 'sm' | 'md' | 'lg';
}

export function PulseIndicator({ active = true, color = 'gold', size = 'md' }: PulseIndicatorProps) {
  const colors = {
    gold: 'bg-gold',
    navy: 'bg-navy/60',
  };

  const sizes = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  return (
    <span className="relative inline-flex">
      <span className={cn("rounded-full", colors[color], sizes[size])} />
      {active && (
        <span className={cn(
          "absolute inset-0 rounded-full animate-ping opacity-75",
          colors[color]
        )} />
      )}
    </span>
  );
}

interface DataTableRowProps {
  children: ReactNode;
  index: number;
  onClick?: () => void;
  className?: string;
}

export function DataTableRow({ children, index, onClick, className }: DataTableRowProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), index * 50);
    return () => clearTimeout(timer);
  }, [index]);

  return (
    <tr
      onClick={onClick}
      className={cn(
        "border-b border-gold/10 transition-all duration-500",
        "hover:bg-gold/5",
        onClick && "cursor-pointer",
        isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4",
        className
      )}
    >
      {children}
    </tr>
  );
}

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-16 px-4 text-center",
      className
    )}>
      <div className="w-20 h-20 rounded-full hub-icon-gold flex items-center justify-center mb-6">
        <div className="hub-stat-gold">{icon}</div>
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      {description && (
        <p className="text-white/60 max-w-sm mb-6">{description}</p>
      )}
      {action}
    </div>
  );
}

export const shimmerKeyframes = `
@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}
`;
