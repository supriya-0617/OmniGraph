import React from 'react';

interface Props {
  id: string;
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

export const AuthField: React.FC<Props> = ({ id, label, icon, children }) => (
  <div className="auth-field">
    <label htmlFor={id} className="mb-2 block text-sm font-medium">
      {label}
    </label>
    <div className="relative">
      {icon}
      {children}
    </div>
  </div>
);
