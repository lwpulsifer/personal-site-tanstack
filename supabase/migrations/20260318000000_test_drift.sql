-- Test migration to verify type-drift CI catches stale types
CREATE TABLE IF NOT EXISTS test_drift_table (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);
