import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { PricingScreen } from '@/components/onboarding/PricingScreen';

/**
 * Authenticated upgrade page. Reuses the existing PricingScreen component
 * (also used in the onboarding flow) with `isAuthenticated` so plan selection
 * goes straight to Stripe Checkout instead of through the signup gate.
 *
 * Accessible from any in-app CTA — e.g. CursoExclusivo "Fazer Upgrade Agora".
 */
export default function Pricing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#FAFBFC]">
      <header className="bg-white/70 backdrop-blur-xl border-b border-gray-200/50 sticky top-0 z-50 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 px-3 py-2 sm:px-4 bg-white rounded-xl border border-gray-200 hover:border-primary transition-all shadow-sm hover:shadow-md"
          >
            <ChevronLeft className="w-4 h-4 text-primary" />
            <span className="font-medium text-sm text-gray-700">Voltar</span>
          </button>
        </div>
      </header>

      <PricingScreen profile={null} isAuthenticated={true} />
    </div>
  );
}
