// The connection to the shared board.
//
// The url and the publishable key are not secrets and are not treated as
// such: any static build inlines them into the bundle, and this repo is
// public. Nothing is protected by hiding them. What protects the board is the
// row level security in the database, which lets only a claimed player read it
// and lets neither brother write the other's rows. Anyone holding these two
// strings and no account gets nothing at all.

import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://anaqekqchwziceegqisr.supabase.co';

export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_KEY ?? 'sb_publishable_siOp0LTQEwuSubl9XaVp9w_tNLhGA6V';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Sign-in is a six digit code typed into the app, never a link followed
    // in a browser, so there is never a session to pick out of a url. That is
    // what makes the same code work inside the Android app.
    detectSessionInUrl: false,
  },
});
