import type { Person } from '@/api/types';
import { ConfirmDialog } from '@/ui';
import { useDeletePerson } from '../hooks/usePeopleMutations';
import styles from './People.module.css';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  person: Person;
  onDeleted?: () => void;
}

export function DeletePersonDialog({ open, onOpenChange, person, onDeleted }: Props) {
  const del = useDeletePerson();
  const shared = person.transaction_count;
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Delete ${person.name}?`}
      confirmLabel="Delete person"
      onConfirm={async () => {
        await del.mutateAsync(person);
        onDeleted?.();
      }}
    >
      <p className={styles.confirmText}>
        {shared
          ? `${person.name} is on ${shared} shared ${shared === 1 ? 'transaction' : 'transactions'}. The server keeps people who have shared transactions, so remove those splits first.`
          : 'Their split provider link goes too. This cannot be undone.'}
      </p>
    </ConfirmDialog>
  );
}
