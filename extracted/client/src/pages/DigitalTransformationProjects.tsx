import DepartmentProjectsPage from "@/components/DepartmentProjectsPage";
import { digitalTransformationNavGroups, DIGITAL_TRANSFORMATION_DEPT_ID } from "@/lib/navigation";
import { Zap } from "lucide-react";

export default function DigitalTransformationProjects() {
  return (
    <DepartmentProjectsPage
      config={{
        departmentId: DIGITAL_TRANSFORMATION_DEPT_ID,
        departmentName: "التحول الرقمي",
        portalName: "التحول الرقمي",
        navGroups: digitalTransformationNavGroups,
        icon: Zap,
      }}
    />
  );
}