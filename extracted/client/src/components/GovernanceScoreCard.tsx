import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Activity, Eye, FileCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface GovernanceMetric {
  label: string;
  value: number;
  icon: any;
  color: string;
  detail?: string;
}

interface GovernanceScoreCardProps {
  complianceRate: number;
  securityScore: number;
  operationalScore: number;
  riskScore: number;
  className?: string;
}

function AnimatedGauge({ score, size = 180 }: { score: number; size?: number }) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let start = 0;
    const duration = 2000;
    const startTime = performance.now();

    const animate = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      start = Math.round(eased * score);
      setAnimatedScore(start);

      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [score]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 16;
    const lineWidth = 12;
    const startAngle = 0.75 * Math.PI;
    const endAngle = 2.25 * Math.PI;
    const totalArc = endAngle - startAngle;

    ctx.clearRect(0, 0, size, size);

    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.stroke();

    const scoreAngle = startAngle + (animatedScore / 100) * totalArc;
    const gradient = ctx.createLinearGradient(0, size, size, 0);
    if (animatedScore >= 80) {
      gradient.addColorStop(0, '#22c55e');
      gradient.addColorStop(1, '#4ade80');
    } else if (animatedScore >= 60) {
      gradient.addColorStop(0, '#c9a227');
      gradient.addColorStop(1, '#eab308');
    } else {
      gradient.addColorStop(0, '#ef4444');
      gradient.addColorStop(1, '#f87171');
    }

    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, scoreAngle);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.stroke();

    const dotX = cx + radius * Math.cos(scoreAngle);
    const dotY = cy + radius * Math.sin(scoreAngle);
    ctx.beginPath();
    ctx.arc(dotX, dotY, 6, 0, Math.PI * 2);
    ctx.fillStyle = animatedScore >= 80 ? '#4ade80' : animatedScore >= 60 ? '#eab308' : '#f87171';
    ctx.shadowColor = animatedScore >= 80 ? '#22c55e' : animatedScore >= 60 ? '#c9a227' : '#ef4444';
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;

  }, [animatedScore, size]);

  const getScoreLabel = (s: number) => {
    if (s >= 90) return 'ممتاز';
    if (s >= 80) return 'جيد جداً';
    if (s >= 70) return 'جيد';
    if (s >= 60) return 'مقبول';
    return 'يحتاج تحسين';
  };

  const getScoreColor = (s: number) => {
    if (s >= 80) return 'text-emerald-400';
    if (s >= 60) return 'hub-stat-gold';
    return 'text-red-400';
  };

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size }}
        className="absolute inset-0"
      />
      <div className="flex flex-col items-center z-10 mt-2">
        <span className={cn("text-4xl font-black tabular-nums", getScoreColor(animatedScore))}>
          {animatedScore}
        </span>
        <span className="text-xs text-white/60 mt-0.5">من 100</span>
        <span className={cn("text-xs font-medium mt-1", getScoreColor(animatedScore))}>
          {getScoreLabel(animatedScore)}
        </span>
      </div>
    </div>
  );
}

function MetricBar({ metric, index }: { metric: GovernanceMetric; index: number }) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 300 + index * 150);
    return () => clearTimeout(timer);
  }, [index]);

  const Icon = metric.icon;
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3 + index * 0.1, duration: 0.5 }}
      className="group"
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", metric.color)}>
            <Icon className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs text-white/70 font-medium">{metric.label}</span>
        </div>
        <span className="text-sm font-bold text-white tabular-nums">{metric.value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          className={cn("h-full rounded-full", 
            metric.value >= 80 ? 'bg-gradient-to-l from-emerald-400 to-emerald-500' :
            metric.value >= 60 ? 'bg-gradient-to-l from-[hsl(var(--accent))] to-amber-400' :
            'bg-gradient-to-l from-red-400 to-red-500'
          )}
          initial={{ width: 0 }}
          animate={{ width: animated ? `${metric.value}%` : 0 }}
          transition={{ duration: 1, delay: 0.5 + index * 0.15, ease: [0.4, 0, 0.2, 1] }}
        />
      </div>
      {metric.detail && (
        <p className="text-[10px] text-white/50 mt-0.5 pr-9">{metric.detail}</p>
      )}
    </motion.div>
  );
}

export function GovernanceScoreCard({ complianceRate, securityScore, operationalScore, riskScore, className }: GovernanceScoreCardProps) {
  const overallScore = Math.round((complianceRate + securityScore + operationalScore + (100 - riskScore)) / 4);

  const metrics: GovernanceMetric[] = [
    { label: 'الامتثال والحوكمة', value: complianceRate, icon: FileCheck, color: 'bg-emerald-500/20 text-emerald-400', detail: 'PDPL + NDMO' },
    { label: 'الأمن السيبراني', value: securityScore, icon: Shield, color: 'bg-sky-500/20 text-sky-400', detail: 'التهديدات والثغرات' },
    { label: 'الأداء التشغيلي', value: operationalScore, icon: Activity, color: 'bg-[hsl(var(--accent))]/20 hub-stat-gold', detail: 'SLA والتذاكر' },
    { label: 'إدارة المخاطر', value: Math.max(0, 100 - riskScore), icon: Eye, color: 'bg-purple-500/20 text-purple-400', detail: 'تقييم المخاطر' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <Card className={cn("hub-card overflow-hidden", className)}>
        <CardContent className="p-0">
          <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--accent))]/[0.03] via-transparent to-transparent pointer-events-none" />
          
          <div className="p-5 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-[hsl(var(--accent))]/15 flex items-center justify-center">
                <Shield className="w-4 h-4 hub-stat-gold" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">مؤشر صحة الحوكمة</h3>
                <p className="text-[10px] text-white/60">التقييم الشامل للمنظومة</p>
              </div>
            </div>
          </div>

          <div className="flex items-stretch gap-0">
            <div className="flex-shrink-0 flex items-center justify-center px-4 py-2 border-l border-white/[0.04]">
              <AnimatedGauge score={overallScore} size={160} />
            </div>
            
            <div className="flex-1 px-5 py-3 space-y-3">
              {metrics.map((metric, i) => (
                <MetricBar key={metric.label} metric={metric} index={i} />
              ))}
            </div>
          </div>

          <div className="px-5 py-3 border-t border-white/[0.04] bg-white/[0.02]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className={cn("w-2 h-2 rounded-full", 
                  overallScore >= 80 ? 'bg-emerald-400 animate-pulse' : 
                  overallScore >= 60 ? 'bg-[hsl(var(--accent))] animate-pulse' : 
                  'bg-red-400 animate-pulse'
                )} />
                <span className="text-[10px] text-white/60">
                  آخر تحديث: {new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <span className="text-[10px] text-white/50">Control Hub v4.0</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
