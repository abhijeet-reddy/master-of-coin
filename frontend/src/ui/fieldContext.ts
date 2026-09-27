import { createContext, useContext } from 'react';

export interface FieldContextValue {
  id: string;
  describedBy?: string;
  invalid: boolean;
  required: boolean;
}

export const FieldContext = createContext<FieldContextValue | null>(null);

/** Control props wired to the surrounding <Field>, if any. */
export function useFieldControl(own: { id?: string; 'aria-describedby'?: string }) {
  const field = useContext(FieldContext);
  return {
    id: own.id ?? field?.id,
    'aria-describedby': own['aria-describedby'] ?? field?.describedBy,
    'aria-invalid': field?.invalid || undefined,
    'aria-required': field?.required || undefined,
  };
}
