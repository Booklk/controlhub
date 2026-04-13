import { logger } from '../security-middleware';

export interface SiemConfig {
  type: 'splunk' | 'qradar' | 'elastic' | 'arcsight' | 'custom';
  apiUrl: string;
  apiKey?: string;
  username?: string;
  password?: string;
  index?: string;
}

export interface SecurityEvent {
  id: string;
  timestamp: Date;
  eventType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  sourceIp?: string;
  destinationIp?: string;
  user?: string;
  action: string;
  outcome: 'success' | 'failure' | 'unknown';
  description: string;
  rawLog?: string;
}

export interface ThreatIndicator {
  id: string;
  type: 'ip' | 'domain' | 'hash' | 'url' | 'email';
  value: string;
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  firstSeen: Date;
  lastSeen: Date;
  tags: string[];
}

export interface SecurityIncident {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'contained' | 'resolved' | 'closed';
  category: string;
  affectedAssets: string[];
  assignee?: string;
  createdAt: Date;
  updatedAt: Date;
  events: SecurityEvent[];
}

export interface SiemSyncResult {
  success: boolean;
  eventsProcessed: number;
  incidentsCreated: number;
  threatsDetected: number;
  errors: string[];
}

const siemConfigs: Map<string, SiemConfig> = new Map();

export function isSiemConfigured(): boolean {
  return siemConfigs.size > 0 || !!process.env.SIEM_API_URL;
}

export function getSiemConfig(): SiemConfig | undefined {
  return siemConfigs.values().next().value;
}

export function setSiemConfig(config: SiemConfig): void {
  siemConfigs.set(config.type, config);
}

export async function testSiemConnection(config: SiemConfig): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${config.apiUrl}/api/health`, {
      headers: config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {},
    });
    
    if (response.ok) {
      return { success: true, message: 'تم الاتصال بنظام SIEM بنجاح' };
    }
    
    return { success: false, message: `فشل الاتصال: HTTP ${response.status}` };
  } catch (error: any) {
    return { success: false, message: 'فشل الاتصال بنظام SIEM' };
  }
}

export async function fetchSecurityEvents(config: SiemConfig, timeRange?: { start: Date; end: Date }): Promise<SecurityEvent[]> {
  if (!config.apiUrl) {
    return [];
  }
  
  try {
    const params = new URLSearchParams();
    if (timeRange) {
      params.set('start', timeRange.start.toISOString());
      params.set('end', timeRange.end.toISOString());
    }
    
    const response = await fetch(`${config.apiUrl}/api/events?${params}`, {
      headers: config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {},
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    logger.error('[SIEM] Failed to fetch security events:', { error });
    return [];
  }
}

export async function fetchThreatIndicators(config: SiemConfig): Promise<ThreatIndicator[]> {
  if (!config.apiUrl) {
    return [];
  }
  
  try {
    const response = await fetch(`${config.apiUrl}/api/threats`, {
      headers: config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {},
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    logger.error('[SIEM] Failed to fetch threat indicators:', { error });
    return [];
  }
}

export async function fetchIncidents(config: SiemConfig): Promise<SecurityIncident[]> {
  if (!config.apiUrl) {
    return [];
  }
  
  try {
    const response = await fetch(`${config.apiUrl}/api/incidents`, {
      headers: config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {},
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    logger.error('[SIEM] Failed to fetch incidents:', { error });
    return [];
  }
}

export async function sendLogToSiem(config: SiemConfig, event: SecurityEvent): Promise<boolean> {
  if (!config.apiUrl) {
    return false;
  }
  
  try {
    const response = await fetch(`${config.apiUrl}/api/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify(event),
    });
    
    return response.ok;
  } catch (error) {
    logger.error('[SIEM] Failed to send event:', { error });
    return false;
  }
}

export async function syncSiemData(): Promise<SiemSyncResult> {
  const result: SiemSyncResult = {
    success: true,
    eventsProcessed: 0,
    incidentsCreated: 0,
    threatsDetected: 0,
    errors: []
  };
  
  try {
    const config = getSiemConfig() || { type: 'custom' as const, apiUrl: process.env.SIEM_API_URL || '' };
    
    const events = await fetchSecurityEvents(config);
    result.eventsProcessed = events.length;
    result.incidentsCreated = events.filter(e => e.severity === 'high' || e.severity === 'critical').length;
    
    const threats = await fetchThreatIndicators(config);
    result.threatsDetected = threats.length;
    
  } catch (error: any) {
    result.success = false;
    result.errors.push(`خطأ عام: ${error.message}`);
  }
  
  return result;
}

export async function getSecurityDashboard() {
  const config = getSiemConfig() || { type: 'custom' as const, apiUrl: '' };
  
  const events = await fetchSecurityEvents(config);
  const threats = await fetchThreatIndicators(config);
  const incidents = await fetchIncidents(config);
  
  const last24h = events.filter(e => e.timestamp > new Date(Date.now() - 86400000));
  
  return {
    events: {
      total: events.length,
      last24h: last24h.length,
      bySeverity: {
        critical: events.filter(e => e.severity === 'critical').length,
        high: events.filter(e => e.severity === 'high').length,
        medium: events.filter(e => e.severity === 'medium').length,
        low: events.filter(e => e.severity === 'low').length,
      },
      recent: events.slice(0, 10)
    },
    threats: {
      total: threats.length,
      active: threats.filter(t => t.threatLevel === 'high' || t.threatLevel === 'critical').length,
      byType: {
        ip: threats.filter(t => t.type === 'ip').length,
        domain: threats.filter(t => t.type === 'domain').length,
        hash: threats.filter(t => t.type === 'hash').length,
        url: threats.filter(t => t.type === 'url').length,
      },
      items: threats
    },
    incidents: {
      total: incidents.length,
      open: incidents.filter(i => i.status === 'open' || i.status === 'investigating').length,
      resolved: incidents.filter(i => i.status === 'resolved' || i.status === 'closed').length,
      bySeverity: {
        critical: incidents.filter(i => i.severity === 'critical').length,
        high: incidents.filter(i => i.severity === 'high').length,
        medium: incidents.filter(i => i.severity === 'medium').length,
        low: incidents.filter(i => i.severity === 'low').length,
      },
      items: incidents
    },
    lastSync: new Date()
  };
}
