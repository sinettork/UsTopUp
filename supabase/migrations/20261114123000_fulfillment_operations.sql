CREATE FUNCTION public.update_fulfillment_job(
  _job_id uuid,
  _next_status public.fulfillment_status,
  _note text DEFAULT '',
  _external_reference text DEFAULT NULL
)
RETURNS public.fulfillment_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_job public.fulfillment_jobs%ROWTYPE;
  v_note text := left(COALESCE(btrim(_note), ''), 1000);
BEGIN
  IF NOT (SELECT public.is_staff()) THEN
    RAISE EXCEPTION 'Staff access is required.' USING ERRCODE = '42501';
  END IF;

  SELECT job.* INTO v_job FROM public.fulfillment_jobs AS job
  WHERE job.id = _job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fulfillment job not found.' USING ERRCODE = 'P0002'; END IF;
  IF v_job.status = 'completed' THEN
    RAISE EXCEPTION 'Completed fulfillment cannot be changed.' USING ERRCODE = '22023';
  END IF;
  IF v_job.status = 'queued' AND _next_status NOT IN ('processing', 'failed', 'needs_review') THEN
    RAISE EXCEPTION 'Invalid fulfillment transition.' USING ERRCODE = '22023';
  ELSIF v_job.status = 'processing' AND _next_status NOT IN ('completed', 'failed', 'needs_review') THEN
    RAISE EXCEPTION 'Invalid fulfillment transition.' USING ERRCODE = '22023';
  ELSIF v_job.status = 'failed' AND _next_status NOT IN ('queued', 'needs_review') THEN
    RAISE EXCEPTION 'Invalid fulfillment transition.' USING ERRCODE = '22023';
  ELSIF v_job.status = 'needs_review' AND _next_status NOT IN ('queued', 'processing', 'failed') THEN
    RAISE EXCEPTION 'Invalid fulfillment transition.' USING ERRCODE = '22023';
  END IF;
  IF _next_status IN ('failed', 'needs_review') AND v_note = '' THEN
    RAISE EXCEPTION 'Add a note explaining this fulfillment update.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.fulfillment_jobs
  SET status = _next_status,
      attempt_count = attempt_count + CASE WHEN _next_status = 'processing' THEN 1 ELSE 0 END,
      next_attempt_at = CASE WHEN _next_status = 'queued' THEN now() ELSE NULL END,
      external_reference = COALESCE(NULLIF(left(btrim(_external_reference), 200), ''), external_reference),
      last_error = CASE WHEN _next_status = 'failed' OR _next_status = 'needs_review' THEN v_note ELSE NULL END,
      staff_note = NULLIF(v_note, ''),
      started_at = CASE WHEN _next_status = 'processing' THEN COALESCE(started_at, now()) ELSE started_at END,
      completed_at = CASE WHEN _next_status = 'completed' THEN now() ELSE completed_at END
  WHERE id = v_job.id;
  INSERT INTO public.fulfillment_events (job_id, from_status, to_status, note, changed_by)
  VALUES (v_job.id, v_job.status, _next_status, v_note, (SELECT auth.uid()));

  IF _next_status = 'completed' THEN
    UPDATE public.orders AS app_order
    SET status = 'completed'
    WHERE app_order.id = (
      SELECT item.order_id FROM public.order_items AS item WHERE item.id = v_job.order_item_id
    )
    AND app_order.status = 'processing'
    AND NOT EXISTS (
      SELECT 1
      FROM public.order_items AS item
      JOIN public.fulfillment_jobs AS job ON job.order_item_id = item.id
      WHERE item.order_id = app_order.id
        AND (job.id <> v_job.id AND job.status <> 'completed')
    );
  END IF;
  RETURN _next_status;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_fulfillment_job(uuid, public.fulfillment_status, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_fulfillment_job(uuid, public.fulfillment_status, text, text) TO authenticated;
