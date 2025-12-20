-- Create enum for question types
CREATE TYPE public.question_type AS ENUM ('single', 'multiple');

-- Create profiles table for teachers
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" 
  ON public.profiles FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" 
  ON public.profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Create groups table (classes)
CREATE TABLE public.groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on groups
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- Groups policies
CREATE POLICY "Teachers can view their own groups" 
  ON public.groups FOR SELECT 
  USING (auth.uid() = teacher_id);

CREATE POLICY "Teachers can create groups" 
  ON public.groups FOR INSERT 
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Teachers can update their own groups" 
  ON public.groups FOR UPDATE 
  USING (auth.uid() = teacher_id);

CREATE POLICY "Teachers can delete their own groups" 
  ON public.groups FOR DELETE 
  USING (auth.uid() = teacher_id);

-- Create students table
CREATE TABLE public.students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  student_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on students
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Students policies (teacher access via group ownership)
CREATE POLICY "Teachers can view students in their groups" 
  ON public.students FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.groups 
    WHERE groups.id = students.group_id 
    AND groups.teacher_id = auth.uid()
  ));

CREATE POLICY "Teachers can create students in their groups" 
  ON public.students FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.groups 
    WHERE groups.id = students.group_id 
    AND groups.teacher_id = auth.uid()
  ));

CREATE POLICY "Teachers can update students in their groups" 
  ON public.students FOR UPDATE 
  USING (EXISTS (
    SELECT 1 FROM public.groups 
    WHERE groups.id = students.group_id 
    AND groups.teacher_id = auth.uid()
  ));

CREATE POLICY "Teachers can delete students in their groups" 
  ON public.students FOR DELETE 
  USING (EXISTS (
    SELECT 1 FROM public.groups 
    WHERE groups.id = students.group_id 
    AND groups.teacher_id = auth.uid()
  ));

-- Public read for student code validation
CREATE POLICY "Anyone can validate student codes" 
  ON public.students FOR SELECT 
  USING (true);

-- Create quiz sessions table
CREATE TABLE public.quiz_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  deadline TIMESTAMPTZ NOT NULL,
  participant_limit INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  access_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on quiz_sessions
ALTER TABLE public.quiz_sessions ENABLE ROW LEVEL SECURITY;

-- Quiz sessions policies
CREATE POLICY "Teachers can view their quiz sessions" 
  ON public.quiz_sessions FOR SELECT 
  USING (auth.uid() = teacher_id);

CREATE POLICY "Teachers can create quiz sessions" 
  ON public.quiz_sessions FOR INSERT 
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Teachers can update their quiz sessions" 
  ON public.quiz_sessions FOR UPDATE 
  USING (auth.uid() = teacher_id);

CREATE POLICY "Teachers can delete their quiz sessions" 
  ON public.quiz_sessions FOR DELETE 
  USING (auth.uid() = teacher_id);

-- Public read for quiz access
CREATE POLICY "Anyone can view active quiz sessions by code" 
  ON public.quiz_sessions FOR SELECT 
  USING (true);

-- Create questions table
CREATE TABLE public.questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_session_id UUID NOT NULL REFERENCES public.quiz_sessions(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type question_type NOT NULL DEFAULT 'single',
  image_url TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  time_limit INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on questions
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- Questions policies
CREATE POLICY "Teachers can manage questions for their quizzes" 
  ON public.questions FOR ALL 
  USING (EXISTS (
    SELECT 1 FROM public.quiz_sessions 
    WHERE quiz_sessions.id = questions.quiz_session_id 
    AND quiz_sessions.teacher_id = auth.uid()
  ));

CREATE POLICY "Anyone can view questions for active quizzes" 
  ON public.questions FOR SELECT 
  USING (true);

-- Create answers table
CREATE TABLE public.answers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  answer_text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on answers
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;

-- Answers policies
CREATE POLICY "Teachers can manage answers for their questions" 
  ON public.answers FOR ALL 
  USING (EXISTS (
    SELECT 1 FROM public.questions q
    JOIN public.quiz_sessions qs ON q.quiz_session_id = qs.id
    WHERE answers.question_id = q.id 
    AND qs.teacher_id = auth.uid()
  ));

CREATE POLICY "Anyone can view answers" 
  ON public.answers FOR SELECT 
  USING (true);

-- Create quiz attempts table
CREATE TABLE public.quiz_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_session_id UUID NOT NULL REFERENCES public.quiz_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  score INTEGER DEFAULT 0,
  total_questions INTEGER DEFAULT 0,
  UNIQUE(quiz_session_id, student_id)
);

-- Enable RLS on quiz_attempts
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Quiz attempts policies
CREATE POLICY "Teachers can view attempts for their quizzes" 
  ON public.quiz_attempts FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.quiz_sessions 
    WHERE quiz_sessions.id = quiz_attempts.quiz_session_id 
    AND quiz_sessions.teacher_id = auth.uid()
  ));

CREATE POLICY "Anyone can create quiz attempts" 
  ON public.quiz_attempts FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Anyone can update their quiz attempts" 
  ON public.quiz_attempts FOR UPDATE 
  USING (true);

CREATE POLICY "Anyone can view quiz attempts" 
  ON public.quiz_attempts FOR SELECT 
  USING (true);

-- Create student answers table
CREATE TABLE public.student_answers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attempt_id UUID NOT NULL REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  answer_id UUID NOT NULL REFERENCES public.answers(id) ON DELETE CASCADE,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on student_answers
ALTER TABLE public.student_answers ENABLE ROW LEVEL SECURITY;

-- Student answers policies
CREATE POLICY "Teachers can view student answers for their quizzes" 
  ON public.student_answers FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.quiz_attempts qa
    JOIN public.quiz_sessions qs ON qa.quiz_session_id = qs.id
    WHERE student_answers.attempt_id = qa.id 
    AND qs.teacher_id = auth.uid()
  ));

CREATE POLICY "Anyone can create student answers" 
  ON public.student_answers FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Anyone can view student answers" 
  ON public.student_answers FOR SELECT 
  USING (true);

-- Function to generate unique student code
CREATE OR REPLACE FUNCTION generate_student_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  exists_count INTEGER;
BEGIN
  LOOP
    code := upper(substr(md5(random()::text), 1, 6));
    SELECT COUNT(*) INTO exists_count FROM public.students WHERE student_code = code;
    EXIT WHEN exists_count = 0;
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Function to generate quiz access code
CREATE OR REPLACE FUNCTION generate_quiz_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  exists_count INTEGER;
BEGIN
  LOOP
    code := upper(substr(md5(random()::text), 1, 8));
    SELECT COUNT(*) INTO exists_count FROM public.quiz_sessions WHERE access_code = code;
    EXIT WHEN exists_count = 0;
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate student code
CREATE OR REPLACE FUNCTION set_student_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.student_code IS NULL OR NEW.student_code = '' THEN
    NEW.student_code := generate_student_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_student_code
  BEFORE INSERT ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION set_student_code();

-- Trigger to auto-generate quiz access code
CREATE OR REPLACE FUNCTION set_quiz_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.access_code IS NULL OR NEW.access_code = '' THEN
    NEW.access_code := generate_quiz_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_quiz_code
  BEFORE INSERT ON public.quiz_sessions
  FOR EACH ROW
  EXECUTE FUNCTION set_quiz_code();

-- Function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  RETURN new;
END;
$$;

-- Trigger for new user profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create storage bucket for question images
INSERT INTO storage.buckets (id, name, public) VALUES ('question-images', 'question-images', true);

-- Storage policies
CREATE POLICY "Teachers can upload question images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'question-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view question images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'question-images');

CREATE POLICY "Teachers can delete their question images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'question-images' AND auth.uid() IS NOT NULL);