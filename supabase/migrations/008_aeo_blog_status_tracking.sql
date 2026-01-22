-- Add AEO Blog Status Tracking Fields
-- This migration adds fields needed for real-time progress tracking

-- Add new status tracking fields to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS current_section TEXT,
ADD COLUMN IF NOT EXISTS progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
ADD COLUMN IF NOT EXISTS steps JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Update the project_status enum to include more specific statuses
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'processing';
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'pending';

-- Create index for better real-time query performance
CREATE INDEX IF NOT EXISTS idx_projects_status_tracking ON projects(id, status, updated_at);

-- Create a function to update project progress
CREATE OR REPLACE FUNCTION update_project_progress(
  p_project_id UUID,
  p_status project_status DEFAULT NULL,
  p_current_section TEXT DEFAULT NULL,
  p_progress_percentage INTEGER DEFAULT NULL,
  p_steps JSONB DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE projects 
  SET 
    status = COALESCE(p_status, status),
    current_section = COALESCE(p_current_section, current_section),
    progress_percentage = COALESCE(p_progress_percentage, progress_percentage),
    steps = COALESCE(p_steps, steps),
    error_message = COALESCE(p_error_message, error_message),
    updated_at = NOW()
  WHERE id = p_project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to add/update a specific step
CREATE OR REPLACE FUNCTION update_project_step(
  p_project_id UUID,
  p_step_id TEXT,
  p_step_label TEXT,
  p_step_state TEXT,
  p_step_details TEXT DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  current_steps JSONB;
  updated_steps JSONB;
  step_exists BOOLEAN := FALSE;
  i INTEGER;
BEGIN
  -- Get current steps
  SELECT steps INTO current_steps FROM projects WHERE id = p_project_id;
  
  -- Initialize if null
  IF current_steps IS NULL THEN
    current_steps := '[]'::jsonb;
  END IF;
  
  -- Check if step exists and update it
  updated_steps := '[]'::jsonb;
  
  FOR i IN 0..jsonb_array_length(current_steps) - 1 LOOP
    IF (current_steps->i->>'id') = p_step_id THEN
      -- Update existing step
      updated_steps := updated_steps || jsonb_build_object(
        'id', p_step_id,
        'label', p_step_label,
        'state', p_step_state,
        'timestamp', to_char(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'details', p_step_details
      );
      step_exists := TRUE;
    ELSE
      -- Keep existing step
      updated_steps := updated_steps || (current_steps->i);
    END IF;
  END LOOP;
  
  -- Add new step if it doesn't exist
  IF NOT step_exists THEN
    updated_steps := updated_steps || jsonb_build_object(
      'id', p_step_id,
      'label', p_step_label,
      'state', p_step_state,
      'timestamp', to_char(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'details', p_step_details
    );
  END IF;
  
  -- Update the project
  UPDATE projects 
  SET 
    steps = updated_steps,
    updated_at = NOW()
  WHERE id = p_project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION update_project_progress(UUID, project_status, TEXT, INTEGER, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_project_step(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Create RLS policies for the new fields
-- (The existing RLS policies on projects table will cover these new fields)

-- Add some sample data for testing (optional)
-- This can be removed in production
INSERT INTO projects (
  id,
  user_id, 
  topic, 
  status, 
  competitor_urls, 
  tone, 
  format,
  steps,
  progress_percentage
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001', -- Replace with actual user ID for testing
  'Test AEO Blog Generation',
  'pending',
  ARRAY['https://example.com'],
  'professional',
  'how-to',
  '[
    {"id": "layout", "label": "Generating blog layout", "state": "pending"},
    {"id": "section-1", "label": "Writing introduction", "state": "pending"},
    {"id": "section-2", "label": "Writing main content", "state": "pending"},
    {"id": "section-3", "label": "Writing conclusion", "state": "pending"},
    {"id": "finalize", "label": "Final SEO optimization", "state": "pending"}
  ]'::jsonb,
  0
) ON CONFLICT (id) DO NOTHING;