import * as XLSX from 'xlsx';
import { parse } from 'csv-parse/sync';
import crypto from 'crypto';
import { db } from '../db';
import { users, itTickets, itProjects, tasks, dataAssets } from '@shared/schema';
import { eq } from 'drizzle-orm';

export interface ImportResult {
  success: boolean;
  imported: number;
  errors: { row: number; field: string; message: string; code: string }[];
  skipped: number;
  details: { id: number; name: string }[];
}

export interface ImportMapping {
  sourceColumn: string;
  targetField: string;
  transform?: (value: any) => any;
}

export type ImportType = 'users' | 'tickets' | 'projects' | 'tasks' | 'assets' | 'departments';

export async function parseExcelFile(buffer: Buffer): Promise<any[]> {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(worksheet);
}

export async function parseCsvFile(buffer: Buffer): Promise<any[]> {
  const content = buffer.toString('utf-8');
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
}

export async function importUsers(data: any[]): Promise<ImportResult> {
  const result: ImportResult = { success: true, imported: 0, errors: [], skipped: 0, details: [] };
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 2; // Excel rows start at 1, header is row 1
    
    try {
      const email = row.email || row.البريد_الإلكتروني || row.Email;
      const name = row.name || row.الاسم || row.Name;
      const role = row.role || row.الدور || 'dmo_staff';
      const portal = row.portal || row.البوابة || 'dmo';
      
      if (!email) {
        result.errors.push({ row: rowNum, field: 'email', message: 'البريد الإلكتروني مطلوب', code: 'REQUIRED_FIELD' });
        result.skipped++;
        continue;
      }
      
      if (!name) {
        result.errors.push({ row: rowNum, field: 'name', message: 'الاسم مطلوب', code: 'REQUIRED_FIELD' });
        result.skipped++;
        continue;
      }
      
      if (!email.endsWith('@jcsa.sa')) {
        result.errors.push({ row: rowNum, field: 'email', message: 'البريد يجب أن ينتهي بـ @jcsa.sa', code: 'INVALID_DOMAIN' });
        result.skipped++;
        continue;
      }
      
      // Check for existing user
      const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existing.length > 0) {
        result.errors.push({ row: rowNum, field: 'email', message: 'المستخدم موجود مسبقاً', code: 'DUPLICATE' });
        result.skipped++;
        continue;
      }
      
      // Generate unique activation token for user to set their own password
      const activationToken = crypto.randomBytes(32).toString('hex');
      const activationTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      
      const [newUser] = await db.insert(users).values({
        email,
        name,
        nameEn: row.name_en || row.الاسم_الإنجليزي || null,
        role,
        portal,
        passwordHash: null, // No password - user must activate via token
        activationToken,
        activationTokenExpiry,
        jobTitle: row.job_title || row.المسمى_الوظيفي || null,
        phone: row.phone || row.الهاتف || null,
        isActive: true,
        isActivated: false,
      }).returning({ id: users.id, name: users.name });
      
      result.imported++;
      result.details.push({ id: newUser.id, name: newUser.name });
    } catch (error: any) {
      result.errors.push({ row: rowNum, field: 'general', message: error.message, code: 'DB_ERROR' });
    }
  }
  
  result.success = result.errors.length === 0;
  return result;
}

export async function importTickets(data: any[], requesterId: number): Promise<ImportResult> {
  const result: ImportResult = { success: true, imported: 0, errors: [], skipped: 0, details: [] };
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 2;
    
    try {
      const title = row.title || row.العنوان || row.Title;
      const description = row.description || row.الوصف || row.Description || '';
      
      if (!title) {
        result.errors.push({ row: rowNum, field: 'title', message: 'عنوان التذكرة مطلوب', code: 'REQUIRED_FIELD' });
        result.skipped++;
        continue;
      }
      
      const ticketNumber = `TKT-${Date.now().toString(36).toUpperCase()}`;
      
      const [newTicket] = await db.insert(itTickets).values({
        ticketNumber,
        title,
        description,
        category: row.category || row.التصنيف || 'general',
        priority: row.priority || row.الأولوية || 'medium',
        status: 'open',
        departmentId: row.department_id || 1,
        requesterId,
      }).returning({ id: itTickets.id, title: itTickets.title });
      
      result.imported++;
      result.details.push({ id: newTicket.id, name: newTicket.title });
    } catch (error: any) {
      result.errors.push({ row: rowNum, field: 'general', message: error.message, code: 'DB_ERROR' });
    }
  }
  
  result.success = result.errors.length === 0;
  return result;
}

export async function importProjects(data: any[], createdById: number): Promise<ImportResult> {
  const result: ImportResult = { success: true, imported: 0, errors: [], skipped: 0, details: [] };
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 2;
    
    try {
      const nameAr = row.name_ar || row.الاسم || row.Name;
      const nameEn = row.name_en || row.الاسم_الإنجليزي || '';
      
      if (!nameAr) {
        result.errors.push({ row: rowNum, field: 'name_ar', message: 'اسم المشروع مطلوب', code: 'REQUIRED_FIELD' });
        result.skipped++;
        continue;
      }
      
      const code = `PRJ-${Date.now().toString(36).toUpperCase()}`;
      
      const [newProject] = await db.insert(itProjects).values({
        nameAr,
        nameEn,
        code,
        description: row.description || row.الوصف || '',
        status: row.status || 'planning',
        priority: row.priority || row.الأولوية || 'medium',
        itDepartmentId: row.it_department_id || 1,
        budget: row.budget || row.الميزانية ? String(row.budget || row.الميزانية) : null,
        progress: row.progress || 0,
        startDate: row.start_date ? new Date(row.start_date) : new Date(),
        endDate: row.end_date ? new Date(row.end_date) : null,
        managerId: createdById,
      }).returning({ id: itProjects.id, nameAr: itProjects.nameAr });
      
      result.imported++;
      result.details.push({ id: newProject.id, name: newProject.nameAr });
    } catch (error: any) {
      result.errors.push({ row: rowNum, field: 'general', message: error.message, code: 'DB_ERROR' });
    }
  }
  
  result.success = result.errors.length === 0;
  return result;
}

export async function importTasks(data: any[], assignedById: number): Promise<ImportResult> {
  const result: ImportResult = { success: true, imported: 0, errors: [], skipped: 0, details: [] };
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 2;
    
    try {
      const title = row.title || row.العنوان || row.Title;
      
      if (!title) {
        result.errors.push({ row: rowNum, field: 'title', message: 'عنوان المهمة مطلوب', code: 'REQUIRED_FIELD' });
        result.skipped++;
        continue;
      }
      
      const [newTask] = await db.insert(tasks).values({
        title,
        description: row.description || row.الوصف || '',
        priority: row.priority || row.الأولوية || 'medium',
        status: row.status || 'pending',
        projectId: row.project_id || null,
        dueDate: row.due_date ? new Date(row.due_date) : null,
        estimatedHours: row.estimated_hours ? parseInt(row.estimated_hours) : null,
        assignedBy: assignedById,
      }).returning({ id: tasks.id, title: tasks.title });
      
      result.imported++;
      result.details.push({ id: newTask.id, name: newTask.title });
    } catch (error: any) {
      result.errors.push({ row: rowNum, field: 'general', message: error.message, code: 'DB_ERROR' });
    }
  }
  
  result.success = result.errors.length === 0;
  return result;
}

export async function importAssets(data: any[]): Promise<ImportResult> {
  const result: ImportResult = { success: true, imported: 0, errors: [], skipped: 0, details: [] };
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 2;
    
    try {
      const name = row.name || row.الاسم || row.Name;
      
      if (!name) {
        result.errors.push({ row: rowNum, field: 'name', message: 'اسم الأصل مطلوب', code: 'REQUIRED_FIELD' });
        result.skipped++;
        continue;
      }
      
      const [newAsset] = await db.insert(dataAssets).values({
        name,
        nameEn: row.name_en || row.الاسم_الإنجليزي || null,
        description: row.description || row.الوصف || '',
        dataType: row.data_type || row.النوع || 'structured',
        classification: row.classification || row.التصنيف || 'internal',
        owner: row.owner || row.المالك || null,
        departmentId: row.department_id || 1,
        status: 'active',
      }).returning({ id: dataAssets.id, name: dataAssets.name });
      
      result.imported++;
      result.details.push({ id: newAsset.id, name: newAsset.name });
    } catch (error: any) {
      result.errors.push({ row: rowNum, field: 'general', message: error.message, code: 'DB_ERROR' });
    }
  }
  
  result.success = result.errors.length === 0;
  return result;
}

export async function processImport(
  buffer: Buffer,
  fileType: 'xlsx' | 'csv',
  importType: ImportType,
  userId?: number
): Promise<ImportResult> {
  let data: any[];
  
  if (fileType === 'xlsx') {
    data = await parseExcelFile(buffer);
  } else {
    data = await parseCsvFile(buffer);
  }
  
  if (data.length === 0) {
    return { success: false, imported: 0, errors: [{ row: 0, field: 'file', message: 'الملف فارغ', code: 'EMPTY_FILE' }], skipped: 0, details: [] };
  }
  
  const defaultUserId = userId || 1;
  
  switch (importType) {
    case 'users':
      return importUsers(data);
    case 'tickets':
      return importTickets(data, defaultUserId);
    case 'projects':
      return importProjects(data, defaultUserId);
    case 'tasks':
      return importTasks(data, defaultUserId);
    case 'assets':
      return importAssets(data);
    default:
      return { success: false, imported: 0, errors: [{ row: 0, field: 'type', message: 'نوع الاستيراد غير معروف', code: 'INVALID_TYPE' }], skipped: 0, details: [] };
  }
}

export function getImportTemplate(importType: ImportType): any[] {
  const templates: Record<ImportType, any[]> = {
    users: [
      { email: 'user@jcsa.sa', name: 'اسم المستخدم', name_en: 'User Name', role: 'dmo_staff', portal: 'dmo', job_title: 'المسمى الوظيفي', phone: '0500000000' }
    ],
    tickets: [
      { title: 'عنوان التذكرة', description: 'وصف التذكرة', category: 'network', priority: 'high' }
    ],
    projects: [
      { name_ar: 'اسم المشروع', name_en: 'Project Name', description: 'وصف المشروع', priority: 'high', budget: 100000, start_date: '2026-01-01', end_date: '2026-12-31' }
    ],
    tasks: [
      { title: 'عنوان المهمة', description: 'وصف المهمة', priority: 'medium', due_date: '2026-03-01', estimated_hours: 8 }
    ],
    assets: [
      { name: 'اسم الأصل', name_en: 'Asset Name', description: 'وصف الأصل', asset_type: 'database', classification: 'confidential', owner: 'المالك' }
    ],
    departments: [
      { name_ar: 'اسم القسم', name_en: 'Department Name', code: 'DEPT01', description: 'وصف القسم' }
    ],
  };
  
  return templates[importType] || [];
}

export function generateExcelTemplate(importType: ImportType): Buffer {
  const template = getImportTemplate(importType);
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(template);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}
