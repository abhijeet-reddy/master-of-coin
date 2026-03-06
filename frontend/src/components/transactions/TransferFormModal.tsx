import { Box, Button, HStack, Input, Text, Textarea, VStack } from '@chakra-ui/react';
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
import { Field } from '@/components/ui/field';
import { ErrorAlert } from '@/components/common';
import { useTransferForm } from '@/hooks';
import type { Account, Category } from '@/types';

interface TransferFormModalProps {
  open: boolean;
  onClose: () => void;
  accounts: Account[];
  categories?: Category[];
  onSuccess?: () => void;
}

export const TransferFormModal = ({
  open,
  onClose,
  accounts,
  categories,
  onSuccess,
}: TransferFormModalProps) => {
  const {
    form,
    isSubmitting,
    submitError,
    handleFormSubmit,
    setLastEditedField,
    transferableAccounts,
    toAccountOptions,
    fromAccount,
    toAccount,
    isCrossCurrency,
    titlePlaceholder,
  } = useTransferForm({ open, accounts, onSuccess, onClose });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form;

  const selectStyle = {
    width: '100%',
    padding: '8px',
    borderRadius: '6px',
    border: '1px solid #E2E8F0',
  };

  return (
    <DialogRoot open={open} onOpenChange={(e) => !e.open && onClose()} size="lg">
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
          <DialogTitle>Transfer Between Accounts</DialogTitle>
          <DialogCloseTrigger />
        </DialogHeader>

        <DialogBody>
          <form
            id="transfer-form"
            onSubmit={(e) => {
              void handleSubmit(handleFormSubmit)(e);
            }}
          >
            <VStack align="stretch" gap={4}>
              {/* Error Alert */}
              {submitError && <ErrorAlert error={submitError} />}

              {/* From Account */}
              <Field label="From Account" required errorText={errors.from_account_id?.message}>
                <select {...register('from_account_id')} style={selectStyle}>
                  <option value="">Select source account</option>
                  {transferableAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({account.currency})
                    </option>
                  ))}
                </select>
              </Field>

              {/* To Account */}
              <Field label="To Account" required errorText={errors.to_account_id?.message}>
                <select {...register('to_account_id')} style={selectStyle}>
                  <option value="">Select destination account</option>
                  {toAccountOptions.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({account.currency})
                    </option>
                  ))}
                </select>
              </Field>

              {/* Amount (from_amount) */}
              <Field
                label={isCrossCurrency ? `Amount (${fromAccount?.currency ?? ''})` : 'Amount'}
                required
                errorText={errors.amount?.message}
              >
                <Input
                  {...register('amount', {
                    onChange: () => setLastEditedField('amount'),
                  })}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                />
              </Field>

              {/* Cross-currency section */}
              {isCrossCurrency && (
                <Box
                  p={4}
                  borderWidth="1px"
                  borderColor="border.muted"
                  borderRadius="md"
                  bg="bg.muted"
                >
                  <Text fontSize="sm" fontWeight="semibold" mb={3}>
                    Cross-currency transfer
                  </Text>
                  <VStack align="stretch" gap={3}>
                    {/* To Amount */}
                    <Field
                      label={`To Amount (${toAccount?.currency ?? ''})`}
                      errorText={errors.to_amount?.message}
                    >
                      <Input
                        {...register('to_amount', {
                          onChange: () => setLastEditedField('to_amount'),
                        })}
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                      />
                    </Field>

                    {/* Exchange Rate */}
                    <Field
                      label="Exchange Rate"
                      helperText={
                        fromAccount && toAccount
                          ? `1 ${fromAccount.currency} = ? ${toAccount.currency}`
                          : undefined
                      }
                      errorText={errors.exchange_rate?.message}
                    >
                      <Input
                        {...register('exchange_rate', {
                          onChange: () => setLastEditedField('exchange_rate'),
                        })}
                        type="number"
                        step="0.000001"
                        min="0"
                        placeholder="1.0000"
                      />
                    </Field>
                  </VStack>
                </Box>
              )}

              {/* Date and Time */}
              <HStack align="start" gap={4}>
                <Box flex={1}>
                  <Field label="Date" required errorText={errors.date?.message}>
                    <Input {...register('date')} type="date" />
                  </Field>
                </Box>
                <Box flex={1}>
                  <Field label="Time" required errorText={errors.time?.message}>
                    <Input {...register('time')} type="time" />
                  </Field>
                </Box>
              </HStack>

              {/* Title */}
              <Field label="Title" errorText={errors.title?.message}>
                <Input {...register('title')} placeholder={titlePlaceholder} />
              </Field>

              {/* Notes */}
              <Field label="Notes">
                <Textarea
                  {...register('notes')}
                  placeholder="Add any additional notes..."
                  rows={3}
                />
              </Field>

              {/* Category */}
              {categories && categories.length > 0 && (
                <Field label="Category">
                  <select {...register('category_id')} style={selectStyle}>
                    <option value="">Select category (optional)</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.icon} {category.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </VStack>
          </form>
        </DialogBody>

        <DialogFooter>
          <HStack gap={2}>
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form="transfer-form" colorPalette="blue" loading={isSubmitting}>
              Transfer
            </Button>
          </HStack>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};
