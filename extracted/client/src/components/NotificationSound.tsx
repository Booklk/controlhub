import { useEffect, useRef, useCallback } from 'react';

type SoundType = 'default' | 'success' | 'warning' | 'urgent' | 'welcome';

interface NotificationSoundProps {
  enabled?: boolean;
  volume?: number;
}

export function useNotificationSound({ enabled = true, volume = 0.5 }: NotificationSoundProps = {}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.volume = volume;
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [volume]);

  const playSound = useCallback((type: SoundType = 'default') => {
    if (!enabled) return;
    
    try {
      const frequencies: Record<SoundType, number[]> = {
        default: [523.25, 659.25, 783.99],
        success: [523.25, 783.99, 1046.50],
        warning: [440, 349.23, 440],
        urgent: [880, 698.46, 880, 698.46],
        welcome: [392, 493.88, 587.33, 783.99]
      };
      
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const gainNode = ctx.createGain();
      gainNode.connect(ctx.destination);
      gainNode.gain.value = volume * 0.3;
      
      const freqs = frequencies[type] || frequencies.default;
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = type === 'urgent' ? 'square' : type === 'welcome' ? 'triangle' : 'sine';
        osc.frequency.value = freq;
        osc.connect(gainNode);
        osc.start(ctx.currentTime + i * 0.18);
        osc.stop(ctx.currentTime + i * 0.18 + 0.15);
      });
      
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + freqs.length * 0.18 + 0.3);
    } catch (e) {
      console.warn('Failed to play notification sound', e);
    }
  }, [enabled, volume]);

  const speakWelcome = useCallback((userName?: string) => {
    if (!enabled) return;
    
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      
      const greeting = userName 
        ? `أهلاً وسهلاً ${userName}، حياك الله في منصة مركز التحكم`
        : `أهلاً وسهلاً، حياك الله في منصة مركز التحكم`;
      
      const utterance = new SpeechSynthesisUtterance(greeting);
      utterance.lang = 'ar-SA';
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = volume;
      
      const voices = window.speechSynthesis.getVoices();
      const arabicVoice = voices.find(v => v.lang.includes('ar'));
      if (arabicVoice) {
        utterance.voice = arabicVoice;
      }
      
      playSound('welcome');
      
      setTimeout(() => {
        window.speechSynthesis.speak(utterance);
      }, 800);
    } else {
      playSound('welcome');
    }
  }, [enabled, volume, playSound]);

  return { playSound, speakWelcome };
}

export function NotificationSoundProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
