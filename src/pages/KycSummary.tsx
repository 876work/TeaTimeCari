import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { CheckCircle, Loader2, AlertCircle, User, Mail, Phone, Calendar, Camera, ArrowRight, Home, HelpCircle } from 'lucide-react';
import { AuthLayout } from '../components/AuthLayout';

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL!, import.meta.env.VITE_SUPABASE_ANON_KEY!);
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY!;
const FN_HEADERS = { Authorization: `Bearer ${ANON}`, apikey: ANON, 'Content-Type': 'application/json' };

interface KycSummaryData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  username: string;
  gender: 'Male' | 'Female';
  captureType: 'selfie' | 'id';
  submittedAt: string;
}

export default function KycSummary() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const actionToken = params.get('act') ?? '';
  
  const [summaryData, setSummaryData] = useState<KycSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Validate action token exists
  useEffect(() => {
    if (!actionToken) {
      setError('Invalid verification link. Action token is missing.');
      setLoading(false);
    }
  }, [actionToken]);

  // Fetch KYC summary data
  useEffect(() => {
    const fetchSummaryData = async () => {
      if (!actionToken) return;

      try {
        const { data, error: functionError } = await supabase.functions.invoke('get-kyc-summary', {
          headers: FN_HEADERS,
          body: { act: actionToken }
        });

        if (functionError || !data?.success) {
          throw new Error(functionError?.message || data?.error || 'Failed to fetch summary data');
        }

        setSummaryData(data.data);
      } catch (err: any) {
        console.error('KYC summary fetch error:', err);
        
        let errorMessage = 'Failed to load verification summary. Please try again.';
        
        if (err.message?.includes('Token expired')) {
          errorMessage = 'Your verification session has expired. Please contact support for assistance.';
        } else if (err.message?.includes('Invalid signature')) {
          errorMessage = 'Invalid verification link. Please use the complete link from your email.';
        } else if (err.message?.includes('Wrong token type')) {
          errorMessage = 'This link is not valid for viewing summary. Please use the correct verification link.';
        } else if (err.message?.includes('Registration not found')) {
          errorMessage = 'Registration data not found. Please contact support for assistance.';
        } else if (err.message) {
          errorMessage = err.message;
        }
        
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchSummaryData();
  }, [actionToken]);

  const handleContinueToSetPassword = () => {
    navigate(`/set-password?act=${encodeURIComponent(actionToken)}`);
  };

  const handleGoHome = () => {
    navigate('/');
  };

  const handleNeedHelp = () => {
    navigate('/contact-us');
  };

  // Invalid token state
  if (!actionToken) {
    return (
      <AuthLayout>
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-red-600 mb-2">Invalid Verification Link</h1>
            <p className="text-gray-600 mb-6">
              This verification link is missing required information. Please use the complete link from your email.
            </p>
            <button
              onClick={handleGoHome}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Go to Homepage
            </button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  // Loading state
  if (loading) {
    return (
      <AuthLayout>
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading your verification summary...</p>
          </div>
        </div>
      </AuthLayout>
    );
  }

  // Error state
  if (error) {
    return (
      <AuthLayout>
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-red-600 mb-2">Unable to Load Summary</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <div className="space-y-3">
              <button
                onClick={handleGoHome}
                className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Go to Homepage
              </button>
              <button
                onClick={handleNeedHelp}
                className="w-full px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Need Help?
              </button>
            </div>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Verification Complete!</h1>
          <p className="text-gray-600">
            Here's a summary of your submitted information
          </p>
        </div>

        {summaryData && (
          <div className="space-y-6 mb-8">
            {/* Personal Information */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <User className="w-5 h-5 mr-2 text-blue-600" />
                Personal Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <p className="text-gray-900 font-medium">{summaryData.firstName} {summaryData.lastName}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                  <p className="text-gray-900 font-medium">@{summaryData.username}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                  <p className="text-gray-900 font-medium">{summaryData.gender}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Verification Type</label>
                  <p className="text-gray-900 font-medium capitalize">
                    {summaryData.captureType === 'selfie' ? 'Selfie Photo' : 'ID Document'}
                  </p>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Mail className="w-5 h-5 mr-2 text-green-600" />
                Contact Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                  <p className="text-gray-900 font-medium">{summaryData.email}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <p className="text-gray-900 font-medium">{summaryData.phone}</p>
                </div>
              </div>
            </div>

            {/* Submission Details */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Calendar className="w-5 h-5 mr-2 text-purple-600" />
                Submission Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Submitted On</label>
                  <p className="text-gray-900 font-medium">
                    {new Date(summaryData.submittedAt).toLocaleDateString()} at {new Date(summaryData.submittedAt).toLocaleTimeString()}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Verification Method</label>
                  <div className="flex items-center">
                    <Camera className="w-4 h-4 mr-2 text-purple-600" />
                    <p className="text-gray-900 font-medium">
                      {summaryData.captureType === 'selfie' ? 'Live Selfie Capture' : 'ID Document Photo'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-4">
          <button
            onClick={handleContinueToSetPassword}
            className="w-full py-4 px-6 bg-gradient-to-r from-[#A3C6E0] to-[#E0A3A3] hover:from-[#8BB5D9] hover:to-[#D98B8B] text-white rounded-lg font-semibold text-lg shadow-md hover:shadow-lg transform hover:scale-[1.02] transition-all duration-200"
          >
            <div className="flex items-center justify-center">
              <ArrowRight className="w-6 h-6 mr-3" />
              Continue to Set Password
            </div>
          </button>
          
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={handleGoHome}
              className="py-3 px-4 bg-black hover:bg-gray-800 text-white rounded-lg font-medium transition-colors flex items-center justify-center"
            >
              <Home className="w-5 h-5 mr-2" />
              Go to Home
            </button>
            
            <button
              onClick={handleNeedHelp}
              className="py-3 px-4 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center justify-center"
            >
              <HelpCircle className="w-5 h-5 mr-2" />
              Need Help?
            </button>
          </div>
        </div>

        {/* Security Notice */}
        <div className="mt-8 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-800 text-center">
            <strong>Next Step:</strong> Set your password to complete account setup and gain access to the platform.
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}