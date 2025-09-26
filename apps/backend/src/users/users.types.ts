export type UserRole = 'admin' | 'staff' | 'viewer';

export type UserEntity = {
  id: string;
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  photoUrl?: string;
  role: UserRole;
  createdAt: Date;
};
