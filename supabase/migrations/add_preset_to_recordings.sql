-- Add preset column to recordings table
ALTER TABLE public.recordings 
ADD COLUMN preset text;

