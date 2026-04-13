import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';
import { logger } from './security-middleware';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Control Hub API - نظام الحوكمة والامتثال',
      version: '1.0.0',
      description: 'API documentation for Control Hub - JCSA Governance Platform',
      contact: {
        name: 'JCSA IT Department',
        email: 'it@jcsa.sa'
      },
      license: {
        name: 'Proprietary',
        url: 'https://jcsa.sa'
      }
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production' 
          ? 'https://controlhub.jcsa.sa' 
          : 'http://localhost:5000',
        description: process.env.NODE_ENV === 'production' 
          ? 'Production Server' 
          : 'Development Server'
      }
    ],
    tags: [
      { name: 'Authentication', description: 'تسجيل الدخول والمصادقة' },
      { name: 'Users', description: 'إدارة المستخدمين' },
      { name: 'Departments', description: 'إدارة الأقسام' },
      { name: 'IT Departments', description: 'الإدارات التقنية' },
      { name: 'Domains', description: 'مجالات الحوكمة' },
      { name: 'Requirements', description: 'متطلبات الامتثال' },
      { name: 'Evidences', description: 'الأدلة والشواهد' },
      { name: 'Tickets', description: 'التذاكر والدعم الفني' },
      { name: 'Projects', description: 'المشاريع التقنية' },
      { name: 'Committee', description: 'اللجان والقرارات' },
      { name: 'Meetings', description: 'الاجتماعات' },
      { name: 'Voting', description: 'التصويت' },
      { name: 'Reports', description: 'التقارير والإحصائيات' },
      { name: 'Notifications', description: 'الإشعارات' },
      { name: 'Audit', description: 'سجل التدقيق' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token'
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'session',
          description: 'Session cookie authentication'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string', example: 'خطأ في العملية' },
            details: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' }
                }
              }
            }
          }
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            email: { type: 'string', format: 'email', example: 'user@jcsa.sa' },
            name: { type: 'string', example: 'محمد أحمد' },
            nameEn: { type: 'string', example: 'Mohammed Ahmed' },
            phone: { type: 'string', example: '+966501234567' },
            role: { type: 'string', example: 'admin' },
            portal: { type: 'string', example: 'admin' },
            departmentId: { type: 'integer' },
            itDepartmentId: { type: 'integer' },
            jobTitle: { type: 'string' },
            avatar: { type: 'string' },
            isActive: { type: 'boolean' },
            isActivated: { type: 'boolean' },
            lastLoginAt: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'admin@jcsa.sa' },
            password: { type: 'string', format: 'password', example: '••••••••' }
          }
        },
        LoginResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            user: { $ref: '#/components/schemas/User' },
            token: { type: 'string' }
          }
        },
        Ticket: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            ticketNumber: { type: 'string', example: 'TKT-2024-0001' },
            title: { type: 'string' },
            description: { type: 'string' },
            requesterId: { type: 'integer' },
            assigneeId: { type: 'integer' },
            departmentId: { type: 'integer' },
            category: { type: 'string', enum: ['support', 'incident', 'request', 'change'] },
            priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
            status: { type: 'string', enum: ['open', 'in_progress', 'pending', 'resolved', 'closed'] },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        Project: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            code: { type: 'string' },
            nameAr: { type: 'string' },
            nameEn: { type: 'string' },
            description: { type: 'string' },
            departmentId: { type: 'integer' },
            itDepartmentId: { type: 'integer' },
            managerId: { type: 'integer' },
            status: { type: 'string', enum: ['planning', 'in_progress', 'on_hold', 'completed', 'cancelled'] },
            priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
            progress: { type: 'integer', minimum: 0, maximum: 100 },
            startDate: { type: 'string', format: 'date-time' },
            endDate: { type: 'string', format: 'date-time' },
            budget: { type: 'number' },
            actualCost: { type: 'number' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        Decision: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            decisionNumber: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string' },
            priority: { type: 'string' },
            status: { type: 'string', enum: ['draft', 'voting', 'approved', 'rejected', 'implemented'] },
            votesFor: { type: 'integer' },
            votesAgainst: { type: 'integer' },
            votesAbstain: { type: 'integer' },
            votingDeadline: { type: 'string', format: 'date-time' },
            implementationDeadline: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'array', items: {} },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'integer' },
                limit: { type: 'integer' },
                total: { type: 'integer' },
                totalPages: { type: 'integer' }
              }
            }
          }
        }
      }
    },
    security: [{ bearerAuth: [] }, { cookieAuth: [] }]
  },
  apis: ['./server/routes.ts', './server/routes/*.ts']
};

const specs = swaggerJsdoc(options);

export function setupSwagger(app: Express) {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_SWAGGER !== 'true') {
    logger.info('Swagger documentation disabled in production (set ENABLE_SWAGGER=true to enable)');
    return;
  }

  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(specs, {
    customSiteTitle: 'Control Hub API Documentation',
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info { margin: 30px 0 }
      .swagger-ui .info .title { font-family: system-ui, -apple-system, sans-serif }
    `,
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true
    }
  }));
  
  app.get('/api/docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });
  
  logger.info('Swagger documentation available at /api/docs');
}
