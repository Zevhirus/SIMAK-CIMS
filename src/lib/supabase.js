import { createClient } from '@supabase/supabase-js'

// Hanya publishable (anon) key yang boleh ada di frontend. Keamanan data dijaga oleh RLS.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
)
