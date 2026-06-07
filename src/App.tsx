import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { SessionContextProvider, useSession, useSessionContext } from '@supabase/auth-helpers-react';
import { NotificationProvider } from './contexts/NotificationContext';
import { useAuthActivityTracking } from './hooks/useAuthActivityTracking';
import { StripeProvider } from './components/Payment/StripeProvider';
import { supabase } from '@/lib/supabaseClient';
import { getAdminSession, AdminSession } from '@/lib/adminAuth';
import SsoAutoFinisher from '@/components/SsoAutoFinisher';
import { HomePage } from './components/HomePage';
import { AppLayout } from './components/AppLayout';
import { PublicLayout } from './components/PublicLayout';
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
import ContactUs from './pages/ContactUs';
import KycPending from './pages/KycPending';
import Sso from './pages/Sso';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import Signup from './pages/Signup';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import CommunityGuidelines from './pages/CommunityGuidelines';
import Faq from './pages/Faq';
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
  'function-ping': '/admin/health',
};


function OwnProfileRoute() {
  const session = useSession();

  if (!session?.user?.id) {
    return <Navigate to="/login" replace />;
  }

  return <UserProfile userId={session.user.id} />;
}

function AdminPortalRoute({ initialPage }: { initialPage: AdminPage }) {
  const navigate = useNavigate();
  const session = useSession();
  const { isLoading } = useSessionContext();
  const [activePage, setActivePage] = React.useState<AdminPage>(initialPage);
  const [adminSession, setAdminSession] = React.useState<AdminSession | null>(null);
  const [adminCheckComplete, setAdminCheckComplete] = React.useState(false);

  React.useEffect(() => {
    setActivePage(initialPage);
  }, [initialPage]);

  React.useEffect(() => {
    let cancelled = false;

    const checkAdminAccess = async () => {
      if (isLoading) return;

      if (!session?.user?.id) {
        setAdminSession(null);
        setAdminCheckComplete(true);
        return;
      }

      setAdminCheckComplete(false);

      try {
        const nextAdminSession = await getAdminSession();
        if (!cancelled) setAdminSession(nextAdminSession);
      } catch (error) {
        console.error('Admin access check failed:', error);
        if (!cancelled) setAdminSession(null);
      } finally {
        if (!cancelled) setAdminCheckComplete(true);
      }
    };

    checkAdminAccess();

    return () => {
      cancelled = true;
    };
  }, [isLoading, session?.user?.id]);

  const handleNavigate = (page: string) => {
    const nextPage = page in adminPagePaths ? (page as AdminPage) : 'dashboard';
    setActivePage(nextPage);
    navigate(adminPagePaths[nextPage]);
  };

  if (isLoading || !adminCheckComplete) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-500">Checking admin access…</p>
      </div>
    );
  }

  if (!session?.user?.id || !adminSession) {
    return <Navigate to={`/admin/login?next=${encodeURIComponent(adminPagePaths[initialPage])}`} replace />;
  }

  return <AdminDashboard activePage={activePage} onNavigate={handleNavigate} />;
}

function App() {
  useAuthActivityTracking();
  const [showWelcomePage, setShowWelcomePage] = React.useState(true);
  const [currentStep, setCurrentStep] = React.useState(1); // Start with basic info step
  const [currentPage, setCurrentPage] = React.useState<'user-type-selection' | 'register' | 'feed' | 'upload' | 'opposite-feed' | 'admin' | 'user-profile' | 'post-thread'>('user-type-selection');
  const [adminActivePage, setAdminActivePage] = React.useState<'dashboard' | 'user-reviews' | 'flagged-posts' | 'invite-codes' | 'logs' | 'function-ping' | 'discourse-admins'>('dashboard');
  const [selectedUserId] = React.useState<string>('mock-user-1'); // Default for testing
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

  const handleGoHome = () => {
    setCurrentPage('user-type-selection');
    setCurrentStep(1); // Reset to basic info step
    setShowWelcomePage(true); // Show welcome page again
    setRegistrationData({});
  };

  const handleAdminNavigate = (page: string) => {
    setAdminActivePage(page as 'dashboard' | 'user-reviews' | 'flagged-posts' | 'invite-codes' | 'logs' | 'function-ping' | 'discourse-admins');
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
              <Route path="/contact-us" element={<PublicLayout><ContactUs /></PublicLayout>} />
              <Route path="/kyc-pending" element={<PublicLayout><KycPending /></PublicLayout>} />
              <Route path="/sso" element={<Sso />} />
              <Route path="/login" element={<PublicLayout><Login /></PublicLayout>} />
              <Route path="/community" element={<CommunityRedirect />} />
              <Route path="/forgot-password" element={<PublicLayout><ForgotPassword /></PublicLayout>} />
              <Route path="/reset-password" element={<PublicLayout><ResetPassword /></PublicLayout>} />
              <Route path="/signup" element={<PublicLayout><Signup /></PublicLayout>} />
              <Route path="/privacy-policy" element={<PublicLayout><PrivacyPolicy /></PublicLayout>} />
              <Route path="/terms-of-service" element={<PublicLayout><TermsOfService /></PublicLayout>} />
              <Route path="/Community-Guidelines" element={<PublicLayout><CommunityGuidelines /></PublicLayout>} />
              <Route path="/community-guidelines" element={<PublicLayout><CommunityGuidelines /></PublicLayout>} />
              <Route path="/faq" element={<PublicLayout><Faq /></PublicLayout>} />
              <Route path="/logout" element={<Logout />} />
              <Route path="/profile" element={<AppLayout><OwnProfileRoute /></AppLayout>} />
              
              {/* Admin Routes */}
              <Route path="/admin/login" element={<AdminLoginPage />} />
              <Route path="/teamin" element={<AdminLoginPage />} />
              <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="/admin/dashboard" element={<AdminPortalRoute initialPage="dashboard" />} />
              <Route path="/admin/users" element={<AdminPortalRoute initialPage="user-reviews" />} />
              <Route path="/admin/flagged-posts" element={<AdminPortalRoute initialPage="flagged-posts" />} />
              <Route path="/admin/discourse-admins" element={<AdminPortalRoute initialPage="discourse-admins" />} />
              <Route path="/admin/logs" element={<AdminPortalRoute initialPage="logs" />} />
              <Route path="/admin/health" element={<AdminPortalRoute initialPage="function-ping" />} />
              <Route path="/admin/function-ping" element={<AdminPortalRoute initialPage="function-ping" />} />
              <Route path="/admin/*" element={<Navigate to="/admin/dashboard" replace />} />
              
              {/* Main App Route */}
              <Route 
                path="/*" 
                element={
                  showWelcomePage ? (
                    <PublicLayout showHeader={false}><HomePage /></PublicLayout>
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
