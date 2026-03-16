-- LOCAL-ONLY seed data. Guard: abort if the JWT secret doesn't match the well-known
-- local dev value. Production will never have this secret.
DO $$
BEGIN
  IF current_setting('app.settings.jwt_secret', true) IS DISTINCT FROM
     'super-secret-jwt-token-with-at-least-32-characters-long'
  THEN
    RAISE EXCEPTION 'seed.sql refusing to run — not a local Supabase instance';
  END IF;
END
$$;

-- ── Test posts ────────────────────────────────────────────────────────────────

INSERT INTO public.posts (id, slug, title, description, content, tags, published_at)
VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    'hello-world',
    'Hello World',
    'Our first test post',
    E'# Hello World\n\nWelcome to the test blog.\n\nThis post is used for e2e testing.',
    ARRAY['test', 'intro'],
    '2025-01-01T12:00:00Z'
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'second-post',
    'Second Post',
    'The second test post',
    E'# Second Post\n\nAnother test post for e2e testing.\n\n## Section Two\n\nSome more content here.',
    ARRAY['test'],
    '2025-01-02T12:00:00Z'
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    'draft-post',
    'Draft Post',
    'An unpublished draft',
    E'# Draft Post\n\nThis post should not be visible to the public.',
    ARRAY['draft'],
    NULL
  );

INSERT INTO public.post_status_update (post_id, status)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'PUBLISHED'),
  ('00000000-0000-0000-0000-000000000002', 'PUBLISHED'),
  ('00000000-0000-0000-0000-000000000003', 'PENDING');

-- ── Local dev admin user (admin@local.dev / password123) ──────────────────────

INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'admin@local.dev',
  crypt('password123', gen_salt('bf')),
  now(), now(), now(), 'authenticated', 'authenticated'
);

INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, created_at, updated_at)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  jsonb_build_object('sub', 'a0000000-0000-0000-0000-000000000001', 'email', 'admin@local.dev'),
  'email', 'a0000000-0000-0000-0000-000000000001',
  now(), now()
);

-- ── Sample map locations ─────────────────────────────────────────────────────

INSERT INTO public.map_locations (id, map_slug, name, description, address, lat, lng)
VALUES
  ('b0000000-0000-0000-0000-000000000001', 'lions', 'Palace of Fine Arts Lions', 'Pair of golden lions flanking the entrance', '3301 Lyon St, San Francisco', 37.8029, -122.4484),
  ('b0000000-0000-0000-0000-000000000002', 'lions', 'City Hall Lions', 'Stone lions guarding the main steps', '1 Dr Carlton B Goodlett Pl, San Francisco', 37.7793, -122.4193);
