import { WineType } from '../entities/wine.entity';

export interface RussianWineSeed {
  externalCatalogId: string;
  name: string;
  winery: string;
  region: string;
  grapeVarieties: string;
  vintage: number;
  wineType: WineType;
  retailPrice: number;
  imageUrl: string | null;
}

/**
 * Curated starter catalog of prominent Russian wines.
 * External ids are stable slugs used when mapping samples for export.
 */
export const RUSSIAN_WINES: readonly RussianWineSeed[] = [
  {
    externalCatalogId: 'ru-wine-krasnostop-zolotovsky-vedernikov-2022',
    name: 'Красностоп Золотовский',
    winery: 'Винодельня Ведерниковъ',
    region: 'Долина Дона',
    grapeVarieties: 'Красностоп Золотовский 100%',
    vintage: 2022,
    wineType: WineType.RED,
    retailPrice: 3490,
    imageUrl: null,
  },
  {
    externalCatalogId: 'ru-wine-sibirkovy-vedernikov-2023',
    name: 'Сибирьковый',
    winery: 'Винодельня Ведерниковъ',
    region: 'Долина Дона',
    grapeVarieties: 'Сибирьковый 100%',
    vintage: 2023,
    wineType: WineType.WHITE,
    retailPrice: 2890,
    imageUrl: null,
  },
  {
    externalCatalogId: 'ru-wine-saperavi-myskhako-2022',
    name: 'Саперави',
    winery: 'Мысхако',
    region: 'Кубань',
    grapeVarieties: 'Саперави 100%',
    vintage: 2022,
    wineType: WineType.RED,
    retailPrice: 2190,
    imageUrl: null,
  },
  {
    externalCatalogId: 'ru-wine-avtohton-fantom-uppa-2021',
    name: 'Автохтон Фантом',
    winery: 'Uppa Winery',
    region: 'Крым',
    grapeVarieties: 'Бастардо, Саперави, Кефесия',
    vintage: 2021,
    wineType: WineType.RED,
    retailPrice: 4590,
    imageUrl: null,
  },
  {
    externalCatalogId: 'ru-wine-risling-semigorye-2023',
    name: 'Рислинг Семигорье',
    winery: 'Семигорье',
    region: 'Кубань',
    grapeVarieties: 'Рислинг 100%',
    vintage: 2023,
    wineType: WineType.WHITE,
    retailPrice: 2590,
    imageUrl: null,
  },
  {
    externalCatalogId: 'ru-wine-pinot-noir-sikory-2022',
    name: 'Пино Нуар',
    winery: 'Имение Сикоры',
    region: 'Севастополь',
    grapeVarieties: 'Пино Нуар 100%',
    vintage: 2022,
    wineType: WineType.RED,
    retailPrice: 4290,
    imageUrl: null,
  },
  {
    externalCatalogId: 'ru-wine-tsimlyansky-cherny-2021',
    name: 'Цимлянский чёрный',
    winery: 'Цимлянские вина',
    region: 'Долина Дона',
    grapeVarieties: 'Цимлянский чёрный 100%',
    vintage: 2021,
    wineType: WineType.RED,
    retailPrice: 1890,
    imageUrl: null,
  },
  {
    externalCatalogId: 'ru-wine-rkatsiteli-fanagoria-2023',
    name: 'Ркацители',
    winery: 'Фанагория',
    region: 'Кубань',
    grapeVarieties: 'Ркацители 100%',
    vintage: 2023,
    wineType: WineType.WHITE,
    retailPrice: 1790,
    imageUrl: null,
  },
  {
    externalCatalogId: 'ru-wine-kokur-perovskih-2023',
    name: 'Кокур',
    winery: 'Усадьба Перовских',
    region: 'Крым',
    grapeVarieties: 'Кокур 100%',
    vintage: 2023,
    wineType: WineType.WHITE,
    retailPrice: 2690,
    imageUrl: null,
  },
  {
    externalCatalogId: 'ru-wine-bastardo-alma-valley-2021',
    name: 'Бастардо',
    winery: 'Alma Valley',
    region: 'Крым',
    grapeVarieties: 'Бастардо 100%',
    vintage: 2021,
    wineType: WineType.RED,
    retailPrice: 3990,
    imageUrl: null,
  },
  {
    externalCatalogId: 'ru-wine-cabernet-fran-lefkadia-2022',
    name: 'Каберне Фран',
    winery: 'Lefkadia',
    region: 'Кубань',
    grapeVarieties: 'Каберне Фран 100%',
    vintage: 2022,
    wineType: WineType.RED,
    retailPrice: 4990,
    imageUrl: null,
  },
  {
    externalCatalogId: 'ru-wine-brut-risling-abrau-2021',
    name: 'Брют Рислинг',
    winery: 'Абрау-Дюрсо',
    region: 'Кубань',
    grapeVarieties: 'Рислинг 100%',
    vintage: 2021,
    wineType: WineType.SPARKLING,
    retailPrice: 2390,
    imageUrl: null,
  },
  {
    externalCatalogId: 'ru-wine-rose-krasnostop-vedernikov-2023',
    name: 'Красностоп Золотовский Розе',
    winery: 'Винодельня Ведерниковъ',
    region: 'Долина Дона',
    grapeVarieties: 'Красностоп Золотовский 100%',
    vintage: 2023,
    wineType: WineType.ROSE,
    retailPrice: 2990,
    imageUrl: null,
  },
  {
    externalCatalogId: 'ru-wine-muskat-krasny-kamen-massandra-2018',
    name: 'Мускат белый Красного камня',
    winery: 'Массандра',
    region: 'Крым',
    grapeVarieties: 'Мускат белый 100%',
    vintage: 2018,
    wineType: WineType.FORTIFIED,
    retailPrice: 5490,
    imageUrl: null,
  },
];
