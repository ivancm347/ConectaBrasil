import { createClient } from '@supabase/supabase-js';
import { getMarketFromPath } from './market.js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// The header scopes the public storefront query to the market selected by the URL.
// It is a presentation filter only: approved listings remain public by product decision.
// Owner authorization continues to rely on the signed app_metadata.market_code claim.
const selectedMarketCode = getMarketFromPath().code;

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          'x-market-code': selectedMarketCode,
        },
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
