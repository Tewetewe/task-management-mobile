import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
    Alert,
    FlatList,
    RefreshControl,
    StyleSheet,
    TouchableOpacity,
    View
} from 'react-native';

import { TaskCard } from '@/components/TaskCard';
import { TaskFormModal } from '@/components/TaskFormModal';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useAuth } from '@/contexts/AuthContext';
import { CreateTaskData, Task, taskService, UpdateTaskData } from '@/services/taskService';

export default function TasksScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('all');
  const { user, logout } = useAuth();

  const loadTasks = async (showRefreshing = false) => {
    try {
      if (showRefreshing) setRefreshing(true);
      else setLoading(true);
      
      const fetchedTasks = await taskService.fetchTasks();
      setTasks(fetchedTasks);
    } catch (error) {
      console.error('Error loading tasks:', error);
      Alert.alert('Error', 'Failed to load tasks. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadTasks();
    }, [])
  );

  const handleAddTask = () => {
    setEditingTask(null);
    setModalVisible(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setModalVisible(true);
  };

  const handleSubmitTask = async (data: CreateTaskData | UpdateTaskData) => {
    try {
      if (editingTask) {
        await taskService.updateTask(editingTask.id, data);
      } else {
        await taskService.createTask(data as CreateTaskData);
      }
      await loadTasks();
    } catch (error) {
      console.error('Error saving task:', error);
      throw error;
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    try {
      setLoading(true);
      await taskService.deleteTask(taskId);
      await loadTasks();
    } catch (error) {
      Alert.alert('Error', 'Failed to delete task. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleComplete = async (taskId: number, completed: boolean) => {
    try {
      await taskService.updateTask(taskId, { completed });
      await loadTasks();
    } catch (error) {
      Alert.alert('Error', 'Failed to update task. Please try again.');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', onPress: logout, style: 'destructive' },
      ]
    );
  };

  const handleSync = async () => {
    try {
      setRefreshing(true);
      await taskService.syncOfflineChanges();
      await loadTasks();
      Alert.alert('Success', 'All changes have been synchronized.');
    } catch (error) {
      console.error('Error syncing:', error);
      Alert.alert('Error', 'Failed to sync changes. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  // Helper function to determine if a task is upcoming or past
  const getTaskStatus = (task: Task) => {
    if (task.completed) return 'completed'; // Still track internally but don't filter by it
    
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    
    const taskDate = task.dueDate || (task.due_date ? new Date(task.due_date) : null);
    if (!taskDate) return 'upcoming'; // No due date counts as upcoming
    
    const taskDay = new Date(taskDate);
    taskDay.setHours(0, 0, 0, 0);
    
    if (taskDay >= today) return 'upcoming';
    return 'past';
  };

  const filteredTasks = tasks.filter(task => {
    // Don't show completed tasks in any filter
    if (task.completed) return false;
    
    if (filter === 'all') return true;
    return getTaskStatus(task) === filter;
  });

  const upcomingCount = tasks.filter(t => !t.completed && getTaskStatus(t) === 'upcoming').length;
  const pastCount = tasks.filter(t => !t.completed && getTaskStatus(t) === 'past').length;
  const totalActiveCount = upcomingCount + pastCount;
  const hasOfflineChanges = tasks.some(t => t.needsSync || t.isLocal);

  const renderTask = ({ item }: { item: Task }) => (
    <TaskCard
      task={item}
      onEdit={handleEditTask}
      onDelete={handleDeleteTask}
      onToggleComplete={handleToggleComplete}
    />
  );

  const renderHeader = () => (
    <ThemedView style={styles.header}>
      <View style={styles.userSection}>
        <ThemedText style={styles.greeting}>Hello, {user?.name}!</ThemedText>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <ThemedText style={styles.statNumber}>{upcomingCount}</ThemedText>
          <ThemedText style={styles.statLabel}>Upcoming</ThemedText>
        </View>
        <View style={styles.statItem}>
          <ThemedText style={styles.statNumber}>{pastCount}</ThemedText>
          <ThemedText style={styles.statLabel}>Past</ThemedText>
        </View>
        <View style={styles.statItem}>
          <ThemedText style={styles.statNumber}>{totalActiveCount}</ThemedText>
          <ThemedText style={styles.statLabel}>Total</ThemedText>
        </View>
      </View>

      <View style={styles.filterContainer}>
        {(['all', 'upcoming', 'past'] as const).map((filterType) => (
          <TouchableOpacity
            key={filterType}
            style={[
              styles.filterButton,
              filter === filterType && styles.filterButtonActive
            ]}
            onPress={() => setFilter(filterType)}
          >
            <ThemedText style={[
              styles.filterButtonText,
              filter === filterType && styles.filterButtonTextActive
            ]}>
              {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </View>

      {hasOfflineChanges && (
        <TouchableOpacity style={styles.syncBanner} onPress={handleSync}>
          <Ionicons name="sync-outline" size={16} color="#f59e0b" />
          <ThemedText style={styles.syncBannerText}>
            You have offline changes. Tap to sync.
          </ThemedText>
        </TouchableOpacity>
      )}
    </ThemedView>
  );

  const renderEmpty = () => (
    <ThemedView style={styles.emptyContainer}>
      <Ionicons name="clipboard-outline" size={64} color="#9ca3af" />
      <ThemedText style={styles.emptyTitle}>
        {filter === 'all' ? 'No tasks yet' : `No ${filter} tasks`}
      </ThemedText>
      <ThemedText style={styles.emptySubtitle}>
        {filter === 'all' 
          ? 'Tap the + button to create your first task'
          : filter === 'upcoming' 
            ? 'No upcoming tasks. You\'re all caught up!'
            : 'No past due tasks. Great job staying on top of things!'
        }
      </ThemedText>
    </ThemedView>
  );

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={filteredTasks}
        renderItem={renderTask}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadTasks(true)}
            colors={['#3b82f6']}
            tintColor="#3b82f6"
          />
        }
        showsVerticalScrollIndicator={false}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={handleAddTask}
      >
        <Ionicons name="add" size={24} color="#ffffff" />
      </TouchableOpacity>

      <TaskFormModal
        visible={modalVisible}
        task={editingTask}
        onClose={() => setModalVisible(false)}
        onSubmit={handleSubmitTask}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 24,
  },
  userSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  logoutButton: {
    padding: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#3b82f6',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  syncBannerText: {
    fontSize: 14,
    color: '#92400e',
    marginLeft: 8,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  filterButtonActive: {
    backgroundColor: '#3b82f6',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  filterButtonTextActive: {
    color: '#ffffff',
  },
});
