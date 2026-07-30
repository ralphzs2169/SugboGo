import {
  FiBarChart2,
  FiSettings,
  FiShield,
  FiUser,
  FiUsers,
  FiBriefcase,
} from "react-icons/fi";

/**
 * Sidebar navigation configuration.
 *
 * Organized into sections to improve discoverability and
 * scalability as the admin panel grows.
 */
const navigation = [
  {
    section: "Management",
    items: [
      {
        type: "group",
        label: "MSMEs",
        Icon: FiBriefcase,
        roles: ["admin", "super_admin"],
        children: [
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
        ],
      },
      {
        type: "group",
        label: "Users",
        Icon: FiUsers,
        roles: ["admin", "super_admin"],
        children: [
          {
            to: "/admin-panel/users/all",
            label: "All Users",
          },
          {
            to: "/admin-panel/users/roles-permissions",
            label: "Roles & Permissions",
          },
        ],
      },
      {
        type: "link",
        to: "/admin-panel/explorer-activity",
        label: "Explorer Activity",
        Icon: FiUser,
        roles: ["admin", "super_admin"],
      },
    ],
  },

  {
    section: "Moderation",
    items: [
      {
        type: "link",
        to: "/admin-panel/flags-suspicious",
        label: "Flags & Suspicious",
        Icon: FiShield,
        roles: ["admin", "super_admin"],
      },
    ],
  },

  {
    section: "Insights",
    items: [
      {
        type: "link",
        to: "/admin-panel/analytics",
        label: "Analytics",
        Icon: FiBarChart2,
        roles: ["super_admin"],
      },
    ],
  },

  {
    section: "System",
    items: [
      {
        type: "link",
        to: "/admin-panel/settings",
        label: "Settings",
        Icon: FiSettings,
        roles: ["super_admin"],
      },
    ],
  },
];

export default navigation;
