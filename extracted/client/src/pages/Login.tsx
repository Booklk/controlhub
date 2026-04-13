import { useEffect, useState, useRef, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/lib/auth';
import { getPortalDefaultRoute } from '@shared/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Lock, User, Eye, EyeOff, ChevronLeft, ShieldCheck } from 'lucide-react';
import jcsaShieldLogo from '@/assets/jcsa-shield-logo.png';
import heroSecurity from '@/assets/login-hero-security.png';
import heroInfra from '@/assets/login-hero-infrastructure.png';
import heroData from '@/assets/login-hero-data.png';
import heroDigital from '@/assets/login-hero-digital.png';
import heroNetwork from '@/assets/login-hero-network.png';
import heroIntegration from '@/assets/login-hero-integration.png';
import heroGovernance from '@/assets/login-hero-governance.png';
import heroAi from '@/assets/login-hero-ai.png';
import { useNotificationSound } from '@/components/NotificationSound';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { useI18n } from '@/lib/i18n';

const loginSchema = z.object({
  username: z.string()
    .min(1, 'البريد الإلكتروني مطلوب')
    .min(3, 'البريد الإلكتروني مطلوب (3 أحرف على الأقل)'),
  password: z.string()
    .min(1, 'كلمة المرور مطلوبة')
    .min(6, 'كلمة المرور مطلوبة (6 أحرف على الأقل)'),
});

type LoginFormData = z.infer<typeof loginSchema>;

const SLIDE_DURATION = 7000;

const HERO_SLIDES = [
  { image: heroSecurity, title: 'الأمن السيبراني', subtitle: 'حماية شاملة للأنظمة والبيانات من التهديدات المتقدمة', id: 'security' },
  { image: heroDigital, title: 'التحول الرقمي', subtitle: 'تمكين المنظمة من التحول نحو الحلول الرقمية المتكاملة', id: 'digital' },
  { image: heroInfra, title: 'البنية التحتية والشبكات', subtitle: 'بنية تحتية موثوقة وشبكات آمنة تدعم العمليات التشغيلية', id: 'infra' },
  { image: heroData, title: 'إدارة البيانات', subtitle: 'حوكمة البيانات وتحليلها وفق أفضل المعايير والممارسات', id: 'data' },
  { image: heroIntegration, title: 'التكامل التقني', subtitle: 'ربط الأنظمة والمنصات لتحقيق تدفق سلس للمعلومات', id: 'integration' },
  { image: heroGovernance, title: 'الحوكمة والامتثال', subtitle: 'ضمان الالتزام بالأنظمة والسياسات والمعايير التنظيمية', id: 'governance' },
  { image: heroNetwork, title: 'أمن الشبكات', subtitle: 'مراقبة وحماية الاتصالات وتأمين نقاط الوصول', id: 'network' },
  { image: heroAi, title: 'الذكاء الاصطناعي', subtitle: 'تحليلات ذكية واتخاذ قرارات مبنية على البيانات', id: 'ai' },
];

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const { playSound } = useNotificationSound({ enabled: true, volume: 0.4 });
  const { t, lang, setLang, dir } = useI18n();
  const cardRef = useRef<HTMLDivElement>(null);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [slideKey, setSlideKey] = useState(0);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
    const sessionExpired = sessionStorage.getItem('session_expired');
    if (sessionExpired) {
      sessionStorage.removeItem('session_expired');
      toast({
        title: 'انتهت الجلسة',
        description: 'انتهت صلاحية جلستك. يرجى تسجيل الدخول مرة أخرى.',
        variant: 'destructive',
      });
    }
  }, []);

  const goToSlide = useCallback((index: number) => {
    setActiveSlide(index);
    setSlideKey(k => k + 1);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSlide(prev => (prev + 1) % HERO_SLIDES.length);
      setSlideKey(k => k + 1);
    }, SLIDE_DURATION);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (data: LoginFormData) => {
    form.clearErrors();
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.username, password: data.password }),
      });
      const responseData = await response.json();
      if (!response.ok) throw new Error(responseData.error || 'فشل تسجيل الدخول');

      login(responseData.token, responseData.user);
      playSound('success');
      setLoginSuccess(true);
      toast({ title: 'تم تسجيل الدخول بنجاح', description: `مرحباً ${responseData.user.name}` });
      setTimeout(() => {
        setLocation(getPortalDefaultRoute(responseData.user.portal));
      }, 600);
    } catch (error: any) {
      if (cardRef.current) {
        cardRef.current.style.animation = 'none';
        void cardRef.current.offsetHeight;
        cardRef.current.style.animation = 'shakeError 0.4s ease-in-out';
      }
      const msg = error.message || '';
      let description = msg;
      if (msg.includes('مقفل') || msg.includes('محاولات') || msg.includes('locked')) {
        description = t('تم قفل الحساب مؤقتاً بسبب محاولات خاطئة متكررة. حاول بعد 15 دقيقة.');
      } else if (msg.includes('غير مفعل') || msg.includes('not activated')) {
        description = t('الحساب غير مفعل — تحقق من بريدك الإلكتروني أو تواصل مع المسؤول.');
      } else if (msg.includes('معطل') || msg.includes('disabled')) {
        description = t('الحساب معطل — تواصل مع مدير النظام.');
      } else if (msg.includes('بيانات الدخول غير صحيحة') || msg.includes('غير صحيحة') || msg.includes('invalid')) {
        description = t('البريد الإلكتروني أو كلمة المرور غير صحيحة');
      } else if (!msg) {
        description = t('حدث خطأ في الاتصال بالسيرفر. حاول مرة أخرى.');
      }
      toast({ title: t('خطأ في تسجيل الدخول'), description, variant: 'destructive' });
    }
  };

  const isSubmitting = form.formState.isSubmitting;
  const currentSlide = HERO_SLIDES[activeSlide];

  return (
    <div className="min-h-screen w-full relative overflow-hidden" dir={dir}>

      {HERO_SLIDES.map((slide, index) => (
        <div
          key={slide.id}
          className="absolute inset-0"
          style={{
            opacity: activeSlide === index ? 1 : 0,
            transition: 'opacity 2s cubic-bezier(0.4, 0, 0.2, 1)',
            zIndex: activeSlide === index ? 1 : 0,
          }}
        >
          <img
            src={slide.image}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              transform: activeSlide === index ? 'scale(1.04)' : 'scale(1)',
              transition: 'transform 10s cubic-bezier(0.25, 0, 0.25, 1)',
            }}
          />
        </div>
      ))}

      <div className="absolute inset-0 z-[2]" style={{
        background: `
          radial-gradient(ellipse 80% 60% at 75% 50%, 
            hsla(222,47%,5%,0.55) 0%, 
            hsla(222,47%,6%,0.75) 40%, 
            hsla(222,47%,7%,0.88) 70%, 
            hsla(222,47%,5%,0.95) 100%
          )
        `
      }} />
      <div className="absolute inset-0 z-[2]" style={{
        background: 'linear-gradient(to top, hsla(222,47%,4%,0.97) 0%, hsla(222,47%,4%,0.4) 25%, transparent 50%)'
      }} />
      <div className="absolute inset-0 z-[2]" style={{
        background: 'linear-gradient(to bottom, hsla(222,47%,4%,0.6) 0%, transparent 15%)'
      }} />

      <div className="relative z-10 min-h-screen flex flex-col">

        <header className={`flex items-center justify-between px-6 lg:px-10 pt-5 pb-3 transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-3'}`}>
          <div className="flex items-center gap-3">
            <img
              src={jcsaShieldLogo}
              alt="نادي سباقات الخيل"
              className="h-10 w-auto object-contain"
              style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))' }}
              data-testid="img-jcsa-logo-header"
            />
            <div className="hidden sm:block">
              <h1 className="text-sm font-bold text-white/80 tracking-tight leading-tight">Control Hub</h1>
              <p className="text-[10px] text-white/50 font-medium leading-tight">نادي سباقات الخيل</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-white/45">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/60" style={{ animation: 'gentlePulse 4s ease-in-out infinite' }} />
              <span className="hidden sm:inline tracking-wide">{t('النظام متصل')}</span>
            </div>
            <button
              onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
              className="px-2.5 py-1 rounded-md border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white/80 transition-all duration-200 text-[11px] font-medium tracking-wide"
              data-testid="button-login-lang-toggle"
            >
              {lang === 'ar' ? 'EN' : 'عربي'}
            </button>
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center px-5 pb-4">
          <div className="w-full max-w-[1000px] flex flex-col lg:flex-row items-center gap-8 lg:gap-20">

            <div className={`flex-1 max-w-[440px] lg:max-w-[480px] text-center lg:text-right transition-all duration-1000 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'}`}>
              <div className="lg:hidden mb-6">
                <img
                  src={jcsaShieldLogo}
                  alt="نادي سباقات الخيل"
                  className="h-14 w-auto object-contain mx-auto"
                  style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.4))' }}
                  data-testid="img-jcsa-logo-mobile"
                />
              </div>

              <div className="relative h-[100px] mb-5 overflow-hidden">
                {HERO_SLIDES.map((slide, index) => (
                  <div
                    key={slide.id + '-caption'}
                    className="absolute inset-0 flex flex-col justify-center lg:items-start items-center"
                    style={{
                      opacity: activeSlide === index ? 1 : 0,
                      transform: activeSlide === index ? 'translateY(0)' : 'translateY(15px)',
                      transition: 'opacity 1s ease, transform 1s ease',
                      pointerEvents: activeSlide === index ? 'auto' : 'none',
                    }}
                  >
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className="w-8 h-[1px] bg-gradient-to-l from-gold/40 to-transparent" />
                      <span className="text-[10px] text-gold/35 font-medium tracking-[0.15em] uppercase">
                        {String(index + 1).padStart(2, '0')} / {String(HERO_SLIDES.length).padStart(2, '0')}
                      </span>
                    </div>
                    <h2 className="text-[22px] lg:text-[28px] font-bold text-white/85 mb-2 leading-snug">{slide.title}</h2>
                    <p className="text-[13px] text-white/50 leading-relaxed max-w-[360px]">{slide.subtitle}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-1.5 justify-center lg:justify-start mt-6">
                {HERO_SLIDES.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => goToSlide(index)}
                    className="relative h-[2px] rounded-full overflow-hidden transition-all duration-500 cursor-pointer"
                    style={{ width: activeSlide === index ? 28 : 10 }}
                    data-testid={`slide-indicator-${index}`}
                  >
                    <div className="absolute inset-0 bg-white/8 rounded-full" />
                    {activeSlide === index && (
                      <div
                        key={slideKey}
                        className="absolute inset-0 rounded-full"
                        style={{
                          background: 'hsl(var(--accent))',
                          opacity: 0.6,
                          animation: `slideProgress ${SLIDE_DURATION}ms linear forwards`,
                        }}
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className={`w-full max-w-[370px] flex-shrink-0 transition-all duration-1000 delay-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
              <div
                ref={cardRef}
                className={`relative bg-navy/70 backdrop-blur-2xl border border-white/[0.06] rounded-2xl p-7 ${loginSuccess ? 'login-success-exit' : ''}`}
                style={{ boxShadow: '0 25px 60px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03) inset' }}
                data-testid="card-login"
              >
                <div className="text-center mb-7">
                  <h2 className="text-lg font-bold text-white/85 mb-1">{t('تسجيل الدخول')}</h2>
                  <p className="text-[12px] text-white/45">{t('أدخل بيانات الاعتماد للوصول إلى النظام')}</p>
                </div>

                <FormProvider {...form}>
                  <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[11px] font-medium text-white/50 tracking-wide">{t('البريد الإلكتروني')}</FormLabel>
                          <div className="relative group">
                            <User className="absolute right-3 top-1/2 -translate-y-1/2 h-[14px] w-[14px] text-white/30 group-focus-within:text-gold/50 transition-colors duration-500" />
                            <FormControl>
                              <Input
                                {...field}
                                type="text"
                                placeholder="example@jcsa.sa"
                                className="pr-9 h-10 bg-white/[0.03] border-white/[0.06] text-white/90 placeholder:text-white/40 focus:border-gold/25 focus:bg-white/[0.05] rounded-lg transition-all duration-400 text-[13px]"
                                dir="ltr"
                                disabled={isSubmitting}
                                data-testid="input-username"
                                autoComplete="email"
                              />
                            </FormControl>
                          </div>
                          <FormMessage className="text-right text-red-400/70 text-[10px] mt-1" data-testid="error-username" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[11px] font-medium text-white/50 tracking-wide">{t('كلمة المرور')}</FormLabel>
                          <div className="relative group">
                            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-[14px] w-[14px] text-white/30 group-focus-within:text-gold/50 transition-colors duration-500" />
                            <FormControl>
                              <Input
                                {...field}
                                type={showPassword ? 'text' : 'password'}
                                placeholder="••••••••"
                                className="pr-9 pl-9 h-10 bg-white/[0.03] border-white/[0.06] text-white/90 placeholder:text-white/40 focus:border-gold/25 focus:bg-white/[0.05] rounded-lg transition-all duration-400 text-[13px]"
                                disabled={isSubmitting}
                                data-testid="input-password"
                                autoComplete="current-password"
                              />
                            </FormControl>
                            <button
                              type="button"
                              onClick={() => setShowPassword(prev => !prev)}
                              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors duration-300"
                              data-testid="button-toggle-password"
                              disabled={isSubmitting}
                            >
                              {showPassword ? <EyeOff className="h-[14px] w-[14px]" /> : <Eye className="h-[14px] w-[14px]" />}
                            </button>
                          </div>
                          <FormMessage className="text-right text-red-400/70 text-[10px] mt-1" data-testid="error-password" />
                        </FormItem>
                      )}
                    />

                    <div className="pt-2">
                      <Button
                        type="submit"
                        className="w-full h-10 hub-btn-gold font-bold text-[13px] rounded-lg transition-all duration-400"
                        style={{ boxShadow: '0 4px 20px -4px hsla(43,74%,49%,0.25)' }}
                        disabled={isSubmitting}
                        data-testid="button-login"
                      >
                        {isSubmitting ? (
                          <div className="flex items-center gap-2">
                            <div className="w-3.5 h-3.5 border-2 border-navy/20 border-t-hub-navy rounded-full animate-spin" />
                            <span>{t('جاري...')}</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5">
                            {t('تسجيل الدخول')}
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </Button>
                    </div>
                  </form>
                </FormProvider>

                <div className="mt-4 text-center">
                  <button
                    type="button"
                    className="text-[11px] text-white/35 hover:text-gold/60 transition-colors duration-300"
                    onClick={() => toast({ title: t('نسيت كلمة المرور؟'), description: t('تواصل مع مدير النظام لإعادة تعيين كلمة المرور الخاصة بك.') })}
                    data-testid="button-forgot-password"
                  >
                    {t('نسيت كلمة المرور؟')}
                  </button>
                </div>

                <div className="mt-4 pt-3 border-t border-white/[0.04] flex items-center justify-center gap-1.5 text-[10px] text-white/40">
                  <ShieldCheck className="w-3 h-3 text-emerald-500/50" />
                  <span>{t('اتصال مشفر وآمن')}</span>
                </div>
              </div>

              <div className="mt-4 text-center">
                <div className="flex items-center justify-center gap-3 text-[10px] text-white/8">
                  <button
                    type="button"
                    onClick={() => setShowPrivacyPolicy(true)}
                    className="hover:text-white/18 transition-colors duration-300 cursor-pointer"
                    data-testid="link-privacy-policy"
                  >
                    سياسة الخصوصية
                  </button>
                  <span>|</span>
                  <button
                    type="button"
                    onClick={() => setShowTerms(true)}
                    className="hover:text-white/18 transition-colors duration-300 cursor-pointer"
                    data-testid="link-terms"
                  >
                    شروط الاستخدام
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer className={`px-6 pb-4 text-center transition-all duration-1000 delay-700 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
          <p className="text-[9px] text-white/6 tracking-wide">
            © {new Date().getFullYear()} نادي سباقات الخيل - جميع الحقوق محفوظة
          </p>
        </footer>
      </div>

      <Dialog open={showPrivacyPolicy} onOpenChange={setShowPrivacyPolicy}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">سياسة الخصوصية</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm text-muted-foreground leading-relaxed mt-4">
            <p className="font-semibold text-foreground">نادي سباقات الخيل - سياسة الخصوصية وحماية البيانات</p>
            <p>يلتزم نادي سباقات الخيل بحماية خصوصية المستخدمين وبياناتهم الشخصية وفقاً لنظام حماية البيانات الشخصية (PDPL) والمعايير الوطنية لإدارة البيانات (NDMO).</p>
            <div className="space-y-2">
              <p className="font-medium text-foreground">1. جمع البيانات</p>
              <p>نقوم بجمع البيانات الضرورية لتقديم خدمات المنصة فقط، وتشمل: الاسم، البريد الإلكتروني، المسمى الوظيفي، والقسم.</p>
            </div>
            <div className="space-y-2">
              <p className="font-medium text-foreground">2. استخدام البيانات</p>
              <p>تُستخدم البيانات لأغراض تشغيل المنصة، إدارة الصلاحيات، تتبع سجل التدقيق، وتحسين الأداء.</p>
            </div>
            <div className="space-y-2">
              <p className="font-medium text-foreground">3. حماية البيانات</p>
              <p>نطبق إجراءات أمنية صارمة تشمل: التشفير أثناء النقل والتخزين، المصادقة متعددة العوامل، تسجيل النشاطات، والنسخ الاحتياطي المنتظم.</p>
            </div>
            <div className="space-y-2">
              <p className="font-medium text-foreground">4. حقوق صاحب البيانات</p>
              <p>يحق لك طلب الاطلاع على بياناتك، تصحيحها، أو حذفها من خلال تقديم طلب عبر قسم طلبات أصحاب البيانات (DSR).</p>
            </div>
            <div className="space-y-2">
              <p className="font-medium text-foreground">5. الاحتفاظ بالبيانات</p>
              <p>يتم الاحتفاظ بالبيانات طوال فترة العلاقة الوظيفية ولمدة عامين بعد انتهائها، وفقاً للمتطلبات التنظيمية.</p>
            </div>
            <p className="text-xs text-muted-foreground border-t pt-3">آخر تحديث: {new Date().toLocaleDateString('ar-SA')}</p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showTerms} onOpenChange={setShowTerms}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">شروط الاستخدام</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm text-muted-foreground leading-relaxed mt-4">
            <p className="font-semibold text-foreground">نادي سباقات الخيل - شروط استخدام منصة Control Hub</p>
            <div className="space-y-2">
              <p className="font-medium text-foreground">1. قبول الشروط</p>
              <p>باستخدامك لمنصة Control Hub، فإنك توافق على الالتزام بهذه الشروط والأحكام. هذه المنصة مخصصة للاستخدام الداخلي لموظفي نادي سباقات الخيل فقط.</p>
            </div>
            <div className="space-y-2">
              <p className="font-medium text-foreground">2. حسابات المستخدمين</p>
              <p>كل مستخدم مسؤول عن الحفاظ على سرية بيانات الدخول الخاصة به. يُمنع مشاركة كلمات المرور أو الوصول إلى حسابات الآخرين.</p>
            </div>
            <div className="space-y-2">
              <p className="font-medium text-foreground">3. الاستخدام المقبول</p>
              <p>يجب استخدام المنصة للأغراض المهنية فقط. يُحظر أي استخدام غير مصرح به أو محاولة الوصول لبيانات خارج نطاق الصلاحيات الممنوحة.</p>
            </div>
            <div className="space-y-2">
              <p className="font-medium text-foreground">4. السرية</p>
              <p>جميع البيانات والمعلومات المتاحة عبر المنصة سرية ولا يجوز مشاركتها خارج نطاق العمل المحدد.</p>
            </div>
            <div className="space-y-2">
              <p className="font-medium text-foreground">5. المسؤولية</p>
              <p>يتحمل المستخدم مسؤولية جميع الإجراءات التي يقوم بها عبر حسابه. يتم تسجيل جميع العمليات في سجل التدقيق.</p>
            </div>
            <p className="text-xs text-muted-foreground border-t pt-3">آخر تحديث: {new Date().toLocaleDateString('ar-SA')}</p>
          </div>
        </DialogContent>
      </Dialog>

      <style>{`
        @keyframes shakeError {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-5px); }
          30% { transform: translateX(4px); }
          45% { transform: translateX(-3px); }
          60% { transform: translateX(2px); }
          75% { transform: translateX(-1px); }
        }
        @keyframes slideProgress {
          from { width: 0%; }
          to { width: 100%; }
        }
        @keyframes gentlePulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 0.25; }
        }
        .login-success-exit {
          animation: exitUp 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        @keyframes exitUp {
          to { opacity: 0; transform: translateY(-15px) scale(0.99); }
        }
      `}</style>
    </div>
  );
}
