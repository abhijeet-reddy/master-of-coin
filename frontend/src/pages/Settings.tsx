import { useState } from 'react';
import {
  Box,
  Container,
  Card,
  Heading,
  Text,
  Button,
  Input,
  VStack,
  HStack,
  Tabs,
  Grid,
  Badge,
  Link,
  Separator,
} from '@chakra-ui/react';
import { PageHeader } from '@/components/common';
import { useDocumentTitle } from '@/hooks/effects';
import { useAuth } from '@/contexts/AuthContext';
import { MdPerson, MdSettings, MdSecurity, MdInfo, MdSave } from 'react-icons/md';
import { Field } from '@/components/ui/field';
import { useColorMode } from '@/components/ui/color-mode';

export const Settings = () => {
  useDocumentTitle('Settings');
  const { user } = useAuth();
  const { colorMode, toggleColorMode } = useColorMode();

  // Profile state (max 1 useState per component)
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    username: user?.username || '',
  });

  // Preferences state
  const [preferences, setPreferences] = useState({
    currency: 'USD',
    dateFormat: 'MM/DD/YYYY',
    numberFormat: 'en-US',
    theme: colorMode,
  });

  // Password state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [isSaving, setIsSaving] = useState(false);

  const handleProfileUpdate = async () => {
    setIsSaving(true);
    try {
      // TODO: Implement profile update API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      console.log('Profile updated:', profileData);
    } catch (error) {
      console.error('Failed to update profile:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreferencesUpdate = async () => {
    setIsSaving(true);
    try {
      // TODO: Implement preferences update API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      console.log('Preferences updated:', preferences);
    } catch (error) {
      console.error('Failed to update preferences:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    setIsSaving(true);
    try {
      // TODO: Implement password change API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      console.log('Password changed');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      console.error('Failed to change password:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Container maxW="container.xl" py={8}>
      <PageHeader title="Settings" subtitle="Manage your account and preferences" />

      <Tabs.Root defaultValue="profile" variant="enclosed">
        <Tabs.List mb={6}>
          <Tabs.Trigger value="profile">
            <HStack gap={2}>
              <Box as={MdPerson} />
              <Text>Profile</Text>
            </HStack>
          </Tabs.Trigger>
          <Tabs.Trigger value="preferences">
            <HStack gap={2}>
              <Box as={MdSettings} />
              <Text>Preferences</Text>
            </HStack>
          </Tabs.Trigger>
          <Tabs.Trigger value="security">
            <HStack gap={2}>
              <Box as={MdSecurity} />
              <Text>Security</Text>
            </HStack>
          </Tabs.Trigger>
          <Tabs.Trigger value="about">
            <HStack gap={2}>
              <Box as={MdInfo} />
              <Text>About</Text>
            </HStack>
          </Tabs.Trigger>
        </Tabs.List>

        {/* Profile Tab */}
        <Tabs.Content value="profile">
          <Card.Root>
            <Card.Header>
              <Heading size="md">Profile Information</Heading>
              <Text color="gray.600" fontSize="sm">
                Update your personal information
              </Text>
            </Card.Header>
            <Card.Body>
              <VStack gap={4} alignItems="stretch">
                <Field label="Username" required>
                  <Input
                    value={profileData.username}
                    onChange={(e) => setProfileData({ ...profileData, username: e.target.value })}
                    disabled
                  />
                  <Text fontSize="xs" color="gray.500" mt={1}>
                    Username cannot be changed
                  </Text>
                </Field>

                <Field label="Full Name" required>
                  <Input
                    value={profileData.name}
                    onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                    placeholder="Enter your full name"
                  />
                </Field>

                <Field label="Email" required>
                  <Input
                    type="email"
                    value={profileData.email}
                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                    placeholder="Enter your email"
                  />
                </Field>

                <Box pt={4}>
                  <Button
                    colorScheme="blue"
                    onClick={() => void handleProfileUpdate()}
                    loading={isSaving}
                    aria-label="Save profile changes"
                  >
                    <Box as={MdSave} mr={2} />
                    Save Changes
                  </Button>
                </Box>
              </VStack>
            </Card.Body>
          </Card.Root>
        </Tabs.Content>

        {/* Preferences Tab */}
        <Tabs.Content value="preferences">
          <VStack gap={6} alignItems="stretch">
            <Card.Root>
              <Card.Header>
                <Heading size="md">Display Preferences</Heading>
                <Text color="gray.600" fontSize="sm">
                  Customize how information is displayed
                </Text>
              </Card.Header>
              <Card.Body>
                <VStack gap={4} alignItems="stretch">
                  <Field label="Default Currency">
                    <select
                      value={preferences.currency}
                      onChange={(e) => setPreferences({ ...preferences, currency: e.target.value })}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0',
                        width: '100%',
                      }}
                    >
                      <option value="USD">USD - US Dollar</option>
                      <option value="EUR">EUR - Euro</option>
                      <option value="GBP">GBP - British Pound</option>
                      <option value="JPY">JPY - Japanese Yen</option>
                      <option value="CAD">CAD - Canadian Dollar</option>
                      <option value="AUD">AUD - Australian Dollar</option>
                    </select>
                  </Field>

                  <Field label="Date Format">
                    <select
                      value={preferences.dateFormat}
                      onChange={(e) =>
                        setPreferences({ ...preferences, dateFormat: e.target.value })
                      }
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0',
                        width: '100%',
                      }}
                    >
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                  </Field>

                  <Field label="Number Format">
                    <select
                      value={preferences.numberFormat}
                      onChange={(e) =>
                        setPreferences({ ...preferences, numberFormat: e.target.value })
                      }
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0',
                        width: '100%',
                      }}
                    >
                      <option value="en-US">1,234.56 (US)</option>
                      <option value="de-DE">1.234,56 (German)</option>
                      <option value="fr-FR">1 234,56 (French)</option>
                    </select>
                  </Field>

                  <Field label="Theme">
                    <HStack gap={4}>
                      <Button
                        variant={colorMode === 'light' ? 'solid' : 'outline'}
                        onClick={() => {
                          if (colorMode === 'dark') toggleColorMode();
                          setPreferences({ ...preferences, theme: 'light' });
                        }}
                      >
                        Light
                      </Button>
                      <Button
                        variant={colorMode === 'dark' ? 'solid' : 'outline'}
                        onClick={() => {
                          if (colorMode === 'light') toggleColorMode();
                          setPreferences({ ...preferences, theme: 'dark' });
                        }}
                      >
                        Dark
                      </Button>
                    </HStack>
                  </Field>

                  <Box pt={4}>
                    <Button
                      colorScheme="blue"
                      onClick={() => void handlePreferencesUpdate()}
                      loading={isSaving}
                      aria-label="Save preferences"
                    >
                      <Box as={MdSave} mr={2} />
                      Save Preferences
                    </Button>
                  </Box>
                </VStack>
              </Card.Body>
            </Card.Root>
          </VStack>
        </Tabs.Content>

        {/* Security Tab */}
        <Tabs.Content value="security">
          <VStack gap={6} alignItems="stretch">
            <Card.Root>
              <Card.Header>
                <Heading size="md">Change Password</Heading>
                <Text color="gray.600" fontSize="sm">
                  Update your password to keep your account secure
                </Text>
              </Card.Header>
              <Card.Body>
                <VStack gap={4} alignItems="stretch">
                  <Field label="Current Password" required>
                    <Input
                      type="password"
                      value={passwordData.currentPassword}
                      onChange={(e) =>
                        setPasswordData({ ...passwordData, currentPassword: e.target.value })
                      }
                      placeholder="Enter current password"
                    />
                  </Field>

                  <Field label="New Password" required>
                    <Input
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) =>
                        setPasswordData({ ...passwordData, newPassword: e.target.value })
                      }
                      placeholder="Enter new password"
                    />
                  </Field>

                  <Field label="Confirm New Password" required>
                    <Input
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) =>
                        setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                      }
                      placeholder="Confirm new password"
                    />
                  </Field>

                  <Box pt={4}>
                    <Button
                      colorScheme="blue"
                      onClick={() => void handlePasswordChange()}
                      loading={isSaving}
                      disabled={
                        !passwordData.currentPassword ||
                        !passwordData.newPassword ||
                        !passwordData.confirmPassword
                      }
                      aria-label="Change password"
                    >
                      Change Password
                    </Button>
                  </Box>
                </VStack>
              </Card.Body>
            </Card.Root>

            <Card.Root>
              <Card.Header>
                <Heading size="md">Two-Factor Authentication</Heading>
                <Text color="gray.600" fontSize="sm">
                  Add an extra layer of security to your account
                </Text>
              </Card.Header>
              <Card.Body>
                <HStack justifyContent="space-between">
                  <VStack alignItems="flex-start" gap={1}>
                    <Text fontWeight="medium">Status</Text>
                    <Badge colorScheme="gray">Not Enabled</Badge>
                  </VStack>
                  <Button variant="outline" disabled>
                    Enable 2FA (Coming Soon)
                  </Button>
                </HStack>
              </Card.Body>
            </Card.Root>

            <Card.Root>
              <Card.Header>
                <Heading size="md">Active Sessions</Heading>
                <Text color="gray.600" fontSize="sm">
                  Manage your active sessions
                </Text>
              </Card.Header>
              <Card.Body>
                <VStack gap={3} alignItems="stretch">
                  <Box p={3} borderWidth="1px" borderRadius="md">
                    <HStack justifyContent="space-between">
                      <VStack alignItems="flex-start" gap={1}>
                        <Text fontWeight="medium">Current Session</Text>
                        <Text fontSize="sm" color="gray.600">
                          Last active: Just now
                        </Text>
                      </VStack>
                      <Badge colorScheme="green">Active</Badge>
                    </HStack>
                  </Box>
                </VStack>
              </Card.Body>
            </Card.Root>
          </VStack>
        </Tabs.Content>

        {/* About Tab */}
        <Tabs.Content value="about">
          <Card.Root>
            <Card.Header>
              <Heading size="md">About Master of Coin</Heading>
            </Card.Header>
            <Card.Body>
              <VStack gap={6} alignItems="stretch">
                <Box>
                  <Text fontWeight="medium" mb={2}>
                    Version
                  </Text>
                  <Text color="gray.600">1.0.0</Text>
                </Box>

                <Separator />

                <Box>
                  <Text fontWeight="medium" mb={2}>
                    Description
                  </Text>
                  <Text color="gray.600">
                    Master of Coin is a comprehensive personal finance management application that
                    helps you track expenses, manage budgets, and gain insights into your financial
                    health.
                  </Text>
                </Box>

                <Separator />

                <Box>
                  <Text fontWeight="medium" mb={2}>
                    Resources
                  </Text>
                  <VStack gap={2} alignItems="flex-start">
                    <Link href="#" color="blue.500">
                      Documentation
                    </Link>
                    <Link href="#" color="blue.500">
                      Privacy Policy
                    </Link>
                    <Link href="#" color="blue.500">
                      Terms of Service
                    </Link>
                    <Link href="#" color="blue.500">
                      Support
                    </Link>
                  </VStack>
                </Box>

                <Separator />

                <Box>
                  <Text fontWeight="medium" mb={2}>
                    Technology Stack
                  </Text>
                  <Grid templateColumns="repeat(2, 1fr)" gap={2}>
                    <Badge>React</Badge>
                    <Badge>TypeScript</Badge>
                    <Badge>Chakra UI</Badge>
                    <Badge>React Query</Badge>
                    <Badge>Rust</Badge>
                    <Badge>Actix Web</Badge>
                    <Badge>PostgreSQL</Badge>
                    <Badge>Diesel ORM</Badge>
                  </Grid>
                </Box>

                <Separator />

                <Box>
                  <Text fontSize="sm" color="gray.500">
                    © 2026 Master of Coin. All rights reserved.
                  </Text>
                </Box>
              </VStack>
            </Card.Body>
          </Card.Root>
        </Tabs.Content>
      </Tabs.Root>
    </Container>
  );
};
