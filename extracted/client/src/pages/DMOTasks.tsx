import DepartmentTasksPage from "@/components/DepartmentTasksPage";
import { dmoNavGroups, DMO_DEPARTMENT_ID } from "@/lib/navigation";
import { Database } from "lucide-react";

export default function DMOTasks() {
  return (
    <DepartmentTasksPage
      config={{
        departmentId: DMO_DEPARTMENT_ID,
        departmentName: "مكتب إدارة البيانات",
        departmentNameEn: "dmo",
        portalName: "مكتب إدارة البيانات",
        navGroups: dmoNavGroups,
        icon: Database,
        title: "مهام مكتب إدارة البيانات",
        subtitle: "إدارة ومتابعة مهام مكتب إدارة البيانات",
      }}
    />
  );
}
