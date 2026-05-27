import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';

const BRL = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

// ─── Upgrade modal ──────────────────────────────────────────────────────────

interface UpgradeConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlanName: string;
  currentAmountCents: number;
  targetPlanName: string;
  targetAmountCents: number;
  currentPeriodEnd: string | null;
  onConfirm: () => Promise<void>;
}

export function UpgradeConfirmModal({
  open,
  onOpenChange,
  currentPlanName,
  currentAmountCents,
  targetPlanName,
  targetAmountCents,
  currentPeriodEnd,
  onConfirm,
}: UpgradeConfirmModalProps) {
  const [submitting, setSubmitting] = useState(false);

  // Rough proration estimate: (diff / 30) * days_remaining
  // Stripe calculates the real number; this is a hint, not a guarantee.
  const daysRemaining = (() => {
    if (!currentPeriodEnd) return 30;
    const ms = new Date(currentPeriodEnd).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / 86_400_000));
  })();
  const proratedEstimateCents = Math.round(
    ((targetAmountCents - currentAmountCents) * daysRemaining) / 30,
  );

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Fazer upgrade para {targetPlanName}</AlertDialogTitle>
          <AlertDialogDescription className="space-y-3 pt-2">
            <span className="block">
              Você terá acesso ao <strong>{targetPlanName}</strong> imediatamente.
            </span>
            <span className="block">
              Será cobrado um valor proporcional aos dias restantes do ciclo atual
              (aproximadamente <strong>{BRL(proratedEstimateCents)}</strong>).
            </span>
            <span className="block">
              A partir do próximo ciclo, o valor será de{' '}
              <strong>{BRL(targetAmountCents)}/mês</strong>.
            </span>
            <span className="block text-xs text-gray-500">
              Você está saindo do plano {currentPlanName}.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button onClick={handleConfirm} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Aplicando...
                </>
              ) : (
                'Confirmar upgrade'
              )}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Downgrade modal ────────────────────────────────────────────────────────

interface DowngradeConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlanName: string;
  targetPlanName: string;
  targetAmountCents: number;
  currentPeriodEnd: string | null;
  onConfirm: () => Promise<void>;
}

export function DowngradeConfirmModal({
  open,
  onOpenChange,
  currentPlanName,
  targetPlanName,
  targetAmountCents,
  currentPeriodEnd,
  onConfirm,
}: DowngradeConfirmModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const dateLabel = fmtDate(currentPeriodEnd);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Fazer downgrade para {targetPlanName}</AlertDialogTitle>
          <AlertDialogDescription className="space-y-3 pt-2">
            <span className="block">
              Você continuará no plano <strong>{currentPlanName}</strong> até{' '}
              <strong>{dateLabel}</strong>.
            </span>
            <span className="block">
              A partir de <strong>{dateLabel}</strong>, seu plano será{' '}
              <strong>{targetPlanName}</strong> ({BRL(targetAmountCents)}/mês).
            </span>
            <span className="block">Você não será cobrado agora.</span>
            <span className="block text-xs text-gray-500">
              Você pode cancelar essa mudança a qualquer momento antes de {dateLabel}.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button onClick={handleConfirm} disabled={submitting} variant="default">
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Agendando...
                </>
              ) : (
                'Confirmar downgrade'
              )}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Scheduled-change banner ────────────────────────────────────────────────

interface ScheduledChangeBannerProps {
  currentPlanName: string;
  pendingPlanName: string;
  pendingChangeAt: string | null;
  pendingAmountCents: number;
  onCancel: () => Promise<void>;
}

export function ScheduledChangeBanner({
  currentPlanName,
  pendingPlanName,
  pendingChangeAt,
  pendingAmountCents,
  onCancel,
}: ScheduledChangeBannerProps) {
  const [submitting, setSubmitting] = useState(false);
  const dateLabel = fmtDate(pendingChangeAt);

  const handleCancel = async () => {
    setSubmitting(true);
    try {
      await onCancel();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <div className="flex-1 text-sm text-amber-900">
        <p className="font-semibold mb-1">⏳ Mudança de plano agendada</p>
        <p>
          Você está no <strong>{currentPlanName}</strong> até <strong>{dateLabel}</strong>.
          A partir dessa data, seu plano será <strong>{pendingPlanName}</strong> (
          {BRL(pendingAmountCents)}/mês).
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleCancel}
        disabled={submitting}
        className="bg-white"
      >
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Cancelando...
          </>
        ) : (
          'Cancelar agendamento'
        )}
      </Button>
    </div>
  );
}
