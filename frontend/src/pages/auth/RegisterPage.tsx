import { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { Box, Button, Container, Heading, Input, Stack, Text, Link, Card } from '@chakra-ui/react';
import { Field } from '@/components/ui/field';
import { useAuth } from '@/contexts/AuthContext';
import type { RegisterRequest, ApiError } from '@/types';

export function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [formData, setFormData] = useState<RegisterRequest>({
    username: '',
    email: '',
    name: '',
    password: '',
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate passwords match
    if (formData.password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Basic password validation
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setIsLoading(true);

    try {
      await register(formData);
      // Auto-login after registration, redirect to dashboard
      navigate('/dashboard', { replace: true });
    } catch (err) {
      let errorMessage = 'Registration failed. Please try again.';
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
            Create your account
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

              <Field label="Username" required>
                <Input
                  name="username"
                  type="text"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="Choose a username"
                  autoComplete="username"
                  required
                />
              </Field>

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

              <Field label="Full Name" required>
                <Input
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Enter your full name"
                  autoComplete="name"
                  required
                />
              </Field>

              <Field label="Password" required helperText="Must be at least 8 characters">
                <Input
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Create a password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
              </Field>

              <Field label="Confirm Password" required>
                <Input
                  name="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  autoComplete="new-password"
                  required
                  minLength={8}
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
                Create Account
              </Button>
            </Stack>
          </form>
        </Card.Body>

        <Card.Footer>
          <Text textAlign="center" fontSize="sm" width="full">
            Already have an account?{' '}
            <Link asChild color="blue.600" fontWeight="medium">
              <RouterLink to="/login">Sign in</RouterLink>
            </Link>
          </Text>
        </Card.Footer>
      </Card.Root>
    </Container>
  );
}
