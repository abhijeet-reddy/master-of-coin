import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export function useHeaderMenu() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleMenuSelect = (value: string) => {
    switch (value) {
      case 'settings':
        void navigate('/settings');
        break;
      case 'logout':
        logout();
        void navigate('/login');
        break;
    }
  };

  return { handleMenuSelect };
}
