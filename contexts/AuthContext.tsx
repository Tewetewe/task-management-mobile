import React, { createContext, useContext, useEffect, useState } from 'react';
import { authService, LoginCredentials, User } from '../services/authService';
import { notificationService } from '../services/notificationService';
import { taskService } from '../services/taskService';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const isAuth = await authService.isAuthenticated();
      
      if (isAuth) {
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);
        
        try {
          await notificationService.registerForPushNotifications();
          await notificationService.checkDueTasksAndNotify();
          await notificationService.scheduleDailyTaskCheck();
        } catch (notificationError) {
          console.warn('Notification setup failed:', notificationError);
        }
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (credentials: LoginCredentials) => {
    try {
      setLoading(true);
      const response = await authService.login(credentials);
      setUser(response.user);
      
      try {
        await notificationService.registerForPushNotifications();
        await notificationService.checkDueTasksAndNotify();
        await notificationService.scheduleDailyTaskCheck();
      } catch (notificationError) {
        console.warn('Notification setup failed after login:', notificationError);
      }
      
      try {
        await taskService.syncOfflineChanges();
      } catch (syncError) {
        console.warn('Sync failed after login:', syncError);
      }
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      await authService.logout();
      setUser(null);
      await notificationService.cancelAllNotifications();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 