import { useEffect, useId, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ChevronRight,
  Clipboard,
  FilePen,
  LoaderCircle,
  MapPin,
  MessageSquare,
  Search,
  ShieldAlert,
  Store,
  Tags,
  User,
} from "lucide-react";

import { useAuthStore } from "@/features/auth/storage/auth.store";
import DataErrorState from "@/shared/components/errors/DataErrorState";
import StatusBadge from "@/shared/components/StatusBadge";
import useGlobalSearch from "../hooks/useGlobalSearch";
import { getGlobalSearchDestination } from "../utils/globalSearchNavigation";
import {
  GLOBAL_SEARCH_HEADINGS,
  getGlobalSearchStatus,
} from "../utils/globalSearchPresentation";

const RESULT_TYPES = {
  business: { Icon: Store, label: "Business" },
  user: { Icon: User, label: "User" },
  application: { Icon: Clipboard, label: "Application" },
  business_name_request: { Icon: FilePen, label: "Name request" },
  classification_request: { Icon: Tags, label: "Classification request" },
  location_request: { Icon: MapPin, label: "Location request" },
  review: { Icon: MessageSquare, label: "Review" },
  review_dispute: { Icon: ShieldAlert, label: "Dispute" },
};

/** Provide a grouped search combobox with input-owned focus and bounded API reads. */
function GlobalSearchField() {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listId = useId();
  const messageId = `${listId}-message`;
  const [input, setInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeKey, setActiveKey] = useState(null);
  const { groups, isLoading, error, refetch } = useGlobalSearch(input, {
    enabled: isOpen,
  });
  const visibleGroups = isLoading || error
    ? []
    : groups.filter((group) => group.items.length > 0);
  const results = visibleGroups.flatMap((group) =>
    group.items.map((item) => ({
      ...item,
      type: group.type,
      key: `${group.type}:${item.id}`,
    })),
  );
  const activeResult = results.find((result) => result.key === activeKey);
  const activeId = activeResult ? `${listId}-${activeResult.key}` : undefined;
  const search = input.trim();
  let message;

  if (search.length < 2) {
    message = "Type at least 2 characters to search.";
  } else if (search.length > 200) {
    message = "Use 200 characters or fewer.";
  } else if (error) {
    message = "Search could not be loaded.";
  } else if (isLoading) {
    message = "Searching administration…";
  } else if (results.length === 0) {
    message = "No results found.";
  } else {
    message = `${results.length} results. Use the arrow keys to select a result and Enter to open it.`;
  }

  useEffect(() => {
    if (!isOpen) return;

    function handleOutsidePointer(event) {
      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false);
        setActiveKey(null);
      }
    }

    document.addEventListener("pointerdown", handleOutsidePointer);
    return () => document.removeEventListener("pointerdown", handleOutsidePointer);
  }, [isOpen]);

  useEffect(() => {
    if (activeId) {
      document.getElementById(activeId)?.scrollIntoView?.({ block: "nearest" });
    }
  }, [activeId]);

  function dismiss() {
    setIsOpen(false);
    setActiveKey(null);
  }

  function selectResult(result) {
    const destination = getGlobalSearchDestination(result.type, result.id);
    if (!destination) return;

    dismiss();
    inputRef.current?.blur();
    navigate(destination);
  }

  function handleKeyDown(event) {
    if (event.nativeEvent.isComposing) return;

    if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      event.stopPropagation();
      inputRef.current?.focus();
      dismiss();
      return;
    }

    // Result shortcuts belong only to the combobox, not to the Retry button.
    if (event.target !== inputRef.current) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      setIsOpen(true);
      if (results.length === 0) return;

      const direction = event.key === "ArrowDown" ? 1 : -1;
      const current = results.findIndex((result) => result.key === activeKey);
      let next;
      if (current < 0) {
        next = direction === 1 ? 0 : results.length - 1;
      } else {
        next = (current + direction + results.length) % results.length;
      }
      setActiveKey(results[next].key);
    } else if (event.key === "Enter" && isOpen && activeResult) {
      event.preventDefault();
      event.stopPropagation();
      selectResult(activeResult);
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative hidden w-98 md:block"
      onKeyDown={handleKeyDown}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) dismiss();
      }}
    >
      {/* Keep the existing header input dimensions and focus treatment. */}
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-label="Search administration"
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listId : undefined}
        aria-activedescendant={isOpen ? activeId : undefined}
        aria-describedby={isOpen ? messageId : undefined}
        autoComplete="off"
        maxLength={200}
        placeholder="Search..."
        value={input}
        onFocus={() => setIsOpen(true)}
        onClick={() => setIsOpen(true)}
        onChange={(event) => {
          setInput(event.target.value);
          setActiveKey(null);
          setIsOpen(true);
        }}
        className="w-full rounded-lg border border-stroke bg-surface-muted py-2 pl-9 pr-4 text-sm text-text-primary outline-none transition-colors placeholder:text-text-secondary focus:border-stroke-active focus:ring-2 focus:ring-stroke-active/20"
      />

      {/* The popup overlays page content without changing header height. */}
      {isOpen && (
        <div className="themed-scrollbar absolute left-0 top-full z-50 mt-2 max-h-[min(32rem,calc(100dvh-6rem))] w-full overflow-y-auto rounded-lg border border-stroke bg-background shadow-lg">
          <div className={results.length > 0 || error ? "sr-only" : "flex items-center gap-2 px-4 py-5 text-sm text-text-secondary"}>
            {isLoading && <LoaderCircle aria-hidden="true" className="h-4 w-4 shrink-0 motion-safe:animate-spin" />}
            <p id={messageId} role="status" aria-live="polite" aria-atomic="true">
              {message}
            </p>
          </div>

          {error && (
            <DataErrorState
              compact
              title="Unable to search"
              message={error.response?.data?.message || "Search could not be loaded. Please try again."}
              onRetry={() => {
                inputRef.current?.focus();
                refetch();
              }}
              retryLabel="Retry"
            />
          )}

          <ul id={listId} role="listbox" aria-label="Administration search results" aria-busy={isLoading}>
            {visibleGroups.map((group) => (
              <li key={group.type} role="group" aria-labelledby={`${listId}-${group.type}-heading`} className="py-1.5">
                <div className="mx-3 mb-1 flex items-center justify-between gap-2 border-b border-stroke pb-1.5 pt-1">
                  <p id={`${listId}-${group.type}-heading`} className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                    {GLOBAL_SEARCH_HEADINGS[group.type]}
                  </p>
                  <span className="shrink-0 text-xs text-text-secondary">
                    {group.items.length} shown
                  </span>
                </div>
                <ul role="presentation" className="px-1.5">
                  {group.items.map((item) => {
                    const key = `${group.type}:${item.id}`;
                    const status = getGlobalSearchStatus(group.type, item.status);
                    const selected = activeKey === key;
                    const { Icon, label } = RESULT_TYPES[group.type];

                    return (
                      <li key={key} role="presentation">
                        <button
                          id={`${listId}-${key}`}
                          type="button"
                          role="option"
                          tabIndex={-1}
                          aria-selected={selected}
                          onMouseDown={(event) => event.preventDefault()}
                          onMouseMove={() => setActiveKey(key)}
                          onClick={() => selectResult({ ...item, type: group.type })}
                          className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left hover:bg-interaction-hover focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-info ${selected ? "bg-interaction-hover" : ""}`}
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-text-secondary" aria-hidden="true">
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-2 break-words text-sm font-medium text-text-primary">{item.title}</span>
                            {item.subtitle && (
                              <span className="mt-0.5 line-clamp-1 break-all text-xs text-text-secondary">
                                {item.subtitle}
                              </span>
                            )}
                            <span className="block text-xs text-text-secondary">{label} #{item.id}</span>
                          </span>
                          <StatusBadge variant={status.variant}>{status.label}</StatusBadge>
                          <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-text-secondary" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {group.has_more && <p className="px-4 pt-1 text-xs text-text-secondary">More matches available</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Reset transient search state on navigation or session changes within the Admin shell. */
export default function GlobalSearch() {
  const location = useLocation();
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const permitted = (
    isAuthenticated &&
    !isLoading &&
    ["admin", "super_admin"].includes(user?.role)
  );

  if (!permitted) return null;

  return <GlobalSearchField key={`${location.key}:${user.id}:${user.role}`} />;
}
