-- db_security_hardening_phase2_is_admin_fix (prod 20260702141836)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT email FROM auth.users WHERE id = auth.uid()
  ) = 'kariukidennis092@gmail.com';
END;
$$;
