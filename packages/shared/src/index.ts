export type TelegramAuthPayload = {
  id: number;
  auth_date: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  hash: string;
};

export type UserRole = 'admin' | 'staff' | 'viewer';

export type SharedUser = {
  id: string;
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  createdAt: string;
};
