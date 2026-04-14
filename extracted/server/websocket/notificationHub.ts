/**
 * WebSocket Notification Hub - مركز الإشعارات الفورية
 * Control Hub - JCSA
 */

import { WebSocket, WebSocketServer } from 'ws';
import { Server } from 'http';
import { verifyAccessToken } from '../auth/tokenManager';
import { logger } from '../security-middleware';

interface ConnectedClient {
  ws: WebSocket;
  userId: number;
  portal: string;
  role: string;
  departmentId?: number;
  itDepartmentId?: number;
  lastPing: number;
}

interface NotificationMessage {
  type: 'notification' | 'update' | 'alert' | 'system';
  data: any;
  timestamp: Date;
  targetUserIds?: number[];
  targetPortals?: string[];
  targetDepartments?: number[];
}

class NotificationHub {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, ConnectedClient> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  
  initialize(server: Server) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws/notifications',
    });
    
    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });
    
    // Heartbeat to keep connections alive and clean up dead ones
    this.heartbeatInterval = setInterval(() => {
      this.cleanupDeadConnections();
    }, 30000);
    
    logger.info('[WebSocket] Notification Hub initialized');
  }
  
  private handleConnection(ws: WebSocket, req: any) {
    // FIX #4: Do NOT accept token via URL query param (leaks to logs, browser history, proxies)
    // Token is now received as the first WebSocket message within a 5-second handshake window.
    
    let authenticated = false;
    let clientId: string | null = null;
    
    // Handshake timeout — close if auth message not received in 5 seconds
    const handshakeTimeout = setTimeout(() => {
      if (!authenticated) {
        ws.close(4001, 'Authentication timeout');
      }
    }, 5000);

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        // First message must be the auth handshake
        if (!authenticated) {
          if (data.type !== 'auth' || !data.token) {
            ws.close(4001, 'Authentication required');
            return;
          }
          
          const payload = verifyAccessToken(data.token);
          if (!payload) {
            ws.close(4002, 'Invalid token');
            return;
          }
          
          clearTimeout(handshakeTimeout);
          authenticated = true;
          clientId = `${payload.userId}-${Date.now()}`;
          
          const client: ConnectedClient = {
            ws,
            userId: payload.userId,
            portal: payload.portal,
            role: payload.role,
            departmentId: payload.departmentId,
            itDepartmentId: payload.itDepartmentId,
            lastPing: Date.now(),
          };
          
          this.clients.set(clientId, client);
          
          // Confirm successful auth
          ws.send(JSON.stringify({
            type: 'connected',
            message: 'تم الاتصال بنجاح',
            timestamp: new Date(),
          }));
          return;
        }
        
        // Subsequent messages — only ping is handled
        if (data.type === 'ping') {
          const client = clientId ? this.clients.get(clientId) : null;
          if (client) client.lastPing = Date.now();
          ws.send(JSON.stringify({ type: 'pong', timestamp: new Date() }));
        }
      } catch (error) {
        logger.error('[WebSocket] Message parse error:', { error });
      }
    });
    
    ws.on('close', () => {
      clearTimeout(handshakeTimeout);
      if (clientId) this.clients.delete(clientId);
    });
    
    ws.on('error', (error) => {
      logger.error('[WebSocket] Client error:', { error });
      if (clientId) this.clients.delete(clientId);
    });
  }
  
  private cleanupDeadConnections() {
    const now = Date.now();
    const timeout = 60000; // 1 minute
    
    Array.from(this.clients.entries()).forEach(([clientId, client]) => {
      if (now - client.lastPing > timeout) {
        client.ws.close(4003, 'Connection timeout');
        this.clients.delete(clientId);
      }
    });
  }
  
  // Send notification to specific users
  sendToUsers(userIds: number[], message: NotificationMessage) {
    Array.from(this.clients.values()).forEach(client => {
      if (userIds.includes(client.userId)) {
        this.sendToClient(client, message);
      }
    });
  }
  
  // Send notification to users in specific portals
  sendToPortals(portals: string[], message: NotificationMessage) {
    Array.from(this.clients.values()).forEach(client => {
      if (portals.includes(client.portal)) {
        this.sendToClient(client, message);
      }
    });
  }
  
  // Send notification to users in specific departments
  sendToDepartments(departmentIds: number[], message: NotificationMessage) {
    Array.from(this.clients.values()).forEach(client => {
      if (client.departmentId && departmentIds.includes(client.departmentId)) {
        this.sendToClient(client, message);
      }
    });
  }
  
  // Send notification to IT departments
  sendToITDepartments(itDepartmentIds: number[], message: NotificationMessage) {
    Array.from(this.clients.values()).forEach(client => {
      if (client.itDepartmentId && itDepartmentIds.includes(client.itDepartmentId)) {
        this.sendToClient(client, message);
      }
    });
  }
  
  // Broadcast to all connected clients
  broadcast(message: NotificationMessage) {
    Array.from(this.clients.values()).forEach(client => {
      this.sendToClient(client, message);
    });
  }
  
  // Send to single client
  private sendToClient(client: ConnectedClient, message: NotificationMessage) {
    if (client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(JSON.stringify({
          ...message,
          timestamp: new Date(),
        }));
      } catch (error) {
        logger.error('[WebSocket] Send error:', { error });
      }
    }
  }
  
  // Get connected users count
  getConnectedUsersCount(): number {
    return new Set(Array.from(this.clients.values()).map(c => c.userId)).size;
  }
  
  // Get connected clients info (for admin)
  getConnectedClientsInfo(): { userId: number; portal: string; role: string }[] {
    return Array.from(this.clients.values()).map(c => ({
      userId: c.userId,
      portal: c.portal,
      role: c.role,
    }));
  }
  
  // Shutdown
  shutdown() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    Array.from(this.clients.values()).forEach(client => {
      client.ws.close(1001, 'Server shutdown');
    });
    
    this.clients.clear();
    
    if (this.wss) {
      this.wss.close();
    }
  }
}

// Singleton instance
export const notificationHub = new NotificationHub();

// Helper functions for easy usage
export function notifyUsers(userIds: number[], type: NotificationMessage['type'], data: any) {
  notificationHub.sendToUsers(userIds, { type, data, timestamp: new Date() });
}

export function notifyPortals(portals: string[], type: NotificationMessage['type'], data: any) {
  notificationHub.sendToPortals(portals, { type, data, timestamp: new Date() });
}

export function notifyDepartments(departmentIds: number[], type: NotificationMessage['type'], data: any) {
  notificationHub.sendToDepartments(departmentIds, { type, data, timestamp: new Date() });
}

export function notifyITDepartments(itDepartmentIds: number[], type: NotificationMessage['type'], data: any) {
  notificationHub.sendToITDepartments(itDepartmentIds, { type, data, timestamp: new Date() });
}

export function broadcastNotification(type: NotificationMessage['type'], data: any) {
  notificationHub.broadcast({ type, data, timestamp: new Date() });
}

// ==================== Event-Driven Broadcast Helpers ====================

/**
 * بث إشعار عند إنشاء تذكرة جديدة
 * Broadcast when a new ticket is created
 */
export function broadcastTicketCreated(ticket: { id: number; title: string; priority: string; category?: string; ticketNumber?: string }) {
  const message: NotificationMessage = {
    type: 'update',
    data: {
      event: 'ticket_created',
      ticket: {
        id: ticket.id,
        title: ticket.title,
        priority: ticket.priority,
        category: ticket.category || 'عام',
        ticketNumber: ticket.ticketNumber || `TKT-${ticket.id}`,
      },
      message: `تذكرة جديدة: ${ticket.title}`,
    },
    timestamp: new Date(),
  };
  // Notify IT portals about new tickets
  notificationHub.sendToPortals(['it_director', 'admin', 'super_admin'], message);
  logger.info(`[WebSocket] Broadcast ticket_created: TKT-${ticket.id}`);
}

/**
 * بث إشعار عند حل تذكرة
 * Broadcast when a ticket is resolved/closed
 */
export function broadcastTicketResolved(ticket: { id: number; title: string; status: string; resolvedById?: number; ticketNumber?: string }) {
  const message: NotificationMessage = {
    type: 'update',
    data: {
      event: 'ticket_resolved',
      ticket: {
        id: ticket.id,
        title: ticket.title,
        status: ticket.status,
        ticketNumber: ticket.ticketNumber || `TKT-${ticket.id}`,
      },
      message: `تم حل التذكرة: ${ticket.title}`,
    },
    timestamp: new Date(),
  };
  notificationHub.sendToPortals(['it_director', 'admin', 'super_admin'], message);
  logger.info(`[WebSocket] Broadcast ticket_resolved: TKT-${ticket.id}`);
}

/**
 * بث إشعار عند إسناد مهمة
 * Broadcast when a task is assigned to a user
 */
export function broadcastTaskAssigned(task: { id: number; title: string; priority?: string; dueDate?: string | Date | null }, assignedToId: number, assignedById: number) {
  const message: NotificationMessage = {
    type: 'update',
    data: {
      event: 'task_assigned',
      task: {
        id: task.id,
        title: task.title,
        priority: task.priority || 'medium',
        dueDate: task.dueDate || null,
      },
      assignedToId,
      assignedById,
      message: `مهمة جديدة مسندة إليك: ${task.title}`,
    },
    timestamp: new Date(),
  };
  // Send directly to the assigned user
  notificationHub.sendToUsers([assignedToId], message);
  logger.info(`[WebSocket] Broadcast task_assigned: task ${task.id} -> user ${assignedToId}`);
}

/**
 * بث إشعار عند تجاوز اتفاقية مستوى الخدمة
 * Broadcast when an SLA breach occurs
 */
export function broadcastSLABreach(breach: { id: number; impactLevel: string; slaId?: number }, slaTitle: string) {
  const message: NotificationMessage = {
    type: 'alert',
    data: {
      event: 'sla_breach',
      breach: {
        id: breach.id,
        impactLevel: breach.impactLevel,
        slaId: breach.slaId,
      },
      slaTitle,
      message: `تنبيه: تجاوز اتفاقية SLA — ${slaTitle}`,
    },
    timestamp: new Date(),
  };
  // SLA breaches are critical — notify all admin and IT director portals
  notificationHub.sendToPortals(['it_director', 'admin', 'super_admin'], message);
  logger.info(`[WebSocket] Broadcast sla_breach: ${slaTitle} (impact: ${breach.impactLevel})`);
}
