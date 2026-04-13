import DepartmentTasksPage from "@/components/DepartmentTasksPage";
import { supportNavGroups, SUPPORT_DEPT_ID } from "@/lib/navigation";
import { Headphones } from "lucide-react";

export default function SupportTasks() {
  return (
    <DepartmentTasksPage
      config={{
        departmentId: SUPPORT_DEPT_ID,
        departmentName: "الدعم الفني",
        departmentNameEn: "support",
        portalName: "الدعم الفني",
        navGroups: supportNavGroups,
        icon: Headphones,
        title: "مهام الدعم الفني",
        subtitle: "إدارة ومتابعة مهام قسم الدعم الفني",
      }}
    />
  );
}
