import { supabase } from '@/integrations/supabase/client';

interface GeneratePostParams {
  type: 'tournament' | 'ranking' | 'news';
  format?: 'whatsapp' | 'instagram' | 'noticia';
  style?: string;
  data: Record<string, any>;
}

export async function generateAIPost({ type, format, style, data }: GeneratePostParams): Promise<string> {
  const { data: response, error } = await supabase.functions.invoke('generate-post', {
    body: { type, format, style, data },
  });

  if (error) throw new Error(error.message || 'Error generant el text');
  if (response?.error) throw new Error(response.error);
  return response?.text || 'Error: no s\'ha generat cap text.';
}
