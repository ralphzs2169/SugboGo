export const TRANSIT_CONTEXTS = {
  ROUTES: "routes",
  POINTS: "transit-points",
  TRANSFERS: "transfers",
};

export const TRANSIT_MODES = {
  BROWSE: "browse",
  CREATE_ROUTE: "create-route",
  EDIT_ROUTE: "edit-route",
  CREATE_VARIANT_DRAW: "create-variant-draw",
  CREATE_VARIANT_ADJUST: "create-variant-adjust",
  EDIT_VARIANT_DRAW: "edit-variant-draw",
  EDIT_VARIANT_ADJUST: "edit-variant-adjust",
  ADD_POINT: "add-transit-point",
  EDIT_POINT: "edit-transit-point",
  CREATE_TRANSFER: "create-transfer",
  EDIT_TRANSFER: "edit-transfer",
};

export function isVariantEditingMode(mode) {
  return mode.startsWith("create-variant") || mode.startsWith("edit-variant");
}

export function isRouteDrawingMode(mode) {
  return mode === TRANSIT_MODES.CREATE_VARIANT_DRAW ||
    mode === TRANSIT_MODES.EDIT_VARIANT_DRAW;
}

export function isPointEditingMode(mode) {
  return mode === TRANSIT_MODES.ADD_POINT ||
    mode === TRANSIT_MODES.EDIT_POINT;
}
