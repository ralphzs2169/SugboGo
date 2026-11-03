import { UsersRound } from "lucide-react";
import useDocumentTitle from "@/shared/hooks/useDocumentTitle";

import PageHeader from "../components/PageHeader";
import UserManagementTable from "../users/components/UserManagementTable";

export default function Users() {
  useDocumentTitle("Users | SugboGo Admin");

  return (
    <>
      <PageHeader
        breadcrumbs={[
          {
            label: "SugboGo Admin",
            href: "/admin-panel/dashboard",
          },
          {
            label: "Management",
          },
          {
            label: "Users",
          },
        ]}
        title="Users"
      />

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-text-primary">
          <UsersRound aria-hidden="true" className="h-4 w-4 shrink-0" />
          User Management
        </h2>
        <UserManagementTable />
      </section>
    </>
  );
}
