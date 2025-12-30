-- Add security metadata field to projects table for enhanced file upload security
ALTER TABLE projects 
ADD COLUMN security_metadata JSONB DEFAULT NULL;

-- Add comment to document the field structure
COMMENT ON COLUMN projects.security_metadata IS 'Security metadata including virus scan results, file validation info, and upload security details';

-- Create index for security metadata queries
CREATE INDEX idx_projects_security_metadata ON projects USING GIN (security_metadata);

-- Example of security_metadata structure:
-- {
--   "virusScan": {
--     "scanId": "scan-123456789",
--     "timestamp": "2024-01-01T00:00:00Z",
--     "isClean": true,
--     "threats": []
--   },
--   "fileValidation": {
--     "originalName": "brand-guide.pdf",
--     "validatedType": "application/pdf",
--     "size": 1024000,
--     "contentValidated": true
--   },
--   "uploadSecurity": {
--     "pathTraversalCheck": true,
--     "maliciousContentCheck": true,
--     "fileTypeValidation": true
--   }
-- }