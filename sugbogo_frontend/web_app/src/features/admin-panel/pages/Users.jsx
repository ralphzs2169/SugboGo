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
        <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-text-secondary">
          User Management
        </h2>
        <UserManagementTable />
      </section>
    </>
  );
}
