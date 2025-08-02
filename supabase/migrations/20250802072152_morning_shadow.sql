/*
  # Create notifications system

  1. New Tables
    - `notifications`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `type` (text, notification type)
      - `message` (text, notification message)
      - `link` (text, link to relevant content)
      - `is_read` (boolean, read status)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `notifications` table
    - Add policies for users to read/update their own notifications

  3. Triggers
    - Auto-create notifications for new comments
    - Auto-create notifications for post flags
    - Auto-create notifications for comment replies

  4. Functions
    - Handle new comment notifications
    - Handle post flag notifications
*/

-- Create the notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('new_comment', 'reply', 'green_flag', 'red_flag')),
  message text NOT NULL,
  link text NOT NULL,
  is_read boolean DEFAULT FALSE NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to read their own notifications
CREATE POLICY "Users can read own notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy for authenticated users to update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS notifications_user_id_is_read_idx ON public.notifications (user_id, is_read);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON public.notifications (created_at DESC);

-- Add parent_comment_id to comments table if it doesn't exist (for reply functionality)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comments' AND column_name = 'parent_comment_id'
  ) THEN
    ALTER TABLE public.comments ADD COLUMN parent_comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Function to handle new comment notifications
CREATE OR REPLACE FUNCTION public.handle_new_comment_notification()
RETURNS TRIGGER AS $$
DECLARE
  post_owner_id uuid;
  parent_comment_owner_id uuid;
  notification_message text;
  notification_link text;
  commenter_username text;
BEGIN
  -- Get the commenter's username
  SELECT username INTO commenter_username FROM public.registrations WHERE id = NEW.user_id;
  
  -- Get the post owner ID
  SELECT user_id INTO post_owner_id FROM public.posts WHERE id = NEW.post_id;

  -- Set the notification link
  notification_link := '/thread/' || NEW.post_id;

  -- Check if it's a reply to an existing comment
  IF NEW.parent_comment_id IS NOT NULL THEN
    -- It's a reply to an existing comment
    SELECT user_id INTO parent_comment_owner_id FROM public.comments WHERE id = NEW.parent_comment_id;
    notification_message := '@' || COALESCE(commenter_username, 'Someone') || ' replied to your comment';

    -- Only notify if the reply is not from the parent comment owner themselves
    IF parent_comment_owner_id IS NOT NULL AND NEW.user_id != parent_comment_owner_id THEN
      INSERT INTO public.notifications (user_id, type, message, link)
      VALUES (parent_comment_owner_id, 'reply', notification_message, notification_link);
    END IF;
  END IF;

  -- Always check for post owner notification (even for replies)
  notification_message := '@' || COALESCE(commenter_username, 'Someone') || ' commented on your post';

  -- Only notify if the comment is not from the post owner themselves
  IF post_owner_id IS NOT NULL AND NEW.user_id != post_owner_id THEN
    INSERT INTO public.notifications (user_id, type, message, link)
    VALUES (post_owner_id, 'new_comment', notification_message, notification_link);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle post flag notifications
CREATE OR REPLACE FUNCTION public.handle_post_flag_notification()
RETURNS TRIGGER AS $$
DECLARE
  post_owner_id uuid;
  notification_message text;
  notification_link text;
  flag_type text;
BEGIN
  -- Only create a notification if the flag counts actually increased
  IF NEW.green_flag_count > OLD.green_flag_count OR NEW.red_flag_count > OLD.red_flag_count THEN
    -- Get the post owner ID
    SELECT user_id INTO post_owner_id FROM public.posts WHERE id = NEW.id;
    notification_link := '/thread/' || NEW.id;

    -- Determine which flag was added
    IF NEW.green_flag_count > OLD.green_flag_count THEN
      notification_message := 'Your post received a green flag! 🟢';
      flag_type := 'green_flag';
    ELSIF NEW.red_flag_count > OLD.red_flag_count THEN
      notification_message := 'Your post received a red flag 🔴';
      flag_type := 'red_flag';
    END IF;

    -- Insert notification for the post owner
    IF post_owner_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, message, link)
      VALUES (post_owner_id, flag_type, notification_message, notification_link);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
DROP TRIGGER IF EXISTS new_comment_notification_trigger ON public.comments;
CREATE TRIGGER new_comment_notification_trigger
AFTER INSERT ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.handle_new_comment_notification();

DROP TRIGGER IF EXISTS post_flag_notification_trigger ON public.posts;
CREATE TRIGGER post_flag_notification_trigger
AFTER UPDATE ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.handle_post_flag_notification();