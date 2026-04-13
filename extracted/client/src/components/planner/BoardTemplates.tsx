import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Shield, Code, Rocket, FolderKanban, FileCheck, Bug,
  Zap, Target, Server, Users, Briefcase, GraduationCap
} from "lucide-react";

export interface BoardTemplate {
  id: string;
  title: string;
  description: string;
  icon: any;
  color: string;
  buckets: string[];
  category: string;
}

export const BOARD_TEMPLATES: BoardTemplate[] = [
  {
    id: 'project',
    title: 'مشروع تقني',
    description: 'لوحة مشروع شاملة مع مراحل التطوير',
    icon: Code,
    color: '#3b82f6',
    buckets: ['المتطلبات', 'التصميم', 'التطوير', 'الاختبار', 'المراجعة', 'مكتمل'],
    category: 'تقنية',
  },
  {
    id: 'sprint',
    title: 'سبرنت أجايل',
    description: 'لوحة سبرنت مع أعمدة Scrum القياسية',
    icon: Rocket,
    color: '#8b5cf6',
    buckets: ['قائمة السبرنت', 'قيد التنفيذ', 'للمراجعة', 'الاختبار', 'تم القبول', 'مكتمل'],
    category: 'تقنية',
  },
  {
    id: 'security',
    title: 'أمن سيبراني',
    description: 'تتبع الحوادث والثغرات الأمنية',
    icon: Shield,
    color: '#ef4444',
    buckets: ['رصد', 'تحقيق', 'احتواء', 'إصلاح', 'اختبار', 'مُغلق'],
    category: 'أمن',
  },
  {
    id: 'bugs',
    title: 'تتبع الأخطاء',
    description: 'تصنيف وتتبع المشاكل والأخطاء البرمجية',
    icon: Bug,
    color: '#f97316',
    buckets: ['جديد', 'مؤكد', 'قيد الإصلاح', 'للمراجعة', 'اختبار إنتاجي', 'تم الإصلاح'],
    category: 'تقنية',
  },
  {
    id: 'infra',
    title: 'البنية التحتية',
    description: 'صيانة وتطوير البنية التحتية والخوادم',
    icon: Server,
    color: '#06b6d4',
    buckets: ['مطلوب', 'مُجدول', 'قيد التنفيذ', 'اختبار', 'منشور', 'مؤرشف'],
    category: 'تقنية',
  },
  {
    id: 'compliance',
    title: 'الامتثال التنظيمي',
    description: 'تتبع متطلبات الامتثال والضوابط',
    icon: FileCheck,
    color: '#10b981',
    buckets: ['متطلب جديد', 'تحليل الفجوة', 'خطة العمل', 'قيد التطبيق', 'تدقيق', 'ممتثل'],
    category: 'حوكمة',
  },
  {
    id: 'onboarding',
    title: 'تأهيل الموظفين',
    description: 'خطوات إعداد وتأهيل الموظفين الجدد',
    icon: Users,
    color: '#a855f7',
    buckets: ['قبل الالتحاق', 'اليوم الأول', 'الأسبوع الأول', 'التدريب', 'المتابعة', 'جاهز'],
    category: 'إدارية',
  },
  {
    id: 'digital',
    title: 'تحول رقمي',
    description: 'مبادرات ومشاريع التحول الرقمي',
    icon: Zap,
    color: '#eab308',
    buckets: ['فكرة', 'دراسة جدوى', 'موافقة', 'تنفيذ', 'تقييم', 'مكتمل'],
    category: 'استراتيجية',
  },
];

interface Props {
  onSelect: (template: BoardTemplate) => void;
}

export default function BoardTemplates({ onSelect }: Props) {
  const categories = Array.from(new Set(BOARD_TEMPLATES.map(t => t.category)));

  return (
    <div className="space-y-4" data-testid="board-templates">
      {categories.map(cat => (
        <div key={cat}>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{cat}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {BOARD_TEMPLATES.filter(t => t.category === cat).map(template => {
              const Icon = template.icon;
              return (
                <Card key={template.id}
                  className="cursor-pointer border-white/5 hover:border-primary/30 hover:bg-primary/5 transition-all duration-200 group"
                  onClick={() => onSelect(template)}
                  data-testid={`template-${template.id}`}>
                  <CardContent className="p-3 flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform"
                      style={{ backgroundColor: template.color + '20' }}>
                      <Icon className="w-4.5 h-4.5" style={{ color: template.color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{template.title}</p>
                      <p className="text-[10px] text-muted-foreground/60 line-clamp-1">{template.description}</p>
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {template.buckets.slice(0, 3).map(b => (
                          <Badge key={b} variant="outline" className="text-[8px] px-1 py-0 border-white/10">{b}</Badge>
                        ))}
                        {template.buckets.length > 3 && (
                          <Badge variant="outline" className="text-[8px] px-1 py-0 border-white/10">+{template.buckets.length - 3}</Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
