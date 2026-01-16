import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Clock, Trophy, ArrowLeft, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import Footer from '@/components/Footer';

interface Student {
  id: string;
  first_name: string;
  student_code: string;
}

interface QuizAttempt {
  id: string;
  quiz_session_id: string;
  score: number;
  total_questions: number;
  completed_at: string | null;
  started_at: string;
  time_taken_seconds: number | null;
  quiz_sessions: {
    id: string;
    title: string;
    deadline: string;
  };
}

interface Question {
  id: string;
  question_text: string;
  question_type: 'single' | 'multiple';
  image_url: string | null;
  order_index: number;
  answers: Answer[];
}

interface Answer {
  id: string;
  answer_text: string;
  is_correct: boolean;
}

interface StudentAnswer {
  question_id: string;
  answer_id: string;
  is_correct: boolean;
}

export default function StudentProfile() {
  const { studentCode } = useParams<{ studentCode: string }>();
  const navigate = useNavigate();
  const [student, setStudent] = useState<Student | null>(null);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [selectedAttempt, setSelectedAttempt] = useState<QuizAttempt | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [studentAnswers, setStudentAnswers] = useState<Map<string, string[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    if (studentCode) {
      loadStudentData();
    }
  }, [studentCode]);

  const loadStudentData = async () => {
    if (!studentCode) return;

    try {
      setLoading(true);
      
      // Load student
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('id, first_name, student_code')
        .eq('student_code', studentCode.toUpperCase())
        .maybeSingle();

      if (studentError) throw studentError;
      if (!studentData) {
        toast.error('Student not found');
        navigate('/');
        return;
      }

      setStudent(studentData);

      // Load quiz attempts
      const { data: attemptsData, error: attemptsError } = await supabase
        .from('quiz_attempts')
        .select(`
          id,
          quiz_session_id,
          score,
          total_questions,
          completed_at,
          started_at,
          time_taken_seconds,
          quiz_sessions (
            id,
            title,
            deadline
          )
        `)
        .eq('student_id', studentData.id)
        .order('started_at', { ascending: false });

      if (attemptsError) throw attemptsError;
      
      const mappedAttempts: QuizAttempt[] = (attemptsData || []).map((a: any) => ({
        ...a,
        quiz_sessions: a.quiz_sessions,
      }));

      setAttempts(mappedAttempts);
    } catch (error) {
      console.error('Error loading student data:', error);
      toast.error('Failed to load student profile');
    } finally {
      setLoading(false);
    }
  };

  const loadQuizDetails = async (attempt: QuizAttempt) => {
    try {
      setLoadingDetails(true);
      setSelectedAttempt(attempt);

      // Load questions with answers
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('*, answers(*)')
        .eq('quiz_session_id', attempt.quiz_session_id)
        .order('order_index');

      if (questionsError) throw questionsError;
      setQuestions(questionsData || []);

      // Load student answers
      const { data: answersData, error: answersError } = await supabase
        .from('student_answers')
        .select('question_id, answer_id, is_correct')
        .eq('attempt_id', attempt.id);

      if (answersError) throw answersError;

      // Group answers by question
      const answersMap = new Map<string, string[]>();
      (answersData || []).forEach((sa: StudentAnswer) => {
        if (!answersMap.has(sa.question_id)) {
          answersMap.set(sa.question_id, []);
        }
        answersMap.get(sa.question_id)?.push(sa.answer_id);
      });

      setStudentAnswers(answersMap);
    } catch (error) {
      console.error('Error loading quiz details:', error);
      toast.error('Failed to load quiz details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const getQuestionResult = (question: Question): 'correct' | 'wrong' | 'unanswered' => {
    const userAnswerIds = studentAnswers.get(question.id) || [];
    if (userAnswerIds.length === 0) return 'unanswered';

    const correctIds = question.answers.filter(a => a.is_correct).map(a => a.id);
    
    if (question.question_type === 'single') {
      return correctIds.includes(userAnswerIds[0]) ? 'correct' : 'wrong';
    } else {
      // Multiple choice: must have exact match
      const isCorrect = correctIds.length === userAnswerIds.length && 
                       correctIds.every(id => userAnswerIds.includes(id));
      return isCorrect ? 'correct' : 'wrong';
    }
  };

  const isAnswerSelected = (questionId: string, answerId: string): boolean => {
    return studentAnswers.get(questionId)?.includes(answerId) || false;
  };

  const isCorrectAnswer = (answer: Answer): boolean => {
    return answer.is_correct;
  };

  const colors = ['bg-quiz-red', 'bg-quiz-blue', 'bg-quiz-yellow', 'bg-quiz-green'];

  if (loading) {
    return (
      <div className="min-h-screen gradient-hero flex items-center justify-center">
        <div className="text-primary-foreground text-xl">Loading...</div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen gradient-hero flex items-center justify-center">
        <Card className="w-full max-w-md card-elevated">
          <CardContent className="pt-8 pb-8 text-center">
            <p className="text-lg mb-4">Student not found</p>
            <Button onClick={() => navigate('/')} className="gradient-primary btn-bounce">
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show detailed quiz view
  if (selectedAttempt) {
    const percentage = selectedAttempt.total_questions > 0 
      ? Math.round((selectedAttempt.score / selectedAttempt.total_questions) * 100) 
      : 0;

    return (
      <div className="min-h-screen gradient-hero flex flex-col">
        <div className="flex-1 p-4">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={() => setSelectedAttempt(null)}
                className="text-primary-foreground hover:bg-primary/20"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Profile
              </Button>
            </div>

            {/* Quiz Summary */}
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle className="text-2xl">{selectedAttempt.quiz_sessions.title}</CardTitle>
                <div className="flex flex-wrap gap-4 mt-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4" />
                    <span className="font-semibold text-foreground">
                      Score: {selectedAttempt.score}/{selectedAttempt.total_questions} ({percentage}%)
                    </span>
                  </div>
                  {selectedAttempt.completed_at && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>
                        Completed: {format(new Date(selectedAttempt.completed_at), 'MMM d, yyyy h:mm a')}
                      </span>
                    </div>
                  )}
                  {selectedAttempt.time_taken_seconds && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>
                        Time: {Math.floor(selectedAttempt.time_taken_seconds / 60)}m {selectedAttempt.time_taken_seconds % 60}s
                      </span>
                    </div>
                  )}
                </div>
              </CardHeader>
            </Card>

            {loadingDetails ? (
              <Card className="card-elevated">
                <CardContent className="py-12 text-center">
                  <div className="text-muted-foreground">Loading quiz details...</div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {questions.map((question, qIndex) => {
                  const result = getQuestionResult(question);
                  return (
                    <Card key={question.id} className="card-elevated">
                      <CardHeader>
                        <div className="flex items-start justify-between gap-4">
                          <CardTitle className="text-xl flex-1">
                            Question {qIndex + 1}: {question.question_text}
                          </CardTitle>
                          <div className="flex-shrink-0">
                            {result === 'correct' && (
                              <div className="flex items-center gap-2 text-quiz-green">
                                <CheckCircle className="w-6 h-6" />
                                <span className="font-semibold">Correct</span>
                              </div>
                            )}
                            {result === 'wrong' && (
                              <div className="flex items-center gap-2 text-destructive">
                                <XCircle className="w-6 h-6" />
                                <span className="font-semibold">Wrong</span>
                              </div>
                            )}
                            {result === 'unanswered' && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <XCircle className="w-6 h-6" />
                                <span className="font-semibold">Not Answered</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {question.image_url && (
                          <div className="mb-6 flex justify-center">
                            <img
                              src={question.image_url}
                              alt="Question"
                              className="max-h-64 object-contain rounded-xl shadow-lg"
                            />
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {question.answers.map((answer, aIndex) => {
                            const isSelected = isAnswerSelected(question.id, answer.id);
                            const isCorrect = isCorrectAnswer(answer);

                            return (
                              <div
                                key={answer.id}
                                className={cn(
                                  'relative p-6 rounded-2xl text-lg font-bold transition-all min-h-[80px] flex items-center justify-center',
                                  colors[aIndex % 4],
                                  isCorrect && 'ring-4 ring-green-500 shadow-xl',
                                  'opacity-85 cursor-not-allowed'
                                )}
                              >
                                <span className="text-primary-foreground font-sinhala text-center">
                                  {answer.answer_text}
                                </span>
                                
                                {/* Badge icons - show for selected answers */}
                                {isSelected && (
                                  <div className="absolute -top-2 -right-2">
                                    <div className={cn(
                                      'w-10 h-10 rounded-full flex items-center justify-center shadow-lg',
                                      isCorrect ? 'bg-green-500' : 'bg-red-500'
                                    )}>
                                      {isCorrect ? (
                                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                      ) : (
                                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Correct answer indicator - always show for correct answers */}
                                {isCorrect && (
                                  <div className="absolute bottom-2 left-2 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                                    Correct Answer
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <Footer transparent />
      </div>
    );
  }

  // Show profile with quiz history
  return (
    <div className="min-h-screen gradient-hero flex flex-col">
      <div className="flex-1 p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Profile Header */}
          <Card className="card-elevated">
            <CardContent className="pt-8 pb-8">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center">
                  <User className="w-10 h-10 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold mb-2">
                    Hi, {student.first_name}! 👋
                  </h1>
                  <p className="text-muted-foreground">
                    Student Code: <code className="px-2 py-1 rounded bg-muted text-sm">{student.student_code}</code>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quiz History */}
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-2xl">Quiz History</CardTitle>
              <p className="text-muted-foreground">Your quiz attempts and results</p>
            </CardHeader>
            <CardContent>
              {attempts.length === 0 ? (
                <div className="text-center py-12">
                  <Trophy className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No quiz attempts yet</h3>
                  <p className="text-muted-foreground">
                    You haven't attempted any quizzes yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {attempts.map((attempt) => {
                    const percentage = attempt.total_questions > 0
                      ? Math.round((attempt.score / attempt.total_questions) * 100)
                      : 0;

                    return (
                      <Card
                        key={attempt.id}
                        className="cursor-pointer hover:shadow-lg transition-shadow"
                        onClick={() => loadQuizDetails(attempt)}
                      >
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <h3 className="text-xl font-bold mb-2">
                                {attempt.quiz_sessions.title}
                              </h3>
                              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                                {attempt.completed_at && (
                                  <span>
                                    Completed: {format(new Date(attempt.completed_at), 'MMM d, yyyy')}
                                  </span>
                                )}
                                {attempt.time_taken_seconds && (
                                  <span>
                                    Time: {Math.floor(attempt.time_taken_seconds / 60)}m {attempt.time_taken_seconds % 60}s
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right ml-4">
                              <div className={cn(
                                'text-2xl font-bold mb-1',
                                percentage >= 80 ? 'text-quiz-green' :
                                percentage >= 60 ? 'text-quiz-blue' :
                                percentage >= 40 ? 'text-quiz-yellow' :
                                'text-destructive'
                              )}>
                                {attempt.score}/{attempt.total_questions}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {percentage}%
                              </div>
                              {attempt.completed_at ? (
                                <div className="flex items-center gap-1 text-quiz-green mt-2">
                                  <CheckCircle className="w-4 h-4" />
                                  <span className="text-xs">Completed</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 text-muted-foreground mt-2">
                                  <Clock className="w-4 h-4" />
                                  <span className="text-xs">In Progress</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <Footer transparent />
    </div>
  );
}

