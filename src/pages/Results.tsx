import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';
import { BarChart3, Trophy, Users, CheckCircle, XCircle, Medal } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface QuizSession {
  id: string;
  title: string;
  deadline: string;
}

interface AttemptResult {
  id: string;
  score: number;
  total_questions: number;
  completed_at: string | null;
  started_at: string;
  ranking: number | null;
  time_taken_seconds: number | null;
  students: {
    first_name: string;
    student_code: string;
  };
}

export default function Results() {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState<QuizSession[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<string | null>(null);
  const [results, setResults] = useState<AttemptResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadQuizzes();
    }
  }, [user]);

  useEffect(() => {
    if (selectedQuiz) {
      loadResults(selectedQuiz);
    }
  }, [selectedQuiz]);

  const loadQuizzes = async () => {
    try {
      const { data, error } = await supabase
        .from('quiz_sessions')
        .select('id, title, deadline')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQuizzes(data || []);
      
      if (data && data.length > 0) {
        setSelectedQuiz(data[0].id);
      }
    } catch (error) {
      console.error('Error loading quizzes:', error);
      toast.error('Failed to load quizzes');
    } finally {
      setLoading(false);
    }
  };

  const loadResults = async (quizId: string) => {
    try {
      // First, check if quiz deadline has passed and calculate rankings
      const { data: quizData } = await supabase
        .from('quiz_sessions')
        .select('deadline')
        .eq('id', quizId)
        .single();

      if (quizData && new Date(quizData.deadline) < new Date()) {
        // Calculate rankings using the database function
        try {
          const { error: rankError } = await (supabase as any).rpc('calculate_quiz_rankings', {
            quiz_session_uuid: quizId
          });
          if (rankError) console.error('Error calculating rankings:', rankError);
        } catch (rpcError) {
          console.error('RPC call failed, rankings may not be calculated:', rpcError);
        }
      }

      // Load results with rankings
      const { data, error } = await supabase
        .from('quiz_attempts')
        .select('*, students(first_name, student_code)')
        .eq('quiz_session_id', quizId)
        .order('ranking', { ascending: true })
        .order('score', { ascending: false })
        .order('time_taken_seconds', { ascending: true });

      if (error) throw error;
      
      // Map data to include ranking and time_taken_seconds with proper types
      const mappedResults: AttemptResult[] = (data || []).map((r: any) => ({
        ...r,
        ranking: r.ranking || null,
        time_taken_seconds: r.time_taken_seconds || null,
      }));
      
      setResults(mappedResults);
    } catch (error) {
      console.error('Error loading results:', error);
      toast.error('Failed to load results');
    }
  };

  const getScoreColor = (score: number, total: number) => {
    const percentage = (score / total) * 100;
    if (percentage >= 80) return 'text-quiz-green';
    if (percentage >= 60) return 'text-quiz-blue';
    if (percentage >= 40) return 'text-quiz-yellow';
    return 'text-destructive';
  };

  const selectedQuizData = quizzes.find(q => q.id === selectedQuiz);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Results</h1>
            <p className="text-muted-foreground font-sinhala">ප්‍රතිඵල විශ්ලේෂණය - View quiz results</p>
          </div>
          {quizzes.length > 0 && (
            <Select value={selectedQuiz || ''} onValueChange={setSelectedQuiz}>
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue placeholder="Select a quiz" />
              </SelectTrigger>
              <SelectContent>
                {quizzes.map((quiz) => (
                  <SelectItem key={quiz.id} value={quiz.id}>
                    {quiz.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : quizzes.length === 0 ? (
          <Card className="card-elevated">
            <CardContent className="py-12 text-center">
              <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No quizzes yet</h3>
              <p className="text-muted-foreground">Create quizzes to see results here</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Stats */}
            {selectedQuizData && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="card-elevated">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                        <Users className="w-5 h-5 text-primary-foreground" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{results.length}</p>
                        <p className="text-sm text-muted-foreground">Participants</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="card-elevated">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-quiz-green flex items-center justify-center">
                        <Trophy className="w-5 h-5 text-primary-foreground" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">
                          {results.length > 0 
                            ? Math.round((results.reduce((sum, r) => sum + (r.score / r.total_questions), 0) / results.length) * 100)
                            : 0}%
                        </p>
                        <p className="text-sm text-muted-foreground">Avg Score</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="card-elevated">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-secondary-foreground" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">
                          {results.filter(r => r.completed_at).length}
                        </p>
                        <p className="text-sm text-muted-foreground">Completed</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="card-elevated">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
                        <BarChart3 className="w-5 h-5 text-accent-foreground" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">
                          {results.length > 0 ? Math.max(...results.map(r => r.score)) : 0}
                        </p>
                        <p className="text-sm text-muted-foreground">Top Score</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Results Table */}
            {results.length === 0 ? (
              <Card className="card-elevated">
                <CardContent className="py-12 text-center">
                  <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No results yet</h3>
                  <p className="text-muted-foreground">
                    Students haven't attempted this quiz yet
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card className="card-elevated overflow-hidden">
                <CardHeader>
                  <CardTitle>Leaderboard</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Rank</th>
                          <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Student</th>
                          <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Code</th>
                          <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Score</th>
                          <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Time</th>
                          <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Status</th>
                          <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Completed</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {results.map((result, index) => {
                          const rank = result.ranking || index + 1;
                          const isTopThree = rank <= 3 && result.completed_at;
                          return (
                          <tr key={result.id} className={cn(
                            "hover:bg-muted/30 transition-colors",
                            isTopThree && "bg-primary/5"
                          )}>
                            <td className="px-6 py-4">
                              {isTopThree ? (
                                <div className="flex items-center gap-2">
                                  <div className={cn(
                                    "w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg",
                                    rank === 1 && "bg-quiz-yellow text-foreground shadow-lg",
                                    rank === 2 && "bg-gray-300 text-foreground shadow-lg",
                                    rank === 3 && "bg-orange-400 text-foreground shadow-lg"
                                  )}>
                                    {rank === 1 && <Medal className="w-6 h-6 text-yellow-600" />}
                                    {rank === 2 && <Medal className="w-6 h-6 text-gray-600" />}
                                    {rank === 3 && <Medal className="w-6 h-6 text-orange-600" />}
                                  </div>
                                  <span className={cn(
                                    "font-bold text-lg",
                                    rank === 1 && "text-quiz-yellow",
                                    rank === 2 && "text-gray-500",
                                    rank === 3 && "text-orange-500"
                                  )}>
                                    {rank === 1 ? '1st' : rank === 2 ? '2nd' : '3rd'}
                                  </span>
                                </div>
                              ) : (
                                <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold bg-muted/50 text-muted-foreground">
                                  {rank}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 font-medium">{result.students?.first_name}</td>
                            <td className="px-6 py-4">
                              <code className="px-2 py-1 rounded bg-muted text-sm">
                                {result.students?.student_code}
                              </code>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`font-bold ${getScoreColor(result.score, result.total_questions)}`}>
                                {result.score}/{result.total_questions}
                              </span>
                              <span className="text-muted-foreground ml-2">
                                ({Math.round((result.score / result.total_questions) * 100)}%)
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-muted-foreground">
                              {result.time_taken_seconds 
                                ? `${Math.floor(result.time_taken_seconds / 60)}m ${result.time_taken_seconds % 60}s`
                                : '-'}
                            </td>
                            <td className="px-6 py-4">
                              {result.completed_at ? (
                                <span className="inline-flex items-center gap-1 text-quiz-green">
                                  <CheckCircle className="w-4 h-4" />
                                  Completed
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-muted-foreground">
                                  <XCircle className="w-4 h-4" />
                                  In Progress
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-muted-foreground text-sm">
                              {result.completed_at 
                                ? format(new Date(result.completed_at), 'MMM d, h:mm a')
                                : '-'}
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
