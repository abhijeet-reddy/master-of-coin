import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toApiError } from '@/api/client';
import type { Category } from '@/api/types';
import { categoryDefaults, categorySchema, type CategoryFormValues } from '../forms/categoryForm';
import { useSaveCategory } from './useCategoryMutations';

/** Create or edit a category. A failed save shows its message at the top of the form. */
export function useCategoryForm(category: Category | undefined, onSaved: () => void) {
  const save = useSaveCategory(category);
  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: categoryDefaults(category),
  });
  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync(values);
      onSaved();
    } catch (err) {
      form.setError('root', { message: toApiError(err).message });
    }
  });
  return { form, submit, saving: save.isPending, creating: !category };
}
