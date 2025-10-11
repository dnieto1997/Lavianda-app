// types/auth.ts
export type UserRole = 'admin' | 'guest' | 'empleado' | 'root';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  cedula?: string; // ✅ Agregar cédula
  profile_photo_url?: string; // ✅ Agregar foto de perfil
}

export interface AuthenticatedUser {
  token: string;
  userData: User;
  // Propiedades de acceso directo para facilitar el uso
  name?: string;
  cedula?: string;
  email?: string;
  role?: UserRole;
}

export interface AuthContextType {
  signIn: (user: User, token: string) => void;
  signOut: () => void;
  user: AuthenticatedUser | null;
}