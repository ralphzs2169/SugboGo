import { createContext, useContext, useState } from "react";

export const WorkspaceSelections = createContext(null);

/** Retains only local report controls across workspace unmounts; server data stays in React Query. */
export default function useWorkspaceSelection(key, initial) {
  const selections = useContext(WorkspaceSelections);
  const [value, setValue] = useState(() => selections?.has(key) ? selections.get(key) : initial);
  function update(next) {
    setValue((previous) => {
      const resolved = typeof next === "function" ? next(previous) : next;
      selections?.set(key, resolved);
      return resolved;
    });
  }
  return [value, update];
}
