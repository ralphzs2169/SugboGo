import React from 'react';
import { ArrowRight } from 'lucide-react';

function ActionCard({ title, description, Icon, iconColor, iconBg }) {
  return (
    <div className="group relative flex items-center justify-between rounded-2xl border border-stroke bg-background-primary p-6 shadow-sm hover:shadow-md cursor-pointer">
      <div className="flex items-center gap-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconBg} ${iconColor}`}>
          <Icon className="h-5 w-5 stroke-[2]" />
        </div>
        <div>
          <h3 className="text-xs font-black tracking-wide text-text-primary uppercase">{title}</h3>
          <p className="text-xs text-text-secondary mt-0.5">{description}</p>
        </div>
      </div>
      <ArrowRight className="h-6 w-6 text-text-secondary transition-transform group-hover:translate-x-1" />
    </div>
  );
};

export default ActionCard;