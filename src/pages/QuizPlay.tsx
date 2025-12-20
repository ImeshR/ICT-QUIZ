import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Trophy, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';

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
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [timeTaken, setTimeTaken] = useState(0);
  const startTimeRef = useRef<number>(Date.now());
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { loadQuiz(); }, [accessCode, studentCode]);

  // Timer effect
  useEffect(() => {
    if (timeRemaining === null || finished || loading) return;

    timerIntervalRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 0) {
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          handleTimeUp();
          return 0;
        }
        return prev - 1;
      });
      setTimeTaken(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [timeRemaining, finished, loading]);

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
      if (existingAttempt?.completed_at) { 
        setScore(existingAttempt.score || 0); 
        setFinished(true); 
        setLoading(false); 
        return; 
      }

      const { data: questionsData } = await supabase.from('questions').select('*, answers(*)').eq('quiz_session_id', quizData.id).order('order_index');
      setQuestions(questionsData || []);

      if (existingAttempt) { 
        setAttempt(existingAttempt);
        startTimeRef.current = new Date(existingAttempt.started_at).getTime();
      } else {
        const { data: newAttempt } = await supabase.from('quiz_attempts').insert({ 
          quiz_session_id: quizData.id, 
          student_id: studentData.id, 
          total_questions: questionsData?.length || 0 
        }).select().single();
        setAttempt(newAttempt);
        startTimeRef.current = Date.now();
      }

      // Initialize timer
      const durationMinutes = (quizData as any).duration_minutes || 30;
      const totalSeconds = durationMinutes * 60;
      setTimeRemaining(totalSeconds);
    } catch (error) { console.error(error); toast.error('Error loading quiz'); }
    finally { setLoading(false); }
  };

  const handleTimeUp = async () => {
    toast.error('Time is up! Submitting your quiz...');
    // Auto-submit current answer if not answered
    if (!answered && selectedAnswers.length > 0 && attempt) {
      const q = questions[currentIndex];
      if (q) {
        const correctIds = q.answers.filter(a => a.is_correct).map(a => a.id);
        const isCorrect = q.question_type === 'single' 
          ? correctIds.includes(selectedAnswers[0])
          : correctIds.length === selectedAnswers.length && correctIds.every(id => selectedAnswers.includes(id));
        if (isCorrect) setScore(s => s + 1);
        await supabase.from('student_answers').insert(selectedAnswers.map(aid => ({ 
          attempt_id: attempt.id, 
          question_id: q.id, 
          answer_id: aid, 
          is_correct: q.answers.find(a => a.id === aid)?.is_correct || false 
        })));
      }
    }
    // Finish quiz
    await finishQuiz();
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

  const finishQuiz = async () => {
    const finalTimeTaken = Math.floor((Date.now() - startTimeRef.current) / 1000);
    await supabase.from('quiz_attempts').update({ 
      score, 
      completed_at: new Date().toISOString(),
      time_taken_seconds: finalTimeTaken
    }).eq('id', attempt.id);
    setFinished(true);
    triggerConfetti();
  };

  const nextQuestion = async () => {
    if (currentIndex < questions.length - 1) { 
      setCurrentIndex(i => i + 1); 
      setSelectedAnswers([]); 
      setAnswered(false); 
    } else {
      await finishQuiz();
    }
  };

  const triggerConfetti = () => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval: NodeJS.Timeout = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      
      confetti({
        ...defaults,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);
  };

  const colors = ['bg-quiz-red', 'bg-quiz-blue', 'bg-quiz-yellow', 'bg-quiz-green'];
  const currentQ = questions[currentIndex];

  if (loading) return <div className="min-h-screen gradient-hero flex items-center justify-center text-primary-foreground text-xl">Loading...</div>;

  if (finished) {
    const percentage = Math.round((score / questions.length) * 100);
    return (
      <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
        <Card className="w-full max-w-md card-elevated animate-bounce-in text-center">
          <CardContent className="pt-8 pb-8 space-y-6">
            <Trophy className="w-20 h-20 mx-auto text-quiz-yellow animate-pulse" />
            <h1 className="text-3xl font-bold">Quiz Complete!</h1>
            <p className="font-sinhala text-muted-foreground">ප්‍රශ්නාවලිය අවසන්!</p>
            <div className="text-5xl font-bold text-primary">{score}/{questions.length}</div>
            <p className="text-lg">{percentage}% correct</p>
            {percentage >= 80 && (
              <p className="text-quiz-green font-bold text-xl">Excellent Work! 🎉</p>
            )}
            {percentage >= 60 && percentage < 80 && (
              <p className="text-quiz-blue font-bold text-xl">Good Job! 👍</p>
            )}
            <p className="text-sm text-muted-foreground">
              Time taken: {Math.floor(timeTaken / 60)}m {timeTaken % 60}s
            </p>
            <Button onClick={() => navigate('/')} className="gradient-primary btn-bounce">Back to Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimeColor = () => {
    if (timeRemaining === null) return '';
    const percentage = (timeRemaining / ((quiz?.duration_minutes || 30) * 60)) * 100;
    if (percentage <= 20) return 'text-destructive animate-pulse';
    if (percentage <= 40) return 'text-quiz-yellow';
    return 'text-primary-foreground';
  };

  return (
    <div className="min-h-screen gradient-hero flex flex-col p-4">
      <div className="flex justify-between items-center mb-4 text-primary-foreground">
        <span className="font-bold">{currentIndex + 1}/{questions.length}</span>
        <div className="flex items-center gap-4">
          {timeRemaining !== null && (
            <div className={cn('flex items-center gap-2 font-bold text-2xl', getTimeColor())}>
              <Clock className="w-5 h-5" />
              {formatTime(timeRemaining)}
            </div>
          )}
          <span className="font-bold">Score: {score}</span>
        </div>
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
