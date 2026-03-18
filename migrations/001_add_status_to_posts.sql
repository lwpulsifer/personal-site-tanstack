-- Migration: Move post status from append-only log to a direct column on posts
--
-- Prerequisites: the post_current_status view and post_status_update table exist.
--
-- Step 1: Add the status column with a default of 'PENDING'
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'PENDING';

-- Step 2: Backfill from the existing post_current_status view
UPDATE posts
SET status = pcs.status
FROM post_current_status pcs
WHERE posts.id = pcs.post_id;

-- Step 3 (optional): Drop the old view and table once the application is deployed
-- DROP VIEW IF EXISTS post_current_status;
-- DROP TABLE IF EXISTS post_status_update;
