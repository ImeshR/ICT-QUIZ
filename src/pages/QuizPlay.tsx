import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Answer { id: string; answer_text: string; is_correct: boolean; }
interface Question { id: string; question_text: string; question_type: 'single' | 'multiple'; image_url: string | null; answers: Answer[]; }

export default function QuizPlay() {
  const { accessCode } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const studentCode = searchParams.get('code');

  const [quiz, setQuiz] = useState<any>(null);
  const [student, setStudent] = useState<any>(null);
  const [attempt, setAttempt] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([]);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadQuiz(); }, [accessCode, studentCode]);

  const loadQuiz = async () => {
    if (!accessCode || !studentCode) { navigate('/'); return; }
    
    try {
      const { data: quizData } = await supabase.from('quiz_sessions').select('*').eq('access_code', accessCode).maybeSingle();
      if (!quizData || new Date(quizData.deadline) < new Date()) { toast.error('Quiz not available'); navigate('/'); return; }
      setQuiz(quizData);

      const { data: studentData } = await supabase.from('students').select('*').eq('student_code', studentCode).eq('group_id', quizData.group_id).maybeSingle();
      if (!studentData) { toast.error('Invalid student code'); navigate('/'); return; }
      setStudent(studentData);

      const { data: existingAttempt } = await supabase.from('quiz_attempts').select('*').eq('quiz_session_id', quizData.id).eq('student_id', studentData.id).maybeSingle();
      if (existingAttempt?.completed_at) { setScore(existingAttempt.score); setFinished(true); setLoading(false); return; }

      const { data: questionsData } = await supabase.from('questions').select('*, answers(*)').eq('quiz_session_id', quizData.id).order('order_index');
      setQuestions(questionsData || []);

      if (existingAttempt) { setAttempt(existingAttempt); }
      else {
        const { data: newAttempt } = await supabase.from('quiz_attempts').insert({ quiz_session_id: quizData.id, student_id: studentData.id, total_questions: questionsData?.length || 0 }).select().single();
        setAttempt(newAttempt);
      }
    } catch (error) { console.error(error); toast.error('Error loading quiz'); }
    finally { setLoading(false); }
  };

  const handleAnswer = (answerId: string) => {
    if (answered) return;
    const q = questions[currentIndex];
    if (q.question_type === 'single') setSelectedAnswers([answerId]);
    else setSelectedAnswers(prev => prev.includes(answerId) ? prev.filter(id => id !== answerId) : [...prev, answerId]);
  };

  const submitAnswer = async () => {
    if (selectedAnswers.length === 0 || answered) return;
    setAnswered(true);

    const q = questions[currentIndex];
    const correctIds = q.answers.filter(a => a.is_correct).map(a => a.id);
    const isCorrect = q.question_type === 'single' 
      ? correctIds.includes(selectedAnswers[0])
      : correctIds.length === selectedAnswers.length && correctIds.every(id => selectedAnswers.includes(id));

    if (isCorrect) setScore(s => s + 1);

    await supabase.from('student_answers').insert(selectedAnswers.map(aid => ({ attempt_id: attempt.id, question_id: q.id, answer_id: aid, is_correct: q.answers.find(a => a.id === aid)?.is_correct || false })));
  };

  const nextQuestion = async () => {
    if (currentIndex < questions.length - 1) { setCurrentIndex(i => i + 1); setSelectedAnswers([]); setAnswered(false); }
    else {
      await supabase.from('quiz_attempts').update({ score, completed_at: new Date().toISOString() }).eq('id', attempt.id);
      setFinished(true);
    }
  };

  const colors = ['bg-quiz-red', 'bg-quiz-blue', 'bg-quiz-yellow', 'bg-quiz-green'];
  const currentQ = questions[currentIndex];

  if (loading) return <div className="min-h-screen gradient-hero flex items-center justify-center text-primary-foreground text-xl">Loading...</div>;

  if (finished) return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
      <Card className="w-full max-w-md card-elevated animate-bounce-in text-center">
        <CardContent className="pt-8 pb-8 space-y-6">
          <Trophy className="w-20 h-20 mx-auto text-quiz-yellow" />
          <h1 className="text-3xl font-bold">Quiz Complete!</h1>
          <p className="font-sinhala text-muted-foreground">ප්‍රශ්නාවලිය අවසන්!</p>
          <div className="text-5xl font-bold text-primary">{score}/{questions.length}</div>
          <p className="text-lg">{Math.round((score / questions.length) * 100)}% correct</p>
          <Button onClick={() => navigate('/')} className="gradient-primary btn-bounce">Back to Home</Button>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen gradient-hero flex flex-col p-4">
      <div className="flex justify-between items-center mb-4 text-primary-foreground">
        <span className="font-bold">{currentIndex + 1}/{questions.length}</span>
        <span className="font-bold">Score: {score}</span>
      </div>

      <Card className="flex-1 card-elevated animate-slide-up">
        <CardContent className="h-full flex flex-col p-6">
          {currentQ?.image_url && <img src={currentQ.image_url} alt="" className="max-h-48 object-contain mx-auto rounded-xl mb-4" />}
          <h2 className="text-xl font-bold text-center mb-6 font-sinhala">{currentQ?.question_text}</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
            {currentQ?.answers.map((ans, i) => (
              <button key={ans.id} onClick={() => handleAnswer(ans.id)} disabled={answered}
                className={cn('p-6 rounded-2xl text-lg font-bold transition-all', colors[i % 4],
                  selectedAnswers.includes(ans.id) && 'ring-4 ring-foreground scale-105',
                  answered && ans.is_correct && 'ring-4 ring-quiz-green',
                  answered && selectedAnswers.includes(ans.id) && !ans.is_correct && 'opacity-50'
                )}>
                <span className="text-primary-foreground font-sinhala">{ans.answer_text}</span>
                {answered && ans.is_correct && <CheckCircle className="inline ml-2 text-primary-foreground" />}
                {answered && selectedAnswers.includes(ans.id) && !ans.is_correct && <XCircle className="inline ml-2" />}
              </button>
            ))}
          </div>

          <div className="mt-6">
            {!answered ? (
              <Button onClick={submitAnswer} disabled={selectedAnswers.length === 0} className="w-full h-14 text-lg gradient-primary btn-bounce">Submit Answer</Button>
            ) : (
              <Button onClick={nextQuestion} className="w-full h-14 text-lg gradient-secondary btn-bounce">
                {currentIndex < questions.length - 1 ? 'Next Question' : 'See Results'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
