import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { NotificationProvider } from './contexts/NotificationContext';
import { useAuthActivityTracking } from './hooks/useAuthActivityTracking';
import { StripeProvider } from './components/Payment/StripeProvider';
import { supabase } from '@/lib/supabaseClient';
import SsoAutoFinisher from '@/components/SsoAutoFinisher';
import { HomePage } from './components/HomePage';
import { AppLayout } from './components/AppLayout';
import { RegisterStep1, RegisterStep1Data } from './components/RegisterStep1';
import { RegisterStep2, RegisterStep2Data } from './components/Register/Step2';
import { RegisterStep3, RegisterStep3Data } from './components/Register/Step3';
import PendingApproval from './components/Register/PendingApproval';
import { GenderFeed } from './components/Feed/GenderFeed';
import { UploadPost } from './components/Posts/UploadPost';
import { OppositeGenderFeed } from './components/Feed/OppositeGenderFeed';
import { UserProfile } from './components/User/UserProfile';
import { PostThread } from './components/Post/PostThread';
import { AdminLoginPage } from './components/Admin/AdminLoginPage';
import { AdminDashboard } from './components/Admin/AdminDashboard';
import RegistrationsPage from './features/admin/registrations/RegistrationsPage';
import ContactUs from './pages/ContactUs';
import KycPending from './pages/KycPending';
import Sso from './pages/Sso';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import Signup from './pages/Signup';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import ResetPassword from './pages/ResetPassword';
import Logout from './pages/Logout';
import CommunityRedirect from './pages/CommunityRedirect';
import { UserTypeSelection } from './components/UserTypeSelection';

type AdminPage =
  | 'dashboard'
  | 'user-reviews'
  | 'flagged-posts'
  | 'discourse-admins'
  | 'logs'
  | 'function-ping';

const adminPagePaths: Record<AdminPage, string> = {
  dashboard: '/admin/dashboard',
  'user-reviews': '/admin/users',
  'flagged-posts': '/admin/flagged-posts',
  'discourse-admins': '/admin/discourse-admins',
  logs: '/admin/logs',
  'function-ping': '/admin/function-ping',
};

function AdminPortalRoute({ initialPage }: { initialPage: AdminPage }) {
  const navigate = useNavigate();
  const [activePage, setActivePage] = React.useState<AdminPage>(initialPage);

  React.useEffect(() => {
    setActivePage(initialPage);
  }, [initialPage]);

  const handleNavigate = (page: string) => {
    const nextPage = page in adminPagePaths ? (page as AdminPage) : 'dashboard';
    setActivePage(nextPage);
    navigate(adminPagePaths[nextPage]);
  };

  return <AdminDashboard activePage={activePage} onNavigate={handleNavigate} />;
}

function App() {
  useAuthActivityTracking();
  const discourseBaseUrl =
    import.meta.env.VITE_DISCOURSE_BASE_URL || 'https://community.teatimecari.app';

  const [showWelcomePage, setShowWelcomePage] = React.useState(true);
  const [currentStep, setCurrentStep] = React.useState(1); // Start with basic info step
  const [currentPage, setCurrentPage] = React.useState<'user-type-selection' | 'register' | 'feed' | 'upload' | 'opposite-feed' | 'admin' | 'user-profile' | 'post-thread'>('user-type-selection');
  const [adminActivePage, setAdminActivePage] = React.useState<'dashboard' | 'user-reviews' | 'flagged-posts' | 'invite-codes' | 'logs' | 'function-ping' | 'discourse-admins'>('dashboard');
  const [selectedUserId, setSelectedUserId] = React.useState<string>('mock-user-1'); // Default for testing
  const [selectedPostId] = React.useState<string | null>(null);
  const [registrationData, setRegistrationData] = React.useState<{
    step1?: RegisterStep1Data;
    step2?: RegisterStep2Data;
    step3?: RegisterStep3Data;
  }>({});

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
    setCurrentPage('user-type-selection');
  };

  const handleGoHome = () => {
    setCurrentPage('user-type-selection');
    setCurrentStep(1); // Reset to basic info step
    setShowWelcomePage(true); // Show welcome page again
    setRegistrationData({});
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


  const handleAdminNavigate = (page: string) => {
    setAdminActivePage(page as 'dashboard' | 'user-reviews' | 'flagged-posts' | 'invite-codes' | 'logs' | 'function-ping' | 'discourse-admins');
  };

  const handleGoToUserProfile = (userId?: string) => {
    if (userId) {
      setSelectedUserId(userId);
    }
    setCurrentPage('user-profile');
  };

  const handleBackToStep1 = () => {
    setCurrentStep(1);
  };


  const handleBackToStep2 = () => {
    setCurrentStep(2);
  };

  const handleNewUser = () => {
    setCurrentPage('register');
    setCurrentStep(1);
  };

  const handleReturningUser = () => {
    window.location.href = '/login';
  };

  return (
    <>
      <SessionContextProvider supabaseClient={supabase}>
        <SsoAutoFinisher />
        <StripeProvider>
          <NotificationProvider>
            <Router>
            <Routes>
              <Route path="/contact-us" element={<ContactUs />} />
              <Route path="/kyc-pending" element={<KycPending />} />
              <Route path="/sso" element={<Sso />} />
              <Route path="/login" element={<Login />} />
              <Route path="/community" element={<CommunityRedirect />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/terms-of-service" element={<TermsOfService />} />
              <Route path="/logout" element={<Logout />} />
              
              {/* Admin Routes */}
              <Route path="/teamin" element={<AdminLoginPage />} />
              <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="/admin/dashboard" element={<AdminPortalRoute initialPage="dashboard" />} />
              <Route path="/admin/users" element={<AdminPortalRoute initialPage="user-reviews" />} />
              <Route path="/admin/flagged-posts" element={<AdminPortalRoute initialPage="flagged-posts" />} />
              <Route path="/admin/discourse-admins" element={<AdminPortalRoute initialPage="discourse-admins" />} />
              <Route path="/admin/logs" element={<AdminPortalRoute initialPage="logs" />} />
              <Route path="/admin/function-ping" element={<AdminPortalRoute initialPage="function-ping" />} />
              <Route path="/admin/registrations" element={<RegistrationsPage />} />
              
              {/* Main App Route */}
              <Route 
                path="/*" 
                element={
                  showWelcomePage ? (
                    <HomePage onGetStarted={handleGetStarted} />
                  ) : (
                    <AppLayout>
                      {currentPage === 'user-type-selection' && (
                        <UserTypeSelection 
                          onNewUser={handleNewUser}
                          onReturningUser={handleReturningUser}
                        />
                      )}
                      
                      {currentPage === 'register' && (
                        <>
                          {currentStep === 1 && (
                            <RegisterStep1 
                              onNext={handleStep1Complete}
                              onBack={() => setCurrentPage('user-type-selection')}
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
                              onGoBackToStep1={() => {
                                setCurrentStep(1);
                                setRegistrationData({});
                              }}
                            />
                          )}
                        </>
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
                            onClick={() => setCurrentPage('user-type-selection')}
                            className={`px-3 py-1 text-xs rounded ${
                              currentPage === 'user-type-selection' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
                            }`}
                          >
                            User Type
                          </button>
                          <button
                            onClick={() => setCurrentPage('register')}
                            className={`px-3 py-1 text-xs rounded ${
                              currentPage === 'register' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
                            }`}
                          >
                            Register
                          </button>
                          <button
                            onClick={() => window.location.href = `${discourseBaseUrl}/login`}
                            className="px-3 py-1 text-xs rounded bg-gray-200 text-gray-700"
                          >
                            Discourse Login
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
                            onClick={() => {
                              setCurrentPage('admin');
                              setAdminActivePage('discourse-admins');
                            }}
                            className={`px-3 py-1 text-xs rounded ${
                              currentPage === 'admin' && adminActivePage === 'discourse-admins' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
                            }`}
                          >
                            Discourse Admins
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
    </>
  );
}

export default App;
