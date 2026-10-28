'use client';

import { useEffect, useState } from 'react';
import { ImagePlus, Loader2, RefreshCw, Trash2, Wine } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

import { cn } from '@/lib/cn';

interface ImageUploaderProps {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  className?: string;
}

const MAX_DIMENSION = 800;
const JPEG_QUALITY = 0.82;
const MAX_FILE_SIZE = 20 * 1024 * 1024;

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error('Не удалось прочитать изображение'));
    image.src = source;
  });
}

async function compressImage(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);
    const scale = Math.min(
      1,
      MAX_DIMENSION / Math.max(image.width, image.height),
    );
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement('canvas');

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Canvas недоступен в этом браузере');
    }

    context.drawImage(image, 0, 0, width, height);

    const outputType =
      file.type === 'image/jpeg' ? 'image/jpeg' : 'image/webp';

    return canvas.toDataURL(outputType, JPEG_QUALITY);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function ImageUploader({
  value,
  onChange,
  disabled = false,
  className,
}: ImageUploaderProps) {
  const [processing, setProcessing] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);

  useEffect(() => {
    setPreviewError(false);
  }, [value]);

  const handleFiles = async (files: File[]): Promise<void> => {
    const file = files[0];

    if (!file) {
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setDropError('Поддерживаются JPEG, PNG и WebP');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setDropError('Файл слишком большой. Максимум 20 МБ');
      return;
    }

    setDropError(null);
    setProcessing(true);

    try {
      onChange(await compressImage(file));
    } catch {
      setDropError('Не удалось обработать изображение');
    } finally {
      setProcessing(false);
    }
  };

  const { getRootProps, getInputProps, open } = useDropzone({
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    },
    maxFiles: 1,
    multiple: false,
    disabled: disabled || processing,
    noClick: Boolean(value),
    noKeyboard: Boolean(value),
    onDrop: (files) => {
      void handleFiles(files);
    },
  });

  return (
    <div className={cn('space-y-2', className)}>
      <div
        {...getRootProps()}
        className={cn(
          'relative flex min-h-44 flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-white/15 bg-stone-950/50 p-3 text-center transition',
          !disabled && !processing && 'cursor-pointer hover:border-wine-400/40',
          disabled && 'opacity-60',
        )}
      >
        <input {...getInputProps()} />
        {value && !previewError ? (
          <>
            <img
              src={value}
              alt="Предпросмотр вина"
              className="h-40 w-full rounded-xl object-cover"
              onError={() => setPreviewError(true)}
            />
            <div className="mt-2 flex w-full gap-2">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  open();
                }}
                disabled={disabled || processing}
                className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-medium text-stone-200 transition hover:bg-white/5 disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Заменить
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onChange(null);
                  setPreviewError(false);
                }}
                disabled={disabled || processing}
                className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-rose-400/20 px-3 text-xs font-medium text-rose-200 transition hover:bg-rose-400/10 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Удалить фото
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-wine-400/20 bg-wine-500/10 text-wine-300">
              {processing ? (
                <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
              ) : (
                <Wine className="h-9 w-9" strokeWidth={1.2} aria-hidden="true" />
              )}
            </div>
            <p className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-stone-200">
              <ImagePlus className="h-4 w-4" aria-hidden="true" />
              {processing
                ? 'Обрабатываем изображение…'
                : 'Перетащите фото или нажмите'}
            </p>
            <p className="mt-1 text-xs text-stone-500">
              JPEG, PNG или WebP · до 20 МБ · сжатие до 800px
            </p>
            {previewError ? (
              <p className="mt-2 text-xs text-amber-200">
                Предпросмотр недоступен, выберите другое фото
              </p>
            ) : null}
          </>
        )}
      </div>
      {dropError ? (
        <p role="alert" className="text-xs text-rose-300">
          {dropError}
        </p>
      ) : null}
    </div>
  );
}
