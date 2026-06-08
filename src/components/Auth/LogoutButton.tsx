import React, { useState } from 'react';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import { LogOut, Loader2 } from 'lucide-react';

interface LogoutButtonProps {
  className?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  onLogoutStart?: () => void;
  onLogoutComplete?: () => void;
  onLogoutError?: (error: string) => void;
}

export function LogoutButton({ 
  className = '',
  variant = 'ghost',
  size = 'md',
  showIcon = true,
  onLogoutStart,
  onLogoutComplete,
  onLogoutError
}: LogoutButtonProps) {
  const supabase = useSupabaseClient();
  const session = useSession();
  
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Handle logout process
  const handleLogout = async () => {
    // If no session exists, redirect to login/home
    if (!session?.user) {
      console.log('No active session found, redirecting to home');
      window.location.href = '/';
      return;
    }

    setIsLoggingOut(true);
    
    // Call optional callback
    if (onLogoutStart) {
      onLogoutStart();
    }

    try {
      console.log('Initiating logout process...');
      
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        throw error;
      }

      console.log('Logout successful');
      
      // Call optional callback
      if (onLogoutComplete) {
        onLogoutComplete();
      }

      // Clear any additional session data from localStorage if needed
      try {
        localStorage.removeItem('supabase.auth.token');
        sessionStorage.clear();
      } catch (storageError) {
        console.warn('Failed to clear storage:', storageError);
        // Don't fail the logout process for storage issues
      }

      // Redirect to home page (which will show the registration flow)
      window.location.href = '/';
      
    } catch (error: unknown) {
      console.error('Logout failed:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to logout. Please try again.';
      
      // Call optional error callback
      if (onLogoutError) {
        onLogoutError(errorMessage);
      } else {
        // Default error handling - show alert
        alert(`Logout failed: ${errorMessage}`);
      }
      
      setIsLoggingOut(false);
    }
  };

  // Get button styles based on variant and size
  const getButtonStyles = () => {
    const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
    
    // Size styles
    const sizeStyles = {
      sm: 'px-3 py-2 text-sm',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base'
    };
    
    // Variant styles
    const variantStyles = {
      primary: 'bg-red-600 hover:bg-red-700 text-white shadow-md hover:shadow-lg focus:ring-red-500 transform hover:scale-[1.02]',
      secondary: 'bg-gray-600 hover:bg-gray-700 text-white border border-gray-600 hover:border-gray-700 focus:ring-gray-500',
      ghost: 'text-gray-600 hover:text-gray-800 hover:bg-gray-100 focus:ring-gray-500'
    };
    
    return `${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`;
  };

  // Don't render if no session and not loading
  if (!session?.user && !isLoggingOut) {
    return null;
  }

  return (
    <button
      onClick={handleLogout}
      disabled={isLoggingOut}
      className={getButtonStyles()}
      title={isLoggingOut ? 'Signing out...' : 'Sign out of your account'}
      aria-label={isLoggingOut ? 'Signing out...' : 'Logout'}
    >
      {isLoggingOut ? (
        <>
          <Loader2 className={`animate-spin ${showIcon ? (size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4') : 'w-0 h-0'} ${showIcon ? 'mr-2' : ''}`} />
          <span>Signing out...</span>
        </>
      ) : (
        <>
          {showIcon && (
            <LogOut className={`${size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} mr-2`} />
          )}
          <span>Logout</span>
        </>
      )}
    </button>
  );
}