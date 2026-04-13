import { Router, Request, Response } from 'express';
import multer from 'multer';
import { parseExcelSmart, parseTextContent, parseEmailContent, FormFieldData, FormType } from '../services/smartFormParser';
import { AuthenticatedRequest } from '../middleware/permissions';
import { logger } from '../security-middleware';

const router = Router();

const requireAuth = (req: Request, res: Response, next: Function) => {
  if (!(req as AuthenticatedRequest).user) {
    return res.status(401).json({ error: 'غير مصرح - يرجى تسجيل الدخول' });
  }
  next();
};

const storage = multer.memoryStorage();

const ALLOWED_FILE_CONFIGS = [
  { ext: '.xlsx', mimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'] },
  { ext: '.xls', mimeTypes: ['application/vnd.ms-excel'] },
  { ext: '.csv', mimeTypes: ['text/csv', 'application/csv', 'text/plain'] },
  { ext: '.txt', mimeTypes: ['text/plain'] },
  { ext: '.eml', mimeTypes: ['message/rfc822', 'text/plain', 'application/octet-stream'] },
  { ext: '.msg', mimeTypes: ['application/vnd.ms-outlook', 'application/octet-stream'] },
];

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
    const config = ALLOWED_FILE_CONFIGS.find(c => c.ext === ext);
    
    if (config && config.mimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('نوع الملف غير مدعوم - يرجى رفع ملف Excel أو نصي أو بريد إلكتروني (.eml/.msg)'));
    }
  }
});

router.post('/parse-file', requireAuth, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'لم يتم رفع ملف' });
    }

    const formType: FormType = (req.body.formType as FormType) || 'task';
    const buffer = req.file.buffer;
    const fileName = req.file.originalname.toLowerCase();
    
    let result: FormFieldData;

    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
      const parsed = parseExcelSmart(buffer, formType);
      if (parsed.length > 0) {
        result = parsed[0];
      } else {
        return res.status(400).json({ error: 'لم يتم العثور على بيانات في الملف' });
      }
    } else if (fileName.endsWith('.eml') || fileName.endsWith('.msg')) {
      const content = buffer.toString('utf-8');
      result = parseEmailContent(content);
    } else if (fileName.endsWith('.txt')) {
      const content = buffer.toString('utf-8');
      result = parseTextContent(content);
    } else {
      return res.status(400).json({ error: 'نوع الملف غير مدعوم' });
    }

    const priorityMap: Record<string, string> = {
      urgent: 'عاجل',
      critical: 'حرج',
      high: 'عالي',
      medium: 'متوسط',
      low: 'منخفض'
    };

    const categoryMap: Record<string, string> = {
      infrastructure: 'البنية التحتية',
      cybersecurity: 'الأمن السيبراني',
      digital: 'التحول الرقمي',
      support: 'الدعم الفني',
      data: 'إدارة البيانات',
      general: 'عام'
    };

    res.json({
      title: result.title,
      description: result.description,
      priority: result.priority,
      priorityLabel: priorityMap[result.priority] || result.priority,
      category: result.category,
      categoryLabel: categoryMap[result.category] || result.category,
      dueDate: result.dueDate,
      assignee: result.assignee,
      department: result.department,
      status: result.status,
      notes: result.notes,
      confidence: result.confidence
    });

  } catch (error: any) {
    logger.error('Error parsing file:', { error });
    res.status(500).json({ error: 'خطأ في معالجة الملف' });
  }
});

router.post('/parse-text', requireAuth, async (req: Request, res: Response) => {
  try {
    const { content, formType } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'المحتوى مطلوب' });
    }

    const result = parseTextContent(content);

    res.json({
      title: result.title,
      description: result.description,
      priority: result.priority,
      category: result.category,
      dueDate: result.dueDate,
      confidence: result.confidence
    });

  } catch (error: any) {
    logger.error('Error parsing text:', { error });
    res.status(500).json({ error: 'خطأ في معالجة النص' });
  }
});

export default router;
