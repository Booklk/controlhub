import crypto from 'crypto';
import { db } from '../db';
import { webhooks, webhookDeliveries } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { logger } from '../security-middleware';

export const WEBHOOK_EVENTS = [
  'ticket.created', 'ticket.updated', 'ticket.closed', 'ticket.assigned',
  'project.created', 'project.updated', 'project.completed',
  'task.created', 'task.updated', 'task.completed', 'task.assigned',
  'user.created', 'user.updated', 'user.deactivated',
  'incident.created', 'incident.resolved',
  'decision.created', 'decision.approved'
] as const;

export type WebhookEvent = typeof WEBHOOK_EVENTS[number];

export interface WebhookPayload {
  event: WebhookEvent | string;
  timestamp: string;
  data: any;
}

export interface WebhookConfig {
  name: string;
  url: string;
  events: string[];
  headers?: Record<string, string>;
  retryPolicy?: { maxRetries: number; retryDelay: number };
}

export interface WebhookDeliveryResult {
  success: boolean;
  webhookId: number;
  statusCode?: number;
  response?: string;
  error?: string;
  duration: number;
}

function generateSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

function generateSignature(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = generateSignature(payload, secret);
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  } catch {
    return false;
  }
}

export async function registerWebhook(config: WebhookConfig, userId?: number): Promise<{ id: number; secret: string }> {
  const secret = generateSecret();
  
  const [webhook] = await db.insert(webhooks).values({
    name: config.name,
    url: config.url,
    secret,
    events: config.events,
    headers: config.headers || {},
    retryPolicy: config.retryPolicy || { maxRetries: 3, retryDelay: 1000 },
    isActive: true,
    createdBy: userId || null,
  }).returning({ id: webhooks.id });
  
  return { id: webhook.id, secret };
}

export async function updateWebhook(id: number, updates: Partial<WebhookConfig>): Promise<boolean> {
  const result = await db.update(webhooks)
    .set({
      ...(updates.name && { name: updates.name }),
      ...(updates.url && { url: updates.url }),
      ...(updates.events && { events: updates.events }),
      ...(updates.headers && { headers: updates.headers }),
      ...(updates.retryPolicy && { retryPolicy: updates.retryPolicy }),
      updatedAt: new Date(),
    })
    .where(eq(webhooks.id, id))
    .returning({ id: webhooks.id });
  
  return result.length > 0;
}

export async function deleteWebhook(id: number): Promise<boolean> {
  const result = await db.delete(webhooks)
    .where(eq(webhooks.id, id))
    .returning({ id: webhooks.id });
  
  return result.length > 0;
}

export async function getWebhook(id: number) {
  const [webhook] = await db.select().from(webhooks).where(eq(webhooks.id, id)).limit(1);
  return webhook || null;
}

export async function listWebhooks() {
  return db.select({
    id: webhooks.id,
    name: webhooks.name,
    url: webhooks.url,
    events: webhooks.events,
    isActive: webhooks.isActive,
    lastDeliveryAt: webhooks.lastDeliveryAt,
    lastDeliveryStatus: webhooks.lastDeliveryStatus,
    successCount: webhooks.successCount,
    failureCount: webhooks.failureCount,
    consecutiveFailures: webhooks.consecutiveFailures,
    createdAt: webhooks.createdAt,
  }).from(webhooks);
}

export async function triggerWebhooks(event: WebhookEvent, data: any): Promise<void> {
  const activeWebhooks = await db.select()
    .from(webhooks)
    .where(eq(webhooks.isActive, true));
  
  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };
  
  for (const webhook of activeWebhooks) {
    const events = webhook.events as string[];
    if (!events.includes(event)) continue;
    
    deliverWebhook(
      webhook.id,
      webhook.url,
      webhook.secret,
      webhook.headers as Record<string, string> || {},
      payload,
      webhook.retryPolicy as { maxRetries: number; retryDelay: number }
    );
  }
}

async function deliverWebhook(
  webhookId: number,
  url: string,
  secret: string,
  customHeaders: Record<string, string>,
  payload: WebhookPayload,
  retryPolicy: { maxRetries: number; retryDelay: number },
  attemptNumber: number = 1
): Promise<void> {
  const payloadString = JSON.stringify(payload);
  const signature = generateSignature(payloadString, secret);
  const startTime = Date.now();
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': payload.event,
        'X-Webhook-Timestamp': payload.timestamp,
        ...customHeaders,
      },
      body: payloadString,
      signal: AbortSignal.timeout(30000),
    });
    
    const duration = Date.now() - startTime;
    const responseBody = await response.text().catch(() => '');
    const success = response.ok;
    
    await db.insert(webhookDeliveries).values({
      webhookId,
      event: payload.event,
      payload,
      responseStatus: response.status,
      responseBody: responseBody.substring(0, 5000),
      duration,
      success,
      attemptNumber,
    });
    
    if (success) {
      await db.update(webhooks)
        .set({
          lastDeliveryAt: new Date(),
          lastDeliveryStatus: 'success',
          successCount: sql`${webhooks.successCount} + 1`,
          consecutiveFailures: 0,
        })
        .where(eq(webhooks.id, webhookId));
      
      logger.info(`[Webhook] Delivered ${payload.event} to webhook ${webhookId}: success`);
    } else {
      await handleDeliveryFailure(webhookId, url, secret, customHeaders, payload, retryPolicy, attemptNumber, `HTTP ${response.status}`);
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    await db.insert(webhookDeliveries).values({
      webhookId,
      event: payload.event,
      payload,
      duration,
      success: false,
      errorMessage: error.message,
      attemptNumber,
    });
    
    await handleDeliveryFailure(webhookId, url, secret, customHeaders, payload, retryPolicy, attemptNumber, error.message);
  }
}

async function handleDeliveryFailure(
  webhookId: number,
  url: string,
  secret: string,
  customHeaders: Record<string, string>,
  payload: WebhookPayload,
  retryPolicy: { maxRetries: number; retryDelay: number },
  attemptNumber: number,
  errorMessage: string
): Promise<void> {
  const [webhook] = await db.select().from(webhooks).where(eq(webhooks.id, webhookId)).limit(1);
  if (!webhook) return;
  
  const newConsecutiveFailures = webhook.consecutiveFailures + 1;
  
  const updates: any = {
    lastDeliveryAt: new Date(),
    lastDeliveryStatus: 'failed',
    failureCount: sql`${webhooks.failureCount} + 1`,
    consecutiveFailures: newConsecutiveFailures,
  };
  
  if (newConsecutiveFailures >= 5) {
    updates.isActive = false;
    logger.info(`[Webhook] Deactivating webhook ${webhookId} after ${newConsecutiveFailures} consecutive failures`);
  }
  
  await db.update(webhooks).set(updates).where(eq(webhooks.id, webhookId));
  
  if (attemptNumber < retryPolicy.maxRetries && newConsecutiveFailures < 5) {
    const delay = retryPolicy.retryDelay * Math.pow(2, attemptNumber - 1);
    logger.info(`[Webhook] Scheduling retry ${attemptNumber + 1} for webhook ${webhookId} in ${delay}ms`);
    
    setTimeout(() => {
      deliverWebhook(webhookId, url, secret, customHeaders, payload, retryPolicy, attemptNumber + 1);
    }, delay);
  }
}

export async function testWebhook(id: number): Promise<WebhookDeliveryResult> {
  const webhook = await getWebhook(id);
  if (!webhook) {
    return { success: false, webhookId: id, error: 'Webhook not found', duration: 0 };
  }
  
  const testPayload: WebhookPayload = {
    event: 'ticket.created',
    timestamp: new Date().toISOString(),
    data: { test: true, message: 'هذا اختبار للـ Webhook' },
  };
  
  const payloadString = JSON.stringify(testPayload);
  const signature = generateSignature(payloadString, webhook.secret);
  const startTime = Date.now();
  
  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': testPayload.event,
        'X-Webhook-Timestamp': testPayload.timestamp,
        'X-Webhook-Test': 'true',
        ...(webhook.headers as Record<string, string> || {}),
      },
      body: payloadString,
      signal: AbortSignal.timeout(10000),
    });
    
    const duration = Date.now() - startTime;
    const responseText = await response.text().catch(() => '');
    
    return {
      success: response.ok,
      webhookId: id,
      statusCode: response.status,
      response: responseText,
      duration,
    };
  } catch (error: any) {
    return {
      success: false,
      webhookId: id,
      error: error.message,
      duration: Date.now() - startTime,
    };
  }
}

export async function getWebhookStats() {
  const allWebhooks = await listWebhooks();
  
  const eventStats: Record<string, number> = {};
  for (const webhook of allWebhooks) {
    const events = webhook.events as string[];
    for (const event of events) {
      eventStats[event] = (eventStats[event] || 0) + 1;
    }
  }
  
  return {
    total: allWebhooks.length,
    active: allWebhooks.filter((w: any) => w.isActive).length,
    inactive: allWebhooks.filter((w: any) => !w.isActive).length,
    byEvent: eventStats,
    recentFailures: allWebhooks.filter((w: any) => w.failureCount > 0).map((w: any) => ({
      id: w.id,
      name: w.name,
      failureCount: w.failureCount,
      consecutiveFailures: w.consecutiveFailures,
      isActive: w.isActive
    }))
  };
}

export function generateWebhookSecret(): string {
  return generateSecret();
}

export const webhookEvents: { value: string; label: string }[] = [
  { value: 'ticket.created', label: 'إنشاء تذكرة جديدة' },
  { value: 'ticket.updated', label: 'تحديث تذكرة' },
  { value: 'ticket.closed', label: 'إغلاق تذكرة' },
  { value: 'ticket.assigned', label: 'تعيين تذكرة' },
  { value: 'project.created', label: 'إنشاء مشروع جديد' },
  { value: 'project.updated', label: 'تحديث مشروع' },
  { value: 'project.completed', label: 'اكتمال مشروع' },
  { value: 'task.created', label: 'إنشاء مهمة جديدة' },
  { value: 'task.updated', label: 'تحديث مهمة' },
  { value: 'task.completed', label: 'اكتمال مهمة' },
  { value: 'task.assigned', label: 'تعيين مهمة' },
  { value: 'user.created', label: 'إنشاء مستخدم جديد' },
  { value: 'user.updated', label: 'تحديث مستخدم' },
  { value: 'user.deactivated', label: 'تعطيل مستخدم' },
  { value: 'incident.created', label: 'إنشاء حادثة أمنية' },
  { value: 'incident.resolved', label: 'حل حادثة أمنية' },
  { value: 'decision.created', label: 'إنشاء قرار جديد' },
  { value: 'decision.approved', label: 'الموافقة على قرار' },
];
