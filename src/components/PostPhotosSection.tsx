import PostPhotoUploader from './PostPhotoUploader';

interface PostPhotosSectionProps {
  mainPhoto: string | null;
  galleryPhotos: string[];
  onMainPhotoChange: (url: string | null, file: File | null) => void;
  onGalleryAdd: (urls: string[], files: File[]) => void;
  onGalleryRemove: (index: number) => void;
  readOnly?: boolean;
  title?: string;
  description?: string;
}

export default function PostPhotosSection({
  mainPhoto,
  galleryPhotos,
  onMainPhotoChange,
  onGalleryAdd,
  onGalleryRemove,
  readOnly = false,
  title = 'Fotos del post',
  description = 'Afegeix una foto principal i una galeria abans de generar el post.',
}: PostPhotosSectionProps) {
  return (
    <section
      data-post-photos-section="true"
      className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4 space-y-3"
    >
      <div className="space-y-1">
        <h3 className="font-display text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-xs font-sans text-muted-foreground">{description}</p>
      </div>

      <PostPhotoUploader
        mainPhoto={mainPhoto}
        galleryPhotos={galleryPhotos}
        onMainPhotoChange={onMainPhotoChange}
        onGalleryAdd={onGalleryAdd}
        onGalleryRemove={onGalleryRemove}
        readOnly={readOnly}
      />
    </section>
  );
}