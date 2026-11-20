import apiClient from "@/shared/api/apiClient";
import { loadTransitReferences } from "./loadTransitReferences";

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

export async function fetchRouteVariants(params = {}, { signal } = {}) {
  const response = await apiClient.get(`${BASE_URL}route-variants/`, {
    params,
    signal,
  });

  return unwrapData(response);
}

export async function fetchRouteVariant(variantId) {
  const response = await apiClient.get(
    `${BASE_URL}route-variants/${variantId}/`,
  );

  return unwrapData(response);
}

export async function createRouteVariant(data) {
  const response = await apiClient.post(`${BASE_URL}route-variants/`, data);

  return unwrapData(response);
}

export async function updateRouteVariant(variantId, data) {
  const response = await apiClient.patch(
    `${BASE_URL}route-variants/${variantId}/`,
    data,
  );

  return unwrapData(response);
}

export async function fetchTransitPoints(params = {}, { signal } = {}) {
  const response = await apiClient.get(`${BASE_URL}transit-points/`, {
    params,
    signal,
  });

  return unwrapData(response);
}

/** Load every stop page for route editing without changing browser-list pagination. */
export function fetchTransitPointReferences(options = {}) {
  return loadTransitReferences(fetchTransitPoints, options);
}

/** Load every direction page for the map reference layer. */
export function fetchRouteVariantReferences(options = {}) {
  return loadTransitReferences(fetchRouteVariants, options);
}

export async function fetchTransitPoint(transitPointId, { signal } = {}) {
  const response = await apiClient.get(
    `${BASE_URL}transit-points/${transitPointId}/`,
    { signal },
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

export async function deleteTransitPoint(transitPointId) {
  const response = await apiClient.delete(
    `${BASE_URL}transit-points/${transitPointId}/`,
  );

  return unwrapData(response);
}
