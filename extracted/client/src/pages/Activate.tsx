import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Lock, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

const activationSchema = z.object({
  password: z.string()
    .min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل")
    .regex(/[A-Z]/, "يجب أن تحتوي على حرف كبير")
    .regex(/[a-z]/, "يجب أن تحتوي على حرف صغير")
    .regex(/[0-9]/, "يجب أن تحتوي على رقم")
    .regex(/[!@#$%^&*]/, "يجب أن تحتوي على رمز خاص (!@#$%^&*)"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "كلمات المرور غير متطابقة",
  path: ["confirmPassword"],
});

type ActivationForm = z.infer<typeof activationSchema>;

export default function Activate() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [activated, setActivated] = useState(false);

  const form = useForm<ActivationForm>({
    resolver: zodResolver(activationSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
    mode: "onChange",
  });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get("token");
    setToken(tokenParam);

    if (tokenParam) {
      (async () => {
        try {
          const res = await fetch(`/api/activate/verify?token=${tokenParam}`);
          const data = await res.json();
          if (data.valid) {
            setTokenValid(true);
            setUserName(data.userName || "");
          } else {
            setTokenValid(false);
          }
        } catch {
          setTokenValid(false);
        }
      })();
    }
  }, []);

  const activateMutation = useMutation({
    mutationFn: async (data: ActivationForm) => {
      const response = await apiRequest("POST", "/api/activate", {
        token,
        password: data.password,
      });
      return response.json();
    },
    onSuccess: () => {
      setActivated(true);
      toast({
        title: "تم تفعيل الحساب بنجاح",
        description: "يمكنك الآن تسجيل الدخول باستخدام بريدك الإلكتروني وكلمة المرور الجديدة",
      });
      setTimeout(() => setLocation("/login"), 3000);
    },
    onError: (error: Error) => {
      toast({
        title: "فشل تفعيل الحساب",
        description: error.message || "حدث خطأ أثناء تفعيل الحساب",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ActivationForm) => {
    activateMutation.mutate(data);
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-[hsl(222_47%_11%)] flex items-center justify-center p-4" dir="rtl">
        <Card className="w-full max-w-md bg-[hsl(222_47%_11%)/0.9] border-[hsl(43_74%_49%)/0.3] backdrop-blur-xl">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">رابط غير صالح</h2>
            <p className="text-white/70">لم يتم العثور على رمز التفعيل في الرابط</p>
            <Button
              onClick={() => setLocation("/login")}
              className="mt-6 btn-gold"
              data-testid="button-go-login"
            >
              العودة لتسجيل الدخول
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (tokenValid === null) {
    return (
      <div className="min-h-screen bg-[hsl(222_47%_11%)] flex items-center justify-center p-4" dir="rtl">
        <Card className="w-full max-w-md bg-[hsl(222_47%_11%)/0.9] border-[hsl(43_74%_49%)/0.3] backdrop-blur-xl">
          <CardContent className="pt-6 text-center">
            <Loader2 className="h-16 w-16 hub-stat-gold mx-auto mb-4 animate-spin" />
            <h2 className="text-xl font-bold text-white mb-2">جاري التحقق...</h2>
            <p className="text-white/70">يتم التحقق من صلاحية رابط التفعيل</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (tokenValid === false) {
    return (
      <div className="min-h-screen bg-[hsl(222_47%_11%)] flex items-center justify-center p-4" dir="rtl">
        <Card className="w-full max-w-md bg-[hsl(222_47%_11%)/0.9] border-[hsl(43_74%_49%)/0.3] backdrop-blur-xl">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">رابط منتهي الصلاحية</h2>
            <p className="text-white/70 mb-4">
              انتهت صلاحية رابط التفعيل أو أنه غير صالح.
              <br />
              يرجى التواصل مع مدير النظام لإعادة إرسال رابط التفعيل.
            </p>
            <Button
              onClick={() => setLocation("/login")}
              className="btn-gold"
              data-testid="button-go-login"
            >
              العودة لتسجيل الدخول
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (activated) {
    return (
      <div className="min-h-screen bg-[hsl(222_47%_11%)] flex items-center justify-center p-4" dir="rtl">
        <Card className="w-full max-w-md bg-[hsl(222_47%_11%)/0.9] border-[hsl(43_74%_49%)/0.3] backdrop-blur-xl">
          <CardContent className="pt-6 text-center">
            <div className="relative inline-block">
              <div className="absolute inset-0 bg-[hsl(43_74%_49%)] blur-xl opacity-50 animate-pulse" />
              <CheckCircle2 className="h-20 w-20 hub-stat-gold relative z-10" />
            </div>
            <h2 className="text-2xl font-bold text-white mt-6 mb-2">تم تفعيل حسابك بنجاح!</h2>
            <p className="text-white/70 mb-4">
              سيتم توجيهك لصفحة تسجيل الدخول خلال ثوانٍ...
            </p>
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 hub-stat-gold animate-spin" />
              <span className="text-white/50 text-sm">جاري التوجيه...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(222_47%_11%)] flex items-center justify-center p-4" dir="rtl">
      <Card className="w-full max-w-md bg-[hsl(222_47%_11%)/0.9] border-[hsl(43_74%_49%)/0.3] backdrop-blur-xl shadow-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 bg-gradient-to-br from-[hsl(43_74%_49%)] to-[hsl(43_74%_35%)] rounded-2xl flex items-center justify-center shadow-lg">
            <Lock className="h-10 w-10 text-muted-foreground" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-white">تفعيل الحساب</CardTitle>
            <CardDescription className="text-white/70 mt-2">
              مرحباً {userName}! قم بإنشاء كلمة مرور آمنة لحسابك
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white/90">كلمة المرور الجديدة</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          type={showPassword ? "text" : "password"}
                          placeholder="أدخل كلمة المرور"
                          className="bg-white/5 border-white/20 text-white placeholder:text-white/40 pl-10"
                          data-testid="input-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                          data-testid="button-toggle-password"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage className="text-red-400" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white/90">تأكيد كلمة المرور</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="أعد إدخال كلمة المرور"
                          className="bg-white/5 border-white/20 text-white placeholder:text-white/40 pl-10"
                          data-testid="input-confirm-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                          data-testid="button-toggle-confirm-password"
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage className="text-red-400" />
                  </FormItem>
                )}
              />

              <div className="bg-white/5 rounded-lg p-4 space-y-2">
                <p className="text-white/70 text-sm font-medium mb-3">متطلبات كلمة المرور:</p>
                <PasswordRequirement
                  met={form.watch("password")?.length >= 8}
                  text="8 أحرف على الأقل"
                />
                <PasswordRequirement
                  met={/[A-Z]/.test(form.watch("password") || "")}
                  text="حرف كبير واحد على الأقل"
                />
                <PasswordRequirement
                  met={/[a-z]/.test(form.watch("password") || "")}
                  text="حرف صغير واحد على الأقل"
                />
                <PasswordRequirement
                  met={/[0-9]/.test(form.watch("password") || "")}
                  text="رقم واحد على الأقل"
                />
                <PasswordRequirement
                  met={/[!@#$%^&*]/.test(form.watch("password") || "")}
                  text="رمز خاص (!@#$%^&*)"
                />
              </div>

              <Button
                type="submit"
                className="w-full btn-gold h-12 text-lg font-bold"
                disabled={activateMutation.isPending || !form.formState.isValid}
                data-testid="button-activate"
              >
                {activateMutation.isPending ? (
                  <>
                    <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                    جاري التفعيل...
                  </>
                ) : (
                  "تفعيل الحساب"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

function PasswordRequirement({ met, text }: { met: boolean; text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {met ? (
        <CheckCircle2 className="h-4 w-4 hub-stat-gold" />
      ) : (
        <div className="h-4 w-4 rounded-full border border-white/30" />
      )}
      <span className={met ? "hub-stat-gold" : "text-white/50"}>{text}</span>
    </div>
  );
}
