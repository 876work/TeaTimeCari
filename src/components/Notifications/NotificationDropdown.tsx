import React, { useEffect } from 'react';
import { MessageSquare, Reply, CheckCircle, XCircle, Clock, BookMarked as MarkAsRead, ExternalLink, Bell, BellOff } from 'lucide-react';
import { useNotifications } from '../../contexts/NotificationContext';

interface NotificationDropdownProps {
  onClose: () => void;
}

export function NotificationDropdown({ onClose }: NotificationDropdownProps) {
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    refreshNotifications,
    isLoading 
  } = useNotifications();

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

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read if not already read
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }

    // Navigate to the link
    if (notification.link.startsWith('/')) {
      // Internal link - you might want to implement proper routing here
      // For now, we'll just close the dropdown
      onClose();
      console.log('Navigate to:', notification.link);
    } else {
      // External link
      window.open(notification.link, '_blank');
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
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {displayNotifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
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
            View all notifications
          </button>
        </div>
      )}
    </div>
  );
}