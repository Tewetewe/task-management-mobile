import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { notificationService } from '../services/notificationService';
import { taskService } from '../services/taskService';

function AppNavigator() {
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    let isMounted = true;

    const setupNotifications = async () => {
      if (!isAuthenticated) return;

      try {
        await notificationService.registerForPushNotifications();
      } catch (error) {
        console.error('Error setting up notifications:', error);
      }
    };

    const notificationListener = notificationService.addNotificationReceivedListener(
      (notification) => {
        console.log('Notification received:', notification);
      }
    );

    const responseListener = notificationService.addNotificationResponseReceivedListener(
      (response) => {
        console.log('Notification response received:', response);
        if (response.notification.request.content.data?.type === 'task_due') {
          console.log('User tapped on task due notification');
        }
      }
    );

    const handleAppStateChange = async (nextAppState: string) => {
      if (!isMounted || !isAuthenticated) return;

      if (nextAppState === 'active') {
        try {
          await taskService.syncOfflineChanges();
          await notificationService.forceCheckDueTasks();
        } catch (error) {
          console.error('Error during app state change handling:', error);
        }
      }
    };

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    if (isAuthenticated) {
      setupNotifications();
    }

    return () => {
      isMounted = false;
      notificationListener && Notifications.removeNotificationSubscription(notificationListener);
      responseListener && Notifications.removeNotificationSubscription(responseListener);
      appStateSubscription?.remove();
      
      if (!isAuthenticated) {
        notificationService.cleanup();
      }
    };
  }, [isAuthenticated]);

  if (loading) {
    return null;
  }

  return (
    <Stack>
      {!isAuthenticated ? (
        <Stack.Screen 
          name="login" 
          options={{ 
            headerShown: false,
            gestureEnabled: false 
          }} 
        />
      ) : (
        <Stack.Screen 
          name="(tabs)" 
          options={{ 
            headerShown: false,
            gestureEnabled: false
          }} 
        />
      )}
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) {
    return null;
  }

  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AppNavigator />
        <StatusBar style="auto" />
      </ThemeProvider>
    </AuthProvider>
  );
}
