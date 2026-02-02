import { Component, type ReactNode } from 'react';
import { Box, Button, Container, Heading, Text, VStack } from '@chakra-ui/react';
import { MdError, MdRefresh } from 'react-icons/md';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary component to catch React errors and display a fallback UI
 *
 * Usage:
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // You could also log to an error reporting service here
    // Example: logErrorToService(error, errorInfo);
  }

  handleReload = () => {
    // Reset error state and reload the page
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleReset = () => {
    // Just reset the error state without reloading
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <Container maxW="container.md" py={20}>
          <VStack gap={6} textAlign="center">
            <Box as={MdError} boxSize={20} color="red.500" />

            <Heading size="xl">Oops! Something went wrong</Heading>

            <Text color="fg.muted" fontSize="lg">
              We encountered an unexpected error. Please try reloading the page.
            </Text>

            {this.state.error && (
              <Box
                p={4}
                bg="red.50"
                borderRadius="md"
                borderWidth="1px"
                borderColor="red.200"
                maxW="full"
                overflow="auto"
              >
                <Text fontSize="sm" fontFamily="mono" color="red.800">
                  {this.state.error.message}
                </Text>
              </Box>
            )}

            <VStack gap={3} pt={4}>
              <Button
                colorScheme="blue"
                size="lg"
                onClick={this.handleReload}
                aria-label="Reload page"
              >
                <MdRefresh />
                Reload Page
              </Button>

              <Button variant="ghost" onClick={this.handleReset} aria-label="Try again">
                Try Again
              </Button>
            </VStack>
          </VStack>
        </Container>
      );
    }

    return this.props.children;
  }
}
