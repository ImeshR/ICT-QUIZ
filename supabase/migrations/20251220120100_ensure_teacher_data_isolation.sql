-- Ensure RLS policies are correctly set for teacher data isolation
-- This migration verifies and reinforces that teachers can only see their own data

-- Drop and recreate quiz_sessions policies to ensure they're correct
DROP POLICY IF EXISTS "Teachers can view their quiz sessions" ON public.quiz_sessions;
DROP POLICY IF EXISTS "Teachers can create quiz sessions" ON public.quiz_sessions;
DROP POLICY IF EXISTS "Teachers can update their quiz sessions" ON public.quiz_sessions;
DROP POLICY IF EXISTS "Teachers can delete their quiz sessions" ON public.quiz_sessions;

-- Recreate with explicit teacher_id filtering
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

-- Ensure groups policies are correct
DROP POLICY IF EXISTS "Teachers can view their own groups" ON public.groups;
DROP POLICY IF EXISTS "Teachers can create groups" ON public.groups;
DROP POLICY IF EXISTS "Teachers can update their own groups" ON public.groups;
DROP POLICY IF EXISTS "Teachers can delete their own groups" ON public.groups;

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

-- Ensure quiz_attempts policies only show attempts for teacher's quizzes
DROP POLICY IF EXISTS "Teachers can view attempts for their quizzes" ON public.quiz_attempts;

CREATE POLICY "Teachers can view attempts for their quizzes" 
  ON public.quiz_attempts FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.quiz_sessions 
    WHERE quiz_sessions.id = quiz_attempts.quiz_session_id 
    AND quiz_sessions.teacher_id = auth.uid()
  ));


