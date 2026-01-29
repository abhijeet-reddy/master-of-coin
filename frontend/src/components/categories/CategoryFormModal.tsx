import { useEffect } from 'react';
import { Button, HStack, Input, VStack } from '@chakra-ui/react';
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
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Field } from '@/components/ui/field';
import { ErrorAlert } from '@/components/common';
import useCreateCategory from '@/hooks/api/useCreateCategory';
import useUpdateCategory from '@/hooks/api/useUpdateCategory';
import type { Category } from '@/types';

// Validation schema
const categorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  icon: z.string().min(1, 'Icon is required').max(10, 'Icon must be less than 10 characters'),
  color: z
    .string()
    .min(1, 'Color is required')
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex code (e.g., #FF5733)'),
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
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      icon: '📁',
      color: '#3B82F6',
    },
  });

  // Reset form when modal opens/closes or category changes
  useEffect(() => {
    if (isOpen) {
      if (category) {
        reset({
          name: category.name,
          icon: category.icon,
          color: category.color,
        });
      } else {
        reset({
          name: '',
          icon: '📁',
          color: '#3B82F6',
        });
      }
    }
  }, [isOpen, category, reset]);

  const handleFormSubmit = (data: CategoryFormData) => {
    const categoryData = {
      name: data.name,
      icon: data.icon,
      color: data.color,
    };

    if (category) {
      // Update existing category
      updateMutation.mutate(
        { id: category.id, data: categoryData },
        {
          onSuccess: () => {
            onSuccess();
            onClose();
          },
        }
      );
    } else {
      // Create new category
      createMutation.mutate(categoryData, {
        onSuccess: () => {
          onSuccess();
          onClose();
        },
      });
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error || updateMutation.error;

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
                required
                errorText={errors.icon?.message}
                helperText="Enter an emoji (e.g., 🍔, 🎬, 🚗)"
              >
                <Input {...register('icon')} placeholder="📁" maxLength={10} />
              </Field>

              {/* Color */}
              <Field
                label="Color"
                required
                errorText={errors.color?.message}
                helperText="Enter a hex color code (e.g., #3B82F6)"
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
