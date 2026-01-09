-- Create junction table for many-to-many relationship between quiz_sessions and groups
CREATE TABLE IF NOT EXISTS public.quiz_session_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_session_id UUID NOT NULL REFERENCES public.quiz_sessions(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(quiz_session_id, group_id)
);

-- Enable RLS on quiz_session_groups
ALTER TABLE public.quiz_session_groups ENABLE ROW LEVEL SECURITY;

-- RLS policies for quiz_session_groups
CREATE POLICY "Teachers can view quiz session groups for their quizzes"
  ON public.quiz_session_groups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quiz_sessions
      WHERE quiz_sessions.id = quiz_session_groups.quiz_session_id
      AND quiz_sessions.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can create quiz session groups for their quizzes"
  ON public.quiz_session_groups FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quiz_sessions
      WHERE quiz_sessions.id = quiz_session_groups.quiz_session_id
      AND quiz_sessions.teacher_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.groups
      WHERE groups.id = quiz_session_groups.group_id
      AND groups.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can delete quiz session groups for their quizzes"
  ON public.quiz_session_groups FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.quiz_sessions
      WHERE quiz_sessions.id = quiz_session_groups.quiz_session_id
      AND quiz_sessions.teacher_id = auth.uid()
    )
  );

-- Migrate existing data: create entries in quiz_session_groups for existing quiz_sessions
INSERT INTO public.quiz_session_groups (quiz_session_id, group_id)
SELECT id, group_id
FROM public.quiz_sessions
WHERE group_id IS NOT NULL
ON CONFLICT (quiz_session_id, group_id) DO NOTHING;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_quiz_session_groups_quiz_session_id ON public.quiz_session_groups(quiz_session_id);
CREATE INDEX IF NOT EXISTS idx_quiz_session_groups_group_id ON public.quiz_session_groups(group_id);

