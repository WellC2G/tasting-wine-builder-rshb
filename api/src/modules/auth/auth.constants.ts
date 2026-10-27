export const DEMO_HOST_EMAIL = 'sommelier@tasting.ru';
export const DEMO_HOST_PASSWORD = 'Sommelier2026!';
export const DEMO_HOST_NAME = 'Главный Сомелье';

export const BCRYPT_SALT_ROUNDS = 12;
export const JWT_EXPIRES_IN = '12h';
export const JWT_EXPIRES_IN_SECONDS = 12 * 60 * 60;

export const VPN_PROXY_FORBIDDEN_MESSAGE =
  'Подключение через VPN или прокси запрещено. ' +
  'Используйте прямое подключение к локальной сети Wi-Fi.';

export const GUEST_IP_CHANGED_MESSAGE =
  'Обнаружена смена IP-адреса или использование VPN. ' +
  'Вернитесь к исходному подключению Wi-Fi.';

export const GUEST_SAME_IP_CONFLICT_MESSAGE =
  'С этого IP-адреса уже зарегистрирован участник в данной дегустации. ' +
  'Повторный вход с одного IP запрещён.';
