import DepartmentTicketsPage from "@/components/DepartmentTicketsPage";
import { infrastructureNavGroups, INFRASTRUCTURE_DEPT_ID } from "@/lib/navigation";
import { Server } from "lucide-react";

export default function InfrastructureTickets() {
  return (
    <DepartmentTicketsPage
      config={{
        departmentId: INFRASTRUCTURE_DEPT_ID,
        departmentName: "البنية التحتية",
        departmentNameEn: "infrastructure",
        portalName: "البنية التحتية",
        navGroups: infrastructureNavGroups,
        icon: Server,
        title: "تذاكر البنية التحتية",
        subtitle: "متابعة وإدارة تذاكر البنية التحتية والشبكات",
        categories: [
          { value: "network", label: "شبكات" },
          { value: "server", label: "خوادم" },
          { value: "storage", label: "تخزين" },
          { value: "hardware", label: "أجهزة" },
          { value: "connectivity", label: "اتصال" },
        ],
        defaultCategory: "network",
      }}
    />
  );
}
