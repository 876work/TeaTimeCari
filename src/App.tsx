import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { SessionContextProvider, useSession, useSessionContext } from '@supabase/auth-helpers-react';
import { NotificationProvider } from './contexts/NotificationContext';
import { useAuthActivityTracking } from './hooks/useAuthActivityTracking';
import { StripeProvider } from './components/Payment/StripeProvider';
import { supabase } from '@/lib/supabaseClient';
import { getAdminSession } from '@/lib/adminAuth';
import type { AdminSession } from '@/lib/adminAuth';
import SsoAutoFinisher from '@/components/SsoAutoFinisher';
import type { RegisterStep1Data } from './components/RegisterStep1';
import type { RegisterStep2Data } from './components/Register/Step2';
import type { RegisterStep3Data } from './components/Register/Step3';
import { debugError, debugLog } from '@/lib/debugLogger';

const HomePage = React.lazy(() => import('./components/HomePage').then((module) => ({ default: module.HomePage })));
const AppLayout = React.lazy(() => import('./components/AppLayout').then((module) => ({ default: module.AppLayout })));
const PublicLayout = React.lazy(() => import('./components/PublicLayout').then((module) => ({ default: module.PublicLayout })));
const RegisterStep1 = React.lazy(() => import('./components/RegisterStep1').then((module) => ({ default: module.RegisterStep1 })));
const RegisterStep2 = React.lazy(() => import('./components/Register/Step2').then((module) => ({ default: module.RegisterStep2 })));
const RegisterStep3 = React.lazy(() => import('./components/Register/Step3').then((module) => ({ default: module.RegisterStep3 })));
const PendingApproval = React.lazy(() => import('./components/Register/PendingApproval'));
const GenderFeed = React.lazy(() => import('./components/Feed/GenderFeed').then((module) => ({ default: module.GenderFeed })));
const UploadPost = React.lazy(() => import('./components/Posts/UploadPost').then((module) => ({ default: module.UploadPost })));
const OppositeGenderFeed = React.lazy(() => import('./components/Feed/OppositeGenderFeed').then((module) => ({ default: module.OppositeGenderFeed })));
const UserProfile = React.lazy(() => import('./components/User/UserProfile').then((module) => ({ default: module.UserProfile })));
const PostThread = React.lazy(() => import('./components/Post/PostThread').then((module) => ({ default: module.PostThread })));
const AdminLoginPage = React.lazy(() => import('./components/Admin/AdminLoginPage').then((module) => ({ default: module.AdminLoginPage })));
const AdminDashboard = React.lazy(() => import('./components/Admin/AdminDashboard').then((module) => ({ default: module.AdminDashboard })));
const ContactUs = React.lazy(() => import('./pages/ContactUs'));
const ContactUsSuccess = React.lazy(() => import('./pages/ContactUs').then((module) => ({ default: module.ContactUsSuccess })));
const KycPending = React.lazy(() => import('./pages/KycPending'));
const Sso = React.lazy(() => import('./pages/Sso'));
const Login = React.lazy(() => import('./pages/Login'));
const ForgotPassword = React.lazy(() => import('./pages/ForgotPassword'));
const Signup = React.lazy(() => import('./pages/Signup'));
const PrivacyPolicy = React.lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = React.lazy(() => import('./pages/TermsOfService'));
const CommunityGuidelines = React.lazy(() => import('./pages/CommunityGuidelines'));
const AnonymousModeExplained = React.lazy(() => import('./pages/AnonymousModeExplained'));
const HowItWorks = React.lazy(() => import('./pages/HowItWorks'));
const Faq = React.lazy(() => import('./pages/Faq'));
const ResetPassword = React.lazy(() => import('./pages/ResetPassword'));
const Logout = React.lazy(() => import('./pages/Logout'));
const CommunityRedirect = React.lazy(() => import('./pages/CommunityRedirect'));
const UserTypeSelection = React.lazy(() => import('./components/UserTypeSelection').then((module) => ({ default: module.UserTypeSelection })));

function PageLoading() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <p className="text-sm text-slate-500">Loading…</p>
    </div>
  );
}

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

        if (!cancelled) {
          setAdminSession(nextAdminSession);
        }
      } catch (error) {
        debugError('Admin access check failed:', error);

        if (!cancelled) {
          setAdminSession(null);
        }
      } finally {
        if (!cancelled) {
          setAdminCheckComplete(true);
        }
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
  const [currentStep, setCurrentStep] = React.useState(1);
  const [currentPage, setCurrentPage] = React.useState<
    | 'user-type-selection'
    | 'register'
    | 'feed'
    | 'upload'
    | 'opposite-feed'
    | 'admin'
    | 'user-profile'
    | 'post-thread'
  >('user-type-selection');

  const [adminActivePage, setAdminActivePage] = React.useState<
    | 'dashboard'
    | 'user-reviews'
    | 'flagged-posts'
    | 'invite-codes'
    | 'logs'
    | 'function-ping'
    | 'discourse-admins'
  >('dashboard');

  const [selectedUserId] = React.useState<string>('mock-user-1');
  const [selectedPostId] = React.useState<string | null>(null);

  const [registrationData, setRegistrationData] = React.useState<{
    step1?: RegisterStep1Data;
    step2?: RegisterStep2Data;
    step3?: RegisterStep3Data;
  }>({});

  const handleStep1Complete = (data: RegisterStep1Data) => {
    debugLog('Registration Step 1 completed:', data);
    setRegistrationData(prev => ({ ...prev, step1: data }));
    setCurrentStep(2);
  };

  const handleStep2Complete = (data: RegisterStep2Data) => {
    debugLog('Registration Step 2 completed:', data);
    setRegistrationData(prev => ({ ...prev, step2: data }));
    setCurrentStep(3);
  };

  const handleStep3Complete = (data: RegisterStep3Data) => {
    debugLog('Registration Step 3 completed:', data);
    setRegistrationData(prev => ({ ...prev, step3: data }));
    setCurrentStep(4);
  };

  const handleGoHome = () => {
    setCurrentPage('user-type-selection');
    setCurrentStep(1);
    setShowWelcomePage(true);
    setRegistrationData({});
  };

  const handleAdminNavigate = (page: string) => {
    setAdminActivePage(
      page as
        | 'dashboard'
        | 'user-reviews'
        | 'flagged-posts'
        | 'invite-codes'
        | 'logs'
        | 'function-ping'
        | 'discourse-admins',
    );
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
    <SessionContextProvider supabaseClient={supabase}>
      <SsoAutoFinisher />
      <StripeProvider>
        <NotificationProvider>
          <Router>
            <React.Suspense fallback={<PageLoading />}>
            <Routes>
              <Route path="/contact-us" element={<PublicLayout><ContactUs /></PublicLayout>} />
              <Route path="/contact-us/success" element={<PublicLayout><ContactUsSuccess /></PublicLayout>} />
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
              <Route path="/anonymous-mode" element={<PublicLayout><AnonymousModeExplained /></PublicLayout>} />
              <Route path="/faq" element={<PublicLayout><Faq /></PublicLayout>} />
              <Route path="/how-it-works" element={<PublicLayout><HowItWorks /></PublicLayout>} />
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
                    <PublicLayout showHeader={false}>
                      <HomePage />
                    </PublicLayout>
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

                      {currentPage === 'feed' && <GenderFeed />}

                      {currentPage === 'upload' && <UploadPost />}

                      {currentPage === 'opposite-feed' && <OppositeGenderFeed />}

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
            </React.Suspense>
          </Router>
        </NotificationProvider>
      </StripeProvider>
    </SessionContextProvider>
  );
}

export default App;