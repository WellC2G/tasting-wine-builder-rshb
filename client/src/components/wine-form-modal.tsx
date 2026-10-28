'use client';

import { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';

import { ImageUploader } from '@/components/image-uploader';
import { Modal } from '@/components/modal';
import {
  ApiError,
  apiClient,
  getApiErrorMessage,
} from '@/lib/api-client';
import { clearHostSession } from '@/lib/session';
import { WINE_TYPE_LABELS } from '@/lib/format';
import type { Wine, WineInput, WineType } from '@/types/api';

interface WineFormModalProps {
  open: boolean;
  wine: Wine | null;
  onClose: () => void;
  onSaved: (wine: Wine) => void;
}

const WINE_TYPES: WineType[] = [
  'RED',
  'WHITE',
  'ROSE',
  'SPARKLING',
  'FORTIFIED',
];

export function WineFormModal({
  open,
  wine,
  onClose,
  onSaved,
}: WineFormModalProps) {
  const [name, setName] = useState('');
  const [winery, setWinery] = useState('');
  const [region, setRegion] = useState('');
  const [grapeVarieties, setGrapeVarieties] = useState('');
  const [vintage, setVintage] = useState('2022');
  const [wineType, setWineType] = useState<WineType>('RED');
  const [retailPrice, setRetailPrice] = useState('0');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setName(wine?.name ?? '');
    setWinery(wine?.winery ?? '');
    setRegion(wine?.region ?? '');
    setGrapeVarieties(wine?.grapeVarieties ?? '');
    setVintage(String(wine?.vintage ?? 2022));
    setWineType(wine?.wineType ?? 'RED');
    setRetailPrice(String(wine?.retailPrice ?? 0));
    setImageUrl(wine?.imageUrl ?? null);
    setError(null);
  }, [open, wine]);

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const input: WineInput = {
      name: name.trim(),
      winery: winery.trim(),
      region: region.trim(),
      grapeVarieties: grapeVarieties.trim(),
      vintage: Number(vintage),
      wineType,
      retailPrice: Number(retailPrice),
      imageUrl,
    };

    try {
      const saved = wine
        ? await apiClient.catalog.update(wine.id, input)
        : await apiClient.catalog.create(input);

      onSaved(saved);
      onClose();
    } catch (submitError) {
      if (
        submitError instanceof ApiError &&
        submitError.status === 401
      ) {
        clearHostSession();
        window.location.href = '/host/login';
        return;
      }

      setError(getApiErrorMessage(submitError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={wine ? 'Редактировать вино' : 'Добавить вино'}
      size="lg"
    >
      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="mb-2 block text-sm font-medium text-stone-300">
              Название вина
            </span>
            <input
              data-testid="wine-name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={255}
              className="min-h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-base text-white outline-none focus:border-wine-400/60"
            />
          </label>

          <label>
            <span className="mb-2 block text-sm font-medium text-stone-300">
              Винодельня
            </span>
            <input
              data-testid="wine-winery"
              required
              value={winery}
              onChange={(event) => setWinery(event.target.value)}
              maxLength={255}
              className="min-h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-base text-white outline-none focus:border-wine-400/60"
            />
          </label>

          <label>
            <span className="mb-2 block text-sm font-medium text-stone-300">
              Регион
            </span>
            <input
              data-testid="wine-region"
              required
              value={region}
              onChange={(event) => setRegion(event.target.value)}
              maxLength={120}
              className="min-h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-base text-white outline-none focus:border-wine-400/60"
            />
          </label>

          <label className="sm:col-span-2">
            <span className="mb-2 block text-sm font-medium text-stone-300">
              Сортовой состав
            </span>
            <input
              data-testid="wine-grapes"
              required
              value={grapeVarieties}
              onChange={(event) => setGrapeVarieties(event.target.value)}
              maxLength={255}
              className="min-h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-base text-white outline-none focus:border-wine-400/60"
            />
          </label>

          <label>
            <span className="mb-2 block text-sm font-medium text-stone-300">
              Год урожая
            </span>
            <input
              data-testid="wine-vintage"
              required
              type="number"
              min={1800}
              max={2100}
              value={vintage}
              onChange={(event) => setVintage(event.target.value)}
              className="min-h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-base text-white outline-none focus:border-wine-400/60"
            />
          </label>

          <label>
            <span className="mb-2 block text-sm font-medium text-stone-300">
              Тип вина
            </span>
            <select
              data-testid="wine-type"
              value={wineType}
              onChange={(event) =>
                setWineType(event.target.value as WineType)
              }
              className="min-h-12 w-full rounded-xl border border-white/10 bg-stone-950 px-4 text-base text-white outline-none focus:border-wine-400/60"
            >
              {WINE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {WINE_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-2 block text-sm font-medium text-stone-300">
              Розничная цена, ₽
            </span>
            <input
              data-testid="wine-price"
              required
              type="number"
              min={0}
              step="0.01"
              value={retailPrice}
              onChange={(event) => setRetailPrice(event.target.value)}
              className="min-h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-base text-white outline-none focus:border-wine-400/60"
            />
          </label>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-stone-300">
            Фотография вина
          </p>
          <ImageUploader
            value={imageUrl}
            onChange={setImageUrl}
            disabled={saving}
          />
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-200"
          >
            {error}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/10 px-5 text-sm text-stone-300 transition hover:bg-white/5"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-wine-600 px-5 text-sm font-semibold text-white transition hover:bg-wine-500 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="h-4 w-4" aria-hidden="true" />
            )}
            {saving ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
