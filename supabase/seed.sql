-- E2E test seed data — deterministic slugs and UUIDs so tests can assert on known content.

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
