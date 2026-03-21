-- SQL setup for Torres Madeira Notifica

-- 1. Create table 'sales'
CREATE TABLE IF NOT EXISTS public.sales (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product text NOT NULL,
  length_meters numeric NOT NULL,
  quantity integer NOT NULL,
  message text NOT NULL,
  status text DEFAULT 'novo'::text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select sales" ON public.sales FOR SELECT USING (true);
CREATE POLICY "Allow all insert sales" ON public.sales FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update sales" ON public.sales FOR UPDATE USING (true);
CREATE POLICY "Allow all delete sales" ON public.sales FOR DELETE USING (true);

-- 2. Create table 'device_tokens' for push notifications
CREATE TABLE IF NOT EXISTS public.device_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  role text NOT NULL,
  device_name text,
  fcm_token text UNIQUE NOT NULL,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select tokens" ON public.device_tokens FOR SELECT USING (true);
CREATE POLICY "Allow all insert tokens" ON public.device_tokens FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update tokens" ON public.device_tokens FOR UPDATE USING (true);

-- 3. Setup Realtime for the 'sales' table so the /estoque screen updates automatically
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;
