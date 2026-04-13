import { useAuth } from "@/lib/auth";
import { getPortalDefaultRoute } from "@shared/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileQuestion, ArrowRight, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const { isAuthenticated, user } = useAuth();
  const [, setLocation] = useLocation();

  const homeRoute = isAuthenticated && user?.portal
    ? getPortalDefaultRoute(user.portal)
    : '/login';

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-[hsl(222_47%_8%)] via-[hsl(222_47%_11%)] to-[hsl(222_40%_14%)] p-4" dir="rtl">
      <Card className="w-full max-w-md border-[hsl(43_74%_49%)]/20 bg-[hsl(222_47%_13%)]/95 backdrop-blur-xl" data-testid="card-not-found">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto p-4 rounded-full hub-icon-gold">
            <FileQuestion className="w-12 h-12 hub-stat-gold" />
          </div>
          <CardTitle className="text-xl font-bold text-white" data-testid="text-not-found-title">
            الصفحة غير موجودة
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <p className="text-white/60 leading-relaxed" data-testid="text-not-found-message">
            عذراً، الصفحة التي تبحث عنها غير موجودة أو تم نقلها.
            <br />
            <span className="text-sm">يمكنك العودة للصفحة الرئيسية والمتابعة من هناك.</span>
          </p>
          <div className="flex flex-col gap-3 items-center">
            <Button
              variant="gold"
              className="gap-2"
              onClick={() => setLocation(homeRoute)}
              data-testid="button-go-home"
            >
              <Home className="w-4 h-4" />
              {isAuthenticated ? 'العودة للوحة التحكم' : 'تسجيل الدخول'}
            </Button>
            <Button
              variant="ghost"
              className="text-white/50 hover:text-white gap-2"
              onClick={() => window.history.back()}
              data-testid="button-go-back"
            >
              <ArrowRight className="w-4 h-4" />
              العودة للصفحة السابقة
            </Button>
          </div>
          <p className="text-xs text-white/50">
            Control Hub - JCSA
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
