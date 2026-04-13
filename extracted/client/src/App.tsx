import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/lib/auth";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { lazy, Suspense, Component, ErrorInfo, ReactNode } from "react";
const SmartAssistant = lazy(() => import("@/components/SmartAssistant").then(m => ({ default: m.SmartAssistant })));
import { PageLoader } from "@/components/PageTransition";
import { PORTAL_ACCESS, DEFAULT_ROUTES, hasPortalAccess, getPortalDefaultRoute, USER_ROLES, IT_DEPT_PORTALS } from "@shared/constants";

const NotFound = lazy(() => import("@/pages/not-found"));
const Login = lazy(() => import("@/pages/Login"));
const Activate = lazy(() => import("@/pages/Activate"));
const DownloadPage = lazy(() => import("@/pages/Download"));
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));
const ITDirectorDashboard = lazy(() => import("@/pages/ITDirectorDashboard"));
const CommandCenter = lazy(() => import("@/pages/CommandCenter"));
const CybersecurityDashboard = lazy(() => import("@/pages/CybersecurityDashboard"));
const UsersManagement = lazy(() => import("@/pages/UsersManagement"));
const AuditLogs = lazy(() => import("@/pages/AuditLogs"));
const ReportsExport = lazy(() => import("@/pages/ReportsExport"));
const SessionsManagement = lazy(() => import("@/pages/SessionsManagement"));
const ProjectsManagement = lazy(() => import("@/pages/ProjectsManagement"));
const TicketsManagement = lazy(() => import("@/pages/TicketsManagement"));
const EscalationsManagement = lazy(() => import("@/pages/EscalationsManagement"));
const ITAssetsManagement = lazy(() => import("@/pages/ITAssetsManagement"));
const KPIsManagement = lazy(() => import("@/pages/KPIsManagement"));
const TeamsManagement = lazy(() => import("@/pages/TeamsManagement"));
const VendorManagement = lazy(() => import("@/pages/VendorManagement"));
const ExternalSystemsManagement = lazy(() => import("@/pages/ExternalSystemsManagement"));
const DMOPortal = lazy(() => import("@/pages/DMOPortal"));
const ConsentManagement = lazy(() => import("@/pages/ConsentManagement"));
const ITDepartmentInfrastructure = lazy(() => import("@/pages/ITDepartmentInfrastructure"));
const ITDepartmentDigitalTransformation = lazy(() => import("@/pages/ITDepartmentDigitalTransformation"));
const ITDepartmentSupport = lazy(() => import("@/pages/ITDepartmentSupport"));
const CommitteePortal = lazy(() => import("@/pages/CommitteePortal"));
const SystemApprovalsManagement = lazy(() => import("@/pages/SystemApprovalsManagement"));
const DepartmentExternalSystems = lazy(() => import("@/pages/DepartmentExternalSystems"));
const EmailIntegrationPage = lazy(() => import("@/pages/EmailIntegrationPage"));
const ActiveDirectoryPage = lazy(() => import("@/pages/ActiveDirectoryPage"));
const SystemsStatusView = lazy(() => import("@/pages/SystemsStatusView"));
const BusinessDepartmentsManagement = lazy(() => import("@/pages/BusinessDepartmentsManagement"));
const SLAManagement = lazy(() => import("@/components/SLAManagement"));
const KnowledgeBase = lazy(() => import("@/components/KnowledgeBase"));
const DocumentManagement = lazy(() => import("@/components/DocumentManagement"));
const DataRepresentativePortal = lazy(() => import("@/pages/DataRepresentativePortal"));
const DataStewardPortal = lazy(() => import("@/pages/DataStewardPortal"));
const InfrastructureServers = lazy(() => import("@/pages/InfrastructureServers"));
const InfrastructureNetwork = lazy(() => import("@/pages/InfrastructureNetwork"));
const InfrastructureStorage = lazy(() => import("@/pages/InfrastructureStorage"));
const InfrastructureMonitoring = lazy(() => import("@/pages/InfrastructureMonitoring"));
const InfrastructureTasks = lazy(() => import("@/pages/InfrastructureTasks"));
const InfrastructureProjects = lazy(() => import("@/pages/InfrastructureProjects"));
const SupportTicketsPage = lazy(() => import("@/pages/SupportTicketsPage"));
const CybersecurityThreats = lazy(() => import("@/pages/CybersecurityThreats"));
const SecurityIncidentsPage = lazy(() => import("@/pages/SecurityIncidentsPage"));
const SecurityVulnerabilitiesPage = lazy(() => import("@/pages/SecurityVulnerabilitiesPage"));
const DataCatalogPage = lazy(() => import("@/pages/DataCatalogPage"));
const DepartmentAssetsPage = lazy(() => import("@/pages/DepartmentAssetsPage"));
const DigitalInitiatives = lazy(() => import("@/pages/DigitalInitiatives"));
const DigitalApplicationsPage = lazy(() => import("@/pages/DigitalApplicationsPage"));
const CloudServicesPage = lazy(() => import("@/pages/CloudServicesPage"));
const CommitteeDecisions = lazy(() => import("@/pages/CommitteeDecisions"));
const CommitteeMeetings = lazy(() => import("@/pages/CommitteeMeetings"));
const CommitteeMembers = lazy(() => import("@/pages/CommitteeMembers"));
const CommitteeVoting = lazy(() => import("@/pages/CommitteeVoting"));
const CommitteeMinutes = lazy(() => import("@/pages/CommitteeMinutes"));
const CommitteeTasks = lazy(() => import("@/pages/CommitteeTasks"));
const CommitteeSettings = lazy(() => import("@/pages/CommitteeSettings"));
const ITReferrals = lazy(() => import("@/pages/ITReferrals"));
const ITDirectorTasks = lazy(() => import("@/pages/ITDirectorTasks"));
const CybersecurityTasks = lazy(() => import("@/pages/CybersecurityTasks"));
const CybersecurityTickets = lazy(() => import("@/pages/CybersecurityTickets"));
const CybersecurityProjects = lazy(() => import("@/pages/CybersecurityProjects"));
const DigitalTransformationProjects = lazy(() => import("@/pages/DigitalTransformationProjects"));
const SupportProjects = lazy(() => import("@/pages/SupportProjects"));
const DigitalTransformationTasks = lazy(() => import("@/pages/DigitalTransformationTasks"));
const DigitalTransformationTickets = lazy(() => import("@/pages/DigitalTransformationTickets"));
const DataAgreementsPage = lazy(() => import("@/pages/DataAgreementsPage"));
const SupportTasks = lazy(() => import("@/pages/SupportTasks"));
const InfrastructureTickets = lazy(() => import("@/pages/InfrastructureTickets"));
const EmployeePortal = lazy(() => import("@/pages/EmployeePortal"));
const DepartmentReferrals = lazy(() => import("@/pages/DepartmentReferrals"));
const DMOTasks = lazy(() => import("@/pages/DMOTasks"));
const DMOTickets = lazy(() => import("@/pages/DMOTickets"));
const FeatureRequestPage = lazy(() => import("@/pages/FeatureRequestPage"));
const AdminFeatureRequestsPage = lazy(() => import("@/pages/AdminFeatureRequestsPage"));
const RegulatoryCompliancePage = lazy(() => import("@/pages/RegulatoryCompliancePage"));
const PlannerBoard = lazy(() => import("@/pages/PlannerBoard"));
const ComplianceDashboard = lazy(() => import("@/pages/ComplianceDashboard"));
const DepartmentEmployees = lazy(() => import("@/pages/DepartmentEmployees"));
const ExecutiveKPI = lazy(() => import("@/pages/ExecutiveKPI"));
const ChangePassword = lazy(() => import("@/pages/ChangePassword"));
const AlertRulesManagement = lazy(() => import("@/pages/AlertRulesManagement"));
const TicketTemplatesManagement = lazy(() => import("@/pages/TicketTemplatesManagement"));
const AutomationRulesManagement = lazy(() => import("@/pages/AutomationRulesManagement"));
const ExternalDataSharingRequests = lazy(() => import("@/pages/ExternalDataSharingRequests"));

import {
  CYBERSECURITY_DEPT_ID,
  INFRASTRUCTURE_DEPT_ID,
  DIGITAL_TRANSFORMATION_DEPT_ID,
  SUPPORT_DEPT_ID,
  DMO_DEPARTMENT_ID,
  itDirectorNavItems,
  cybersecurityNavItems,
  infrastructureNavItems,
  digitalTransformationNavItems,
  supportNavItems,
  dmoNavItems,
  committeeNavItems,
  itDirectorNavGroups,
  cybersecurityNavGroups,
  infrastructureNavGroups,
  digitalTransformationNavGroups,
  supportNavGroups,
  dmoNavGroups,
  adminNavGroups,
  committeeNavGroups,
} from "@/lib/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldX, ArrowRight, LayoutDashboard, KanbanSquare } from "lucide-react";
import { useLocation as useWouterLocation } from "wouter";

const employeeNavGroups = [
  {
    label: 'الرئيسية',
    items: [
      { title: 'لوحة التحكم', href: '/employee', icon: LayoutDashboard },
      { title: 'مهامي', href: '/employee/planner', icon: KanbanSquare },
    ],
  },
];

function AccessDenied({ userPortal }: { userPortal?: string }) {
  const defaultRoute = getDefaultRoute(userPortal);
  const [, navigate] = useWouterLocation();
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(222_47%_8%)] via-[hsl(222_47%_11%)] to-[hsl(222_40%_14%)] p-4" dir="rtl">
      <Card className="max-w-md w-full border-[hsl(43_74%_49%)]/20 bg-[hsl(222_47%_13%)]/95 backdrop-blur-xl" data-testid="card-access-denied">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto p-4 rounded-full hub-icon-gold">
            <ShieldX className="w-12 h-12 hub-stat-gold" />
          </div>
          <CardTitle className="text-xl font-bold text-white" data-testid="text-access-denied-title">
            عذراً، لا يوجد صلاحية
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <p className="text-white/60 leading-relaxed" data-testid="text-access-denied-message">
            لا يوجد صلاحية للوصول لهذه الصفحة.
            <br />
            نأمل منك العودة إلى الصفحات المصرح لك الوصول لها.
          </p>
          <div className="flex flex-col gap-3 items-center">
            <Button 
              variant="gold" 
              className="gap-2"
              onClick={() => navigate(defaultRoute)}
              data-testid="button-return-to-portal"
            >
              <ArrowRight className="w-4 h-4" />
              العودة للوحة التحكم
            </Button>
            <Button
              variant="ghost"
              className="text-white/50 hover:text-white gap-2"
              onClick={() => window.history.back()}
              data-testid="button-go-back"
            >
              العودة للصفحة السابقة
            </Button>
          </div>
          <p className="text-xs text-white/30">
            Control Hub - JCSA
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ProtectedRoute({ 
  component: Component, 
  allowedPortals,
  ...rest 
}: { 
  component: React.ComponentType<any>; 
  path?: string;
  allowedPortals?: string[];
}) {
  const { isAuthenticated, user } = useAuth();
  
  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  if (user?.mustChangePassword) {
    return <Redirect to="/change-password" />;
  }
  
  if (allowedPortals && allowedPortals.length > 0) {
    const userPortal = user?.portal;
    const isCommitteePage = allowedPortals === COMMITTEE_PORTALS;
    const userIsCommitteeMember = (user as any)?.isCommitteeMember === true;
    if (!userPortal || (!hasPortalAccess(userPortal, allowedPortals) && !(isCommitteePage && userIsCommitteeMember))) {
      return <AccessDenied userPortal={userPortal} />;
    }
  }
  
  return <Component {...rest} />;
}

// Portal access constants - imported from shared/constants.ts for consistency
const { 
  ADMIN_PORTALS, 
  IT_DIRECTOR_PORTALS, 
  DMO_PORTALS, 
  COMMITTEE_PORTALS, 
  DATA_REP_PORTALS,
  STEWARD_PORTALS,
  DEPARTMENT_PORTALS,
  CYBERSECURITY_PORTALS,
  INFRASTRUCTURE_PORTALS,
  DIGITAL_TRANSFORMATION_PORTALS,
  SUPPORT_PORTALS,
  EMPLOYEE_PORTALS
} = PORTAL_ACCESS;

function Router() {
  const { isAuthenticated, user } = useAuth();

  return (
    <Switch>
      <Route path="/activate">
        <Activate />
      </Route>
      <Route path="/download">
        <DownloadPage />
      </Route>
      <Route path="/change-password">
        {isAuthenticated ? <ChangePassword /> : <Redirect to="/login" />}
      </Route>
      <Route path="/login">
        {isAuthenticated ? (
          <Redirect to={getDefaultRoute(user?.portal)} />
        ) : (
          <Login />
        )}
      </Route>
      
      <Route path="/">
        {isAuthenticated ? (
          <Redirect to={getDefaultRoute(user?.portal)} />
        ) : (
          <Redirect to="/login" />
        )}
      </Route>

      {/* Admin Portal Routes - Only for admin users */}
      <Route path="/admin">
        <ProtectedRoute component={AdminDashboard} allowedPortals={ADMIN_PORTALS} />
      </Route>
      
      <Route path="/admin/users">
        <ProtectedRoute component={UsersManagement} allowedPortals={ADMIN_PORTALS} />
      </Route>
      
      <Route path="/admin/departments">
        <ProtectedRoute component={BusinessDepartmentsManagement} allowedPortals={ADMIN_PORTALS} />
      </Route>
      
      <Route path="/admin/audit">
        <ProtectedRoute component={AuditLogs} allowedPortals={ADMIN_PORTALS} />
      </Route>
      <Route path="/admin/reports">
        <ProtectedRoute component={ReportsExport} allowedPortals={ADMIN_PORTALS} />
      </Route>
      
      <Route path="/admin/sessions">
        <ProtectedRoute component={SessionsManagement} allowedPortals={ADMIN_PORTALS} />
      </Route>
      
      <Route path="/admin/systems-status">
        <ProtectedRoute component={SystemsStatusView} allowedPortals={ADMIN_PORTALS} />
      </Route>
      
      <Route path="/admin/escalations">
        <ProtectedRoute component={EscalationsManagement} allowedPortals={ADMIN_PORTALS} />
      </Route>

      <Route path="/admin/alert-rules">
        <ProtectedRoute component={AlertRulesManagement} allowedPortals={ADMIN_PORTALS} />
      </Route>

      <Route path="/admin/ticket-templates">
        <ProtectedRoute component={TicketTemplatesManagement} allowedPortals={ADMIN_PORTALS} />
      </Route>

      <Route path="/admin/automation-rules">
        <ProtectedRoute component={AutomationRulesManagement} allowedPortals={ADMIN_PORTALS} />
      </Route>

      <Route path="/admin/kpi">
        <ProtectedRoute component={ExecutiveKPI} allowedPortals={ADMIN_PORTALS} />
      </Route>

      <Route path="/admin/feature-requests">
        <ProtectedRoute component={AdminFeatureRequestsPage} allowedPortals={ADMIN_PORTALS} />
      </Route>

      <Route path="/admin/planner">
        <ProtectedRoute component={() => <PlannerBoard portal="admin" navGroups={adminNavGroups} />} allowedPortals={ADMIN_PORTALS} />
      </Route>
      
      <Route path="/admin/:rest*">
        <ProtectedRoute component={AdminDashboard} allowedPortals={ADMIN_PORTALS} />
      </Route>

      {/* IT Director Portal Routes - Only for IT Director users */}
      <Route path="/it-director">
        <ProtectedRoute component={ITDirectorDashboard} allowedPortals={IT_DIRECTOR_PORTALS} />
      </Route>

      <Route path="/it-director/command-center">
        <ProtectedRoute component={CommandCenter} allowedPortals={IT_DIRECTOR_PORTALS} />
      </Route>
      
      <Route path="/it-director/tasks">
        <ProtectedRoute component={ITDirectorTasks} allowedPortals={IT_DIRECTOR_PORTALS} />
      </Route>
      
      <Route path="/it-director/planner">
        <ProtectedRoute component={() => <PlannerBoard portal="it_director" navGroups={itDirectorNavGroups} />} allowedPortals={IT_DIRECTOR_PORTALS} />
      </Route>
      
      <Route path="/it-director/projects">
        <ProtectedRoute component={ProjectsManagement} allowedPortals={IT_DIRECTOR_PORTALS} />
      </Route>
      
      <Route path="/it-director/tickets">
        <ProtectedRoute component={TicketsManagement} allowedPortals={IT_DIRECTOR_PORTALS} />
      </Route>
      
      <Route path="/it-director/escalations">
        <ProtectedRoute component={EscalationsManagement} allowedPortals={IT_DIRECTOR_PORTALS} />
      </Route>
      
      <Route path="/it-director/assets">
        <ProtectedRoute component={ITAssetsManagement} allowedPortals={IT_DIRECTOR_PORTALS} />
      </Route>
      
      <Route path="/it-director/kpis">
        <ProtectedRoute component={KPIsManagement} allowedPortals={IT_DIRECTOR_PORTALS} />
      </Route>
      
      <Route path="/it-director/teams">
        <ProtectedRoute component={TeamsManagement} allowedPortals={IT_DIRECTOR_PORTALS} />
      </Route>
      
      <Route path="/it-director/vendors">
        <ProtectedRoute component={VendorManagement} allowedPortals={IT_DIRECTOR_PORTALS} />
      </Route>
      
      <Route path="/it-director/external-systems">
        <ProtectedRoute component={ExternalSystemsManagement} allowedPortals={IT_DIRECTOR_PORTALS} />
      </Route>
      
      <Route path="/it-director/system-approvals">
        <ProtectedRoute 
          component={() => <SystemApprovalsManagement navItems={itDirectorNavItems} navGroups={itDirectorNavGroups} />}
          allowedPortals={IT_DIRECTOR_PORTALS}
        />
      </Route>
      <Route path="/it-director/email-integration">
        <ProtectedRoute component={() => <EmailIntegrationPage portal="it_director" />} allowedPortals={IT_DIRECTOR_PORTALS} />
      </Route>

      <Route path="/it-director/alert-rules">
        <ProtectedRoute component={AlertRulesManagement} allowedPortals={IT_DIRECTOR_PORTALS} />
      </Route>

      <Route path="/it-director/ticket-templates">
        <ProtectedRoute component={TicketTemplatesManagement} allowedPortals={IT_DIRECTOR_PORTALS} />
      </Route>

      <Route path="/it-director/automation-rules">
        <ProtectedRoute component={AutomationRulesManagement} allowedPortals={IT_DIRECTOR_PORTALS} />
      </Route>
      
      <Route path="/it-director/referrals">
        <ProtectedRoute component={ITReferrals} allowedPortals={IT_DIRECTOR_PORTALS} />
      </Route>
      
      <Route path="/it-director/kpi">
        <ProtectedRoute component={ExecutiveKPI} allowedPortals={IT_DIRECTOR_PORTALS} />
      </Route>

      <Route path="/it-director/sla">
        <ProtectedRoute 
          component={() => <SLAManagement departmentId={0} departmentName="جميع الأقسام" navGroups={itDirectorNavGroups} basePath="/it-director" />}
          allowedPortals={IT_DIRECTOR_PORTALS}
        />
      </Route>
      
      <Route path="/it-director/feature-requests">
        <ProtectedRoute 
          component={() => <FeatureRequestPage navGroups={itDirectorNavGroups} portalName="مدير تقنية المعلومات" portalId="it_director" />}
          allowedPortals={IT_DIRECTOR_PORTALS}
        />
      </Route>
      <Route path="/it-director/compliance-dashboard">
        <ProtectedRoute 
          component={() => <ComplianceDashboard navGroups={itDirectorNavGroups} portalName="مدير تقنية المعلومات" />}
          allowedPortals={IT_DIRECTOR_PORTALS}
        />
      </Route>
      
      <Route path="/it-director/:rest*">
        <ProtectedRoute component={ITDirectorDashboard} allowedPortals={IT_DIRECTOR_PORTALS} />
      </Route>

      <Route path="/department/cybersecurity/threats">
        <ProtectedRoute component={CybersecurityThreats} allowedPortals={CYBERSECURITY_PORTALS} />
      </Route>
      
      <Route path="/department/cybersecurity/incidents">
        <ProtectedRoute component={SecurityIncidentsPage} allowedPortals={CYBERSECURITY_PORTALS} />
      </Route>
      
      <Route path="/department/cybersecurity/vulnerabilities">
        <ProtectedRoute component={SecurityVulnerabilitiesPage} allowedPortals={CYBERSECURITY_PORTALS} />
      </Route>
      
      <Route path="/department/cybersecurity/assets">
        <ProtectedRoute 
          component={() => <DepartmentAssetsPage departmentId={CYBERSECURITY_DEPT_ID} departmentName="الأمن السيبراني" navItems={cybersecurityNavItems} navGroups={cybersecurityNavGroups} portalName="الأمن السيبراني" />}
          allowedPortals={CYBERSECURITY_PORTALS}
        />
      </Route>

      <Route path="/department/cybersecurity/sla">
        <ProtectedRoute 
          component={() => <SLAManagement departmentId={CYBERSECURITY_DEPT_ID} departmentName="الأمن السيبراني" navGroups={cybersecurityNavGroups} basePath="/department/cybersecurity" />}
          allowedPortals={CYBERSECURITY_PORTALS}
        />
      </Route>
      
      <Route path="/department/cybersecurity/knowledge-base">
        <ProtectedRoute 
          component={() => <KnowledgeBase departmentId={CYBERSECURITY_DEPT_ID} departmentName="الأمن السيبراني" navGroups={cybersecurityNavGroups} basePath="/department/cybersecurity" />}
          allowedPortals={CYBERSECURITY_PORTALS}
        />
      </Route>
      
      <Route path="/department/cybersecurity/documents">
        <ProtectedRoute 
          component={() => <DocumentManagement departmentId={CYBERSECURITY_DEPT_ID} departmentName="الأمن السيبراني" navGroups={cybersecurityNavGroups} portalName="الأمن السيبراني" />}
          allowedPortals={CYBERSECURITY_PORTALS}
        />
      </Route>
      
      <Route path="/department/cybersecurity/api-settings">
        <ProtectedRoute 
          component={() => <DepartmentExternalSystems departmentId={CYBERSECURITY_DEPT_ID} departmentName="الأمن السيبراني" navItems={cybersecurityNavItems} navGroups={cybersecurityNavGroups} basePath="/department/cybersecurity" />}
          allowedPortals={CYBERSECURITY_PORTALS}
        />
      </Route>

      <Route path="/department/cybersecurity/kpis">
        <ProtectedRoute 
          component={() => <KPIsManagement portalName="الأمن السيبراني" navGroups={cybersecurityNavGroups} departmentId={CYBERSECURITY_DEPT_ID} />}
          allowedPortals={CYBERSECURITY_PORTALS}
        />
      </Route>

      <Route path="/department/cybersecurity/kpi">
        <ProtectedRoute component={ExecutiveKPI} allowedPortals={CYBERSECURITY_PORTALS} />
      </Route>

      <Route path="/department/cybersecurity/tasks">
        <ProtectedRoute component={CybersecurityTasks} allowedPortals={CYBERSECURITY_PORTALS} />
      </Route>
      <Route path="/department/cybersecurity/planner">
        <ProtectedRoute component={() => <PlannerBoard portal="cybersecurity" navGroups={cybersecurityNavGroups} departmentId={CYBERSECURITY_DEPT_ID} />} allowedPortals={CYBERSECURITY_PORTALS} />
      </Route>
      <Route path="/department/cybersecurity/tickets">
        <ProtectedRoute component={CybersecurityTickets} allowedPortals={CYBERSECURITY_PORTALS} />
      </Route>
      <Route path="/department/cybersecurity/projects">
        <ProtectedRoute component={CybersecurityProjects} allowedPortals={CYBERSECURITY_PORTALS} />
      </Route>
      <Route path="/department/cybersecurity/referrals">
        <ProtectedRoute 
          component={() => <DepartmentReferrals departmentId={CYBERSECURITY_DEPT_ID} departmentName="الأمن السيبراني" navGroups={cybersecurityNavGroups} />}
          allowedPortals={CYBERSECURITY_PORTALS}
        />
      </Route>
      
      <Route path="/department/cybersecurity/regulatory-compliance">
        <ProtectedRoute 
          component={() => <RegulatoryCompliancePage navGroups={cybersecurityNavGroups} portalName="الأمن السيبراني" portalId="cybersecurity" regulatoryBody="NCA" regulatoryBodyLabel="الهيئة الوطنية للأمن السيبراني" />}
          allowedPortals={CYBERSECURITY_PORTALS}
        />
      </Route>
      
      <Route path="/department/cybersecurity/feature-requests">
        <ProtectedRoute 
          component={() => <FeatureRequestPage navGroups={cybersecurityNavGroups} portalName="الأمن السيبراني" portalId="cybersecurity" />}
          allowedPortals={CYBERSECURITY_PORTALS}
        />
      </Route>
      <Route path="/department/cybersecurity/employees">
        <ProtectedRoute 
          component={() => <DepartmentEmployees navGroups={cybersecurityNavGroups} portalName="الأمن السيبراني" />}
          allowedPortals={CYBERSECURITY_PORTALS}
        />
      </Route>
      
      <Route path="/department/cybersecurity">
        <ProtectedRoute component={CybersecurityDashboard} allowedPortals={CYBERSECURITY_PORTALS} />
      </Route>
      
      <Route path="/department/cybersecurity/:rest*">
        <ProtectedRoute component={CybersecurityDashboard} allowedPortals={CYBERSECURITY_PORTALS} />
      </Route>

      <Route path="/department/infrastructure/servers">
        <ProtectedRoute component={InfrastructureServers} allowedPortals={INFRASTRUCTURE_PORTALS} />
      </Route>
      
      <Route path="/department/infrastructure/network">
        <ProtectedRoute component={InfrastructureNetwork} allowedPortals={INFRASTRUCTURE_PORTALS} />
      </Route>
      
      <Route path="/department/infrastructure/storage">
        <ProtectedRoute component={InfrastructureStorage} allowedPortals={INFRASTRUCTURE_PORTALS} />
      </Route>
      
      <Route path="/department/infrastructure/monitoring">
        <ProtectedRoute component={InfrastructureMonitoring} allowedPortals={INFRASTRUCTURE_PORTALS} />
      </Route>
      
      <Route path="/department/infrastructure/tasks">
        <ProtectedRoute component={InfrastructureTasks} allowedPortals={INFRASTRUCTURE_PORTALS} />
      </Route>
      <Route path="/department/infrastructure/planner">
        <ProtectedRoute component={() => <PlannerBoard portal="infrastructure" navGroups={infrastructureNavGroups} departmentId={INFRASTRUCTURE_DEPT_ID} />} allowedPortals={INFRASTRUCTURE_PORTALS} />
      </Route>

      <Route path="/department/infrastructure/tickets">
        <ProtectedRoute component={InfrastructureTickets} allowedPortals={INFRASTRUCTURE_PORTALS} />
      </Route>

      <Route path="/department/infrastructure/projects">
        <ProtectedRoute component={InfrastructureProjects} allowedPortals={INFRASTRUCTURE_PORTALS} />
      </Route>

      <Route path="/department/infrastructure/referrals">
        <ProtectedRoute 
          component={() => <DepartmentReferrals departmentId={INFRASTRUCTURE_DEPT_ID} departmentName="البنية التحتية" navGroups={infrastructureNavGroups} />}
          allowedPortals={INFRASTRUCTURE_PORTALS}
        />
      </Route>

      <Route path="/department/infrastructure/sla">
        <ProtectedRoute 
          component={() => <SLAManagement departmentId={INFRASTRUCTURE_DEPT_ID} departmentName="البنية التحتية" navGroups={infrastructureNavGroups} basePath="/department/infrastructure" />}
          allowedPortals={INFRASTRUCTURE_PORTALS}
        />
      </Route>
      
      <Route path="/department/infrastructure/kpi">
        <ProtectedRoute component={ExecutiveKPI} allowedPortals={INFRASTRUCTURE_PORTALS} />
      </Route>

      <Route path="/department/infrastructure/knowledge-base">
        <ProtectedRoute 
          component={() => <KnowledgeBase departmentId={INFRASTRUCTURE_DEPT_ID} departmentName="البنية التحتية" navGroups={infrastructureNavGroups} basePath="/department/infrastructure" />}
          allowedPortals={INFRASTRUCTURE_PORTALS}
        />
      </Route>
      
      <Route path="/department/infrastructure/documents">
        <ProtectedRoute 
          component={() => <DocumentManagement departmentId={INFRASTRUCTURE_DEPT_ID} departmentName="البنية التحتية" navGroups={infrastructureNavGroups} portalName="البنية التحتية" />}
          allowedPortals={INFRASTRUCTURE_PORTALS}
        />
      </Route>
      
      <Route path="/department/infrastructure/api-settings">
        <ProtectedRoute 
          component={() => <DepartmentExternalSystems departmentId={INFRASTRUCTURE_DEPT_ID} departmentName="البنية التحتية" navItems={infrastructureNavItems} navGroups={infrastructureNavGroups} basePath="/department/infrastructure" />}
          allowedPortals={INFRASTRUCTURE_PORTALS}
        />
      </Route>
      
      <Route path="/department/infrastructure/kpis">
        <ProtectedRoute 
          component={() => <KPIsManagement portalName="البنية التحتية" navGroups={infrastructureNavGroups} departmentId={INFRASTRUCTURE_DEPT_ID} />}
          allowedPortals={INFRASTRUCTURE_PORTALS}
        />
      </Route>

      <Route path="/department/infrastructure/assets">
        <ProtectedRoute 
          component={() => <DepartmentAssetsPage departmentId={INFRASTRUCTURE_DEPT_ID} departmentName="البنية التحتية" navItems={infrastructureNavItems} navGroups={infrastructureNavGroups} portalName="البنية التحتية" />}
          allowedPortals={INFRASTRUCTURE_PORTALS}
        />
      </Route>
      
      <Route path="/department/infrastructure/regulatory-compliance">
        <ProtectedRoute 
          component={() => <RegulatoryCompliancePage navGroups={infrastructureNavGroups} portalName="البنية التحتية" portalId="infrastructure" regulatoryBody="NCA" regulatoryBodyLabel="الهيئة الوطنية للأمن السيبراني" />}
          allowedPortals={INFRASTRUCTURE_PORTALS}
        />
      </Route>
      <Route path="/department/infrastructure/feature-requests">
        <ProtectedRoute 
          component={() => <FeatureRequestPage navGroups={infrastructureNavGroups} portalName="البنية التحتية" portalId="infrastructure" />}
          allowedPortals={INFRASTRUCTURE_PORTALS}
        />
      </Route>
      <Route path="/department/infrastructure/employees">
        <ProtectedRoute 
          component={() => <DepartmentEmployees navGroups={infrastructureNavGroups} portalName="البنية التحتية" />}
          allowedPortals={INFRASTRUCTURE_PORTALS}
        />
      </Route>
      
      <Route path="/department/infrastructure">
        <ProtectedRoute component={ITDepartmentInfrastructure} allowedPortals={INFRASTRUCTURE_PORTALS} />
      </Route>
      
      <Route path="/department/infrastructure/:rest*">
        <ProtectedRoute component={ITDepartmentInfrastructure} allowedPortals={INFRASTRUCTURE_PORTALS} />
      </Route>

      <Route path="/department/digital-transformation/initiatives">
        <ProtectedRoute component={DigitalInitiatives} allowedPortals={DIGITAL_TRANSFORMATION_PORTALS} />
      </Route>
      
      <Route path="/department/digital-transformation/applications">
        <ProtectedRoute component={DigitalApplicationsPage} allowedPortals={DIGITAL_TRANSFORMATION_PORTALS} />
      </Route>
      
      <Route path="/department/digital-transformation/cloud">
        <ProtectedRoute component={CloudServicesPage} allowedPortals={DIGITAL_TRANSFORMATION_PORTALS} />
      </Route>
      
      <Route path="/department/digital-transformation/agreements">
        <ProtectedRoute 
          component={() => <DataAgreementsPage navGroups={digitalTransformationNavGroups} portalName="التحول الرقمي" />}
          allowedPortals={DIGITAL_TRANSFORMATION_PORTALS}
        />
      </Route>

      <Route path="/department/digital-transformation/assets">
        <ProtectedRoute 
          component={() => <DepartmentAssetsPage departmentId={DIGITAL_TRANSFORMATION_DEPT_ID} departmentName="التحول الرقمي" navItems={digitalTransformationNavItems} navGroups={digitalTransformationNavGroups} portalName="التحول الرقمي" />}
          allowedPortals={DIGITAL_TRANSFORMATION_PORTALS}
        />
      </Route>

      <Route path="/department/digital-transformation/sla">
        <ProtectedRoute 
          component={() => <SLAManagement departmentId={DIGITAL_TRANSFORMATION_DEPT_ID} departmentName="التحول الرقمي" navGroups={digitalTransformationNavGroups} basePath="/department/digital-transformation" />}
          allowedPortals={DIGITAL_TRANSFORMATION_PORTALS}
        />
      </Route>
      
      <Route path="/department/digital-transformation/knowledge-base">
        <ProtectedRoute 
          component={() => <KnowledgeBase departmentId={DIGITAL_TRANSFORMATION_DEPT_ID} departmentName="التحول الرقمي" navGroups={digitalTransformationNavGroups} basePath="/department/digital-transformation" />}
          allowedPortals={DIGITAL_TRANSFORMATION_PORTALS}
        />
      </Route>
      
      <Route path="/department/digital-transformation/documents">
        <ProtectedRoute 
          component={() => <DocumentManagement departmentId={DIGITAL_TRANSFORMATION_DEPT_ID} departmentName="التحول الرقمي" navGroups={digitalTransformationNavGroups} portalName="التحول الرقمي" />}
          allowedPortals={DIGITAL_TRANSFORMATION_PORTALS}
        />
      </Route>
      
      <Route path="/department/digital-transformation/api-settings">
        <ProtectedRoute 
          component={() => <DepartmentExternalSystems departmentId={DIGITAL_TRANSFORMATION_DEPT_ID} departmentName="التحول الرقمي" navItems={digitalTransformationNavItems} navGroups={digitalTransformationNavGroups} basePath="/department/digital-transformation" />}
          allowedPortals={DIGITAL_TRANSFORMATION_PORTALS}
        />
      </Route>

      <Route path="/department/digital-transformation/kpis">
        <ProtectedRoute 
          component={() => <KPIsManagement portalName="التحول الرقمي" navGroups={digitalTransformationNavGroups} departmentId={DIGITAL_TRANSFORMATION_DEPT_ID} />}
          allowedPortals={DIGITAL_TRANSFORMATION_PORTALS}
        />
      </Route>

      <Route path="/department/digital-transformation/tasks">
        <ProtectedRoute component={DigitalTransformationTasks} allowedPortals={DIGITAL_TRANSFORMATION_PORTALS} />
      </Route>
      <Route path="/department/digital-transformation/planner">
        <ProtectedRoute component={() => <PlannerBoard portal="digital_transformation" navGroups={digitalTransformationNavGroups} departmentId={DIGITAL_TRANSFORMATION_DEPT_ID} />} allowedPortals={DIGITAL_TRANSFORMATION_PORTALS} />
      </Route>
      <Route path="/department/digital-transformation/tickets">
        <ProtectedRoute component={DigitalTransformationTickets} allowedPortals={DIGITAL_TRANSFORMATION_PORTALS} />
      </Route>
      <Route path="/department/digital-transformation/projects">
        <ProtectedRoute component={DigitalTransformationProjects} allowedPortals={DIGITAL_TRANSFORMATION_PORTALS} />
      </Route>
      <Route path="/department/digital-transformation/referrals">
        <ProtectedRoute 
          component={() => <DepartmentReferrals departmentId={DIGITAL_TRANSFORMATION_DEPT_ID} departmentName="التحول الرقمي" navGroups={digitalTransformationNavGroups} />}
          allowedPortals={DIGITAL_TRANSFORMATION_PORTALS}
        />
      </Route>
      
      <Route path="/department/digital-transformation/regulatory-compliance">
        <ProtectedRoute 
          component={() => <RegulatoryCompliancePage navGroups={digitalTransformationNavGroups} portalName="التحول الرقمي" portalId="digital_transformation" regulatoryBody="DGA" regulatoryBodyLabel="هيئة الحكومة الرقمية" />}
          allowedPortals={DIGITAL_TRANSFORMATION_PORTALS}
        />
      </Route>
      
      <Route path="/department/digital-transformation/kpi">
        <ProtectedRoute component={ExecutiveKPI} allowedPortals={DIGITAL_TRANSFORMATION_PORTALS} />
      </Route>

      <Route path="/department/digital-transformation/feature-requests">
        <ProtectedRoute 
          component={() => <FeatureRequestPage navGroups={digitalTransformationNavGroups} portalName="التحول الرقمي" portalId="digital_transformation" />}
          allowedPortals={DIGITAL_TRANSFORMATION_PORTALS}
        />
      </Route>
      <Route path="/department/digital-transformation/employees">
        <ProtectedRoute 
          component={() => <DepartmentEmployees navGroups={digitalTransformationNavGroups} portalName="التحول الرقمي" />}
          allowedPortals={DIGITAL_TRANSFORMATION_PORTALS}
        />
      </Route>
      
      <Route path="/department/digital-transformation">
        <ProtectedRoute component={ITDepartmentDigitalTransformation} allowedPortals={DIGITAL_TRANSFORMATION_PORTALS} />
      </Route>
      
      <Route path="/department/digital-transformation/:rest*">
        <ProtectedRoute component={ITDepartmentDigitalTransformation} allowedPortals={DIGITAL_TRANSFORMATION_PORTALS} />
      </Route>

      <Route path="/department/support/tickets">
        <ProtectedRoute component={SupportTicketsPage} allowedPortals={SUPPORT_PORTALS} />
      </Route>

      <Route path="/department/support/sla">
        <ProtectedRoute 
          component={() => <SLAManagement departmentId={SUPPORT_DEPT_ID} departmentName="الدعم الفني" navGroups={supportNavGroups} basePath="/department/support" />}
          allowedPortals={SUPPORT_PORTALS}
        />
      </Route>
      
      <Route path="/department/support/knowledge-base">
        <ProtectedRoute 
          component={() => <KnowledgeBase departmentId={SUPPORT_DEPT_ID} departmentName="الدعم الفني" navGroups={supportNavGroups} basePath="/department/support" />}
          allowedPortals={SUPPORT_PORTALS}
        />
      </Route>
      
      <Route path="/department/support/documents">
        <ProtectedRoute 
          component={() => <DocumentManagement departmentId={SUPPORT_DEPT_ID} departmentName="الدعم الفني" navGroups={supportNavGroups} portalName="الدعم الفني" />}
          allowedPortals={SUPPORT_PORTALS}
        />
      </Route>
      
      <Route path="/department/support/api-settings">
        <ProtectedRoute 
          component={() => <DepartmentExternalSystems departmentId={SUPPORT_DEPT_ID} departmentName="الدعم الفني" navItems={supportNavItems} navGroups={supportNavGroups} basePath="/department/support" />}
          allowedPortals={SUPPORT_PORTALS}
        />
      </Route>
      <Route path="/department/support/email-integration">
        <ProtectedRoute component={() => <EmailIntegrationPage portal="support" />} allowedPortals={SUPPORT_PORTALS} />
      </Route>
      <Route path="/department/support/active-directory">
        <ProtectedRoute component={() => <ActiveDirectoryPage navGroups={supportNavGroups} />} allowedPortals={SUPPORT_PORTALS} />
      </Route>

      <Route path="/department/support/kpis">
        <ProtectedRoute 
          component={() => <KPIsManagement portalName="الدعم الفني" navGroups={supportNavGroups} departmentId={SUPPORT_DEPT_ID} />}
          allowedPortals={SUPPORT_PORTALS}
        />
      </Route>

      <Route path="/department/support/tasks">
        <ProtectedRoute component={SupportTasks} allowedPortals={SUPPORT_PORTALS} />
      </Route>
      <Route path="/department/support/projects">
        <ProtectedRoute component={SupportProjects} allowedPortals={SUPPORT_PORTALS} />
      </Route>
      <Route path="/department/support/planner">
        <ProtectedRoute component={() => <PlannerBoard portal="support" navGroups={supportNavGroups} departmentId={SUPPORT_DEPT_ID} />} allowedPortals={SUPPORT_PORTALS} />
      </Route>
      <Route path="/department/support/referrals">
        <ProtectedRoute 
          component={() => <DepartmentReferrals departmentId={SUPPORT_DEPT_ID} departmentName="الدعم الفني" navGroups={supportNavGroups} />}
          allowedPortals={SUPPORT_PORTALS}
        />
      </Route>
      
      <Route path="/department/support/assets">
        <ProtectedRoute 
          component={() => <DepartmentAssetsPage departmentId={SUPPORT_DEPT_ID} departmentName="الدعم الفني" navItems={supportNavItems} navGroups={supportNavGroups} portalName="الدعم الفني" />}
          allowedPortals={SUPPORT_PORTALS}
        />
      </Route>
      
      <Route path="/department/support/regulatory-compliance">
        <ProtectedRoute 
          component={() => <RegulatoryCompliancePage navGroups={supportNavGroups} portalName="الدعم الفني" portalId="support" regulatoryBody="NCA" regulatoryBodyLabel="الهيئة الوطنية للأمن السيبراني" />}
          allowedPortals={SUPPORT_PORTALS}
        />
      </Route>
      <Route path="/department/support/kpi">
        <ProtectedRoute component={ExecutiveKPI} allowedPortals={SUPPORT_PORTALS} />
      </Route>

      <Route path="/department/support/feature-requests">
        <ProtectedRoute 
          component={() => <FeatureRequestPage navGroups={supportNavGroups} portalName="الدعم الفني" portalId="support" />}
          allowedPortals={SUPPORT_PORTALS}
        />
      </Route>
      <Route path="/department/support/employees">
        <ProtectedRoute 
          component={() => <DepartmentEmployees navGroups={supportNavGroups} portalName="الدعم الفني" />}
          allowedPortals={SUPPORT_PORTALS}
        />
      </Route>
      
      <Route path="/department/support">
        <ProtectedRoute component={ITDepartmentSupport} allowedPortals={SUPPORT_PORTALS} />
      </Route>
      
      <Route path="/department/support/:rest*">
        <ProtectedRoute component={ITDepartmentSupport} allowedPortals={SUPPORT_PORTALS} />
      </Route>

      <Route path="/dmo/api-settings">
        <ProtectedRoute 
          component={() => <DepartmentExternalSystems departmentId={DMO_DEPARTMENT_ID} departmentName="مكتب إدارة البيانات" navItems={dmoNavItems} navGroups={dmoNavGroups} basePath="/dmo" />}
          allowedPortals={DMO_PORTALS}
        />
      </Route>

      <Route path="/dmo/planner">
        <ProtectedRoute component={() => <PlannerBoard portal="dmo" navGroups={dmoNavGroups} departmentId={DMO_DEPARTMENT_ID} />} allowedPortals={DMO_PORTALS} />
      </Route>

      <Route path="/dmo/data-catalog">
        <ProtectedRoute component={DataCatalogPage} allowedPortals={DMO_PORTALS} />
      </Route>

      <Route path="/dmo/knowledge-base">
        <ProtectedRoute 
          component={() => <KnowledgeBase departmentId={DMO_DEPARTMENT_ID} departmentName="مكتب إدارة البيانات" navGroups={dmoNavGroups} basePath="/dmo" />}
          allowedPortals={DMO_PORTALS}
        />
      </Route>

      <Route path="/dmo/documents">
        <ProtectedRoute 
          component={() => <DocumentManagement departmentId={DMO_DEPARTMENT_ID} departmentName="مكتب إدارة البيانات" navGroups={dmoNavGroups} portalName="مكتب إدارة البيانات" />}
          allowedPortals={DMO_PORTALS}
        />
      </Route>
      
      <Route path="/dmo/regulatory-compliance">
        <ProtectedRoute 
          component={() => <RegulatoryCompliancePage navGroups={dmoNavGroups} portalName="إدارة البيانات" portalId="dmo" regulatoryBody="NDMO" regulatoryBodyLabel="المكتب الوطني لإدارة البيانات" />}
          allowedPortals={DMO_PORTALS}
        />
      </Route>
      
      <Route path="/dmo/feature-requests">
        <ProtectedRoute 
          component={() => <FeatureRequestPage navGroups={dmoNavGroups} portalName="إدارة البيانات" portalId="dmo" />}
          allowedPortals={DMO_PORTALS}
        />
      </Route>
      <Route path="/dmo/employees">
        <ProtectedRoute 
          component={() => <DepartmentEmployees navGroups={dmoNavGroups} portalName="إدارة البيانات" />}
          allowedPortals={DMO_PORTALS}
        />
      </Route>

      <Route path="/dmo/tasks">
        <ProtectedRoute component={DMOTasks} allowedPortals={DMO_PORTALS} />
      </Route>
      <Route path="/dmo/tickets">
        <ProtectedRoute component={DMOTickets} allowedPortals={DMO_PORTALS} />
      </Route>
      <Route path="/dmo/referrals">
        <ProtectedRoute 
          component={() => <DepartmentReferrals departmentId={DMO_DEPARTMENT_ID} departmentName="مكتب إدارة البيانات" navGroups={dmoNavGroups} />}
          allowedPortals={DMO_PORTALS}
        />
      </Route>

      <Route path="/dmo/external-sharing">
        <ProtectedRoute component={ExternalDataSharingRequests} allowedPortals={DMO_PORTALS} />
      </Route>

      <Route path="/dmo/consent-management">
        <ProtectedRoute component={ConsentManagement} allowedPortals={DMO_PORTALS} />
      </Route>

      <Route path="/dmo/kpis">
        <ProtectedRoute
          component={() => <KPIsManagement portalName="مكتب إدارة البيانات" navGroups={dmoNavGroups} departmentId={DMO_DEPARTMENT_ID} />}
          allowedPortals={DMO_PORTALS}
        />
      </Route>
      <Route path="/dmo/kpi">
        <ProtectedRoute
          component={() => <KPIsManagement portalName="مكتب إدارة البيانات" navGroups={dmoNavGroups} departmentId={DMO_DEPARTMENT_ID} />}
          allowedPortals={DMO_PORTALS}
        />
      </Route>
      
      <Route path="/dmo">
        <ProtectedRoute component={DMOPortal} allowedPortals={DMO_PORTALS} />
      </Route>
      
      <Route path="/dmo/:rest*">
        <ProtectedRoute component={DMOPortal} allowedPortals={DMO_PORTALS} />
      </Route>

      <Route path="/committee/decisions">
        <ProtectedRoute component={CommitteeDecisions} allowedPortals={COMMITTEE_PORTALS} />
      </Route>

      <Route path="/committee/meetings">
        <ProtectedRoute component={CommitteeMeetings} allowedPortals={COMMITTEE_PORTALS} />
      </Route>

      <Route path="/committee/members">
        <ProtectedRoute component={CommitteeMembers} allowedPortals={COMMITTEE_PORTALS} />
      </Route>

      <Route path="/committee/voting">
        <ProtectedRoute component={CommitteeVoting} allowedPortals={COMMITTEE_PORTALS} />
      </Route>

      <Route path="/committee/minutes">
        <ProtectedRoute component={CommitteeMinutes} allowedPortals={COMMITTEE_PORTALS} />
      </Route>

      <Route path="/committee/tasks">
        <ProtectedRoute component={CommitteeTasks} allowedPortals={COMMITTEE_PORTALS} />
      </Route>

      <Route path="/committee/settings">
        <ProtectedRoute component={CommitteeSettings} allowedPortals={COMMITTEE_PORTALS} />
      </Route>

      <Route path="/committee/feature-requests">
        <ProtectedRoute 
          component={() => <FeatureRequestPage navGroups={committeeNavGroups} portalName="اللجان" portalId="committee" />}
          allowedPortals={COMMITTEE_PORTALS}
        />
      </Route>
      
      <Route path="/committee">
        <ProtectedRoute component={CommitteePortal} allowedPortals={COMMITTEE_PORTALS} />
      </Route>
      
      <Route path="/committee/:rest*">
        <ProtectedRoute component={CommitteePortal} allowedPortals={COMMITTEE_PORTALS} />
      </Route>

      {/* Data Representative Portal */}
      <Route path="/data-representative">
        <ProtectedRoute component={DataRepresentativePortal} allowedPortals={DATA_REP_PORTALS} />
      </Route>
      <Route path="/data-representative/:rest*">
        <ProtectedRoute component={DataRepresentativePortal} allowedPortals={DATA_REP_PORTALS} />
      </Route>

      {/* Data Steward Portal */}
      <Route path="/steward">
        <ProtectedRoute component={DataStewardPortal} allowedPortals={STEWARD_PORTALS} />
      </Route>
      <Route path="/steward/:rest*">
        <ProtectedRoute component={DataStewardPortal} allowedPortals={STEWARD_PORTALS} />
      </Route>

      {/* Employee Portal */}
      <Route path="/employee/planner">
        <ProtectedRoute component={() => <PlannerBoard portal="employee" navGroups={employeeNavGroups} />} allowedPortals={EMPLOYEE_PORTALS} />
      </Route>
      <Route path="/employee">
        <ProtectedRoute component={EmployeePortal} allowedPortals={EMPLOYEE_PORTALS} />
      </Route>
      <Route path="/employee/:rest*">
        <ProtectedRoute component={EmployeePortal} allowedPortals={EMPLOYEE_PORTALS} />
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function getDefaultRoute(portal?: string): string {
  if (!portal) return '/login';
  return getPortalDefaultRoute(portal);
}

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.state.error?.message?.startsWith('403')) {
        return <AccessDeniedStatic onReset={() => this.setState({ hasError: false, error: null })} />;
      }
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(222_47%_8%)] via-[hsl(222_47%_11%)] to-[hsl(222_40%_14%)] p-4" dir="rtl">
          <Card className="max-w-md w-full border-[hsl(43_74%_49%)]/20 bg-[hsl(222_47%_13%)]/95 backdrop-blur-xl">
            <CardHeader className="text-center space-y-4">
              <CardTitle className="text-xl font-bold text-white">حدث خطأ غير متوقع</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-white/60 text-sm">{this.state.error?.message}</p>
              <Button variant="gold" onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}>
                إعادة تحميل الصفحة
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}

function AccessDeniedStatic({ onReset }: { onReset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(222_47%_8%)] via-[hsl(222_47%_11%)] to-[hsl(222_40%_14%)] p-4" dir="rtl">
      <Card className="max-w-md w-full border-[hsl(43_74%_49%)]/20 bg-[hsl(222_47%_13%)]/95 backdrop-blur-xl" data-testid="card-access-denied-error">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto p-4 rounded-full hub-icon-gold">
            <ShieldX className="w-12 h-12 hub-stat-gold" />
          </div>
          <CardTitle className="text-xl font-bold text-white" data-testid="text-access-denied-title">
            عذراً، لا يوجد صلاحية
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <p className="text-white/60 leading-relaxed">
            لا يوجد صلاحية للوصول لهذه الصفحة.
            <br />
            نأمل منك العودة إلى الصفحات المصرح لك الوصول لها.
          </p>
          <div className="flex flex-col gap-3 items-center">
            <Button 
              variant="gold" 
              className="gap-2"
              onClick={() => { onReset(); window.location.href = '/'; }}
              data-testid="button-return-to-portal-error"
            >
              <ArrowRight className="w-4 h-4" />
              العودة للوحة التحكم
            </Button>
            <Button
              variant="ghost"
              className="text-white/50 hover:text-white gap-2"
              onClick={() => { onReset(); window.history.back(); }}
              data-testid="button-go-back-error"
            >
              العودة للصفحة السابقة
            </Button>
          </div>
          <p className="text-xs text-white/30">
            Control Hub - JCSA
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function AuthenticatedSmartAssistant() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return null;
  return <Suspense fallback={null}><SmartAssistant /></Suspense>;
}

function AppInner() {
  const { dir } = useI18n();
  return (
    <div dir={dir} className="font-sans">
      <Suspense fallback={<PageLoader />}>
        <Router />
      </Suspense>
      <AuthenticatedSmartAssistant />
      <Toaster />
    </div>
  );
}

function App() {
  return (
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ErrorBoundary>
            <AppInner />
          </ErrorBoundary>
        </TooltipProvider>
      </QueryClientProvider>
    </I18nProvider>
  );
}

export default App;
