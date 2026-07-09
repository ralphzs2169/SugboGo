import React from 'react';

const StatusBadge = ({ variant, text }) => {
  const styles = {
    critical: 'bg-rose-50 text-rose-500',
    growth: 'bg-amber-50 text-amber-600',
    warning: 'bg-amber-50 text-amber-600',
    muted: 'bg-slate-100 text-slate-500',
  };

  return (
    <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold tracking-widest uppercase ${styles[variant] || styles.muted}`}>
      {text}
    </span>
  );
};

export default StatusBadge;