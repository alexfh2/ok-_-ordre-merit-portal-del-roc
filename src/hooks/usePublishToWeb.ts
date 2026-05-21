import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export function usePublishToWeb() {
  const [publishing, setPublishing] = useState(false);

  async function uploadPhoto(file: File, prefix: string): Promise<string | null> {
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('news-photos').upload(path, file);
    if (error) {
      console.error('Error uploading photo:', error);
      return null;
    }
    const { data } = supabase.storage.from('news-photos').getPublicUrl(path);
    return data.publicUrl;
  }

  async function publishToWeb(
    title: string,
    content: string,
    excerpt?: string,
    mainPhotoFile?: File | null,
    galleryFiles?: File[],
  ) {
    setPublishing(true);
    try {
      const prefix = `news-${Date.now()}`;
      let imageUrl: string | null = null;
      const galleryImages: string[] = [];

      if (mainPhotoFile) {
        imageUrl = await uploadPhoto(mainPhotoFile, prefix);
      }

      if (galleryFiles && galleryFiles.length > 0) {
        for (const file of galleryFiles) {
          const url = await uploadPhoto(file, prefix);
          if (url) galleryImages.push(url);
        }
      }

      const { data, error } = await supabase.functions.invoke("publish-news-proxy", {
        body: {
          title,
          content: content.replace(/\*\*/g, ''),
          excerpt: excerpt || content.replace(/\*\*/g, '').slice(0, 200),
          image_url: imageUrl || undefined,
          gallery_images: galleryImages.length > 0 ? galleryImages : undefined,
        },
      });
      if (error) throw error;
      if (data && typeof data === 'object' && 'error' in data && data.error) throw new Error(String(data.error));
      toast.success("Notícia publicada a la web del club!");

    } catch (err) {
      toast.error("Error publicant la notícia: " + (err instanceof Error ? err.message : 'Error desconegut'));
    } finally {
      setPublishing(false);
    }
  }

  return { publishing, publishToWeb };
}
