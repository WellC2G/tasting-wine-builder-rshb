'use client';

import { useEffect, useState } from 'react';
import { Wine as WineIcon } from 'lucide-react';

import { cn } from '@/lib/cn';

interface WineImageProps {
  src: string | null;
  alt: string;
  className?: string;
  iconClassName?: string;
}

export function WineImage({
  src,
  alt,
  className,
  iconClassName,
}: WineImageProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={alt}
        className={cn('h-full w-full rounded-2xl object-cover', className)}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <WineIcon
      className={cn('h-10 w-10', iconClassName)}
      strokeWidth={1.2}
      aria-hidden="true"
    />
  );
}
