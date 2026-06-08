import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';

// Type definitions
export interface Notification {
  id: string;
  user_id: string;
  type: 'new_comment' | 'reply' | 'green_flag' | 'red_flag';
  message: string;
  link: string;
  is_read: boolean;
  created_at: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

interface NotificationProviderProps {
  children: React.ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const supabase = useSupabaseClient();
  const session = useSession();
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch notifications from database
  const fetchNotifications = useCallback(async () => {
    if (!session?.user?.id) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(50); // Limit to latest 50 notifications

      if (fetchError) {
        if (fetchError.code === '42P01') {
          // Table doesn't exist, use mock data for demonstration
          console.warn('Notifications table not found, using mock data');
          setMockNotifications();
          return;
        }
        throw fetchError;
      }

      setNotifications(data || []);
      
      // Calculate unread count
      const unread = (data || []).filter(notification => !notification.is_read).length;
      setUnreadCount(unread);

    } catch (err: unknown) {
      console.error('Error fetching notifications:', err);
      setError('Failed to load notifications');
      // Fallback to mock data
      setMockNotifications();
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id, supabase]);

  // Set mock notifications for demonstration
  const setMockNotifications = () => {
    const mockNotifications: Notification[] = [
      {
        id: '1',
        user_id: session?.user?.id || '',
        type: 'new_comment',
        message: '@alex_smith commented on your post',
        link: '/thread/mock-post-1',
        is_read: false,
        created_at: new Date(Date.now() - 300000).toISOString() // 5 minutes ago
      },
      {
        id: '2',
        user_id: session?.user?.id || '',
        type: 'green_flag',
        message: 'Your post received a green flag! 🟢',
        link: '/thread/mock-post-2',
        is_read: false,
        created_at: new Date(Date.now() - 900000).toISOString() // 15 minutes ago
      },
      {
        id: '3',
        user_id: session?.user?.id || '',
        type: 'reply',
        message: '@jordan_doe replied to your comment',
        link: '/thread/mock-post-3',
        is_read: true,
        created_at: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
      },
      {
        id: '4',
        user_id: session?.user?.id || '',
        type: 'red_flag',
        message: 'Your post received a red flag 🔴',
        link: '/thread/mock-post-4',
        is_read: true,
        created_at: new Date(Date.now() - 7200000).toISOString() // 2 hours ago
      }
    ];

    setNotifications(mockNotifications);
    setUnreadCount(mockNotifications.filter(n => !n.is_read).length);
    setIsLoading(false);
  };

  // Mark single notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!session?.user?.id) return;

    try {
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', session.user.id);

      if (updateError && updateError.code !== '42P01') {
        throw updateError;
      }

      // Update local state
      setNotifications(prev =>
        prev.map(notification =>
          notification.id === notificationId
            ? { ...notification, is_read: true }
            : notification
        )
      );

      // Update unread count
      setUnreadCount(prev => Math.max(0, prev - 1));

    } catch (err: unknown) {
      console.error('Error marking notification as read:', err);
      // For mock data, just update local state
      setNotifications(prev =>
        prev.map(notification =>
          notification.id === notificationId
            ? { ...notification, is_read: true }
            : notification
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  }, [session?.user?.id, supabase]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', session.user.id)
        .eq('is_read', false);

      if (updateError && updateError.code !== '42P01') {
        throw updateError;
      }

      // Update local state
      setNotifications(prev =>
        prev.map(notification => ({ ...notification, is_read: true }))
      );
      setUnreadCount(0);

    } catch (err: unknown) {
      console.error('Error marking all notifications as read:', err);
      // For mock data, just update local state
      setNotifications(prev =>
        prev.map(notification => ({ ...notification, is_read: true }))
      );
      setUnreadCount(0);
    }
  }, [session?.user?.id, supabase]);

  // Refresh notifications manually
  const refreshNotifications = useCallback(async () => {
    await fetchNotifications();
  }, [fetchNotifications]);

  // Initial fetch when user logs in
  useEffect(() => {
    if (session?.user?.id) {
      fetchNotifications();
    } else {
      // Clear notifications when user logs out
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [session?.user?.id, fetchNotifications]);

  // Set up real-time subscription for new notifications
  useEffect(() => {
    if (!session?.user?.id) return;

    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${session.user.id}`
        },
        (payload) => {
          console.log('New notification received:', payload);
          const newNotification = payload.new as Notification;
          
          // Add new notification to the beginning of the list
          setNotifications(prev => [newNotification, ...prev.slice(0, 49)]); // Keep only latest 50
          
          // Increment unread count if notification is unread
          if (!newNotification.is_read) {
            setUnreadCount(prev => prev + 1);
          }
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id, supabase]);

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    isLoading,
    error,
    markAsRead,
    markAllAsRead,
    refreshNotifications
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}