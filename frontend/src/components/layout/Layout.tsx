import { Box, DrawerRoot, DrawerBackdrop, DrawerContent, DrawerBody } from '@chakra-ui/react';
import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export const Layout = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);

  const handleMenuToggle = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleMenuClose = () => {
    setIsMobileMenuOpen(false);
  };

  const handleSidebarToggle = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  return (
    <Box h="100vh" display="flex" flexDirection="column">
      {/* Header */}
      <Header
        onMenuClick={handleMenuToggle}
        onSidebarToggle={handleSidebarToggle}
        isSidebarCollapsed={isSidebarCollapsed}
      />

      {/* Main Content Area */}
      <Box flex={1} display="flex" overflow="hidden">
        {/* Desktop Sidebar */}
        <Box
          w={isSidebarCollapsed ? '20' : '64'}
          display={{ base: 'none', md: 'block' }}
          flexShrink={0}
          transition="width 0.3s ease"
        >
          <Sidebar isCollapsed={isSidebarCollapsed} />
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
        <Box
          flex={1}
          overflowY="auto"
          bg="bg.subtle"
          px={{ base: 4, md: 6, lg: 8 }}
          py={{ base: 4, md: 6 }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
};
