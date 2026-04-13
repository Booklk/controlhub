import { CheckCircle2, ArrowLeft, Info, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface NextStep {
  icon?: React.ReactNode;
  title: string;
  description?: string;
}

interface QuickAction {
  label: string;
  variant?: "default" | "outline" | "ghost";
  icon?: React.ReactNode;
  onClick: () => void;
  testId?: string;
}

interface FormSuccessPanelProps {
  title: string;
  subtitle?: string;
  referenceNumber?: string;
  referenceLabel?: string;
  nextSteps?: NextStep[];
  actions?: QuickAction[];
  className?: string;
}

export function FormSuccessPanel({
  title,
  subtitle,
  referenceNumber,
  referenceLabel = "رقم المرجع",
  nextSteps = [],
  actions = [],
  className,
}: FormSuccessPanelProps) {
  return (
    <div className={cn("flex flex-col items-center gap-5 py-4 text-center", className)} dir="rtl">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-950">
        <CheckCircle2 className="w-9 h-9 text-green-600 dark:text-green-400" />
      </div>

      <div className="space-y-1">
        <h3 className="text-lg font-bold text-foreground">{title}</h3>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        {referenceNumber && (
          <Badge variant="outline" className="mt-2 text-xs font-mono px-3 py-1">
            {referenceLabel}: {referenceNumber}
          </Badge>
        )}
      </div>

      {nextSteps.length > 0 && (
        <div className="w-full rounded-lg border bg-muted/30 p-4 text-right">
          <p className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1">
            <ChevronRight className="w-3.5 h-3.5" />
            ماذا يحدث الآن؟
          </p>
          <ul className="space-y-2.5">
            {nextSteps.map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-right">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[hsl(var(--primary)/0.15)] text-primary flex items-center justify-center text-xs font-bold mt-0.5">
                  {i + 1}
                </span>
                <div>
                  <span className="font-medium text-foreground">{step.title}</span>
                  {step.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {actions.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 w-full pt-1">
          {actions.map((action, i) => (
            <Button
              key={i}
              variant={action.variant ?? (i === 0 ? "default" : "outline")}
              size="sm"
              onClick={action.onClick}
              className={cn("gap-2", i === 0 && "btn-gold")}
              data-testid={action.testId}
            >
              {action.icon}
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

interface FieldHintProps {
  children: React.ReactNode;
  className?: string;
}

export function FieldHint({ children, className }: FieldHintProps) {
  return (
    <p className={cn("text-xs text-muted-foreground mt-1 flex items-start gap-1", className)}>
      <Info className="w-3 h-3 mt-0.5 flex-shrink-0 opacity-70" />
      <span>{children}</span>
    </p>
  );
}

interface WorkflowStepProps {
  steps: { label: string; active?: boolean; done?: boolean }[];
}

export function WorkflowSteps({ steps }: WorkflowStepProps) {
  return (
    <div className="flex items-center gap-1 text-xs mb-4 flex-wrap" dir="rtl">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-1">
          <span
            className={cn(
              "px-2 py-0.5 rounded-full border text-xs",
              step.done && "bg-green-100 border-green-300 text-green-700 dark:bg-green-950 dark:border-green-700 dark:text-green-400",
              step.active && "bg-primary/10 border-primary text-primary font-medium",
              !step.done && !step.active && "bg-muted border-border text-muted-foreground"
            )}
          >
            {step.label}
          </span>
          {i < steps.length - 1 && (
            <ArrowLeft className="w-3 h-3 text-muted-foreground flex-shrink-0" />
          )}
        </div>
      ))}
    </div>
  );
}

interface FormSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormSection({ title, description, children, className }: FormSectionProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <div>
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
