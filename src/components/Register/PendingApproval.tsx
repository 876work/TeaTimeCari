import React from 'react';
import { Clock, CheckCircle, User, Mail, Phone, AtSign, Users, Camera, Shield } from 'lucide-react';

export interface PendingApprovalProps {
  registrationData: {
    invite?: {
      inviteCode: string;
    };
    step1?: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      username: string;
    };
    step2?: {
      gender: 'Male' | 'Female';
    };
    step3?: {
      captureType: 'selfie' | 'id';
      imageData: string;
      imageBlob: Blob;
    };
  };
  onGoHome: () => void;
  onGoBackToStep1: () => void;
}

export function PendingApproval({ registrationData, onGoHome, onGoBackToStep1 }: PendingApprovalProps) {
  const { invite, step1, step2, step3 } = registrationData;

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-white rounded-2xl shadow-xl p-8">
        {/* Header Section */}
        <div className="text-center mb-8">
          <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6 relative">
            <CheckCircle className="w-10 h-10 text-green-600" />
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Application Submitted</h1>
          <p className="text-gray-600 mb-4">Step 4 of 4: Awaiting Review</p>
        </div>

        {/* Success Message */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
          <div className="text-center">
            <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-green-900 mb-2">Application Submitted</h2>
            <p className="text-green-800">
              Thanks! A team member will review your application. If approved, you'll receive an email with a 6-digit code and a verification link.
            </p>
          </div>
        </div>

        {/* What Happens Next */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h3 className="font-semibold text-blue-900 mb-3 flex items-center">
            <Clock className="w-5 h-5 mr-2" />
            What happens next?
          </h3>
          <ul className="text-sm text-blue-800 space-y-2">
            <li className="flex items-start">
              <span className="w-5 h-5 bg-blue-200 rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                <span className="text-xs font-bold text-blue-800">1</span>
              </span>
              <span>Our admin team will review your application within 24-48 hours</span>
            </li>
            <li className="flex items-start">
              <span className="w-5 h-5 bg-blue-200 rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                <span className="text-xs font-bold text-blue-800">2</span>
              </span>
              <span>If approved, you'll receive an email with a verification code and link</span>
            </li>
            <li className="flex items-start">
              <span className="w-5 h-5 bg-blue-200 rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                <span className="text-xs font-bold text-blue-800">3</span>
              </span>
              <span>Click the link or enter the code to set your password and activate your account</span>
            </li>
          </ul>
        </div>

        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
            <span>Registration Progress</span>
            <span>4/4 Complete</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-green-500 h-2 rounded-full w-full transition-all duration-500 ease-out"></div>
          </div>
        </div>

        {/* Submitted Information Summary */}
        {step1 && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center">
              <CheckCircle className="w-4 h-4 text-white" />
              Submitted Information
            </h3>
            
            <div className="space-y-3 text-sm">
              <div className="flex items-center text-gray-700">
                <User className="w-4 h-4 text-gray-400 mr-3" />
                <span className="font-medium mr-2">Name:</span>
                <span>{step1.firstName} {step1.lastName}</span>
              </div>
              
              <div className="flex items-center text-gray-700">
                <Mail className="w-4 h-4 text-gray-400 mr-3" />
                <span className="font-medium mr-2">Email:</span>
                <span>{step1.email}</span>
              </div>
              
              <div className="flex items-center text-gray-700">
                <Phone className="w-4 h-4 text-gray-400 mr-3" />
                <span className="font-medium mr-2">Phone:</span>
                <span>{step1.phone}</span>
              </div>
              
              <div className="flex items-center text-gray-700">
                <AtSign className="w-4 h-4 text-gray-400 mr-3" />
                <span className="font-medium mr-2">Username:</span>
                <span>@{step1.username}</span>
              </div>
              
              {step2 && (
                <div className="flex items-center text-gray-700">
                  <Users className="w-4 h-4 text-gray-400 mr-3" />
                  <span className="font-medium mr-2">Gender:</span>
                  <span>{step2.gender}</span>
                </div>
              )}
              
              {step3 && (
                <div className="flex items-center text-gray-700">
                  <Camera className="w-4 h-4 text-gray-400 mr-3" />
                  <span className="font-medium mr-2">Verification:</span>
                  <span>{step3.captureType === 'selfie' ? 'Selfie Photo' : 'ID Document'} Submitted</span>
                </div>
              )}
            </div>
          </div>
          </div>
        )}

        {/* Action Button */}
        <button
          type="button"
          onClick={onGoHome}
          className="w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transform hover:scale-[1.02]"
        >
          Return to Homepage
        </button>

        {/* Support Information */}
        <div className="text-center mt-6">
          <p className="text-xs text-gray-500">
            Questions about your application? Contact our support team for assistance.
          </p>
        </div>
      </div>
    </div>
  );
}