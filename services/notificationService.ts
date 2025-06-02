import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { taskService } from './taskService';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

class NotificationService {
  private expoPushToken: string | null = null;
  private appStateSubscription: any = null;
  private lastNotificationCheck: Date | null = null;
  private localNotificationsOnly: boolean = false;

  async registerForPushNotifications(): Promise<string | null> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        return null;
      }
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return null;
    }

    // Setup Android channel
    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Task Manager',
          description: 'Notifications for task management',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#3b82f6',
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          bypassDnd: false,
        });
      } catch (error) {
        console.error('Error creating Android notification channel:', error);
      }
    }

    let token: string | null = null;
    
    if (Device.isDevice) {
      try {
        const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
        if (!projectId) {
          this.localNotificationsOnly = true;
        } else {
          token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
          this.expoPushToken = token;
        }
      } catch (error) {
        this.localNotificationsOnly = true;
        token = 'local_notifications_only';
        this.expoPushToken = token;
      }
    } else {
      this.localNotificationsOnly = true;
      token = 'simulator_local_notifications';
      this.expoPushToken = token;
    }

    this.setupAppStateMonitoring();
    return token;
  }

  private setupAppStateMonitoring(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }

    this.appStateSubscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        this.handleAppBecameActive();
      }
    });

    this.handleAppBecameActive();
  }

  private async handleAppBecameActive(): Promise<void> {
    try {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      
      // 5min cooldown to prevent spam
      if (this.lastNotificationCheck && this.lastNotificationCheck > fiveMinutesAgo) {
        return;
      }

      this.lastNotificationCheck = now;
      await this.checkDueTasksAndNotify();
    } catch (error) {
      console.error('Error handling app became active:', error);
    }
  }

  async checkDueTasksAndNotify(): Promise<void> {
    try {
      const dueTasks = await taskService.getDueTasks();
      
      if (dueTasks.length > 0) {
        const title = dueTasks.length === 1 
          ? '📅 Task Due Today!' 
          : `📅 ${dueTasks.length} Tasks Due Today!`;
        
        const body = dueTasks.length === 1
          ? `"${dueTasks[0].title}" is due today`
          : `You have ${dueTasks.length} tasks due today.`;

        await this.scheduleImmediateNotification(title, body);
        
        // Set iOS badge
        if (Platform.OS === 'ios') {
          try {
            await Notifications.setBadgeCountAsync(dueTasks.length);
          } catch (error) {
            // Not supported
          }
        }
      } else {
        if (Platform.OS === 'ios') {
          try {
            await Notifications.setBadgeCountAsync(0);
          } catch (error) {
            // Not supported
          }
        }
      }
    } catch (error) {
      console.error('Error checking due tasks:', error);
    }
  }

  async scheduleImmediateNotification(title: string, body: string): Promise<string> {
    try {
      const notificationRequest: Notifications.NotificationRequestInput = {
        content: {
          title,
          body,
          sound: 'default',
          data: { 
            type: 'task_due',
            timestamp: new Date().toISOString()
          },
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null,
      };

      const notificationId = await Notifications.scheduleNotificationAsync(notificationRequest);
      return notificationId;
    } catch (error) {
      return 'mock_notification_id_' + Date.now();
    }
  }

  async scheduleLocalNotification(title: string, body: string, trigger?: Date): Promise<string> {
    try {
      const notificationRequest: Notifications.NotificationRequestInput = {
        content: {
          title,
          body,
          sound: 'default',
          data: { type: 'task_due' },
        },
        trigger: trigger ? { 
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: trigger 
        } : null,
      };

      return await Notifications.scheduleNotificationAsync(notificationRequest);
    } catch (error) {
      return 'mock_notification_id_' + Date.now();
    }
  }

  async cancelNotification(notificationId: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch (error) {
      console.error('Error canceling notification:', error);
    }
  }

  async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('Error canceling all notifications:', error);
    }
  }

  async scheduleDailyTaskCheck(): Promise<void> {
    try {
      // Cancel existing scheduled notifications
      await this.cancelAllNotifications();

      // Calculate next 9 AM
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);

      // Use different trigger types based on platform
      if (Platform.OS === 'android') {
        // For Android, use a simple time-based trigger for the next 9 AM
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '🌅 Good Morning!',
            body: 'Don\'t forget to check your tasks for today!',
            data: { type: 'daily_check' },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: tomorrow,
          },
        });
      } else {
        // For iOS, we can use the calendar trigger
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '🌅 Good Morning!',
            body: 'Don\'t forget to check your tasks for today!',
            data: { type: 'daily_check' },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
            hour: 9,
            minute: 0,
            repeats: true,
          },
        });
      }
    } catch (error) {
      console.error('Error scheduling daily task check:', error);
    }
  }

  // Cleanup method to remove app state listener
  cleanup(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }

  // Listen for notification interactions
  addNotificationReceivedListener(listener: (notification: Notifications.Notification) => void) {
    return Notifications.addNotificationReceivedListener(listener);
  }

  addNotificationResponseReceivedListener(listener: (response: Notifications.NotificationResponse) => void) {
    return Notifications.addNotificationResponseReceivedListener(listener);
  }

  async sendPushNotification(to: string, title: string, body: string, data?: any): Promise<void> {
    const message = {
      to,
      sound: 'default',
      title,
      body,
      data,
    };

    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      const result = await response.json();
    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  }

  getExpoPushToken(): string | null {
    return this.expoPushToken;
  }

  // Force check due tasks (useful for testing or manual triggers)
  async forceCheckDueTasks(): Promise<void> {
    this.lastNotificationCheck = null; // Reset the check timer
    await this.checkDueTasksAndNotify();
  }
}

export const notificationService = new NotificationService(); 