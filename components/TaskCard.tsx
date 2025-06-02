import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    Alert,
    StyleSheet,
    TouchableOpacity,
    View
} from 'react-native';
import { Task } from '../services/taskService';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (taskId: number) => void;
  onToggleComplete: (taskId: number, completed: boolean) => void;
}

export function TaskCard({ task, onEdit, onDelete, onToggleComplete }: TaskCardProps) {
  const formatDate = (date: Date | undefined) => {
    if (!date) return 'No due date';
    
    const today = new Date();
    const taskDate = new Date(date);
    const isToday = taskDate.toDateString() === today.toDateString();
    const isPast = taskDate < today && !isToday;
    
    if (isToday) {
      return 'Today';
    }
    
    return taskDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: taskDate.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    });
  };

  const getTaskStatus = () => {
    if (task.completed) return 'completed';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const taskDate = task.dueDate || (task.due_date ? new Date(task.due_date) : null);
    if (!taskDate) return 'upcoming';
    
    const taskDay = new Date(taskDate);
    taskDay.setHours(0, 0, 0, 0);
    
    if (taskDay >= today) return 'upcoming';
    return 'past';
  };

  const isOverdue = () => {
    return !task.completed && getTaskStatus() === 'past';
  };

  const getDueDate = (): Date | undefined => {
    return task.dueDate || (task.due_date ? new Date(task.due_date) : undefined);
  };

  const getStatusColor = () => {
    const status = getTaskStatus();
    if (status === 'past') return '#ef4444';
    return '#3b82f6'; // upcoming tasks are blue
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Task',
      'Are you sure you want to delete this task?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => onDelete(task.id)
        },
      ]
    );
  };

  return (
    <ThemedView style={[
      styles.container, 
      task.completed && styles.completedContainer,
      { borderLeftColor: getStatusColor() }
    ]}>
      <View style={styles.content}>
        <View style={styles.leftSection}>
          <TouchableOpacity
            style={styles.checkbox}
            onPress={() => onToggleComplete(task.id, !task.completed)}
          >
            <Ionicons
              name={task.completed ? 'checkbox' : 'checkbox-outline'}
              size={24}
              color={task.completed ? '#10b981' : '#6b7280'}
            />
          </TouchableOpacity>
          
          <View style={styles.taskInfo}>
            <ThemedText style={[styles.title, task.completed && styles.completedText]}>
              {task.title}
            </ThemedText>
            <View style={styles.dateContainer}>
              <Ionicons
                name="calendar-outline"
                size={14}
                color={isOverdue() ? '#ef4444' : getStatusColor()}
              />
              <ThemedText style={[
                styles.date,
                isOverdue() && styles.overdueDate,
                task.completed && styles.completedText
              ]}>
                {formatDate(getDueDate())}
              </ThemedText>
              
              {/* Status badge */}
              {!task.completed && (
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
                  <ThemedText style={styles.statusBadgeText}>
                    {getTaskStatus().toUpperCase()}
                  </ThemedText>
                </View>
              )}
              
              {task.isLocal && (
                <View style={styles.offlineBadge}>
                  <ThemedText style={styles.offlineBadgeText}>Offline</ThemedText>
                </View>
              )}
              {task.needsSync && (
                <Ionicons
                  name="sync-outline"
                  size={14}
                  color="#f59e0b"
                  style={styles.syncIcon}
                />
              )}
            </View>
          </View>
        </View>
        
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onEdit(task)}
          >
            <Ionicons name="pencil-outline" size={20} color="#3b82f6" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleDelete}
          >
            <Ionicons name="trash-outline" size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  completedContainer: {
    backgroundColor: '#f9fafb',
    borderLeftColor: '#10b981',
    opacity: 0.8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  leftSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    marginRight: 12,
    marginTop: 2,
  },
  taskInfo: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  completedText: {
    textDecorationLine: 'line-through',
    color: '#9ca3af',
  },
  description: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
    lineHeight: 20,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  date: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 4,
  },
  overdueDate: {
    color: '#ef4444',
    fontWeight: '600',
  },
  offlineBadge: {
    backgroundColor: '#f59e0b',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  offlineBadgeText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: '600',
  },
  syncIcon: {
    marginLeft: 4,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
    marginLeft: 4,
  },
  statusBadge: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  statusBadgeText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: '600',
  },
}); 