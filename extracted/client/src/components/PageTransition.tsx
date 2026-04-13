import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'wouter';
import { useEffect, useState, ReactNode, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

const pageVariants = {
  initial: {
    opacity: 0,
    y: 6,
  },
  enter: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.12,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
};

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

export function PageTransition({ children, className = '' }: PageTransitionProps) {
  const [location] = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location}
        initial="initial"
        animate="enter"
        exit="exit"
        variants={pageVariants}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4">
        <div className="relative mx-auto w-10 h-10">
          <div className="w-10 h-10 rounded-lg border-2 border-muted border-t-[hsl(43_74%_49%)] animate-spin" />
        </div>
        <p className="text-sm text-muted-foreground font-medium">جاري التحميل...</p>
      </div>
    </div>
  );
}

export function SectionLoader() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 mx-auto rounded-md border-2 border-muted border-t-muted-foreground animate-spin" />
        <p className="text-xs text-muted-foreground">جاري تحميل المحتوى...</p>
      </div>
    </div>
  );
}

export function LazyWrapper({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<PageLoader />}>
      {children}
    </Suspense>
  );
}

export function ContentSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48 bg-white/5" />
        <Skeleton className="h-9 w-28 bg-white/5" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="rounded-lg border border-white/5 p-5 space-y-3 bg-white/[0.02]">
            <Skeleton className="h-4 w-20 bg-white/5" />
            <Skeleton className="h-8 w-16 bg-white/8" />
            <Skeleton className="h-2 w-full bg-white/3" />
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-white/5 p-6 space-y-4 bg-white/[0.02]">
        <Skeleton className="h-5 w-32 bg-white/5" />
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-md bg-white/5" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4 bg-white/5" />
              <Skeleton className="h-3 w-1/2 bg-white/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-lg border border-white/5 overflow-hidden bg-white/[0.02] animate-in fade-in duration-200">
      <div className="border-b border-white/5 p-3 flex gap-4">
        {[1, 2, 3, 4, 5].map(i => (
          <Skeleton key={i} className="h-4 flex-1 bg-white/5" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="border-b border-white/[0.03] p-3 flex gap-4 items-center">
          {[1, 2, 3, 4, 5].map(j => (
            <Skeleton key={j} className="h-4 flex-1 bg-white/3" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in duration-200">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border border-white/5 p-5 space-y-3 bg-white/[0.02]">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24 bg-white/5" />
            <Skeleton className="h-5 w-16 rounded-full bg-white/5" />
          </div>
          <Skeleton className="h-3 w-full bg-white/3" />
          <Skeleton className="h-3 w-3/4 bg-white/3" />
          <div className="flex items-center gap-2 pt-2">
            <Skeleton className="h-6 w-6 rounded-full bg-white/5" />
            <Skeleton className="h-3 w-20 bg-white/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface FadeInProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

export function FadeIn({ children, delay = 0, className = '' }: FadeInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay, ease: [0.25, 0.1, 0.25, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function SlideIn({ children, delay = 0, className = '', direction = 'right' }: FadeInProps & { direction?: 'left' | 'right' | 'up' | 'down' }) {
  const variants = {
    left: { x: -12, y: 0 },
    right: { x: 12, y: 0 },
    up: { x: 0, y: -8 },
    down: { x: 0, y: 8 },
  };

  return (
    <motion.div
      initial={{ opacity: 0, ...variants[direction] }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.2, delay, ease: [0.25, 0.1, 0.25, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerChildren({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: 0.04,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 6 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.15 } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
