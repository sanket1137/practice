import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import { useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import {
  createWalletTopUp,
  confirmWalletTopUp,
  loadRazorpayScript,
} from '../../services/paymentApi';
import type { RazorpayResponse } from '../../types/payment';

interface WalletTopUpDialogProps {
  open: boolean;
  onClose: () => void;
  currency?: string;
  /**
   * Optional suggested top-up amount (e.g. shortage on a campaign review screen).
   * The user can override it. Rounded up to the nearest 100 for a clean UX.
   */
  suggestedAmount?: number;
  /**
   * Optional prefill for the Razorpay checkout (improves UX, not required).
   */
  prefill?: { name?: string; email?: string; contact?: string };
  /**
   * Fired after the wallet has been credited successfully and the wallet/wizard-wallet
   * queries have been invalidated. The parent can use this to auto-continue (e.g. fire
   * the campaign launch mutation).
   */
  onSuccess?: (newBalance: number) => void;
  /**
   * Query keys to invalidate on success. Defaults to ['wallet'] and ['wizard-wallet'].
   */
  invalidateQueryKeys?: ReadonlyArray<ReadonlyArray<string | number>>;
}

const MIN_TOPUP = 100;
const MAX_TOPUP = 500_000;

function roundUpToHundred(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return MIN_TOPUP;
  return Math.max(MIN_TOPUP, Math.ceil(n / 100) * 100);
}

export function WalletTopUpDialog({
  open,
  onClose,
  currency = 'INR',
  suggestedAmount,
  prefill,
  onSuccess,
  invalidateQueryKeys,
}: WalletTopUpDialogProps) {
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  const suggested = useMemo(
    () => roundUpToHundred(suggestedAmount ?? MIN_TOPUP),
    [suggestedAmount],
  );

  const [amount, setAmount] = useState<string>(suggested.toString());
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAmount(suggested.toString());
      setError(null);
    }
  }, [open, suggested]);

  const parsedAmount = Number(amount);
  const amountValid =
    Number.isFinite(parsedAmount) &&
    parsedAmount >= MIN_TOPUP &&
    parsedAmount <= MAX_TOPUP &&
    Number.isInteger(parsedAmount * 100); // ≤2 decimals

  const handleTopUp = async () => {
    if (!amountValid || processing) return;
    setProcessing(true);
    setError(null);

    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded || typeof window.Razorpay === 'undefined') {
        throw new Error('Could not load Razorpay checkout. Check your network and try again.');
      }

      const order = await createWalletTopUp(parsedAmount);

      const keysToInvalidate =
        invalidateQueryKeys ?? ([['wallet'], ['wizard-wallet'], ['wallet-transactions']] as const);

      let resolved = false;
      const finishOnce = (success: boolean, message?: string) => {
        if (resolved) return;
        resolved = true;
        setProcessing(false);
        if (!success && message) setError(message);
      };

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount * 100, // backend returns INR; Razorpay expects paise
        currency: order.currency,
        order_id: order.orderId,
        name: 'PixelSpot Wallet Top-Up',
        description: `Add ${order.currency} ${parsedAmount.toFixed(2)} to your wallet`,
        prefill,
        theme: { color: '#6366f1' },
        handler: async (resp: RazorpayResponse) => {
          try {
            const wallet = await confirmWalletTopUp(
              resp.razorpay_order_id,
              resp.razorpay_payment_id,
              resp.razorpay_signature,
              parsedAmount,
            );
            await Promise.all(
              keysToInvalidate.map((qk) =>
                queryClient.invalidateQueries({ queryKey: [...qk] }),
              ),
            );
            enqueueSnackbar(
              `Top-up successful. New balance: ${order.currency} ${wallet.balance.toFixed(2)}`,
              { variant: 'success' },
            );
            finishOnce(true);
            onSuccess?.(wallet.balance);
            onClose();
          } catch (verifyErr) {
            const msg =
              verifyErr instanceof Error
                ? verifyErr.message
                : 'Payment was received but verification failed. Please refresh and check your wallet.';
            enqueueSnackbar(msg, { variant: 'error' });
            finishOnce(false, msg);
          }
        },
        modal: {
          ondismiss: () => {
            finishOnce(false);
          },
        },
      });

      rzp.open();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not start top-up. Please try again.';
      setError(msg);
      enqueueSnackbar(msg, { variant: 'error' });
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onClose={processing ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AccountBalanceWalletIcon color="primary" />
        Top up wallet
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {suggestedAmount && suggestedAmount > 0 && (
            <Alert severity="info" variant="outlined">
              Suggested amount to fully cover your campaign:{' '}
              <strong>
                {currency} {suggested.toLocaleString()}
              </strong>
              .
            </Alert>
          )}

          <TextField
            label="Amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={processing}
            fullWidth
            InputProps={{
              startAdornment: <InputAdornment position="start">{currency}</InputAdornment>,
              inputProps: { min: MIN_TOPUP, max: MAX_TOPUP, step: 1 },
            }}
            helperText={`Min ${currency} ${MIN_TOPUP} • Max ${currency} ${MAX_TOPUP.toLocaleString()}`}
            error={!!amount && !amountValid}
          />

          <Stack direction="row" spacing={1} flexWrap="wrap">
            {[suggested, suggested + 500, suggested + 1000, 5000].map((q) => (
              <Button
                key={q}
                size="small"
                variant="outlined"
                disabled={processing}
                onClick={() => setAmount(String(q))}
              >
                + {currency} {q.toLocaleString()}
              </Button>
            ))}
          </Stack>

          <Divider />

          <Box>
            <Typography variant="body2" color="text.secondary">
              You will be charged via Razorpay. Funds are credited to your wallet immediately after
              successful payment verification. No money leaves Razorpay if verification fails.
            </Typography>
          </Box>

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={processing}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleTopUp}
          disabled={!amountValid || processing}
          startIcon={processing ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {processing ? 'Processing…' : `Pay ${currency} ${parsedAmount || 0}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default WalletTopUpDialog;
