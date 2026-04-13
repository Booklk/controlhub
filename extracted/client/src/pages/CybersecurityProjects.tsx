import DepartmentProjectsPage from "@/components/DepartmentProjectsPage";
import { cybersecurityNavGroups, CYBERSECURITY_DEPT_ID } from "@/lib/navigation";
import { Shield } from "lucide-react";

export default function CybersecurityProjects() {
  return (
    <DepartmentProjectsPage
      config={{
        departmentId: CYBERSECURITY_DEPT_ID,
        departmentName: "الأمن السيبراني",
        portalName: "الأمن السيبراني",
        navGroups: cybersecurityNavGroups,
        icon: Shield,
      }}
    />
  );
}