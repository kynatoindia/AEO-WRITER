-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create user profile
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update user token usage
CREATE OR REPLACE FUNCTION public.update_user_token_usage(
  user_uuid UUID,
  tokens_consumed INTEGER
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE user_profiles 
  SET tokens_used = tokens_used + tokens_consumed,
      updated_at = NOW()
  WHERE id = user_uuid;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can create new project
CREATE OR REPLACE FUNCTION public.can_create_project(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  current_projects INTEGER;
  project_limit INTEGER;
BEGIN
  SELECT projects_used, projects_limit 
  INTO current_projects, project_limit
  FROM user_profiles 
  WHERE id = user_uuid;
  
  RETURN current_projects < project_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment user project count
CREATE OR REPLACE FUNCTION public.increment_user_projects(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE user_profiles 
  SET projects_used = projects_used + 1,
      updated_at = NOW()
  WHERE id = user_uuid;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get project with sections
CREATE OR REPLACE FUNCTION public.get_project_with_sections(project_uuid UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'project', row_to_json(p.*),
    'sections', COALESCE(
      (SELECT json_agg(row_to_json(cs.*) ORDER BY cs.section_order)
       FROM content_sections cs 
       WHERE cs.project_id = p.id), 
      '[]'::json
    )
  )
  INTO result
  FROM projects p
  WHERE p.id = project_uuid
  AND p.user_id = auth.uid();
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate project cost
CREATE OR REPLACE FUNCTION public.calculate_project_cost(
  tokens_research INTEGER DEFAULT 0,
  tokens_planning INTEGER DEFAULT 0,
  tokens_writing INTEGER DEFAULT 0
)
RETURNS DECIMAL AS $$
DECLARE
  gpt4_input_cost DECIMAL := 0.00003;  -- $0.03 per 1K tokens
  gpt4_output_cost DECIMAL := 0.00006; -- $0.06 per 1K tokens
  gpt4_mini_input_cost DECIMAL := 0.00000015; -- $0.00015 per 1K tokens
  gpt4_mini_output_cost DECIMAL := 0.0000006;  -- $0.0006 per 1K tokens
  total_cost DECIMAL := 0;
BEGIN
  -- Research phase (GPT-4)
  total_cost := total_cost + (tokens_research * gpt4_input_cost);
  
  -- Planning phase (GPT-4)
  total_cost := total_cost + (tokens_planning * gpt4_input_cost);
  
  -- Writing phase (GPT-4-mini)
  total_cost := total_cost + (tokens_writing * gpt4_mini_input_cost);
  
  RETURN total_cost;
END;
$$ LANGUAGE plpgsql;

-- Function to log usage analytics
CREATE OR REPLACE FUNCTION public.log_usage(
  user_uuid UUID,
  project_uuid UUID,
  operation TEXT,
  tokens INTEGER,
  cost DECIMAL,
  provider TEXT,
  model TEXT,
  metadata_json JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  analytics_id UUID;
BEGIN
  INSERT INTO usage_analytics (
    user_id, project_id, operation_type, tokens_used, 
    cost_usd, api_provider, model_used, metadata
  )
  VALUES (
    user_uuid, project_uuid, operation, tokens, 
    cost, provider, model, metadata_json
  )
  RETURNING id INTO analytics_id;
  
  -- Update user token usage
  PERFORM update_user_token_usage(user_uuid, tokens);
  
  RETURN analytics_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;