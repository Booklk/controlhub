import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, RotateCcw, Coffee, Flame, Target, Volume2, VolumeX } from "lucide-react";

const MODES = {
  focus: { label: 'تركيز', duration: 25 * 60, color: 'from-red-500/20 to-orange-500/10', ring: '#ef4444', icon: Flame },
  shortBreak: { label: 'استراحة قصيرة', duration: 5 * 60, color: 'from-emerald-500/20 to-teal-500/10', ring: '#10b981', icon: Coffee },
  longBreak: { label: 'استراحة طويلة', duration: 15 * 60, color: 'from-blue-500/20 to-indigo-500/10', ring: '#3b82f6', icon: Coffee },
} as const;

type Mode = keyof typeof MODES;

export default function FocusTimer() {
  const [mode, setMode] = useState<Mode>('focus');
  const [timeLeft, setTimeLeft] = useState(MODES.focus.duration);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const config = MODES[mode];
  const progress = ((config.duration - timeLeft) / config.duration) * 100;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const playNotification = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      gain.gain.value = 0.1;
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.value = 1000;
        gain2.gain.value = 0.1;
        osc2.start();
        osc2.stop(ctx.currentTime + 0.3);
      }, 400);
    } catch {}
  }, [soundEnabled]);

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(t => t - 1);
      }, 1000);
    } else if (timeLeft === 0 && isRunning) {
      setIsRunning(false);
      playNotification();
      if (mode === 'focus') {
        setSessionsCompleted(s => s + 1);
      }
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, timeLeft, mode, playNotification]);

  const switchMode = (newMode: Mode) => {
    setMode(newMode);
    setTimeLeft(MODES[newMode].duration);
    setIsRunning(false);
  };

  const reset = () => {
    setTimeLeft(config.duration);
    setIsRunning(false);
  };

  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center py-8 px-4" data-testid="focus-timer">
      <div className="flex gap-2 mb-8">
        {(Object.keys(MODES) as Mode[]).map(m => {
          const Icon = MODES[m].icon;
          return (
            <Button key={m} variant={mode === m ? 'default' : 'outline'} size="sm"
              onClick={() => switchMode(m)} className={`text-xs gap-1.5 ${mode === m ? 'hub-btn-gold' : ''}`}
              data-testid={`button-timer-${m}`}>
              <Icon className="w-3.5 h-3.5" />
              {MODES[m].label}
            </Button>
          );
        })}
      </div>

      <Card className={`bg-gradient-to-br ${config.color} border-white/5 w-full max-w-sm`}>
        <CardContent className="p-8 flex flex-col items-center">
          <div className="relative mb-6">
            <svg width="160" height="160" className="-rotate-90">
              <circle cx="80" cy="80" r={radius} fill="none" stroke="currentColor" className="text-white/5" strokeWidth="6" />
              <circle cx="80" cy="80" r={radius} fill="none" stroke={config.ring} strokeWidth="6"
                strokeDasharray={circumference} strokeDashoffset={offset}
                strokeLinecap="round" className="transition-all duration-1000 drop-shadow-lg" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-mono font-bold tabular-nums tracking-wider">
                {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
              </span>
              <span className="text-xs text-muted-foreground mt-1">{config.label}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button size="icon" variant="outline" className="w-10 h-10 rounded-full" onClick={reset} data-testid="button-timer-reset">
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Button size="icon" className={`w-14 h-14 rounded-full ${isRunning ? 'bg-red-500/80 hover:bg-red-500' : 'hub-btn-gold'}`}
              onClick={() => setIsRunning(!isRunning)} data-testid="button-timer-toggle">
              {isRunning ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 mr-[-2px]" />}
            </Button>
            <Button size="icon" variant="outline" className="w-10 h-10 rounded-full"
              onClick={() => setSoundEnabled(!soundEnabled)} data-testid="button-timer-sound">
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 flex items-center gap-3">
        <Target className="w-4 h-4 text-primary" />
        <span className="text-sm text-muted-foreground">جلسات مكتملة اليوم:</span>
        <Badge variant="secondary" className="hub-badge-gold text-sm px-3">{sessionsCompleted}</Badge>
      </div>

      {timeLeft === 0 && (
        <div className="mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm text-center animate-pulse">
          {mode === 'focus' ? '🎉 أحسنت! خذ استراحة مستحقة' : '⏰ انتهت الاستراحة — وقت العمل!'}
        </div>
      )}
    </div>
  );
}
