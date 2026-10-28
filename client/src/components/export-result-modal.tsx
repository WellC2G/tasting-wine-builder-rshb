'use client';

import { CheckCircle2, Download } from 'lucide-react';

import { Modal } from '@/components/modal';
import type { ExportResponse } from '@/types/api';

interface ExportResultModalProps {
  open: boolean;
  onClose: () => void;
  result: ExportResponse | null;
  eventId: string;
}

export function ExportResultModal({
  open,
  onClose,
  result,
  eventId,
}: ExportResultModalProps) {
  const downloadPayload = () => {
    if (!result) {
      return;
    }

    const blob = new Blob(
      [JSON.stringify(result.dispatchedPayload, null, 2)],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `tasting-export-${eventId}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Выгрузка в Народный рейтинг"
      size="lg"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/10 px-5 text-sm text-stone-300 transition hover:bg-white/5"
          >
            Закрыть
          </button>
          <button
            type="button"
            onClick={downloadPayload}
            disabled={!result}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-stone-950 transition hover:bg-stone-200 disabled:opacity-50"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Скачать JSON
          </button>
        </div>
      }
    >
      {result ? (
        <div data-testid="export-result" className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 text-xs font-medium text-emerald-200">
              <CheckCircle2
                className="h-3.5 w-3.5"
                aria-hidden="true"
              />
              {result.exportMeta.status === 'MOCK_SUCCESS'
                ? 'Принято имитационным приёмником'
                : 'Выгружено'}
            </span>
            <span className="text-xs text-stone-500">
              {result.exportMeta.simulationMode
                ? 'Демонстрационный режим'
                : 'Внешний приёмник'}
            </span>
          </div>

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <dt className="text-xs text-stone-500">Квитанция</dt>
              <dd className="mt-1 break-all font-mono text-xs text-stone-200">
                {result.exportMeta.mockReceiptId ?? 'Не возвращена'}
              </dd>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <dt className="text-xs text-stone-500">
                Адрес назначения
              </dt>
              <dd className="mt-1 break-all text-xs text-stone-200">
                {result.exportMeta.targetEndpoint}
              </dd>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <dt className="text-xs text-stone-500">
                Валидных оценок
              </dt>
              <dd className="mt-1 font-semibold text-white">
                {result.exportMeta.validVotesCount}
              </dd>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <dt className="text-xs text-stone-500">Выбросов</dt>
              <dd className="mt-1 font-semibold text-white">
                {result.exportMeta.rejectedOutliersCount}
              </dd>
            </div>
          </dl>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-stone-300">
                Пакет выгрузки
              </p>
              <span className="font-mono text-[11px] text-stone-600">
                {result.dispatchedPayload.samples.length} обр.
              </span>
            </div>
            <pre className="max-h-72 overflow-auto rounded-2xl border border-white/10 bg-stone-950 p-4 font-mono text-[11px] leading-5 text-stone-300">
              {JSON.stringify(result.dispatchedPayload, null, 2)}
            </pre>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
