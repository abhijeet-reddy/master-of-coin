import { Box, HStack, Text, IconButton } from '@chakra-ui/react';
import { Menu } from '@chakra-ui/react';
import {
  MdMenu,
  MdPerson,
  MdSettings,
  MdLogout,
  MdLightMode,
  MdDarkMode,
  MdMenuOpen,
} from 'react-icons/md';
import { useColorMode } from '@/components/ui/color-mode';
import { useHeaderMenu } from '@/hooks/ui';

interface HeaderProps {
  onMenuClick: () => void;
  onSidebarToggle: () => void;
  isSidebarCollapsed: boolean;
  title?: string;
}

export const Header = ({
  onMenuClick,
  onSidebarToggle,
  isSidebarCollapsed,
  title = 'Dashboard',
}: HeaderProps) => {
  const { colorMode, toggleColorMode } = useColorMode();
  const { handleMenuSelect } = useHeaderMenu();

  return (
    <Box
      as="header"
      h="16"
      px={4}
      borderBottomWidth="1px"
      borderColor="border"
      bg="bg"
      display="flex"
      alignItems="center"
      justifyContent="space-between"
    >
      {/* Left side: Menu button (mobile) + Sidebar toggle (desktop) + Title */}
      <HStack gap={4}>
        {/* Mobile menu button */}
        <IconButton
          aria-label="Open menu"
          variant="ghost"
          display={{ base: 'flex', md: 'none' }}
          onClick={onMenuClick}
        >
          <MdMenu />
        </IconButton>

        {/* Desktop sidebar toggle button */}
        <IconButton
          aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          variant="ghost"
          display={{ base: 'none', md: 'flex' }}
          onClick={onSidebarToggle}
        >
          {isSidebarCollapsed ? <MdMenu /> : <MdMenuOpen />}
        </IconButton>

        <Text fontSize="xl" fontWeight="semibold">
          {title}
        </Text>
      </HStack>

      {/* Right side: Color mode toggle + User menu */}
      <HStack gap={2}>
        {/* Color Mode Toggle */}
        <IconButton aria-label="Toggle color mode" variant="ghost" onClick={toggleColorMode}>
          {colorMode === 'light' ? <MdDarkMode /> : <MdLightMode />}
        </IconButton>

        {/* User Menu */}
        <Menu.Root positioning={{ placement: 'bottom-end' }}>
          <Menu.Trigger asChild>
            <IconButton aria-label="User menu" variant="ghost">
              <MdPerson />
            </IconButton>
          </Menu.Trigger>
          <Menu.Positioner>
            <Menu.Content minW="200px">
              <Menu.Item value="settings" onClick={() => handleMenuSelect('settings')}>
                <HStack gap={2}>
                  <Box as={MdSettings} />
                  <Text>Settings</Text>
                </HStack>
              </Menu.Item>
              <Menu.Item value="logout" color="red.500" onClick={() => handleMenuSelect('logout')}>
                <HStack gap={2}>
                  <Box as={MdLogout} />
                  <Text>Logout</Text>
                </HStack>
              </Menu.Item>
            </Menu.Content>
          </Menu.Positioner>
        </Menu.Root>
      </HStack>
    </Box>
  );
};
