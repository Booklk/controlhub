import DepartmentProjectsPage from "@/components/DepartmentProjectsPage";
import { infrastructureNavGroups, INFRASTRUCTURE_DEPT_ID } from "@/lib/navigation";
import { Server } from "lucide-react";

export default function InfrastructureProjects() {
  return (
    <DepartmentProjectsPage
      config={{
        departmentId: INFRASTRUCTURE_DEPT_ID,
        departmentName: "البنية التحتية",
        portalName: "البنية التحتية",
        navGroups: infrastructureNavGroups,
        icon: Server,
      }}
    />
  );
}