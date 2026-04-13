import { db } from '../db';
import { logger } from '../security-middleware';

export interface ErpConfig {
  type: 'sap' | 'oracle' | 'dynamics' | 'odoo' | 'custom';
  apiUrl: string;
  apiKey?: string;
  username?: string;
  password?: string;
  companyCode?: string;
}

export interface Employee {
  employeeId: string;
  firstName: string;
  lastName: string;
  fullNameAr: string;
  email: string;
  department: string;
  position: string;
  managerId?: string;
  hireDate: Date;
  status: 'active' | 'inactive' | 'terminated';
  costCenter?: string;
}

export interface Department {
  departmentId: string;
  name: string;
  nameAr: string;
  code: string;
  parentId?: string;
  managerId?: string;
  costCenter?: string;
}

export interface Asset {
  assetId: string;
  name: string;
  category: string;
  acquisitionDate: Date;
  acquisitionCost: number;
  currentValue: number;
  location: string;
  assignedTo?: string;
  status: 'active' | 'disposed' | 'maintenance';
}

export interface Budget {
  budgetId: string;
  departmentId: string;
  fiscalYear: number;
  allocatedAmount: number;
  spentAmount: number;
  remainingAmount: number;
  category: string;
}

export interface ErpSyncResult {
  success: boolean;
  employeessynced: number;
  departmentsSynced: number;
  assetsSynced: number;
  errors: string[];
}

const erpConfigs: Map<string, ErpConfig> = new Map();

export function isErpConfigured(): boolean {
  return erpConfigs.size > 0 || !!process.env.ERP_API_URL;
}

export function getErpConfig(): ErpConfig | undefined {
  return erpConfigs.values().next().value;
}

export function setErpConfig(config: ErpConfig): void {
  erpConfigs.set(config.type, config);
}

export async function testErpConnection(config: ErpConfig): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${config.apiUrl}/api/health`, {
      headers: config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {},
    });
    
    if (response.ok) {
      return { success: true, message: 'تم الاتصال بنظام ERP بنجاح' };
    }
    
    return { success: false, message: `فشل الاتصال: HTTP ${response.status}` };
  } catch (error: any) {
    return { success: false, message: 'فشل الاتصال بنظام ERP' };
  }
}

export async function fetchEmployees(config: ErpConfig): Promise<Employee[]> {
  if (!config.apiUrl) return [];
  try {
    const response = await fetch(`${config.apiUrl}/api/employees`, {
      headers: config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {},
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    logger.error('[ERP] Failed to fetch employees:', { error });
    return [];
  }
}

export async function fetchDepartments(config: ErpConfig): Promise<Department[]> {
  if (!config.apiUrl) return [];
  try {
    const response = await fetch(`${config.apiUrl}/api/departments`, {
      headers: config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {},
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    logger.error('[ERP] Failed to fetch departments:', { error });
    return [];
  }
}

export async function fetchAssets(config: ErpConfig): Promise<Asset[]> {
  if (!config.apiUrl) return [];
  try {
    const response = await fetch(`${config.apiUrl}/api/assets`, {
      headers: config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {},
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    logger.error('[ERP] Failed to fetch assets:', { error });
    return [];
  }
}

export async function fetchBudgets(config: ErpConfig, fiscalYear?: number): Promise<Budget[]> {
  if (!config.apiUrl) return [];
  try {
    const params = fiscalYear ? `?year=${fiscalYear}` : '';
    const response = await fetch(`${config.apiUrl}/api/budgets${params}`, {
      headers: config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {},
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    logger.error('[ERP] Failed to fetch budgets:', { error });
    return [];
  }
}

export async function syncErpData(): Promise<ErpSyncResult> {
  const result: ErpSyncResult = {
    success: true,
    employeessynced: 0,
    departmentsSynced: 0,
    assetsSynced: 0,
    errors: []
  };
  
  try {
    const config = getErpConfig() || { type: 'custom' as const, apiUrl: process.env.ERP_API_URL || '' };
    
    const employees = await fetchEmployees(config);
    result.employeessynced = employees.length;
    
    const departments = await fetchDepartments(config);
    result.departmentsSynced = departments.length;
    
    const assets = await fetchAssets(config);
    result.assetsSynced = assets.length;
    
  } catch (error: any) {
    result.success = false;
    result.errors.push(`خطأ عام: ${error.message}`);
  }
  
  return result;
}

export async function getErpDashboard() {
  const config = getErpConfig() || { type: 'custom' as const, apiUrl: '' };
  
  const employees = await fetchEmployees(config);
  const departments = await fetchDepartments(config);
  const assets = await fetchAssets(config);
  const budgets = await fetchBudgets(config);
  
  const totalBudget = budgets.reduce((sum, b) => sum + b.allocatedAmount, 0);
  const spentBudget = budgets.reduce((sum, b) => sum + b.spentAmount, 0);
  
  return {
    employees: {
      total: employees.length,
      active: employees.filter(e => e.status === 'active').length,
      byDepartment: departments.map(d => ({
        department: d.nameAr,
        count: employees.filter(e => e.department === d.departmentId).length
      }))
    },
    departments: {
      total: departments.length,
      items: departments
    },
    assets: {
      total: assets.length,
      active: assets.filter(a => a.status === 'active').length,
      totalValue: assets.reduce((sum, a) => sum + a.currentValue, 0),
      byCategory: {
        it: assets.filter(a => a.category === 'it').length,
        furniture: assets.filter(a => a.category === 'furniture').length,
        vehicles: assets.filter(a => a.category === 'vehicles').length,
      }
    },
    budgets: {
      totalAllocated: totalBudget,
      totalSpent: spentBudget,
      remaining: totalBudget - spentBudget,
      utilizationRate: totalBudget > 0 ? (spentBudget / totalBudget * 100).toFixed(1) : 0,
      items: budgets
    },
    lastSync: new Date()
  };
}
