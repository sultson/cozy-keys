CREATE TABLE public.profiles (
  id uuid NOT NULL,
  name text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.recordings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  audio text,
  midi text,
  duration double precision,
  is_public boolean,
  hearts ARRAY DEFAULT '{}'::text[],
  country text,
  events_count bigint,
  title text,
  CONSTRAINT recordings_pkey PRIMARY KEY (id),
  CONSTRAINT recordings_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);

-- Enable RLS on recordings table
ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;

-- SELECT policy: Enable all access to public recordings and creator access to private recordings (applies to all roles)
CREATE POLICY "Enable all access to public recordings and creator access to private recordings" ON public.recordings
  FOR SELECT
  TO public
  USING (is_public or auth.uid() = created_by);

-- DELETE policy: Enable delete for users based on created_by (applies to authenticated users)
CREATE POLICY "Enable delete for users based on created_by" ON public.recordings
  FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- INSERT policy: Enable insert for authenticated users only (applies to authenticated users)
CREATE POLICY "Enable insert for authenticated users only" ON public.recordings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- UPDATE policy: Enable updates for authenticated users (applies to authenticated users)
CREATE POLICY "Enable updates for authenticated users" ON public.recordings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- inserts a row into public.profiles
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, new.raw_user_meta_data ->> 'name');
  return new;
end;
$$;
-- trigger the function every time a user is created
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();