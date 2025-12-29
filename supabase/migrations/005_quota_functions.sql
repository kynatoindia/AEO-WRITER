-- Create functions for atomic quota updates

-- Function to increment user tokens
CREATE OR REPLACE FUNCTION increment_tokens(user_id UUID, increment INTEGER)
RETURNS INTEGER AS $$
DECLARE
  new_value INTEGER;
BEGIN
  UPDATE user_profiles 
  SET tokens_used = tokens_used + increment,
      updated_at = NOW()
  WHERE id = user_id
  RETURNING tokens_used INTO new_value;
  
  IF new_value IS NULL THEN
    RAISE EXCEPTION 'User profile not found for user_id: %', user_id;
  END IF;
  
  RETURN new_value;
END;
$$ LANGUAGE plpgsql;

-- Function to increment user projects
CREATE OR REPLACE FUNCTION increment_projects(user_id UUID, increment INTEGER)
RETURNS INTEGER AS $$
DECLARE
  new_value INTEGER;
BEGIN
  UPDATE user_profiles 
  SET projects_used = projects_used + increment,
      updated_at = NOW()
  WHERE id = user_id
  RETURNING projects_used INTO new_value;
  
  IF new_value IS NULL THEN
    RAISE EXCEPTION 'User profile not found for user_id: %', user_id;
  END IF;
  
  RETURN new_value;
END;
$$ LANGUAGE plpgsql;

-- Function to reset monthly quotas (to be called by a cron job)
CREATE OR REPLACE FUNCTION reset_monthly_quotas()
RETURNS INTEGER AS $$
DECLARE
  reset_count INTEGER;
BEGIN
  UPDATE user_profiles 
  SET tokens_used = 0,
      updated_at = NOW()
  WHERE tokens_used > 0;
  
  GET DIAGNOSTICS reset_count = ROW_COUNT;
  
  RETURN reset_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get user quota status
CREATE OR REPLACE FUNCTION get_user_quota_status(user_id UUID)
RETURNS TABLE (
  plan TEXT,
  tokens_used INTEGER,
  tokens_limit INTEGER,
  projects_used INTEGER,
  projects_limit INTEGER,
  cost_used_usd DECIMAL(10,6)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    up.subscription_plan,
    up.tokens_used,
    up.tokens_limit,
    up.projects_used,
    up.projects_limit,
    COALESCE(
      (SELECT SUM(ua.cost_usd) 
       FROM usage_analytics ua 
       WHERE ua.user_id = up.id 
       AND ua.created_at >= date_trunc('month', CURRENT_DATE)
      ), 0::DECIMAL(10,6)
    ) as cost_used_usd
  FROM user_profiles up
  WHERE up.id = user_id;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for better performance on quota queries
CREATE INDEX IF NOT EXISTS idx_usage_analytics_user_month 
ON usage_analytics(user_id, created_at) 
WHERE created_at >= date_trunc('month', CURRENT_DATE);

CREATE INDEX IF NOT EXISTS idx_user_profiles_subscription 
ON user_profiles(subscription_plan);

-- Add constraints to prevent negative values
ALTER TABLE user_profiles 
ADD CONSTRAINT check_tokens_used_non_negative 
CHECK (tokens_used >= 0);

ALTER TABLE user_profiles 
ADD CONSTRAINT check_projects_used_non_negative 
CHECK (projects_used >= 0);