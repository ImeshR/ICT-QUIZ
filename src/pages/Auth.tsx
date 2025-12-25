import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Mail, Lock, User } from 'lucide-react';
import Footer from '@/components/Footer';

export default function Auth() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const { error } = await signIn(email, password);
    
    if (error) {
      toast.error(error.message || 'Failed to sign in');
    } else {
      toast.success('Welcome back!');
      navigate('/dashboard');
    }
    setLoading(false);
  };

  // const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
  //   e.preventDefault();
  //   setLoading(true);
  //
  //   const formData = new FormData(e.currentTarget);
  //   const email = formData.get('email') as string;
  //   const password = formData.get('password') as string;
  //   const fullName = formData.get('fullName') as string;
  //
  //   if (password.length < 6) {
  //     toast.error('Password must be at least 6 characters');
  //     setLoading(false);
  //     return;
  //   }
  //
  //   const { error } = await signUp(email, password, fullName);
  //
  //   if (error) {
  //     toast.error(error.message || 'Failed to create account');
  //   } else {
  //     toast.success('Account created successfully!');
  //     navigate('/dashboard');
  //   }
  //   setLoading(false);
  // };

  return (
    <div className="min-h-screen gradient-hero flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md card-elevated animate-bounce-in">
          <CardHeader className="text-center space-y-4 pt-8 pb-8">
            <div className="mx-auto w-20 h-20 rounded-2xl flex items-center justify-center  animate-pulse-scale">
              {/*<Play className="w-10 h-10 text-primary-foreground ml-1" />*/}
              <img
                  src="/quizioo-logo.png"
                  alt="Quizioo"
                  className="w-80 h-80 rounded-xl object-contain max-w-none"
              />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">Quizioo</CardTitle>
              <CardDescription className="font-sinhala">
                ගුරු පුරනය / Teacher Login
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin" className="w-full">
              <div className="flex w-full mb-6 justify-center items-center">
                <div className="font-bold text-xl">Sign In</div>
              </div>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signin-email"
                        name="email"
                        type="email"
                        placeholder="teacher@school.lk"
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signin-password"
                        name="password"
                        type="password"
                        placeholder="••••••••"
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full gradient-primary btn-bounce" 
                    disabled={loading}
                  >
                    {loading ? 'Signing in...' : 'Sign In'}
                  </Button>
                </form>
              </TabsContent>
              
              {/*<TabsContent value="signup">*/}
              {/*  <form onSubmit={handleSignUp} className="space-y-4">*/}
              {/*    <div className="space-y-2">*/}
              {/*      <Label htmlFor="signup-name">Full Name</Label>*/}
              {/*      <div className="relative">*/}
              {/*        <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />*/}
              {/*        <Input*/}
              {/*          id="signup-name"*/}
              {/*          name="fullName"*/}
              {/*          type="text"*/}
              {/*          placeholder="Your name"*/}
              {/*          className="pl-10"*/}
              {/*          required*/}
              {/*        />*/}
              {/*      </div>*/}
              {/*    </div>*/}
              {/*    <div className="space-y-2">*/}
              {/*      <Label htmlFor="signup-email">Email</Label>*/}
              {/*      <div className="relative">*/}
              {/*        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />*/}
              {/*        <Input*/}
              {/*          id="signup-email"*/}
              {/*          name="email"*/}
              {/*          type="email"*/}
              {/*          placeholder="teacher@school.lk"*/}
              {/*          className="pl-10"*/}
              {/*          required*/}
              {/*        />*/}
              {/*      </div>*/}
              {/*    </div>*/}
              {/*    <div className="space-y-2">*/}
              {/*      <Label htmlFor="signup-password">Password</Label>*/}
              {/*      <div className="relative">*/}
              {/*        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />*/}
              {/*        <Input*/}
              {/*          id="signup-password"*/}
              {/*          name="password"*/}
              {/*          type="password"*/}
              {/*          placeholder="••••••••"*/}
              {/*          className="pl-10"*/}
              {/*          required*/}
              {/*        />*/}
              {/*      </div>*/}
              {/*    </div>*/}
              {/*    <Button */}
              {/*      type="submit" */}
              {/*      className="w-full gradient-primary btn-bounce" */}
              {/*      disabled={loading}*/}
              {/*    >*/}
              {/*      {loading ? 'Creating account...' : 'Create Account'}*/}
              {/*    </Button>*/}
              {/*  </form>*/}
              {/*</TabsContent>*/}
            </Tabs>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
