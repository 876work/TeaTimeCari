import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { FileText } from 'lucide-react';
import { NotificationProvider } from './contexts/NotificationContext';
import { StripeProvider } from './components/Payment/StripeProvider';
import { HomePage } from './components/HomePage';
import { AppLayout } from './components/AppLayout';
import { RegisterStep1, RegisterStep1Data } from './components/RegisterStep1';
import { InviteStep, InviteStepData } from './components/Register/InviteStep';
import { RegisterStep2, RegisterStep2Data } from './components/Register/Step2';
import { RegisterStep3, RegisterStep3Data } from './components/Register/Step3';
import PendingApproval from './components/Register/PendingApproval';
import { VerifySmsCode } from './components/Auth/VerifySmsCode';
import { GenderFeed } from './components/Feed/GenderFeed';
import { UploadPost } from './components/Posts/UploadPost';
import { OppositeGenderFeed } from './components/Feed/OppositeGenderFeed';
import { UserProfile } from './components/User/UserProfile';
import { PostThread } from './components/Post/PostThread';
import { AdminLoginPage } from './components/Admin/AdminLoginPage';
import { AdminDashboard } from './components/Admin/AdminDashboard';
import { LoginComponent } from './components/Auth/LoginComponent';
import { ResetPasswordComponent } from './components/Auth/ResetPasswordComponent';
import KycVerification from './pages/KycVerification';
import SetPassword from './pages/SetPassword';
import KycSummary from './pages/KycSummary';
import ContactUs from './pages/ContactUs';
import KycPending from './pages/KycPending';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';
const baseUrl = supabaseUrl.endsWith('/') ? supabaseUrl.slice(0, -1) : supabaseUrl;
const supabase = createClient(supabaseUrl, supabaseKey, {
  functions: {
    url: `${baseUrl}/functions/v1`,
  },
});

function App() {
  const [showWelcomePage, setShowWelcomePage] = React.useState(true);
  const [currentStep, setCurrentStep] = React.useState(0); // Start with invite step
  const [currentPage, setCurrentPage] = React.useState<'register' | 'login' | 'reset-password' | 'verify-code' | 'feed' | 'upload' | 'opposite-feed' | 'admin' | 'user-profile' | 'post-thread'>('register');
  const [adminActivePage, setAdminActivePage] = React.useState<'dashboard' | 'user-reviews' | 'flagged-posts' | 'invite-codes' | 'logs' | 'function-ping'>('dashboard');
  const [selectedUserId, setSelectedUserId] = React.useState<string>('mock-user-1'); // Default for testing
  const [selectedPostId, setSelectedPostId] = React.useState<string | null>(null);
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

  const handleGoToLogin = () => {
    setCurrentPage('login');
  };

  const handleBackToRegister = () => {
    setCurrentPage('register');
    setCurrentStep(0); // Reset to invite step
  };

  const handleLoginSuccess = () => {
    console.log('Login successful');
    setCurrentPage('feed'); // Redirect to feed after successful login
  };

  const handleResetPasswordComplete = () => {
    console.log('Password reset completed');
    setCurrentPage('login'); // Redirect to login after password reset
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

  const handleGetStarted = () => {
    setShowWelcomePage(false);
  };

  const handleVerificationComplete = () => {
    console.log('SMS verification completed');
    setCurrentPage('feed'); // Redirect to feed after email verification
  };

  const handleGoHome = () => {
    setCurrentPage('register');
    setCurrentStep(0); // Reset to invite step
    setShowWelcomePage(true); // Show welcome page again
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

  const handleGoToAdminDashboard = () => {
    setCurrentPage('admin');
    setAdminActivePage('dashboard');
  };

  const handleGoToAdminFlaggedPosts = () => {
    setCurrentPage('admin');
    setAdminActivePage('flagged-posts');
  };

  const handleGoToAdminUserReviews = () => {
    setCurrentPage('admin');
    setAdminActivePage('user-reviews');
  };

  const handleGoToAdminInviteCodes = () => {
    setCurrentPage('admin');
    setAdminActivePage('invite-codes');
  };

  const handleGoToAdminLogs = () => {
    setCurrentPage('admin');
    setAdminActivePage('logs');
  };

  const handleAdminNavigate = (page: string) => {
    setAdminActivePage(page as 'dashboard' | 'user-reviews' | 'flagged-posts' | 'invite-codes' | 'logs' | 'function-ping');
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
      <StripeProvider>
        <NotificationProvider>
          <Router>
            <Routes>
              {/* KYC Routes */}
              <Route path="/kyc-verification" element={<KycVerification />} />
              <Route path="/kyc-summary" element={<KycSummary />} />
              <Route path="/set-password" element={<SetPassword />} />
              <Route path="/contact-us" element={<ContactUs />} />
              <Route path="/kyc-pending" element={<KycPending />} />
              
              {/* Admin Routes */}
              <Route path="/teamin" element={<AdminLoginPage />} />
              
              {/* Password Reset Route */}
              <Route 
                path="/reset-password" 
                element={
                  <ResetPasswordComponent 
                    onResetComplete={handleResetPasswordComplete}
                    onBackToLogin={() => setCurrentPage('login')}
                  />
                } 
              />
              
              {/* Main App Route */}
              <Route 
                path="/*" 
                element={
                  showWelcomePage ? (
                    <HomePage onGetStarted={handleGetStarted} />
                  ) : (
                    <AppLayout>
                      {currentPage === 'register' && (
                        <>
                          {currentStep === 0 && (
                            <InviteStep 
                              onNext={handleInviteComplete} 
                              onGoToLogin={handleGoToLogin}
                              initialData={registrationData.invite}
                            />
                          )}
                          {currentStep === 1 && (
                            <RegisterStep1 
                              onNext={handleStep1Complete}
                              onBack={handleBackToInvite}
                              initialData={registrationData.step1}
                            />
                          )}
                          {currentStep === 2 && (
                            <RegisterStep2 
                              onNext={handleStep2Complete}
                              onBack={handleBackToStep1}
                              initialData={registrationData.step2}
                            />
                          )}
                          {currentStep === 3 && (
                            <RegisterStep3 
                              onNext={handleStep3Complete}
                              onBack={handleBackToStep2}
                              initialData={registrationData.step3}
                              registrationData={registrationData}
                            />
                          )}
                          {currentStep === 4 && (
                            <PendingApproval 
                              registrationData={registrationData}
                              onGoHome={handleGoHome}
                              onGoBackToStep1={handleBackToStep1}
                            />
                          )}
                        </>
                      )}
                      
                      {currentPage === 'login' && (
                        <LoginComponent 
                          onLoginSuccess={handleLoginSuccess}
                          onBackToRegister={handleBackToRegister}
                        />
                      )}
                      
                      {currentPage === 'reset-password' && (
                        <ResetPasswordComponent 
                          onResetComplete={handleResetPasswordComplete}
                          onBackToLogin={() => setCurrentPage('login')}
                        />
                      )}
                      
                      {currentPage === 'verify-code' && (
                        <VerifySmsCode 
                          onVerificationComplete={handleVerificationComplete}
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
                      
                      {currentPage === 'admin' && (
                        <AdminDashboard activePage={adminActivePage} onNavigate={handleAdminNavigate} />
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
                            onClick={handleGoToLogin}
                            className={`px-3 py-1 text-xs rounded ${
                              currentPage === 'login' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
                            }`}
                          >
                            Login
                          </button>
                          <button
                            onClick={() => setCurrentPage('reset-password')}
                            className={`px-3 py-1 text-xs rounded ${
                              currentPage === 'reset-password' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
                            }`}
                          >
                            Reset Password
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
                            onClick={handleGoToAdminDashboard}
                            className={`px-3 py-1 text-xs rounded ${
                              currentPage === 'admin' && adminActivePage === 'dashboard' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
                            }`}
                          >
                            Admin Dashboard
                          </button>
                          <button
                            onClick={handleGoToAdminFlaggedPosts}
                            className={`px-3 py-1 text-xs rounded ${
                              currentPage === 'admin' && adminActivePage === 'flagged-posts' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
                            }`}
                          >
                            Admin Flagged
                          </button>
                          <button
                            onClick={handleGoToAdminUserReviews}
                            className={`px-3 py-1 text-xs rounded ${
                              currentPage === 'admin' && adminActivePage === 'user-reviews' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
                            }`}
                          >
                            Admin Users
                          </button>
                          <button
                            onClick={handleGoToAdminInviteCodes}
                            className={`px-3 py-1 text-xs rounded ${
                              currentPage === 'admin' && adminActivePage === 'invite-codes' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
                            }`}
                          >
                            Admin Invites
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
                          <button
                            onClick={() => {
                              setCurrentPage('admin');
                              setAdminActivePage('function-ping');
                            }}
                            className={`px-3 py-1 text-xs rounded ${
                              currentPage === 'admin' && adminActivePage === 'function-ping' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
                            }`}
                          >
                            Function Ping
                          </button>
                        </div>
                      </div>
                    </AppLayout>
                  )
                } 
              />
            </Routes>
          </Router>
        </NotificationProvider>
      </StripeProvider>
    </SessionContextProvider>
  );
}

export default App;