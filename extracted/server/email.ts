import nodemailer from 'nodemailer';
import { logger } from './security-middleware';
import { db } from './db';
import { emailQueue } from '@shared/schema';
import { eq, sql, and } from 'drizzle-orm';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.office365.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    ciphers: 'SSLv3',
    rejectUnauthorized: false,
  },
});

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  try {
    const fromName = process.env.SMTP_FROM_NAME || 'Control Hub - JCSA';
    const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
    
    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      html,
    });
    
    logger.info(`Email sent successfully to ${to}`);
    return true;
  } catch (error) {
    logger.error('Error sending email:', { error });
    await queueEmail(to, subject, html).catch(() => {});
    return false;
  }
}

async function queueEmail(to: string, subject: string, html: string) {
  try {
    await db.insert(emailQueue).values({
      toEmail: to,
      subject,
      htmlBody: html,
      status: 'pending',
      attempts: 1,
      nextRetryAt: new Date(Date.now() + 5 * 60 * 1000),
    });
    logger.info(`Email queued for retry: ${to}`);
  } catch (e: any) {
    logger.error('Failed to queue email:', { error: e?.message });
  }
}

export async function processEmailQueue() {
  try {
    const pending = await db.select().from(emailQueue)
      .where(and(
        eq(emailQueue.status, 'pending'),
        sql`${emailQueue.nextRetryAt} <= NOW()`,
        sql`${emailQueue.attempts} < ${emailQueue.maxAttempts}`
      ))
      .limit(10);

    for (const item of pending) {
      try {
        const fromName = process.env.SMTP_FROM_NAME || 'Control Hub - JCSA';
        const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
        await transporter.sendMail({
          from: `"${fromName}" <${fromEmail}>`,
          to: item.toEmail,
          subject: item.subject,
          html: item.htmlBody,
        });
        await db.update(emailQueue)
          .set({ status: 'sent', sentAt: new Date() })
          .where(eq(emailQueue.id, item.id));
        logger.info(`Queued email sent successfully to ${item.toEmail}`);
      } catch (e: any) {
        const newAttempts = (item.attempts || 0) + 1;
        const backoff = Math.min(newAttempts * 5, 60) * 60 * 1000;
        await db.update(emailQueue)
          .set({
            attempts: newAttempts,
            lastError: e?.message || 'Unknown error',
            status: newAttempts >= (item.maxAttempts || 3) ? 'failed' : 'pending',
            nextRetryAt: new Date(Date.now() + backoff),
          })
          .where(eq(emailQueue.id, item.id));
      }
    }
  } catch (e: any) {
    logger.error('Email queue processing error:', { error: e?.message });
  }
}

setInterval(processEmailQueue, 5 * 60 * 1000);

const APP_URL = process.env.APP_URL || 'https://controlhub.jcsa.sa';

export function generateActivationEmail(data: {
  recipientName: string;
  activationUrl: string;
}): string {
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { 
      margin: 0; 
      padding: 0; 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
      direction: rtl; 
      background: #f8f9fa; 
    }
    .container { 
      max-width: 600px; 
      margin: 30px auto; 
      background: #ffffff; 
      border-radius: 8px; 
      overflow: hidden; 
      box-shadow: 0 2px 10px rgba(0,0,0,0.08); 
    }
    .header { 
      background: linear-gradient(135deg, hsl(222,47%,11%) 0%, hsl(222,47%,15%) 100%); 
      padding: 35px 30px; 
      text-align: center; 
    }
    .header h1 { 
      color: hsl(43,74%,49%); 
      font-size: 22px; 
      margin: 0; 
      font-weight: 600;
    }
    .header p { 
      color: rgba(255,255,255,0.75); 
      margin-top: 8px; 
      font-size: 14px;
    }
    .content { 
      padding: 40px 35px; 
    }
    .greeting { 
      color: hsl(222,47%,11%); 
      font-size: 18px; 
      font-weight: 600; 
      margin-bottom: 20px; 
      text-align: right; 
    }
    .message { 
      color: hsl(222,47%,25%); 
      font-size: 15px; 
      line-height: 1.8; 
      text-align: right; 
      margin-bottom: 30px; 
    }
    .button-container { 
      text-align: center; 
      margin: 35px 0; 
    }
    .button { 
      display: inline-block; 
      background: linear-gradient(135deg, hsl(43,74%,49%) 0%, hsl(43,74%,42%) 100%); 
      color: hsl(222,47%,11%); 
      padding: 14px 45px; 
      text-decoration: none; 
      border-radius: 6px; 
      font-weight: 600; 
      font-size: 15px; 
    }
    .info-box { 
      background: hsl(43,74%,49%,0.08); 
      border-right: 3px solid hsl(43,74%,49%); 
      padding: 18px 20px; 
      margin: 25px 0; 
      border-radius: 6px; 
    }
    .info-text { 
      color: hsl(222,47%,25%); 
      font-size: 13px; 
      margin: 0; 
      line-height: 1.6;
    }
    .footer { 
      background: hsl(222,47%,11%,0.03); 
      padding: 25px 30px; 
      text-align: center; 
      border-top: 1px solid hsl(222,47%,11%,0.08); 
    }
    .footer-org { 
      color: hsl(222,47%,11%); 
      font-weight: 600; 
      font-size: 14px; 
      margin-bottom: 8px; 
    }
    .footer-text { 
      color: hsl(222,47%,45%); 
      font-size: 12px; 
      margin: 4px 0; 
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>نادي سباقات الخيل</h1>
      <p>Control Hub - JCSA</p>
    </div>
    <div class="content">
      <p class="greeting">السلام عليكم ورحمة الله وبركاته،</p>
      <p class="greeting">${data.recipientName} المحترم/ة،</p>
      <p class="message">
        يسرنا إعلامكم بأنه تم إنشاء حسابكم في نظام Control Hub الخاص بنادي سباقات الخيل.
        <br/><br/>
        للبدء في استخدام حسابكم، يرجى الضغط على الزر أدناه لتفعيل الحساب وإنشاء كلمة المرور الخاصة بكم.
      </p>
      
      <div class="button-container">
        <a href="${data.activationUrl}" class="button">تفعيل الحساب</a>
      </div>
      
      <div class="info-box">
        <p class="info-text">
          ملاحظة: هذا الرابط صالح لمدة 24 ساعة فقط. في حال انتهاء صلاحيته، يرجى التواصل مع مدير النظام لإعادة إرسال رابط التفعيل.
        </p>
      </div>
    </div>
    <div class="footer">
      <div class="footer-org">نادي سباقات الخيل</div>
      <p class="footer-text">مركز التحكم - Control Hub</p>
      <p class="footer-text">هذا بريد إلكتروني آلي، يرجى عدم الرد عليه</p>
      <p class="footer-text">© ${new Date().getFullYear()} جميع الحقوق محفوظة</p>
    </div>
  </div>
</body>
</html>
`;
}

export function generatePasswordResetEmail(data: {
  recipientName: string;
  resetUrl: string;
}): string {
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; background: #f8f9fa; }
    .container { max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, hsl(222,47%,11%) 0%, hsl(222,47%,15%) 100%); padding: 35px 30px; text-align: center; }
    .header h1 { color: hsl(43,74%,49%); font-size: 22px; margin: 0; font-weight: 600; }
    .header p { color: rgba(255,255,255,0.75); margin-top: 8px; font-size: 14px; }
    .content { padding: 40px 35px; }
    .greeting { color: hsl(222,47%,11%); font-size: 18px; font-weight: 600; margin-bottom: 20px; text-align: right; }
    .message { color: hsl(222,47%,25%); font-size: 15px; line-height: 1.8; text-align: right; margin-bottom: 30px; }
    .button-container { text-align: center; margin: 35px 0; }
    .button { display: inline-block; background: linear-gradient(135deg, hsl(43,74%,49%) 0%, hsl(43,74%,42%) 100%); color: hsl(222,47%,11%); padding: 14px 45px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; }
    .info-box { background: hsl(43,74%,49%,0.08); border-right: 3px solid hsl(43,74%,49%); padding: 18px 20px; margin: 25px 0; border-radius: 6px; }
    .info-text { color: hsl(222,47%,25%); font-size: 13px; margin: 0; line-height: 1.6; }
    .footer { background: hsl(222,47%,11%,0.03); padding: 25px 30px; text-align: center; border-top: 1px solid hsl(222,47%,11%,0.08); }
    .footer-org { color: hsl(222,47%,11%); font-weight: 600; font-size: 14px; margin-bottom: 8px; }
    .footer-text { color: hsl(222,47%,45%); font-size: 12px; margin: 4px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>نادي سباقات الخيل</h1>
      <p>Control Hub - JCSA</p>
    </div>
    <div class="content">
      <p class="greeting">السلام عليكم ورحمة الله وبركاته،</p>
      <p class="greeting">${data.recipientName} المحترم/ة،</p>
      <p class="message">
        نود إعلامكم بأننا استلمنا طلباً لإعادة تعيين كلمة المرور لحسابكم في نظام Control Hub.
        <br/><br/>
        للمتابعة، يرجى الضغط على الزر أدناه لإنشاء كلمة مرور جديدة.
      </p>
      
      <div class="button-container">
        <a href="${data.resetUrl}" class="button">إعادة تعيين كلمة المرور</a>
      </div>
      
      <div class="info-box">
        <p class="info-text">
          إذا لم تقوموا بطلب إعادة تعيين كلمة المرور، يرجى تجاهل هذا البريد. سيبقى حسابكم آمناً.
        </p>
      </div>
    </div>
    <div class="footer">
      <div class="footer-org">نادي سباقات الخيل</div>
      <p class="footer-text">مركز التحكم - Control Hub</p>
      <p class="footer-text">هذا بريد إلكتروني آلي، يرجى عدم الرد عليه</p>
      <p class="footer-text">© ${new Date().getFullYear()} جميع الحقوق محفوظة</p>
    </div>
  </div>
</body>
</html>
`;
}

const emailBaseStyles = `
  body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; background: #f8f9fa; }
  .container { max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.08); }
  .header { background: linear-gradient(135deg, hsl(222,47%,11%) 0%, hsl(222,47%,15%) 100%); padding: 35px 30px; text-align: center; }
  .header h1 { color: hsl(43,74%,49%); font-size: 22px; margin: 0; font-weight: 600; }
  .header p { color: rgba(255,255,255,0.75); margin-top: 8px; font-size: 14px; }
  .content { padding: 40px 35px; }
  .greeting { color: hsl(222,47%,11%); font-size: 18px; font-weight: 600; margin-bottom: 20px; text-align: right; }
  .message { color: hsl(222,47%,25%); font-size: 15px; line-height: 1.8; text-align: right; margin-bottom: 30px; }
  .button-container { text-align: center; margin: 35px 0; }
  .button { display: inline-block; background: linear-gradient(135deg, hsl(43,74%,49%) 0%, hsl(43,74%,42%) 100%); color: hsl(222,47%,11%); padding: 14px 45px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; }
  .info-box { background: hsl(43,74%,49%,0.08); border-right: 3px solid hsl(43,74%,49%); padding: 18px 20px; margin: 25px 0; border-radius: 6px; }
  .info-text { color: hsl(222,47%,25%); font-size: 13px; margin: 0; line-height: 1.6; }
  .detail-table { width: 100%; border-collapse: collapse; margin: 20px 0; direction: rtl; }
  .detail-table td { padding: 10px 12px; border-bottom: 1px solid #eee; font-size: 14px; text-align: right; }
  .detail-table .label { color: hsl(222,47%,45%); font-weight: 500; width: 120px; }
  .detail-table .value { color: hsl(222,47%,11%); font-weight: 600; }
  .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; }
  .badge-urgent { background: #ffe8cc; color: #c05c00; }
  .badge-critical { background: #fde8e8; color: #c53030; }
  .badge-high { background: #fef3cd; color: #856404; }
  .badge-medium { background: #d1ecf1; color: #0c5460; }
  .badge-low { background: #d4edda; color: #155724; }
  .badge-open { background: #cce5ff; color: #004085; }
  .badge-closed { background: #d4edda; color: #155724; }
  .footer { background: hsl(222,47%,11%,0.03); padding: 25px 30px; text-align: center; border-top: 1px solid hsl(222,47%,11%,0.08); }
  .footer-org { color: hsl(222,47%,11%); font-weight: 600; font-size: 14px; margin-bottom: 8px; }
  .footer-text { color: hsl(222,47%,45%); font-size: 12px; margin: 4px 0; }
  .alert-box { background: #fff3cd; border-right: 3px solid #ffc107; padding: 15px 20px; margin: 20px 0; border-radius: 6px; }
  .alert-urgent { background: #f8d7da; border-right-color: #dc3545; }
`;

const emailFooter = `
  <div class="footer">
    <div class="footer-org">نادي سباقات الخيل</div>
    <p class="footer-text">مركز التحكم - Control Hub</p>
    <p class="footer-text">هذا بريد إلكتروني آلي، يرجى عدم الرد عليه</p>
    <p class="footer-text">&copy; ${new Date().getFullYear()} جميع الحقوق محفوظة</p>
  </div>`;

function wrapEmail(content: string, subtitle?: string): string {
  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>${emailBaseStyles}</style></head><body><div class="container"><div class="header"><h1>نادي سباقات الخيل</h1><p>${subtitle || 'Control Hub - JCSA'}</p></div>${content}${emailFooter}</div></body></html>`;
}

const priorityLabels: Record<string, string> = { urgent: 'عاجل', critical: 'حرج', high: 'عالي', medium: 'متوسط', low: 'منخفض' };
const priorityBadge = (p: string) => `<span class="badge badge-${p}">${priorityLabels[p] || p}</span>`;

export function generateNotificationEmail(data: {
  recipientName: string;
  subject: string;
  message: string;
  actionUrl?: string;
  actionText?: string;
}): string {
  const actionButton = data.actionUrl && data.actionText ? `
    <div class="button-container"><a href="${data.actionUrl}" class="button">${data.actionText}</a></div>` : '';
  return wrapEmail(`
    <div class="content">
      <p class="greeting">السلام عليكم ورحمة الله وبركاته،</p>
      <p class="greeting">${data.recipientName} المحترم/ة،</p>
      <p class="message">${data.message}</p>
      ${actionButton}
    </div>`);
}

export function generateTicketNotificationEmail(data: {
  recipientName: string;
  ticketTitle: string;
  ticketId: number;
  priority: string;
  category: string;
  department: string;
  status: string;
  assignedTo?: string;
  actionUrl?: string;
  isNew?: boolean;
}): string {
  const statusLabel = data.isNew ? 'تذكرة جديدة' : 'تحديث تذكرة';
  return wrapEmail(`
    <div class="content">
      <p class="greeting">${data.recipientName} المحترم/ة،</p>
      <p class="message">${data.isNew ? 'تم إنشاء تذكرة دعم جديدة بالتفاصيل التالية:' : 'تم تحديث حالة التذكرة التالية:'}</p>
      <table class="detail-table">
        <tr><td class="label">رقم التذكرة</td><td class="value">#${data.ticketId}</td></tr>
        <tr><td class="label">العنوان</td><td class="value">${data.ticketTitle}</td></tr>
        <tr><td class="label">الأولوية</td><td class="value">${priorityBadge(data.priority)}</td></tr>
        <tr><td class="label">التصنيف</td><td class="value">${data.category}</td></tr>
        <tr><td class="label">القسم</td><td class="value">${data.department}</td></tr>
        <tr><td class="label">الحالة</td><td class="value">${data.status}</td></tr>
        ${data.assignedTo ? `<tr><td class="label">المسند إليه</td><td class="value">${data.assignedTo}</td></tr>` : ''}
      </table>
      ${data.actionUrl ? `<div class="button-container"><a href="${data.actionUrl}" class="button">عرض التذكرة</a></div>` : ''}
    </div>`, statusLabel);
}

export function generateReferralNotificationEmail(data: {
  recipientName: string;
  referralTitle: string;
  referralId: number;
  fromDepartment: string;
  toDepartment: string;
  priority: string;
  slaHours?: number;
  actionUrl?: string;
}): string {
  return wrapEmail(`
    <div class="content">
      <p class="greeting">${data.recipientName} المحترم/ة،</p>
      <p class="message">تم إنشاء إحالة جديدة تتطلب انتباهكم:</p>
      <table class="detail-table">
        <tr><td class="label">رقم الإحالة</td><td class="value">#${data.referralId}</td></tr>
        <tr><td class="label">الموضوع</td><td class="value">${data.referralTitle}</td></tr>
        <tr><td class="label">من قسم</td><td class="value">${data.fromDepartment}</td></tr>
        <tr><td class="label">إلى قسم</td><td class="value">${data.toDepartment}</td></tr>
        <tr><td class="label">الأولوية</td><td class="value">${priorityBadge(data.priority)}</td></tr>
        ${data.slaHours ? `<tr><td class="label">مهلة SLA</td><td class="value">${data.slaHours} ساعة</td></tr>` : ''}
      </table>
      ${data.slaHours && data.slaHours <= 4 ? '<div class="alert-box alert-urgent"><p class="info-text">تنبيه: هذه الإحالة ذات مهلة قصيرة وتتطلب استجابة عاجلة.</p></div>' : ''}
      ${data.actionUrl ? `<div class="button-container"><a href="${data.actionUrl}" class="button">عرض الإحالة</a></div>` : ''}
    </div>`, 'إحالة جديدة');
}

export function generateSLABreachEmail(data: {
  recipientName: string;
  entityType: string;
  entityTitle: string;
  entityId: number;
  slaTarget: string;
  elapsedTime: string;
  department: string;
  actionUrl?: string;
}): string {
  return wrapEmail(`
    <div class="content">
      <p class="greeting">${data.recipientName} المحترم/ة،</p>
      <div class="alert-box alert-urgent">
        <p class="info-text" style="font-weight:600; font-size:15px;">تنبيه: تجاوز مؤشر مستوى الخدمة (SLA)</p>
      </div>
      <table class="detail-table">
        <tr><td class="label">النوع</td><td class="value">${data.entityType}</td></tr>
        <tr><td class="label">العنوان</td><td class="value">${data.entityTitle}</td></tr>
        <tr><td class="label">الرقم</td><td class="value">#${data.entityId}</td></tr>
        <tr><td class="label">الهدف (SLA)</td><td class="value">${data.slaTarget}</td></tr>
        <tr><td class="label">الوقت المنقضي</td><td class="value">${data.elapsedTime}</td></tr>
        <tr><td class="label">القسم</td><td class="value">${data.department}</td></tr>
      </table>
      ${data.actionUrl ? `<div class="button-container"><a href="${data.actionUrl}" class="button">اتخاذ إجراء</a></div>` : ''}
    </div>`, 'تنبيه SLA');
}

export function generateDailySummaryEmail(data: {
  recipientName: string;
  date: string;
  stats: {
    openTickets: number;
    pendingTasks: number;
    pendingReferrals: number;
    slaBreaches: number;
    completedToday: number;
  };
  actionUrl?: string;
}): string {
  return wrapEmail(`
    <div class="content">
      <p class="greeting">${data.recipientName} المحترم/ة،</p>
      <p class="message">ملخص يومك - ${data.date}</p>
      <table class="detail-table">
        <tr><td class="label">تذاكر مفتوحة</td><td class="value">${data.stats.openTickets}</td></tr>
        <tr><td class="label">مهام معلقة</td><td class="value">${data.stats.pendingTasks}</td></tr>
        <tr><td class="label">إحالات بانتظار الرد</td><td class="value">${data.stats.pendingReferrals}</td></tr>
        <tr><td class="label">تجاوزات SLA</td><td class="value"><span class="${data.stats.slaBreaches > 0 ? 'badge badge-critical' : ''}">${data.stats.slaBreaches}</span></td></tr>
        <tr><td class="label">منجزات اليوم</td><td class="value" style="color:#155724">${data.stats.completedToday}</td></tr>
      </table>
      ${data.actionUrl ? `<div class="button-container"><a href="${data.actionUrl}" class="button">فتح لوحة التحكم</a></div>` : ''}
    </div>`, 'ملخص يومي');
}
