import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, ChevronLeft, ChevronRight, Sparkles, Target, Shield, 
  CheckCircle2, ArrowRight, Play, BookOpen, Lightbulb,
  Users, Database, FileText, Settings, BarChart3, Bell,
  Lock, Eye, Zap, Award, Clock, TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface TourStep {
  id: string;
  title: string;
  description: string;
  icon: any;
  highlight?: string;
  tips?: string[];
}

interface PortalTour {
  portalName: string;
  welcomeTitle: string;
  welcomeDescription: string;
  steps: TourStep[];
}

const portalTours: Record<string, PortalTour> = {
  admin: {
    portalName: 'بوابة المسؤول',
    welcomeTitle: 'أهلاً وسهلاً فيك!',
    welcomeDescription: 'هنا تقدر تتحكم بكل شي بالنظام. خلني أعطيك جولة سريعة على الأدوات اللي عندك.',
    steps: [
      {
        id: 'users',
        title: 'المستخدمين',
        description: 'من هنا تقدر تضيف مستخدمين جدد، تعدّل صلاحياتهم، أو توقف حساباتهم. كل شي بإيدك.',
        icon: Users,
        tips: ['شيّك على الحسابات اللي ما تستخدم كل شهر', 'حدّث الصلاحيات لما أحد يتنقل']
      },
      {
        id: 'audit',
        title: 'سجل العمليات',
        description: 'هنا تشوف كل اللي صار بالنظام - مين سوّى إيش ومتى. مهم جداً للأمان.',
        icon: Eye,
        tips: ['تابع محاولات الدخول الفاشلة', 'نزّل التقارير كل أسبوع']
      },
      {
        id: 'sessions',
        title: 'الجلسات النشطة',
        description: 'تقدر تشوف مين داخل النظام الحين، وتقدر تنهي أي جلسة مشبوهة.',
        icon: Lock,
        tips: ['أنهِ الجلسات الغريبة على طول', 'لاحظ أوقات الذروة']
      },
      {
        id: 'security',
        title: 'الحماية',
        description: 'أنت الحارس هنا - بيانات النادي أمانة عندك.',
        icon: Shield,
        tips: ['فعّل التحقق بخطوتين', 'غيّر كلمات المرور كل 3 شهور']
      }
    ]
  },
  it_director: {
    portalName: 'بوابة مدير التقنية',
    welcomeTitle: 'حياك الله يا مدير!',
    welcomeDescription: 'من هنا تقدر تدير كل الأقسام التقنية وتتابع المشاريع والفرق. خلني أعرفك على كل شي.',
    steps: [
      {
        id: 'overview',
        title: 'نظرة عامة',
        description: 'هنا تشوف كل شي بنظرة وحدة - حالة المشاريع، التذاكر المفتوحة، ومؤشرات الأداء.',
        icon: BarChart3,
        tips: ['ابدأ يومك من هنا', 'التصعيدات العاجلة أولوية']
      },
      {
        id: 'departments',
        title: 'الأقسام',
        description: 'تقدر تدخل على أي قسم - البنية التحتية، الأمن السيبراني، التحول الرقمي، أو الدعم الفني.',
        icon: Users,
        tips: ['وزّع الشغل بالعدل', 'اجتمع مع الرؤساء كل أسبوع']
      },
      {
        id: 'projects',
        title: 'المشاريع',
        description: 'هنا تتابع المشاريع التقنية - التقدم، الميزانية، والمواعيد.',
        icon: Target,
        tips: ['ركّز على المشاريع الاستراتيجية', 'تابع نسب الإنجاز']
      },
      {
        id: 'tasks',
        title: 'المهام',
        description: 'تقدر تكلّف أي قسم بمهمة وتتابع التنفيذ. الإشعارات توصلهم تلقائي.',
        icon: Zap,
        tips: ['حدد مواعيد واضحة', 'تابع المتأخرين']
      },
      {
        id: 'escalations',
        title: 'التصعيدات',
        description: 'المشاكل الكبيرة توصلك هنا. تقدر تتخذ القرار أو تحوّلها.',
        icon: TrendingUp,
        tips: ['رد خلال ساعة', 'وثّق قراراتك']
      }
    ]
  },
  dmo: {
    portalName: 'مكتب إدارة البيانات',
    welcomeTitle: 'أهلاً فيك يا حارس البيانات!',
    welcomeDescription: 'من هنا تدير بيانات النادي وتتأكد من جودتها. خلني أوريك الأدوات اللي عندك.',
    steps: [
      {
        id: 'catalog',
        title: 'كتالوج البيانات',
        description: 'هنا تشوف كل مصادر البيانات عندنا - وين موجودة ومين يملكها.',
        icon: Database,
        tips: ['حدّث الكتالوج لما تضيف مصدر جديد', 'صنّف البيانات حسب الحساسية']
      },
      {
        id: 'dictionary',
        title: 'قاموس البيانات',
        description: 'التعريفات الموحدة لكل المصطلحات. تقدر تشوف الأنظمة المرتبطة بكل مصطلح.',
        icon: BookOpen,
        tips: ['وحّد التعريفات بين الأقسام', 'راجعها كل سنة']
      },
      {
        id: 'quality',
        title: 'جودة البيانات',
        description: 'تابع مؤشرات الجودة - الدقة، الاكتمال، والاتساق.',
        icon: Award,
        tips: ['خلّي الجودة فوق 90%', 'عالج المشاكل بسرعة']
      },
      {
        id: 'requests',
        title: 'الطلبات',
        description: 'هنا توصلك طلبات البيانات من الأقسام الثانية. تقدر تقبلها أو ترفضها.',
        icon: FileText,
        tips: ['رد خلال يومين', 'لو رفضت وضّح السبب']
      },
      {
        id: 'stewards',
        title: 'أمناء البيانات',
        description: 'تواصل مع أمناء البيانات بكل قسم وتابع شغلهم.',
        icon: Users,
        tips: ['عيّن أمين لكل مجال', 'درّبهم على السياسات']
      }
    ]
  },
  committee: {
    portalName: 'بوابة اللجان',
    welcomeTitle: 'حياك الله يا عضو اللجنة!',
    welcomeDescription: 'من هنا تشارك بصنع القرار. صوتك مهم وله تأثير.',
    steps: [
      {
        id: 'meetings',
        title: 'الاجتماعات',
        description: 'هنا تشوف الاجتماعات الجاية ومحاضر الاجتماعات السابقة.',
        icon: Users,
        tips: ['راجع جدول الأعمال قبل الاجتماع', 'أكد حضورك بدري']
      },
      {
        id: 'voting',
        title: 'التصويت',
        description: 'تقدر تصوّت على القرارات المطروحة. كل صوت يفرق.',
        icon: CheckCircle2,
        tips: ['افهم الموضوع قبل ما تصوّت', 'لا تتأخر عن الموعد']
      },
      {
        id: 'decisions',
        title: 'القرارات',
        description: 'تابع القرارات اللي اتخذت ووش صار فيها.',
        icon: Target,
        tips: ['تابع التنفيذ', 'بلّغ لو في مشكلة']
      },
      {
        id: 'documents',
        title: 'الوثائق',
        description: 'كل وثائق اللجنة موجودة هنا - قرارات، سياسات، ومرفقات.',
        icon: FileText,
        tips: ['احفظ نسخة للمهم', 'راجع السياسات سنوياً']
      }
    ]
  },
  cybersecurity: {
    portalName: 'الأمن السيبراني',
    welcomeTitle: 'حياك الله يا حامي النظام!',
    welcomeDescription: 'أنت خط الدفاع الأول. من هنا تراقب وتحمي.',
    steps: [
      {
        id: 'threats',
        title: 'التهديدات',
        description: 'هنا تشوف التهديدات الأمنية وتتابعها لحظة بلحظة.',
        icon: Shield,
        tips: ['راقب 24/7', 'صنّف حسب الخطورة']
      },
      {
        id: 'vulnerabilities',
        title: 'الثغرات',
        description: 'اكتشف الثغرات قبل أي أحد يستغلها. من هنا تتابعها وتعالجها.',
        icon: Eye,
        tips: ['افحص الأنظمة كل أسبوع', 'الثغرات الحرجة أولاً']
      },
      {
        id: 'incidents',
        title: 'الحوادث',
        description: 'لو صار شي، تسجّله هنا وتوثّق الإجراءات.',
        icon: Zap,
        tips: ['طبّق البروتوكول', 'بلّغ الإدارة فوراً']
      },
      {
        id: 'sla',
        title: 'اتفاقيات الخدمة',
        description: 'تقدر تضيف اتفاقيات SLA مع الموردين وتتابع الالتزام.',
        icon: FileText,
        tips: ['تابع أوقات الاستجابة', 'سجّل المخالفات']
      }
    ]
  },
  infrastructure: {
    portalName: 'البنية التحتية',
    welcomeTitle: 'أهلاً فيك يا مهندس!',
    welcomeDescription: 'كل شي يعتمد عليك - الخوادم والشبكات والأنظمة. من هنا تدير كل شي.',
    steps: [
      {
        id: 'servers',
        title: 'الخوادم',
        description: 'تقدر تتابع أداء الخوادم والموارد المتاحة.',
        icon: Database,
        tips: ['راقب الاستهلاك', 'خطط للتوسع بدري']
      },
      {
        id: 'tickets',
        title: 'التذاكر',
        description: 'هنا توصلك تذاكر الدعم. تقدر تسوي تذكرة داخلية بالإدارة وتقدر تجلب التذاكر من إيميلك.',
        icon: FileText,
        tips: ['رد بسرعة', 'صنّف حسب الأولوية']
      },
      {
        id: 'sla',
        title: 'اتفاقيات SLA',
        description: 'تابع اتفاقيات الخدمة مع الموردين وشوف مين ملتزم ومين لا.',
        icon: Award,
        tips: ['راقب أوقات الاستجابة', 'سجّل المخالفات']
      },
      {
        id: 'knowledge',
        title: 'قاعدة المعرفة',
        description: 'وثّق الحلول والإجراءات عشان الكل يستفيد منها.',
        icon: BookOpen,
        tips: ['حدّث المقالات', 'شارك مع الفريق']
      }
    ]
  },
  digital_transformation: {
    portalName: 'التحول الرقمي',
    welcomeTitle: 'أهلاً فيك يا قائد التحول!',
    welcomeDescription: 'أنت تقود المستقبل. من هنا تدير المبادرات الرقمية.',
    steps: [
      {
        id: 'initiatives',
        title: 'المبادرات',
        description: 'هنا تضيف وتتابع مبادرات التحول الرقمي.',
        icon: Lightbulb,
        tips: ['حدد الأولويات', 'قيس العائد']
      },
      {
        id: 'automation',
        title: 'الأتمتة',
        description: 'خلّي النظام يشتغل لحاله. من هنا تتابع العمليات المؤتمتة.',
        icon: Zap,
        tips: ['ابدأ بالمتكرر', 'درّب الموظفين']
      },
      {
        id: 'analytics',
        title: 'التحليلات',
        description: 'البيانات تحكي قصة. من هنا تشوف التقارير والمؤشرات.',
        icon: BarChart3,
        tips: ['أنشئ داشبورد', 'شارك مع الإدارة']
      },
      {
        id: 'documents',
        title: 'المستندات',
        description: 'وثائق المشاريع والسياسات كلها هنا.',
        icon: FileText,
        tips: ['نظّم المجلدات', 'حدّث الوثائق']
      }
    ]
  },
  support: {
    portalName: 'الدعم الفني',
    welcomeTitle: 'حياك الله يا بطل الدعم!',
    welcomeDescription: 'أنت وجه التقنية للمستخدمين. خدمتك الممتازة تفرق.',
    steps: [
      {
        id: 'tickets',
        title: 'التذاكر',
        description: 'هنا توصلك طلبات الدعم. تقدر تسوي تذكرة داخلية أو تجلبها من الإيميل.',
        icon: FileText,
        tips: ['رد خلال ساعة', 'صنّف صح']
      },
      {
        id: 'knowledge',
        title: 'قاعدة المعرفة',
        description: 'وثّق الحلول عشان ما تكرر نفسك. المقالات تفيد الكل.',
        icon: BookOpen,
        tips: ['حدّث باستمرار', 'شارك مع الفريق']
      },
      {
        id: 'tasks',
        title: 'المهام',
        description: 'المهام اللي يكلفك فيها مدير التقنية توصلك هنا.',
        icon: Zap,
        tips: ['التزم بالمواعيد', 'حدّث الحالة']
      },
      {
        id: 'sla',
        title: 'اتفاقيات الخدمة',
        description: 'تابع اتفاقيات الخدمة وتأكد إنك ملتزم.',
        icon: Award,
        tips: ['راقب الأوقات', 'لا تخالف']
      }
    ]
  }
};

interface StorytellingTourProps {
  portalType: string;
  onComplete: () => void;
  isOpen: boolean;
}

export function StorytellingTour({ portalType, onComplete, isOpen }: StorytellingTourProps) {
  const [currentStep, setCurrentStep] = useState(-1);
  const [isAnimating, setIsAnimating] = useState(false);
  
  const tour = portalTours[portalType] || portalTours.admin;
  const totalSteps = tour.steps.length;
  const progress = currentStep >= 0 ? ((currentStep + 1) / totalSteps) * 100 : 0;

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(-1);
    }
  }, [isOpen]);

  const handleNext = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setTimeout(() => {
      if (currentStep < totalSteps - 1) {
        setCurrentStep(currentStep + 1);
      } else {
        onComplete();
      }
      setIsAnimating(false);
    }, 300);
  };

  const handlePrev = () => {
    if (isAnimating || currentStep <= -1) return;
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep(currentStep - 1);
      setIsAnimating(false);
    }, 300);
  };

  const handleStart = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep(0);
      setIsAnimating(false);
    }, 300);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center"
        dir="rtl"
      >
        <div className="absolute inset-0 bg-navy/95 backdrop-blur-md" />
        
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", duration: 0.5 }}
          className="relative w-full max-w-2xl mx-4"
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={onComplete}
            className="absolute -top-12 left-0 text-white/70 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </Button>

          {currentStep === -1 ? (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-gradient-to-br from-navy/80 to-navy rounded-2xl p-8 border border-gold/30 shadow-2xl"
            >
              <div className="text-center space-y-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                  className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center shadow-lg shadow-gold/30"
                >
                  <Sparkles className="w-10 h-10 text-navy" />
                </motion.div>

                <div className="space-y-2">
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="hub-stat-gold text-sm font-medium"
                  >
                    {tour.portalName}
                  </motion.p>
                  <motion.h1
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="text-3xl font-bold text-white"
                  >
                    {tour.welcomeTitle}
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-gray-400 text-lg max-w-md mx-auto"
                  >
                    {tour.welcomeDescription}
                  </motion.p>
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="flex items-center justify-center gap-2 text-gray-500"
                >
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">{totalSteps} خطوات • دقيقتين تقريباً</span>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                >
                  <Button
                    onClick={handleStart}
                    className="hub-btn-gold font-bold px-8 py-6 text-lg rounded-xl shadow-lg shadow-gold/30 transition-all hover:scale-105"
                  >
                    <Play className="w-5 h-5 ml-2" />
                    ابدأ الرحلة
                  </Button>
                </motion.div>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="text-gray-600 text-xs"
                >
                  اضغط ESC للتخطي
                </motion.p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={`step-${currentStep}`}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="bg-gradient-to-br from-navy/80 to-navy rounded-2xl overflow-hidden border border-gray-700/50 shadow-2xl"
            >
              <div className="p-1.5">
                <Progress value={progress} className="h-1 bg-gray-700" />
              </div>

              <div className="p-8">
                <div className="flex items-start gap-6">
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", delay: 0.2 }}
                    className="w-16 h-16 rounded-xl bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center shadow-lg flex-shrink-0"
                  >
                    {tour.steps[currentStep] && (() => {
                      const Icon = tour.steps[currentStep].icon;
                      return <Icon className="w-8 h-8 text-navy" />;
                    })()}
                  </motion.div>

                  <div className="flex-1 space-y-4">
                    <div className="flex items-center justify-between">
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="hub-stat-gold text-sm font-medium"
                      >
                        الخطوة {currentStep + 1} من {totalSteps}
                      </motion.span>
                    </div>

                    <motion.h2
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="text-2xl font-bold text-white"
                    >
                      {tour.steps[currentStep]?.title}
                    </motion.h2>

                    <motion.p
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="text-gray-400 text-lg leading-relaxed"
                    >
                      {tour.steps[currentStep]?.description}
                    </motion.p>

                    {tour.steps[currentStep]?.tips && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="bg-navy/50 rounded-xl p-4 space-y-2 border border-gold/20"
                      >
                        <div className="flex items-center gap-2 hub-stat-gold">
                          <Lightbulb className="w-4 h-4" />
                          <span className="text-sm font-medium">نصائح مهمة</span>
                        </div>
                        <ul className="space-y-1.5">
                          {tour.steps[currentStep].tips?.map((tip, idx) => (
                            <motion.li
                              key={idx}
                              initial={{ opacity: 0, x: 10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.4 + idx * 0.1 }}
                              className="flex items-start gap-2 text-gray-400 text-sm"
                            >
                              <ArrowRight className="w-3 h-3 mt-1 hub-stat-gold" />
                              {tip}
                            </motion.li>
                          ))}
                        </ul>
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>

              <div className="px-8 pb-8 flex items-center justify-between">
                <Button
                  variant="ghost"
                  onClick={handlePrev}
                  disabled={currentStep === 0}
                  className="text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4 ml-1" />
                  السابق
                </Button>

                <div className="flex gap-1.5">
                  {tour.steps.map((_, idx) => (
                    <motion.div
                      key={idx}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        idx === currentStep
                          ? 'bg-gold'
                          : idx < currentStep
                          ? 'bg-gold/50'
                          : 'bg-gray-600'
                      }`}
                      animate={idx === currentStep ? { scale: [1, 1.3, 1] } : {}}
                      transition={{ duration: 0.5 }}
                    />
                  ))}
                </div>

                <Button
                  onClick={handleNext}
                  className="hub-btn-gold font-medium"
                >
                  {currentStep === totalSteps - 1 ? (
                    <>
                      إنهاء الرحلة
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                    </>
                  ) : (
                    <>
                      التالي
                      <ChevronLeft className="w-4 h-4 mr-1" />
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export function TourTriggerButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      onClick={onClick}
      variant="outline"
      size="sm"
      className="gap-2 border-gold/30 hub-stat-gold hover:bg-gold/10"
    >
      <Sparkles className="w-4 h-4" />
      رحلة المستخدم
    </Button>
  );
}

export { portalTours };
