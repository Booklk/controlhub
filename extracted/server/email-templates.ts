/**
 * Email Templates - قوالب البريد الإلكتروني
 * نادي سباقات الخيل - Control Hub
 */

export interface EmailTemplateData {
  recipientName: string;
  recipientEmail: string;
  actionType: string;
  actionDetails: Record<string, string>;
  actionUrl?: string;
}

// Logo and App URLs - يمكن تغييرها من خلال متغيرات البيئة
const LOGO_URL = process.env.LOGO_URL || 'https://controlhub.jcsa.sa/logo.png';
const APP_URL = process.env.APP_URL || 'https://controlhub.jcsa.sa';

const baseStyles = `
  body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; background: #f8f9fa; }
  .container { max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.08); }
  .header { background: linear-gradient(135deg, hsl(222,47%,11%) 0%, hsl(222,47%,15%) 100%); padding: 35px 30px; text-align: center; }
  .header img { max-width: 120px; height: auto; margin-bottom: 15px; }
  .header-title { color: hsl(43,74%,49%); font-size: 22px; margin: 0; font-weight: 600; }
  .header-subtitle { color: rgba(255,255,255,0.75); margin-top: 8px; font-size: 14px; }
  .content { padding: 40px 35px; }
  .greeting { color: hsl(222,47%,11%); font-size: 16px; font-weight: 600; margin-bottom: 8px; text-align: right; }
  .title { color: hsl(222,47%,11%); font-size: 20px; font-weight: 700; margin-bottom: 20px; text-align: right; }
  .subtitle { color: hsl(222,47%,25%); font-size: 15px; margin-bottom: 25px; text-align: right; line-height: 1.7; }
  .details-box { background: hsl(222,47%,11%,0.03); border-right: 3px solid hsl(43,74%,49%); padding: 20px; margin: 25px 0; border-radius: 6px; }
  .detail-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid hsl(222,47%,11%,0.08); }
  .detail-row:last-child { border-bottom: none; }
  .detail-label { color: hsl(222,47%,35%); font-size: 14px; }
  .detail-value { color: hsl(222,47%,11%); font-size: 14px; font-weight: 600; }
  .button-container { text-align: center; margin: 30px 0; }
  .button { display: inline-block; background: linear-gradient(135deg, hsl(43,74%,49%) 0%, hsl(43,74%,42%) 100%); color: hsl(222,47%,11%); padding: 14px 40px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; }
  .footer { background: hsl(222,47%,11%,0.03); padding: 25px 30px; text-align: center; border-top: 1px solid hsl(222,47%,11%,0.08); }
  .footer-org { color: hsl(222,47%,11%); font-weight: 600; font-size: 14px; margin-bottom: 8px; }
  .footer-text { color: hsl(222,47%,45%); font-size: 12px; margin: 4px 0; }
  .badge { display: inline-block; padding: 5px 14px; border-radius: 4px; font-size: 13px; font-weight: 600; }
  .badge-gold { background: hsl(43,74%,49%,0.15); color: hsl(43,74%,35%); }
  .badge-navy { background: hsl(222,47%,11%); color: #ffffff; }
  .badge-success { background: hsl(142,70%,45%,0.15); color: hsl(142,70%,30%); }
  .badge-warning { background: hsl(38,92%,50%,0.15); color: hsl(38,92%,35%); }
  .badge-danger { background: hsl(0,72%,51%,0.15); color: hsl(0,72%,40%); }
`;

export function generateTaskAssignmentEmail(data: {
  recipientName: string;
  taskTitle: string;
  taskDescription: string;
  priority: string;
  dueDate: string;
  assignedBy: string;
  departmentName: string;
}): string {
  const priorityLabels: Record<string, string> = {
    low: 'منخفضة',
    medium: 'متوسطة',
    high: 'عالية',
    critical: 'حرجة',
  };

  const priorityBadgeClass: Record<string, string> = {
    low: 'badge-success',
    medium: 'badge-gold',
    high: 'badge-warning',
    critical: 'badge-danger',
  };

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${LOGO_URL}" alt="نادي سباقات الخيل" />
      <h1 class="header-title">نادي سباقات الخيل</h1>
      <p class="header-subtitle">Control Hub</p>
    </div>
    <div class="content">
      <p class="greeting">السلام عليكم ورحمة الله وبركاته،</p>
      <p class="greeting">${data.recipientName} المحترم/ة</p>
      <h1 class="title">تكليف مهمة جديدة</h1>
      <p class="subtitle">
        تم تكليفكم بمهمة جديدة من قبل ${data.assignedBy}. نأمل الاطلاع على التفاصيل أدناه.
      </p>
      
      <div class="details-box">
        <div class="detail-row">
          <span class="detail-label">عنوان المهمة</span>
          <span class="detail-value">${data.taskTitle}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">الوصف</span>
          <span class="detail-value">${data.taskDescription || 'لا يوجد وصف'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">الإدارة</span>
          <span class="detail-value">${data.departmentName}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">الأولوية</span>
          <span class="badge ${priorityBadgeClass[data.priority] || 'badge-gold'}">${priorityLabels[data.priority] || data.priority}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">تاريخ الاستحقاق</span>
          <span class="detail-value">${data.dueDate || 'غير محدد'}</span>
        </div>
      </div>
      
      <div class="button-container">
        <a href="${APP_URL}" class="button">عرض المهمة</a>
      </div>
    </div>
    <div class="footer">
      <div class="footer-org">نادي سباقات الخيل</div>
      <p class="footer-text">Control Hub - JCSA</p>
      <p class="footer-text">هذا بريد إلكتروني آلي، يرجى عدم الرد عليه</p>
      <p class="footer-text">© ${new Date().getFullYear()} جميع الحقوق محفوظة</p>
    </div>
  </div>
</body>
</html>
  `;
}

export function generateTicketCreatedEmail(data: {
  recipientName: string;
  ticketNumber: string;
  ticketTitle: string;
  priority: string;
  category: string;
  createdBy: string;
}): string {
  const priorityLabels: Record<string, string> = {
    low: 'منخفضة',
    medium: 'متوسطة',
    high: 'عالية',
    critical: 'حرجة',
  };

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${LOGO_URL}" alt="نادي سباقات الخيل" />
      <h1 class="header-title">نادي سباقات الخيل</h1>
      <p class="header-subtitle">Control Hub</p>
    </div>
    <div class="content">
      <p class="greeting">السلام عليكم ورحمة الله وبركاته،</p>
      <p class="greeting">${data.recipientName} المحترم/ة</p>
      <h1 class="title">تذكرة دعم فني جديدة</h1>
      <p class="subtitle">تم إنشاء تذكرة دعم فني جديدة. نأمل الاطلاع على التفاصيل أدناه.</p>
      
      <div class="details-box">
        <div class="detail-row">
          <span class="detail-label">رقم التذكرة</span>
          <span class="badge badge-navy">${data.ticketNumber}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">العنوان</span>
          <span class="detail-value">${data.ticketTitle}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">الفئة</span>
          <span class="detail-value">${data.category}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">الأولوية</span>
          <span class="badge badge-gold">${priorityLabels[data.priority] || data.priority}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">تم الإنشاء بواسطة</span>
          <span class="detail-value">${data.createdBy}</span>
        </div>
      </div>
      
      <div class="button-container">
        <a href="${APP_URL}" class="button">عرض التذكرة</a>
      </div>
    </div>
    <div class="footer">
      <div class="footer-org">نادي سباقات الخيل</div>
      <p class="footer-text">Control Hub - JCSA</p>
      <p class="footer-text">هذا بريد إلكتروني آلي، يرجى عدم الرد عليه</p>
      <p class="footer-text">© ${new Date().getFullYear()} جميع الحقوق محفوظة</p>
    </div>
  </div>
</body>
</html>
  `;
}

export function generateTicketStatusUpdateEmail(data: {
  recipientName: string;
  ticketNumber: string;
  ticketTitle: string;
  oldStatus: string;
  newStatus: string;
  updatedBy: string;
}): string {
  const statusLabels: Record<string, string> = {
    open: 'مفتوحة',
    in_progress: 'قيد المعالجة',
    resolved: 'تم الحل',
    closed: 'مغلقة',
  };

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${LOGO_URL}" alt="نادي سباقات الخيل" />
      <h1 class="header-title">نادي سباقات الخيل</h1>
      <p class="header-subtitle">Control Hub</p>
    </div>
    <div class="content">
      <p class="greeting">السلام عليكم ورحمة الله وبركاته،</p>
      <p class="greeting">${data.recipientName} المحترم/ة</p>
      <h1 class="title">تحديث حالة التذكرة</h1>
      <p class="subtitle">تم تحديث حالة التذكرة الخاصة بكم. نأمل الاطلاع على التفاصيل أدناه.</p>
      
      <div class="details-box">
        <div class="detail-row">
          <span class="detail-label">رقم التذكرة</span>
          <span class="badge badge-navy">${data.ticketNumber}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">العنوان</span>
          <span class="detail-value">${data.ticketTitle}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">الحالة السابقة</span>
          <span class="detail-value">${statusLabels[data.oldStatus] || data.oldStatus}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">الحالة الجديدة</span>
          <span class="badge badge-gold">${statusLabels[data.newStatus] || data.newStatus}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">تم التحديث بواسطة</span>
          <span class="detail-value">${data.updatedBy}</span>
        </div>
      </div>
      
      <div class="button-container">
        <a href="${APP_URL}" class="button">عرض التذكرة</a>
      </div>
    </div>
    <div class="footer">
      <div class="footer-org">نادي سباقات الخيل</div>
      <p class="footer-text">Control Hub - JCSA</p>
      <p class="footer-text">هذا بريد إلكتروني آلي، يرجى عدم الرد عليه</p>
      <p class="footer-text">© ${new Date().getFullYear()} جميع الحقوق محفوظة</p>
    </div>
  </div>
</body>
</html>
  `;
}

export function generateEscalationEmail(data: {
  recipientName: string;
  escalationType: string;
  reason: string;
  priority: string;
  escalatedBy: string;
  entityDetails: string;
}): string {
  const priorityLabels: Record<string, string> = {
    low: 'منخفضة',
    medium: 'متوسطة',
    high: 'عالية',
    critical: 'حرجة',
  };

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${LOGO_URL}" alt="نادي سباقات الخيل" />
      <h1 class="header-title">نادي سباقات الخيل</h1>
      <p class="header-subtitle">Control Hub</p>
    </div>
    <div class="content">
      <p class="greeting">السلام عليكم ورحمة الله وبركاته،</p>
      <p class="greeting">${data.recipientName} المحترم/ة</p>
      <h1 class="title">تنبيه تصعيد</h1>
      <p class="subtitle">تم تصعيد حالة تتطلب انتباهكم. نأمل الاطلاع على التفاصيل أدناه واتخاذ الإجراء المناسب.</p>
      
      <div class="details-box">
        <div class="detail-row">
          <span class="detail-label">نوع التصعيد</span>
          <span class="detail-value">${data.escalationType}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">السبب</span>
          <span class="detail-value">${data.reason}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">الأولوية</span>
          <span class="badge badge-danger">${priorityLabels[data.priority] || data.priority}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">تفاصيل إضافية</span>
          <span class="detail-value">${data.entityDetails}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">تم التصعيد بواسطة</span>
          <span class="detail-value">${data.escalatedBy}</span>
        </div>
      </div>
      
      <div class="button-container">
        <a href="${APP_URL}" class="button">عرض التصعيد</a>
      </div>
    </div>
    <div class="footer">
      <div class="footer-org">نادي سباقات الخيل</div>
      <p class="footer-text">Control Hub - JCSA</p>
      <p class="footer-text">هذا بريد إلكتروني آلي، يرجى عدم الرد عليه</p>
      <p class="footer-text">© ${new Date().getFullYear()} جميع الحقوق محفوظة</p>
    </div>
  </div>
</body>
</html>
  `;
}

export function generateWelcomeEmail(data: {
  recipientName: string;
  recipientEmail: string;
  temporaryPassword: string;
  portalName: string;
}): string {
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${LOGO_URL}" alt="نادي سباقات الخيل" />
      <h1 class="header-title">نادي سباقات الخيل</h1>
      <p class="header-subtitle">Control Hub</p>
    </div>
    <div class="content">
      <p class="greeting">السلام عليكم ورحمة الله وبركاته،</p>
      <p class="greeting">${data.recipientName} المحترم/ة</p>
      <h1 class="title">مرحباً بكم في Control Hub</h1>
      <p class="subtitle">تم إنشاء حسابكم بنجاح في نظام Control Hub. فيما يلي بيانات الدخول الخاصة بكم.</p>
      
      <div class="details-box">
        <div class="detail-row">
          <span class="detail-label">البريد الإلكتروني</span>
          <span class="detail-value">${data.recipientEmail}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">كلمة المرور المؤقتة</span>
          <span class="badge badge-navy">${data.temporaryPassword}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">البوابة</span>
          <span class="detail-value">${data.portalName}</span>
        </div>
      </div>
      
      <p style="color: hsl(222,47%,25%); font-size: 14px; text-align: center; margin: 25px 0; line-height: 1.6;">
        يرجى تغيير كلمة المرور فور تسجيل الدخول الأول للحفاظ على أمان حسابكم.
      </p>
      
      <div class="button-container">
        <a href="${APP_URL}/login" class="button">تسجيل الدخول</a>
      </div>
    </div>
    <div class="footer">
      <div class="footer-org">نادي سباقات الخيل</div>
      <p class="footer-text">Control Hub - JCSA</p>
      <p class="footer-text">هذا بريد إلكتروني آلي، يرجى عدم الرد عليه</p>
      <p class="footer-text">© ${new Date().getFullYear()} جميع الحقوق محفوظة</p>
    </div>
  </div>
</body>
</html>
  `;
}

export function generateProjectStatusEmail(data: {
  recipientName: string;
  projectCode: string;
  projectTitle: string;
  oldStatus: string;
  newStatus: string;
  progress: number;
  updatedBy: string;
}): string {
  const statusLabels: Record<string, string> = {
    planning: 'تخطيط',
    in_progress: 'قيد التنفيذ',
    on_hold: 'متوقف',
    completed: 'مكتمل',
    cancelled: 'ملغي',
  };

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${baseStyles}
    .progress-container { margin: 15px 0; }
    .progress-label { color: hsl(222,47%,35%); font-size: 14px; margin-bottom: 8px; }
    .progress-bar { background: hsl(222,47%,11%,0.1); border-radius: 8px; height: 12px; overflow: hidden; }
    .progress-fill { background: linear-gradient(90deg, hsl(43,74%,49%) 0%, hsl(43,74%,55%) 100%); height: 100%; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${LOGO_URL}" alt="نادي سباقات الخيل" />
      <h1 class="header-title">نادي سباقات الخيل</h1>
      <p class="header-subtitle">Control Hub</p>
    </div>
    <div class="content">
      <p class="greeting">السلام عليكم ورحمة الله وبركاته،</p>
      <p class="greeting">${data.recipientName} المحترم/ة</p>
      <h1 class="title">تحديث حالة المشروع</h1>
      <p class="subtitle">تم تحديث حالة المشروع. نأمل الاطلاع على التفاصيل أدناه.</p>
      
      <div class="details-box">
        <div class="detail-row">
          <span class="detail-label">كود المشروع</span>
          <span class="badge badge-navy">${data.projectCode}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">اسم المشروع</span>
          <span class="detail-value">${data.projectTitle}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">الحالة السابقة</span>
          <span class="detail-value">${statusLabels[data.oldStatus] || data.oldStatus}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">الحالة الجديدة</span>
          <span class="badge badge-gold">${statusLabels[data.newStatus] || data.newStatus}</span>
        </div>
        <div class="progress-container">
          <div class="progress-label">نسبة الإنجاز: ${data.progress}%</div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${data.progress}%"></div>
          </div>
        </div>
        <div class="detail-row">
          <span class="detail-label">تم التحديث بواسطة</span>
          <span class="detail-value">${data.updatedBy}</span>
        </div>
      </div>
      
      <div class="button-container">
        <a href="${APP_URL}" class="button">عرض المشروع</a>
      </div>
    </div>
    <div class="footer">
      <div class="footer-org">نادي سباقات الخيل</div>
      <p class="footer-text">Control Hub - JCSA</p>
      <p class="footer-text">هذا بريد إلكتروني آلي، يرجى عدم الرد عليه</p>
      <p class="footer-text">© ${new Date().getFullYear()} جميع الحقوق محفوظة</p>
    </div>
  </div>
</body>
</html>
  `;
}

export function generateMeetingInvitationEmail(data: {
  recipientName: string;
  meetingTitle: string;
  meetingDate: string;
  meetingTime: string;
  location: string;
  organizer: string;
  agenda?: string;
}): string {
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${LOGO_URL}" alt="نادي سباقات الخيل" />
      <h1 class="header-title">نادي سباقات الخيل</h1>
      <p class="header-subtitle">Control Hub</p>
    </div>
    <div class="content">
      <p class="greeting">السلام عليكم ورحمة الله وبركاته،</p>
      <p class="greeting">${data.recipientName} المحترم/ة</p>
      <h1 class="title">دعوة لحضور اجتماع</h1>
      <p class="subtitle">تمت دعوتكم لحضور اجتماع. نأمل التكرم بالاطلاع على التفاصيل أدناه.</p>
      
      <div class="details-box">
        <div class="detail-row">
          <span class="detail-label">عنوان الاجتماع</span>
          <span class="detail-value">${data.meetingTitle}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">التاريخ</span>
          <span class="detail-value">${data.meetingDate}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">الوقت</span>
          <span class="detail-value">${data.meetingTime}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">المكان</span>
          <span class="detail-value">${data.location}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">المنظم</span>
          <span class="detail-value">${data.organizer}</span>
        </div>
        ${data.agenda ? `
        <div class="detail-row">
          <span class="detail-label">جدول الأعمال</span>
          <span class="detail-value">${data.agenda}</span>
        </div>
        ` : ''}
      </div>
      
      <div class="button-container">
        <a href="${APP_URL}" class="button">عرض الاجتماع</a>
      </div>
    </div>
    <div class="footer">
      <div class="footer-org">نادي سباقات الخيل</div>
      <p class="footer-text">Control Hub - JCSA</p>
      <p class="footer-text">هذا بريد إلكتروني آلي، يرجى عدم الرد عليه</p>
      <p class="footer-text">© ${new Date().getFullYear()} جميع الحقوق محفوظة</p>
    </div>
  </div>
</body>
</html>
  `;
}

export function generateDecisionNotificationEmail(data: {
  recipientName: string;
  decisionNumber: string;
  decisionTitle: string;
  decisionDate: string;
  status: string;
  issuedBy: string;
}): string {
  const statusLabels: Record<string, string> = {
    draft: 'مسودة',
    pending: 'قيد المراجعة',
    approved: 'معتمد',
    rejected: 'مرفوض',
  };

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${LOGO_URL}" alt="نادي سباقات الخيل" />
      <h1 class="header-title">نادي سباقات الخيل</h1>
      <p class="header-subtitle">Control Hub</p>
    </div>
    <div class="content">
      <p class="greeting">السلام عليكم ورحمة الله وبركاته،</p>
      <p class="greeting">${data.recipientName} المحترم/ة</p>
      <h1 class="title">إشعار قرار</h1>
      <p class="subtitle">تم إصدار قرار جديد. نأمل الاطلاع على التفاصيل أدناه.</p>
      
      <div class="details-box">
        <div class="detail-row">
          <span class="detail-label">رقم القرار</span>
          <span class="badge badge-navy">${data.decisionNumber}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">عنوان القرار</span>
          <span class="detail-value">${data.decisionTitle}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">تاريخ القرار</span>
          <span class="detail-value">${data.decisionDate}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">الحالة</span>
          <span class="badge badge-gold">${statusLabels[data.status] || data.status}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">صادر من</span>
          <span class="detail-value">${data.issuedBy}</span>
        </div>
      </div>
      
      <div class="button-container">
        <a href="${APP_URL}" class="button">عرض القرار</a>
      </div>
    </div>
    <div class="footer">
      <div class="footer-org">نادي سباقات الخيل</div>
      <p class="footer-text">Control Hub - JCSA</p>
      <p class="footer-text">هذا بريد إلكتروني آلي، يرجى عدم الرد عليه</p>
      <p class="footer-text">© ${new Date().getFullYear()} جميع الحقوق محفوظة</p>
    </div>
  </div>
</body>
</html>
  `;
}
