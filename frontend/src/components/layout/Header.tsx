import { Box, HStack, Text, IconButton } from '@chakra-ui/react';
import { Menu } from '@chakra-ui/react';
import { MdMenu, MdPerson, MdSettings, MdLogout, MdLightMode, MdDarkMode } from 'react-icons/md';
import { useColorMode } from '@/components/ui/color-mode';

interface HeaderProps {
  onMenuClick: () => void;
  title?: string;
}

export const Header = ({ onMenuClick, title = 'Dashboard' }: HeaderProps) => {
  const { colorMode, toggleColorMode } = useColorMode();

  return (
    <Box
      as="header"
      h="16"
      px={4}
      borderBottomWidth="1px"
      borderColor="gray.200"
      bg="white"
      display="flex"
      alignItems="center"
      justifyContent="space-between"
    >
      {/* Left side: Menu button (mobile) + Title */}
      <HStack gap={4}>
        <IconButton
          aria-label="Open menu"
          variant="ghost"
          display={{ base: 'flex', md: 'none' }}
          onClick={onMenuClick}
        >
          <MdMenu />
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
              <Menu.Item value="profile">
                <HStack gap={2}>
                  <Box as={MdPerson} />
                  <Text>Profile</Text>
                </HStack>
              </Menu.Item>
              <Menu.Item value="settings">
                <HStack gap={2}>
                  <Box as={MdSettings} />
                  <Text>Settings</Text>
                </HStack>
              </Menu.Item>
              <Menu.Item value="logout" color="red.500">
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
