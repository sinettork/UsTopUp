CREATE TYPE public.order_status AS ENUM ('pending_payment', 'cancelled');

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  customer_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  idempotency_key uuid NOT NULL,
  status public.order_status NOT NULL DEFAULT 'pending_payment',
  total_minor bigint NOT NULL CHECK (total_minor >= 0),
  currency char(3) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.games (id) ON DELETE RESTRICT,
  package_id uuid NOT NULL REFERENCES public.game_packages (id) ON DELETE RESTRICT,
  product_title text NOT NULL,
  package_code text NOT NULL,
  package_label text NOT NULL,
  unit_price_minor bigint NOT NULL CHECK (unit_price_minor >= 0),
  currency char(3) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.order_item_inputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id uuid NOT NULL REFERENCES public.order_items (id) ON DELETE CASCADE,
  field_key text NOT NULL,
  field_label text NOT NULL,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_item_id, field_key)
);

CREATE INDEX orders_customer_time_idx ON public.orders (customer_id, created_at DESC);
CREATE UNIQUE INDEX orders_customer_idempotency_idx ON public.orders (customer_id, idempotency_key);
CREATE INDEX orders_status_time_idx ON public.orders (status, created_at DESC);
CREATE INDEX order_items_order_idx ON public.order_items (order_id);
CREATE INDEX order_item_inputs_item_idx ON public.order_item_inputs (order_item_id);

CREATE TRIGGER orders_set_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_item_inputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY orders_read_own_or_staff
  ON public.orders FOR SELECT TO authenticated
  USING (customer_id = (SELECT auth.uid()) OR (SELECT public.is_staff()));

CREATE POLICY order_items_read_own_or_staff
  ON public.order_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders AS app_order
      WHERE app_order.id = order_id
        AND (app_order.customer_id = (SELECT auth.uid()) OR (SELECT public.is_staff()))
    )
  );

CREATE POLICY order_item_inputs_read_own_or_staff
  ON public.order_item_inputs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.order_items AS item
      JOIN public.orders AS app_order ON app_order.id = item.order_id
      WHERE item.id = order_item_id
        AND (app_order.customer_id = (SELECT auth.uid()) OR (SELECT public.is_staff()))
    )
  );

GRANT SELECT ON public.orders, public.order_items, public.order_item_inputs TO authenticated;

CREATE FUNCTION public.create_order(_package_id uuid, _idempotency_key uuid, _inputs jsonb DEFAULT '{}'::jsonb)
RETURNS TABLE (id uuid, order_number text, total_minor bigint, currency char(3))
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_customer_id uuid := (SELECT auth.uid());
  v_package public.game_packages%ROWTYPE;
  v_game public.games%ROWTYPE;
  v_order_id uuid;
  v_order_number text;
  v_field public.game_fields%ROWTYPE;
  v_input text;
BEGIN
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Sign in before placing an order.' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(COALESCE(_inputs, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'Invalid product information.' USING ERRCODE = '22023';
  END IF;

  IF _idempotency_key IS NULL THEN
    RAISE EXCEPTION 'Order request key is required.' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_customer_id::text || _idempotency_key::text, 0));
  RETURN QUERY
    SELECT existing_order.id, existing_order.order_number,
      existing_order.total_minor, existing_order.currency
    FROM public.orders AS existing_order
    WHERE existing_order.customer_id = v_customer_id
      AND existing_order.idempotency_key = _idempotency_key;
  IF FOUND THEN RETURN; END IF;

  SELECT package.* INTO v_package
  FROM public.game_packages AS package
  WHERE package.id = _package_id AND package.is_active
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This plan is no longer available.' USING ERRCODE = '22023';
  END IF;

  SELECT game.* INTO v_game
  FROM public.games AS game
  WHERE game.id = v_package.game_id AND game.is_active
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This product is no longer available.' USING ERRCODE = '22023';
  END IF;

  FOR v_field IN
    SELECT field.* FROM public.game_fields AS field
    WHERE field.game_id = v_game.id AND field.is_active
  LOOP
    v_input := NULLIF(btrim(_inputs ->> v_field.field_key), '');
    IF v_field.is_required AND v_input IS NULL THEN
      RAISE EXCEPTION 'Complete the required field: %.', v_field.label USING ERRCODE = '22023';
    END IF;
    IF v_input IS NOT NULL AND length(v_input) > 500 THEN
      RAISE EXCEPTION 'The value for % is too long.', v_field.label USING ERRCODE = '22023';
    END IF;
    IF v_input IS NOT NULL AND v_field.validation_pattern IS NOT NULL THEN
      BEGIN
        IF v_input !~ v_field.validation_pattern THEN
          RAISE EXCEPTION 'Check the format for %.', v_field.label USING ERRCODE = '22023';
        END IF;
      EXCEPTION WHEN invalid_regular_expression THEN
        RAISE EXCEPTION 'The validation rule for % is invalid.', v_field.label USING ERRCODE = '22023';
      END;
    END IF;
  END LOOP;

  v_order_number := 'UT-' || to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  INSERT INTO public.orders (order_number, customer_id, idempotency_key, total_minor, currency)
  VALUES (v_order_number, v_customer_id, _idempotency_key, v_package.price_minor, v_package.currency)
  RETURNING orders.id INTO v_order_id;

  INSERT INTO public.order_items (
    order_id, product_id, package_id, product_title, package_code,
    package_label, unit_price_minor, currency
  ) VALUES (
    v_order_id, v_game.id, v_package.id, v_game.title,
    v_package.package_code, v_package.amount_label, v_package.price_minor,
    v_package.currency
  );

  INSERT INTO public.order_item_inputs (order_item_id, field_key, field_label, value)
  SELECT item.id, field.field_key, field.label, btrim(_inputs ->> field.field_key)
  FROM public.game_fields AS field
  JOIN public.order_items AS item ON item.order_id = v_order_id
  WHERE field.game_id = v_game.id
    AND field.is_active
    AND NULLIF(btrim(_inputs ->> field.field_key), '') IS NOT NULL;

  RETURN QUERY SELECT v_order_id, v_order_number, v_package.price_minor, v_package.currency;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_order(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order(uuid, uuid, jsonb) TO authenticated;
