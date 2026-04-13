import DepartmentProjectsPage from "@/components/DepartmentProjectsPage";
import { supportNavGroups, SUPPORT_DEPT_ID } from "@/lib/navigation";
import { Headphones } from "lucide-react";

export default function SupportProjects() {
  return (
    <DepartmentProjectsPage
      config={{
        departmentId: SUPPORT_DEPT_ID,
        departmentName: "الدعم الفني",
        portalName: "الدعم الفني",
        navGroups: supportNavGroups,
        icon: Headphones,
      }}
    />
  );
}