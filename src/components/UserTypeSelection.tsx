import React from 'react';
import { UserPlus, LogIn, Users, ArrowRight, Coffee } from 'lucide-react';
import { AuthLayout } from './AuthLayout';

interface UserTypeSelectionProps {
  onNewUser: () => void;
  onReturningUser: () => void;
}

export function UserTypeSelection({ onNewUser, onReturningUser }: UserTypeSelectionProps) {
  return (
    <AuthLayout>
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-[#A3C6E0] to-[#E0A3A3] rounded-full flex items-center justify-center mb-4 shadow-lg">
            <Coffee className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Tea Time Cari</h1>
          <p className="text-gray-600">
            Are you new to our community or do you already have an account?
          </p>
        </div>

        <div className="space-y-4">
          {/* New User Option */}
          <button
            onClick={onNewUser}
            className="w-full group p-6 border-2 border-gray-300 rounded-xl hover:border-[#A3C6E0] hover:bg-blue-50 transition-all duration-200 text-left"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4 group-hover:bg-[#A3C6E0] group-hover:bg-opacity-30 transition-colors">
                  <UserPlus className="w-6 h-6 text-[#A3C6E0]" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">I'm a New User</h3>
                  <p className="text-sm text-gray-600">
                    Create a new account and join our community
                  </p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-[#A3C6E0] group-hover:translate-x-1 transition-all duration-200" />
            </div>
          </button>

          {/* Returning User Option */}
          <button
            onClick={onReturningUser}
            className="w-full group p-6 border-2 border-gray-300 rounded-xl hover:border-[#E0A3A3] hover:bg-red-50 transition-all duration-200 text-left"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mr-4 group-hover:bg-[#E0A3A3] group-hover:bg-opacity-30 transition-colors">
                  <LogIn className="w-6 h-6 text-[#E0A3A3]" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">I'm a Returning User</h3>
                  <p className="text-sm text-gray-600">
                    Sign in to your existing account
                  </p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-[#E0A3A3] group-hover:translate-x-1 transition-all duration-200" />
            </div>
          </button>
        </div>

        {/* Additional Information */}
        <div className="mt-8 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <Users className="w-5 h-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-blue-800 font-medium mb-1">New to Tea Time Cari?</p>
                <p className="text-sm text-blue-700">
                  Join our verified community where authentic conversations happen. All new members go through a verification process for everyone's safety.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start">
              <LogIn className="w-5 h-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-green-800 font-medium mb-1">Already have an account?</p>
                <p className="text-sm text-green-700">
                  Welcome back! Sign in with your email and password to access your account and continue connecting with the community.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Help Section */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500">
            Need help? Contact our support team for assistance with your account.
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}