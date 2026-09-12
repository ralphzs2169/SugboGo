import apiClient from "@/shared/api/apiClient";

const BASE_URL = "/admin/transit/";

function unwrapData(response) {
  return response.data.data;
}

export async function fetchJeepneyRoutes(params = {}) {
  const response = await apiClient.get(`${BASE_URL}routes/`, { params });

  return unwrapData(response);
}

export async function fetchJeepneyRoute(routeId) {
  const response = await apiClient.get(`${BASE_URL}routes/${routeId}/`);

  return unwrapData(response);
}

export async function createJeepneyRoute(data) {
  const response = await apiClient.post(`${BASE_URL}routes/`, data);

  return unwrapData(response);
}

export async function updateJeepneyRoute(routeId, data) {
  const response = await apiClient.patch(
    `${BASE_URL}routes/${routeId}/`,
    data,
  );

  return unwrapData(response);
}

export async function fetchRouteVariants(params = {}) {
  const response = await apiClient.get(`${BASE_URL}route-variants/`, {
    params,
  });

  return unwrapData(response);
}

export async function fetchTransitPoints(params = {}) {
  const response = await apiClient.get(`${BASE_URL}transit-points/`, {
    params,
  });

  return unwrapData(response);
}

export async function fetchTransitPoint(transitPointId) {
  const response = await apiClient.get(
    `${BASE_URL}transit-points/${transitPointId}/`,
  );

  return unwrapData(response);
}

export async function createTransitPoint(data) {
  const response = await apiClient.post(`${BASE_URL}transit-points/`, data);

  return unwrapData(response);
}

export async function updateTransitPoint(transitPointId, data) {
  const response = await apiClient.patch(
    `${BASE_URL}transit-points/${transitPointId}/`,
    data,
  );

  return unwrapData(response);
}

export async function fetchTransitTransfers(params = {}) {
  const response = await apiClient.get(`${BASE_URL}transfers/`, { params });

  return unwrapData(response);
}

export async function fetchTransitTransfer(transferId) {
  const response = await apiClient.get(`${BASE_URL}transfers/${transferId}/`);

  return unwrapData(response);
}

export async function createTransitTransfer(data) {
  const response = await apiClient.post(`${BASE_URL}transfers/`, data);

  return unwrapData(response);
}

export async function updateTransitTransfer(transferId, data) {
  const response = await apiClient.patch(
    `${BASE_URL}transfers/${transferId}/`,
    data,
  );

  return unwrapData(response);
}

export async function confirmTransitTransfer(transferId) {
  const response = await apiClient.post(
    `${BASE_URL}transfers/${transferId}/confirm/`,
  );

  return unwrapData(response);
}

export async function ignoreTransitTransfer(transferId) {
  const response = await apiClient.post(
    `${BASE_URL}transfers/${transferId}/ignore/`,
  );

  return unwrapData(response);
}
