/** Restricts provider navigation hints and discards all other query parameters. */
export function mayaReturnAppUrl(search) {
  const values = new URLSearchParams(search).getAll("outcome");
  const outcome = values.length === 1 && ["success", "failure", "cancel"].includes(values[0])
    ? values[0]
    : null;
  const target = "sugbogo://merchant-plus/return";
  return outcome ? `${target}?outcome=${outcome}` : target;
}
