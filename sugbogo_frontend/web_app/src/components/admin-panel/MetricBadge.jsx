import React from 'react';
import { ArrowUp } from 'lucide-react';

/**
 * Compact status badge used inside metric cards to display trend or category indicators.
 *
 * @component
 * @param {string} variant - Visual style preset determining badge color palette ('success' | 'warning' | 'danger').
 * @param {string} text - Badge label text displayed alongside the trend icon.
 */
function MetricBadge({ variant, text }) {
  if (!text) return null;

  const styles = {
    success: 'bg-emerald-50 text-emerald-600 border-emerald-100/60',
    warning: 'bg-amber-50 text-amber-600 border-amber-100/60',
    danger: 'bg-rose-50 text-rose-600 border-rose-100/60',
  };

  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[11px] font-bold tracking-wide ${styles[variant] || styles.success}`}>
      {variant === 'success' && <ArrowUp className="h-3 w-3 stroke-[3]" />}
      {text}
    </span>
  );
}

export default MetricBadge;