import React from 'react';
import MetricCard from './MetricCard';
import { Users, Store, FileText, ShieldAlert } from 'lucide-react';

function MetricRow() {
  const metrics = [
    {
      title: "Active Explorers",
      value: "12,482",
      badgeVariant: "success",
      badgeText: "842",
      footerText: "+842 This Week",
      footerColor: "text-emerald-600",
    },
    {
      title: "Active Merchants",
      value: "1,156",
      badgeVariant: "success",
      badgeText: "14",
      footerText: "+14 This Week",
      footerColor: "text-emerald-600",
    },
    {
      title: "Pending Applications",
      value: "43",
      badgeVariant: "warning",
      badgeText: "HIGH",
      footerText: "12 Awaiting Urgent Review",
      footerColor: "text-amber-500",
    },
    {
      title: "Suspicious Activity",
      value: "12",
      badgeVariant: "danger",
      badgeText: "12",
      footerText: "Flagged for Manual Review",
      footerColor: "text-rose-600",
    },
  ];

  return (
    <div className="w-full bg-background-secondary">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 max-w-7xl mx-auto">
        {metrics.map((metric, index) => (
          <MetricCard
            key={index}
            title={metric.title}
            value={metric.value}
            badgeVariant={metric.badgeVariant}
            badgeText={metric.badgeText}
            footerText={metric.footerText}
            footerColor={metric.footerColor}
          />
        ))}
      </div>
    </div>
  );
};

export default MetricRow;