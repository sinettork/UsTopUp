CREATE TYPE public.fulfillment_status AS ENUM ('queued', 'processing', 'completed', 'failed', 'needs_review');

CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text NOT NULL,
  adapter_key text NOT NULL DEFAULT 'manual',
  contact_email text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.package_supplier_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL UNIQUE REFERENCES public.game_packages (id) ON DELETE RESTRICT,
  supplier_id uuid NOT NULL REFERENCES public.suppliers (id) ON DELETE RESTRICT,
  supplier_product_code text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supplier_id, supplier_product_code)
);

CREATE TABLE public.fulfillment_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id uuid NOT NULL UNIQUE REFERENCES public.order_items (id) ON DELETE RESTRICT,
  supplier_id uuid REFERENCES public.suppliers (id) ON DELETE RESTRICT,
  adapter_key text NOT NULL,
  supplier_product_code text,
  status public.fulfillment_status NOT NULL DEFAULT 'queued',
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at timestamptz,
  external_reference text,
  last_error text,
  staff_note text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.fulfillment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.fulfillment_jobs (id) ON DELETE RESTRICT,
  from_status public.fulfillment_status,
  to_status public.fulfillment_status NOT NULL,
  note text NOT NULL DEFAULT '',
  changed_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX suppliers_active_idx ON public.suppliers (is_active, name);
CREATE INDEX fulfillment_jobs_status_queue_idx ON public.fulfillment_jobs (status, next_attempt_at);
CREATE INDEX fulfillment_events_job_time_idx ON public.fulfillment_events (job_id, created_at DESC);

CREATE TRIGGER suppliers_set_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER package_supplier_mappings_set_updated_at
  BEFORE UPDATE ON public.package_supplier_mappings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER fulfillment_jobs_set_updated_at
  BEFORE UPDATE ON public.fulfillment_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_supplier_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fulfillment_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fulfillment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY suppliers_read_staff ON public.suppliers FOR SELECT TO authenticated USING ((SELECT public.is_staff()));
CREATE POLICY package_supplier_mappings_read_staff ON public.package_supplier_mappings FOR SELECT TO authenticated USING ((SELECT public.is_staff()));
CREATE POLICY suppliers_manage_admin ON public.suppliers FOR ALL TO authenticated
  USING (
    (SELECT public.has_role((SELECT auth.uid()), 'owner'))
    OR (SELECT public.has_role((SELECT auth.uid()), 'administrator'))
  )
  WITH CHECK (
    (SELECT public.has_role((SELECT auth.uid()), 'owner'))
    OR (SELECT public.has_role((SELECT auth.uid()), 'administrator'))
  );
CREATE POLICY package_supplier_mappings_manage_admin ON public.package_supplier_mappings FOR ALL TO authenticated
  USING (
    (SELECT public.has_role((SELECT auth.uid()), 'owner'))
    OR (SELECT public.has_role((SELECT auth.uid()), 'administrator'))
  )
  WITH CHECK (
    (SELECT public.has_role((SELECT auth.uid()), 'owner'))
    OR (SELECT public.has_role((SELECT auth.uid()), 'administrator'))
  );
CREATE POLICY fulfillment_jobs_read_own_or_staff
  ON public.fulfillment_jobs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.order_items AS item
      JOIN public.orders AS app_order ON app_order.id = item.order_id
      WHERE item.id = order_item_id
        AND (app_order.customer_id = (SELECT auth.uid()) OR (SELECT public.is_staff()))
    )
  );
CREATE POLICY fulfillment_events_read_own_or_staff
  ON public.fulfillment_events FOR SELECT TO authenticated
  USING (
    (SELECT public.is_staff())
    OR EXISTS (
      SELECT 1 FROM public.fulfillment_jobs AS job
      JOIN public.order_items AS item ON item.id = job.order_item_id
      JOIN public.orders AS app_order ON app_order.id = item.order_id
      WHERE job.id = fulfillment_events.job_id AND app_order.customer_id = (SELECT auth.uid())
    )
  );

GRANT SELECT ON public.suppliers, public.package_supplier_mappings,
  public.fulfillment_jobs, public.fulfillment_events TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.suppliers,
  public.package_supplier_mappings TO authenticated;

CREATE FUNCTION public.queue_order_fulfillment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_item record;
  v_method text;
  v_supplier_id uuid;
  v_supplier_code text;
  v_adapter_key text;
  v_status public.fulfillment_status;
  v_error text;
BEGIN
  IF NEW.status <> 'paid' OR OLD.status = 'paid' THEN RETURN NEW; END IF;

  FOR v_item IN
    SELECT item.id AS order_item_id, item.product_id, item.package_id
    FROM public.order_items AS item
    WHERE item.order_id = NEW.order_id
  LOOP
    SELECT game.fulfillment_method INTO v_method
    FROM public.games AS game WHERE game.id = v_item.product_id;
    v_supplier_id := NULL;
    v_supplier_code := NULL;
    v_adapter_key := 'manual';
    v_status := 'queued';
    v_error := NULL;

    IF v_method = 'automatic' THEN
      SELECT mapping.supplier_id, mapping.supplier_product_code, supplier.adapter_key
      INTO v_supplier_id, v_supplier_code, v_adapter_key
      FROM public.package_supplier_mappings AS mapping
      JOIN public.suppliers AS supplier ON supplier.id = mapping.supplier_id AND supplier.is_active
      WHERE mapping.package_id = v_item.package_id AND mapping.is_active;
      IF NOT FOUND THEN
        v_status := 'needs_review';
        v_error := 'Automatic fulfillment is selected, but no active supplier mapping is configured.';
      ELSIF v_adapter_key <> 'manual' THEN
        v_status := 'needs_review';
        v_error := 'This supplier adapter is not registered on the server.';
      END IF;
    END IF;

    INSERT INTO public.fulfillment_jobs (
      order_item_id, supplier_id, adapter_key, supplier_product_code, status, last_error
    ) VALUES (
      v_item.order_item_id, v_supplier_id, COALESCE(v_adapter_key, 'manual'),
      v_supplier_code, v_status, v_error
    );
    INSERT INTO public.fulfillment_events (job_id, to_status, note)
    SELECT job.id, v_status, COALESCE(v_error, 'Created after payment verification.')
    FROM public.fulfillment_jobs AS job
    WHERE job.order_item_id = v_item.order_item_id;
  END LOOP;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER payments_queue_fulfillment
  AFTER UPDATE OF status ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.queue_order_fulfillment();

REVOKE ALL ON FUNCTION public.queue_order_fulfillment() FROM PUBLIC;
