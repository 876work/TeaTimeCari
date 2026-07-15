import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react';
import { MessageSquare, Reply, CheckCircle, XCircle, Clock, BookMarked as MarkAsRead, ExternalLink, Bell, BellOff, BellRing, Loader2 } from 'lucide-react';
import { useNotifications, type Notification as AppNotification } from '../../contexts/NotificationContext';
import {
  isPushNotificationSupported,
  getPushSubscriptionState,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
} from '@/lib/pushNotifications';

interface NotificationDropdownProps {
  onClose: () => void;
}

export function NotificationDropdown({ onClose }: NotificationDropdownProps) {
  const navigate = useNavigate();
  const session = useSession();
  const supabase = useSupabaseClient();
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    refreshNotifications,
    isLoading
  } = useNotifications();

  const [pushState, setPushState] = useState<'subscribed' | 'unsubscribed' | 'unsupported' | 'loading'>(
    'unsupported',
  );
  const [pushError, setPushError] = useState<string | null>(null);

  useEffect(() => {
    if (!isPushNotificationSupported()) {
      setPushState('unsupported');
      return;
    }

    getPushSubscriptionState().then(setPushState);
  }, []);

  const handleTogglePush = async () => {
    if (!session?.user?.id || pushState === 'loading' || pushState === 'unsupported') return;

    setPushError(null);
    setPushState('loading');

    const result =
      pushState === 'subscribed'
        ? await unsubscribeFromPushNotifications(supabase, session.user.id)
        : await subscribeToPushNotifications(supabase, session.user.id);

    if (!result.success) {
      setPushError(result.error ?? 'Something went wrong.');
    }

    setPushState(await getPushSubscriptionState());
  };

  // Mark all as read when dropdown opens (if there are unread notifications)
  useEffect(() => {
    if (unreadCount > 0) {
      markAllAsRead();
    }
  }, [unreadCount, markAllAsRead]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'new_comment':
        return <MessageSquare className="w-4 h-4 text-blue-500" />;
      case 'reply':
        return <Reply className="w-4 h-4 text-purple-500" />;
      case 'green_flag':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'red_flag':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Bell className="w-4 h-4 text-gray-500" />;
    }
  };

  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const notificationTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - notificationTime.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return notificationTime.toLocaleDateString();
  };

  const handleNotificationClick = async (notification: AppNotification) => {
    // Mark as read if not already read
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }

    if (notification.link.startsWith('/')) {
      onClose();
      navigate(notification.link);
    } else {
      window.open(notification.link, '_blank', 'noopener,noreferrer');
      onClose();
    }
  };

  const displayNotifications = notifications.slice(0, 10); // Show latest 10

  return (
    <div className="absolute right-0 top-12 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-96 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Bell className="w-5 h-5 mr-2" />
            Notifications
          </h3>
          <div className="flex items-center space-x-2">
            {pushState !== 'unsupported' && (
              <button
                onClick={handleTogglePush}
                disabled={pushState === 'loading'}
                className="p-1 text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
                title={
                  pushState === 'subscribed'
                    ? 'Turn off push notifications on this device'
                    : 'Get push notifications on this device'
                }
              >
                {pushState === 'loading' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : pushState === 'subscribed' ? (
                  <BellRing className="w-4 h-4 text-[#4B9EC8]" />
                ) : (
                  <BellOff className="w-4 h-4" />
                )}
              </button>
            )}
            <button
              onClick={refreshNotifications}
              className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
              title="Refresh notifications"
            >
              <Clock className="w-4 h-4" />
            </button>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
                title="Mark all as read"
              >
                <MarkAsRead className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        {unreadCount > 0 && (
          <p className="text-sm text-gray-600 mt-1">
            {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
          </p>
        )}
        {pushError && (
          <p className="text-xs text-red-600 mt-1">{pushError}</p>
        )}
      </div>

      {/* Notifications List */}
      <div className="max-h-80 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin mx-auto mb-2" />
              <p className="text-sm text-gray-600">Loading notifications...</p>
            </div>
          </div>
        ) : displayNotifications.length === 0 ? (
          <div className="text-center py-8 px-4">
            <BellOff className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">No notifications yet</p>
            <p className="text-sm text-gray-500 mt-1">
              You'll see notifications here when people interact with your posts
            </p>
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate('/community');
              }}
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-[#4B9EC8] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3382AA]"
            >
              Visit community
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {displayNotifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`relative p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                  !notification.is_read ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-1">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${
                      !notification.is_read ? 'font-semibold text-gray-900' : 'text-gray-800'
                    }`}>
                      {notification.message}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-gray-500 flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {getTimeAgo(notification.created_at)}
                      </span>
                      <ExternalLink className="w-3 h-3 text-gray-400" />
                    </div>
                  </div>
                </div>
                
                {/* Unread indicator */}
                {!notification.is_read && (
                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {displayNotifications.length > 0 && (
        <div className="p-3 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full text-center text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            Close notifications
          </button>
        </div>
      )}
    </div>
  );
}