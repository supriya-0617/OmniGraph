export interface UserAccount {
  id: string;
  email: string;
}

export interface AuthState {
  user: UserAccount | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user_email: string;
}

export interface RegisterResponse {
  id: string;
  email: string;
}
