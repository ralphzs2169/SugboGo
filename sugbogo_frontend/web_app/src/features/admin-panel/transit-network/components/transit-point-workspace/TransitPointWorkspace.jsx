import { useState } from "react";
import toast from "react-hot-toast";
import { MapPin, Plus } from "lucide-react";

import TableTabs from "@/features/admin-panel/components/data-table/TableTabs";
import Button from "@/shared/components/Button";

import useTransitMutations from "../../hooks/useTransitMutations";
import { getApiFieldErrors } from "../../utils/transitFormatters";
import TransitPointEditorPanel from "./TransitPointEditorPanel";
import TransitPointList from "./TransitPointList";
import TransitPointMap from "./TransitPointMap";

const EMPTY_VALUES = {
  name: "",
  latitude: "",
  longitude: "",
};

function valuesFromPoint(point) {
  return {
    name: point?.name ?? "",
    latitude:
      point?.latitude == null ? "" : Number(point.latitude).toFixed(6),
    longitude:
      point?.longitude == null ? "" : Number(point.longitude).toFixed(6),
  };
}

function validatePoint(values) {
  const errors = {};
  const latitude = Number(values.latitude);
  const longitude = Number(values.longitude);

  if (!values.name.trim()) {
    errors.name = "Transit Point name is required.";
  }
  if (values.latitude === "" || latitude < -90 || latitude > 90) {
    errors.latitude = "Select a valid latitude on the map.";
  }
  if (values.longitude === "" || longitude < -180 || longitude > 180) {
    errors.longitude = "Select a valid longitude on the map.";
  }

  return errors;
}

/**
 * Coordinates the map-first Transit Point workflow while React Query remains
 * responsible for paginated server state and mutation cache invalidation.
 */
export default function TransitPointWorkspace({
  tabs,
  activeTab,
  onTabChange,
  query,
  search,
  isSearching,
  pagination,
  onSearchChange,
  onPageChange,
}) {
  const [mode, setMode] = useState("browse");
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [values, setValues] = useState(EMPTY_VALUES);
  const [errors, setErrors] = useState({});
  const [submittingAction, setSubmittingAction] = useState(null);
  const { createPoint, updatePoint, isCreatingPoint, isUpdatingPoint } =
    useTransitMutations();
  const isSubmitting = isCreatingPoint || isUpdatingPoint;
  const draftPosition =
    values.latitude !== "" && values.longitude !== ""
      ? {
          lat: Number(values.latitude),
          lng: Number(values.longitude),
        }
      : null;

  function selectPoint(point) {
    if (mode !== "browse") {
      return;
    }

    setSelectedPoint(point);
    setValues(valuesFromPoint(point));
    setErrors({});
  }

  function startAdd() {
    setMode("add");
    setSelectedPoint(null);
    setValues(EMPTY_VALUES);
    setErrors({});
  }

  function startEdit() {
    if (!selectedPoint) {
      return;
    }

    setMode("edit");
    setValues(valuesFromPoint(selectedPoint));
    setErrors({});
  }

  function cancelEditing() {
    setMode("browse");
    setValues(valuesFromPoint(selectedPoint));
    setErrors({});
    setSubmittingAction(null);
  }

  function handleNameChange(event) {
    setValues((previous) => ({
      ...previous,
      name: event.target.value,
    }));
    setErrors((previous) => ({
      ...previous,
      name: undefined,
    }));
  }

  function handlePositionChange(position) {
    setValues((previous) => ({
      ...previous,
      latitude: position.lat.toFixed(6),
      longitude: position.lng.toFixed(6),
    }));
    setErrors((previous) => ({
      ...previous,
      latitude: undefined,
      longitude: undefined,
      coordinates: undefined,
    }));
  }

  function handleSearchChange(nextSearch) {
    if (mode === "browse") {
      setSelectedPoint(null);
      setValues(EMPTY_VALUES);
    }

    onSearchChange(nextSearch);
  }

  function handlePageChange(pageIndex) {
    if (mode === "browse") {
      setSelectedPoint(null);
      setValues(EMPTY_VALUES);
    }

    onPageChange({
      ...pagination,
      pageIndex,
    });
  }

  async function savePoint(addAnother) {
    if (isSubmitting) {
      return;
    }

    const validationErrors = validatePoint(values);

    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors);
      return;
    }

    const data = {
      name: values.name.trim(),
      latitude: Number(values.latitude),
      longitude: Number(values.longitude),
    };

    setSubmittingAction(addAnother ? "another" : "save");

    try {
      if (mode === "edit") {
        const updatedPoint = await updatePoint({
          transitPointId: selectedPoint.id,
          data,
        });

        setSelectedPoint(updatedPoint);
        setValues(valuesFromPoint(updatedPoint));
        setMode("browse");
        toast.success("Transit Point updated successfully.");
        return;
      }

      const createdPoint = await createPoint(data);

      toast.success("Transit Point created successfully.");

      if (addAnother) {
        setSelectedPoint(null);
        setValues(EMPTY_VALUES);
        setErrors({});
        return;
      }

      setSelectedPoint(createdPoint);
      setValues(valuesFromPoint(createdPoint));
      setMode("browse");
    } catch (error) {
      setErrors(getApiFieldErrors(error));
      toast.error(
        error.response?.data?.message ||
          `The Transit Point could not be ${mode === "edit" ? "updated" : "created"}.`,
      );
    } finally {
      setSubmittingAction(null);
    }
  }

  return (
    <div
      className="relative w-full rounded-2xl border border-stroke bg-background px-4 pb-5 pt-2 sm:px-6 sm:pb-6"
      aria-busy={query.isLoading || query.isFetching}
    >
      {/* Transit resource navigation */}
      <div className="mb-5">
        <TableTabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={onTabChange}
        />
      </div>

      {/* Workspace toolbar */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-text-primary">
              Transit Point Map
            </h2>
          </div>
          <p className="mt-1 text-sm text-text-secondary">
            Place and maintain SugboGo-managed boarding, alighting, and transfer
            locations.
          </p>
        </div>
        <Button
          icon={Plus}
          onClick={startAdd}
          disabled={mode !== "browse" || isSubmitting}
        >
          Add Point
        </Button>
      </div>

      {/* Map-first management workspace */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <TransitPointMap
          transitPoints={query.items}
          selectedPoint={selectedPoint}
          selectedPointId={selectedPoint?.id}
          mode={mode}
          draftPosition={draftPosition}
          isFetching={query.isFetching}
          onPointSelect={selectPoint}
          onPositionChange={handlePositionChange}
        />

        <aside className="flex min-h-0 flex-col gap-4">
          <TransitPointEditorPanel
            mode={mode}
            selectedPoint={selectedPoint}
            values={values}
            errors={errors}
            isSubmitting={isSubmitting}
            submittingAction={submittingAction}
            onNameChange={handleNameChange}
            onStartAdd={startAdd}
            onStartEdit={startEdit}
            onSave={savePoint}
            onCancel={cancelEditing}
          />
          <TransitPointList
            transitPoints={query.items}
            selectedPointId={selectedPoint?.id}
            search={search}
            isSearching={isSearching}
            isLoading={query.isLoading}
            error={query.error}
            pagination={pagination}
            pageCount={query.pageCount}
            totalItems={query.totalItems}
            selectionDisabled={mode !== "browse"}
            onSearchChange={handleSearchChange}
            onPageChange={handlePageChange}
            onPointSelect={selectPoint}
            onRetry={query.refetch}
            onStartAdd={startAdd}
          />
        </aside>
      </div>
    </div>
  );
}
