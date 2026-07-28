import { NavLink } from "react-router-dom";
import { useState } from "react";
import { FiChevronDown, FiChevronRight, FiShield } from "react-icons/fi";

import { linkBase } from "./SidebarLink";

const links = [
  {
    to: "/admin-panel/msmes",
    label: "Businesses",
  },
  {
    to: "/admin-panel/cluster-category",
    label: "Clusters & Categories",
  },
  {
    to: "/admin-panel/specialty-tags",
    label: "Specialty Tags",
  },
];

export default function MsmeLinkDropdown({ onClick }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`${linkBase} text-text-primary hover:bg-interaction-hover`}
      >
        <FiShield className="h-5 w-5 shrink-0" />

        <span className="flex-1 text-left">MSMEs</span>

        {isOpen ? (
          <FiChevronDown className="h-4 w-4" />
        ) : (
          <FiChevronRight className="h-4 w-4" />
        )}
      </button>

      {isOpen && (
        <div className="ml-8 mt-1 space-y-1">
          {links.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClick}
              className={({ isActive }) =>
                `
                block rounded-lg px-4 py-2 text-[13px] font-medium transition
                ${
                  isActive
                    ? "bg-primary text-white"
                    : "text-text-primary hover:bg-interaction-hover"
                }
                `
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}
