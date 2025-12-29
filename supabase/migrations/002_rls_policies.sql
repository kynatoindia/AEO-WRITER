-- Enable Row Level Security on all tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Projects RLS Policies
-- Users can only see their own projects
CREATE POLICY "Users can view their own projects" ON projects
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own projects
CREATE POLICY "Users can create their own projects" ON projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own projects
CREATE POLICY "Users can update their own projects" ON projects
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own projects
CREATE POLICY "Users can delete their own projects" ON projects
  FOR DELETE USING (auth.uid() = user_id);

-- Content Sections RLS Policies
-- Users can only see sections from their own projects
CREATE POLICY "Users can view sections from their own projects" ON content_sections
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = content_sections.project_id 
      AND projects.user_id = auth.uid()
    )
  );

-- Users can insert sections to their own projects
CREATE POLICY "Users can create sections for their own projects" ON content_sections
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = content_sections.project_id 
      AND projects.user_id = auth.uid()
    )
  );

-- Users can update sections from their own projects
CREATE POLICY "Users can update sections from their own projects" ON content_sections
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = content_sections.project_id 
      AND projects.user_id = auth.uid()
    )
  );

-- Users can delete sections from their own projects
CREATE POLICY "Users can delete sections from their own projects" ON content_sections
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = content_sections.project_id 
      AND projects.user_id = auth.uid()
    )
  );

-- Usage Analytics RLS Policies
-- Users can only see their own usage analytics
CREATE POLICY "Users can view their own usage analytics" ON usage_analytics
  FOR SELECT USING (auth.uid() = user_id);

-- System can insert usage analytics (service role)
CREATE POLICY "Service role can insert usage analytics" ON usage_analytics
  FOR INSERT WITH CHECK (true);

-- Users can view analytics for their own projects
CREATE POLICY "Users can view analytics for their own projects" ON usage_analytics
  FOR SELECT USING (
    project_id IS NULL OR 
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = usage_analytics.project_id 
      AND projects.user_id = auth.uid()
    )
  );

-- User Profiles RLS Policies
-- Users can view their own profile
CREATE POLICY "Users can view their own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Users can insert their own profile (for registration)
CREATE POLICY "Users can create their own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Service role can manage all profiles (for admin operations)
CREATE POLICY "Service role can manage all profiles" ON user_profiles
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');