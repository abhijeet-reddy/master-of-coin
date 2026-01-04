import { useState } from 'react';
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import { Box, Button, Container, Heading, Input, Stack, Text, Link, Card } from '@chakra-ui/react';
import { Field } from '@/components/ui/field';
import { useAuth } from '@/contexts/AuthContext';
import type { LoginRequest, ApiError } from '@/types';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [formData, setFormData] = useState<LoginRequest>({
    email: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get the intended destination from location state, default to dashboard
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login(formData);
      // Redirect to intended destination or dashboard
      navigate(from, { replace: true });
    } catch (err) {
      let errorMessage = 'Login failed. Please check your credentials.';
      if (err instanceof Error) {
        try {
          const apiError = JSON.parse(err.message) as ApiError;
          errorMessage = apiError.message;
        } catch {
          errorMessage = err.message;
        }
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  return (
    <Container maxW="md" py={12}>
      <Card.Root>
        <Card.Header>
          <Heading size="xl" textAlign="center">
            Master of Coin
          </Heading>
          <Text textAlign="center" color="gray.600" mt={2}>
            Sign in to your account
          </Text>
        </Card.Header>

        <Card.Body>
          <form onSubmit={(e) => void handleSubmit(e)}>
            <Stack gap={4}>
              {error && (
                <Box bg="red.50" color="red.800" p={3} borderRadius="md" fontSize="sm">
                  {error}
                </Box>
              )}

              <Field label="Email" required>
                <Input
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Enter your email"
                  autoComplete="email"
                  required
                />
              </Field>

              <Field label="Password" required>
                <Input
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
              </Field>

              <Button
                type="submit"
                colorScheme="blue"
                size="lg"
                width="full"
                loading={isLoading}
                mt={2}
              >
                Sign In
              </Button>
            </Stack>
          </form>
        </Card.Body>

        <Card.Footer>
          <Text textAlign="center" fontSize="sm" width="full">
            Don't have an account?{' '}
            <Link asChild color="blue.600" fontWeight="medium">
              <RouterLink to="/register">Sign up</RouterLink>
            </Link>
          </Text>
        </Card.Footer>
      </Card.Root>
    </Container>
  );
}
