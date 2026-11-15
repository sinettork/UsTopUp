CREATE OR REPLACE FUNCTION public.begin_payment(_order_number text, _provider public.payment_provider)
RETURNS TABLE (id uuid, provider_reference text, amount_minor bigint, currency char(3), expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_customer_id uuid := (SELECT auth.uid());
  v_order public.orders%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_reference text;
BEGIN
  IF v_customer_id IS NULL THEN RAISE EXCEPTION 'Sign in before starting payment.' USING ERRCODE = '42501'; END IF;
  SELECT app_order.* INTO v_order FROM public.orders AS app_order
  WHERE app_order.order_number = _order_number AND app_order.customer_id = v_customer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found.' USING ERRCODE = 'P0002'; END IF;
  IF v_order.status <> 'pending_payment' THEN RAISE EXCEPTION 'This order is not awaiting payment.' USING ERRCODE = '22023'; END IF;
  SELECT payment.* INTO v_payment FROM public.payments AS payment
  WHERE payment.order_id = v_order.id AND payment.status = 'pending' FOR UPDATE;
  IF FOUND THEN
    IF v_payment.provider <> _provider THEN RAISE EXCEPTION 'A payment attempt is already pending for this order.' USING ERRCODE = '22023'; END IF;
    RETURN QUERY SELECT v_payment.id, v_payment.provider_reference, v_payment.amount_minor, v_payment.currency, v_payment.expires_at;
    RETURN;
  END IF;
  v_reference := CASE WHEN _provider = 'aba_payway'
    THEN 'U' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 19))
    ELSE 'UTP-' || to_char(now() AT TIME ZONE 'UTC', 'YYMMDDHH24MISS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)) END;
  INSERT INTO public.payments (order_id, provider, provider_reference, amount_minor, currency, expires_at)
  VALUES (v_order.id, _provider, v_reference, v_order.total_minor, v_order.currency,
    CASE WHEN _provider = 'aba_payway' THEN now() + interval '15 minutes' ELSE NULL END)
  RETURNING payments.* INTO v_payment;
  INSERT INTO public.payment_events (payment_id, event_type, changed_by)
  VALUES (v_payment.id, 'payment_attempt_created', v_customer_id);
  RETURN QUERY SELECT v_payment.id, v_payment.provider_reference, v_payment.amount_minor, v_payment.currency, v_payment.expires_at;
END;
$function$;

CREATE FUNCTION public.verify_payway_payment(
  _payment_id uuid,
  _transaction_id text,
  _verified_amount_minor bigint,
  _verified_currency text,
  _provider_details jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_payment public.payments%ROWTYPE;
BEGIN
  IF (SELECT auth.role()) <> 'service_role' THEN
    RAISE EXCEPTION 'Payment verification requires a trusted server.' USING ERRCODE = '42501';
  END IF;
  SELECT payment.* INTO v_payment FROM public.payments AS payment WHERE payment.id = _payment_id FOR UPDATE;
  IF NOT FOUND OR v_payment.provider <> 'aba_payway' THEN RAISE EXCEPTION 'PayWay payment not found.' USING ERRCODE = 'P0002'; END IF;
  IF v_payment.status = 'paid' THEN
    IF v_payment.provider_transaction_id = _transaction_id THEN RETURN true; END IF;
    RAISE EXCEPTION 'Payment was already completed with a different transaction.' USING ERRCODE = '22023';
  END IF;
  IF v_payment.status <> 'pending' OR (v_payment.expires_at IS NOT NULL AND v_payment.expires_at <= now()) THEN
    RAISE EXCEPTION 'This payment attempt is no longer pending.' USING ERRCODE = '22023';
  END IF;
  IF v_payment.provider_transaction_id IS DISTINCT FROM _transaction_id
    OR v_payment.amount_minor <> _verified_amount_minor
    OR upper(v_payment.currency::text) <> upper(_verified_currency) THEN
    RAISE EXCEPTION 'Verified PayWay transaction, amount or currency does not match the order.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.payments SET status = 'paid', paid_at = now() WHERE id = v_payment.id;
  UPDATE public.orders SET status = 'processing' WHERE id = v_payment.order_id AND status = 'pending_payment';
  INSERT INTO public.payment_events (payment_id, event_type, provider_event_id, details, verified_at)
  VALUES (v_payment.id, 'payway_payment_verified', _transaction_id, COALESCE(_provider_details, '{}'::jsonb), now())
  ON CONFLICT (event_type, provider_event_id) WHERE provider_event_id IS NOT NULL DO NOTHING;
  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.verify_payway_payment(uuid, text, bigint, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_payway_payment(uuid, text, bigint, text, jsonb) TO service_role;
