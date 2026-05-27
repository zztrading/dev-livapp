import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import {
  startCheckout,
  setPendingPlan,
  upgradeSubscription,
  downgradeSubscription,
  cancelScheduledDowngrade,
  type PlanId,
} from '@/services/billing';
import { useSubscription, isSubscriptionActive } from '@/hooks/useSubscription';
import {
  UpgradeConfirmModal,
  DowngradeConfirmModal,
  ScheduledChangeBanner,
} from '@/components/billing/PlanChangeModals';
import { Loader2, Check } from 'lucide-react';

interface UserProfile {
  readiness_level: string;
}

interface PricingScreenProps {
  profile: UserProfile | null;
  /** When false, plan selection stores intent + sends user through signup → /onboarding/finish. */
  isAuthenticated?: boolean;
}

interface PlanCard {
  id: PlanId;
  name: string;
  oldPrice: string;
  newPrice: string;
  amountCents: number;
  perDay: string;
  badge?: string;
  savings?: string;
  highlighted?: boolean;
}

export const PricingScreen = ({ profile, isAuthenticated = true }: PricingScreenProps) => {
  const [timeLeft, setTimeLeft] = useState(600);
  const [currentPurchase, setCurrentPurchase] = useState(0);
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);
  const [upgradeTarget, setUpgradeTarget] = useState<PlanCard | null>(null);
  const [downgradeTarget, setDowngradeTarget] = useState<PlanCard | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: subscription } = useSubscription();

  const purchases = [
    'chris.al*** escolheu Pro',
    'michael.ta*** escolheu Elite',
    'emily.ba*** escolheu Starter',
  ];

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(prev => Math.max(0, prev - 1)), 1000);
    const purchaseTimer = setInterval(() => {
      setCurrentPurchase(prev => (prev + 1) % purchases.length);
    }, 12000);

    return () => {
      clearInterval(timer);
      clearInterval(purchaseTimer);
    };
  }, []);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const plans: PlanCard[] = [
    { id: 'starter', name: 'Starter', oldPrice: 'R$ 194,00', newPrice: 'R$ 97,00',  amountCents:  9700, perDay: 'R$ 3,23/dia' },
    {
      id: 'pro',
      name: 'Pro',
      badge: '👑 MAIS POPULAR!',
      oldPrice: 'R$ 394,00',
      newPrice: 'R$ 197,00',
      amountCents: 19700,
      perDay: 'R$ 6,57/dia',
      savings: 'Economize R$ 197,00',
      highlighted: true,
    },
    { id: 'elite', name: 'Elite', oldPrice: 'R$ 794,00', newPrice: 'R$ 397,00', amountCents: 39700, perDay: 'R$ 13,23/dia', savings: 'Economize R$ 397,00' },
  ];

  // Active subscription + current plan
  const subActive = isSubscriptionActive(subscription);
  const currentPlan = subActive ? plans.find(p => p.id === subscription?.plan_id) : undefined;
  const pendingPlan = subscription?.pending_plan_id
    ? plans.find(p => p.id === subscription.pending_plan_id)
    : undefined;

  // ─── Action handlers ──────────────────────────────────────────────────────

  const handleNewCheckout = async (plan: PlanCard) => {
    if (!isAuthenticated) {
      setPendingPlan(plan.id);
      toast({
        title: `Plano ${plan.name} reservado!`,
        description: 'Crie sua conta para finalizar o pagamento.',
      });
      setTimeout(() => navigate('/auth?mode=signup&returnTo=/onboarding/finish'), 600);
      return;
    }

    setBusyPlanId(plan.id);
    try {
      const { url } = await startCheckout(plan.id);
      window.location.href = url;
    } catch (err) {
      setBusyPlanId(null);
      toast({
        title: 'Erro ao iniciar pagamento',
        description: err instanceof Error ? err.message : 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    }
  };

  const handleConfirmUpgrade = async () => {
    if (!upgradeTarget) return;
    setBusyPlanId(upgradeTarget.id);
    try {
      const result = await upgradeSubscription(upgradeTarget.id);
      toast({ title: 'Upgrade aplicado!', description: result.message });
    } catch (err) {
      toast({
        title: 'Erro ao fazer upgrade',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setBusyPlanId(null);
      setUpgradeTarget(null);
    }
  };

  const handleConfirmDowngrade = async () => {
    if (!downgradeTarget) return;
    setBusyPlanId(downgradeTarget.id);
    try {
      const result = await downgradeSubscription(downgradeTarget.id);
      toast({ title: 'Downgrade agendado', description: result.message });
    } catch (err) {
      toast({
        title: 'Erro ao agendar downgrade',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setBusyPlanId(null);
      setDowngradeTarget(null);
    }
  };

  const handleCancelDowngrade = async () => {
    try {
      const result = await cancelScheduledDowngrade();
      toast({ title: 'Agendamento cancelado', description: result.message });
    } catch (err) {
      toast({
        title: 'Erro ao cancelar agendamento',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  // ─── Per-card action resolver ─────────────────────────────────────────────

  type CardState =
    | { kind: 'new'; }
    | { kind: 'current'; }
    | { kind: 'upgrade'; }
    | { kind: 'downgrade'; }
    | { kind: 'scheduled_target' };

  const resolveCardState = (plan: PlanCard): CardState => {
    if (!subActive || !currentPlan) return { kind: 'new' };
    if (plan.id === currentPlan.id) return { kind: 'current' };
    if (pendingPlan && pendingPlan.id === plan.id) return { kind: 'scheduled_target' };
    if (plan.amountCents > currentPlan.amountCents) return { kind: 'upgrade' };
    return { kind: 'downgrade' };
  };

  const onCardClick = (plan: PlanCard) => {
    const state = resolveCardState(plan);
    if (busyPlanId) return;
    switch (state.kind) {
      case 'new':              return handleNewCheckout(plan);
      case 'upgrade':          return setUpgradeTarget(plan);
      case 'downgrade':        return setDowngradeTarget(plan);
      case 'current':
      case 'scheduled_target': return; // disabled
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">Escolha Seu Plano</h1>

        {/* Scheduled downgrade banner */}
        {pendingPlan && currentPlan && (
          <ScheduledChangeBanner
            currentPlanName={currentPlan.name}
            pendingPlanName={pendingPlan.name}
            pendingChangeAt={subscription?.pending_change_at ?? null}
            pendingAmountCents={pendingPlan.amountCents}
            onCancel={handleCancelDowngrade}
          />
        )}

        {/* Urgency Timer (hide if user already has an active subscription) */}
        {!subActive && (
          <div className="bg-gradient-to-r from-amber-400 to-orange-400 p-6 rounded-xl text-center mb-6">
            <p className="text-white font-semibold mb-2">⏰ Desconto termina em:</p>
            <div className="flex justify-center gap-2 text-white">
              <div className="bg-white/20 px-4 py-2 rounded-lg">
                <div className="text-3xl font-bold">{String(minutes).padStart(2, '0')}</div>
                <div className="text-xs">min</div>
              </div>
              <div className="text-3xl font-bold">:</div>
              <div className="bg-white/20 px-4 py-2 rounded-lg">
                <div className="text-3xl font-bold">{String(seconds).padStart(2, '0')}</div>
                <div className="text-xs">seg</div>
              </div>
            </div>
          </div>
        )}

        {/* Coupon (hide for existing subscribers) */}
        {!subActive && (
          <div className="bg-green-100 border-2 border-green-400 p-4 rounded-xl text-center mb-8">
            ✅ Seu cupom FOI APLICADO! <span className="font-bold">-50%</span>
          </div>
        )}

        {/* Plans */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {plans.map((plan) => {
            const state = resolveCardState(plan);
            const isBusy = busyPlanId === plan.id;
            const isCurrent = state.kind === 'current';
            const isScheduledTarget = state.kind === 'scheduled_target';
            const disabled = isCurrent || isScheduledTarget || (busyPlanId !== null && !isBusy);

            let buttonLabel: React.ReactNode = 'Escolher Plano';
            let buttonVariant: 'default' | 'outline' = plan.highlighted ? 'default' : 'outline';
            switch (state.kind) {
              case 'new':              buttonLabel = 'Escolher Plano'; break;
              case 'current':          buttonLabel = (<><Check className="mr-2 h-4 w-4" />Plano Atual</>); break;
              case 'upgrade':          buttonLabel = 'Fazer Upgrade'; break;
              case 'downgrade':        buttonLabel = 'Fazer Downgrade'; buttonVariant = 'outline'; break;
              case 'scheduled_target': buttonLabel = 'Downgrade Agendado'; break;
            }
            if (isBusy) {
              buttonLabel = (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processando...</>);
            }

            return (
              <div
                key={plan.id}
                className={`bg-white p-6 rounded-xl shadow-lg transition-transform ${
                  plan.highlighted ? 'ring-4 ring-blue-500 scale-105' : ''
                } ${isCurrent ? 'ring-4 ring-green-500' : ''}`}
              >
                {plan.badge && !isCurrent && (
                  <div className="bg-blue-500 text-white text-sm font-bold py-1 px-3 rounded-full mb-4 inline-block">
                    {plan.badge}
                  </div>
                )}
                {isCurrent && (
                  <div className="bg-green-500 text-white text-sm font-bold py-1 px-3 rounded-full mb-4 inline-block">
                    ✓ SEU PLANO
                  </div>
                )}
                <h3 className="text-2xl font-bold mb-4">{plan.name}</h3>
                <div className="mb-4">
                  {!subActive && (
                    <div className="text-gray-400 line-through">{plan.oldPrice}</div>
                  )}
                  <div className="text-4xl font-bold text-blue-600">{plan.newPrice}</div>
                  <div className="text-gray-600">{plan.perDay}</div>
                </div>
                {plan.savings && !subActive && (
                  <p className="text-green-600 font-semibold mb-4">💰 {plan.savings}</p>
                )}
                <Button
                  className="w-full"
                  variant={buttonVariant}
                  disabled={disabled}
                  onClick={() => onCardClick(plan)}
                >
                  {buttonLabel}
                </Button>
              </div>
            );
          })}
        </div>

        {/* Live Purchases */}
        <div className="fixed bottom-8 left-8 bg-white p-4 rounded-lg shadow-xl animate-pulse z-50">
          💬 {purchases[currentPurchase]}
        </div>

        {/* Guarantees */}
        <div className="bg-white p-6 rounded-xl text-center space-y-2 mb-8">
          <p>✅ Garantia de 7 dias</p>
          <p>✅ Cancele quando quiser</p>
          <p>✅ Atualizações gratuitas</p>
        </div>

        <p className="text-center text-gray-500">🔒 Pagamento 100% seguro</p>
      </div>

      {/* Modals */}
      {upgradeTarget && currentPlan && (
        <UpgradeConfirmModal
          open={!!upgradeTarget}
          onOpenChange={(open) => !open && setUpgradeTarget(null)}
          currentPlanName={currentPlan.name}
          currentAmountCents={currentPlan.amountCents}
          targetPlanName={upgradeTarget.name}
          targetAmountCents={upgradeTarget.amountCents}
          currentPeriodEnd={subscription?.current_period_end ?? null}
          onConfirm={handleConfirmUpgrade}
        />
      )}
      {downgradeTarget && currentPlan && (
        <DowngradeConfirmModal
          open={!!downgradeTarget}
          onOpenChange={(open) => !open && setDowngradeTarget(null)}
          currentPlanName={currentPlan.name}
          targetPlanName={downgradeTarget.name}
          targetAmountCents={downgradeTarget.amountCents}
          currentPeriodEnd={subscription?.current_period_end ?? null}
          onConfirm={handleConfirmDowngrade}
        />
      )}
    </div>
  );
};
