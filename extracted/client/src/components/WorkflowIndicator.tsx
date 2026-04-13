import { ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface WorkflowStep {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface WorkflowIndicatorProps {
  steps: WorkflowStep[];
  currentStep: string;
  className?: string;
}

export function WorkflowIndicator({ steps, currentStep, className = "" }: WorkflowIndicatorProps) {
  const currentIndex = currentStep ? steps.findIndex(s => s.id === currentStep) : 0;
  return (
    <div className={`flex items-center gap-2 p-4 bg-muted/30 rounded-lg overflow-x-auto ${className}`}>
      {steps.map((step, index) => {
        const Icon = step.icon;
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        return (
          <div key={step.id} className="flex items-center flex-shrink-0">
            <div className="flex flex-col items-center">
              <div className={`p-2 rounded-full transition-all ${
                isCompleted ? 'bg-[hsl(43_74%_49%)] text-muted-foreground' :
                isCurrent ? 'bg-[hsl(222_47%_11%)] text-white ring-2 ring-[hsl(43_74%_49%)]' :
                'bg-muted text-muted-foreground'
              }`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className={`text-xs mt-1 whitespace-nowrap ${isCurrent ? 'font-bold hub-stat-gold' : 'text-muted-foreground'}`}>
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <ArrowRight className={`w-4 h-4 mx-1 ${isCompleted ? 'hub-stat-gold' : 'text-muted-foreground/30'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
