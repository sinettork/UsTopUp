ALTER TABLE public.game_packages
  ADD COLUMN supplier_cost_minor bigint NOT NULL DEFAULT 0
    CHECK (supplier_cost_minor >= 0);

CREATE TABLE public.package_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL,
  retail_price_minor bigint NOT NULL CHECK (retail_price_minor >= 0),
  supplier_cost_minor bigint NOT NULL CHECK (supplier_cost_minor >= 0),
  currency char(3) NOT NULL,
  changed_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX package_price_history_package_time_idx
  ON public.package_price_history (package_id, recorded_at DESC);

ALTER TABLE public.package_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY package_price_history_read_admin
  ON public.package_price_history FOR SELECT TO authenticated
  USING (
    (SELECT public.has_role((SELECT auth.uid()), 'owner'))
    OR (SELECT public.has_role((SELECT auth.uid()), 'administrator'))
  );

CREATE FUNCTION public.record_package_price_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.package_price_history (
      package_id,
      retail_price_minor,
      supplier_cost_minor,
      currency,
      changed_by
    ) VALUES (
      NEW.id,
      NEW.price_minor,
      NEW.supplier_cost_minor,
      NEW.currency,
      (SELECT auth.uid())
    );
  ELSIF NEW.price_minor IS DISTINCT FROM OLD.price_minor
    OR NEW.supplier_cost_minor IS DISTINCT FROM OLD.supplier_cost_minor
    OR NEW.currency IS DISTINCT FROM OLD.currency THEN
    INSERT INTO public.package_price_history (
      package_id,
      retail_price_minor,
      supplier_cost_minor,
      currency,
      changed_by
    ) VALUES (
      NEW.id,
      NEW.price_minor,
      NEW.supplier_cost_minor,
      NEW.currency,
      (SELECT auth.uid())
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER game_packages_record_price_change
  AFTER INSERT OR UPDATE OF price_minor, supplier_cost_minor, currency
  ON public.game_packages
  FOR EACH ROW EXECUTE FUNCTION public.record_package_price_change();

REVOKE ALL ON FUNCTION public.record_package_price_change() FROM PUBLIC;
GRANT SELECT ON public.package_price_history TO authenticated;
