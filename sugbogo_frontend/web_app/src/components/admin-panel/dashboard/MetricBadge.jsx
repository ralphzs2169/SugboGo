import React from 'react';
import { ArrowUp, AlertTriangle } from 'lucide-react';

function MetricBadge({ variant, text }) {
  const styles = {
    success: 'bg-emerald-50 text-emerald-600 border-emerald-100/60',
    warning: 'bg-amber-50 text-amber-600 border-amber-100/60',
    danger: 'bg-rose-50 text-rose-600 border-rose-100/60',
  };

  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[11px] font-bold tracking-wide ${styles[variant]}`}>
      {variant === 'success' && <ArrowUp className="h-3 w-3 stroke-[3]" />}
      {variant === 'danger' && <AlertTriangle className="h-3 w-3 stroke-[2.5]" />}
      {text}
    </span>
  );
};

export default MetricBadge;