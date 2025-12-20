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
import { toast } from 'sonner';
import { Plus, Trash2, ArrowLeft, Image, GripVertical, Check } from 'lucide-react';

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

export default function QuizEdit() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const [quizTitle, setQuizTitle] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (quizId) {
      loadQuiz();
    }
  }, [quizId]);

  const loadQuiz = async () => {
    try {
      const { data: quiz, error: quizError } = await supabase
        .from('quiz_sessions')
        .select('title')
        .eq('id', quizId)
        .single();

      if (quizError) throw quizError;
      setQuizTitle(quiz.title);

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
    } catch (error) {
      console.error('Error loading quiz:', error);
      toast.error('Failed to load quiz');
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

  const removeQuestion = (index: number) => {
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
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${quizId}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('question-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('question-images')
        .getPublicUrl(fileName);

      updateQuestion(qIndex, { image_url: publicUrl });
      toast.success('Image uploaded!');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image');
    }
  };

  const saveQuiz = async () => {
    // Validate
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
            <p className="text-muted-foreground">{quizTitle}</p>
          </div>
          <Button onClick={saveQuiz} className="gradient-primary btn-bounce" disabled={saving}>
            {saving ? 'Saving...' : 'Save Quiz'}
          </Button>
        </div>

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
                  <Label>Question Text (English / Sinhala)</Label>
                  <Textarea
                    value={question.question_text}
                    onChange={(e) => updateQuestion(qIndex, { question_text: e.target.value })}
                    placeholder="Enter your question here... / ඔබේ ප්‍රශ්නය මෙහි ඇතුළත් කරන්න..."
                    className="min-h-[100px] font-sinhala"
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
                        onClick={() => updateQuestion(qIndex, { image_url: null })}
                      >
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(qIndex, file);
                      }}
                    />
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
