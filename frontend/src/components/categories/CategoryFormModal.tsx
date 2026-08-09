import { useEffect } from 'react';
import { Box, Button, HStack, Input, Switch, Text, VStack } from '@chakra-ui/react';
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogCloseTrigger,
  DialogBackdrop,
} from '@chakra-ui/react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Field } from '@/components/ui/field';
import { ErrorAlert } from '@/components/common';
import useCreateCategory from '@/hooks/api/useCreateCategory';
import useUpdateCategory from '@/hooks/api/useUpdateCategory';
import type { Category } from '@/types';

/** Generate a random hex color code (e.g., #A3F29C) */
const getRandomColor = (): string => {
  const hex = Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, '0');
  return `#${hex.toUpperCase()}`;
};

// Validation schema. Icon and colour are OPTIONAL — the API stores both as
// nullable, so the form must not force a value (categories created outside the
// UI, e.g. seeds/API, can have neither). The hex-format check only applies when
// a colour is actually supplied.
const categorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  icon: z.string().max(10, 'Icon must be less than 10 characters').optional(),
  color: z
    .union([
      z.literal(''),
      z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex code (e.g., #FF5733)'),
    ])
    .optional(),
  isExcludedFromAnalysis: z.boolean(),
});

type CategoryFormData = z.infer<typeof categorySchema>;

interface CategoryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  category?: Category;
  onSuccess: () => void;
}

export const CategoryFormModal = ({
  isOpen,
  onClose,
  category,
  onSuccess,
}: CategoryFormModalProps) => {
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();

  const {
    register,
    control,
    watch,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      icon: '📁',
      color: getRandomColor(),
      isExcludedFromAnalysis: false,
    },
  });

  // Reset form when modal opens/closes or category changes
  useEffect(() => {
    if (isOpen) {
      if (category) {
        reset({
          // icon/colour are nullable in the API; coalesce to '' so the inputs
          // stay controlled and an existing category with neither can still save.
          name: category.name,
          icon: category.icon ?? '',
          color: category.color ?? '',
          isExcludedFromAnalysis: category.is_excluded_from_analysis ?? false,
        });
      } else {
        reset({
          name: '',
          icon: '📁',
          color: getRandomColor(),
          isExcludedFromAnalysis: false,
        });
      }
    }
  }, [isOpen, category, reset]);

  const handleFormSubmit = (data: CategoryFormData) => {
    if (category) {
      // Update existing category
      updateMutation.mutate(
        {
          id: category.id,
          data: {
            name: data.name,
            icon: data.icon ?? '',
            color: data.color ?? '',
            is_excluded_from_analysis: data.isExcludedFromAnalysis,
          },
        },
        {
          onSuccess: () => {
            onSuccess();
            onClose();
          },
        }
      );
    } else {
      // Create new category (exclusion defaults to off; toggled via edit)
      createMutation.mutate(
        {
          name: data.name,
          icon: data.icon ?? '',
          color: data.color ?? '',
        },
        {
          onSuccess: () => {
            onSuccess();
            onClose();
          },
        }
      );
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error || updateMutation.error;

  // Editing an existing category (vs. creating a new one). The exclude toggle
  // only makes sense on edit — a brand-new category has nothing to exclude yet,
  // and the create endpoint does not accept the flag.
  const isEditing = !!category;

  // State-dependent helper: describe what IS true now, not what would happen.
  // Label is "Exclude from analysis", so switch ON = excluded.
  const isExcluded = watch('isExcludedFromAnalysis');
  const excludeHelperText = isExcluded
    ? 'Not counted. Still visible in the ledger and on transactions.'
    : 'Counted in breakdowns and budgets.';

  return (
    <DialogRoot open={isOpen} onOpenChange={(e) => !e.open && onClose()} size="lg">
      <DialogBackdrop />
      <DialogContent
        css={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 9999,
          maxHeight: '90vh',
          overflow: 'auto',
        }}
      >
        <DialogHeader>
          <DialogTitle>{category ? 'Edit Category' : 'Add Category'}</DialogTitle>
          <DialogCloseTrigger />
        </DialogHeader>

        <DialogBody>
          <form
            id="category-form"
            onSubmit={(e) => {
              void handleSubmit(handleFormSubmit)(e);
            }}
          >
            <VStack align="stretch" gap={4}>
              {/* Error Alert */}
              {mutationError && <ErrorAlert error={mutationError} />}

              {/* Category Name */}
              <Field label="Category Name" required errorText={errors.name?.message}>
                <Input {...register('name')} placeholder="e.g., Groceries, Entertainment" />
              </Field>

              {/* Icon */}
              <Field
                label="Icon"
                errorText={errors.icon?.message}
                helperText="Optional. Enter an emoji (e.g., 🍔, 🎬, 🚗)"
              >
                <Input {...register('icon')} placeholder="📁" maxLength={10} />
              </Field>

              {/* Color */}
              <Field
                label="Color"
                errorText={errors.color?.message}
                helperText="Optional. Enter a hex color code (e.g., #3B82F6)"
              >
                <HStack gap={2}>
                  <Input {...register('color')} placeholder="#3B82F6" maxLength={7} />
                  <input
                    type="color"
                    {...register('color')}
                    style={{
                      width: '50px',
                      height: '40px',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  />
                </HStack>
              </Field>

              {/* Exclude from analysis — edit only; a new category has nothing
                  to exclude yet and the create endpoint ignores the flag.
                  Label and switch share one row (matching the other fields'
                  label+control rhythm); state-dependent helper sits below. */}
              {isEditing && (
                <Box>
                  <HStack justify="space-between" align="center">
                    <Text fontWeight="medium">Exclude from analysis</Text>
                    <Controller
                      name="isExcludedFromAnalysis"
                      control={control}
                      render={({ field }) => (
                        <Switch.Root
                          checked={field.value}
                          onCheckedChange={(e) => field.onChange(e.checked)}
                        >
                          <Switch.HiddenInput onBlur={field.onBlur} ref={field.ref} />
                          <Switch.Control>
                            <Switch.Thumb />
                          </Switch.Control>
                          <Switch.Label color={field.value ? 'fg' : 'fg.muted'}>
                            {field.value ? 'On' : 'Off'}
                          </Switch.Label>
                        </Switch.Root>
                      )}
                    />
                  </HStack>
                  <Text fontSize="sm" color="fg.muted" mt={1}>
                    {excludeHelperText}
                  </Text>
                </Box>
              )}
            </VStack>
          </form>
        </DialogBody>

        <DialogFooter>
          <HStack gap={2}>
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form="category-form" colorScheme="blue" loading={isSubmitting}>
              {category ? 'Update' : 'Create'}
            </Button>
          </HStack>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};
