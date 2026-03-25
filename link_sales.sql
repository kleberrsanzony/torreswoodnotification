-- Migration: Link sales to profiles

ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS seller_id uuid REFERENCES public.profiles(id);

-- Optional: Update existing records if names match (best effort)
-- UPDATE public.sales s SET seller_id = p.id FROM public.profiles p WHERE s.vendedor = p.name;
