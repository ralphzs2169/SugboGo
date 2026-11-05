import { List, UsersRound } from "lucide-react";
import useDocumentTitle from "@/shared/hooks/useDocumentTitle";

import PageHeader from "../components/PageHeader";
import UserManagementTable from "../users/components/UserManagementTable";
import UserOverview from "../users/components/UserOverview";

export default function Users() {
  useDocumentTitle("User Management | SugboGo Admin");

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
        title="User Management"
      />

      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-text-primary">
          <UsersRound aria-hidden="true" className="h-4 w-4 shrink-0" />
          User Overview
        </h2>
        <p className="-mt-2 mb-3 text-xs text-text-secondary">
          Current account status and assigned roles
        </p>
        <UserOverview />
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-text-primary">
          <List aria-hidden="true" className="h-4 w-4 shrink-0" />
          All Users
        </h2>
        <UserManagementTable />
      </section>
    </>
  );
}
