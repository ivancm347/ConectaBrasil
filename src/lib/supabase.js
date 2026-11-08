import { createClient } from '@supabase/supabase-js';
import { getMarketFromPath } from './market.js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Identifica a vitrine pública escolhida pela rota (/br ou /py).
// Este cabeçalho é apenas contexto de apresentação; não concede acesso a dados privados.
// A autorização de cadastro/edição continua baseada nas claims assinadas do usuário.
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
