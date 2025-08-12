import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, AlertCircle, Home, Mail } from 'lucide-react';
import { AuthLayout } from '../components/AuthLayout';

export default function KycPending() {
  const navigate = useNavigate();

  const handleGoHome = () => {
    navigate('/');
  };

  const handleContactSupport = () => {
    navigate('/contact-us');
  };

  return (
    <AuthLayout>
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
            <Clock className="w-8 h-8 text-amber-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Account Pending Approval</h1>
          <p className="text-gray-600 mb-6">
            Your account is currently under review by our team. You'll receive an email notification once your account has been approved.
          </p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
              <div className="text-left">
                <p className="text-sm text-blue-800 font-medium mb-1">What happens next?</p>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Our team will review your submitted information</li>
                  <li>• You'll receive an email with further instructions</li>
                  <li>• Once approved, you'll gain access to the community</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleGoHome}
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center"
            >
              <Home className="w-5 h-5 mr-2" />
              Return to Homepage
            </button>
            
            <button
              onClick={handleContactSupport}
              className="w-full px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center justify-center"
            >
              <Mail className="w-5 h-5 mr-2" />
              Contact Support
            </button>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}