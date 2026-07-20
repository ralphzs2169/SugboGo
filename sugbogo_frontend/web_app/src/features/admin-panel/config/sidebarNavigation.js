import {
  FiBarChart2,
  FiSettings,
  FiShield,
  FiTag,
  FiUser,
} from "react-icons/fi";

/**
 * Navigation links for the admin/super admin console sidebar, each with a route, label, and icon.
 * Each link also specifies the roles that are allowed to access it.
 */
const navigation = [
  {
    to: "/admin-panel/explorer-activity",
    label: "Explorer Activity",
    Icon: FiUser,
    roles: ["admin", "super_admin"],
  },
  {
    to: "/admin-panel/specialty-tags",
    label: "Specialty Tags",
    Icon: FiTag,
    roles: ["admin", "super_admin"],
  },
  {
    to: "/admin-panel/flags-suspicious",
    label: "Flags/Suspicious",
    Icon: FiShield,
    roles: ["admin", "super_admin"],
  },
  {
    to: "/admin-panel/analytics",
    label: "Analytics",
    Icon: FiBarChart2,
    roles: ["super_admin"],
  },
  {
    to: "/admin-panel/settings",
    label: "Settings",
    Icon: FiSettings,
    roles: ["super_admin"],
  },
];

export default navigation;
