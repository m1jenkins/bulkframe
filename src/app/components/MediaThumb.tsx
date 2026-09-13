import { isVideoType, previewUrl } from '../../lib/images';
import type { ImageCandidate } from '../../lib/types';
import { cx } from '../ui';

export function MediaThumb({
  image,
  className,
  alt,
  controls,
}: {
  image: ImageCandidate;
  className?: string;
  alt?: string;
  controls?: boolean;
}) {
  const classes = cx(className || 'h-full w-full object-cover');
  if (isVideoType(image.type) && (controls || !image.poster)) {
    return (
      <video
        src={image.url}
        poster={image.poster}
        className={classes}
        muted={!controls}
        playsInline
        preload="metadata"
        controls={controls}
      />
    );
  }
  return (
    <img
      src={previewUrl(image)}
      alt={alt || image.alt || image.filename}
      loading="lazy"
      className={classes}
    />
  );
}
