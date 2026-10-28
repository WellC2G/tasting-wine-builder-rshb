export const TASTING_NAMESPACE = '/tasting';
export const TASTING_ROOM_PREFIX = 'tasting_';

export const AUTH_ERROR_MESSAGE =
  'Ошибка авторизации: недействительный токен';
export const AUTH_REQUIRED_MESSAGE = 'Требуется авторизация';
export const SESSION_ACCESS_DENIED_MESSAGE =
  'Недостаточно прав для управления сессией';
export const SESSION_CONNECTION_ERROR_MESSAGE =
  'Ошибка подключения к сессии дегустации';
export const SESSION_ACTION_ERROR_MESSAGE =
  'Не удалось выполнить действие';
export const INVALID_ACTION_PAYLOAD_MESSAGE =
  'Некорректные параметры действия';
export const EVENT_NOT_FOUND_MESSAGE = 'Мероприятие не найдено';
export const ROUND_NOT_FOUND_MESSAGE = 'Раунд не найден';
export const TIMER_EXPIRED_MESSAGE =
  'Время раунда истекло, голосование закрыто';
export const VOTING_CLOSED_BY_HOST_MESSAGE =
  'Голосование закрыто ведущим';
export const BOTTLE_REVEALED_MESSAGE = 'Карточка образца раскрыта!';
export const STATS_OPENED_MESSAGE =
  'Статистика образца открыта сомелье';

export function tastingRoom(eventId: string): string {
  return `${TASTING_ROOM_PREFIX}${eventId}`;
}
