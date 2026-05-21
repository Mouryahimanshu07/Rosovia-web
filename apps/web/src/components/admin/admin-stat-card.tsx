interface AdminStatCardProps {
  label: string;
  value: number;
  icon?: string;
  variant?: 'default' | 'warning' | 'success' | 'danger';
  href?: string;
}

export function AdminStatCard({
  label,
  value,
  icon,
  variant = 'default',
  href,
}: AdminStatCardProps) {
  const variantStyles = {
    default: 'bg-white border-gray-200 text-gray-900',
    warning: 'bg-amber-50 border-amber-200 text-amber-900',
    success: 'bg-green-50 border-green-200 text-green-900',
    danger: 'bg-red-50 border-red-200 text-red-900',
  };

  const content = (
    <div className={`rounded-xl border p-5 ${variantStyles[variant]} transition-shadow hover:shadow-sm`}>
      <div className="flex items-center justify-between mb-2">
        {icon && <span className="text-2xl" aria-hidden="true">{icon}</span>}
        <span className="text-2xl font-bold ml-auto">{value.toLocaleString('en-IN')}</span>
      </div>
      <p className="text-sm font-medium opacity-80">{label}</p>
    </div>
  );

  if (href) {
    return <a href={href} className="block">{content}</a>;
  }
  return content;
}
