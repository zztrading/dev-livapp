import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { startCheckout, setPendingPlan, type PlanId } from '@/services/billing';
import { Loader2 } from 'lucide-react';

interface UserProfile {
  readiness_level: string;
}

interface PricingScreenProps {
  profile: UserProfile | null;
  /** When false, plan selection stores intent + sends user through signup → /onboarding/finish. */
  isAuthenticated?: boolean;
}

export const PricingScreen = ({ profile, isAuthenticated = true }: PricingScreenProps) => {
  const [timeLeft, setTimeLeft] = useState(600);
  const [currentPurchase, setCurrentPurchase] = useState(0);
  const [checkoutPlanId, setCheckoutPlanId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const purchases = [
    'chris.al*** escolheu Pro',
    'michael.ta*** escolheu Elite',
    'emily.ba*** escolheu Starter'
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

  const handleSelectPlan = async (planId: PlanId, planName: string) => {
    if (!isAuthenticated) {
      setPendingPlan(planId);
      toast({
        title: `Plano ${planName} reservado!`,
        description: 'Crie sua conta para finalizar o pagamento.',
      });
      setTimeout(() => navigate('/auth?mode=signup&returnTo=/onboarding/finish'), 600);
      return;
    }

    setCheckoutPlanId(planId);
    try {
      const { url } = await startCheckout(planId);
      window.location.href = url;
    } catch (err) {
      setCheckoutPlanId(null);
      toast({
        title: 'Erro ao iniciar pagamento',
        description: err instanceof Error ? err.message : 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    }
  };

  const plans: Array<{
    id: PlanId;
    name: string;
    oldPrice: string;
    newPrice: string;
    perDay: string;
    badge?: string;
    savings?: string;
    highlighted?: boolean;
  }> = [
    { id: 'starter', name: 'Starter', oldPrice: 'R$ 194,00', newPrice: 'R$ 97,00', perDay: 'R$ 3,23/dia' },
    {
      id: 'pro',
      name: 'Pro',
      badge: '👑 MAIS POPULAR!',
      oldPrice: 'R$ 394,00',
      newPrice: 'R$ 197,00',
      perDay: 'R$ 6,57/dia',
      savings: 'Economize R$ 197,00',
      highlighted: true,
    },
    { id: 'elite', name: 'Elite', oldPrice: 'R$ 794,00', newPrice: 'R$ 397,00', perDay: 'R$ 13,23/dia', savings: 'Economize R$ 397,00' },
  ];

  return (
    <div className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">Escolha Seu Plano</h1>

        {/* Urgency Timer */}
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

        {/* Coupon */}
        <div className="bg-green-100 border-2 border-green-400 p-4 rounded-xl text-center mb-8">
          ✅ Seu cupom FOI APLICADO! <span className="font-bold">-50%</span>
        </div>

        {/* Plans */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {plans.map((plan, i) => (
            <div
              key={i}
              className={`bg-white p-6 rounded-xl shadow-lg transition-transform ${
                plan.highlighted ? 'ring-4 ring-blue-500 scale-105' : ''
              }`}
            >
              {plan.badge && (
                <div className="bg-blue-500 text-white text-sm font-bold py-1 px-3 rounded-full mb-4 inline-block">
                  {plan.badge}
                </div>
              )}
              <h3 className="text-2xl font-bold mb-4">{plan.name}</h3>
              <div className="mb-4">
                <div className="text-gray-400 line-through">{plan.oldPrice}</div>
                <div className="text-4xl font-bold text-blue-600">{plan.newPrice}</div>
                <div className="text-gray-600">{plan.perDay}</div>
              </div>
              {plan.savings && <p className="text-green-600 font-semibold mb-4">💰 {plan.savings}</p>}
              <Button
                className="w-full"
                variant={plan.highlighted ? "default" : "outline"}
                disabled={checkoutPlanId !== null}
                onClick={() => handleSelectPlan(plan.id, plan.name)}
              >
                {checkoutPlanId === plan.id ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Abrindo checkout...
                  </>
                ) : (
                  'Escolher Plano'
                )}
              </Button>
            </div>
          ))}
        </div>

        {/* Live Purchases */}
        <div className="fixed bottom-8 left-8 bg-white p-4 rounded-lg shadow-xl animate-pulse z-50">
          💬 {purchases[currentPurchase]}
        </div>

        {/* Guarantees */}
        <div className="bg-white p-6 rounded-xl text-center space-y-2 mb-8">
          <p>✅ Garantia de 7 dias</p>
          <p>✅ Acesso vitalício ao conteúdo</p>
          <p>✅ Atualizações gratuitas</p>
        </div>

        <p className="text-center text-gray-500">🔒 Pagamento 100% seguro</p>
      </div>
    </div>
  );
};
