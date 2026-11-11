import {
  FiBarChart2,
  FiShield,
  FiUsers,
  FiCompass,
  FiMapPin,
  FiCheckSquare,
  FiEdit,
  FiMessageSquare,
  FiTrendingUp,
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
const navigation = [
  {
    section: "Management",
    items: [
      {
        type: "link",
        to: "/admin-panel/businesses",
        label: "Business Management",
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
        Icon: FiCheckSquare,
        roles: ["admin", "super_admin"],
        activePaths: [
          "/admin-panel/businesses/applications",
          "/admin-panel/business/application/[applicationId]",
        ],
      },
      {
        type: "link",
        to: "/admin-panel/businesses/update-requests",
        label: "Update Requests",
        Icon: FiEdit,
        roles: ["admin", "super_admin"],
        activePaths: [
          "/admin-panel/businesses/update-requests",
          "/admin-panel/businesses/update-requests/[requestId]",
          "/admin-panel/businesses/update-requests/classification/[requestId]",
          "/admin-panel/businesses/update-requests/location/[requestId]",
        ],
      },
      {
        type: "link",
        to: "/admin-panel/business-taxonomy",
        label: "Business Taxonomy",
        Icon: FiLayers,
        roles: ["admin", "super_admin"],
      },
      {
        type: "link",
        to: "/admin-panel/users/all",
        label: "All Users",
        Icon: FiUsers,
        roles: ["admin", "super_admin"],
        activePaths: [
          "/admin-panel/users/all",
          "/admin-panel/users/[userId]",
        ],
      },
    ],
  },

  {
    section: "Discovery",
    items: [
      {
        type: "link",
        to: "/admin-panel/explore-configuration",
        label: "Explore Configuration",
        Icon: FiCompass,
        roles: ["admin", "super_admin"],
      },
      {
        type: "link",
        to: "/admin-panel/transit-network",
        label: "Transit Network",
        Icon: FiMapPin,
        roles: ["admin", "super_admin"],
        activePaths: ["/admin-panel/transit-network"],
      },
    ],
  },

  {
    section: "Trust & Safety",
    items: [
      {
        type: "link",
        to: "/admin-panel/reviews",
        label: "All Reviews",
        Icon: FiMessageSquare,
        roles: ["admin", "super_admin"],
      },
      {
        type: "link",
        to: "/admin-panel/moderation-integrity",
        label: "Moderation & Integrity",
        Icon: FiShield,
        roles: ["admin", "super_admin"],
        activePaths: [
          "/admin-panel/moderation-integrity",
          "/admin-panel/review-disputes/[disputeId]",
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
      {
        type: "link",
        to: "/admin-panel/analytics/discovery-scores",
        label: "Discovery Scores",
        Icon: FiTrendingUp,
        roles: ["admin", "super_admin"],
      },
    ],
  },

  {
    section: "System",
    items: [
      {
        type: "link",
        to: "/admin-panel/activity-logs",
        label: "Activity Logs",
        Icon: FiActivity,
        roles: ["admin", "super_admin"],
      },
    ],
  },
];

export default navigation;
