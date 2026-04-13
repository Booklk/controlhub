import DepartmentTicketsPage from "@/components/DepartmentTicketsPage";
import { dmoNavGroups, DMO_DEPARTMENT_ID } from "@/lib/navigation";
import { Database } from "lucide-react";

export default function DMOTickets() {
  return (
    <DepartmentTicketsPage
      config={{
        departmentId: DMO_DEPARTMENT_ID,
        departmentName: "مكتب إدارة البيانات",
        departmentNameEn: "dmo",
        portalName: "مكتب إدارة البيانات",
        navGroups: dmoNavGroups,
        icon: Database,
        title: "تذاكر مكتب إدارة البيانات",
        subtitle: "متابعة وإدارة تذاكر مكتب إدارة البيانات",
        categories: [
          { value: "data_quality", label: "جودة بيانات" },
          { value: "data_access", label: "وصول للبيانات" },
          { value: "compliance", label: "امتثال" },
          { value: "governance", label: "حوكمة" },
          { value: "support", label: "دعم فني" },
        ],
        defaultCategory: "data_quality",
      }}
    />
  );
}
