import { Box, VStack, HStack, Text } from '@chakra-ui/react';
import { NavLink } from 'react-router-dom';
import {
  MdDashboard,
  MdSwapHoriz,
  MdAccountBalance,
  MdPieChart,
  MdPeople,
  MdAssessment,
  MdSettings,
} from 'react-icons/md';

interface SidebarProps {
  onClose?: () => void;
}

interface NavItemProps {
  icon: React.ComponentType;
  label: string;
  to: string;
  onClick?: () => void;
}

const NavItem = ({ icon: IconComponent, label, to, onClick }: NavItemProps) => {
  return (
    <NavLink to={to} onClick={onClick} style={{ textDecoration: 'none', width: '100%' }}>
      {({ isActive }) => (
        <Box
          px={4}
          py={3}
          borderRadius="md"
          transition="all 0.2s"
          bg={isActive ? 'brand.50' : 'transparent'}
          color={isActive ? 'brand.600' : 'inherit'}
          fontWeight={isActive ? 'medium' : 'normal'}
          _hover={{
            bg: isActive ? 'brand.50' : 'gray.100',
          }}
          cursor="pointer"
        >
          <HStack gap={3}>
            <Box fontSize="xl" as={IconComponent} />
            <Text fontSize="sm">{label}</Text>
          </HStack>
        </Box>
      )}
    </NavLink>
  );
};

export const Sidebar = ({ onClose }: SidebarProps) => {
  return (
    <Box
      h="full"
      display="flex"
      flexDirection="column"
      bg="white"
      borderRightWidth="1px"
      borderColor="gray.200"
    >
      {/* Logo/Brand */}
      <Box px={6} py={6}>
        <HStack gap={3}>
          <Box fontSize="2xl" color="brand.500" as={MdAccountBalance} />
          <Text fontSize="xl" fontWeight="bold">
            Master of Coin
          </Text>
        </HStack>
      </Box>

      {/* Navigation */}
      <VStack flex={1} gap={1} px={3} overflowY="auto" alignItems="stretch">
        <NavItem icon={MdDashboard} label="Dashboard" to="/" onClick={onClose} />
        <NavItem icon={MdSwapHoriz} label="Transactions" to="/transactions" onClick={onClose} />
        <NavItem icon={MdAccountBalance} label="Accounts" to="/accounts" onClick={onClose} />
        <NavItem icon={MdPieChart} label="Budgets" to="/budgets" onClick={onClose} />
        <NavItem icon={MdPeople} label="People" to="/people" onClick={onClose} />
        <NavItem icon={MdAssessment} label="Reports" to="/reports" onClick={onClose} />
        <NavItem icon={MdSettings} label="Settings" to="/settings" onClick={onClose} />
      </VStack>

      {/* User Profile Section */}
      <Box px={4} py={4} borderTopWidth="1px" borderColor="gray.200">
        <HStack gap={3}>
          <Box
            w="32px"
            h="32px"
            borderRadius="full"
            bg="brand.500"
            display="flex"
            alignItems="center"
            justifyContent="center"
            color="white"
            fontSize="sm"
            fontWeight="medium"
          >
            U
          </Box>
          <Box flex={1}>
            <Text fontSize="sm" fontWeight="medium">
              User Name
            </Text>
            <Text fontSize="xs" color="gray.500">
              user@example.com
            </Text>
          </Box>
        </HStack>
      </Box>
    </Box>
  );
};
