CREATE TYPE public.game_field_type AS ENUM ('text', 'email', 'number');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  locale text NOT NULL DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_key text NOT NULL UNIQUE CHECK (
    role_key IN ('owner', 'administrator', 'support_staff', 'customer')
  ),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_key text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.role_permissions (
  role_id uuid NOT NULL REFERENCES public.roles (id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE public.profile_roles (
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.roles (id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, role_id)
);

CREATE TABLE public.games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text NOT NULL,
  publisher text NOT NULL DEFAULT '',
  category text NOT NULL,
  credit_label text NOT NULL,
  currency char(3) NOT NULL DEFAULT 'USD',
  image_url text,
  fulfillment_method text NOT NULL DEFAULT 'automatic'
    CHECK (fulfillment_method IN ('automatic', 'manual')),
  is_active boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.game_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games (id) ON DELETE CASCADE,
  field_key text NOT NULL,
  label text NOT NULL,
  field_type public.game_field_type NOT NULL DEFAULT 'text',
  placeholder text,
  help_text text,
  validation_pattern text,
  is_required boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, field_key)
);

CREATE TABLE public.game_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games (id) ON DELETE CASCADE,
  package_code text NOT NULL,
  amount_label text NOT NULL,
  bonus_label text,
  price_minor bigint NOT NULL CHECK (price_minor >= 0),
  currency char(3) NOT NULL DEFAULT 'USD',
  is_active boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, package_code)
);

CREATE INDEX games_active_sort_idx
  ON public.games (sort_order, title)
  WHERE is_active;

CREATE INDEX game_fields_game_sort_idx
  ON public.game_fields (game_id, sort_order)
  WHERE is_active;

CREATE INDEX game_packages_game_sort_idx
  ON public.game_packages (game_id, sort_order)
  WHERE is_active;

CREATE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER games_set_updated_at
  BEFORE UPDATE ON public.games
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER game_fields_set_updated_at
  BEFORE UPDATE ON public.game_fields
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER game_packages_set_updated_at
  BEFORE UPDATE ON public.game_packages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE FUNCTION public.has_role(_profile_id uuid, _role_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profile_roles AS profile_role
    JOIN public.roles AS app_role ON app_role.id = profile_role.role_id
    WHERE profile_role.profile_id = _profile_id
      AND app_role.role_key = _role_key
  );
$function$;

CREATE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT public.has_role((SELECT auth.uid()), 'owner')
    OR public.has_role((SELECT auth.uid()), 'administrator')
    OR public.has_role((SELECT auth.uid()), 'support_staff');
$function$;

CREATE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data ->> 'display_name', ''),
      NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
      'Customer'
    )
  );

  INSERT INTO public.profile_roles (profile_id, role_id)
  SELECT NEW.id, app_role.id
  FROM public.roles AS app_role
  WHERE app_role.role_key = 'customer';

  RETURN NEW;
END;
$function$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.roles (role_key)
VALUES ('owner'), ('administrator'), ('support_staff'), ('customer');

INSERT INTO public.permissions (permission_key, description)
VALUES
  ('catalog.manage', 'Create and update games, fields, packages, and prices'),
  ('orders.manage', 'View and process customer orders'),
  ('customers.manage', 'View and support customer accounts'),
  ('suppliers.manage', 'Manage supplier integrations'),
  ('reports.view', 'View operational and financial reports'),
  ('audit.view', 'View administrative audit logs');

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_read_self_or_staff
  ON public.profiles FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()) OR (SELECT public.is_staff()));

CREATE POLICY profiles_update_self
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY roles_read_staff
  ON public.roles FOR SELECT TO authenticated
  USING ((SELECT public.is_staff()));

CREATE POLICY permissions_read_staff
  ON public.permissions FOR SELECT TO authenticated
  USING ((SELECT public.is_staff()));

CREATE POLICY role_permissions_read_staff
  ON public.role_permissions FOR SELECT TO authenticated
  USING ((SELECT public.is_staff()));

CREATE POLICY profile_roles_read_self_or_staff
  ON public.profile_roles FOR SELECT TO authenticated
  USING (
    profile_id = (SELECT auth.uid())
    OR (SELECT public.is_staff())
  );

CREATE POLICY games_read_active_or_staff
  ON public.games FOR SELECT TO anon, authenticated
  USING (is_active OR (SELECT public.is_staff()));

CREATE POLICY games_insert_admin
  ON public.games FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.has_role((SELECT auth.uid()), 'owner'))
    OR (SELECT public.has_role((SELECT auth.uid()), 'administrator'))
  );

CREATE POLICY games_update_admin
  ON public.games FOR UPDATE TO authenticated
  USING (
    (SELECT public.has_role((SELECT auth.uid()), 'owner'))
    OR (SELECT public.has_role((SELECT auth.uid()), 'administrator'))
  )
  WITH CHECK (
    (SELECT public.has_role((SELECT auth.uid()), 'owner'))
    OR (SELECT public.has_role((SELECT auth.uid()), 'administrator'))
  );

CREATE POLICY games_delete_owner
  ON public.games FOR DELETE TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'owner')));

CREATE POLICY game_fields_read_active_or_staff
  ON public.game_fields FOR SELECT TO anon, authenticated
  USING (
    (
      is_active
      AND EXISTS (
        SELECT 1
        FROM public.games AS game
        WHERE game.id = game_id AND game.is_active
      )
    )
    OR (SELECT public.is_staff())
  );

CREATE POLICY game_fields_manage_admin
  ON public.game_fields FOR ALL TO authenticated
  USING (
    (SELECT public.has_role((SELECT auth.uid()), 'owner'))
    OR (SELECT public.has_role((SELECT auth.uid()), 'administrator'))
  )
  WITH CHECK (
    (SELECT public.has_role((SELECT auth.uid()), 'owner'))
    OR (SELECT public.has_role((SELECT auth.uid()), 'administrator'))
  );

CREATE POLICY game_packages_read_active_or_staff
  ON public.game_packages FOR SELECT TO anon, authenticated
  USING (
    (
      is_active
      AND EXISTS (
        SELECT 1
        FROM public.games AS game
        WHERE game.id = game_id AND game.is_active
      )
    )
    OR (SELECT public.is_staff())
  );

CREATE POLICY game_packages_manage_admin
  ON public.game_packages FOR ALL TO authenticated
  USING (
    (SELECT public.has_role((SELECT auth.uid()), 'owner'))
    OR (SELECT public.has_role((SELECT auth.uid()), 'administrator'))
  )
  WITH CHECK (
    (SELECT public.has_role((SELECT auth.uid()), 'owner'))
    OR (SELECT public.has_role((SELECT auth.uid()), 'administrator'))
  );

REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff() TO anon, authenticated;

GRANT SELECT ON public.games, public.game_fields, public.game_packages TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.games, public.game_fields, public.game_packages TO authenticated;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.roles, public.permissions, public.role_permissions, public.profile_roles TO authenticated;
