import { useState } from "react";
import { Plus } from "lucide-react";
import { FiTag } from "react-icons/fi";
import toast from "react-hot-toast";

import DataTable from "@/features/admin-panel/components/data-table/DataTable";
import Button from "@/shared/components/Button";
import ConfirmModal from "@/shared/components/modals/ConfirmModal";

import getSpecialtyTagColumns from "../columns/specialtyTagColumns";
import useSpecialtyTags from "../hooks/useSpecialtyTags";
import useSpecialtyTagTableState from "../hooks/useSpecialtyTagTableState";
import useDeleteSpecialtyTag from "../hooks/useDeleteSpecialtyTag";

import CreateSpecialtyTagModal from "./CreateSpecialtyTagModal";
import EditSpecialtyTagModal from "./EditSpecialtyTagModal";

/**
 * Management panel for specialty tags.
 *
 * Handles:
 * - Specialty tag listing
 * - Server-side search, sorting, and pagination
 * - Create, edit, and delete actions
 * - Mutation success and refresh flows
 * - Delete confirmation
 *
 * @component
 *
 * @returns {JSX.Element}
 */
export default function SpecialtyTagManagementPanel() {
  // Modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const [editingSpecialtyTag, setEditingSpecialtyTag] = useState(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingSpecialtyTag, setDeletingSpecialtyTag] = useState(null);

  // Table state
  const {
    globalFilter,
    setGlobalFilter,
    sorting,
    setSorting,
    pagination,
    setPagination,
    params,
    hasActiveFilters,
    handleResetFilters,
  } = useSpecialtyTagTableState();

  // Data
  const {
    specialtyTags,
    totalItems,
    pageCount,
    isLoading,
    isFetching,
    refetch,
  } = useSpecialtyTags(params);

  // Mutations
  const { remove: deleteSpecialtyTag } = useDeleteSpecialtyTag();

  // Refresh the table after mutations.
  async function refreshSpecialtyTags() {
    await refetch();
  }

  // Open edit modal.
  function handleEditSpecialtyTag(specialtyTag) {
    setEditingSpecialtyTag(specialtyTag);
    setIsEditOpen(true);
  }

  // Open delete confirmation.
  function handleDeleteSpecialtyTag(specialtyTag) {
    setDeletingSpecialtyTag(specialtyTag);
    setDeleteModalOpen(true);
  }

  // Confirm deletion.
  async function handleConfirmDelete() {
    const result = await deleteSpecialtyTag(deletingSpecialtyTag.id);

    if (!result.success) {
      return;
    }

    await refreshSpecialtyTags();

    toast.success("Specialty tag deleted successfully.");

    setDeleteModalOpen(false);
    setDeletingSpecialtyTag(null);
  }

  const columns = getSpecialtyTagColumns(
    handleEditSpecialtyTag,
    handleDeleteSpecialtyTag,
  );

  return (
    <>
      <DataTable
        data={specialtyTags}
        columns={columns}
        isLoading={isLoading}
        isFetching={isFetching}
        pagination={pagination}
        state={{
          globalFilter,
          sorting,
        }}
        pageCount={pageCount}
        totalItems={totalItems}
        onPaginationChange={setPagination}
        onGlobalFilterChange={setGlobalFilter}
        onSortingChange={setSorting}
        hasActiveFilters={hasActiveFilters}
        onResetFilters={handleResetFilters}
        config={{
          searchPlaceholder: "Search specialty tags...",

          emptyState: {
            title: "No specialty tags found",
            description:
              "Try adjusting your search or create a new specialty tag.",
            icon: <FiTag className="h-10 w-10 text-text-secondary" />,
          },
        }}
        slots={{
          renderHeaderActions: () => (
            <Button icon={Plus} onClick={() => setIsCreateOpen(true)}>
              Add Specialty Tag
            </Button>
          ),
        }}
      />

      {/* Modals */}

      <CreateSpecialtyTagModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={async () => {
          await refreshSpecialtyTags();
          toast.success("Specialty tag created successfully.");
        }}
      />

      <EditSpecialtyTagModal
        isOpen={isEditOpen}
        specialtyTag={editingSpecialtyTag}
        onClose={() => {
          setIsEditOpen(false);
          setEditingSpecialtyTag(null);
        }}
        onSuccess={async () => {
          await refreshSpecialtyTags();
          toast.success("Specialty tag updated successfully.");
        }}
      />

      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Delete Specialty Tag?"
        description={`Are you sure you want to delete "${deletingSpecialtyTag?.name}"? This action cannot be undone.`}
        onClose={() => {
          setDeleteModalOpen(false);
          setDeletingSpecialtyTag(null);
        }}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
