import { API_ERROR_MESSAGE } from "./errorCodes";

/**
 * Shapes a transport-level Axios failure (network error, timeout, or a
 * session that could not be refreshed) to look like the backend's
 * standard error response — `{ success, message, code }`.
 *
 * Axios only populates `error.response` for requests that actually
 * reached the server. Transport failures leave it undefined, so
 * existing service callers' `error.response?.data?.message` checks
 * silently see nothing for these cases. Attaching a synthetic
 * `response` here lets those same call sites handle transport
 * failures the same way they already handle backend errors, instead
 * of introducing a second, differently-shaped error convention.
 *
 * Only attaches the synthetic response if one isn't already present,
 * so a genuine backend error response is never overwritten.
 */
export function attachSyntheticResponse(error, code) {
  if (error.response) {
    return error;
  }

  error.response = {
    data: {
      success: false,
      message: API_ERROR_MESSAGE[code],
      code,
    },
  };

  return error;
}
