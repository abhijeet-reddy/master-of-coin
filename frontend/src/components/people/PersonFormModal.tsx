import { useEffect } from 'react';
import { Button, HStack, Input, Textarea, VStack } from '@chakra-ui/react';
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
import { SplitProviderConfig } from '@/components/people/SplitProviderConfig';
import { useCreatePerson, useUpdatePerson } from '@/hooks';
import type { Person } from '@/types';

// Validation schema
const personSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  phone: z
    .string()
    .regex(/^[+]?[0-9\s\-().]{7,20}$/, 'Invalid phone format')
    .optional()
    .or(z.literal('')),
  notes: z.string().max(500, 'Notes must be less than 500 characters').optional(),
});

type PersonFormData = z.infer<typeof personSchema>;

interface PersonFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  person?: Person;
  onSuccess: () => void;
}

export const PersonFormModal = ({ isOpen, onClose, person, onSuccess }: PersonFormModalProps) => {
  const createMutation = useCreatePerson();
  const updateMutation = useUpdatePerson();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<PersonFormData>({
    resolver: zodResolver(personSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      notes: '',
    },
  });

  // Reset form when modal opens/closes or person changes
  useEffect(() => {
    if (isOpen) {
      if (person) {
        reset({
          name: person.name,
          email: person.email || '',
          phone: person.phone || '',
          notes: person.notes || '',
        });
      } else {
        reset({
          name: '',
          email: '',
          phone: '',
          notes: '',
        });
      }
    }
  }, [isOpen, person, reset]);

  const handleFormSubmit = (data: PersonFormData) => {
    const personData = {
      name: data.name,
      email: data.email && data.email.trim() !== '' ? data.email : undefined,
      phone: data.phone && data.phone.trim() !== '' ? data.phone : undefined,
      notes: data.notes && data.notes.trim() !== '' ? data.notes : undefined,
    };

    if (person) {
      // Update existing person
      updateMutation.mutate(
        { id: person.id, data: personData },
        {
          onSuccess: () => {
            onSuccess();
            onClose();
          },
        }
      );
    } else {
      // Create new person
      createMutation.mutate(personData, {
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
          <DialogTitle>{person ? 'Edit Person' : 'Add Person'}</DialogTitle>
          <DialogCloseTrigger />
        </DialogHeader>

        <DialogBody>
          <form
            id="person-form"
            onSubmit={(e) => {
              void handleSubmit(handleFormSubmit)(e);
            }}
          >
            <VStack align="stretch" gap={4}>
              {/* Error Alert */}
              {mutationError && <ErrorAlert error={mutationError} />}
              {/* Name */}
              <Field label="Name" required errorText={errors.name?.message}>
                <Input {...register('name')} placeholder="e.g., John Doe" />
              </Field>

              {/* Email */}
              <Field label="Email" errorText={errors.email?.message}>
                <Input {...register('email')} type="email" placeholder="e.g., john@example.com" />
              </Field>

              {/* Phone */}
              <Field label="Phone" errorText={errors.phone?.message}>
                <Input {...register('phone')} type="tel" placeholder="e.g., +1 234 567 8900" />
              </Field>

              {/* Notes */}
              <Field label="Notes" errorText={errors.notes?.message}>
                <Textarea
                  {...register('notes')}
                  placeholder="Add any additional notes..."
                  rows={3}
                />
              </Field>

              {/* Split Provider Config (only for existing persons) */}
              {person && <SplitProviderConfig personId={person.id} />}
            </VStack>
          </form>
        </DialogBody>

        <DialogFooter>
          <HStack gap={2}>
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form="person-form" colorScheme="blue" loading={isSubmitting}>
              {person ? 'Update' : 'Create'}
            </Button>
          </HStack>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};
