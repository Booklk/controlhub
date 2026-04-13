import DepartmentTasksPage from "@/components/DepartmentTasksPage";
import { cybersecurityNavGroups, CYBERSECURITY_DEPT_ID } from "@/lib/navigation";
import { Shield } from "lucide-react";

export default function CybersecurityTasks() {
  return (
    <DepartmentTasksPage
      config={{
        departmentId: CYBERSECURITY_DEPT_ID,
        departmentName: "الأمن السيبراني",
        departmentNameEn: "cybersecurity",
        portalName: "الأمن السيبراني",
        navGroups: cybersecurityNavGroups,
        icon: Shield,
        title: "مهام الأمن السيبراني",
        subtitle: "إدارة ومتابعة مهام قسم الأمن السيبراني",
      }}
    />
  );
}
