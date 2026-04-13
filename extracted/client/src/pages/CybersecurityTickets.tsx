import DepartmentTicketsPage from "@/components/DepartmentTicketsPage";
import { cybersecurityNavGroups, CYBERSECURITY_DEPT_ID } from "@/lib/navigation";
import { Shield } from "lucide-react";

export default function CybersecurityTickets() {
  return (
    <DepartmentTicketsPage
      config={{
        departmentId: CYBERSECURITY_DEPT_ID,
        departmentName: "الأمن السيبراني",
        departmentNameEn: "cybersecurity",
        portalName: "الأمن السيبراني",
        navGroups: cybersecurityNavGroups,
        icon: Shield,
        title: "تذاكر الأمن السيبراني",
        subtitle: "متابعة وإدارة تذاكر إدارة الأمن السيبراني",
        categories: [
          { value: "security", label: "أمن معلومات" },
          { value: "incident", label: "حادثة أمنية" },
          { value: "vulnerability", label: "ثغرة أمنية" },
          { value: "access", label: "صلاحيات" },
          { value: "compliance", label: "امتثال" },
        ],
        defaultCategory: "security",
      }}
    />
  );
}
