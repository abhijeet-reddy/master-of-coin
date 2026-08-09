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
  MdWorkHistory,
  MdSchedule,
  MdDelete,
  MdSettings,
} from 'react-icons/md';
import { useAuth } from '@/contexts/AuthContext';
import { useVersion } from '@/hooks';
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

/**
 * Deployed build version (issue #83), read from the authenticated
 * /api/v1/version endpoint. Shows the release tag ("v0.21.0"), or "vdev" for a
 * local build. The commit sha stays on the endpoint and is not shown here; the
 * tag is what is read at a glance.
 *
 * The line is HIDDEN entirely when there is no version to show — no session,
 * still loading, or the request failed — rather than rendering a blank or an
 * error next to a "Version" label, which would look like a broken app. It only
 * appears once a real version has been fetched.
 */
const VersionLine = ({ enabled, isCollapsed }: { enabled: boolean; isCollapsed?: boolean }) => {
  const { data } = useVersion(enabled);

  // Nothing to show yet (unauthenticated, loading, or errored): render nothing.
  if (!data?.version) {
    return null;
  }

  return (
    <Box
      px={isCollapsed ? 2 : 4}
      py={2}
      borderTopWidth="1px"
      borderColor="border"
      display="flex"
      justifyContent="center"
    >
      <Text fontSize="xs" color="fg.muted" title={`v${data.version}`} truncate>
        {`v${data.version}`}
      </Text>
    </Box>
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
          icon={MdWorkHistory}
          label="Jobs"
          to="/jobs"
          onClick={onClose}
          isCollapsed={isCollapsed}
        />
        <NavItem
          icon={MdSchedule}
          label="Schedules"
          to="/schedules"
          onClick={onClose}
          isCollapsed={isCollapsed}
        />
        <NavItem
          icon={MdDelete}
          label="Trash"
          to="/trash"
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

      {/* Deployed version (issue #83) */}
      <VersionLine enabled={!!user} isCollapsed={isCollapsed} />
    </Box>
  );
};
