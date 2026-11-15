CREATE TYPE public.refund_status AS ENUM ('requested', 'processing', 'completed', 'failed');

CREATE TABLE public.refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments (id) ON DELETE RESTRICT,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency char(3) NOT NULL,
  status public.refund_status NOT NULL DEFAULT 'requested',
  reason text NOT NULL,
  provider_refund_reference text,
  staff_note text NOT NULL DEFAULT '',
  requested_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX refunds_payment_time_idx ON public.refunds (payment_id, created_at DESC);
CREATE INDEX refunds_status_time_idx ON public.refunds (status, created_at DESC);
CREATE TRIGGER refunds_set_updated_at
  BEFORE UPDATE ON public.refunds
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY refunds_read_own_or_staff ON public.refunds FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.payments AS payment
      JOIN public.orders AS app_order ON app_order.id = payment.order_id
      WHERE payment.id = payment_id
        AND (app_order.customer_id = (SELECT auth.uid()) OR (SELECT public.is_staff()))
    )
  );
GRANT SELECT ON public.refunds TO authenticated;

CREATE FUNCTION public.request_refund(_payment_id uuid, _amount_minor bigint, _reason text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_refund_id uuid;
  v_reserved bigint;
  v_reason text := left(btrim(COALESCE(_reason, '')), 1000);
BEGIN
  IF NOT (
    (SELECT public.has_role((SELECT auth.uid()), 'owner'))
    OR (SELECT public.has_role((SELECT auth.uid()), 'administrator'))
  ) THEN
    RAISE EXCEPTION 'Administrator access is required.' USING ERRCODE = '42501';
  END IF;
  SELECT payment.* INTO v_payment FROM public.payments AS payment
  WHERE payment.id = _payment_id FOR UPDATE;
  IF NOT FOUND OR v_payment.status NOT IN ('paid', 'refunded') THEN
    RAISE EXCEPTION 'Only paid payments can be refunded.' USING ERRCODE = '22023';
  END IF;
  IF _amount_minor IS NULL OR _amount_minor <= 0 OR v_reason = '' THEN
    RAISE EXCEPTION 'Enter a positive refund amount and a reason.' USING ERRCODE = '22023';
  END IF;
  SELECT COALESCE(sum(refund.amount_minor), 0) INTO v_reserved
  FROM public.refunds AS refund
  WHERE refund.payment_id = v_payment.id AND refund.status IN ('requested', 'processing', 'completed');
  IF v_reserved + _amount_minor > v_payment.amount_minor THEN
    RAISE EXCEPTION 'Refunds cannot exceed the amount paid.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.refunds (payment_id, amount_minor, currency, reason, requested_by)
  VALUES (v_payment.id, _amount_minor, v_payment.currency, v_reason, (SELECT auth.uid()))
  RETURNING refunds.id INTO v_refund_id;
  INSERT INTO public.payment_events (payment_id, event_type, details, changed_by)
  VALUES (v_payment.id, 'refund_requested', jsonb_build_object('refund_id', v_refund_id, 'amount_minor', _amount_minor, 'reason', v_reason), (SELECT auth.uid()));
  RETURN v_refund_id;
END;
$function$;

CREATE FUNCTION public.update_refund(
  _refund_id uuid,
  _next_status public.refund_status,
  _provider_reference text DEFAULT NULL,
  _note text DEFAULT ''
)
RETURNS public.refund_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_refund public.refunds%ROWTYPE;
  v_note text := left(btrim(COALESCE(_note, '')), 1000);
  v_refunded_total bigint;
BEGIN
  IF NOT (
    (SELECT public.has_role((SELECT auth.uid()), 'owner'))
    OR (SELECT public.has_role((SELECT auth.uid()), 'administrator'))
  ) THEN
    RAISE EXCEPTION 'Administrator access is required.' USING ERRCODE = '42501';
  END IF;
  SELECT refund.* INTO v_refund FROM public.refunds AS refund
  WHERE refund.id = _refund_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Refund record not found.' USING ERRCODE = 'P0002'; END IF;
  IF v_refund.status = 'completed' THEN
    RAISE EXCEPTION 'Completed refunds cannot be changed.' USING ERRCODE = '22023';
  END IF;
  IF v_refund.status = 'requested' AND _next_status NOT IN ('processing', 'failed') THEN
    RAISE EXCEPTION 'Invalid refund transition.' USING ERRCODE = '22023';
  ELSIF v_refund.status = 'processing' AND _next_status NOT IN ('completed', 'failed') THEN
    RAISE EXCEPTION 'Invalid refund transition.' USING ERRCODE = '22023';
  ELSIF v_refund.status = 'failed' AND _next_status <> 'requested' THEN
    RAISE EXCEPTION 'Invalid refund transition.' USING ERRCODE = '22023';
  END IF;
  IF _next_status = 'completed' AND NULLIF(btrim(_provider_reference), '') IS NULL THEN
    RAISE EXCEPTION 'Record the provider confirmation reference before marking the refund complete.' USING ERRCODE = '22023';
  END IF;
  IF _next_status = 'failed' AND v_note = '' THEN
    RAISE EXCEPTION 'Add a note explaining the failed refund.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.refunds
  SET status = _next_status,
      provider_refund_reference = COALESCE(NULLIF(left(btrim(_provider_reference), 200), ''), provider_refund_reference),
      staff_note = v_note,
      completed_at = CASE WHEN _next_status = 'completed' THEN now() ELSE completed_at END
  WHERE id = v_refund.id;
  INSERT INTO public.payment_events (payment_id, event_type, details, changed_by, verified_at)
  VALUES (v_refund.payment_id, 'refund_' || _next_status::text,
    jsonb_build_object('refund_id', v_refund.id, 'amount_minor', v_refund.amount_minor,
      'provider_reference', NULLIF(btrim(_provider_reference), ''), 'note', v_note),
    (SELECT auth.uid()), CASE WHEN _next_status = 'completed' THEN now() ELSE NULL END);

  IF _next_status = 'completed' THEN
    SELECT COALESCE(sum(refund.amount_minor), 0) INTO v_refunded_total
    FROM public.refunds AS refund
    WHERE refund.payment_id = v_refund.payment_id AND refund.status = 'completed';
    UPDATE public.payments
    SET status = 'refunded'
    WHERE id = v_refund.payment_id
      AND status = 'paid'
      AND amount_minor <= v_refunded_total;
  END IF;
  RETURN _next_status;
END;
$function$;

REVOKE ALL ON FUNCTION public.request_refund(uuid, bigint, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_refund(uuid, public.refund_status, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_refund(uuid, bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_refund(uuid, public.refund_status, text, text) TO authenticated;
