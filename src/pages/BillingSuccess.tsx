import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useSubscription, isSubscriptionActive } from '@/hooks/useSubscription';
import { clearPendingPlan } from '@/services/billing';

const MAX_WAIT_MS = 8_000;

const BillingSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const { data: subscription, isLoading } = useSubscription();
  const [fellBack, setFellBack] = useState(false);

  useEffect(() => {
    clearPendingPlan();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setFellBack(true), MAX_WAIT_MS);
    return () => clearTimeout(t);
  }, []);

  const active = isSubscriptionActive(subscription);
  const ready = active || fellBack;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-purple-50">
      <Card className="w-full max-w-md shadow-lg">
        <CardContent className="pt-8 pb-8 text-center space-y-6">
          {active ? (
            <CheckCircle2 className="w-16 h-16 mx-auto text-green-500" />
          ) : (
            <Loader2 className="w-16 h-16 mx-auto text-blue-500 animate-spin" />
          )}

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-gray-900">
              {active ? 'Pagamento confirmado!' : 'Finalizando seu pagamento...'}
            </h1>
            <p className="text-gray-600">
              {active
                ? 'Sua assinatura está ativa. Bem-vindo(a) ao YesLiv!'
                : 'Estamos confirmando seu pagamento com a Stripe. Isso leva poucos segundos.'}
            </p>
          </div>

          {sessionId && (
            <p className="text-xs text-gray-400 font-mono break-all">
              Sessão: {sessionId}
            </p>
          )}

          <div className="space-y-3">
            <Button
              className="w-full"
              size="lg"
              disabled={!ready && isLoading}
              onClick={() => navigate('/dashboard')}
            >
              {active ? 'Ir para o Dashboard' : ready ? 'Continuar para o Dashboard' : 'Aguarde...'}
            </Button>
            <p className="text-xs text-gray-500">
              Você também receberá um e-mail de confirmação com sua nota fiscal.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BillingSuccess;
