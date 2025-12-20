-- Add duration_minutes field to quiz_sessions table
ALTER TABLE public.quiz_sessions 
ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 30;

-- Add time_taken_seconds field to quiz_attempts for ranking
ALTER TABLE public.quiz_attempts 
ADD COLUMN IF NOT EXISTS time_taken_seconds INTEGER;

-- Add ranking field to quiz_attempts (1, 2, 3 for top three)
ALTER TABLE public.quiz_attempts 
ADD COLUMN IF NOT EXISTS ranking INTEGER;

-- Create index for better query performance on ranking
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_ranking 
ON public.quiz_attempts(quiz_session_id, ranking) 
WHERE ranking IS NOT NULL;

-- Function to calculate and update rankings for a quiz session
CREATE OR REPLACE FUNCTION calculate_quiz_rankings(quiz_session_uuid UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deadline_time TIMESTAMPTZ;
BEGIN
  -- Get the quiz deadline
  SELECT deadline INTO deadline_time
  FROM public.quiz_sessions
  WHERE id = quiz_session_uuid;
  
  -- Only calculate rankings if deadline has passed
  IF deadline_time IS NULL OR deadline_time > NOW() THEN
    RETURN;
  END IF;
  
  -- Reset all rankings for this quiz
  UPDATE public.quiz_attempts
  SET ranking = NULL
  WHERE quiz_session_id = quiz_session_uuid;
  
  -- Calculate time_taken_seconds for attempts that don't have it
  UPDATE public.quiz_attempts
  SET time_taken_seconds = EXTRACT(EPOCH FROM (completed_at - started_at))::INTEGER
  WHERE quiz_session_id = quiz_session_uuid
    AND completed_at IS NOT NULL
    AND time_taken_seconds IS NULL;
  
  -- Update rankings: Top 3 based on score (desc) then time_taken_seconds (asc - faster is better)
  WITH ranked_attempts AS (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        ORDER BY 
          score DESC NULLS LAST,
          time_taken_seconds ASC NULLS LAST,
          completed_at ASC
      ) as rank_position
    FROM public.quiz_attempts
    WHERE quiz_session_id = quiz_session_uuid
      AND completed_at IS NOT NULL
  )
  UPDATE public.quiz_attempts qa
  SET ranking = ra.rank_position
  FROM ranked_attempts ra
  WHERE qa.id = ra.id
    AND ra.rank_position <= 3;
END;
$$;

-- Trigger function to auto-calculate rankings when quiz deadline passes
-- Note: This would typically be called via a scheduled job or when viewing results
-- For now, we'll call it manually or via a function call

