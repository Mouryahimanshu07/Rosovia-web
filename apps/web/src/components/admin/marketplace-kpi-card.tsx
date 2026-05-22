'use client';

interface MarketplaceKpiCardProps {
  label: string;
  value: string | number;
  icon?: string;
  description?: string;
  variant?: 'default' | 'warning' | 'success' | 'danger' | 'purple';
}

export function MarketplaceKpiCard({
  label,
  value,
  icon,
  description,
  variant = 'default',
}: MarketplaceKpiCardProps) {
  const variantStyles = {
    default: 'bg-white border-gray-200 text-gray-900',
    warning: 'bg-amber-50/70 border-amber-200 text-amber-950',
    success: 'bg-emerald-50/70 border-emerald-200 text-emerald-950',
    danger: 'bg-rose-50/70 border-rose-200 text-rose-950',
    purple: 'bg-indigo-50/70 border-indigo-200 text-indigo-950',
  };

  return (
    <div className={`rounded-xl border p-5 ${variantStyles[variant]} transition-all duration-300 hover:shadow-md hover:-translate-y-0.5`}>
      <div className="flex items-center justify-between mb-2">
        {icon && (
          <div className="w-10 h-10 rounded-lg bg-white/60 flex items-center justify-center border shadow-xs">
            <span className="text-xl" aria-hidden="true">{icon}</span>
          </div>
        )}
        <span className="text-2xl font-extrabold tracking-tight">{value}</span>
      </div>
      <p className="text-sm font-bold text-gray-800">{label}</p>
      {description && <p className="text-[11px] mt-1.5 opacity-70 font-medium leading-normal">{description}</p>}
    </div>
  );
}
