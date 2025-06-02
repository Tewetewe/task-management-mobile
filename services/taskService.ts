import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, API_CONFIG } from '../config/api';
import { authService } from './authService';

export interface Task {
  id: number;
  title: string;
  completed?: boolean;
  due_date: string | null;
  dueDate?: Date;
  user: {
    id: number;
    username: string;
  };
  userId?: string;
  isLocal?: boolean;
  needsSync?: boolean;
}

export interface TasksResponse {
  status_code: number;
  message: {
    id: string;
    en: string;
  };
  data: Task[];
}

export interface CreateTaskData {
  title: string;
  dueDate?: string;
}

export interface UpdateTaskData {
  title?: string;
  completed?: boolean;
  dueDate?: string;
}

const TASKS_KEY = 'tasks';
const OFFLINE_ACTIONS_KEY = 'offline_actions';

export interface OfflineAction {
  id: string;
  type: 'create' | 'update' | 'delete';
  taskId: number;
  data?: any;
  timestamp: Date;
}

class TaskService {
  private apiUrl = `${API_BASE_URL}${API_CONFIG.ENDPOINTS.TASKS}`;

  // Convert backend task format to app format
  private convertBackendTask(backendTask: any): Task {
    return {
      ...backendTask,
      dueDate: backendTask.due_date ? new Date(backendTask.due_date) : undefined,
      userId: backendTask.user?.id?.toString() || '1',
      completed: backendTask.completed || false,
    };
  }

  private async getStoredTasks(): Promise<Task[]> {
    const tasksJson = await AsyncStorage.getItem(TASKS_KEY);
    if (!tasksJson) return [];
    const tasks = JSON.parse(tasksJson);
    return tasks.map((task: any) => ({
      ...task,
      dueDate: task.due_date ? new Date(task.due_date) : undefined,
    }));
  }

  private async storeTasks(tasks: Task[]): Promise<void> {
    await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  }

  private async getOfflineActions(): Promise<OfflineAction[]> {
    const actionsJson = await AsyncStorage.getItem(OFFLINE_ACTIONS_KEY);
    if (!actionsJson) return [];
    const actions = JSON.parse(actionsJson);
    return actions.map((action: any) => ({
      ...action,
      timestamp: new Date(action.timestamp),
    }));
  }

  private async storeOfflineAction(action: OfflineAction): Promise<void> {
    const actions = await this.getOfflineActions();
    actions.push(action);
    await AsyncStorage.setItem(OFFLINE_ACTIONS_KEY, JSON.stringify(actions));
  }

  private async clearOfflineActions(): Promise<void> {
    await AsyncStorage.removeItem(OFFLINE_ACTIONS_KEY);
  }

  private generateId(): string {
    return 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  async fetchTasks(): Promise<Task[]> {
    try {
      const token = await authService.getToken();
      if (!token) throw new Error('No auth token');

      console.log('Fetching tasks from:', this.apiUrl);

      const response = await fetch(this.apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('Tasks response status:', response.status);

      if (!response.ok) throw new Error('Failed to fetch tasks');

      const apiResponse: TasksResponse = await response.json();
      console.log('Tasks API response:', apiResponse);
      
      if (apiResponse.status_code !== 200) {
        throw new Error('API returned error status');
      }

      const convertedTasks = apiResponse.data.map(task => this.convertBackendTask(task));
      await this.storeTasks(convertedTasks);
      
      console.log('Tasks fetched and stored:', convertedTasks.length);
      return convertedTasks;
    } catch (error) {
      console.log('Failed to fetch from backend, using local storage:', error);
      return await this.getStoredTasks();
    }
  }

  async createTask(taskData: CreateTaskData): Promise<Task> {
    const user = await authService.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    console.log('Creating task with data:', taskData);

    // Create local task for offline support
    const localId = parseInt(this.generateId().replace('local_', '').substring(0, 8), 10);
    const newTask: Task = {
      id: localId,
      title: taskData.title,
      completed: false,
      due_date: taskData.dueDate || null,
      dueDate: taskData.dueDate ? new Date(taskData.dueDate) : undefined,
      user: {
        id: parseInt(user.id),
        username: user.username,
      },
      userId: user.id,
      isLocal: true,
      needsSync: true,
    };

    try {
      const token = await authService.getToken();
      if (!token) throw new Error('No auth token');

      console.log('Sending create request to:', this.apiUrl);
      console.log('Request payload:', JSON.stringify(taskData));

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(taskData),
      });

      console.log('Create response status:', response.status);

      if (response.ok) {
        const apiResponse = await response.json();
        console.log('Task created successfully:', apiResponse);
        
        if (apiResponse.status_code === 200 || apiResponse.status_code === 201) {
          console.log('Refreshing tasks to get newly created task...');
          
          // Get fresh tasks to find the newly created one
          try {
            const freshTasks = await this.fetchTasks();
            const newlyCreatedTask = freshTasks.find(t => 
              t.title === apiResponse.data.title && 
              t.due_date === apiResponse.data.due_date
            );
            
            if (newlyCreatedTask) {
              console.log('Found newly created task:', newlyCreatedTask);
              return newlyCreatedTask;
            } else {
              console.warn('Could not find newly created task in fresh tasks list');
            }
          } catch (fetchError) {
            console.warn('Failed to fetch fresh tasks after creation:', fetchError);
          }
          
          // Fallback: create a temporary task object
          const createdTask: Task = {
            id: Date.now(), // Temporary ID
            title: apiResponse.data.title,
            completed: false,
            due_date: apiResponse.data.due_date, // Backend response uses due_date
            dueDate: apiResponse.data.due_date ? new Date(apiResponse.data.due_date) : undefined,
            user: {
              id: apiResponse.data.user.id,
              username: user.username,
            },
            userId: user.id,
          };
          
          console.log('Using fallback created task:', createdTask);
          return createdTask;
        }
      }
      
      console.error('Create request failed with status:', response.status);
      throw new Error('Backend creation failed');
    } catch (error) {
      console.log('Creating task offline due to error:', error);
      
      // Store locally and queue for sync
      const tasks = await this.getStoredTasks();
      tasks.push(newTask);
      await this.storeTasks(tasks);
      
      await this.storeOfflineAction({
        id: this.generateId(),
        type: 'create',
        taskId: newTask.id,
        data: taskData,
        timestamp: new Date(),
      });
      
      console.log('Task stored locally for offline sync:', newTask);
      return newTask;
    }
  }

  async updateTask(taskId: number, updateData: UpdateTaskData): Promise<Task> {
    const tasks = await this.getStoredTasks();
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    
    if (taskIndex === -1) {
      throw new Error('Task not found');
    }

    console.log('Updating task', taskId, 'with data:', updateData);

    const updatedTask: Task = {
      ...tasks[taskIndex],
      ...updateData,
      dueDate: updateData.dueDate ? new Date(updateData.dueDate) : tasks[taskIndex].dueDate,
      needsSync: true,
    };

    try {
      const token = await authService.getToken();
      if (!token) throw new Error('No auth token');

      console.log('Sending update request to:', `${this.apiUrl}/${taskId}`);
      console.log('Update payload:', JSON.stringify(updateData));

      // Try to update on backend
      const response = await fetch(`${this.apiUrl}/${taskId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      console.log('Update response status:', response.status);

      if (response.ok) {
        const apiResponse = await response.json();
        console.log('Task updated successfully:', apiResponse);
        
        if (apiResponse.status_code === 200) {
          // Backend returns the full updated task
          const backendTask = this.convertBackendTask(apiResponse.data);
          tasks[taskIndex] = backendTask;
          await this.storeTasks(tasks);
          console.log('Updated task from backend:', backendTask);
          return backendTask;
        }
      }
      
      console.error('Update request failed with status:', response.status);
      throw new Error('Backend update failed');
    } catch (error) {
      console.log('Updating task offline due to error:', error);
      
      // Update locally and queue for sync
      tasks[taskIndex] = updatedTask;
      await this.storeTasks(tasks);
      
      await this.storeOfflineAction({
        id: this.generateId(),
        type: 'update',
        taskId: taskId,
        data: updateData,
        timestamp: new Date(),
      });
      
      console.log('Task updated locally for offline sync:', updatedTask);
      return updatedTask;
    }
  }

  async deleteTask(taskId: number): Promise<void> {
    const tasks = await this.getStoredTasks();
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    
    if (taskIndex === -1) {
      throw new Error('Task not found');
    }

    console.log('Deleting task:', taskId);

    try {
      const token = await authService.getToken();
      if (!token) throw new Error('No auth token');

      console.log('Sending delete request to:', `${this.apiUrl}/${taskId}`);

      // Try to delete on backend
      const response = await fetch(`${this.apiUrl}/${taskId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      console.log('Delete response status:', response.status);

      if (response.ok) {
        const apiResponse = await response.json();
        console.log('Task deleted successfully:', apiResponse);
        
        if (apiResponse.status_code === 200) {
          tasks.splice(taskIndex, 1);
          await this.storeTasks(tasks);
          console.log('Task removed from local storage');
          return;
        }
      }
      
      console.error('Delete request failed with status:', response.status);
      throw new Error('Backend deletion failed');
    } catch (error) {
      console.log('Deleting task offline due to error:', error);
      
      // Mark as deleted locally and queue for sync
      tasks.splice(taskIndex, 1);
      await this.storeTasks(tasks);
      
      await this.storeOfflineAction({
        id: this.generateId(),
        type: 'delete',
        taskId: taskId,
        timestamp: new Date(),
      });
      
      console.log('Task deleted locally for offline sync');
    }
  }

  async syncOfflineChanges(): Promise<void> {
    const actions = await this.getOfflineActions();
    const token = await authService.getToken();
    
    if (!token || actions.length === 0) return;

    console.log(`Syncing ${actions.length} offline actions...`);

    for (const action of actions) {
      try {
        console.log('Syncing action:', action.type, action.taskId);
        
        switch (action.type) {
          case 'create':
            const createResponse = await fetch(this.apiUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(action.data),
            });
            
            if (createResponse.ok) {
              const createResult = await createResponse.json();
              console.log('Sync create successful:', createResult);
            }
            break;
            
          case 'update':
            const updateResponse = await fetch(`${this.apiUrl}/${action.taskId}`, {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(action.data),
            });
            
            if (updateResponse.ok) {
              const updateResult = await updateResponse.json();
              console.log('Sync update successful:', updateResult);
            }
            break;
            
          case 'delete':
            const deleteResponse = await fetch(`${this.apiUrl}/${action.taskId}`, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            });
            
            if (deleteResponse.ok) {
              const deleteResult = await deleteResponse.json();
              console.log('Sync delete successful:', deleteResult);
            }
            break;
        }
      } catch (error) {
        console.error('Failed to sync action:', action, error);
      }
    }
    
    // Clear offline actions after successful sync
    await this.clearOfflineActions();
    console.log('Offline actions cleared after sync');
    
    // Refresh tasks from backend
    await this.fetchTasks();
    console.log('Tasks refreshed after sync');
  }

  async getDueTasks(): Promise<Task[]> {
    const tasks = await this.getStoredTasks();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return tasks.filter(task => {
      if (task.completed !== false) return false; // Only include non-completed tasks
      if (!task.dueDate && !task.due_date) return false; // No due date
      
      // Use dueDate if available, otherwise parse due_date
      const taskDate = task.dueDate || (task.due_date ? new Date(task.due_date) : null);
      if (!taskDate) return false;
      
      const taskDay = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
      // Only return tasks due TODAY (exact date match), not past overdue tasks
      return taskDay.getTime() === today.getTime();
    });
  }
}

export const taskService = new TaskService(); 