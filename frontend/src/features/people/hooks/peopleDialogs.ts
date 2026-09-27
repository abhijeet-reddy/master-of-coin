/** Which person dialog is open, shared by the list and the detail page. */
import { createContext, useContext } from 'react';
import type { Person } from '@/api/types';

export enum PersonDialog {
  Form = 'form',
  Delete = 'delete',
  Settle = 'settle',
  Link = 'link',
}

export interface PersonDialogState {
  kind: PersonDialog;
  open: boolean;
  person?: Person;
  onDone?: () => void;
  seq: number;
}

export interface PeopleDialogsApi {
  openCreate: () => void;
  openEdit: (person: Person) => void;
  confirmDelete: (person: Person, onDeleted?: () => void) => void;
  openSettle: (person: Person) => void;
  openLink: (person: Person) => void;
}

export const PeopleDialogsContext = createContext<PeopleDialogsApi | null>(null);

export function usePeopleDialogs(): PeopleDialogsApi {
  const ctx = useContext(PeopleDialogsContext);
  if (!ctx) throw new Error('usePeopleDialogs needs a <PeopleDialogsProvider>');
  return ctx;
}
