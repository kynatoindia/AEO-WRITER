-- Add status tracking columns to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS status_message TEXT,
ADD COLUMN IF NOT EXISTS progress INTEGER CHECK (progress >= 0 AND progress <= 100),
ADD COLUMN IF NOT EXISTS current_step TEXT,
ADD COLUMN IF NOT EXISTS estimated_completion_time TIMESTAMPTZ;

-- Create project_status_updates table for detailed status history
CREATE TABLE IF NOT EXISTS project_status_updates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  message TEXT NOT NULL,
  progress INTEGER CHECK (progress >= 0 AND progress <= 100),
  current_step TEXT,
  estimated_time_remaining INTEGER, -- seconds
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_project_status_updates_project_id ON project_status_updates(project_id);
CREATE INDEX IF NOT EXISTS idx_project_status_updates_created_at ON project_status_updates(created_at DESC);

-- Enable RLS on the new table
ALTER TABLE project_status_updates ENABLE ROW LEVEL SECURITY;

-- RLS policy for project_status_updates
CREATE POLICY "Users can view their own project status updates" ON project_status_updates
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- Function to get latest status for a project
CREATE OR REPLACE FUNCTION get_project_latest_status(project_uuid UUID)
RETURNS TABLE (
  status TEXT,
  message TEXT,
  progress INTEGER,
  current_step TEXT,
  updated_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.status,
    p.status_message,
    p.progress,
    p.current_step,
    p.updated_at
  FROM projects p
  WHERE p.id = project_uuid;
END;
$$;

-- Function to get status history for a project
CREATE OR REPLACE FUNCTION get_project_status_history(project_uuid UUID, limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  status TEXT,
  message TEXT,
  progress INTEGER,
  current_step TEXT,
  estimated_time_remaining INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    psu.status,
    psu.message,
    psu.progress,
    psu.current_step,
    psu.estimated_time_remaining,
    psu.metadata,
    psu.created_at
  FROM project_status_updates psu
  WHERE psu.project_id = project_uuid
  ORDER BY psu.created_at DESC
  LIMIT limit_count;
END;
$$;

-- Update existing projects to have initial status
UPDATE projects 
SET 
  status_message = CASE 
    WHEN status = 'completed' THEN 'Your content is ready!'
    WHEN status = 'error' THEN 'An error occurred during processing'
    WHEN status = 'researching' THEN 'AI is analyzing competitor data...'
    WHEN status = 'generating_content' THEN 'Writing your content sections...'
    ELSE 'Processing your request...'
  END,
  progress = CASE 
    WHEN status = 'completed' THEN 100
    WHEN status = 'error' THEN 0
    WHEN status = 'researching' THEN 20
    WHEN status = 'generating_content' THEN 60
    ELSE 10
  END
WHERE status_message IS NULL;