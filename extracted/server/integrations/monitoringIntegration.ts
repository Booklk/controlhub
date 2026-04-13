import { logger } from '../security-middleware';

export interface MonitoringConfig {
  type: 'zabbix' | 'nagios' | 'prometheus' | 'custom';
  apiUrl: string;
  apiKey?: string;
  username?: string;
  password?: string;
  refreshInterval: number;
}

export interface ServerMetrics {
  serverId: string;
  hostname: string;
  ipAddress: string;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkIn: number;
  networkOut: number;
  status: 'online' | 'offline' | 'warning' | 'critical';
  uptime: number;
  lastCheck: Date;
}

export interface NetworkMetrics {
  deviceId: string;
  deviceName: string;
  deviceType: 'router' | 'switch' | 'firewall' | 'access_point';
  ipAddress: string;
  status: 'online' | 'offline' | 'degraded';
  bandwidth: number;
  latency: number;
  packetLoss: number;
  lastCheck: Date;
}

export interface AlertEvent {
  id: string;
  severity: 'info' | 'warning' | 'critical' | 'disaster';
  source: string;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  resolvedAt?: Date;
}

export interface MonitoringSyncResult {
  success: boolean;
  serversUpdated: number;
  networksUpdated: number;
  alertsReceived: number;
  errors: string[];
}

const monitoringConfigs: Map<string, MonitoringConfig> = new Map();

export function isMonitoringConfigured(type?: string): boolean {
  if (type) {
    return monitoringConfigs.has(type);
  }
  return monitoringConfigs.size > 0 || !!process.env.MONITORING_API_URL;
}

export function getMonitoringConfig(type: string): MonitoringConfig | undefined {
  return monitoringConfigs.get(type);
}

export function setMonitoringConfig(config: MonitoringConfig): void {
  monitoringConfigs.set(config.type, config);
}

export async function testMonitoringConnection(config: MonitoringConfig): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${config.apiUrl}/api/status`, {
      headers: config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {},
    });
    
    if (response.ok) {
      return { success: true, message: 'تم الاتصال بنظام المراقبة بنجاح' };
    }
    
    return { success: false, message: `فشل الاتصال: HTTP ${response.status}` };
  } catch (error: any) {
    return { success: false, message: 'فشل الاتصال بنظام المراقبة' };
  }
}

export async function fetchServerMetrics(config: MonitoringConfig): Promise<ServerMetrics[]> {
  if (!config.apiUrl) return [];
  try {
    const response = await fetch(`${config.apiUrl}/api/hosts`, {
      headers: config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {},
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.map((host: any) => ({
      serverId: host.hostid || host.id,
      hostname: host.host || host.name,
      ipAddress: host.ip || host.interfaces?.[0]?.ip || 'N/A',
      cpuUsage: parseFloat(host.cpu) || 0,
      memoryUsage: parseFloat(host.memory) || 0,
      diskUsage: parseFloat(host.disk) || 0,
      networkIn: parseFloat(host.network_in) || 0,
      networkOut: parseFloat(host.network_out) || 0,
      status: mapStatus(host.status),
      uptime: parseInt(host.uptime) || 0,
      lastCheck: new Date(),
    }));
  } catch (error) {
    logger.error('[Monitoring] Failed to fetch server metrics:', { error });
    return [];
  }
}

export async function fetchNetworkMetrics(config: MonitoringConfig): Promise<NetworkMetrics[]> {
  if (!config.apiUrl) return [];
  try {
    const response = await fetch(`${config.apiUrl}/api/network`, {
      headers: config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {},
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    logger.error('[Monitoring] Failed to fetch network metrics:', { error });
    return [];
  }
}

export async function fetchAlerts(config: MonitoringConfig): Promise<AlertEvent[]> {
  if (!config.apiUrl) return [];
  try {
    const response = await fetch(`${config.apiUrl}/api/alerts`, {
      headers: config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {},
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    logger.error('[Monitoring] Failed to fetch alerts:', { error });
    return [];
  }
}

export async function syncMonitoringData(): Promise<MonitoringSyncResult> {
  const result: MonitoringSyncResult = {
    success: true,
    serversUpdated: 0,
    networksUpdated: 0,
    alertsReceived: 0,
    errors: []
  };
  
  try {
    const serverMetrics = await fetchServerMetrics({ type: 'custom', apiUrl: process.env.MONITORING_API_URL || '', refreshInterval: 60 });
    result.serversUpdated = serverMetrics.length;
    
    const networkMetrics = await fetchNetworkMetrics({ type: 'custom', apiUrl: process.env.MONITORING_API_URL || '', refreshInterval: 60 });
    result.networksUpdated = networkMetrics.length;
    
    const alerts = await fetchAlerts({ type: 'custom', apiUrl: process.env.MONITORING_API_URL || '', refreshInterval: 60 });
    result.alertsReceived = alerts.length;
    
  } catch (error: any) {
    result.success = false;
    result.errors.push(`خطأ عام: ${error.message}`);
  }
  
  return result;
}

function mapStatus(status: any): 'online' | 'offline' | 'warning' | 'critical' {
  if (status === 0 || status === 'up' || status === 'online') return 'online';
  if (status === 1 || status === 'down' || status === 'offline') return 'offline';
  if (status === 2 || status === 'warning') return 'warning';
  return 'critical';
}

export async function getInfrastructureDashboard() {
  const servers = await fetchServerMetrics({ type: 'custom', apiUrl: '', refreshInterval: 60 });
  const networks = await fetchNetworkMetrics({ type: 'custom', apiUrl: '', refreshInterval: 60 });
  const alerts = await fetchAlerts({ type: 'custom', apiUrl: '', refreshInterval: 60 });
  
  return {
    servers: {
      total: servers.length,
      online: servers.filter(s => s.status === 'online').length,
      offline: servers.filter(s => s.status === 'offline').length,
      warning: servers.filter(s => s.status === 'warning').length,
      critical: servers.filter(s => s.status === 'critical').length,
      items: servers
    },
    networks: {
      total: networks.length,
      online: networks.filter(n => n.status === 'online').length,
      offline: networks.filter(n => n.status === 'offline').length,
      items: networks
    },
    alerts: {
      total: alerts.length,
      critical: alerts.filter(a => a.severity === 'critical' || a.severity === 'disaster').length,
      warning: alerts.filter(a => a.severity === 'warning').length,
      unacknowledged: alerts.filter(a => !a.acknowledged).length,
      items: alerts
    },
    lastSync: new Date()
  };
}
