import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useLocale } from '@/contexts/LocaleContext';
import { useTranslation } from '@/lib/i18n';
import { Loader2 } from 'lucide-react';

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { locale } = useLocale();
  const { t } = useTranslation(locale);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'login' | 'signup'>('login');

  // Login form
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup form
  const [signupRoomNumber, setSignupRoomNumber] = useState('');
  const [signupFirstName, setSignupFirstName] = useState('');
  const [signupLastName, setSignupLastName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: `${loginUsername}@golgi.local`,
        password: loginPassword,
      });

      if (error) throw error;

      navigate('/');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const username = `${signupRoomNumber}-${signupFirstName.toLowerCase()}`;
      const email = `${username}@golgi.local`;

      const { error } = await supabase.auth.signUp({
        email,
        password: signupPassword,
        options: {
          data: {
            room_number: signupRoomNumber,
            first_name: signupFirstName,
            last_name: signupLastName,
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;

      toast({
        title: t('common.success'),
        description: `Account created! Username: ${username}`,
      });

      setTab('login');
      setLoginUsername(username);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Collegio Golgi
          </CardTitle>
          <CardDescription className="text-center">
            {t('auth.welcomeBack')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'login' | 'signup')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">{t('auth.login')}</TabsTrigger>
              <TabsTrigger value="signup">{t('auth.signup')}</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-username">{t('auth.username')}</Label>
                  <Input
                    id="login-username"
                    placeholder="606-oussama"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('auth.usernameFormat')}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">{t('auth.password')}</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('auth.login')}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-room">{t('auth.roomNumber')}</Label>
                  <Input
                    id="signup-room"
                    placeholder="606"
                    value={signupRoomNumber}
                    onChange={(e) => setSignupRoomNumber(e.target.value)}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-firstname">{t('auth.firstName')}</Label>
                    <Input
                      id="signup-firstname"
                      placeholder="Oussama"
                      value={signupFirstName}
                      onChange={(e) => setSignupFirstName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-lastname">{t('auth.lastName')}</Label>
                    <Input
                      id="signup-lastname"
                      placeholder="Elachqar"
                      value={signupLastName}
                      onChange={(e) => setSignupLastName(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">{t('auth.email')} (Optional)</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="your.email@example.com"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">{t('auth.password')}</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('auth.usernameFormat')}
                </p>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('auth.signup')}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
