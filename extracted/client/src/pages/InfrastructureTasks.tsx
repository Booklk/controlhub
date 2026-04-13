import DepartmentTasksPage from "@/components/DepartmentTasksPage";
import { infrastructureNavGroups, INFRASTRUCTURE_DEPT_ID } from "@/lib/navigation";
import { Server } from "lucide-react";

export default function InfrastructureTasks() {
  return (
    <DepartmentTasksPage
      config={{
        departmentId: INFRASTRUCTURE_DEPT_ID,
        departmentName: "البنية التحتية",
        departmentNameEn: "infrastructure",
        portalName: "البنية التحتية",
        navGroups: infrastructureNavGroups,
        icon: Server,
        title: "مهام البنية التحتية",
        subtitle: "إدارة ومتابعة مهام قسم البنية التحتية والشبكات",
      }}
    />
  );
}
