CREATE TABLE public.user_rate_limit_buckets (
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  action_key text NOT NULL CHECK (action_key IN ('order_create', 'payment_create', 'payment_check', 'refund_create')),
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  PRIMARY KEY (user_id, action_key, window_start)
);
ALTER TABLE public.user_rate_limit_buckets ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.check_user_rate_limit(_action_key text, _limit integer, _window_seconds integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_window_start timestamptz;
  v_count integer;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Sign in is required.' USING ERRCODE = '42501'; END IF;
  IF _action_key NOT IN ('order_create', 'payment_create', 'payment_check', 'refund_create')
    OR _limit < 1 OR _limit > 100 OR _window_seconds < 60 OR _window_seconds > 86400 THEN
    RAISE EXCEPTION 'Invalid rate limit policy.' USING ERRCODE = '22023';
  END IF;
  v_window_start := to_timestamp(floor(extract(epoch FROM now()) / _window_seconds) * _window_seconds);
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || _action_key, 0));
  INSERT INTO public.user_rate_limit_buckets (user_id, action_key, window_start, request_count)
  VALUES (v_user_id, _action_key, v_window_start, 1)
  ON CONFLICT (user_id, action_key, window_start)
  DO UPDATE SET request_count = public.user_rate_limit_buckets.request_count + 1
  RETURNING request_count INTO v_count;
  RETURN v_count <= _limit;
END;
$function$;

REVOKE ALL ON FUNCTION public.check_user_rate_limit(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_user_rate_limit(text, integer, integer) TO authenticated;

CREATE FUNCTION public.enforce_order_create_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NOT public.check_user_rate_limit('order_create', 5, 3600) THEN
    RAISE EXCEPTION 'Order limit reached. Please try again later.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER orders_rate_limit_before_insert
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_order_create_limit();

CREATE FUNCTION public.enforce_payment_create_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.provider = 'bakong' AND NOT public.check_user_rate_limit('payment_create', 10, 3600) THEN
    RAISE EXCEPTION 'Payment request limit reached. Please try again later.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER payments_rate_limit_before_insert
  BEFORE INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_payment_create_limit();

CREATE FUNCTION public.expire_user_rate_limits()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE v_count integer;
BEGIN
  IF (SELECT auth.role()) <> 'service_role' THEN
    RAISE EXCEPTION 'Rate limit cleanup requires a trusted server.' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.user_rate_limit_buckets WHERE window_start < now() - interval '2 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_order_create_limit() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_payment_create_limit() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_user_rate_limits() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_user_rate_limits() TO service_role;

CREATE TABLE public.admin_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_table text NOT NULL,
  entity_id uuid NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_audit_events_time_idx ON public.admin_audit_events (created_at DESC);
CREATE INDEX admin_audit_events_entity_idx ON public.admin_audit_events (entity_table, entity_id, created_at DESC);
ALTER TABLE public.admin_audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_audit_events_read_admin ON public.admin_audit_events FOR SELECT TO authenticated
  USING (
    (SELECT public.has_role((SELECT auth.uid()), 'owner'))
    OR (SELECT public.has_role((SELECT auth.uid()), 'administrator'))
  );
GRANT SELECT ON public.admin_audit_events TO authenticated;

CREATE FUNCTION public.audit_catalog_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_row jsonb;
  v_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_row := to_jsonb(OLD);
    v_id := OLD.id;
  ELSE
    v_row := to_jsonb(NEW);
    v_id := NEW.id;
  END IF;
  INSERT INTO public.admin_audit_events (actor_id, action, entity_table, entity_id, details)
  VALUES (
    (SELECT auth.uid()), lower(TG_OP), TG_TABLE_NAME, v_id,
    jsonb_build_object('record', v_row)
  );
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER games_audit_change AFTER INSERT OR UPDATE OR DELETE ON public.games
  FOR EACH ROW EXECUTE FUNCTION public.audit_catalog_change();
CREATE TRIGGER game_fields_audit_change AFTER INSERT OR UPDATE OR DELETE ON public.game_fields
  FOR EACH ROW EXECUTE FUNCTION public.audit_catalog_change();
CREATE TRIGGER game_packages_audit_change AFTER INSERT OR UPDATE OR DELETE ON public.game_packages
  FOR EACH ROW EXECUTE FUNCTION public.audit_catalog_change();
CREATE TRIGGER suppliers_audit_change AFTER INSERT OR UPDATE OR DELETE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.audit_catalog_change();
CREATE TRIGGER package_supplier_mappings_audit_change AFTER INSERT OR UPDATE OR DELETE ON public.package_supplier_mappings
  FOR EACH ROW EXECUTE FUNCTION public.audit_catalog_change();

REVOKE ALL ON FUNCTION public.audit_catalog_change() FROM PUBLIC;
