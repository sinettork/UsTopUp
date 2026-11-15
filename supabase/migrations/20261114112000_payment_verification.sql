CREATE FUNCTION public.verify_bakong_payment(
  _payment_id uuid,
  _transaction_hash text,
  _verified_amount_minor bigint,
  _verified_currency text,
  _verified_to_account text,
  _expected_to_account text,
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

  SELECT payment.* INTO v_payment
  FROM public.payments AS payment
  WHERE payment.id = _payment_id
  FOR UPDATE;
  IF NOT FOUND OR v_payment.provider <> 'bakong' THEN
    RAISE EXCEPTION 'Bakong payment not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_payment.status = 'paid' THEN
    IF v_payment.provider_transaction_id = _transaction_hash THEN RETURN true; END IF;
    RAISE EXCEPTION 'Payment was already completed with a different transaction.' USING ERRCODE = '22023';
  END IF;
  IF v_payment.status <> 'pending' OR (v_payment.expires_at IS NOT NULL AND v_payment.expires_at <= now()) THEN
    RAISE EXCEPTION 'This payment attempt is no longer pending.' USING ERRCODE = '22023';
  END IF;
  IF v_payment.qr_md5 IS NULL OR lower(v_payment.qr_md5) <> lower(_transaction_hash) THEN
    RAISE EXCEPTION 'Bakong transaction does not match the payment QR.' USING ERRCODE = '22023';
  END IF;
  IF v_payment.amount_minor <> _verified_amount_minor
    OR upper(v_payment.currency::text) <> upper(_verified_currency) THEN
    RAISE EXCEPTION 'Verified payment amount or currency does not match the order.' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(btrim(_expected_to_account), '') IS NULL
    OR lower(btrim(_verified_to_account)) <> lower(btrim(_expected_to_account)) THEN
    RAISE EXCEPTION 'Bakong payment was sent to an unexpected account.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.payments
  SET status = 'paid', provider_transaction_id = lower(_transaction_hash), paid_at = now()
  WHERE id = v_payment.id;
  UPDATE public.orders
  SET status = 'processing'
  WHERE id = v_payment.order_id AND status = 'pending_payment';
  INSERT INTO public.payment_events (
    payment_id, event_type, provider_event_id, details, verified_at
  ) VALUES (
    v_payment.id, 'bakong_payment_verified', lower(_transaction_hash),
    COALESCE(_provider_details, '{}'::jsonb), now()
  );
  RETURN true;
END;
$function$;

CREATE FUNCTION public.expire_pending_payments()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_count integer;
BEGIN
  IF (SELECT auth.role()) <> 'service_role' THEN
    RAISE EXCEPTION 'Payment expiry requires a trusted server.' USING ERRCODE = '42501';
  END IF;

  WITH expired AS (
    UPDATE public.payments
    SET status = 'expired'
    WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at <= now()
    RETURNING id
  )
  INSERT INTO public.payment_events (payment_id, event_type, verified_at)
  SELECT id, 'payment_attempt_expired', now() FROM expired;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.verify_bakong_payment(uuid, text, bigint, text, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_pending_payments() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_bakong_payment(uuid, text, bigint, text, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_pending_payments() TO service_role;
