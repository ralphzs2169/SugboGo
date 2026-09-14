import { useState } from "react";
import toast from "react-hot-toast";

import useTransitMutations from "./useTransitMutations";
import { getApiFieldErrors } from "../utils/transitFormatters";
import {
  buildVariantPayload,
  createVariantSnapshot,
  getInitialVariantEditorState,
  moveListItem,
  validateVariantEditor,
} from "../utils/variantEditorUtils";

const EMPTY_EDITOR_STATE = {
  routeId: "",
  originId: "",
  destinationId: "",
  intermediatePointIds: [],
  geometry: [],
};

/**
 * Owns coordinated route geometry and ordered Transit Point edits for the
 * shared map while preserving the existing payload and validation rules.
 */
export default function useRouteVariantWorkspaceEditor() {
  const [editorState, setEditorState] = useState(EMPTY_EDITOR_STATE);
  const [savedSnapshot, setSavedSnapshot] = useState(
    createVariantSnapshot(EMPTY_EDITOR_STATE),
  );
  const [geometryHistory, setGeometryHistory] = useState([]);
  const [errors, setErrors] = useState({});
  const {
    createVariant,
    updateVariant,
    isCreatingVariant,
    isUpdatingVariant,
  } = useTransitMutations();
  const isSaving = isCreatingVariant || isUpdatingVariant;
  const isDirty = createVariantSnapshot(editorState) !== savedSnapshot;

  function begin(route, variant = null) {
    const initialState = getInitialVariantEditorState(route.id, variant);

    setEditorState(initialState);
    setSavedSnapshot(createVariantSnapshot(initialState));
    setGeometryHistory([]);
    setErrors({});
  }

  function reset() {
    setGeometryHistory([]);
    setErrors({});
  }

  function updateEditorState(updater, clearedErrorFields = []) {
    setEditorState(updater);

    if (clearedErrorFields.length) {
      setErrors((previous) => {
        const next = { ...previous };

        clearedErrorFields.forEach((field) => {
          delete next[field];
        });

        return next;
      });
    }
  }

  function commitGeometry(nextGeometry) {
    setGeometryHistory((previous) => [
      ...previous,
      editorState.geometry.map((coordinate) => ({ ...coordinate })),
    ]);
    updateEditorState(
      (previous) => ({ ...previous, geometry: nextGeometry }),
      ["geometry"],
    );
  }

  function addGeometryVertex(coordinate) {
    commitGeometry([...editorState.geometry, coordinate]);
  }

  function updateGeometryVertex(index, coordinate) {
    commitGeometry(
      editorState.geometry.map((item, itemIndex) =>
        itemIndex === index ? coordinate : item,
      ),
    );
  }

  function removeGeometryVertex(index) {
    commitGeometry(
      editorState.geometry.filter((_, itemIndex) => itemIndex !== index),
    );
  }

  function undoGeometry() {
    const previousGeometry = geometryHistory.at(-1);

    if (!previousGeometry) {
      return;
    }

    setEditorState((previous) => ({
      ...previous,
      geometry: previousGeometry,
    }));
    setGeometryHistory((previous) => previous.slice(0, -1));
    setErrors((previous) => ({ ...previous, geometry: undefined }));
  }

  function clearGeometry() {
    commitGeometry([]);
  }

  function changeOrigin(originId) {
    if (originId && originId === editorState.destinationId) {
      setErrors((previous) => ({
        ...previous,
        origin_transit_point_id:
          "The origin must differ from the destination.",
      }));
      return;
    }

    updateEditorState(
      (previous) => ({
        ...previous,
        originId,
        intermediatePointIds: previous.intermediatePointIds.filter(
          (pointId) => pointId !== originId,
        ),
      }),
      ["origin_transit_point_id", "transit_point_ids"],
    );
  }

  function changeDestination(destinationId) {
    if (destinationId && destinationId === editorState.originId) {
      setErrors((previous) => ({
        ...previous,
        destination_transit_point_id:
          "The destination must differ from the origin.",
      }));
      return;
    }

    updateEditorState(
      (previous) => ({
        ...previous,
        destinationId,
        intermediatePointIds: previous.intermediatePointIds.filter(
          (pointId) => pointId !== destinationId,
        ),
      }),
      ["destination_transit_point_id", "transit_point_ids"],
    );
  }

  function addIntermediate(pointId) {
    if (
      pointId === editorState.originId ||
      pointId === editorState.destinationId ||
      editorState.intermediatePointIds.includes(pointId)
    ) {
      return;
    }

    updateEditorState(
      (previous) => ({
        ...previous,
        intermediatePointIds: [...previous.intermediatePointIds, pointId],
      }),
      ["transit_point_ids"],
    );
  }

  function selectTransitPoint(pointId) {
    if (!editorState.originId) {
      changeOrigin(pointId);
      toast.success("Origin Transit Point selected.");
      return;
    }
    if (!editorState.destinationId && pointId !== editorState.originId) {
      changeDestination(pointId);
      toast.success("Destination Transit Point selected.");
      return;
    }
    if (
      pointId === editorState.originId ||
      pointId === editorState.destinationId ||
      editorState.intermediatePointIds.includes(pointId)
    ) {
      toast("This Transit Point is already in the route.");
      return;
    }

    addIntermediate(pointId);
    toast.success("Intermediate Transit Point added.");
  }

  function moveIntermediate(index, direction) {
    updateEditorState(
      (previous) => ({
        ...previous,
        intermediatePointIds: moveListItem(
          previous.intermediatePointIds,
          index,
          direction,
        ),
      }),
      ["transit_point_ids"],
    );
  }

  function removeIntermediate(index) {
    updateEditorState(
      (previous) => ({
        ...previous,
        intermediatePointIds: previous.intermediatePointIds.filter(
          (_, itemIndex) => itemIndex !== index,
        ),
      }),
      ["transit_point_ids"],
    );
  }

  async function save(variant) {
    if (isSaving) {
      return null;
    }

    const validationErrors = validateVariantEditor(editorState);

    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors);
      toast.error("Complete the required route information before saving.");
      return null;
    }

    try {
      const payload = buildVariantPayload(editorState);
      const savedVariant = variant
        ? await updateVariant({ variantId: variant.id, data: payload })
        : await createVariant(payload);
      const savedState = getInitialVariantEditorState(
        editorState.routeId,
        savedVariant,
      );

      setEditorState(savedState);
      setSavedSnapshot(createVariantSnapshot(savedState));
      setGeometryHistory([]);
      toast.success(
        variant
          ? "Route variant updated successfully."
          : "Route variant created successfully.",
      );
      return savedVariant;
    } catch (error) {
      setErrors(getApiFieldErrors(error));
      toast.error(
        error.response?.data?.message ||
          `The route variant could not be ${variant ? "updated" : "created"}.`,
      );
      return null;
    }
  }

  return {
    editorState,
    errors,
    isDirty,
    isSaving,
    canUndo: geometryHistory.length > 0,
    begin,
    reset,
    addGeometryVertex,
    updateGeometryVertex,
    removeGeometryVertex,
    undoGeometry,
    clearGeometry,
    changeOrigin,
    changeDestination,
    addIntermediate,
    selectTransitPoint,
    moveIntermediate,
    removeIntermediate,
    save,
  };
}
