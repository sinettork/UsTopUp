CREATE TYPE public.payment_provider AS ENUM ('bakong', 'aba_payway');
CREATE TYPE public.payment_status AS ENUM ('pending', 'paid', 'failed', 'expired', 'refunded');

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE RESTRICT,
  provider public.payment_provider NOT NULL,
  provider_reference text NOT NULL UNIQUE,
  provider_transaction_id text,
  status public.payment_status NOT NULL DEFAULT 'pending',
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  currency char(3) NOT NULL,
  qr_payload text,
  qr_md5 text,
  checkout_url text,
  expires_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (qr_md5 IS NULL OR qr_md5 ~ '^[a-f0-9]{32}$')
);

CREATE UNIQUE INDEX payments_provider_transaction_idx
  ON public.payments (provider, provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;
CREATE UNIQUE INDEX payments_one_pending_per_order_idx
  ON public.payments (order_id)
  WHERE status = 'pending';
CREATE INDEX payments_status_expiry_idx ON public.payments (status, expires_at);

CREATE TABLE public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments (id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  provider_event_id text,
  payload_sha256 text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  verified_at timestamptz,
  changed_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (payload_sha256 IS NULL OR payload_sha256 ~ '^[a-f0-9]{64}$')
);

CREATE UNIQUE INDEX payment_events_provider_event_idx
  ON public.payment_events (event_type, provider_event_id)
  WHERE provider_event_id IS NOT NULL;
CREATE INDEX payment_events_payment_time_idx
  ON public.payment_events (payment_id, created_at DESC);

CREATE TRIGGER payments_set_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY payments_read_own_or_staff
  ON public.payments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders AS app_order
      WHERE app_order.id = order_id
        AND (app_order.customer_id = (SELECT auth.uid()) OR (SELECT public.is_staff()))
    )
  );

CREATE POLICY payment_events_read_own_or_admin
  ON public.payment_events FOR SELECT TO authenticated
  USING (
    (SELECT public.is_staff())
    OR EXISTS (
      SELECT 1 FROM public.payments AS payment
      JOIN public.orders AS app_order ON app_order.id = payment.order_id
      WHERE payment.id = payment_id AND app_order.customer_id = (SELECT auth.uid())
    )
  );

GRANT SELECT ON public.payments, public.payment_events TO authenticated;

CREATE FUNCTION public.begin_payment(_order_number text, _provider public.payment_provider)
RETURNS TABLE (id uuid, provider_reference text, amount_minor bigint, currency char(3), expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_customer_id uuid := (SELECT auth.uid());
  v_order public.orders%ROWTYPE;
  v_payment public.payments%ROWTYPE;
BEGIN
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Sign in before starting payment.' USING ERRCODE = '42501';
  END IF;
  SELECT app_order.* INTO v_order
  FROM public.orders AS app_order
  WHERE app_order.order_number = _order_number
    AND app_order.customer_id = v_customer_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_order.status <> 'pending_payment' THEN
    RAISE EXCEPTION 'This order is not awaiting payment.' USING ERRCODE = '22023';
  END IF;

  SELECT payment.* INTO v_payment
  FROM public.payments AS payment
  WHERE payment.order_id = v_order.id AND payment.status = 'pending'
  FOR UPDATE;
  IF FOUND THEN
    IF v_payment.provider <> _provider THEN
      RAISE EXCEPTION 'A payment attempt is already pending for this order.' USING ERRCODE = '22023';
    END IF;
    RETURN QUERY SELECT v_payment.id, v_payment.provider_reference,
      v_payment.amount_minor, v_payment.currency, v_payment.expires_at;
    RETURN;
  END IF;

  INSERT INTO public.payments (
    order_id, provider, provider_reference, amount_minor, currency, expires_at
  ) VALUES (
    v_order.id, _provider,
    'UTP-' || to_char(now() AT TIME ZONE 'UTC', 'YYMMDDHH24MISS') || '-' ||
      upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
    v_order.total_minor, v_order.currency,
    CASE WHEN _provider = 'aba_payway' THEN now() + interval '15 minutes' ELSE NULL END
  )
  RETURNING payments.* INTO v_payment;

  INSERT INTO public.payment_events (payment_id, event_type, changed_by)
  VALUES (v_payment.id, 'payment_attempt_created', v_customer_id);

  RETURN QUERY SELECT v_payment.id, v_payment.provider_reference,
    v_payment.amount_minor, v_payment.currency, v_payment.expires_at;
END;
$function$;

REVOKE ALL ON FUNCTION public.begin_payment(text, public.payment_provider) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.begin_payment(text, public.payment_provider) TO authenticated;
