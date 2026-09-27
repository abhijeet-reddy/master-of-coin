import { Link } from 'react-router-dom';
import { EmptyState, buttonClass } from '@/ui';
import { ButtonVariant, ControlSize } from '@/ui/types';

export default function NotFound() {
  return (
    <EmptyState
      title="Page not found"
      description="There is nothing at this address. It may have moved, or the link is wrong."
      action={
        <Link to="/dashboard" className={buttonClass(ButtonVariant.Primary, ControlSize.Md)}>
          Go to dashboard
        </Link>
      }
    />
  );
}
