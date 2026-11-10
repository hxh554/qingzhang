import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

/** 有没有配置云端：没配置就退化成纯本地账本（当前行为不变） */
export const cloudEnabled = Boolean(URL && KEY);

export const supabase: SupabaseClient | null = cloudEnabled
  ? createClient(URL as string, KEY as string, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      realtime: { params: { eventsPerSecond: 10 } },
    })
  : null;
