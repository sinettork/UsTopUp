-- Local preview fixtures only. These packages and retail prices are not live offers.
DO $seed$
BEGIN
INSERT INTO public.games (
  slug, title, publisher, category, credit_label, currency, image_url,
  fulfillment_method, is_active, sort_order
)
VALUES
  (
    'mobile-legends', 'Mobile Legends: Bang Bang', 'Moonton', 'Mobile',
    'Diamonds', 'USD', null, 'manual', true, 1
  ),
  (
    'valorant', 'VALORANT', 'Riot Games', 'PC',
    'VP', 'USD', null, 'manual', true, 2
  )
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  publisher = EXCLUDED.publisher,
  category = EXCLUDED.category,
  credit_label = EXCLUDED.credit_label,
  currency = EXCLUDED.currency,
  image_url = EXCLUDED.image_url,
  fulfillment_method = EXCLUDED.fulfillment_method,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.game_fields (
  game_id, field_key, label, field_type, placeholder, help_text,
  is_required, is_active, sort_order
)
SELECT game.id, field.field_key, field.label, field.field_type,
  field.placeholder, field.help_text, true, true, field.sort_order
FROM public.games AS game
JOIN (VALUES
  ('mobile-legends', 'player_id', 'Player ID', 'text'::public.game_field_type, 'Enter Player ID', 'Find your ID in your in-game profile.', 1),
  ('mobile-legends', 'server_id', 'Zone ID', 'text'::public.game_field_type, 'Enter Zone ID', 'Enter the zone shown beside your Player ID.', 2),
  ('valorant', 'riot_id', 'Riot ID', 'text'::public.game_field_type, 'Name#Tag', 'Enter your Riot ID and tagline.', 1)
) AS field(slug, field_key, label, field_type, placeholder, help_text, sort_order)
  ON field.slug = game.slug
ON CONFLICT (game_id, field_key) DO UPDATE SET
  label = EXCLUDED.label,
  field_type = EXCLUDED.field_type,
  placeholder = EXCLUDED.placeholder,
  help_text = EXCLUDED.help_text,
  is_required = EXCLUDED.is_required,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.game_packages (
  game_id, package_code, amount_label, bonus_label, price_minor,
  supplier_cost_minor, currency, is_active, sort_order
)
SELECT game.id, package.package_code, package.amount_label, package.bonus_label,
  package.price_minor, 0, 'USD', true, package.sort_order
FROM public.games AS game
JOIN (VALUES
  ('mobile-legends', 'mlbb-78', '78', '+8 bonus', 150::bigint, 1),
  ('mobile-legends', 'mlbb-156', '156', '+16 bonus', 300::bigint, 2),
  ('mobile-legends', 'mlbb-774', '774', '+80 bonus', 1500::bigint, 3),
  ('mobile-legends', 'mlbb-3330', '3,330', '+350 bonus', 6000::bigint, 4),
  ('mobile-legends', 'mlbb-7740', '7,740', '+800 bonus', 13000::bigint, 5),
  ('mobile-legends', 'mlbb-15480', '15,480', '+1,600 bonus', 26000::bigint, 6),
  ('valorant', 'vp-475', '475', null, 499::bigint, 1),
  ('valorant', 'vp-1000', '1,000', '+50 bonus', 999::bigint, 2),
  ('valorant', 'vp-2050', '2,050', '+150 bonus', 1999::bigint, 3),
  ('valorant', 'vp-5350', '5,350', '+450 bonus', 4999::bigint, 4)
) AS package(slug, package_code, amount_label, bonus_label, price_minor, sort_order)
  ON package.slug = game.slug
ON CONFLICT (game_id, package_code) DO UPDATE SET
  amount_label = EXCLUDED.amount_label,
  bonus_label = EXCLUDED.bonus_label,
  price_minor = EXCLUDED.price_minor,
  supplier_cost_minor = EXCLUDED.supplier_cost_minor,
  currency = EXCLUDED.currency,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order;
END;
$seed$;
