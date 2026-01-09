-- Add public read policy for quiz_session_groups (needed for students to check if their group is assigned)
-- This allows unauthenticated students to read quiz_session_groups to check if their group is assigned to a quiz

DROP POLICY IF EXISTS "Anyone can view quiz session groups" ON public.quiz_session_groups;

CREATE POLICY "Anyone can view quiz session groups"
  ON public.quiz_session_groups FOR SELECT
  USING (true);

