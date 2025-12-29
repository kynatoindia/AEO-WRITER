-- Create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('brand-documents', 'brand-documents', false, 10485760, ARRAY['application/pdf']),
  ('exports', 'exports', false, 52428800, ARRAY['text/markdown', 'text/html', 'application/pdf']);

-- Storage policies for brand documents
CREATE POLICY "Users can upload their own brand documents" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'brand-documents' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own brand documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'brand-documents' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own brand documents" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'brand-documents' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own brand documents" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'brand-documents' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage policies for exports
CREATE POLICY "Users can upload their own exports" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'exports' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own exports" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'exports' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own exports" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'exports' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );