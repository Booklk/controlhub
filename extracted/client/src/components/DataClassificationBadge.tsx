import { Badge } from "@/components/ui/badge";
import { Shield, ShieldAlert, ShieldCheck, ShieldOff } from "lucide-react";
import { dataClassificationLabels, type DataClassification } from "@shared/schema";

interface DataClassificationBadgeProps {
  classification: DataClassification | string | null | undefined;
  showIcon?: boolean;
  size?: "sm" | "md" | "lg";
}

const classificationConfig: Record<DataClassification, {
  bgColor: string;
  textColor: string;
  borderColor: string;
  icon: typeof Shield;
}> = {
  top_secret: {
    bgColor: "bg-red-500/20",
    textColor: "text-red-400",
    borderColor: "border-red-500/50",
    icon: ShieldAlert
  },
  confidential: {
    bgColor: "bg-orange-500/20",
    textColor: "text-orange-400",
    borderColor: "border-orange-500/50",
    icon: Shield
  },
  restricted: {
    bgColor: "bg-yellow-500/20",
    textColor: "text-yellow-400",
    borderColor: "border-yellow-500/50",
    icon: ShieldCheck
  },
  public: {
    bgColor: "bg-emerald-500/20",
    textColor: "text-emerald-400",
    borderColor: "border-emerald-500/50",
    icon: ShieldOff
  }
};

export function DataClassificationBadge({ 
  classification, 
  showIcon = true,
  size = "md" 
}: DataClassificationBadgeProps) {
  const safeClassification = (classification && classification in classificationConfig) ? classification as DataClassification : 'restricted';
  const config = classificationConfig[safeClassification];
  const Icon = config.icon;
  
  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5",
    md: "text-sm px-2 py-1",
    lg: "text-base px-3 py-1.5"
  };
  
  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5"
  };

  return (
    <Badge 
      variant="outline"
      className={`${config.bgColor} ${config.textColor} ${config.borderColor} ${sizeClasses[size]} font-medium border`}
      data-testid={`badge-classification-${classification}`}
    >
      {showIcon && <Icon className={`${iconSizes[size]} ml-1`} />}
      {dataClassificationLabels[safeClassification] || classification || 'غير محدد'}
    </Badge>
  );
}

export function DataClassificationSelect({
  value,
  onChange,
  disabled = false
}: {
  value: DataClassification;
  onChange: (value: DataClassification) => void;
  disabled?: boolean;
}) {
  const classifications: DataClassification[] = ["top_secret", "confidential", "restricted", "public"];
  
  return (
    <div className="flex flex-wrap gap-2" data-testid="select-data-classification">
      {classifications.map((classification) => {
        const config = classificationConfig[classification];
        const Icon = config.icon;
        const isSelected = value === classification;
        
        return (
          <button
            key={classification}
            type="button"
            disabled={disabled}
            onClick={() => onChange(classification)}
            className={`
              flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 transition-all
              ${isSelected 
                ? `${config.bgColor} ${config.textColor} ${config.borderColor}` 
                : "bg-muted/30 text-muted-foreground border-transparent hover:border-border"
              }
              ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
            `}
            data-testid={`button-classification-${classification}`}
          >
            <Icon className="w-4 h-4" />
            <span className="font-medium">{dataClassificationLabels[classification]}</span>
          </button>
        );
      })}
    </div>
  );
}
