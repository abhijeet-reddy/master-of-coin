import { Field as ChakraField } from '@chakra-ui/react';
import type { ReactNode } from 'react';

interface FieldProps {
  label: string;
  required?: boolean;
  helperText?: string;
  children: ReactNode;
}

export function Field({ label, required, helperText, children }: FieldProps) {
  return (
    <ChakraField.Root>
      <ChakraField.Label>
        {label}
        {required && <span style={{ color: 'red' }}> *</span>}
      </ChakraField.Label>
      {children}
      {helperText && <ChakraField.HelperText>{helperText}</ChakraField.HelperText>}
    </ChakraField.Root>
  );
}
