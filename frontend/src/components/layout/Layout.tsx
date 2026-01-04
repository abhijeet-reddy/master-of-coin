import { Box, DrawerRoot, DrawerBackdrop, DrawerContent, DrawerBody } from '@chakra-ui/react';
import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export const Layout = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleMenuToggle = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleMenuClose = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <Box h="100vh" display="flex" flexDirection="column">
      {/* Header */}
      <Header onMenuClick={handleMenuToggle} />

      {/* Main Content Area */}
      <Box flex={1} display="flex" overflow="hidden">
        {/* Desktop Sidebar */}
        <Box w="64" display={{ base: 'none', md: 'block' }} flexShrink={0}>
          <Sidebar />
        </Box>

        {/* Mobile Drawer */}
        <DrawerRoot
          open={isMobileMenuOpen}
          onOpenChange={(e) => setIsMobileMenuOpen(e.open)}
          placement="start"
        >
          <DrawerBackdrop />
          <DrawerContent>
            <DrawerBody p={0}>
              <Sidebar onClose={handleMenuClose} />
            </DrawerBody>
          </DrawerContent>
        </DrawerRoot>

        {/* Main Content */}
        <Box flex={1} overflowY="auto" bg="gray.50" p={{ base: 4, md: 6 }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
};
