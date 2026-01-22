-- Add fact_vault column to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS fact_vault JSONB DEFAULT '[]'::jsonb;

-- Update the research_data type in database.types.ts (manual update required in code)
COMMENT ON COLUMN projects.fact_vault IS 'Store of atomic facts extracted during research phase';
