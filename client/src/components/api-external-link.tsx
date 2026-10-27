'use client';

import { useEffect, useState, type ReactNode } from 'react';

import { getApiBaseUrl } from '@/lib/api-client';

interface ApiExternalLinkProps {
  path: string;
  className: string;
  children: ReactNode;
}

/**
 * Keeps API documentation and healthcheck links on the same LAN host as the
 * page, even when the client was built with a localhost-only API URL.
 */
export function ApiExternalLink({
  path,
  className,
  children,
}: ApiExternalLinkProps) {
  const [href, setHref] = useState<string | null>(null);

  useEffect(() => {
    setHref(`${getApiBaseUrl()}${path}`);
  }, [path]);

  return (
    <a
      href={href ?? undefined}
      target="_blank"
      rel="noreferrer"
      className={className}
    >
      {children}
    </a>
  );
}
