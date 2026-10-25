const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const features = [
  {
    tag: 'PARKER_100',
    title: 'Шкала Роберта Паркера',
    description:
      'Пятьдесят базовых баллов и четыре критерия: внешний вид, аромат, вкус и потенциал. Итоговая оценка автоматически определяет категорию качества.',
  },
  {
    tag: 'BLIND',
    title: 'Синхронная слепая подача',
    description:
      'Комнаты Socket.io удерживают все устройства в одном ритме. Название, винодельня и цена скрыты до команды ведущего «Раскрыть образец».',
  },
  {
    tag: '2σ',
    title: 'Фильтрация выбросов',
    description:
      'Начиная с пяти оценок значения за пределами интервала двух сигм помечаются как выбросы и исключаются из итоговых расчётов и выгрузки.',
  },
  {
    tag: 'EXPORT',
    title: 'Выгрузка в Народный рейтинг',
    description:
      'Сформированный пакет оценок отправляется в mock-приёмник, получает квитанцию и сохраняется целиком в журнале экспорта.',
  },
];

const sampleBreakdown = [
  { label: 'Внешний вид', value: 4, max: 5 },
  { label: 'Аромат', value: 14, max: 15 },
  { label: 'Вкус и послевкусие', value: 17, max: 20 },
  { label: 'Потенциал', value: 7, max: 10 },
];

const services = [
  {
    name: 'client',
    stack: 'Next.js 14 · standalone',
    port: '3000',
    description:
      'Мобильный пульт ведущего, презентационный экран и анкета участника.',
  },
  {
    name: 'api',
    stack: 'NestJS 10 · Socket.io',
    port: '4000',
    description:
      'REST API с версионированием, real-time шлюз, healthcheck и документация OpenAPI.',
  },
  {
    name: 'postgres',
    stack: 'PostgreSQL 16 Alpine',
    port: '5432',
    description:
      'Надёжное реляционное хранилище на именованном томе pgdata.',
  },
];

export default function HomePage() {
  return (
    <main className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[560px] bg-gradient-to-b from-wine-900/40 via-stone-950/0 to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[-220px] h-[440px] w-[780px] -translate-x-1/2 rounded-full bg-wine-700/20 blur-3xl"
      />

      <div className="relative mx-auto w-full max-w-6xl px-5 pb-12 pt-6 sm:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/favicon.svg"
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 rounded-xl"
            />
            <div>
              <p className="text-sm font-semibold tracking-tight">
                Конструктор дегустаций
              </p>
              <p className="text-xs text-stone-400">
                Шкала Роберта Паркера · слепой режим
              </p>
            </div>
          </div>
          <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-wine-500/30 bg-wine-500/10 px-3 py-1 text-xs font-medium text-wine-200">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-emerald-400"
            />
            Этап 4 · оценки и live-статистика
          </span>
        </header>

        <section className="grid gap-12 pb-16 pt-14 lg:grid-cols-[1.12fr_0.88fr] lg:items-center lg:pt-24">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-wine-300">
              Платформа для проведения дегустаций
            </p>
            <h1 className="mt-5 text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Слепая дегустация,
              <span className="block bg-gradient-to-r from-wine-200 via-wine-300 to-wine-500 bg-clip-text text-transparent">
                продуманная до деталей.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-stone-300 sm:text-lg">
              Составьте программу дегустации, проведите синхронные слепые
              раунды с телефона и опубликуйте статистически выверенные
              результаты. Всё приложение запускается одной командой.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href={`${apiUrl}/api/docs`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-wine-600 px-5 text-sm font-semibold text-white transition hover:bg-wine-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wine-300"
              >
                Документация API
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  className="h-4 w-4"
                >
                  <path
                    d="M7 4.5h8.5V13M15.5 4.5 5 15"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
              <a
                href={`${apiUrl}/api/v1/health`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-5 text-sm font-semibold text-stone-100 transition hover:border-white/25 hover:bg-white/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wine-300"
              >
                Проверить состояние API
              </a>
            </div>

            <dl className="mt-10 grid max-w-xl grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
              {[
                ['3', 'контейнера'],
                ['1', 'команда'],
                ['100', 'баллов'],
                ['2σ', 'правило выбросов'],
              ].map(([value, label]) => (
                <div key={label}>
                  <dt className="text-2xl font-semibold tracking-tight text-stone-100">
                    {value}
                  </dt>
                  <dd className="mt-1 text-xs uppercase tracking-[0.14em] text-stone-500">
                    {label}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <aside className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-glow backdrop-blur sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                  Пример оценки
                </p>
                <p className="mt-1 text-sm text-stone-300">
                  Образец №3 · слепой раунд
                </p>
              </div>
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
                ВЫДАЮЩЕЕСЯ
              </span>
            </div>

            <div className="mt-6 flex items-end gap-3">
              <span className="text-7xl font-semibold tracking-tighter text-wine-200">
                92
              </span>
              <span className="pb-3 text-sm text-stone-500">из 100</span>
            </div>
            <p className="mt-1 text-sm text-stone-400">
              Выдающееся вино · 90–94 балла
            </p>

            <div className="mt-7 space-y-4">
              {sampleBreakdown.map((criterion) => (
                <div key={criterion.label}>
                  <div className="flex items-baseline justify-between gap-3 text-xs">
                    <span className="text-stone-300">{criterion.label}</span>
                    <span className="font-mono text-stone-500">
                      {criterion.value}/{criterion.max}
                    </span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label={`Оценка: ${criterion.label}`}
                    aria-valuemin={0}
                    aria-valuemax={criterion.max}
                    aria-valuenow={criterion.value}
                    className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"
                  >
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-wine-500 to-wine-300"
                      style={{
                        width: `${(criterion.value / criterion.max) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-7 rounded-2xl border border-white/10 bg-stone-950/60 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">
                Формула Паркера
              </p>
              <p className="mt-2 font-mono text-xs leading-6 text-stone-300">
                50 + 4 + 14 + 17 + 7 = 92
              </p>
            </div>
          </aside>
        </section>

        <section
          id="features"
          className="border-t border-white/5 py-16 sm:py-20"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-wine-300">
            Ключевые механики
          </p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <h2 className="max-w-xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              В центре внимания — вино, а не этикетка.
            </h2>
            <p className="max-w-md text-sm leading-6 text-stone-400">
              Возможности соответствуют архитектурной спецификации. На четвёртом
              этапе добавлены оценки по Паркеру и live-статистика;
              экспорт и клиентские экраны появятся дальше.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {features.map((feature) => (
              <article
                key={feature.tag}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-wine-500/30 hover:bg-white/[0.05]"
              >
                <span className="inline-flex rounded-lg border border-wine-400/25 bg-wine-500/10 px-2.5 py-1 font-mono text-[11px] font-medium tracking-wide text-wine-200">
                  {feature.tag}
                </span>
                <h3 className="mt-5 text-lg font-semibold tracking-tight">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-stone-400">
                  {feature.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section
          id="runtime"
          className="border-t border-white/5 py-16 sm:py-20"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-wine-300">
                Структура приложения
              </p>
              <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                Три сервиса, одна сеть.
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-stone-400">
              Сначала становится готовой PostgreSQL, затем запускается API, а
              после успешной проверки — клиент. Все сервисы общаются внутри
              bridge-сети.
            </p>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {services.map((service, index) => (
              <article
                key={service.name}
                className="flex flex-col rounded-2xl border border-white/10 bg-stone-900/40 p-6"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-xs text-stone-500">
                    0{index + 1}
                  </span>
                  <span className="rounded-md border border-white/10 bg-white/[0.05] px-2 py-1 font-mono text-[11px] text-stone-300">
                    :{service.port}
                  </span>
                </div>
                <h3 className="mt-6 font-mono text-lg font-semibold text-stone-100">
                  {service.name}
                </h3>
                <p className="mt-1 text-xs uppercase tracking-[0.12em] text-wine-300">
                  {service.stack}
                </p>
                <p className="mt-4 text-sm leading-6 text-stone-400">
                  {service.description}
                </p>
              </article>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-wine-500/25 bg-wine-950/20 px-5 py-4">
            <p className="font-mono text-xs text-stone-300">
              сеть: tasting_net
            </p>
            <p className="text-xs uppercase tracking-[0.14em] text-stone-500">
              драйвер bridge · внутренний DNS
            </p>
          </div>
        </section>

        <section className="pb-16 pt-2 sm:pb-20">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-wine-950/60 via-stone-900/70 to-stone-950 p-6 sm:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-wine-300">
              Быстрый старт
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Одна команда. Всё приложение.
            </h2>
            <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10 bg-stone-950/80 p-4">
              <pre className="font-mono text-xs leading-6 text-stone-300 sm:text-sm">
                <code>
                  {'cp .env.example .env\n'}
                  {'docker compose up --build'}
                </code>
              </pre>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a
                href={`${apiUrl}/api/docs`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-stone-950 transition hover:bg-stone-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Изучить API
              </a>
              <a
                href={`${apiUrl}/api/v1/health`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/15 px-5 text-sm font-semibold text-stone-100 transition hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wine-300"
              >
                Проверить стек
              </a>
            </div>
          </div>
        </section>

        <footer className="flex flex-col gap-3 border-t border-white/5 py-8 text-xs text-stone-500 sm:flex-row sm:items-center sm:justify-between">
          <p>Конструктор дегустаций · этап 4</p>
          <p className="font-mono">
            Next.js 14 · NestJS 10 · PostgreSQL 16
          </p>
        </footer>
      </div>
    </main>
  );
}
