CREATE POLICY "Authenticated users can view community posts"
ON public.community_posts
FOR SELECT
TO authenticated
USING (true);