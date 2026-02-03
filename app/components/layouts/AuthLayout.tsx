import type { ReactNode } from "react";

export interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 p-5">
      <div className="bg-white rounded-2xl p-10 w-full max-w-md shadow-xl border border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-2 tracking-tight">
          {title}
        </h1>
        <p className="text-sm text-gray-500 text-center mb-8 font-medium">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}
