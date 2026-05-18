import { supabase } from '@/integrations/supabase/client';

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const BASE = `https://${PROJECT_ID}.supabase.co/functions/v1`;

export async function callBackupFn<T = any>(fn: string, body?: any): Promise<T> {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) throw new Error('No autenticat');
  const res = await fetch(`${BASE}/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body || {}),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Error');
  return json;
}
