import React from 'react';
import MetricBadge from './MetricBadge'

function MetricCard({ title, value, badgeVariant, badgeText, footerText, footerColor, Icon }) {
  return (
    <div className="relative overflow-hidden rounded-[24px] border border-stroke bg-background-primary p-6 shadow-sm transition-all hover:shadow-md flex flex-col justify-between min-h-[165px]">

      {/* Top Section: Title & Top Right MetricBadge */}
      <div className="relative z-10 flex items-start justify-between gap-4">
        <h3 className="text-[11px] font-bold tracking-widest text-text-secondary uppercase leading-relaxed max-w-[130px]">
          {title}
        </h3>
        <MetricBadge variant={badgeVariant} text={badgeText} />
      </div>

      {/* Bottom Section: Primary Value & Trend Footer */}
      <div className="relative z-10 mt-5">
        <div className="text-4xl font-extrabold tracking-tight text-text-primary">
          {value}
        </div>
        <p className={`mt-2 text-[10px] font-bold tracking-wider uppercase ${footerColor}`}>
          {footerText}
        </p>
      </div>
    </div>
  );
};

export default MetricCard;