import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Lock, Sparkles } from 'lucide-react';
import { cheapestPlanForFeature, PLAN_DISPLAY_NAMES, type Feature } from '@/services/entitlements';

interface UpgradePromptProps {
  feature: Feature;
  /** Optional headline override */
  title?: string;
  /** Optional descriptive copy */
  description?: string;
}

/**
 * Soft block UI shown when a user lacks the required entitlement.
 * Tells them which plan unlocks the feature and links to /pricing.
 */
export function UpgradePrompt({ feature, title, description }: UpgradePromptProps) {
  const navigate = useNavigate();
  const requiredPlan = cheapestPlanForFeature(feature);
  const requiredPlanName = requiredPlan ? PLAN_DISPLAY_NAMES[requiredPlan] : 'Pro';

  return (
    <div className="min-h-[400px] flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardContent className="pt-8 pb-8 space-y-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mx-auto shadow-lg">
            <Lock className="w-8 h-8 text-white" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-900">
              {title ?? `Conteúdo exclusivo do plano ${requiredPlanName}`}
            </h2>
            <p className="text-gray-600">
              {description ?? `Faça upgrade para acessar este conteúdo e desbloquear todos os recursos do plano ${requiredPlanName}.`}
            </p>
          </div>

          <div className="space-y-3">
            <Button
              size="lg"
              className="w-full font-semibold"
              style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)' }}
              onClick={() => navigate('/pricing')}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Ver Planos
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              ← Voltar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
