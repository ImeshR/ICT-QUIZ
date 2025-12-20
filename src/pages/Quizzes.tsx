import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';
import { Plus, FileQuestion, Trash2, Copy, ExternalLink, Edit, Clock, Users } from 'lucide-react';
import { format } from 'date-fns';

interface Group {
  id: string;
  name: string;
}

interface QuizSession {
  id: string;
  title: string;
  description: string | null;
  deadline: string;
  participant_limit: number | null;
  is_active: boolean;
  access_code: string;
  group_id: string;
  created_at: string;
  groups?: { name: string };
}

export default function Quizzes() {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState<QuizSession[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [newQuizOpen, setNewQuizOpen] = useState(false);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      const [quizzesRes, groupsRes] = await Promise.all([
        supabase
          .from('quiz_sessions')
          .select('*, groups(name)')
          .order('created_at', { ascending: false }),
        supabase.from('groups').select('id, name').order('name'),
      ]);

      if (quizzesRes.error) throw quizzesRes.error;
      if (groupsRes.error) throw groupsRes.error;

      setQuizzes(quizzesRes.data || []);
      setGroups(groupsRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const createQuiz = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const groupId = formData.get('groupId') as string;
    const deadline = formData.get('deadline') as string;
    const participantLimit = formData.get('participantLimit') as string;
    const durationSeconds = formData.get('durationSeconds') as string;

    try {
      const { error } = await supabase.from('quiz_sessions').insert({
        title,
        description: description || null,
        group_id: groupId,
        deadline: new Date(deadline).toISOString(),
        participant_limit: participantLimit ? parseInt(participantLimit) : null,
        duration_seconds: durationSeconds ? parseInt(durationSeconds) : 1800,
        teacher_id: user?.id,
        access_code: '', // Will be auto-generated
      });

      if (error) throw error;

      toast.success('Quiz created! Now add questions.');
      setNewQuizOpen(false);
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create quiz');
    }
  };

  const deleteQuiz = async (quizId: string) => {
    if (!confirm('Delete this quiz? All questions and results will be lost.')) return;

    try {
      const { error } = await supabase.from('quiz_sessions').delete().eq('id', quizId);
      if (error) throw error;

      toast.success('Quiz deleted');
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete quiz');
    }
  };

  const copyQuizLink = (accessCode: string) => {
    const link = `${window.location.origin}/quiz/${accessCode}`;
    navigator.clipboard.writeText(link);
    toast.success('Quiz link copied!');
  };

  const isExpired = (deadline: string) => new Date(deadline) < new Date();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Quizzes</h1>
            <p className="text-muted-foreground font-sinhala">ප්‍රශ්නාවලි කළමනාකරණය - Manage your quizzes</p>
          </div>
          <Dialog open={newQuizOpen} onOpenChange={setNewQuizOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary btn-bounce" disabled={groups.length === 0}>
                <Plus className="w-4 h-4 mr-2" />
                New Quiz
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Quiz</DialogTitle>
              </DialogHeader>
              <form onSubmit={createQuiz} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Quiz Title</Label>
                  <Input id="title" name="title" placeholder="e.g. Chapter 5 - Networks" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Input id="description" name="description" placeholder="Brief description" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="groupId">Select Group</Label>
                  <Select name="groupId" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a group" />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deadline">Deadline</Label>
                  <Input 
                    id="deadline" 
                    name="deadline" 
                    type="datetime-local" 
                    required 
                    min={new Date().toISOString().slice(0, 16)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="participantLimit">Participant Limit (Optional)</Label>
                  <Input 
                    id="participantLimit" 
                    name="participantLimit" 
                    type="number" 
                    placeholder="Leave empty for unlimited"
                    min="1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="durationSeconds">Quiz Duration (Seconds)</Label>
                  <Input 
                    id="durationSeconds" 
                    name="durationSeconds" 
                    type="number" 
                    placeholder="e.g. 1800 (30 minutes)"
                    min="1"
                    defaultValue="1800"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Total time in seconds students have to complete the quiz (e.g. 1800 = 30 minutes)
                  </p>
                </div>
                <Button type="submit" className="w-full gradient-primary">Create Quiz</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {groups.length === 0 && (
          <Card className="card-elevated border-2 border-dashed border-primary/30">
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground mb-4">
                Create a group first before creating quizzes.
              </p>
              <Link to="/dashboard/groups">
                <Button variant="outline">Go to Groups</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Quizzes List */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : quizzes.length === 0 ? (
          <Card className="card-elevated">
            <CardContent className="py-12 text-center">
              <FileQuestion className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No quizzes yet</h3>
              <p className="text-muted-foreground mb-4">Create your first quiz to get started</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {quizzes.map((quiz, index) => (
              <Card 
                key={quiz.id} 
                className={`card-elevated animate-slide-up ${isExpired(quiz.deadline) ? 'opacity-75' : ''}`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        isExpired(quiz.deadline) ? 'bg-muted' : 'bg-accent'
                      }`}>
                        <FileQuestion className={`w-6 h-6 ${isExpired(quiz.deadline) ? 'text-muted-foreground' : 'text-accent-foreground'}`} />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{quiz.title}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {quiz.groups?.name}
                        </p>
                      </div>
                    </div>
                    {isExpired(quiz.deadline) && (
                      <span className="px-2 py-1 rounded-full bg-muted text-muted-foreground text-xs">
                        Expired
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {format(new Date(quiz.deadline), 'MMM d, yyyy h:mm a')}
                    </div>
                    {quiz.participant_limit && (
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        Limit: {quiz.participant_limit}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/50">
                    <code className="flex-1 font-mono text-sm text-primary">
                      {quiz.access_code}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => copyQuizLink(quiz.access_code)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="flex gap-2">
                    <Link to={`/dashboard/quizzes/${quiz.id}/edit`} className="flex-1">
                      <Button variant="outline" className="w-full btn-bounce">
                        <Edit className="w-4 h-4 mr-2" />
                        Edit Questions
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => deleteQuiz(quiz.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
