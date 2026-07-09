import React from 'react';
import { CheckSquare, Tag, Flag, Plus } from 'lucide-react';
import ActionCard from './ActionCard';

function QuickActions() {
  return (
    <div className="relative flex flex-col gap-4 h-full justify-between">
      <ActionCard 
        title="Verify Merchant Submissions" 
        description="43 pending listings need validation" 
        Icon={CheckSquare} 
        iconColor="text-orange-600" 
        iconBg="bg-orange-50/60"
      />
      <ActionCard 
        title="Approve Pending Tags" 
        description="Categorization requests awaiting audit" 
        Icon={Tag} 
        iconColor="text-orange-600" 
        iconBg="bg-orange-50/60"
      />
      <ActionCard 
        title="Review Flagged Activity" 
        description="Audit reports for community violations" 
        Icon={Flag} 
        iconColor="text-orange-600" 
        iconBg="bg-orange-50/60"
      />

      {/* Floating Action Button Overlapping Bottom Right */}
      <button className="absolute -bottom-2 -right-2 flex h-14 w-14 items-center justify-center rounded-full bg-[#f27e13] text-white shadow-lg shadow-orange-500/30 transition-transform hover:scale-105 active:scale-95 focus:outline-none z-20">
        <Plus className="h-6 w-6 stroke-[2.5]" />
      </button>
    </div>
  );
};

export default QuickActions;