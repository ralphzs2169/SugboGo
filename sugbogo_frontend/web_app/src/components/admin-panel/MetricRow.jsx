import React from "react";
import MetricCard from "./MetricCard";
import { Store, Hourglass, Users, Network } from "lucide-react";

function MetricRow() {
  const metrics = [
    {
      title: "Active MSMEs",
      value: "1,248",
      badgeVariant: "success",
      badgeText: "12%",
      Icon: Store,
      iconBg: "bg-orange-50/60",
      iconColor: "text-orange-500",
    },
    {
      title: "Onboarding",
      value: "18 Pending",
      Icon: Hourglass,
      iconBg: "bg-blue-50/60",
      iconColor: "text-blue-500",
    },
    {
      title: "Total MSMEs",
      value: "1,248",
      Icon: Users,
      iconBg: "bg-emerald-50/60",
      iconColor: "text-emerald-500",
    },
    {
      title: "Top Cluster",
      value: "Culinary",
      Icon: Network,
      iconBg: "bg-purple-50/60",
      iconColor: "text-purple-600",
      valueColor: "text-purple-600", // Passes the matching purple down to the value
    },
  ];

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 w-full">
        {metrics.map((metric, index) => (
          <MetricCard
            key={index}
            title={metric.title}
            value={metric.value}
            badgeVariant={metric.badgeVariant}
            badgeText={metric.badgeText}
            Icon={metric.Icon}
            iconBg={metric.iconBg}
            iconColor={metric.iconColor}
            valueColor={metric.valueColor}
          />
        ))}
      </div>
    </div>
  );
}

export default MetricRow;
