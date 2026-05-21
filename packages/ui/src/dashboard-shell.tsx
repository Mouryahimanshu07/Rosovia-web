import * as React from "react";

export interface DashboardShellProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  title: string;
  description?: string;
}

export function DashboardShell({ children, title, description, className = '', ...props }: DashboardShellProps) {
  return (
    <div className={`flex flex-col gap-6 p-8 ${className}`} {...props}>
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">{title}</h1>
        {description && <p className="text-gray-500 mt-1">{description}</p>}
      </div>
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}
