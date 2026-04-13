import * as XLSX from 'xlsx';

export interface FormFieldData {
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  dueDate: string;
  assignee: string;
  department: string;
  status: string;
  notes: string;
  confidence: number;
}

const PRIORITY_PATTERNS = {
  critical: ['عاجل', 'حرج', 'critical', 'urgent', 'emergency', 'طوارئ', 'فوري', 'خطير', 'عاجلة', 'حرجة'],
  high: ['مرتفع', 'عالي', 'high', 'important', 'مهم', 'عالية', 'مرتفعة', 'أولوية عليا'],
  medium: ['متوسط', 'medium', 'normal', 'عادي', 'متوسطة', 'عادية'],
  low: ['منخفض', 'low', 'minor', 'بسيط', 'منخفضة', 'ثانوي', 'غير عاجل']
};

const CATEGORY_PATTERNS = {
  infrastructure: ['بنية تحتية', 'infrastructure', 'server', 'سيرفر', 'شبكة', 'network', 'hardware', 'أجهزة'],
  cybersecurity: ['أمن', 'security', 'cyber', 'سايبر', 'حماية', 'اختراق', 'فيروس', 'virus', 'malware'],
  digital: ['رقمي', 'digital', 'تحول', 'transformation', 'أتمتة', 'automation', 'برمجة', 'software'],
  support: ['دعم', 'support', 'مساعدة', 'help', 'مشكلة', 'issue', 'طلب', 'request', 'صيانة'],
  data: ['بيانات', 'data', 'تقرير', 'report', 'تحليل', 'analysis', 'قاعدة بيانات', 'database']
};

const DEPARTMENT_PATTERNS = {
  it: ['تقنية المعلومات', 'IT', 'تقنية', 'معلومات', 'information technology'],
  hr: ['موارد بشرية', 'HR', 'human resources', 'توظيف', 'موظفين'],
  finance: ['مالية', 'finance', 'محاسبة', 'accounting', 'ميزانية', 'budget'],
  operations: ['عمليات', 'operations', 'تشغيل', 'إدارة'],
  legal: ['قانونية', 'legal', 'قانون', 'عقود', 'contracts']
};

const FIELD_SYNONYMS: Record<string, string[]> = {
  title: ['عنوان', 'العنوان', 'الموضوع', 'subject', 'title', 'name', 'الاسم', 'المهمة', 'task', 'التذكرة', 'ticket'],
  description: ['وصف', 'الوصف', 'التفاصيل', 'details', 'description', 'المحتوى', 'content', 'النص', 'text', 'body', 'المشكلة', 'problem'],
  priority: ['أولوية', 'الأولوية', 'priority', 'الأهمية', 'importance', 'urgency', 'العجلة'],
  category: ['فئة', 'الفئة', 'category', 'التصنيف', 'type', 'النوع', 'القسم'],
  dueDate: ['تاريخ', 'التاريخ', 'date', 'موعد', 'الموعد', 'deadline', 'due', 'استحقاق', 'due_date', 'تاريخ الاستحقاق'],
  assignee: ['المسؤول', 'مكلف', 'assignee', 'assigned', 'المنفذ', 'executor', 'المكلف', 'assigned_to', 'responsible'],
  department: ['القسم', 'الإدارة', 'department', 'dept', 'الادارة', 'section'],
  status: ['الحالة', 'حالة', 'status', 'state'],
  notes: ['ملاحظات', 'notes', 'comments', 'التعليقات', 'remarks', 'إضافات']
};

function detectPriority(text: string): { priority: FormFieldData['priority']; confidence: number } {
  const lowerText = text.toLowerCase();
  
  for (const [priority, patterns] of Object.entries(PRIORITY_PATTERNS)) {
    for (const pattern of patterns) {
      if (lowerText.includes(pattern.toLowerCase())) {
        return { priority: priority as FormFieldData['priority'], confidence: 0.9 };
      }
    }
  }
  
  return { priority: 'medium', confidence: 0.5 };
}

function detectCategory(text: string): { category: string; confidence: number } {
  const lowerText = text.toLowerCase();
  let maxScore = 0;
  let detectedCategory = '';
  
  for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    let score = 0;
    for (const pattern of patterns) {
      if (lowerText.includes(pattern.toLowerCase())) {
        score++;
      }
    }
    if (score > maxScore) {
      maxScore = score;
      detectedCategory = category;
    }
  }
  
  return { 
    category: detectedCategory || 'general', 
    confidence: maxScore > 0 ? Math.min(0.9, 0.5 + maxScore * 0.2) : 0.3 
  };
}

function detectDepartment(text: string): { department: string; confidence: number } {
  const lowerText = text.toLowerCase();
  
  for (const [dept, patterns] of Object.entries(DEPARTMENT_PATTERNS)) {
    for (const pattern of patterns) {
      if (lowerText.includes(pattern.toLowerCase())) {
        return { department: dept, confidence: 0.85 };
      }
    }
  }
  
  return { department: '', confidence: 0 };
}

function extractDate(text: string): string {
  const datePatterns = [
    /(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/,
    /(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/,
    /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2})/,
  ];
  
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return '';
}

function findFieldValue(headers: string[], row: any[], fieldName: string): string {
  const synonyms = FIELD_SYNONYMS[fieldName] || [fieldName];
  
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i].toLowerCase().trim();
    for (const synonym of synonyms) {
      if (header.includes(synonym.toLowerCase()) || synonym.toLowerCase().includes(header)) {
        const value = row[i];
        if (value !== undefined && value !== null && value !== '') {
          return String(value).trim();
        }
      }
    }
  }
  
  return '';
}

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;
  
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);
  let matches = 0;
  
  for (const w1 of words1) {
    for (const w2 of words2) {
      if (w1 === w2 || w1.includes(w2) || w2.includes(w1)) {
        matches++;
        break;
      }
    }
  }
  
  return matches / Math.max(words1.length, words2.length);
}

export type FormType = 'task' | 'ticket' | 'project';

const PROJECT_FIELD_SYNONYMS: Record<string, string> = {
  'title': 'nameAr',
  'name': 'nameAr',
  'اسم': 'nameAr',
  'الاسم': 'nameAr',
  'اسم المشروع': 'nameAr',
  'project_name': 'nameAr',
  'code': 'code',
  'رمز': 'code',
  'الرمز': 'code',
  'رمز المشروع': 'code',
  'project_code': 'code',
  'budget': 'budget',
  'ميزانية': 'budget',
  'الميزانية': 'budget',
  'start_date': 'startDate',
  'تاريخ البدء': 'startDate',
  'البداية': 'startDate',
  'end_date': 'endDate',
  'تاريخ الانتهاء': 'endDate',
  'النهاية': 'endDate',
};

export function parseExcelSmart(buffer: Buffer, formType: FormType = 'task'): FormFieldData[] {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const results: FormFieldData[] = [];
  
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { 
      header: 1,
      raw: false,
      dateNF: 'yyyy-mm-dd'
    }) as any[][];
    
    if (data.length < 2) continue;
    
    const headers = (data[0] || []).map(h => String(h || ''));
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i] || [];
      if (row.every(cell => !cell)) continue;
      
      const title = findFieldValue(headers, row, 'title');
      const description = findFieldValue(headers, row, 'description');
      const rawPriority = findFieldValue(headers, row, 'priority');
      const rawCategory = findFieldValue(headers, row, 'category');
      const rawDate = findFieldValue(headers, row, 'dueDate');
      const assignee = findFieldValue(headers, row, 'assignee');
      const rawDepartment = findFieldValue(headers, row, 'department');
      const status = findFieldValue(headers, row, 'status');
      const notes = findFieldValue(headers, row, 'notes');
      
      const fullText = row.join(' ');
      
      let priority: FormFieldData['priority'] = 'medium';
      let priorityConfidence = 0.5;
      
      if (rawPriority) {
        const detected = detectPriority(rawPriority);
        priority = detected.priority;
        priorityConfidence = detected.confidence;
      } else {
        const detected = detectPriority(fullText);
        priority = detected.priority;
        priorityConfidence = detected.confidence * 0.7;
      }
      
      let category = rawCategory;
      let categoryConfidence = rawCategory ? 0.9 : 0;
      
      if (!category) {
        const detected = detectCategory(fullText);
        category = detected.category;
        categoryConfidence = detected.confidence;
      }
      
      let department = rawDepartment;
      if (!department) {
        const detected = detectDepartment(fullText);
        department = detected.department;
      }
      
      let dueDate = rawDate;
      if (!dueDate) {
        dueDate = extractDate(fullText);
      }
      
      const confidence = (
        (title ? 0.3 : 0) +
        (description ? 0.2 : 0) +
        priorityConfidence * 0.2 +
        categoryConfidence * 0.15 +
        (dueDate ? 0.1 : 0) +
        (assignee ? 0.05 : 0)
      );
      
      if (title || description) {
        results.push({
          title: title || description.substring(0, 100),
          description,
          priority,
          category,
          dueDate,
          assignee,
          department,
          status: status || 'pending',
          notes,
          confidence: Math.round(confidence * 100) / 100
        });
      }
    }
  }
  
  return results;
}

export function parseEmailContent(content: string): FormFieldData {
  const rawLines = content.split('\n');
  
  let title = '';
  let fromEmail = '';
  let dueDate = '';
  let bodyStartIndex = -1;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();

    if (line === '' && bodyStartIndex === -1) {
      bodyStartIndex = i + 1;
      break;
    }

    if (line.match(/^subject:\s*/i)) {
      title = line.replace(/^subject:\s*/i, '').trim();
    } else if (line.match(/^(الموضوع|عنوان):\s*/i)) {
      title = line.replace(/^(الموضوع|عنوان):\s*/i, '').trim();
    } else if (line.match(/^from:\s*/i)) {
      fromEmail = line.replace(/^from:\s*/i, '').trim();
    } else if (line.match(/^(من|المرسل):\s*/i)) {
      fromEmail = line.replace(/^(من|المرسل):\s*/i, '').trim();
    } else if (line.match(/^date:\s*/i)) {
      dueDate = extractDate(line);
    } else if (line.match(/^(التاريخ):\s*/i)) {
      dueDate = extractDate(line);
    }
  }

  let description = '';
  if (bodyStartIndex > 0 && bodyStartIndex < rawLines.length) {
    description = rawLines.slice(bodyStartIndex).join('\n').trim();
  }
  
  if (!title) {
    const nonEmpty = rawLines.map(l => l.trim()).filter(l => l);
    title = nonEmpty.length > 0 ? nonEmpty[0].substring(0, 200) : '';
  }

  if (!description) {
    const nonEmpty = rawLines.map(l => l.trim()).filter(l => l);
    description = nonEmpty.slice(1).join('\n');
  }
  
  const fullText = content;
  const { priority } = detectPriority(fullText);
  const { category } = detectCategory(fullText);
  const { department } = detectDepartment(fullText);
  
  if (!dueDate) {
    dueDate = extractDate(fullText);
  }
  
  return {
    title,
    description,
    priority,
    category,
    dueDate,
    assignee: fromEmail,
    department,
    status: 'pending',
    notes: '',
    confidence: 0.75
  };
}

export function parseTextContent(content: string): FormFieldData {
  const lines = content.split('\n').map(l => l.trim()).filter(l => l);
  
  const title = lines[0]?.substring(0, 200) || '';
  const description = lines.slice(1).join('\n');
  
  const { priority } = detectPriority(content);
  const { category } = detectCategory(content);
  const { department } = detectDepartment(content);
  const dueDate = extractDate(content);
  
  return {
    title,
    description,
    priority,
    category,
    dueDate,
    assignee: '',
    department,
    status: 'pending',
    notes: '',
    confidence: 0.6
  };
}
