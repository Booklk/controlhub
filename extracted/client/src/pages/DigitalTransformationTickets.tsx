import DepartmentTicketsPage from "@/components/DepartmentTicketsPage";
import { digitalTransformationNavGroups, DIGITAL_TRANSFORMATION_DEPT_ID } from "@/lib/navigation";
import { Zap } from "lucide-react";

export default function DigitalTransformationTickets() {
  return (
    <DepartmentTicketsPage
      config={{
        departmentId: DIGITAL_TRANSFORMATION_DEPT_ID,
        departmentName: "التحول الرقمي",
        departmentNameEn: "digital-transformation",
        portalName: "التحول الرقمي",
        navGroups: digitalTransformationNavGroups,
        icon: Zap,
        title: "تذاكر التحول الرقمي",
        subtitle: "متابعة وإدارة تذاكر إدارة التحول الرقمي",
        categories: [
          { value: "digital", label: "رقمنة" },
          { value: "automation", label: "أتمتة" },
          { value: "integration", label: "تكامل" },
          { value: "training", label: "تدريب" },
          { value: "support", label: "دعم فني" },
        ],
        defaultCategory: "digital",
      }}
    />
  );
}
