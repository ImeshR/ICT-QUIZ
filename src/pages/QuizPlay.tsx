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
    if (timeRemaining === null || finished || loading) {
      // Clear timer if finished or loading
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      return;
    }

    timerIntervalRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 0) {
          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
          }
          handleTimeUp();
          return 0;
        }
        return prev - 1;
      });
      setTimeTaken(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
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
        setAttempt(existingAttempt);
        // Load questions to show score properly
        const { data: questionsData } = await supabase.from('questions').select('*, answers(*)').eq('quiz_session_id', quizData.id).order('order_index');
        setQuestions(questionsData || []);
        setTimeTaken((existingAttempt as any).time_taken_seconds || 0);
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
      const durationSeconds = (quizData as any).duration_seconds || 1800;
      setTimeRemaining(durationSeconds);
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
    // Stop timer immediately
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    
    const finalTimeTaken = Math.floor((Date.now() - startTimeRef.current) / 1000);
    await supabase.from('quiz_attempts').update({ 
      score, 
      completed_at: new Date().toISOString(),
      time_taken_seconds: finalTimeTaken
    }).eq('id', attempt.id);
    
    setFinished(true);
    setTimeRemaining(null); // Clear timer
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
    const percentage = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;
    const isAlreadyCompleted = attempt?.completed_at && new Date(attempt.completed_at).getTime() < Date.now() - 5000; // Completed more than 5 seconds ago
    
    return (
      <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
        <Card className="w-full max-w-md card-elevated animate-bounce-in text-center">
          <CardContent className="pt-8 pb-8 space-y-6">
            {isAlreadyCompleted ? (
              <>
                <div className="w-20 h-20 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
                  <CheckCircle className="w-12 h-12 text-muted-foreground" />
                </div>
                <h1 className="text-3xl font-bold">Quiz Already Completed</h1>
                <p className="font-sinhala text-muted-foreground">ප්‍රශ්නාවලිය දැනටමත් අවසන් කර ඇත</p>
                <div className="p-4 bg-muted/50 rounded-xl">
                  <p className="text-sm text-muted-foreground mb-2">You have already completed this quiz.</p>
                  <p className="text-sm text-muted-foreground">Your previous results:</p>
                </div>
              </>
            ) : (
              <>
                <Trophy className="w-20 h-20 mx-auto text-quiz-yellow animate-pulse" />
                <h1 className="text-3xl font-bold">Quiz Complete!</h1>
                <p className="font-sinhala text-muted-foreground">ප්‍රශ්නාවලිය අවසන්!</p>
              </>
            )}
            
            <div className="space-y-4">
              <div className="text-5xl font-bold text-primary">{score}/{questions.length}</div>
              <div className="flex items-center justify-center gap-2">
                <div className={cn(
                  "w-3 h-3 rounded-full",
                  percentage >= 80 ? "bg-quiz-green" :
                  percentage >= 60 ? "bg-quiz-blue" :
                  percentage >= 40 ? "bg-quiz-yellow" :
                  "bg-destructive"
                )} />
                <p className="text-lg font-semibold">{percentage}% correct</p>
              </div>
              
              {percentage >= 80 && (
                <p className="text-quiz-green font-bold text-xl animate-pulse">Excellent Work! 🎉</p>
              )}
              {percentage >= 60 && percentage < 80 && (
                <p className="text-quiz-blue font-bold text-xl">Good Job! 👍</p>
              )}
              {percentage < 60 && percentage >= 40 && (
                <p className="text-quiz-yellow font-bold text-xl">Keep Practicing! 💪</p>
              )}
              {percentage < 40 && (
                <p className="text-muted-foreground font-semibold">You can do better next time! 📚</p>
              )}
              
              {timeTaken > 0 && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>Time taken: {Math.floor(timeTaken / 60)}m {timeTaken % 60}s</span>
                </div>
              )}
            </div>
            
            <Button 
              onClick={() => navigate('/')} 
              className="w-full gradient-primary btn-bounce h-12 text-lg"
            >
              Back to Home
            </Button>
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
    if (timeRemaining === null || !quiz) return '';
    const totalDuration = (quiz as any).duration_seconds || 1800;
    const percentage = (timeRemaining / totalDuration) * 100;
    if (percentage <= 20) return 'text-destructive animate-pulse';
    if (percentage <= 40) return 'text-quiz-yellow';
    return 'text-primary-foreground';
  };

  return (
    <div className="min-h-screen gradient-hero flex flex-col p-4">
      {/* Header with progress and timer */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2 text-primary-foreground">
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg">Question {currentIndex + 1} of {questions.length}</span>
          </div>
          <div className="flex items-center gap-4">
            {timeRemaining !== null && (
              <div className={cn('flex items-center gap-2 font-bold text-xl px-3 py-1.5 rounded-lg bg-primary/20', getTimeColor())}>
                <Clock className="w-4 h-4" />
                {formatTime(timeRemaining)}
              </div>
            )}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/20">
              <Trophy className="w-4 h-4" />
              <span className="font-bold">Score: {score}</span>
            </div>
          </div>
        </div>
        {/* Progress bar */}
        <div className="w-full h-2 bg-primary/20 rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      <Card className="flex-1 card-elevated animate-slide-up">
        <CardContent className="h-full flex flex-col p-6 md:p-8">
          {currentQ?.image_url && (
            <div className="mb-6 flex justify-center">
              <img 
                src={currentQ.image_url} 
                alt="Question" 
                className="max-h-64 md:max-h-80 object-contain mx-auto rounded-xl shadow-lg" 
              />
            </div>
          )}
          
          <h2 className="text-xl md:text-2xl font-bold text-center mb-8 font-sinhala min-h-[3rem] flex items-center justify-center">
            {currentQ?.question_text}
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 mb-6">
            {currentQ?.answers.map((ans, i) => (
              <button 
                key={ans.id} 
                onClick={() => handleAnswer(ans.id)} 
                disabled={answered}
                className={cn(
                  'relative p-6 rounded-2xl text-lg font-bold transition-all duration-200 min-h-[80px] flex items-center justify-center',
                  colors[i % 4],
                  selectedAnswers.includes(ans.id) && !answered && 'ring-4 ring-foreground scale-105 shadow-xl',
                  answered && ans.is_correct && 'ring-4 ring-quiz-green shadow-xl',
                  answered && selectedAnswers.includes(ans.id) && !ans.is_correct && 'opacity-60',
                  answered && !selectedAnswers.includes(ans.id) && !ans.is_correct && 'opacity-80',
                  !answered && 'hover:scale-105 hover:shadow-lg',
                  answered && 'cursor-not-allowed'
                )}
              >
                <span className="text-primary-foreground font-sinhala text-center">{ans.answer_text}</span>
                {answered && ans.is_correct && (
                  <CheckCircle className="absolute top-2 right-2 w-6 h-6 text-primary-foreground" />
                )}
                {answered && selectedAnswers.includes(ans.id) && !ans.is_correct && (
                  <XCircle className="absolute top-2 right-2 w-6 h-6 text-primary-foreground" />
                )}
              </button>
            ))}
          </div>

          <div className="mt-auto">
            {!answered ? (
              <Button 
                onClick={submitAnswer} 
                disabled={selectedAnswers.length === 0 || finished} 
                className="w-full h-14 text-lg gradient-primary btn-bounce shadow-lg"
              >
                {selectedAnswers.length === 0 ? 'Select an answer' : 'Submit Answer'}
              </Button>
            ) : (
              <Button 
                onClick={nextQuestion} 
                className="w-full h-14 text-lg gradient-secondary btn-bounce shadow-lg"
                disabled={finished}
              >
                {currentIndex < questions.length - 1 ? 'Next Question →' : 'Finish Quiz ✓'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
