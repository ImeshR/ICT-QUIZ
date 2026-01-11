import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';
import { Plus, Trash2, ArrowLeft, Image, GripVertical, Check, Loader2 } from 'lucide-react';
import imageCompression from 'browser-image-compression';

interface Answer {
  id?: string;
  answer_text: string;
  is_correct: boolean;
  order_index: number;
}

interface Question {
  id?: string;
  question_text: string;
  question_type: 'single' | 'multiple';
  image_url: string | null;
  order_index: number;
  answers: Answer[];
}

interface Group {
  id: string;
  name: string;
}

export default function QuizEdit() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [quizTitle, setQuizTitle] = useState('');
  const [quizDescription, setQuizDescription] = useState('');
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [availableGroups, setAvailableGroups] = useState<Group[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState<number | null>(null);

  useEffect(() => {
    if (quizId && user) {
      loadQuiz();
    }
  }, [quizId, user]);

  const loadQuiz = async () => {
    if (!quizId || !user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Load quiz metadata
      const { data: quiz, error: quizError } = await supabase
        .from('quiz_sessions')
        .select('title, description')
        .eq('id', quizId)
        .single();

      if (quizError) throw quizError;
      setQuizTitle(quiz.title || '');
      setQuizDescription(quiz.description || '');

      // Load available groups
      const { data: groupsData, error: groupsError } = await supabase
        .from('groups')
        .select('id, name')
        .eq('teacher_id', user.id)
        .order('name');

      if (groupsError) throw groupsError;
      setAvailableGroups(groupsData || []);

      // Load assigned groups
      const { data: assignedGroups, error: assignedError } = await supabase
        .from('quiz_session_groups')
        .select('group_id')
        .eq('quiz_session_id', quizId);

      if (assignedError) throw assignedError;
      setSelectedGroups((assignedGroups || []).map((g: any) => g.group_id));

      // Load questions
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('*, answers(*)')
        .eq('quiz_session_id', quizId)
        .order('order_index');

      if (questionsError) throw questionsError;

      const formattedQuestions = (questionsData || []).map((q: any) => ({
        id: q.id,
        question_text: q.question_text,
        question_type: q.question_type as 'single' | 'multiple',
        image_url: q.image_url,
        order_index: q.order_index,
        answers: (q.answers || [])
          .sort((a: any, b: any) => a.order_index - b.order_index)
          .map((a: any) => ({
            id: a.id,
            answer_text: a.answer_text,
            is_correct: a.is_correct,
            order_index: a.order_index,
          })),
      }));

      setQuestions(formattedQuestions);
    } catch (error: any) {
      console.error('Error loading quiz:', error);
      toast.error(error.message || 'Failed to load quiz');
    } finally {
      setLoading(false);
    }
  };

  const addQuestion = () => {
    const newQuestion: Question = {
      question_text: '',
      question_type: 'single',
      image_url: null,
      order_index: questions.length,
      answers: [
        { answer_text: '', is_correct: false, order_index: 0 },
        { answer_text: '', is_correct: false, order_index: 1 },
        { answer_text: '', is_correct: false, order_index: 2 },
        { answer_text: '', is_correct: false, order_index: 3 },
      ],
    };
    setQuestions([...questions, newQuestion]);
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

  const removeQuestion = async (index: number) => {
    const questionToRemove = questions[index];
    
    // Delete image from storage if it exists
    if (questionToRemove.image_url) {
      await deleteImageFromStorage(questionToRemove.image_url);
    }
    
    // Remove question from state
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const updateQuestion = (index: number, updates: Partial<Question>) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], ...updates };
    setQuestions(updated);
  };

  const updateAnswer = (qIndex: number, aIndex: number, updates: Partial<Answer>) => {
    const updated = [...questions];
    updated[qIndex].answers[aIndex] = { ...updated[qIndex].answers[aIndex], ...updates };
    
    // For single answer questions, uncheck others when one is selected
    if (updates.is_correct && updated[qIndex].question_type === 'single') {
      updated[qIndex].answers = updated[qIndex].answers.map((a, i) => ({
        ...a,
        is_correct: i === aIndex,
      }));
    }
    
    setQuestions(updated);
  };

  const handleImageUpload = async (qIndex: number, file: File) => {
    setUploadingImage(qIndex);
    
    try {
      // Check file size before compression (show warning if too large)
      const maxSizeBeforeCompression = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSizeBeforeCompression) {
        toast.warning('Large image detected. Compressing...');
      }

      // Compression options
      const options = {
        maxSizeMB: 1, // Maximum file size in MB (after compression)
        maxWidthOrHeight: 1920, // Maximum width or height in pixels
        useWebWorker: true, // Use web worker for better performance
        fileType: file.type === 'image/png' 
          ? 'image/png' // Keep PNG for transparency
          : 'image/jpeg', // Convert to JPEG for better compression
        initialQuality: 0.8, // 80% quality (good balance between size and quality)
      };

      // Compress the image
      let compressedFile: File;
      try {
        compressedFile = await imageCompression(file, options);
        
        // Show compression stats
        const originalSizeMB = (file.size / (1024 * 1024)).toFixed(2);
        const compressedSizeMB = (compressedFile.size / (1024 * 1024)).toFixed(2);
        const savings = ((1 - compressedFile.size / file.size) * 100).toFixed(0);
        
        if (compressedFile.size < file.size) {
          toast.success(`Image optimized: ${originalSizeMB}MB → ${compressedSizeMB}MB (${savings}% smaller)`);
        }
      } catch (compressionError) {
        console.error('Compression error:', compressionError);
        // If compression fails, use original file
        compressedFile = file;
        toast.warning('Could not compress image, uploading original');
      }

      // Determine file extension based on compressed file type
      const fileExt = compressedFile.type.includes('png') ? 'png' : 'jpg';
      const fileName = `${quizId}/${Date.now()}.${fileExt}`;
      
      // Upload compressed image
      const { error: uploadError } = await supabase.storage
        .from('question-images')
        .upload(fileName, compressedFile, {
          contentType: compressedFile.type,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('question-images')
        .getPublicUrl(fileName);

      updateQuestion(qIndex, { image_url: publicUrl });
      toast.success('Image uploaded successfully!');
    } catch (error: any) {
      console.error('Error uploading image:', error);
      toast.error(error.message || 'Failed to upload image');
    } finally {
      setUploadingImage(null);
    }
  };

  const saveQuiz = async () => {
    // Validate quiz metadata
    if (!quizTitle.trim()) {
      toast.error('Quiz title is required');
      return;
    }

    if (selectedGroups.length === 0) {
      toast.error('Please select at least one group');
      return;
    }

    // Validate questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question_text.trim()) {
        toast.error(`Question ${i + 1} is empty`);
        return;
      }
      if (q.answers.filter(a => a.answer_text.trim()).length < 2) {
        toast.error(`Question ${i + 1} needs at least 2 answers`);
        return;
      }
      if (!q.answers.some(a => a.is_correct)) {
        toast.error(`Question ${i + 1} needs at least one correct answer`);
        return;
      }
    }

    setSaving(true);
    try {
      // Update quiz metadata
      const { error: updateError } = await supabase
        .from('quiz_sessions')
        .update({
          title: quizTitle.trim(),
          description: quizDescription.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', quizId);

      if (updateError) throw updateError;

      // Update group assignments
      // First, delete all existing assignments
      const { error: deleteError } = await supabase
        .from('quiz_session_groups')
        .delete()
        .eq('quiz_session_id', quizId);

      if (deleteError) throw deleteError;

      // Then, insert new assignments (validation ensures at least one group is selected)
      // Double-check for safety - this should never be empty due to validation above
      if (selectedGroups.length === 0) {
        throw new Error('At least one group must be assigned to the quiz');
      }

      const groupAssignments = selectedGroups.map(groupId => ({
        quiz_session_id: quizId,
        group_id: groupId,
      }));

      const { error: insertError } = await supabase
        .from('quiz_session_groups')
        .insert(groupAssignments);

      if (insertError) throw insertError;
      // Get existing questions to find which images need to be deleted
      const { data: existingQuestions, error: fetchError } = await supabase
        .from('questions')
        .select('id, image_url')
        .eq('quiz_session_id', quizId);

      if (fetchError) throw fetchError;

      // Find questions that are being removed (exist in DB but not in current state)
      // Only check questions that have IDs (were previously saved)
      const currentQuestionIds = new Set(
        questions
          .filter(q => q.id) // Only questions that were previously saved
          .map(q => q.id)
      );

      const questionsToDelete = (existingQuestions || []).filter(
        (eq: any) => !currentQuestionIds.has(eq.id)
      );

      // Delete images for removed questions
      for (const deletedQuestion of questionsToDelete) {
        if (deletedQuestion.image_url) {
          await deleteImageFromStorage(deletedQuestion.image_url);
        }
      }

      // Also check for images that were removed from existing questions
      for (const currentQ of questions) {
        if (currentQ.id) {
          // This is an existing question - check if image was removed
          const existingQ = existingQuestions?.find((eq: any) => eq.id === currentQ.id);
          if (existingQ?.image_url && !currentQ.image_url) {
            // Image was removed from this question
            await deleteImageFromStorage(existingQ.image_url);
          }
        }
      }

      // Delete existing questions (cascade deletes answers)
      await supabase.from('questions').delete().eq('quiz_session_id', quizId);

      // Insert new questions
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const { data: questionData, error: questionError } = await supabase
          .from('questions')
          .insert({
            quiz_session_id: quizId,
            question_text: q.question_text,
            question_type: q.question_type,
            image_url: q.image_url,
            order_index: i,
          })
          .select()
          .single();

        if (questionError) throw questionError;

        // Insert answers
        const answersToInsert = q.answers
          .filter(a => a.answer_text.trim())
          .map((a, j) => ({
            question_id: questionData.id,
            answer_text: a.answer_text,
            is_correct: a.is_correct,
            order_index: j,
          }));

        const { error: answersError } = await supabase
          .from('answers')
          .insert(answersToInsert);

        if (answersError) throw answersError;
      }

      toast.success('Quiz saved successfully!');
      navigate('/dashboard/quizzes');
    } catch (error) {
      console.error('Error saving quiz:', error);
      toast.error('Failed to save quiz');
    } finally {
      setSaving(false);
    }
  };

  const toggleGroup = (groupId: string) => {
    setSelectedGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const answerColors = ['quiz-btn-red', 'quiz-btn-blue', 'quiz-btn-yellow', 'quiz-btn-green'];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/quizzes')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Edit Quiz</h1>
          </div>
          <Button onClick={saveQuiz} className="gradient-primary btn-bounce" disabled={saving}>
            {saving ? 'Saving...' : 'Save Quiz'}
          </Button>
        </div>

        {/* Quiz Metadata Section */}
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle>Quiz Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="quiz-title">Quiz Title *</Label>
              <Input
                id="quiz-title"
                value={quizTitle}
                onChange={(e) => setQuizTitle(e.target.value)}
                placeholder="Enter quiz title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quiz-description">Description</Label>
              <Textarea
                id="quiz-description"
                value={quizDescription}
                onChange={(e) => setQuizDescription(e.target.value)}
                placeholder="Enter quiz description (optional)"
                className="min-h-[100px]"
              />
            </div>
            <div className="space-y-2">
              <Label>Assigned Groups *</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 border rounded-lg bg-muted/30">
                {availableGroups.length === 0 ? (
                  <p className="text-sm text-muted-foreground col-span-2">
                    No groups available. Create groups first.
                  </p>
                ) : (
                  availableGroups.map((group) => (
                    <div
                      key={group.id}
                      className="flex items-center space-x-2 cursor-pointer"
                      onClick={() => toggleGroup(group.id)}
                    >
                      <Checkbox
                        id={`group-${group.id}`}
                        checked={selectedGroups.includes(group.id)}
                        onCheckedChange={() => toggleGroup(group.id)}
                      />
                      <Label
                        htmlFor={`group-${group.id}`}
                        className="cursor-pointer flex-1 font-normal"
                      >
                        {group.name}
                      </Label>
                    </div>
                  ))
                )}
              </div>
              {selectedGroups.length === 0 && (
                <p className="text-sm text-destructive">Please select at least one group</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Questions */}
        <div className="space-y-6">
          {questions.map((question, qIndex) => (
            <Card key={qIndex} className="card-elevated animate-slide-up">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <GripVertical className="w-5 h-5 text-muted-foreground" />
                    Question {qIndex + 1}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => removeQuestion(qIndex)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Question Text */}
                <div className="space-y-2">
                  <Label>Question Text</Label>
                  <Textarea
                    value={question.question_text}
                    onChange={(e) => updateQuestion(qIndex, { question_text: e.target.value })}
                    placeholder="Enter your question here..."
                    className="min-h-[100px]"
                  />
                </div>

                {/* Question Type */}
                <div className="flex items-center gap-4">
                  <Label>Answer Type:</Label>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={question.question_type === 'multiple'}
                      onCheckedChange={(checked) => 
                        updateQuestion(qIndex, { question_type: checked ? 'multiple' : 'single' })
                      }
                    />
                    <span className="text-sm">
                      {question.question_type === 'single' ? 'Single Answer' : 'Multiple Answers'}
                    </span>
                  </div>
                </div>

                {/* Image Upload */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Image className="w-4 h-4 text-muted-foreground" />
                    <Label>Question Image (Optional)</Label>
                    {uploadingImage === qIndex && (
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    )}
                  </div>
                  {question.image_url ? (
                    <div className="relative">
                      <img 
                        src={question.image_url} 
                        alt="Question" 
                        className="max-h-48 rounded-xl object-contain"
                      />
                      <Button
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2"
                        disabled={uploadingImage === qIndex}
                        onClick={async () => {
                          const currentImageUrl = question.image_url;
                          // Delete image from storage
                          if (currentImageUrl) {
                            await deleteImageFromStorage(currentImageUrl);
                          }
                          // Update state to remove image reference
                          updateQuestion(qIndex, { image_url: null });
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Input
                        type="file"
                        accept="image/*"
                        disabled={uploadingImage === qIndex}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            // Validate file type
                            if (!file.type.startsWith('image/')) {
                              toast.error('Please select a valid image file');
                              return;
                            }
                            handleImageUpload(qIndex, file);
                          }
                        }}
                      />
                      {uploadingImage === qIndex && (
                        <p className="text-sm text-muted-foreground">
                          Optimizing and uploading image...
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Images will be automatically optimized to reduce file size
                      </p>
                    </div>
                  )}
                </div>

                {/* Answers */}
                <div className="space-y-3">
                  <Label>Answers (click to mark as correct)</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {question.answers.map((answer, aIndex) => (
                      <div
                        key={aIndex}
                        onClick={() => {
                          if (question.question_type === 'single') {
                            updateAnswer(qIndex, aIndex, { is_correct: true });
                          } else {
                            updateAnswer(qIndex, aIndex, { is_correct: !answer.is_correct });
                          }
                        }}
                        className={`relative rounded-xl p-4 ${answerColors[aIndex]} transition-all cursor-pointer hover:scale-105 ${
                          answer.is_correct ? 'ring-4 ring-foreground ring-offset-2 shadow-lg' : 'hover:ring-2 hover:ring-foreground/50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          {question.question_type === 'single' ? (
                            <div className="w-5 h-5 rounded-full border-2 border-primary-foreground flex items-center justify-center">
                              {answer.is_correct && (
                                <div className="w-3 h-3 rounded-full bg-primary-foreground" />
                              )}
                            </div>
                          ) : (
                            <div className={`w-5 h-5 rounded border-2 border-primary-foreground flex items-center justify-center ${
                              answer.is_correct ? 'bg-primary-foreground' : ''
                            }`}>
                              {answer.is_correct && (
                                <Check className="w-4 h-4 text-inherit" />
                              )}
                            </div>
                          )}
                          {answer.is_correct && (
                            <Check className="w-5 h-5 text-primary-foreground" />
                          )}
                        </div>
                        <Input
                          value={answer.answer_text}
                          onChange={(e) => {
                            e.stopPropagation();
                            updateAnswer(qIndex, aIndex, { answer_text: e.target.value });
                          }}
                          onClick={(e) => e.stopPropagation()}
                          placeholder={`Answer ${aIndex + 1}`}
                          className="bg-transparent border-0 text-inherit placeholder:text-inherit/50 font-medium text-center"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Add Question Button */}
          <Button
            variant="outline"
            className="w-full h-24 border-2 border-dashed border-primary/30 hover:border-primary hover:bg-primary/5 btn-bounce"
            onClick={addQuestion}
          >
            <Plus className="w-6 h-6 mr-2" />
            Add Question
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
