/*
  # Fix Foreign Key References

  1. Database Schema Updates
    - Drop existing foreign key constraints that reference non-existent 'users' table
    - Add correct foreign key constraints to reference 'registrations' table
    - Ensure data integrity between posts, comments, and registrations

  2. Security
    - Maintain existing RLS policies
    - No changes to existing security model

  3. Changes
    - Update posts.user_id to reference registrations(id)
    - Update comments.user_id to reference registrations(id)
    - Fix any orphaned records that might exist
*/

-- First, let's check if the foreign key constraints exist and drop them if they do
DO $$
BEGIN
  -- Drop foreign key constraint on posts.user_id if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'posts_user_id_fkey' 
    AND table_name = 'posts'
  ) THEN
    ALTER TABLE posts DROP CONSTRAINT posts_user_id_fkey;
  END IF;

  -- Drop foreign key constraint on comments.user_id if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'comments_user_id_fkey' 
    AND table_name = 'comments'
  ) THEN
    ALTER TABLE comments DROP CONSTRAINT comments_user_id_fkey;
  END IF;
END $$;

-- Add correct foreign key constraints to reference registrations table
DO $$
BEGIN
  -- Add foreign key constraint for posts.user_id -> registrations.id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'posts_user_id_fkey' 
    AND table_name = 'posts'
  ) THEN
    ALTER TABLE posts 
    ADD CONSTRAINT posts_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES registrations(id) ON DELETE CASCADE;
  END IF;

  -- Add foreign key constraint for comments.user_id -> registrations.id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'comments_user_id_fkey' 
    AND table_name = 'comments'
  ) THEN
    ALTER TABLE comments 
    ADD CONSTRAINT comments_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES registrations(id) ON DELETE CASCADE;
  END IF;
END $$;