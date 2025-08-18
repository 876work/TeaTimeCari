import React, { useEffect, useState } from "react";
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { Link } from "react-router-dom";
import { CheckCircle, Loader2, AlertCircle, Download, User, Mail, Phone, Camera, Calendar, Shield } from 'lucide-react';
import html2canvas from 'html2canvas';
import { RegisterStep1Data } from '../RegisterStep1';
import { RegisterStep2Data } from './Step2';
import { RegisterStep3Data } from './Step3';

interface PendingApprovalProps {
  registrationData: {
    step1?: RegisterStep1Data;
    step2?: RegisterStep2Data;
    step3?: RegisterStep3Data;
  };
  onGoHome: () => void;
  onGoBackToStep1: () => void;
}

const PendingApproval: React.FC<PendingApprovalProps> = ({ 
  registrationData, 
  onGoHome, 
  onGoBackToStep1 
}) => {
  const supabase = useSupabaseClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Download registration summary as image
  const downloadSummaryAsImage = async () => {
    setIsDownloading(true);
    try {
      const element = document.getElementById('registration-summary');
      if (!element) {
        throw new Error('Summary element not found');
      }

      const canvas = await html2canvas(element, {
        backgroundColor: '#ffffff',
        scale: 2, // Higher quality
        useCORS: true,
        allowTaint: true,
        width: element.offsetWidth,
        height: element.offsetHeight
      });

      // Convert canvas to blob
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `tea-time-cari-registration-${new Date().toISOString().split('T')[0]}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }
      }, 'image/png', 0.95);

    } catch (err: any) {
      console.error('Error downloading summary:', err);
      alert('Failed to download summary. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  // Submit registration data when component mounts
  useEffect(() => {
    const submitRegistration = async () => {
      if (!registrationData.step1 || !registrationData.step2 || !registrationData.step3) {
        setError('Incomplete registration data. Please start over.');
        return;
      }

      setIsSubmitting(true);
      setError(null);

      try {
        const { step1, step2, step3 } = registrationData;
        
        // Split fullName into firstName and lastName for database compatibility
        const nameParts = step1.fullName.trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        const registrationPayload = {
          firstName,
          lastName,
          email: step1.email,
          phone: step1.phone,
          username: step1.username,
          password_temp: step1.password, // Store temporarily for admin approval
          gender: step2.gender,
          captureType: step3.captureType,
          imageData: step3.imageData,
          status: 'pending'
        };
        
        const { data: insertedData, error: insertError } = await supabase
          .from('registrations')
          .insert([registrationPayload])
          .select()
          .single();
        
        if (insertError) {
          if (insertError.code === '42P01') {
            console.warn('Registrations table not found, proceeding with demo flow');
            setIsSubmitted(true);
          } else {
            throw insertError;
          }
        } else {
          setIsSubmitted(true);
        }
        
      } catch (err: any) {
        console.error('Error submitting registration:', err);
        setError(`Failed to submit registration: ${err.message || 'Please try again.'}`);
      } finally {
        setIsSubmitting(false);
      }
    };

    submitRegistration();
  }, [registrationData, supabase]);

  // Loading state
  if (isSubmitting) {
    return (
      <div className="max-w-md mx-auto p-6">
        <div className="rounded-2xl border p-8 shadow-sm bg-white text-center">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <h1 className="text-xl font-semibold mb-2">Submitting Your Application</h1>
          <p className="text-sm text-gray-600">
            Please wait while we process your registration...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-md mx-auto p-6">
        <div className="rounded-2xl border p-8 shadow-sm bg-white text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold mb-2 text-red-600">Registration Failed</h1>
          <p className="text-sm text-gray-600 mb-6">
            {error}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onGoBackToStep1}
              className="flex-1 inline-flex items-center justify-center rounded-xl px-4 py-2 border bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={onGoHome}
              className="flex-1 inline-flex items-center justify-center rounded-xl px-4 py-2 border"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  return (
    <div className="max-w-md mx-auto p-6">
      <div className="space-y-6">
        {/* Registration Summary */}
        <div id="registration-summary" className="rounded-2xl border p-8 shadow-sm bg-white">
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Registration Summary</h2>
            <p className="text-sm text-gray-600">
              Submitted on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
            </p>
          </div>

          {/* Personal Information */}
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <User className="w-5 h-5 mr-2 text-blue-600" />
                Personal Information
              </h3>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <p className="text-gray-900 font-medium">{registrationData.step1?.fullName}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                  <p className="text-gray-900 font-medium">@{registrationData.step1?.username}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                  <p className="text-gray-900 font-medium">{registrationData.step2?.gender}</p>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Mail className="w-5 h-5 mr-2 text-green-600" />
                Contact Information
              </h3>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                  <p className="text-gray-900 font-medium">{registrationData.step1?.email}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <p className="text-gray-900 font-medium">{registrationData.step1?.phone}</p>
                </div>
              </div>
            </div>

            {/* Verification Details */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Camera className="w-5 h-5 mr-2 text-purple-600" />
                Verification Details
              </h3>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Verification Method</label>
                  <p className="text-gray-900 font-medium capitalize">
                    {registrationData.step3?.captureType === 'selfie' ? 'Live Selfie Capture' : 'ID Document Photo'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Photo Status</label>
                  <div className="flex items-center">
                    <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                    <p className="text-gray-900 font-medium">Successfully Captured</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Status Information */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Calendar className="w-5 h-5 mr-2 text-amber-600" />
                Application Status
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Current Status:</span>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-800">
                    Pending Review
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Submitted:</span>
                  <span className="text-sm text-gray-900">{new Date().toLocaleDateString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Expected Review:</span>
                  <span className="text-sm text-gray-900">Within 24-48 hours</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Success Message and Actions */}
        <div className="rounded-2xl border p-8 shadow-sm bg-white text-center">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Application Submitted!</h1>
        <p className="text-sm text-gray-600 mb-4">
          Thank you! A team member will review your application. If approved, you'll receive an email with verification instructions.
        </p>

        <div className="text-sm text-gray-600 mb-6">
          You can close this page. We'll notify you via email when it's your turn.
        </div>

        <div className="space-y-3">
          {/* Download Summary Button */}
          <button
            onClick={downloadSummaryAsImage}
            disabled={isDownloading}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
              !isDownloading
                ? 'bg-gradient-to-r from-[#A3C6E0] to-[#E0A3A3] hover:from-[#8BB5D9] hover:to-[#D98B8B] text-white shadow-md hover:shadow-lg transform hover:scale-[1.02]'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isDownloading ? (
              <div className="flex items-center justify-center">
                <Loader2 className="animate-spin h-5 w-5 mr-2" />
                Generating Download...
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <Download className="w-5 h-5 mr-2" />
                Download Summary as Image
              </div>
            )}
          </button>

          {/* Navigation Buttons */}
          <div className="flex items-center gap-3">
          <button
            onClick={onGoHome}
            className="inline-flex items-center justify-center rounded-xl px-4 py-2 border bg-black text-white"
          >
            Go to Home
          </button>
          <Link
            to="/help"
            className="inline-flex items-center justify-center rounded-xl px-4 py-2 border"
          >
            Need help?
          </Link>
        </div>
        </div>
      </div>
    </div>
  );
};

export default PendingApproval;