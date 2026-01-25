import { Alert } from '@chakra-ui/react';

interface ErrorAlertProps {
  title?: string;
  error: Error;
  defaultMessage?: string;
}

export const ErrorAlert = ({
  title,
  error,
  defaultMessage = 'An unexpected error occurred',
}: ErrorAlertProps) => {
  const errorMessage = error instanceof Error ? error.message : defaultMessage;

  return (
    <Alert.Root status="error" mb={4}>
      <Alert.Indicator />
      {title && <Alert.Title>{title}</Alert.Title>}
      <Alert.Description>{errorMessage}</Alert.Description>
    </Alert.Root>
  );
};
