import {
  Box,
  HStack,
  VStack,
  Text,
  BreadcrumbRoot,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbCurrentLink,
  BreadcrumbSeparator,
} from '@chakra-ui/react';
import type { ReactNode } from 'react';

interface BreadcrumbItemData {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title?: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItemData[];
  actions?: ReactNode;
}

export const PageHeader = ({ title, subtitle, breadcrumbs, actions }: PageHeaderProps) => {
  const hasBreadcrumbs = breadcrumbs && breadcrumbs.length > 0;
  const hasTitle = !!title || !!subtitle;

  const breadcrumbElement = hasBreadcrumbs ? (
    <BreadcrumbRoot fontSize="sm">
      <BreadcrumbList>
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;
          return (
            <>
              {index > 0 && <BreadcrumbSeparator key={`sep-${index}`} />}
              <BreadcrumbItem key={index}>
                {isLast ? (
                  <BreadcrumbCurrentLink color="fg.muted" fontWeight="medium">
                    {crumb.label}
                  </BreadcrumbCurrentLink>
                ) : (
                  <BreadcrumbLink href={crumb.href} color="brand.500">
                    {crumb.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </>
          );
        })}
      </BreadcrumbList>
    </BreadcrumbRoot>
  ) : null;

  return (
    <Box mb={6}>
      {/* When there's no title, put breadcrumbs and actions on the same row */}
      {hasBreadcrumbs && !hasTitle && (
        <HStack justifyContent="space-between" alignItems="center" width="100%">
          {breadcrumbElement}
          {actions && (
            <HStack gap={2} flexShrink={0}>
              {actions}
            </HStack>
          )}
        </HStack>
      )}

      {/* When there's a title, breadcrumbs go above, title+actions below */}
      {hasBreadcrumbs && hasTitle && <Box mb={2}>{breadcrumbElement}</Box>}

      {hasTitle && (
        <Box
          display="flex"
          flexDirection={{ base: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ base: 'flex-start', md: 'center' }}
          gap={4}
        >
          <VStack alignItems="flex-start" gap={1}>
            {title && (
              <Text as="h1" fontSize={{ base: '2xl', md: '3xl' }} fontWeight="bold" color="fg">
                {title}
              </Text>
            )}
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
      )}

      {/* Actions only (no breadcrumbs, no title) */}
      {!hasBreadcrumbs && !hasTitle && actions && <HStack gap={2}>{actions}</HStack>}
    </Box>
  );
};
