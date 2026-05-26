import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { XCircle } from 'lucide-react';

const BillingCancel = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 to-gray-100">
      <Card className="w-full max-w-md shadow-lg">
        <CardContent className="pt-8 pb-8 text-center space-y-6">
          <XCircle className="w-16 h-16 mx-auto text-gray-400" />

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-gray-900">Nenhuma cobrança realizada</h1>
            <p className="text-gray-600">
              Você cancelou o pagamento. Pode escolher um plano e tentar novamente quando quiser.
            </p>
          </div>

          <div className="space-y-3">
            <Button className="w-full" size="lg" onClick={() => navigate('/onboarding')}>
              Escolher um plano
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate('/dashboard')}
            >
              Voltar ao Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BillingCancel;
