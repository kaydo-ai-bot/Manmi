import React, { useState, useEffect } from 'react';
import { LoginPage } from './LoginPage';
import { OwnerDashboard } from '../components/OwnerDashboard';

interface OwnerPageProps {
  onNotificationTrigger?: () => void;
  onNavigateToPairing?: () => void;
}

export const OwnerPage: React.FC<OwnerPageProps> = ({
  onNotificationTrigger,
  onNavigateToPairing,
}) => {
  const [token, setToken] = useState<string>(() => {
    return sessionStorage.getItem('shado_owner_token') || '';
  });

  const handleLogout = () => {
    sessionStorage.removeItem('shado_owner_token');
    setToken('');
  };

  const handleLoginSuccess = (newToken: string) => {
    setToken(newToken);
  };

  if (!token) {
    return (
      <LoginPage
        onSuccess={handleLoginSuccess}
        onCancel={onNavigateToPairing}
      />
    );
  }

  return (
    <OwnerDashboard
      ownerToken={token}
      onLogout={handleLogout}
      onNotificationTrigger={onNotificationTrigger}
      onNavigateToPairing={onNavigateToPairing}
    />
  );
};
