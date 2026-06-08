import React from 'react';
import { UserPlus, LogIn, Users, ArrowRight } from 'lucide-react';
import { AuthLayout } from './AuthLayout';

interface UserTypeSelectionProps {
  onNewUser: () => void;
  onReturningUser: () => void;
}

export function UserTypeSelection({ onNewUser, onReturningUser }: UserTypeSelectionProps) {
  const discourseBaseUrl = import.meta.env.VITE_DISCOURSE_BASE_URL || 'https://community.teatimecari.app';

  const handleReturningUserClick = () => {
    if (discourseBaseUrl) {
      window.location.href = `${discourseBaseUrl}/login`;
      return;
    }

    onReturningUser();
  };

  return (
    <AuthLayout>
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 mb-4">
            <img src="/teaLogo.png" alt="Tea Time Cari" className="w-full h-full object-contain drop-shadow-lg" />
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
            className="w-full group p-6 border-2 border-gray-300 rounded-xl hover:border-[#4B9EC8] hover:bg-[#D6EBF5] transition-all duration-200 text-left"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-[#D6EBF5] rounded-full flex items-center justify-center mr-4 group-hover:bg-[#4B9EC8] group-hover:bg-opacity-25 transition-colors">
                  <UserPlus className="w-6 h-6 text-[#4B9EC8]" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">I'm a New User</h3>
                  <p className="text-sm text-gray-600">
                    Create a new account and join our community
                  </p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-[#4B9EC8] group-hover:translate-x-1 transition-all duration-200" />
            </div>
          </button>

          {/* Returning User Option */}
          <button
            onClick={handleReturningUserClick}
            className="w-full group p-6 border-2 border-gray-300 rounded-xl hover:border-[#D96E6E] hover:bg-[#F9E3E3] transition-all duration-200 text-left"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-[#F9E3E3] rounded-full flex items-center justify-center mr-4 group-hover:bg-[#D96E6E] group-hover:bg-opacity-25 transition-colors">
                  <LogIn className="w-6 h-6 text-[#D96E6E]" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">I'm a Returning User</h3>
                  <p className="text-sm text-gray-600">
                    Sign in to the community forum
                  </p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-[#D96E6E] group-hover:translate-x-1 transition-all duration-200" />
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
                  Welcome back! Click above to sign in to the community forum with your existing account.
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