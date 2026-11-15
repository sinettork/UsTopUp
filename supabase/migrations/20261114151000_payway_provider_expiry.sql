-- PayWay controls the checkout transaction lifetime. A local 15-minute expiry
-- without a matching provider lifetime can leave a customer charged but unverified.
UPDATE public.payments
SET expires_at = NULL
WHERE provider = 'aba_payway' AND status = 'pending';

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
  VALUES (v_order.id, _provider, v_reference, v_order.total_minor, v_order.currency, NULL)
  RETURNING payments.* INTO v_payment;
  INSERT INTO public.payment_events (payment_id, event_type, changed_by)
  VALUES (v_payment.id, 'payment_attempt_created', v_customer_id);
  RETURN QUERY SELECT v_payment.id, v_payment.provider_reference, v_payment.amount_minor, v_payment.currency, v_payment.expires_at;
END;
$function$;
