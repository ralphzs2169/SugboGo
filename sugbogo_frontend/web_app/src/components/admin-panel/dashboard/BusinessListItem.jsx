import React from 'react';
import StatusBadge from './StatusBadge';

const BusinessListItem = ({ name, subtitle, image, badgeText, badgeVariant, rightStat, rightStatLabel }) => {
  return (
    <div className="flex items-center justify-between py-3 first:pt-0 last:pb-0 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-3">
        <img src={image} alt={name} className="h-11 w-11 rounded-xl object-cover bg-slate-100" />
        <div>
          <h4 className="text-sm font-bold text-slate-900 leading-tight">{name}</h4>
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        </div>
      </div>
      
      {/* Dynamic Right Side: either a mini badge or stacked trending metrics */}
      {badgeText && <StatusBadge variant={badgeVariant} text={badgeText} />}
      
      {rightStat && (
        <div className="text-right">
          <span className="block text-sm font-black text-[#f27e13] leading-none">{rightStat}</span>
          <span className="text-[9px] font-bold tracking-wider text-slate-400 uppercase block mt-0.5">{rightStatLabel}</span>
        </div>
      )}
    </div>
  );
};

export default BusinessListItem;