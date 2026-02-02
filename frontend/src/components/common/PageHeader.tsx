import { Box, HStack, VStack, Text, BreadcrumbRoot, BreadcrumbLink } from '@chakra-ui/react';
import type { ReactNode } from 'react';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ReactNode;
}

export const PageHeader = ({ title, subtitle, breadcrumbs, actions }: PageHeaderProps) => {
  return (
    <Box mb={6}>
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <BreadcrumbRoot mb={2} fontSize="sm">
          {breadcrumbs.map((crumb, index) => (
            <BreadcrumbLink
              key={index}
              href={crumb.href}
              color={index === breadcrumbs.length - 1 ? 'fg.muted' : 'brand.500'}
              fontWeight={index === breadcrumbs.length - 1 ? 'medium' : 'normal'}
            >
              {crumb.label}
            </BreadcrumbLink>
          ))}
        </BreadcrumbRoot>
      )}

      {/* Title and Actions */}
      <Box
        display="flex"
        flexDirection={{ base: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ base: 'flex-start', md: 'center' }}
        gap={4}
      >
        <VStack alignItems="flex-start" gap={1}>
          <Text as="h1" fontSize={{ base: '2xl', md: '3xl' }} fontWeight="bold" color="fg">
            {title}
          </Text>
          {subtitle && (
            <Text fontSize="sm" color="fg.muted">
              {subtitle}
            </Text>
          )}
        </VStack>

        {actions && (
          <HStack gap={2} flexShrink={0}>
            {actions}
          </HStack>
        )}
      </Box>
    </Box>
  );
};
