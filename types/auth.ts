// types/auth.ts
export type UserRole = 'admin' | 'guest' | 'empleado' | 'root';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  profile_photo_url?: string; // ✅ Agregar foto de perfil
}

export interface AuthenticatedUser {
  token: string;
  userData: User;
}

export interface AuthContextType {
  signIn: (user: User, token: string) => void;
  signOut: () => void;
  user: AuthenticatedUser | null;
}