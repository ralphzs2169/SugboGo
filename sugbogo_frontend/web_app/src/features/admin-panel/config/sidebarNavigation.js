import {
  FiBarChart2,
  FiSettings,
  FiShield,
  FiUser,
  FiUsers,
  FiBriefcase,
  FiTag,
  FiMapPin,
  FiFileText,
  FiLayers,
  FiActivity,
} from "react-icons/fi";

/**
 * Sidebar navigation configuration.
 *
 * Organized into sections to improve discoverability and
 * scalability as the admin panel grows.
 */
// const navigation = [
//   {
//     section: "Management",
//     items: [
//       {
//         type: "group",
//         label: "Businesses",
//         Icon: FiBriefcase,
//         roles: ["admin", "super_admin"],
//         children: [
//           {
//             to: "/admin-panel/businesses/listings",
//             label: "Listings",
//           },
//           {
//             to: "/admin-panel/businesses/applications",
//             label: "Applications",
//           },
//         ],
//       },
//       {
//         type: "group",
//         label: "Clusters & Tags",
//         Icon: FiTag,
//         roles: ["admin", "super_admin"],
//         children: [
//           {
//             to: "/admin-panel/cluster-category",
//             label: "Clusters & Categories",
//           },
//           {
//             to: "/admin-panel/specialty-tags",
//             label: "Specialty Tags",
//           },
//         ],
//       },
//       {
//         type: "group",
//         label: "Users",
//         Icon: FiUsers,
//         roles: ["admin", "super_admin"],
//         children: [
//           {
//             to: "/admin-panel/users/all",
//             label: "All Users",
//           },
//           {
//             to: "/admin-panel/users/roles-permissions",
//             label: "Roles & Permissions",
//           },
//         ],
//       },
//       {
//         type: "link",
//         to: "/admin-panel/explorer-activity",
//         label: "Explorer Activity",
//         Icon: FiUser,
//         roles: ["admin", "super_admin"],
//       },
//     ],
//   },

//   {
//     section: "Moderation",
//     items: [
//       {
//         type: "link",
//         to: "/admin-panel/flags-suspicious",
//         label: "Flags & Suspicious",
//         Icon: FiShield,
//         roles: ["admin", "super_admin"],
//       },
//     ],
//   },

//   {
//     section: "Insights",
//     items: [
//       {
//         type: "link",
//         to: "/admin-panel/analytics",
//         label: "Analytics",
//         Icon: FiBarChart2,
//         roles: ["super_admin"],
//       },
//     ],
//   },

//   {
//     section: "System",
//     items: [
//       {
//         type: "link",
//         to: "/admin-panel/settings",
//         label: "Settings",
//         Icon: FiSettings,
//         roles: ["super_admin"],
//       },
//     ],
//   },
// ];

const navigation = [
  {
    section: "Management",
    items: [
      {
        type: "link",
        to: "/admin-panel/businesses",
        label: "Listings",
        Icon: FiMapPin,
        roles: ["admin", "super_admin"],
      },
      {
        type: "link",
        to: "/admin-panel/businesses/applications",
        label: "Merchant Applications",
        Icon: FiFileText,
        roles: ["admin", "super_admin"],
        activePaths: [
          "/admin-panel/businesses/applications",
          "/admin-panel/business/application",
        ],
      },
      {
        type: "link",
        to: "/admin-panel/cluster-category",
        label: "Clusters & Categories",
        Icon: FiLayers,
        roles: ["admin", "super_admin"],
      },
      {
        type: "link",
        to: "/admin-panel/specialty-tags",
        label: "Specialty Tags",
        Icon: FiTag,
        roles: ["admin", "super_admin"],
      },
      {
        type: "link",
        to: "/admin-panel/users/all",
        label: "All Users",
        Icon: FiUsers,
        roles: ["admin", "super_admin"],
      },
      {
        type: "link",
        to: "/admin-panel/explorer-activity",
        label: "Explorer Activity",
        Icon: FiActivity,
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
