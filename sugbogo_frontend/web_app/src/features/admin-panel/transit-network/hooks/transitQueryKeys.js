export const transitQueryKeys = {
  all: ["admin", "transit"],
  routes: () => [...transitQueryKeys.all, "routes"],
  routeList: (params) => [...transitQueryKeys.routes(), "list", params],
  routeDetails: () => [...transitQueryKeys.routes(), "detail"],
  routeDetail: (routeId) => [
    ...transitQueryKeys.routeDetails(),
    String(routeId),
  ],
  variants: () => [...transitQueryKeys.all, "route-variants"],
  variantList: (params) => [...transitQueryKeys.variants(), "list", params],
  transitPoints: () => [...transitQueryKeys.all, "transit-points"],
  transitPointList: (params) => [
    ...transitQueryKeys.transitPoints(),
    "list",
    params,
  ],
  transitPointDetails: () => [
    ...transitQueryKeys.transitPoints(),
    "detail",
  ],
  transitPointDetail: (transitPointId) => [
    ...transitQueryKeys.transitPointDetails(),
    String(transitPointId),
  ],
  transfers: () => [...transitQueryKeys.all, "transfers"],
  transferList: (params) => [...transitQueryKeys.transfers(), "list", params],
  transferDetails: () => [...transitQueryKeys.transfers(), "detail"],
  transferDetail: (transferId) => [
    ...transitQueryKeys.transferDetails(),
    String(transferId),
  ],
};
