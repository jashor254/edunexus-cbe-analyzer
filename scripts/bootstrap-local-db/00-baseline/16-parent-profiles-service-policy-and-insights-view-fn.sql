-- Two gaps discovered while replaying 20260804120100_security_sprint_phase2_3
-- and 20260804120200_security_sprint_phase5 during H1M-SNAPSHOT-2 Run #2:
-- neither has a tracked-migration origin, both live in production.

CREATE POLICY "Service role can do everything" ON public.parent_profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.increment_insights_view(article_slug text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE insights_articles
  SET view_count = view_count + 1
  WHERE slug = article_slug AND status = 'published';
END;
$function$;
