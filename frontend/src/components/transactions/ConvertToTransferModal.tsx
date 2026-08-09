import { useMemo, useState } from 'react';
import { Box, Button, HStack, Input, Text, VStack } from '@chakra-ui/react';
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
import { toaster } from '@/components/ui/toaster';
import { useConvertToTransfer } from '@/hooks';
import { AccountType } from '@/types';
import type { Account, ConvertToTransferRequest, CurrencyCode } from '@/types';

interface ConvertToTransferModalProps {
  open: boolean;
  onClose: () => void;
  /** The transaction being converted. */
  transactionId: string;
  /** The transaction's own account id (excluded from the counterpart picker). */
  transactionAccountId: string;
  /** The transaction's amount as a string (sign drives direction messaging). */
  transactionAmount: string;
  /** Currency of the transaction's account (for cross-currency detection). */
  transactionCurrency: CurrencyCode;
  accounts: Account[];
  onSuccess?: () => void;
}

const selectStyle = {
  width: '100%',
  padding: '8px',
  borderRadius: '6px',
  border: '1px solid #E2E8F0',
};

export const ConvertToTransferModal = ({
  open,
  onClose,
  transactionId,
  transactionAccountId,
  transactionAmount,
  transactionCurrency,
  accounts,
  onSuccess,
}: ConvertToTransferModalProps) => {
  const [counterpartId, setCounterpartId] = useState('');
  const [counterpartAmount, setCounterpartAmount] = useState('');
  const [exchangeRate, setExchangeRate] = useState('');
  // Same-currency only: opt into a different amount on the counterpart leg.
  const [differentAmount, setDifferentAmount] = useState(false);

  const convertMutation = useConvertToTransfer();

  // Counterpart options: exclude debt accounts and the transaction's own account.
  const counterpartOptions = useMemo(
    () =>
      accounts.filter(
        (a) => a.account_type !== AccountType.DEBT && a.id !== transactionAccountId
      ),
    [accounts, transactionAccountId]
  );

  const counterpart = counterpartOptions.find((a) => a.id === counterpartId);
  const isCrossCurrency = !!counterpart && counterpart.currency !== transactionCurrency;

  // Show a counterpart-amount input when cross-currency (always) or when a
  // same-currency conversion opts into a different amount.
  const showCounterpartAmount = !!counterpart && (isCrossCurrency || differentAmount);

  // Soft, non-blocking warning if a same-currency counterpart amount differs
  // from the original by more than ~20%.
  const deltaWarning = (() => {
    if (!counterpart || isCrossCurrency || !differentAmount) return null;
    const origAbs = Math.abs(Number(transactionAmount));
    const cpAbs = Math.abs(Number(counterpartAmount || '0'));
    if (!(origAbs > 0) || !(cpAbs > 0)) return null;
    const delta = Math.abs(cpAbs - origAbs);
    if (delta > 0.2 * origAbs) {
      return `The counterpart amount differs from the original by ${((delta / origAbs) * 100).toFixed(0)}%. Double-check this is intended.`;
    }
    return null;
  })();

  // Direction messaging: a positive (credit) transaction means money came FROM
  // the counterpart (it's the source); a negative (debit) means money went TO it.
  const amountNum = Number(transactionAmount);
  const directionHint =
    amountNum > 0
      ? 'This credit will be recorded as money transferred FROM the selected account.'
      : 'This debit will be recorded as money transferred TO the selected account.';

  const reset = () => {
    setCounterpartId('');
    setCounterpartAmount('');
    setExchangeRate('');
    setDifferentAmount(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!counterpartId) return;

    const data: ConvertToTransferRequest = { account_id: counterpartId };
    if (isCrossCurrency) {
      if (counterpartAmount) {
        data.counterpart_amount = Number(counterpartAmount);
      } else if (exchangeRate) {
        data.exchange_rate = Number(exchangeRate);
      }
    } else if (differentAmount && counterpartAmount) {
      // Same-currency unequal legs: send the explicit counterpart amount.
      data.counterpart_amount = Number(counterpartAmount);
    }

    try {
      await convertMutation.mutateAsync({ transactionId, data });
      toaster.create({
        title: 'Converted to transfer',
        description: 'The transaction is now linked as a transfer.',
        type: 'success',
      });
      reset();
      onSuccess?.();
      onClose();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to convert transaction to transfer';
      toaster.create({ title: 'Conversion failed', description: message, type: 'error' });
    }
  };

  return (
    <DialogRoot open={open} onOpenChange={(e) => !e.open && handleClose()} size="lg">
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
          <DialogTitle>Convert to Transfer</DialogTitle>
          <DialogCloseTrigger />
        </DialogHeader>

        <DialogBody>
          <VStack align="stretch" gap={4}>
            {convertMutation.error && <ErrorAlert error={convertMutation.error} />}

            <Text fontSize="sm" color="fg.muted">
              {directionHint}
            </Text>

            <Field label="Counterpart Account" required>
              <select
                value={counterpartId}
                onChange={(e) => setCounterpartId(e.target.value)}
                style={selectStyle}
              >
                <option value="">Select account</option>
                {counterpartOptions.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.currency})
                  </option>
                ))}
              </select>
            </Field>

            {isCrossCurrency && (
              <Box
                p={4}
                borderWidth="1px"
                borderColor="border.muted"
                borderRadius="md"
                bg="bg.muted"
              >
                <Text fontSize="sm" fontWeight="semibold" mb={3}>
                  Cross-currency conversion
                </Text>
                <Text fontSize="xs" color="fg.muted" mb={3}>
                  The accounts use different currencies. Provide either the amount on the
                  counterpart account or an exchange rate.
                </Text>
                <VStack align="stretch" gap={3}>
                  <Field label={`Counterpart amount (${counterpart?.currency ?? ''})`}>
                    <Input
                      value={counterpartAmount}
                      onChange={(e) => setCounterpartAmount(e.target.value)}
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                    />
                  </Field>
                  <Field
                    label="Exchange Rate"
                    helperText={`1 ${transactionCurrency} = ? ${counterpart?.currency ?? ''}`}
                  >
                    <Input
                      value={exchangeRate}
                      onChange={(e) => setExchangeRate(e.target.value)}
                      type="number"
                      step="0.000001"
                      min="0"
                      placeholder="1.0000"
                    />
                  </Field>
                </VStack>
              </Box>
            )}

            {/* Same-currency: optional different counterpart amount (discount/fee). */}
            {counterpart && !isCrossCurrency && (
              <VStack align="stretch" gap={2}>
                <label
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                >
                  <input
                    type="checkbox"
                    checked={differentAmount}
                    onChange={(e) => setDifferentAmount(e.target.checked)}
                  />
                  <Text fontSize="sm">Different amount on the other account</Text>
                </label>

                {showCounterpartAmount && (
                  <Field
                    label="Counterpart amount"
                    helperText="The amount on the other account, if it differs from this transaction (e.g. a discount or fee)."
                  >
                    <Input
                      value={counterpartAmount}
                      onChange={(e) => setCounterpartAmount(e.target.value)}
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                    />
                  </Field>
                )}
              </VStack>
            )}

            {deltaWarning && (
              <Box
                p={3}
                borderWidth="1px"
                borderColor="orange.300"
                borderRadius="md"
                bg="orange.50"
              >
                <Text fontSize="sm" color="orange.800">
                  {deltaWarning}
                </Text>
              </Box>
            )}
          </VStack>
        </DialogBody>

        <DialogFooter>
          <HStack gap={2}>
            <Button variant="outline" onClick={handleClose} disabled={convertMutation.isPending}>
              Cancel
            </Button>
            <Button
              colorPalette="blue"
              onClick={() => void handleSubmit()}
              disabled={!counterpartId}
              loading={convertMutation.isPending}
            >
              Convert
            </Button>
          </HStack>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};
