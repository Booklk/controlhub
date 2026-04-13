import DepartmentTicketsPage from "@/components/DepartmentTicketsPage";
import { supportNavGroups, SUPPORT_DEPT_ID } from "@/lib/navigation";
import { Ticket } from "lucide-react";

export default function SupportTicketsPage() {
  return (
    <DepartmentTicketsPage
      config={{
        departmentId: SUPPORT_DEPT_ID,
        departmentName: "الدعم الفني",
        departmentNameEn: "support",
        portalName: "الدعم الفني",
        navGroups: supportNavGroups,
        icon: Ticket,
        title: "إدارة تذاكر الدعم الفني",
        subtitle: "متابعة وإدارة تذاكر الدعم الفني",
        categories: [
          { value: "technical", label: "فني" },
          { value: "network", label: "شبكات" },
          { value: "software", label: "برمجيات" },
          { value: "hardware", label: "أجهزة" },
        ],
        defaultCategory: "technical",
      }}
    />
  );
}
