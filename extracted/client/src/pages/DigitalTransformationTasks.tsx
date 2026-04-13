import DepartmentTasksPage from "@/components/DepartmentTasksPage";
import { digitalTransformationNavGroups, DIGITAL_TRANSFORMATION_DEPT_ID } from "@/lib/navigation";
import { Smartphone } from "lucide-react";

export default function DigitalTransformationTasks() {
  return (
    <DepartmentTasksPage
      config={{
        departmentId: DIGITAL_TRANSFORMATION_DEPT_ID,
        departmentName: "التحول الرقمي",
        departmentNameEn: "digital-transformation",
        portalName: "التحول الرقمي",
        navGroups: digitalTransformationNavGroups,
        icon: Smartphone,
        title: "مهام التحول الرقمي",
        subtitle: "إدارة ومتابعة مهام قسم التحول الرقمي",
      }}
    />
  );
}
