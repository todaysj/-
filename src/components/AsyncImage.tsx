import React, { useState, useEffect } from 'react';
import { getPhotoLocal } from '../utils/photoStore';

interface AsyncImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  fallbackIcon?: React.ReactNode;
  skeletonClassName?: string;
}

export const AsyncImage: React.FC<AsyncImageProps> = ({
  src,
  alt = '',
  className = '',
  fallbackIcon,
  skeletonClassName,
  ...props
}) => {
  const [resolvedSrc, setResolvedSrc] = useState<string>(() => {
    if (src && !src.startsWith('photo://')) return src;
    return '';
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    return Boolean(src && src.startsWith('photo://'));
  });
  const [hasError, setHasError] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    if (!src) {
      setResolvedSrc('');
      setIsLoading(false);
      return;
    }

    if (src.startsWith('photo://')) {
      setIsLoading(true);
      setHasError(false);
      const photoId = src.replace('photo://', '');
      getPhotoLocal(photoId)
        .then((dataUrl) => {
          if (!isMounted) return;
          if (dataUrl) {
            setResolvedSrc(dataUrl);
            setIsLoading(false);
          } else {
            setHasError(true);
            setIsLoading(false);
          }
        })
        .catch(() => {
          if (!isMounted) return;
          setHasError(true);
          setIsLoading(false);
        });
    } else {
      setResolvedSrc(src);
      setIsLoading(false);
      setHasError(false);
    }

    return () => {
      isMounted = false;
    };
  }, [src]);

  if (isLoading || (!resolvedSrc && !hasError && src)) {
    return <div className={`bg-slate-200 animate-pulse ${skeletonClassName || className}`} />;
  }

  if (hasError || !resolvedSrc) {
    if (fallbackIcon) {
      return <div className={`flex items-center justify-center bg-slate-100 ${className}`}>{fallbackIcon}</div>;
    }
    return <div className={`bg-slate-200 ${className}`} />;
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      className={className}
      onError={() => setHasError(true)}
      {...props}
    />
  );
};
