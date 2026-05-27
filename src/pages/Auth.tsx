import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Brain, AlertCircle, Eye, EyeOff } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { usePrefetchMainPages } from "@/hooks/usePrefetch";
import { AuthBackground3D } from "@/components/backgrounds";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BuildBadge } from "@/components/BuildBadge";

// Official Google "G" logo (4-color SVG). Brand-faithful for the "Continuar com Google" button.
const GoogleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
    <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
  </svg>
);

const Auth = () => {
  // Prefetch Dashboard and Onboarding while user fills login form
  usePrefetchMainPages();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  
  // Session redirect params
  const reason = searchParams.get('reason');
  const returnTo = searchParams.get('returnTo');
  const redirectTo = returnTo || searchParams.get('redirect') || '/dashboard';

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);


  // Signup state
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [signupName, setSignupName] = useState("");

  // OAuth state — separate spinner so it doesn't disable email/password tabs
  const [oauthLoading, setOauthLoading] = useState(false);

  useEffect(() => {
    const modeParam = searchParams.get('mode');
    if (modeParam === 'signup' || modeParam === 'login') {
      setMode(modeParam);
    }

    // Check if user is already logged in
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('[Auth] Session check error:', error.message);
          // Clear potentially corrupted session
          await supabase.auth.signOut();
        } else if (session) {
          // Valid session exists. Honor returnTo (e.g. /onboarding/finish) before defaulting to dashboard.
          const dest = returnTo && returnTo.startsWith('/') ? returnTo : '/dashboard';
          navigate(dest, { replace: true });
          return;
        }
      } catch (err) {
        console.error('[Auth] Unexpected error:', err);
      } finally {
        setCheckingSession(false);
      }
    };

    checkSession();
  }, [navigate, searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast({
            title: "Erro ao fazer login",
            description: "Email ou senha incorretos. Verifique seus dados e tente novamente.",
            variant: "destructive",
          });
        } else {
          throw error;
        }
        return;
      }

      if (data.session) {
        // Check if user is suspended
        const { data: userData } = await supabase
          .from('users')
          .select('onboarding_completed, is_active')
          .eq('id', data.session.user.id)
          .maybeSingle();

        if (userData?.is_active === false) {
          await supabase.auth.signOut();
          toast({
            title: "Conta suspensa",
            description: "Sua conta foi suspensa. Entre em contato com o suporte para mais informações.",
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "Login realizado!",
          description: "Bem-vindo de volta!",
        });

        if (userData && userData.onboarding_completed === false) {
          navigate('/onboarding');
        } else {
          // If userData is null (user row not yet created) or onboarding is complete, go to dashboard
          // Dashboard will handle user creation if needed
          const dest = redirectTo.startsWith('/') ? redirectTo : '/dashboard';
          navigate(dest);
        }
      }
    } catch (error: any) {
      toast({
        title: "Erro ao fazer login",
        description: error.message || "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (signupPassword.length < 6) {
        toast({
          title: "Senha muito curta",
          description: "A senha deve ter pelo menos 6 caracteres.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: signupEmail,
        password: signupPassword,
        options: {
          data: {
            name: signupName,
          },
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) {
        if (error.message.includes('already registered')) {
          toast({
            title: "Email já cadastrado",
            description: "Este email já está em uso. Faça login ou use outro email.",
            variant: "destructive",
          });
        } else {
          throw error;
        }
        return;
      }

      if (data.session) {
        // Se veio do quiz pré-signup (Onboarding V2), linka respostas
        // anônimas à conta criada via RPC link_onboarding_v2_to_user.
        const fromQuiz = searchParams.get('from') === 'quiz';
        if (fromQuiz) {
          const cookieMatch = document.cookie.match(
            /(?:^|; )yesliv_quiz_session=([^;]*)/,
          );
          const quizSessionId = cookieMatch
            ? decodeURIComponent(cookieMatch[1])
            : null;
          if (quizSessionId) {
            try {
              await supabase.rpc('link_onboarding_v2_to_user', {
                p_session_id: quizSessionId,
                p_user_id: data.session.user.id,
              });
            } catch (linkErr) {
              // Falha silenciosa — não bloqueia o signup, mas loga.
              console.warn('[Auth] link_onboarding_v2_to_user failed', linkErr);
            }
          }
        }

        toast({
          title: "Conta criada com sucesso!",
          description: "Vamos começar sua jornada! 🚀",
        });

        // Quem veio do quiz pré-signup já fez todo o onboarding — vai direto pro dashboard.
        // Honra returnTo se vier explicitamente; senão padrão é onboarding antigo.
        const dest =
          returnTo && returnTo.startsWith('/')
            ? returnTo
            : fromQuiz
              ? '/dashboard'
              : '/onboarding';
        navigate(dest);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao criar conta",
        description: error.message || "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };




  const handleGoogleSignIn = async () => {
    setOauthLoading(true);
    try {
      // Preserve returnTo so the post-OAuth chain (e.g. /onboarding/finish → Stripe) works.
      const dest = returnTo && returnTo.startsWith('/') ? returnTo : '/dashboard';
      const callbackUrl = `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(dest)}`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callbackUrl,
          // prompt: 'consent' is kept for staging — gives explicit consent each time, easier to debug.
          // Drop this for production polish so returning users skip the unnecessary screen.
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      });

      if (error) {
        setOauthLoading(false);
        toast({
          title: 'Erro ao entrar com Google',
          description: error.message,
          variant: 'destructive',
        });
      }
      // On success, the browser is redirected away — no state to update.
    } catch (err) {
      setOauthLoading(false);
      toast({
        title: 'Erro ao entrar com Google',
        description: err instanceof Error ? err.message : 'Erro inesperado.',
        variant: 'destructive',
      });
    }
  };

  // Show loading while checking session to prevent flash
  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-primary">
        <Loader2 className="w-8 h-8 animate-spin text-primary-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 gradient-primary relative overflow-hidden">
      <AuthBackground3D />
      <Card className="w-full max-w-md shadow-medium relative z-10">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 gradient-primary rounded-2xl flex items-center justify-center text-primary-foreground mb-4">
            <Brain className="w-8 h-8" />
          </div>
          <CardTitle className="text-2xl">IA Academy</CardTitle>
          <CardDescription>
            {mode === 'login' ? 'Entre na sua conta' : 'Crie sua conta gratuitamente'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Session expiry alert */}
          {reason === 'session_missing' && (
            <Alert className="mb-4 border-amber-200 bg-amber-50">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 text-sm">
                Sua sessão expirou. Faça login para voltar ao dashboard.
              </AlertDescription>
            </Alert>
          )}
          {reason === 'error' && (
            <Alert className="mb-4 border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800 text-sm">
                Ocorreu um erro ao carregar seus dados. Faça login novamente.
              </AlertDescription>
            </Alert>
          )}
          {reason === 'oauth_failed' && (
            <Alert className="mb-4 border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800 text-sm">
                Não foi possível concluir o login com Google. Tente novamente.
              </AlertDescription>
            </Alert>
          )}

          {/* Google OAuth — single button shared by login + signup */}
          <Button
            type="button"
            variant="outline"
            className="w-full mb-4"
            disabled={loading || oauthLoading}
            onClick={handleGoogleSignIn}
          >
            {oauthLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Redirecionando...
              </>
            ) : (
              <>
                <GoogleIcon className="mr-2 h-4 w-4" />
                Continuar com Google
              </>
            )}
          </Button>

          <div className="flex items-center gap-3 mb-4">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">ou</span>
            <Separator className="flex-1" />
          </div>

          <Tabs value={mode} onValueChange={(v) => setMode(v as 'login' | 'signup')} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar Conta</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={showLoginPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      disabled={loading}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    'Entrar'
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Nome Completo</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="João Silva"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="signup-password"
                      type={showSignupPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      required
                      disabled={loading}
                      minLength={6}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignupPassword(!showSignupPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showSignupPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">Mínimo de 6 caracteres</p>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Criando conta...
                    </>
                  ) : (
                    'Criar Conta Gratuita'
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>



          <div className="mt-6 text-center">
            <Button
              variant="ghost"
              onClick={() => navigate('/')}
              className="text-sm"
            >
              ← Voltar para home
            </Button>
          </div>
        </CardContent>
      </Card>
      <BuildBadge />
    </div>
  );
};

export default Auth;