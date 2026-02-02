import { useEffect } from 'react';
import { Button, HStack, Input, Textarea, VStack, Checkbox, Text, Menu } from '@chakra-ui/react';
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
import { addDays, addWeeks, addMonths, addYears, format } from 'date-fns';
import { Field } from '@/components/ui/field';
import { ErrorAlert } from '@/components/common';
import useCreateBudget from '@/hooks/api/useCreateBudget';
import useUpdateBudget from '@/hooks/api/useUpdateBudget';
import useCategories from '@/hooks/api/useCategories';
import useAccounts from '@/hooks/api/useAccounts';
import useBudgets from '@/hooks/api/useBudgets';
import type { EnrichedBudgetStatus, BudgetPeriod } from '@/types';

// Validation schema
const budgetSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  category_id: z.string().min(1, 'Category is required'),
  account_ids: z.array(z.string()).optional(),
  limit_amount: z.string().min(1, 'Limit amount is required'),
  period: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().optional(),
  notes: z.string().max(500, 'Notes must be less than 500 characters').optional(),
});

type BudgetFormData = z.infer<typeof budgetSchema>;

interface BudgetFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  budget?: EnrichedBudgetStatus;
  onSuccess: () => void;
}

export const BudgetFormModal = ({ isOpen, onClose, budget, onSuccess }: BudgetFormModalProps) => {
  const createMutation = useCreateBudget();
  const updateMutation = useUpdateBudget();
  const { data: categories = [] } = useCategories();
  const { data: accounts = [] } = useAccounts();
  const { data: budgets = [] } = useBudgets();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<BudgetFormData>({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      name: '',
      category_id: '',
      account_ids: [],
      limit_amount: '',
      period: 'MONTHLY',
      start_date: format(new Date(), 'yyyy-MM-dd'),
      end_date: '',
      notes: '',
    },
  });

  const watchPeriod = watch('period');
  const watchStartDate = watch('start_date');
  const watchAccountIds = watch('account_ids');

  const handleAccountToggle = (accountId: string) => {
    const currentIds = watchAccountIds || [];
    const newIds = currentIds.includes(accountId)
      ? currentIds.filter((id) => id !== accountId)
      : [...currentIds, accountId];
    setValue('account_ids', newIds);
  };

  // useEffect #1: Auto-calculate end date based on period and start date
  useEffect(() => {
    if (watchStartDate && watchPeriod) {
      const startDate = new Date(watchStartDate);
      let endDate: Date;

      switch (watchPeriod) {
        case 'DAILY':
          endDate = addDays(startDate, 1);
          break;
        case 'WEEKLY':
          endDate = addWeeks(startDate, 1);
          break;
        case 'MONTHLY':
          endDate = addMonths(startDate, 1);
          break;
        case 'QUARTERLY':
          endDate = addMonths(startDate, 3);
          break;
        case 'YEARLY':
          endDate = addYears(startDate, 1);
          break;
        default:
          endDate = addMonths(startDate, 1);
      }

      setValue('end_date', format(endDate, 'yyyy-MM-dd'));
    }
  }, [watchPeriod, watchStartDate, setValue]);

  // useEffect #2: Reset form when modal opens/closes or budget changes
  useEffect(() => {
    if (isOpen) {
      if (budget) {
        // Find the original budget to get filters
        const originalBudget = budgets.find((b) => b.id === budget.budget_id);

        // Extract data from enriched budget for editing
        const categoryId = originalBudget?.filters?.category_id || '';
        const accountIds = originalBudget?.filters?.account_ids || [];
        const limitAmount = budget.limit_amount || '';
        const period = budget.period || 'MONTHLY';
        const startDate = budget.start_date || format(new Date(), 'yyyy-MM-dd');
        const endDate = budget.end_date || '';

        reset({
          name: budget.budget_name,
          category_id: categoryId,
          account_ids: accountIds,
          limit_amount: limitAmount,
          period: period,
          start_date: startDate,
          end_date: endDate,
          notes: '',
        });
      } else {
        reset({
          name: '',
          category_id: '',
          account_ids: [],
          limit_amount: '',
          period: 'MONTHLY',
          start_date: format(new Date(), 'yyyy-MM-dd'),
          end_date: '',
          notes: '',
        });
      }
    }
  }, [isOpen, budget, reset]);

  const handleFormSubmit = async (data: BudgetFormData) => {
    const budgetData = {
      name: data.name,
      filters: {
        category_id: data.category_id,
        account_ids: data.account_ids && data.account_ids.length > 0 ? data.account_ids : undefined,
      },
      ranges: [
        {
          limit_amount: data.limit_amount,
          period: data.period as BudgetPeriod,
          start_date: data.start_date,
          end_date: data.end_date || undefined,
        },
      ],
    };

    try {
      if (budget) {
        // Update existing budget
        await updateMutation.mutateAsync({ id: budget.budget_id, data: budgetData });
      } else {
        // Create new budget
        await createMutation.mutateAsync(budgetData);
      }
      onSuccess();
      onClose();
    } catch (error) {
      // Error handling is done by React Query
      console.error('Failed to save budget:', error);
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
          <DialogTitle>{budget ? 'Edit Budget' : 'Add Budget'}</DialogTitle>
          <DialogCloseTrigger />
        </DialogHeader>

        <DialogBody>
          <form
            id="budget-form"
            onSubmit={(e) => {
              void handleSubmit(handleFormSubmit)(e);
            }}
          >
            <VStack align="stretch" gap={4}>
              {/* Error Alert */}
              {mutationError && <ErrorAlert error={mutationError} />}
              {/* Budget Name */}
              <Field label="Budget Name" required errorText={errors.name?.message}>
                <Input {...register('name')} placeholder="e.g., Monthly Groceries" />
              </Field>

              {/* Category */}
              <Field label="Category" required errorText={errors.category_id?.message}>
                <select
                  {...register('category_id')}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '6px',
                  }}
                >
                  <option value="">Select a category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.icon} {category.name}
                    </option>
                  ))}
                </select>
              </Field>

              {/* Accounts (Optional Multi-select) */}
              <Field
                label="Accounts (Optional)"
                helperText="Leave empty to track across all accounts"
                errorText={errors.account_ids?.message}
              >
                <Menu.Root closeOnSelect={false}>
                  <Menu.Trigger asChild>
                    <Button
                      variant="outline"
                      width="100%"
                      css={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Text>
                        {watchAccountIds && watchAccountIds.length > 0
                          ? `${watchAccountIds.length} account${watchAccountIds.length > 1 ? 's' : ''} selected`
                          : 'Select accounts'}
                      </Text>
                      <span>▼</span>
                    </Button>
                  </Menu.Trigger>
                  <Menu.Positioner>
                    <Menu.Content
                      maxHeight="300px"
                      overflowY="auto"
                      minWidth="var(--reference-width)"
                    >
                      {accounts.length === 0 ? (
                        <Menu.Item value="none" disabled>
                          No accounts available
                        </Menu.Item>
                      ) : (
                        accounts.map((account) => (
                          <Menu.Item
                            key={account.id}
                            value={account.id}
                            onClick={(e: React.MouseEvent) => {
                              e.preventDefault();
                              handleAccountToggle(account.id);
                            }}
                          >
                            <HStack width="100%">
                              <Checkbox.Root
                                checked={watchAccountIds?.includes(account.id) || false}
                                pointerEvents="none"
                              >
                                <Checkbox.Control />
                              </Checkbox.Root>
                              <Text>{account.name}</Text>
                            </HStack>
                          </Menu.Item>
                        ))
                      )}
                    </Menu.Content>
                  </Menu.Positioner>
                </Menu.Root>
              </Field>

              {/* Limit Amount */}
              <Field label="Limit Amount" required errorText={errors.limit_amount?.message}>
                <Input
                  {...register('limit_amount')}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g., 500.00"
                />
              </Field>

              {/* Period */}
              <Field label="Period" required errorText={errors.period?.message}>
                <select
                  {...register('period')}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px' }}
                >
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="QUARTERLY">Quarterly</option>
                  <option value="YEARLY">Yearly</option>
                </select>
              </Field>

              {/* Start Date */}
              <Field label="Start Date" required errorText={errors.start_date?.message}>
                <Input {...register('start_date')} type="date" />
              </Field>

              {/* End Date */}
              <Field
                label="End Date"
                helperText="Auto-calculated based on period"
                errorText={errors.end_date?.message}
              >
                <Input {...register('end_date')} type="date" />
              </Field>

              {/* Notes */}
              <Field label="Notes" errorText={errors.notes?.message}>
                <Textarea
                  {...register('notes')}
                  placeholder="Add any additional notes..."
                  rows={3}
                />
              </Field>
            </VStack>
          </form>
        </DialogBody>

        <DialogFooter>
          <HStack gap={2}>
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form="budget-form" colorScheme="blue" loading={isSubmitting}>
              {budget ? 'Update' : 'Create'}
            </Button>
          </HStack>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};
