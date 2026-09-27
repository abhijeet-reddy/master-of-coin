import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toApiError } from '@/api/client';
import type { Person } from '@/api/types';
import { personDefaults, personSchema, type PersonFormValues } from '../forms/personForm';
import { useSavePerson } from './usePeopleMutations';

/** Add or edit a person. A failed save shows its message at the top of the form. */
export function usePersonForm(person: Person | undefined, onSaved: () => void) {
  const save = useSavePerson(person);
  const form = useForm<PersonFormValues>({
    resolver: zodResolver(personSchema),
    defaultValues: personDefaults(person),
  });
  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync(values);
      onSaved();
    } catch (err) {
      form.setError('root', { message: toApiError(err).message });
    }
  });
  return { form, submit, saving: save.isPending, creating: !person };
}
