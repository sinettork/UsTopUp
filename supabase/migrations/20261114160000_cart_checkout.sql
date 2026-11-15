CREATE FUNCTION public.create_order_from_cart(_items jsonb, _idempotency_key uuid)
RETURNS TABLE (id uuid, order_number text, total_minor bigint, currency char(3))
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_customer_id uuid := (SELECT auth.uid());
  v_entry jsonb;
  v_inputs jsonb;
  v_package_id uuid;
  v_package public.game_packages%ROWTYPE;
  v_game public.games%ROWTYPE;
  v_field public.game_fields%ROWTYPE;
  v_input text;
  v_currency char(3);
  v_total bigint := 0;
  v_order_id uuid;
  v_order_number text;
  v_order_item_id uuid;
  v_expected_price bigint;
BEGIN
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Sign in before placing an order.' USING ERRCODE = '42501';
  END IF;
  IF _idempotency_key IS NULL THEN
    RAISE EXCEPTION 'Order request key is required.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(_items) <> 'array' THEN
    RAISE EXCEPTION 'Cart items are invalid.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(_items) < 1 OR jsonb_array_length(_items) > 20 THEN
    RAISE EXCEPTION 'The cart must contain between 1 and 20 items.' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_customer_id::text || _idempotency_key::text, 0));
  RETURN QUERY
    SELECT existing_order.id, existing_order.order_number,
      existing_order.total_minor, existing_order.currency
    FROM public.orders AS existing_order
    WHERE existing_order.customer_id = v_customer_id
      AND existing_order.idempotency_key = _idempotency_key;
  IF FOUND THEN RETURN; END IF;

  FOR v_entry IN SELECT entry.value FROM jsonb_array_elements(_items) AS entry(value)
  LOOP
    IF jsonb_typeof(v_entry) <> 'object'
      OR COALESCE(jsonb_typeof(v_entry -> 'inputs'), '') <> 'object' THEN
      RAISE EXCEPTION 'Cart item information is invalid.' USING ERRCODE = '22023';
    END IF;
    BEGIN
      v_package_id := (v_entry ->> 'package_id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'A cart item is invalid. Remove it and try again.' USING ERRCODE = '22023';
    END;
    v_inputs := v_entry -> 'inputs';
    IF EXISTS (
      SELECT 1 FROM jsonb_each(v_inputs) AS supplied(key, value)
      WHERE jsonb_typeof(supplied.value) <> 'string'
    ) THEN
      RAISE EXCEPTION 'Account information must be text.' USING ERRCODE = '22023';
    END IF;

    SELECT package.* INTO v_package
    FROM public.game_packages AS package
    WHERE package.id = v_package_id AND package.is_active
    FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'A selected package is no longer available. Review your cart.' USING ERRCODE = '22023';
    END IF;

    SELECT game.* INTO v_game
    FROM public.games AS game
    WHERE game.id = v_package.game_id AND game.is_active
    FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'A selected game is no longer available. Review your cart.' USING ERRCODE = '22023';
    END IF;

    BEGIN
      v_expected_price := (v_entry ->> 'expected_price_minor')::bigint;
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'A cart price is invalid. Review your cart.' USING ERRCODE = '22023';
    END;
    IF v_expected_price IS NULL
      OR v_expected_price <> v_package.price_minor
      OR upper(COALESCE(v_entry ->> 'expected_currency', '')) <> upper(btrim(v_package.currency::text)) THEN
      RAISE EXCEPTION 'A package price has changed. Review your cart before placing the order.' USING ERRCODE = '22023';
    END IF;

    IF v_currency IS NULL THEN
      v_currency := v_package.currency;
    ELSIF v_currency <> v_package.currency THEN
      RAISE EXCEPTION 'Items in an order must use the same currency.' USING ERRCODE = '22023';
    END IF;

    FOR v_field IN
      SELECT field.* FROM public.game_fields AS field
      WHERE field.game_id = v_game.id AND field.is_active
    LOOP
      v_input := NULLIF(btrim(v_inputs ->> v_field.field_key), '');
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

    IF EXISTS (
      SELECT 1 FROM jsonb_object_keys(v_inputs) AS supplied(key)
      WHERE NOT EXISTS (
        SELECT 1 FROM public.game_fields AS field
        WHERE field.game_id = v_game.id AND field.is_active
          AND field.field_key = supplied.key
      )
    ) THEN
      RAISE EXCEPTION 'A cart item contains unexpected account information.' USING ERRCODE = '22023';
    END IF;

    v_total := v_total + v_package.price_minor;
  END LOOP;

  v_order_number := 'UT-' || to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  INSERT INTO public.orders (order_number, customer_id, idempotency_key, total_minor, currency)
  VALUES (v_order_number, v_customer_id, _idempotency_key, v_total, v_currency)
  RETURNING orders.id INTO v_order_id;

  FOR v_entry IN SELECT entry.value FROM jsonb_array_elements(_items) AS entry(value)
  LOOP
    v_package_id := (v_entry ->> 'package_id')::uuid;
    v_inputs := v_entry -> 'inputs';
    SELECT package.* INTO v_package FROM public.game_packages AS package WHERE package.id = v_package_id;
    SELECT game.* INTO v_game FROM public.games AS game WHERE game.id = v_package.game_id;

    INSERT INTO public.order_items (
      order_id, product_id, package_id, product_title, package_code,
      package_label, unit_price_minor, currency
    ) VALUES (
      v_order_id, v_game.id, v_package.id, v_game.title, v_package.package_code,
      v_package.amount_label, v_package.price_minor, v_package.currency
    ) RETURNING order_items.id INTO v_order_item_id;

    INSERT INTO public.order_item_inputs (order_item_id, field_key, field_label, value)
    SELECT v_order_item_id, field.field_key, field.label, btrim(v_inputs ->> field.field_key)
    FROM public.game_fields AS field
    WHERE field.game_id = v_game.id
      AND field.is_active
      AND NULLIF(btrim(v_inputs ->> field.field_key), '') IS NOT NULL;
  END LOOP;

  RETURN QUERY SELECT v_order_id, v_order_number, v_total, v_currency;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_order_from_cart(jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order_from_cart(jsonb, uuid) TO authenticated;
