import { Box, VStack, HStack, Text } from '@chakra-ui/react';
import { NavLink } from 'react-router-dom';
import {
  MdDashboard,
  MdSwapHoriz,
  MdAccountBalance,
  MdPieChart,
  MdCategory,
  MdPeople,
  MdAssessment,
  MdSettings,
} from 'react-icons/md';
import { useAuth } from '@/contexts/AuthContext';
import { getInitials } from '@/utils/formatters/text';

interface SidebarProps {
  onClose?: () => void;
  isCollapsed?: boolean;
}

interface NavItemProps {
  icon: React.ComponentType;
  label: string;
  to: string;
  onClick?: () => void;
  isCollapsed?: boolean;
}

const NavItem = ({ icon: IconComponent, label, to, onClick, isCollapsed }: NavItemProps) => {
  return (
    <NavLink to={to} onClick={onClick} style={{ textDecoration: 'none', width: '100%' }}>
      {({ isActive }) => (
        <Box
          px={isCollapsed ? 2 : 4}
          py={3}
          borderRadius="md"
          transition="all 0.2s"
          bg={isActive ? 'brand.50' : 'transparent'}
          color={isActive ? 'brand.600' : 'inherit'}
          fontWeight={isActive ? 'medium' : 'normal'}
          _hover={{
            bg: isActive ? 'brand.50' : 'bg.muted',
          }}
          cursor="pointer"
          display="flex"
          justifyContent={isCollapsed ? 'center' : 'flex-start'}
          title={isCollapsed ? label : undefined}
        >
          <HStack gap={3}>
            <Box fontSize="xl" as={IconComponent} />
            {!isCollapsed && <Text fontSize="sm">{label}</Text>}
          </HStack>
        </Box>
      )}
    </NavLink>
  );
};

export const Sidebar = ({ onClose, isCollapsed = false }: SidebarProps) => {
  const { user } = useAuth();

  return (
    <Box
      h="full"
      display="flex"
      flexDirection="column"
      bg="bg"
      borderRightWidth="1px"
      borderColor="border"
    >
      {/* Logo/Brand */}
      <Box
        px={isCollapsed ? 2 : 6}
        py={6}
        display="flex"
        justifyContent={isCollapsed ? 'center' : 'flex-start'}
      >
        {isCollapsed ? (
          <Box fontSize="2xl" color="brand.500" as={MdAccountBalance} title="Master of Coin" />
        ) : (
          <HStack gap={3}>
            <Box fontSize="2xl" color="brand.500" as={MdAccountBalance} />
            <Text fontSize="xl" fontWeight="bold">
              Master of Coin
            </Text>
          </HStack>
        )}
      </Box>

      {/* Navigation */}
      <VStack flex={1} gap={1} px={3} overflowY="auto" alignItems="stretch">
        <NavItem
          icon={MdDashboard}
          label="Dashboard"
          to="/"
          onClick={onClose}
          isCollapsed={isCollapsed}
        />
        <NavItem
          icon={MdSwapHoriz}
          label="Transactions"
          to="/transactions"
          onClick={onClose}
          isCollapsed={isCollapsed}
        />
        <NavItem
          icon={MdAccountBalance}
          label="Accounts"
          to="/accounts"
          onClick={onClose}
          isCollapsed={isCollapsed}
        />
        <NavItem
          icon={MdPieChart}
          label="Budgets"
          to="/budgets"
          onClick={onClose}
          isCollapsed={isCollapsed}
        />
        <NavItem
          icon={MdCategory}
          label="Categories"
          to="/categories"
          onClick={onClose}
          isCollapsed={isCollapsed}
        />
        <NavItem
          icon={MdPeople}
          label="People"
          to="/people"
          onClick={onClose}
          isCollapsed={isCollapsed}
        />
        <NavItem
          icon={MdAssessment}
          label="Reports"
          to="/reports"
          onClick={onClose}
          isCollapsed={isCollapsed}
        />
        <NavItem
          icon={MdSettings}
          label="Settings"
          to="/settings"
          onClick={onClose}
          isCollapsed={isCollapsed}
        />
      </VStack>

      {/* User Profile Section */}
      {user && (
        <Box px={isCollapsed ? 2 : 4} py={4} borderTopWidth="1px" borderColor="border">
          {isCollapsed ? (
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
              mx="auto"
              title={user.name}
            >
              {getInitials(user.name)}
            </Box>
          ) : (
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
                {getInitials(user.name)}
              </Box>
              <Box flex={1}>
                <Text fontSize="sm" fontWeight="medium">
                  {user.name}
                </Text>
                <Text fontSize="xs" color="fg.muted">
                  {user.email}
                </Text>
              </Box>
            </HStack>
          )}
        </Box>
      )}
    </Box>
  );
};
