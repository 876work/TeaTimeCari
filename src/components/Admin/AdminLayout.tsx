import React from 'react';
import { Shield, Users, Settings, LogOut, Flag } from 'lucide-react';
import { LogoutButton } from '../Auth/LogoutButton';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="flex items-center">
                  <Shield className="w-8 h-8 text-blue-600 mr-3" />
                  <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
                </div>
              </div>
              <nav className="hidden md:ml-8 md:flex md:space-x-8">
                <a href="#" className="text-blue-600 hover:text-blue-700 px-3 py-2 rounded-md text-sm font-medium flex items-center">
                  <Users className="w-4 h-4 mr-2" />
                  User Reviews
                </a>
                <a href="#" className="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium flex items-center">
                  <Flag className="w-4 h-4 mr-2" />
                  Flagged Posts
                </a>
                <a href="#" className="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium flex items-center">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </a>
              </nav>
            </div>
            <div className="flex items-center">
              <LogoutButton variant="ghost" size="md" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {children}
        </div>
      </main>
    </div>
  );
}