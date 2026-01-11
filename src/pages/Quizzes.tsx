import { useEffect, useState, useRef } from 'react';
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
import { Plus, FileQuestion, Trash2, Copy, ExternalLink, Edit, Clock, Users, X } from 'lucide-react';
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
  duration_seconds: number | null;
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
  const [editQuizOpen, setEditQuizOpen] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<QuizSession | null>(null);
  const [extendDeadline, setExtendDeadline] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  useEffect(() => {
    if (!editQuizOpen) {
      setExtendDeadline(false);
      return;
    }
  }, [editQuizOpen]);

  useEffect(() => {
    if (!newQuizOpen) {
      setSelectedGroups([]);
    }
  }, [newQuizOpen]);

  const loadData = async () => {
    if (!user) return;
    
    try {
      // Explicitly filter by teacher_id to ensure data isolation (RLS should handle this, but being explicit)
      const [quizzesRes, groupsRes] = await Promise.all([
        supabase
          .from('quiz_sessions')
          .select('*, groups(name)')
          .eq('teacher_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('groups')
          .select('id, name')
          .eq('teacher_id', user.id)
          .order('name'),
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
    
    if (selectedGroups.length === 0) {
      toast.error('Please select at least one group');
      return;
    }

    const formData = new FormData(e.currentTarget);
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const deadline = formData.get('deadline') as string;
    const participantLimit = formData.get('participantLimit') as string;
    const durationSeconds = formData.get('durationSeconds') as string;

    // Use first selected group for backward compatibility
    const primaryGroupId = selectedGroups[0];

    try {
      // Create quiz session
      const { data: newQuiz, error: quizError } = await supabase.from('quiz_sessions').insert({
        title,
        description: description || null,
        group_id: primaryGroupId, // Keep for backward compatibility
        deadline: new Date(deadline).toISOString(),
        participant_limit: participantLimit ? parseInt(participantLimit) : null,
        duration_seconds: durationSeconds ? parseInt(durationSeconds) : 1800,
        teacher_id: user?.id,
        access_code: '', // Will be auto-generated
      }).select().single();

      if (quizError) throw quizError;

      // Create group assignments in junction table for all selected groups
      if (newQuiz && selectedGroups.length > 0) {
        const groupAssignments = selectedGroups.map(groupId => ({
          quiz_session_id: newQuiz.id,
          group_id: groupId,
        }));

        const { error: groupError } = await supabase
          .from('quiz_session_groups')
          .insert(groupAssignments);

        if (groupError) {
          console.error('Error creating group assignments:', groupError);
          // Don't throw - quiz is created, group assignments can be added later
        }
      }

      toast.success('Quiz created! Now add questions.');
      setNewQuizOpen(false);
      setSelectedGroups([]);
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create quiz');
    }
  };

  const toggleGroupSelection = (groupId: string) => {
    setSelectedGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const removeGroup = (groupId: string) => {
    setSelectedGroups(prev => prev.filter(id => id !== groupId));
  };

  // Helper function to extract file path from Supabase storage URL
  const extractFilePathFromUrl = (url: string | null): string | null => {
    if (!url) return null;
    try {
      // Supabase storage URL format: https://[project].supabase.co/storage/v1/object/public/question-images/[path]
      const match = url.match(/question-images\/(.+)$/);
      return match ? match[1] : null;
    } catch (error) {
      console.error('Error extracting file path from URL:', error);
      return null;
    }
  };

  // Helper function to delete image from storage
  const deleteImageFromStorage = async (imageUrl: string | null): Promise<void> => {
    if (!imageUrl) return;
    
    const filePath = extractFilePathFromUrl(imageUrl);
    if (!filePath) return;

    try {
      const { error } = await supabase.storage
        .from('question-images')
        .remove([filePath]);

      if (error) {
        console.error('Error deleting image from storage:', error);
        // Don't throw - we don't want to block the operation if image deletion fails
      }
    } catch (error) {
      console.error('Error deleting image from storage:', error);
    }
  };

  const deleteQuiz = async (quizId: string) => {
    if (!confirm('Delete this quiz? All questions and results will be lost.')) return;

    try {
      // Get all questions for this quiz to delete their images
      const { data: questions, error: questionsError } = await supabase
        .from('questions')
        .select('image_url')
        .eq('quiz_session_id', quizId);

      if (questionsError) {
        console.error('Error fetching questions:', questionsError);
        // Continue with deletion even if we can't fetch questions
      } else {
        // Delete all images for this quiz
        const imageDeletionPromises = (questions || [])
          .filter((q: any) => q.image_url)
          .map((q: any) => deleteImageFromStorage(q.image_url));
        
        await Promise.all(imageDeletionPromises);
      }

      // Delete the quiz session (cascade will delete questions and answers)
      const { error } = await supabase.from('quiz_sessions').delete().eq('id', quizId);
      if (error) throw error;

      // Optimistically update UI immediately
      setQuizzes(prev => prev.filter(q => q.id !== quizId));
      toast.success('Quiz deleted');
      
      // Reload data to ensure consistency
      await loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete quiz');
      // Reload on error to ensure state is correct
      loadData();
    }
  };

  const copyQuizLink = (accessCode: string) => {
    const link = `${window.location.origin}/quiz/${accessCode}`;
    navigator.clipboard.writeText(link);
    toast.success('Quiz link copied!');
  };

  const openEditDialog = async (quiz: QuizSession) => {
    // Reload the quiz to get latest data
    const { data: freshQuiz } = await supabase
      .from('quiz_sessions')
      .select('*')
      .eq('id', quiz.id)
      .single();
    
    if (freshQuiz) {
      setEditingQuiz(freshQuiz as QuizSession);
      // Check if deadline is in the past to suggest extending
      const isPast = new Date(freshQuiz.deadline) < new Date();
      setExtendDeadline(isPast);
      setEditQuizOpen(true);
    } else {
      setEditingQuiz(quiz);
      setEditQuizOpen(true);
    }
  };

  const updateQuiz = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingQuiz) return;

    const formData = new FormData(e.currentTarget);
    const deadlineInput = formData.get('deadline') as string;
    const participantLimit = formData.get('participantLimit') as string;
    const durationSeconds = formData.get('durationSeconds') as string;
    const extendDeadline = formData.get('extendDeadline') === 'on';

    try {
      let finalDeadline: string;

      // If extend deadline is checked, extend from current time
      if (extendDeadline) {
        const hoursToAdd = formData.get('extendHours') ? parseInt(formData.get('extendHours') as string) : 0;
        const minutesToAdd = formData.get('extendMinutes') ? parseInt(formData.get('extendMinutes') as string) : 0;
        const now = new Date();
        now.setHours(now.getHours() + hoursToAdd);
        now.setMinutes(now.getMinutes() + minutesToAdd);
        finalDeadline = now.toISOString();
      } else {
        // Use the deadline from the input
        finalDeadline = new Date(deadlineInput).toISOString();
      }

      const updateData: any = {
        deadline: finalDeadline,
        participant_limit: participantLimit ? parseInt(participantLimit) : null,
        duration_seconds: durationSeconds ? parseInt(durationSeconds) : null,
      };

      const { error } = await supabase
        .from('quiz_sessions')
        .update(updateData)
        .eq('id', editingQuiz.id);

      if (error) throw error;

      toast.success('Quiz updated successfully!');
      setEditQuizOpen(false);
      setEditingQuiz(null);
      setExtendDeadline(false);
      await loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update quiz');
    }
  };

  const isExpired = (deadline: string) => new Date(deadline) < new Date();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Quizzes</h1>
            <p className="text-muted-foreground">Manage your quizzes</p>
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
                  <Label>Select Groups *</Label>
                  <Select onValueChange={toggleGroupSelection}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose groups" />
                    </SelectTrigger>
                    <SelectContent>
                      {groups
                        .filter(group => !selectedGroups.includes(group.id))
                        .map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {selectedGroups.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2 p-3 border rounded-lg bg-muted/30 min-h-[60px]">
                      {selectedGroups.map((groupId) => {
                        const group = groups.find(g => g.id === groupId);
                        return group ? (
                          <div
                            key={groupId}
                            className="flex items-center gap-1 px-3 py-1 bg-primary text-primary-foreground rounded-full text-sm"
                          >
                            <span>{group.name}</span>
                            <button
                              type="button"
                              onClick={() => removeGroup(groupId)}
                              className="ml-1 hover:bg-primary-foreground/20 rounded-full p-0.5 transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : null;
                      })}
                    </div>
                  )}
                  {selectedGroups.length === 0 && (
                    <p className="text-sm text-muted-foreground">No groups selected</p>
                  )}
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

          {/* Edit Quiz Dialog */}
          <Dialog open={editQuizOpen} onOpenChange={(open) => {
            setEditQuizOpen(open);
            if (!open) {
              setEditingQuiz(null);
              setExtendDeadline(false);
            }
          }}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Edit Quiz Settings</DialogTitle>
              </DialogHeader>
              {editingQuiz && (
                <form onSubmit={updateQuiz} key={editingQuiz.id} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-deadline">Deadline</Label>
                    <Input 
                      id="edit-deadline" 
                      name="deadline" 
                      type="datetime-local" 
                      required 
                      defaultValue={new Date(editingQuiz.deadline).toISOString().slice(0, 16)}
                      min={new Date().toISOString().slice(0, 16)}
                      disabled={extendDeadline}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-participantLimit">Participant Limit (Optional)</Label>
                    <Input 
                      id="edit-participantLimit" 
                      name="participantLimit" 
                      type="number" 
                      placeholder="Leave empty for unlimited"
                      min="1"
                      defaultValue={editingQuiz.participant_limit || ''}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-durationSeconds">Quiz Duration (Seconds)</Label>
                    <Input 
                      id="edit-durationSeconds" 
                      name="durationSeconds" 
                      type="number" 
                      placeholder="e.g. 1800 (30 minutes)"
                      min="1"
                      defaultValue={editingQuiz.duration_seconds || 1800}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Total time in seconds students have to complete the quiz
                    </p>
                  </div>
                  <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="extendDeadline"
                        name="extendDeadline"
                        checked={extendDeadline}
                        onChange={(e) => setExtendDeadline(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300"
                      />
                      <Label htmlFor="extendDeadline" className="text-sm font-normal cursor-pointer">
                        Extend deadline from current time
                      </Label>
                    </div>
                    {extendDeadline && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label htmlFor="extendHours" className="text-xs">Hours</Label>
                            <Input 
                              id="extendHours" 
                              name="extendHours" 
                              type="number" 
                              min="0"
                              defaultValue="0"
                              placeholder="0"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="extendMinutes" className="text-xs">Minutes</Label>
                            <Input 
                              id="extendMinutes" 
                              name="extendMinutes" 
                              type="number" 
                              min="0"
                              max="59"
                              defaultValue="0"
                              placeholder="0"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => {
                        setEditQuizOpen(false);
                        setEditingQuiz(null);
                        setExtendDeadline(false);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" className="flex-1 gradient-primary">Update Quiz</Button>
                  </div>
                </form>
              )}
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
                  <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
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
                    {quiz.duration_seconds && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        Duration: {Math.floor(quiz.duration_seconds / 60)}m
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
                      variant="outline"
                      size="icon"
                      className="hover:bg-primary/10"
                      onClick={() => openEditDialog(quiz)}
                      title="Edit Quiz Settings"
                    >
                      <Clock className="w-4 h-4" />
                    </Button>
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
