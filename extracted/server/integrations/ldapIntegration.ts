import { db } from '../db';
import { users, integrationConfigs } from '@shared/schema';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
// @ts-ignore - ldapjs has no type declarations
import ldap from 'ldapjs';

export interface LdapConfig {
  url: string;
  baseDN: string;
  bindDN: string;
  bindPassword: string;
  userSearchBase: string;
  userSearchFilter: string;
  usernameAttribute: string;
  emailAttribute: string;
  displayNameAttribute: string;
  groupSearchBase?: string;
  groupSearchFilter?: string;
  tlsEnabled?: boolean;
  port?: number;
}

export interface LdapUser {
  username: string;
  email: string;
  displayName: string;
  department?: string;
  title?: string;
  groups?: string[];
  phone?: string;
  dn?: string;
}

export interface LdapSyncResult {
  success: boolean;
  synced: number;
  created: number;
  updated: number;
  errors: string[];
}

export interface LdapAuthResult {
  success: boolean;
  user?: LdapUser;
  error?: string;
}

const AD_CONFIG_KEY = 'active_directory';

export async function getAdConfigFromDb(): Promise<LdapConfig | null> {
  try {
    const rows = await db.select().from(integrationConfigs).where(eq(integrationConfigs.integrationType, AD_CONFIG_KEY));
    if (rows.length === 0) return null;
    return rows[0].config as LdapConfig;
  } catch {
    return null;
  }
}

export async function saveAdConfigToDb(config: LdapConfig, userId?: number): Promise<void> {
  const existing = await db.select().from(integrationConfigs).where(eq(integrationConfigs.integrationType, AD_CONFIG_KEY));
  if (existing.length > 0) {
    await db.update(integrationConfigs)
      .set({ config, updatedAt: new Date(), updatedBy: userId || null })
      .where(eq(integrationConfigs.integrationType, AD_CONFIG_KEY));
  } else {
    await db.insert(integrationConfigs).values({
      integrationType: AD_CONFIG_KEY,
      config,
      updatedAt: new Date(),
      updatedBy: userId || null,
    });
  }
}

function buildLdapConfig(): LdapConfig {
  return {
    url: process.env.LDAP_URL || 'ldap://localhost:389',
    baseDN: process.env.LDAP_BASE_DN || 'dc=jcsa,dc=sa',
    bindDN: process.env.LDAP_BIND_DN || 'cn=admin,dc=jcsa,dc=sa',
    bindPassword: process.env.LDAP_BIND_PASSWORD || '',
    userSearchBase: process.env.LDAP_USER_SEARCH_BASE || 'ou=users,dc=jcsa,dc=sa',
    userSearchFilter: process.env.LDAP_USER_SEARCH_FILTER || '(objectClass=person)',
    usernameAttribute: 'sAMAccountName',
    emailAttribute: 'mail',
    displayNameAttribute: 'displayName',
    groupSearchBase: process.env.LDAP_GROUP_SEARCH_BASE || 'ou=groups,dc=jcsa,dc=sa',
    groupSearchFilter: '(objectClass=group)',
    tlsEnabled: false,
  };
}

export function getLdapConfig(): LdapConfig {
  return buildLdapConfig();
}

export function isLdapConfigured(): boolean {
  return !!(process.env.LDAP_URL && process.env.LDAP_BIND_DN && process.env.LDAP_BIND_PASSWORD);
}

function createLdapClient(config: LdapConfig): ldap.Client {
  const url = config.tlsEnabled && !config.url.startsWith('ldaps://')
    ? config.url.replace('ldap://', 'ldaps://')
    : config.url;
  return ldap.createClient({
    url,
    timeout: 8000,
    connectTimeout: 8000,
    reconnect: false,
  });
}

export async function testLdapConnection(config: LdapConfig): Promise<{ success: boolean; message: string; details?: string }> {
  return new Promise((resolve) => {
    const client = createLdapClient(config);
    const timeout = setTimeout(() => {
      client.destroy();
      resolve({ success: false, message: 'انتهت مهلة الاتصال بالخادم (8 ثوانٍ)', details: `URL: ${config.url}` });
    }, 8000);

    client.on('error', (err: Error) => {
      clearTimeout(timeout);
      client.destroy();
      resolve({ success: false, message: 'فشل الاتصال بخادم Active Directory', details: `URL: ${config.url}` });
    });

    client.bind(config.bindDN, config.bindPassword, (err: any) => {
      clearTimeout(timeout);
      if (err) {
        client.destroy();
        resolve({ success: false, message: 'فشل المصادقة — تحقق من بيانات Bind DN', details: `Bind DN: ${config.bindDN}` });
      } else {
        client.destroy();
        resolve({ success: true, message: `تم الاتصال بخادم Active Directory بنجاح على ${config.url}` });
      }
    });
  });
}

export async function searchLdapUsers(config: LdapConfig, searchTerm: string): Promise<LdapUser[]> {
  return new Promise((resolve) => {
    const client = createLdapClient(config);
    const results: LdapUser[] = [];

    const timeout = setTimeout(() => {
      client.destroy();
      resolve(results);
    }, 10000);

    client.on('error', () => {
      clearTimeout(timeout);
      client.destroy();
      resolve(results);
    });

    client.bind(config.bindDN, config.bindPassword, (bindErr: any) => {
      if (bindErr) {
        clearTimeout(timeout);
        client.destroy();
        resolve(results);
        return;
      }

      const escapedTerm = searchTerm.replace(/[*\\()]/g, '\\$&');
      const filter = `(&(objectClass=person)(|(${config.usernameAttribute}=*${escapedTerm}*)(${config.emailAttribute}=*${escapedTerm}*)(${config.displayNameAttribute}=*${escapedTerm}*)))`;

      const opts: ldap.SearchOptions = {
        filter,
        scope: 'sub',
        attributes: [
          config.usernameAttribute,
          config.emailAttribute,
          config.displayNameAttribute,
          'department',
          'title',
          'telephoneNumber',
          'mobile',
          'userPrincipalName',
        ],
        sizeLimit: 50,
        timeLimit: 8,
      };

      client.search(config.userSearchBase || config.baseDN, opts, (searchErr: any, searchRes: any) => {
        if (searchErr) {
          clearTimeout(timeout);
          client.destroy();
          resolve(results);
          return;
        }

        searchRes.on('searchEntry', (entry: any) => {
          const obj = entry.pojo.attributes.reduce((acc: Record<string, string>, attr: any) => {
            acc[attr.type] = Array.isArray(attr.values) ? attr.values[0] : attr.values;
            return acc;
          }, {});

          const user: LdapUser = {
            dn: entry.pojo.objectName,
            username: obj[config.usernameAttribute] || obj['userPrincipalName'] || '',
            email: obj[config.emailAttribute] || obj['userPrincipalName'] || '',
            displayName: obj[config.displayNameAttribute] || obj[config.usernameAttribute] || '',
            department: obj['department'] || undefined,
            title: obj['title'] || undefined,
            phone: obj['telephoneNumber'] || obj['mobile'] || undefined,
          };

          if (user.username || user.email) {
            results.push(user);
          }
        });

        searchRes.on('end', () => {
          clearTimeout(timeout);
          client.destroy();
          resolve(results);
        });

        searchRes.on('error', () => {
          clearTimeout(timeout);
          client.destroy();
          resolve(results);
        });
      });
    });
  });
}

export async function syncLdapUsers(config?: LdapConfig): Promise<LdapSyncResult> {
  const result: LdapSyncResult = { success: false, synced: 0, created: 0, updated: 0, errors: [] };

  const cfg = config || (await getAdConfigFromDb()) || buildLdapConfig();
  if (!cfg.url || !cfg.bindDN) {
    result.errors.push('Active Directory غير مُعد');
    return result;
  }

  try {
    const ldapUsers = await searchLdapUsers(cfg, '*');
    if (ldapUsers.length === 0) {
      result.errors.push('لم يتم العثور على مستخدمين في Active Directory');
      return result;
    }

    const existingUsers: Array<{ id: number; email: string }> = await db.select({ id: users.id, email: users.email }).from(users) as any;
    const existingEmailMap = new Map<string, number>(
      existingUsers.filter((u: { id: number; email: string }) => u.id != null).map((u: { id: number; email: string }) => [u.email.toLowerCase(), u.id])
    );

    for (const ldapUser of ldapUsers) {
      try {
        const email = ldapUser.email.toLowerCase();
        const existingId = existingEmailMap.get(email);
        if (existingId !== undefined) {
          await db.update(users)
            .set({ name: ldapUser.displayName, jobTitle: ldapUser.title || null, updatedAt: new Date() })
            .where(eq(users.id, existingId));
          result.updated++;
        } else {
          const tempPassword = await bcrypt.hash(`AD_${Date.now()}_${Math.random()}`, 12);
          await db.insert(users).values({
            email,
            name: ldapUser.displayName || ldapUser.username,
            role: 'it_support_staff',
            portal: 'support',
            passwordHash: tempPassword,
            jobTitle: ldapUser.title || null,
            isActive: true,
            isActivated: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          result.created++;
        }
        result.synced++;
      } catch (userErr: any) {
        result.errors.push(`خطأ في مزامنة ${ldapUser.email}: ${userErr.message}`);
      }
    }

    result.success = true;
  } catch (err: any) {
    result.errors.push(err.message);
  }

  return result;
}

export async function authenticateLdapUser(username: string, password: string, config?: LdapConfig): Promise<LdapAuthResult> {
  const cfg = config || (await getAdConfigFromDb()) || buildLdapConfig();

  return new Promise((resolve) => {
    const client = createLdapClient(cfg);

    const timeout = setTimeout(() => {
      client.destroy();
      resolve({ success: false, error: 'انتهت مهلة الاتصال' });
    }, 8000);

    client.on('error', (err: Error) => {
      clearTimeout(timeout);
      resolve({ success: false, error: err.message });
    });

    const userDN = `${cfg.usernameAttribute}=${username},${cfg.userSearchBase || cfg.baseDN}`;
    client.bind(userDN, password, (err: any) => {
      clearTimeout(timeout);
      client.destroy();
      if (err) {
        resolve({ success: false, error: 'بيانات الاعتماد غير صحيحة' });
      } else {
        resolve({
          success: true,
          user: {
            username,
            email: `${username}@jcsa.sa`,
            displayName: username,
          }
        });
      }
    });
  });
}

export async function getLdapUserGroups(username: string): Promise<string[]> {
  return [];
}

export function mapLdapRoleToPortal(groups: string[]): { role: string; portal: string } {
  const groupRoleMap: Record<string, { role: string; portal: string }> = {
    'IT-Admins': { role: 'system_admin', portal: 'admin' },
    'IT-Directors': { role: 'it_director', portal: 'it_director' },
    'IT-Infrastructure': { role: 'it_infrastructure_staff', portal: 'infrastructure' },
    'IT-Cybersecurity': { role: 'it_cybersecurity_staff', portal: 'cybersecurity' },
    'IT-Support': { role: 'it_support_staff', portal: 'support' },
    'DMO-Team': { role: 'dmo_staff', portal: 'dmo' },
    'Committee-Members': { role: 'committee_member', portal: 'committee' },
  };
  for (const group of groups) {
    if (groupRoleMap[group]) return groupRoleMap[group];
  }
  return { role: 'it_support_staff', portal: 'support' };
}

export async function provisionLdapUser(ldapUser: LdapUser): Promise<{ success: boolean; userId?: number; error?: string }> {
  try {
    const email = ldapUser.email.endsWith('@jcsa.sa') ? ldapUser.email : `${ldapUser.username}@jcsa.sa`;
    const { role, portal } = mapLdapRoleToPortal(ldapUser.groups || []);
    const tempPassword = await bcrypt.hash(`LDAP_${Date.now()}`, 12);
    const [newUser] = await db.insert(users).values({
      email,
      name: ldapUser.displayName,
      role,
      portal,
      passwordHash: tempPassword,
      jobTitle: ldapUser.title || null,
      isActive: true,
      isActivated: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return { success: true, userId: newUser.id };
  } catch (error: any) {
    return { success: false, error: 'فشل إنشاء المستخدم' };
  }
}
