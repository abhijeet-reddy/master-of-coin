import { Field as ChakraField } from '@chakra-ui/react';
import type { ReactNode } from 'react';

interface FieldProps {
  label: string;
  required?: boolean;
  helperText?: string;
  errorText?: string;
  children: ReactNode;
}

export function Field({ label, required, helperText, errorText, children }: FieldProps) {
  return (
    <ChakraField.Root invalid={!!errorText}>
      <ChakraField.Label>
        {label}
        {required && <span style={{ color: 'red' }}> *</span>}
      </ChakraField.Label>
      {children}
      {helperText && !errorText && <ChakraField.HelperText>{helperText}</ChakraField.HelperText>}
      {errorText && <ChakraField.ErrorText>{errorText}</ChakraField.ErrorText>}
    </ChakraField.Root>
  );
}
