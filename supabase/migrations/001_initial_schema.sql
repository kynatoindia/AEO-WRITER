-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE project_status AS ENUM ('draft', 'researching', 'planning', 'writing', 'completed', 'error');
CREATE TYPE content_tone AS ENUM ('professional', 'witty', 'data-driven');
CREATE TYPE content_format AS ENUM ('how-to', 'listicle', 'case-study');
CREATE TYPE section_status AS ENUM ('pending', 'writing', 'completed');

-- Projects table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  topic TEXT NOT NULL CHECK (length(topic) >= 3 AND length(topic) <= 200),
  status project_status NOT NULL DEFAULT 'draft',
  competitor_urls TEXT[] NOT NULL DEFAULT '{}' CHECK (array_length(competitor_urls, 1) BETWEEN 1 AND 5),
  tone content_tone NOT NULL,
  format content_format NOT NULL,
  brand_document_path TEXT,
  openai_thread_id TEXT,
  blueprint JSONB,
  generated_content TEXT,
  seo_metadata JSONB,
  token_usage JSONB,
  cost_breakdown JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Content sections table
CREATE TABLE content_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  section_order INTEGER NOT NULL CHECK (section_order > 0),
  heading TEXT NOT NULL CHECK (length(heading) > 0),
  goal TEXT,
  sub_sections JSONB DEFAULT '[]'::jsonb,
  content_elements TEXT[] DEFAULT '{}',
  data_sources TEXT[] DEFAULT '{}',
  generated_content TEXT,
  status section_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(project_id, section_order)
);

-- Usage analytics table
CREATE TABLE usage_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  operation_type TEXT NOT NULL,
  tokens_used INTEGER CHECK (tokens_used >= 0),
  cost_usd DECIMAL(10,6) CHECK (cost_usd >= 0),
  api_provider TEXT NOT NULL,
  model_used TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- User profiles table (extends auth.users)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  subscription_plan TEXT NOT NULL DEFAULT 'free' CHECK (subscription_plan IN ('free', 'pro', 'enterprise')),
  tokens_used INTEGER NOT NULL DEFAULT 0 CHECK (tokens_used >= 0),
  tokens_limit INTEGER NOT NULL DEFAULT 10000 CHECK (tokens_limit > 0),
  projects_used INTEGER NOT NULL DEFAULT 0 CHECK (projects_used >= 0),
  projects_limit INTEGER NOT NULL DEFAULT 3 CHECK (projects_limit > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes for better performance
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_created_at ON projects(created_at DESC);
CREATE INDEX idx_content_sections_project_id ON content_sections(project_id);
CREATE INDEX idx_content_sections_order ON content_sections(project_id, section_order);
CREATE INDEX idx_usage_analytics_user_id ON usage_analytics(user_id);
CREATE INDEX idx_usage_analytics_project_id ON usage_analytics(project_id);
CREATE INDEX idx_usage_analytics_created_at ON usage_analytics(created_at DESC);
CREATE INDEX idx_user_profiles_email ON user_profiles(email);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_projects_updated_at 
  BEFORE UPDATE ON projects 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at 
  BEFORE UPDATE ON user_profiles 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();