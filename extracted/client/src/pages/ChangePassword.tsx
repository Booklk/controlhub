import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Shield, Eye, EyeOff, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { DEFAULT_ROUTES } from "@shared/constants";

function PasswordRequirement({ met, label }: { met: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm" data-testid={`req-${label}`}>
      {met ? (
        <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
      ) : (
        <XCircle className="w-4 h-4 text-slate-500 flex-shrink-0" />
      )}
      <span className={met ? "text-green-400" : "text-slate-400"}>{label}</span>
    </div>
  );
}

export default function ChangePassword() {
  const { user, setUser } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const isMandatory = user?.mustChangePassword === true;

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const reqs = {
    length: newPassword.length >= 8,
    upper: /[A-Z]/.test(newPassword),
    lower: /[a-z]/.test(newPassword),
    number: /\d/.test(newPassword),
    special: /[^A-Za-z\d]/.test(newPassword),
  };
  const allMet = Object.values(reqs).every(Boolean);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  const mutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/auth/change-password", {
        currentPassword: isMandatory ? undefined : currentPassword,
        newPassword,
      });
    },
    onSuccess: () => {
      toast({ title: "تم تغيير كلمة المرور بنجاح", description: "يمكنك الآن استخدام كلمة المرور الجديدة" });
      if (user) setUser({ ...user, mustChangePassword: false });
      const portal = user?.portal || "admin";
      const portalHome: Record<string, string> = {
        admin: "/admin",
        it_director: "/it-director",
        infrastructure: "/department/infrastructure",
        cybersecurity: "/department/cybersecurity",
        digital_transformation: "/department/digital-transformation",
        support: "/department/support",
        dmo: "/dmo",
        committee: "/committee",
        employee: "/employee",
        steward: "/data-representative",
      };
      navigate(portalHome[portal] || "/");
    },
    onError: (err: any) => {
      const msg = err?.message || "حدث خطأ في تغيير كلمة المرور";
      toast({ title: "خطأ", description: msg, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!allMet) {
      toast({ title: "تنبيه", description: "كلمة المرور لا تستوفي المتطلبات", variant: "destructive" });
      return;
    }
    if (!passwordsMatch) {
      toast({ title: "تنبيه", description: "كلمتا المرور غير متطابقتين", variant: "destructive" });
      return;
    }
    if (!isMandatory && !currentPassword) {
      toast({ title: "تنبيه", description: "يرجى إدخال كلمة المرور الحالية", variant: "destructive" });
      return;
    }
    mutation.mutate();
  };

  return (
    <div className="min-h-screen bg-[#0a1628] flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">
        <div className="bg-[#0f1f3d] border border-[rgba(212,175,55,0.3)] rounded-2xl overflow-hidden shadow-2xl">
          <div className="bg-gradient-to-l from-[#0f1f3d] to-[#1a3a6b] p-6 border-b border-[rgba(212,175,55,0.2)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[rgba(212,175,55,0.15)] border border-[rgba(212,175,55,0.3)] flex items-center justify-center">
                <Shield className="w-5 h-5 text-[#d4af37]" />
              </div>
              <div>
                <h1 className="text-white font-bold text-lg">تغيير كلمة المرور</h1>
                <p className="text-slate-400 text-sm">
                  {isMandatory ? "مطلوب تغيير كلمة المرور قبل المتابعة" : "قم بتحديث كلمة المرور الخاصة بك"}
                </p>
              </div>
            </div>
            {isMandatory && (
              <div className="mt-4 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                <p className="text-amber-400 text-sm font-medium">
                  ⚠️ تم إنشاء حسابك مؤخراً. يجب تغيير كلمة المرور الأولى قبل الوصول للنظام.
                </p>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {!isMandatory && (
              <div>
                <Label htmlFor="currentPassword" className="text-slate-300 text-sm mb-1.5 block">
                  كلمة المرور الحالية
                </Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showCurrent ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="أدخل كلمة المرور الحالية"
                    className="bg-[#1a3a6b]/40 border-slate-600 text-white placeholder-slate-500 pl-10"
                    data-testid="input-current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    data-testid="toggle-current-password"
                  >
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="newPassword" className="text-slate-300 text-sm mb-1.5 block">
                كلمة المرور الجديدة
              </Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="أدخل كلمة المرور الجديدة"
                  className="bg-[#1a3a6b]/40 border-slate-600 text-white placeholder-slate-500 pl-10"
                  data-testid="input-new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  data-testid="toggle-new-password"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {newPassword.length > 0 && (
              <div className="bg-[#1a3a6b]/30 rounded-lg p-3 space-y-2 border border-slate-700">
                <p className="text-slate-400 text-xs font-medium mb-2">متطلبات كلمة المرور:</p>
                <PasswordRequirement met={reqs.length} label="8 أحرف على الأقل" />
                <PasswordRequirement met={reqs.upper} label="حرف كبير (A-Z)" />
                <PasswordRequirement met={reqs.lower} label="حرف صغير (a-z)" />
                <PasswordRequirement met={reqs.number} label="رقم (0-9)" />
                <PasswordRequirement met={reqs.special} label="رمز خاص (@#$!...)" />
              </div>
            )}

            <div>
              <Label htmlFor="confirmPassword" className="text-slate-300 text-sm mb-1.5 block">
                تأكيد كلمة المرور
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="أعد إدخال كلمة المرور الجديدة"
                  className={`bg-[#1a3a6b]/40 border-slate-600 text-white placeholder-slate-500 pl-10 ${
                    confirmPassword.length > 0 ? (passwordsMatch ? "border-green-500/50" : "border-red-500/50") : ""
                  }`}
                  data-testid="input-confirm-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  data-testid="toggle-confirm-password"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPassword.length > 0 && (
                <p className={`text-xs mt-1 ${passwordsMatch ? "text-green-400" : "text-red-400"}`}>
                  {passwordsMatch ? "✓ كلمتا المرور متطابقتان" : "✗ كلمتا المرور غير متطابقتين"}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-[#d4af37] hover:bg-[#b8963e] text-[#0a1628] font-bold py-3 rounded-lg mt-2"
              disabled={mutation.isPending || !allMet || !passwordsMatch}
              data-testid="button-submit-change-password"
            >
              {mutation.isPending ? "جاري التغيير..." : "تغيير كلمة المرور"}
            </Button>

            {!isMandatory && (
              <Button
                type="button"
                variant="ghost"
                className="w-full text-slate-400 hover:text-white"
                onClick={() => navigate(user?.portal ? (DEFAULT_ROUTES[user.portal] || '/') : '/')}
                data-testid="button-cancel"
              >
                إلغاء
              </Button>
            )}
          </form>
        </div>

        <p className="text-center text-slate-500 text-xs mt-4">
          Control Hub — JCSA © 2026
        </p>
      </div>
    </div>
  );
}
