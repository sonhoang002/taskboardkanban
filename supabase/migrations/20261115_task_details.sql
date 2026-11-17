BEGIN;

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS due_date date;

CREATE TABLE IF NOT EXISTS public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (body ~ '[^[:space:]]' AND char_length(body) <= 4000),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS comments_task_created_idx
ON public.comments (task_id, created_at, id);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.comments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.comments TO authenticated;
GRANT INSERT (task_id, body) ON TABLE public.comments TO authenticated;

DROP POLICY IF EXISTS "Users read own task comments" ON public.comments;
CREATE POLICY "Users read own task comments"
ON public.comments FOR SELECT TO authenticated
USING (
  user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = comments.task_id AND tasks.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Users comment on own tasks" ON public.comments;
CREATE POLICY "Users comment on own tasks"
ON public.comments FOR INSERT TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = comments.task_id AND tasks.user_id = (SELECT auth.uid())
  )
);

CREATE TABLE IF NOT EXISTS public.task_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (
    action IN ('created', 'status_changed', 'title_changed', 'due_date_changed',
      'description_changed', 'priority_changed', 'comment_added')
  ),
  old_value text,
  new_value text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS task_activity_task_created_idx
ON public.task_activity (task_id, created_at, id);

ALTER TABLE public.task_activity ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.task_activity FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.task_activity TO authenticated;

DROP POLICY IF EXISTS "Users read own task activity" ON public.task_activity;
CREATE POLICY "Users read own task activity"
ON public.task_activity FOR SELECT TO authenticated
USING (
  user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = task_activity.task_id AND tasks.user_id = (SELECT auth.uid())
  )
);

CREATE OR REPLACE FUNCTION public.record_task_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.task_activity (task_id, user_id, action, new_value)
    VALUES (NEW.id, NEW.user_id, 'created', NEW.title);
    RETURN NEW;
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.task_activity (task_id, user_id, action, old_value, new_value)
    VALUES (NEW.id, NEW.user_id, 'status_changed', OLD.status, NEW.status);
  END IF;

  IF OLD.title IS DISTINCT FROM NEW.title THEN
    INSERT INTO public.task_activity (task_id, user_id, action, old_value, new_value)
    VALUES (NEW.id, NEW.user_id, 'title_changed', OLD.title, NEW.title);
  END IF;

  IF OLD.due_date IS DISTINCT FROM NEW.due_date THEN
    INSERT INTO public.task_activity (task_id, user_id, action, old_value, new_value)
    VALUES (NEW.id, NEW.user_id, 'due_date_changed', OLD.due_date::text, NEW.due_date::text);
  END IF;

  IF OLD.description IS DISTINCT FROM NEW.description THEN
    INSERT INTO public.task_activity (task_id, user_id, action, old_value, new_value)
    VALUES (NEW.id, NEW.user_id, 'description_changed', OLD.description, NEW.description);
  END IF;

  IF OLD.priority IS DISTINCT FROM NEW.priority THEN
    INSERT INTO public.task_activity (task_id, user_id, action, old_value, new_value)
    VALUES (NEW.id, NEW.user_id, 'priority_changed', OLD.priority, NEW.priority);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_comment_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.task_activity (task_id, user_id, action)
  VALUES (NEW.task_id, NEW.user_id, 'comment_added');
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.record_task_activity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_comment_activity() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS tasks_record_activity ON public.tasks;
CREATE TRIGGER tasks_record_activity
AFTER INSERT OR UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.record_task_activity();

DROP TRIGGER IF EXISTS comments_record_activity ON public.comments;
CREATE TRIGGER comments_record_activity
AFTER INSERT ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.record_comment_activity();

COMMIT;
