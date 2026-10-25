/** Subscribe to Google's documented auth callback and preserve an existing owner. */
export function listenForGoogleMapsAuthFailure(target, onFailure) {
  const previous = target.gm_authFailure;
  const handler = () => {
    onFailure();
    if (typeof previous === "function") previous();
  };
  target.gm_authFailure = handler;

  return () => {
    // Never replace a callback another integration installed after this one.
    if (target.gm_authFailure !== handler) return;
    if (previous === undefined) delete target.gm_authFailure;
    else target.gm_authFailure = previous;
  };
}
