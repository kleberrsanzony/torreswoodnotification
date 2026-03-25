-- Migration: Create profiles table for multi-user support

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  pin text NOT NULL, -- PIN for quick login (e.g. 123456)
  role text DEFAULT 'seller'::text, -- 'admin' or 'seller'
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Allow all select profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Allow admin update profiles" ON public.profiles FOR UPDATE USING (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
-- Since we are using a custom auth logic for now (sessionStorage PIN), we'll keep it simple:
CREATE POLICY "Allow all update profiles" ON public.profiles FOR UPDATE USING (true);
CREATE POLICY "Allow all insert profiles" ON public.profiles FOR INSERT WITH CHECK (true);

-- Update SALES table to include seller_id (optional, but good for linking)
-- ALTER TABLE public.sales ADD COLUMN seller_id uuid REFERENCES public.profiles(id);

-- Seed Data: Create Kleber as Admin
INSERT INTO public.profiles (name, pin, role)
VALUES ('Kleber', '35771419', 'admin');

-- Seed Data: Create Sellers
INSERT INTO public.profiles (name, pin, role)
VALUES ('Jackson', '0000', 'seller'),
       ('Deidiviane', '0000', 'seller'),
       ('Márcio', '0000', 'seller'),
       ('Mauro', '0000', 'seller'),
       ('Mayara', '0000', 'seller');
