import { useEffect, useMemo, useState } from 'react';
import { Badge, Box, Button, HStack, Input, Spinner, Text, VStack } from '@chakra-ui/react';
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
import { useConvertToTransfer, useConvertCandidates, useDebounce } from '@/hooks';
import { formatCurrency } from '@/utils/formatters/currency';
import { formatDate } from '@/utils/formatters/date';
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

// Two rows are the "same" amount when they agree to the cent, so a candidate
// that exactly offsets the original is badged rather than showing a gap.
const EXACT_EPSILON = 0.005;

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
  // Which existing transaction to link, if any. Empty string means "create new".
  const [selectedCandidateId, setSelectedCandidateId] = useState('');
  // Whether the user has switched to creating a brand-new counterpart leg.
  const [createNew, setCreateNew] = useState(false);
  // Search stays hidden until asked for, so the common case (pick a suggestion)
  // is one tap. Revealed by "Search this account instead".
  const [showSearch, setShowSearch] = useState(false);
  const [searchInput, setSearchInput] = useState('');
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

  const debouncedSearch = useDebounce(searchInput, 400);
  const {
    data: candidateData,
    isLoading: candidatesLoading,
    error: candidatesError,
  } = useConvertCandidates(transactionId, counterpartId, debouncedSearch);

  const candidates = candidateData?.candidates ?? [];
  const total = candidateData?.total ?? 0;

  const originalAbs = Math.abs(Number(transactionAmount));

  // Show a counterpart-amount input when cross-currency (always) or when a
  // same-currency conversion opts into a different amount. Only relevant while
  // creating a new leg; linking keeps the existing transaction's own amount.
  const showCounterpartAmount = !!counterpart && (isCrossCurrency || differentAmount);

  // Soft, non-blocking warning if a same-currency counterpart amount differs
  // from the original by more than ~20%.
  const deltaWarning = (() => {
    if (!createNew || !counterpart || isCrossCurrency || !differentAmount) return null;
    const cpAbs = Math.abs(Number(counterpartAmount || '0'));
    if (!(originalAbs > 0) || !(cpAbs > 0)) return null;
    const delta = Math.abs(cpAbs - originalAbs);
    if (delta > 0.2 * originalAbs) {
      return `The counterpart amount differs from the original by ${((delta / originalAbs) * 100).toFixed(0)}%. Double-check this is intended.`;
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

  // When the account changes, reset the leg choice so a stale candidate from the
  // previous account can never be submitted.
  useEffect(() => {
    setSelectedCandidateId('');
    setCreateNew(false);
    setShowSearch(false);
    setSearchInput('');
    setCounterpartAmount('');
    setExchangeRate('');
    setDifferentAmount(false);
  }, [counterpartId]);

  const reset = () => {
    setCounterpartId('');
    setSelectedCandidateId('');
    setCreateNew(false);
    setShowSearch(false);
    setSearchInput('');
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

    if (!createNew && selectedCandidateId) {
      // Link an existing transaction; its own amount is kept, no rate needed.
      data.counterpart_transaction_id = selectedCandidateId;
    } else if (isCrossCurrency) {
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
        description:
          !createNew && selectedCandidateId
            ? 'The two transactions are now linked as a transfer.'
            : 'The transaction is now linked as a transfer.',
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

  const hasCandidates = candidates.length > 0;
  const isSearching = debouncedSearch.trim().length > 0;
  // The list is capped server-side (5 suggestions, 20 search). Only show the
  // "showing N of M" line when the total exceeds what we display, so an
  // untruncated list stays free of noise.
  const isTruncated = total > candidates.length;

  // The submit is valid when linking a chosen candidate, or when creating a new
  // leg (either explicitly, or because there was nothing to link).
  const canSubmit =
    !!counterpartId && (createNew || !!selectedCandidateId || (!hasCandidates && !isSearching));

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

            {/* Candidate picker: choose an existing transaction to link, or
                fall back to creating a new counterpart leg. */}
            {counterpart && !createNew && (
              <VStack align="stretch" gap={3}>
                {/* Search stays hidden until asked for, so picking a suggestion
                    is one tap. The reveal button doubles as the affordance. */}
                {!showSearch ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    alignSelf="start"
                    onClick={() => setShowSearch(true)}
                  >
                    Search this account instead
                  </Button>
                ) : (
                  <Field
                    label="Search this account"
                    helperText="Search this account by title or notes to find a transaction outside the suggested window."
                  >
                    <Input
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="Search existing transactions"
                      autoFocus
                    />
                  </Field>
                )}

                {candidatesError && <ErrorAlert error={candidatesError} />}

                {candidatesLoading && (
                  <HStack gap={2} color="fg.muted">
                    <Spinner size="sm" />
                    <Text fontSize="sm">Looking for matching transactions...</Text>
                  </HStack>
                )}

                {!candidatesLoading && hasCandidates && (
                  <VStack align="stretch" gap={2}>
                    <Text fontSize="xs" color="fg.muted">
                      {isTruncated
                        ? isSearching
                          ? `Showing ${candidates.length} of ${total} results, narrow your search:`
                          : `Showing ${candidates.length} of ${total} matches:`
                        : isSearching
                          ? 'Matching transactions on this account:'
                          : 'Suggested transactions to link:'}
                    </Text>
                    {candidates.map((candidate) => {
                      const candidateAbs = Math.abs(Number(candidate.amount));
                      const gap = Math.abs(candidateAbs - originalAbs);
                      const isExact = gap < EXACT_EPSILON;
                      // Direction tells him if this row is the right one: a fee
                      // makes the received leg a little "less", a top-up "more".
                      const gapLabel = `${formatCurrency(gap, counterpart.currency)} ${
                        candidateAbs < originalAbs ? 'less' : 'more'
                      }`;
                      const selected = selectedCandidateId === candidate.id;
                      return (
                        <Box
                          key={candidate.id}
                          role="button"
                          tabIndex={0}
                          cursor="pointer"
                          textAlign="left"
                          p={3}
                          borderWidth="1px"
                          borderRadius="md"
                          borderColor={selected ? 'blue.500' : 'border.muted'}
                          bg={selected ? 'blue.50' : 'bg.subtle'}
                          _hover={{ borderColor: 'blue.400' }}
                          onClick={() => setSelectedCandidateId(candidate.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedCandidateId(candidate.id);
                            }
                          }}
                        >
                          <HStack justify="space-between" align="start">
                            <VStack align="start" gap={0}>
                              <Text fontSize="sm" fontWeight="medium">
                                {candidate.title || 'Untitled'}
                              </Text>
                              <Text fontSize="xs" color="fg.muted">
                                {formatDate(candidate.date)}
                              </Text>
                            </VStack>
                            <VStack align="end" gap={1}>
                              <Text fontSize="sm" fontWeight="semibold">
                                {formatCurrency(Number(candidate.amount), counterpart.currency)}
                              </Text>
                              {isExact ? (
                                <Badge colorPalette="green" size="sm">
                                  Exact match
                                </Badge>
                              ) : (
                                <Badge colorPalette="orange" size="sm">
                                  {gapLabel}
                                </Badge>
                              )}
                            </VStack>
                          </HStack>
                        </Box>
                      );
                    })}
                  </VStack>
                )}

                {!candidatesLoading && !hasCandidates && (
                  <Text fontSize="sm" color="fg.muted">
                    {isSearching
                      ? 'No matching transactions on this account.'
                      : 'No existing transactions to link. Create a new one instead.'}
                  </Text>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  alignSelf="start"
                  onClick={() => {
                    setCreateNew(true);
                    setSelectedCandidateId('');
                  }}
                >
                  Create a new transaction instead
                </Button>
              </VStack>
            )}

            {/* Create-new leg controls. Shown once the user opts to create a new
                counterpart transaction rather than link an existing one. */}
            {counterpart && createNew && (
              <VStack align="stretch" gap={3}>
                <HStack justify="space-between">
                  <Text fontSize="sm" fontWeight="semibold">
                    Create a new counterpart transaction
                  </Text>
                  <Button variant="ghost" size="xs" onClick={() => setCreateNew(false)}>
                    Link an existing one instead
                  </Button>
                </HStack>

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
                      <Field label={`Counterpart amount (${counterpart.currency})`}>
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
                        helperText={`1 ${transactionCurrency} = ? ${counterpart.currency}`}
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

                {!isCrossCurrency && (
                  <VStack align="stretch" gap={2}>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                      }}
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
              disabled={!canSubmit}
              loading={convertMutation.isPending}
            >
              {!createNew && selectedCandidateId ? 'Link Transactions' : 'Convert'}
            </Button>
          </HStack>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};
