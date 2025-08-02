import React from 'react';
import { createClient } from '@supabase/supabase-js';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { NotificationProvider } from './contexts/NotificationContext';
import { AppLayout } from './components/AppLayout';
import { RegisterStep1, RegisterStep1Data } from './components/RegisterStep1';
import { InviteStep, InviteStepData } from './components/Register/InviteStep';
import { RegisterStep2, RegisterStep2Data } from './components/Register/Step2';
import { RegisterStep3, RegisterStep3Data } from './components/Register/Step3';
import { PendingApproval } from './components/Register/PendingApproval';
import { VerifySmsCode } from './components/Auth/VerifySmsCode';
import { GenderFeed } from './components/Feed/GenderFeed';
import { UploadPost } from './components/Posts/UploadPost';
import { OppositeGenderFeed } from './components/Feed/OppositeGenderFeed';
import { ReviewFlaggedPosts } from './components/Admin/ReviewFlaggedPosts';
import { UserProfile } from './components/User/UserProfile';
import { PostThread } from './components/Post/PostThread';
import { AdminLoginPage } from './components/Admin/AdminLoginPage';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';
const supabase = createClient(supabaseUrl, supabaseKey);

function App() {
  // Check if current path is the admin login page
  const isAdminLoginPage = window.location.pathname === '/teamin';
  
  const [currentStep, setCurrentStep] = React.useState(0); // Start with invite step
  const [currentPage, setCurrentPage] = React.useState<'register' | 'verify-code' | 'feed' | 'upload' | 'opposite-feed' | 'admin' | 'admin-flagged-posts' | 'user-profile' | 'post-thread'>('register');
  const [selectedUserId, setSelectedUserId] = React.useState<string>('mock-user-1'); // Default for testing
  const [selectedPostId, setSelectedPostId] = React.useState<string>('mock-post-1'); // Default for testing
  const [registrationData, setRegistrationData] = React.useState<{
    invite?: InviteStepData;
    step1?: RegisterStep1Data;
    step2?: RegisterStep2Data;
    step3?: RegisterStep3Data;
  }>({});

  const handleInviteComplete = (data: InviteStepData) => {
    console.log('Invite step completed:', data);
    setRegistrationData(prev => ({ ...prev, invite: data }));
    setCurrentStep(1);
  };

  const handleStep1Complete = (data: RegisterStep1Data) => {
    console.log('Registration Step 1 completed:', data);
    setRegistrationData(prev => ({ ...prev, step1: data }));
    setCurrentStep(2);
  };

  const handleStep2Complete = (data: RegisterStep2Data) => {
    console.log('Registration Step 2 completed:', data);
    setRegistrationData(prev => ({ ...prev, step2: data }));
    setCurrentStep(3);
  };

  const handleStep3Complete = (data: RegisterStep3Data) => {
    console.log('Registration Step 3 completed:', data);
    setRegistrationData(prev => ({ ...prev, step3: data }));
    setCurrentStep(4);
  };

  const handleVerificationComplete = () => {
    console.log('SMS verification completed');
    setCurrentPage('register');
    setCurrentStep(1);
    setRegistrationData({});
  };

  const handleGoHome = () => {
    setCurrentPage('register');
    setCurrentStep(0); // Reset to invite step
    setRegistrationData({});
  };

  const handleGoToVerification = () => {
    setCurrentPage('verify-code');
  };

  const handleGoToFeed = () => {
    setCurrentPage('feed');
  };

  const handleGoToUpload = () => {
    setCurrentPage('upload');
  };

  const handleGoToOppositeFeed = () => {
    setCurrentPage('opposite-feed');
  };

  const handleGoToAdminFlaggedPosts = () => {
    setCurrentPage('admin-flagged-posts');
  };

  const handleGoToUserProfile = (userId?: string) => {
    if (userId) {
      setSelectedUserId(userId);
    }
    setCurrentPage('user-profile');
  };

  const handleGoToPostThread = (postId?: string) => {
    if (postId) {
      setSelectedPostId(postId);
    }
    setCurrentPage('post-thread');
  };

  const handleBackToStep1 = () => {
    setCurrentStep(1);
  };

  const handleBackToInvite = () => {
    setCurrentStep(0);
  };

  const handleBackToStep2 = () => {
    setCurrentStep(2);
  };

  return (
    <SessionContextProvider supabaseClient={supabase}>
      <NotificationProvider>
        {isAdminLoginPage ? (
          <AdminLoginPage />
        ) : (
          <AppLayout>
          {currentPage === 'register' && (
            <>
              {currentStep === 0 && (
                <InviteStep onNext={handleInviteComplete} />
              )}
              {currentStep === 1 && (
                <RegisterStep1 
                  onNext={handleStep1Complete}
                  onBack={handleBackToInvite}
                />
              )}
              {currentStep === 2 && (
                <RegisterStep2 
                  onNext={handleStep2Complete}
                  onBack={handleBackToStep1}
                />
              )}
              {currentStep === 3 && (
                <RegisterStep3 
                  onNext={handleStep3Complete}
                  onBack={handleBackToStep2}
                />
              )}
              {currentStep === 4 && (
                <PendingApproval 
                  registrationData={registrationData}
                  onGoHome={handleGoHome}
                />
              )}
            </>
          )}
          
          {currentPage === 'verify-code' && (
            <VerifySmsCode 
              onVerificationComplete={handleVerificationComplete}
              userPhone={registrationData.step1?.phone}
            />
          )}
          
          {currentPage === 'feed' && (
            <GenderFeed />
          )}
          
          {currentPage === 'upload' && (
            <UploadPost />
          )}
          
          {currentPage === 'opposite-feed' && (
            <OppositeGenderFeed />
          )}
          
          {currentPage === 'admin-flagged-posts' && (
            <ReviewFlaggedPosts />
          )}
          
          {currentPage === 'user-profile' && (
            <UserProfile userId={selectedUserId} />
          )}
          
          {currentPage === 'post-thread' && (
            <PostThread postId={selectedPostId} />
          )}
          
          {/* Navigation for testing - remove in production */}
          <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 border">
            <div className="text-xs text-gray-600 mb-2">Navigation (Dev Mode)</div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setCurrentPage('register')}
                className={`px-3 py-1 text-xs rounded ${
                  currentPage === 'register' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                Register
              </button>
              <button
                onClick={handleGoToVerification}
                className={`px-3 py-1 text-xs rounded ${
                  currentPage === 'verify-code' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                Verify SMS
              </button>
              <button
                onClick={handleGoToFeed}
                className={`px-3 py-1 text-xs rounded ${
                  currentPage === 'feed' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                Feed
              </button>
              <button
                onClick={handleGoToUpload}
                className={`px-3 py-1 text-xs rounded ${
                  currentPage === 'upload' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                Upload
              </button>
              <button
                onClick={handleGoToOppositeFeed}
                className={`px-3 py-1 text-xs rounded ${
                  currentPage === 'opposite-feed' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                Premium Feed
              </button>
              <button
                onClick={handleGoToAdminFlaggedPosts}
                className={`px-3 py-1 text-xs rounded ${
                  currentPage === 'admin-flagged-posts' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                Admin Flagged
              </button>
              <button
                onClick={() => handleGoToUserProfile()}
                className={`px-3 py-1 text-xs rounded ${
                  currentPage === 'user-profile' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                User Profile
              </button>
              <button
                onClick={() => handleGoToPostThread()}
                className={`px-3 py-1 text-xs rounded ${
                  currentPage === 'post-thread' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                Post Thread
              </button>
            </div>
          </div>
          </AppLayout>
        )}
      </NotificationProvider>
    </SessionContextProvider>
  );
}

export default App;