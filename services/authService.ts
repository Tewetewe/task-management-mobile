import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, API_CONFIG } from '../config/api';

const AUTH_TOKEN_KEY = 'auth_token';
const USER_DATA_KEY = 'user_data';

export interface User {
  id: string;
  username: string;
  name: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  status_code: number;
  message: {
    id: string;
    en: string;
  };
  data: {
    access_token: string;
  };
}

export interface LogoutResponse {
  status_code: number;
  message: {
    id: string;
    en: string;
  };
  data: null;
}

class AuthService {
  private apiUrl = API_BASE_URL;

  async login(credentials: LoginCredentials): Promise<{ token: string; user: User }> {
    try {
      const response = await fetch(`${this.apiUrl}${API_CONFIG.ENDPOINTS.AUTH.LOGIN}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      const data: AuthResponse = await response.json();
      
      if (data.status_code !== 200) {
        throw new Error('Login failed');
      }

      const token = data.data.access_token;
      
      const user: User = {
        id: '1',
        username: credentials.username,
        name: credentials.username,
      };
      
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
      await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(user));
      
      return { token, user };
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('Network request failed')) {
        throw new Error('Network connection failed. Please check your internet connection.');
      }
      
      if (error instanceof SyntaxError) {
        throw new Error('Server response error. Please try again.');
      }
      
      throw new Error('Invalid username or password');
    }
  }

  async logout(): Promise<void> {
    try {
      const token = await this.getToken();
      
      if (token) {
        await fetch(`${this.apiUrl}${API_CONFIG.ENDPOINTS.AUTH.LOGOUT}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
      }
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
      await AsyncStorage.removeItem(USER_DATA_KEY);
    }
  }

  async getToken(): Promise<string | null> {
    return await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  }

  async getCurrentUser(): Promise<User | null> {
    const userData = await AsyncStorage.getItem(USER_DATA_KEY);
    return userData ? JSON.parse(userData) : null;
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return token !== null;
  }
}

export const authService = new AuthService(); 