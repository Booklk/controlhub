import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileArchive, Server, CheckCircle, Shield, Database, Globe, Layout, Loader2 } from "lucide-react";

export default function DownloadPage() {
  const [downloading, setDownloading] = useState(false);
  const [fileInfo, setFileInfo] = useState<{ exists: boolean; sizeFormatted: string } | null>(null);

  useEffect(() => {
    fetch('/api/download/control-hub/info')
      .then(r => r.json())
      .then(data => setFileInfo(data))
      .catch(() => setFileInfo({ exists: false, sizeFormatted: '0 MB' }));
  }, []);

  const handleDownload = () => {
    setDownloading(true);
    window.location.href = '/api/download/control-hub';
    setTimeout(() => setDownloading(false), 5000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy/90 via-hub-navy to-navy/90 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-xl space-y-6">
        <div className="text-center space-y-3">
          <div className="mx-auto w-20 h-20 hub-icon-gold rounded-2xl flex items-center justify-center border border-gold/30">
            <FileArchive className="w-10 h-10 hub-stat-gold" />
          </div>
          <h1 className="text-3xl font-bold text-white">Control Hub <span className="hub-stat-gold">2026</span></h1>
          <p className="text-slate-400 text-lg">منصة الحوكمة والامتثال - نادي سباقات الخيل</p>
        </div>

        <Card className="hub-card border-white/10 text-white backdrop-blur">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg hub-stat-gold" data-testid="text-package-title">محتويات الحزمة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-3 text-slate-300">
                <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="text-sm">الكود المصدري + المكتبات (node_modules)</span>
              </div>
              <div className="flex items-center gap-3 text-slate-300">
                <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="text-sm">Docker + Nginx + PM2 جاهز للإنتاج</span>
              </div>
              <div className="flex items-center gap-3 text-slate-300">
                <Layout className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="text-sm">63 صفحة - 72 مكون</span>
              </div>
              <div className="flex items-center gap-3 text-slate-300">
                <Globe className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="text-sm">8 بوابات متكاملة</span>
              </div>
              <div className="flex items-center gap-3 text-slate-300">
                <Database className="w-4 h-4 text-purple-400 shrink-0" />
                <span className="text-sm">75 جدول قاعدة بيانات</span>
              </div>
              <div className="flex items-center gap-3 text-slate-300">
                <Shield className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-sm">حماية CSRF + JWT + RBAC</span>
              </div>
              <div className="flex items-center gap-3 text-slate-300">
                <Server className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="text-sm">نسخة إنتاجية مبنية</span>
              </div>
              <div className="flex items-center gap-3 text-slate-300">
                <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="text-sm">جاهز للتشغيل مباشرة</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hub-card border-white/10 text-white backdrop-blur">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">حجم الملف</span>
              <span className="text-white font-semibold" data-testid="text-file-size">{fileInfo?.sizeFormatted || '...'}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">الصيغة</span>
              <span className="text-white font-semibold">TAR.GZ</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">الإصدار</span>
              <span className="hub-stat-gold font-semibold">2026</span>
            </div>

            <Button
              onClick={handleDownload}
              disabled={downloading || !fileInfo?.exists}
              className="w-full hub-btn-gold font-bold py-6 text-lg"
              data-testid="button-download"
            >
              {downloading ? (
                <>
                  <Loader2 className="w-5 h-5 ml-2 animate-spin" />
                  جاري التحميل...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5 ml-2" />
                  تحميل الآن
                </>
              )}
            </Button>

            {fileInfo && !fileInfo.exists && (
              <p className="text-center text-red-400 text-sm">الملف غير متوفر حالياً</p>
            )}
          </CardContent>
        </Card>

        <Card className="hub-card border-white/10 text-white backdrop-blur">
          <CardContent className="pt-6">
            <p className="font-semibold hub-stat-gold mb-3 text-sm">للتشغيل على خادمك:</p>
            <code className="block bg-navy/90 p-4 rounded-lg text-xs text-emerald-400 font-mono leading-relaxed" dir="ltr">
              tar xzf ControlHub-2026.tar.gz<br/>
              cd ControlHub-2026<br/>
              cp .env.example .env<br/>
              # عدّل DATABASE_URL و SESSION_SECRET<br/>
              npm run db:push<br/>
              npm start<br/>
              <br/>
              # أو عبر Docker<br/>
              docker-compose up -d
            </code>
          </CardContent>
        </Card>

        <p className="text-center text-slate-500 text-xs">
          Control Hub 2026 &copy; JCSA - نادي سباقات الخيل
        </p>
      </div>
    </div>
  );
}
