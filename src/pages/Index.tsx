import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { GraduationCap, Play, Users } from 'lucide-react';
import Footer from '@/components/Footer';

export default function Index() {
  const navigate = useNavigate();
  const [studentCode, setStudentCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoinQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentCode.trim()) return;
    
    setLoading(true);
    try {
      const { data: student } = await supabase
        .from('students')
        .select('id, group_id')
        .eq('student_code', studentCode.toUpperCase())
        .maybeSingle();

      if (!student) {
        toast.error('Invalid code. Check with your teacher.');
        setLoading(false);
        return;
      }

      const { data: quiz } = await supabase
        .from('quiz_sessions')
        .select('id, access_code, deadline')
        .eq('group_id', student.group_id)
        .eq('is_active', true)
        .gte('deadline', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!quiz) {
        toast.error('No active quiz available for your group.');
        setLoading(false);
        return;
      }

      navigate(`/quiz/${quiz.access_code}?code=${studentCode.toUpperCase()}`);
    } catch (error) {
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-hero flex flex-col">
      <header className="p-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
            <GraduationCap className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-xl text-primary-foreground">ICT Quiz</span>
        </div>
        <Button variant="secondary" onClick={() => navigate('/auth')} className="btn-bounce">
          <Users className="w-4 h-4 mr-2" />
          Teacher Login
        </Button>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md card-elevated animate-bounce-in">
          <CardContent className="pt-8 pb-8 text-center space-y-6">
            <div className="mx-auto w-20 h-20 rounded-2xl gradient-primary flex items-center justify-center shadow-glow animate-pulse-scale">
              <Play className="w-10 h-10 text-primary-foreground ml-1" />
            </div>
            
            <div>
              <h1 className="text-3xl font-bold mb-2">Join Quiz</h1>
              <p className="text-muted-foreground font-sinhala">ප්‍රශ්නාවලියට සම්බන්ධ වන්න</p>
            </div>

            <form onSubmit={handleJoinQuiz} className="space-y-4">
              <Input
                value={studentCode}
                onChange={(e) => setStudentCode(e.target.value.toUpperCase())}
                placeholder="Enter your code / ඔබේ කේතය ඇතුළත් කරන්න"
                className="text-center text-2xl font-mono tracking-widest h-16"
                maxLength={6}
              />
              <Button 
                type="submit" 
                className="w-full h-14 text-lg gradient-primary btn-bounce shadow-glow"
                disabled={loading || !studentCode.trim()}
              >
                {loading ? 'Joining...' : 'Join Game'}
              </Button>
            </form>

            <p className="text-sm text-muted-foreground">
              Ask your teacher for your student code
            </p>
          </CardContent>
        </Card>
      </main>
      
      <Footer transparent />
    </div>
  );
}
