import {
  FiBarChart2,
  FiSettings,
  FiShield,
  FiUsers,
  FiMessageSquare,
  FiTag,
  FiMapPin,
  FiFileText,
  FiLayers,
  FiActivity,
} from "react-icons/fi";

import { MdStorefront } from "react-icons/md";
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
        label: "Businesses",
        Icon: MdStorefront,
        roles: ["admin", "super_admin"],
        activePaths: [
          "/admin-panel/businesses",
          "/admin-panel/businesses/[businessId]",
        ],
      },
      {
        type: "link",
        to: "/admin-panel/businesses/applications",
        label: "Merchant Applications",
        Icon: FiFileText,
        roles: ["admin", "super_admin"],
        activePaths: [
          "/admin-panel/businesses/applications",
          "/admin-panel/business/application/[applicationId]",
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
        to: "/admin-panel/transit-network",
        label: "Transit Network",
        Icon: FiMapPin,
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
        to: "/admin-panel/review-disputes",
        label: "Review Disputes",
        Icon: FiMessageSquare,
        roles: ["admin", "super_admin"],
        activePaths: [
          "/admin-panel/review-disputes",
          "/admin-panel/review-disputes/[disputeId]",
        ],
      },
      {
        type: "link",
        to: "/admin-panel/flags-suspicious",
        label: "Flags & Suspicious",
        Icon: FiShield,
        roles: ["admin", "super_admin"],
        activePaths: [
          "/admin-panel/flags-suspicious",
          "/admin-panel/flags-suspicious/[flagId]",
        ],
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
