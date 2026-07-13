import React, { useState, useRef, useEffect } from 'react';
import { Bell, Loader2 } from 'lucide-react';
import { useNotifications } from '../../contexts/NotificationContext';
import { NotificationDropdown } from './NotificationDropdown';

export function NotificationBell() {
  const { unreadCount, isLoading } = useNotifications();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  return (
    <div className="relative" ref={bellRef}>
      <button
        onClick={toggleDropdown}
        className={`relative p-2 rounded-full transition-colors duration-200 ${
          isDropdownOpen
            ? 'bg-blue-100 text-blue-600'
            : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
        }`}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className="w-6 h-6 animate-spin" />
        ) : (
          <Bell className="w-6 h-6" />
        )}
        
        {/* Unread count badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1 animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isDropdownOpen && (
        <NotificationDropdown onClose={() => setIsDropdownOpen(false)} />
      )}
    </div>
  );
}