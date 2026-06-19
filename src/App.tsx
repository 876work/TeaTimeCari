import React from 'react';
import * as Sentry from '@sentry/react';
import { usePostHog } from '@posthog/react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { SessionContextProvider, useSession, useSessionContext } from '@supabase/auth-helpers-react';
import { NotificationProvider } from './contexts/NotificationContext';
import { useAuthActivityTracking } from './hooks/useAuthActivityTracking';
import { StripeProvider } from './components/Payment/StripeProvider';
import { supabase } from '@/lib/supabaseClient';
import { getAdminSession } from '@/lib/adminAuth';
import type { AdminSession } from '@/lib/adminAuth';
import SsoAutoFinisher from '@/components/SsoAutoFinisher';
import { debugError } from '@/lib/debugLogger';

const HomePage = React.lazy(() => import('./components/HomePage').then((module) => ({ default: module.HomePage })));
const AppLayout = React.lazy(() => import('./components/AppLayout').then((module) => ({ default: module.AppLayout })));
const PublicLayout = React.lazy(() => import('./components/PublicLayout').then((module) => ({ default: module.PublicLayout })));
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
const ResetPasswordVerify = React.lazy(() => import('./pages/ResetPasswordVerify'));
const Logout = React.lazy(() => import('./pages/Logout'));
const CommunityRedirect = React.lazy(() => import('./pages/CommunityRedirect'));

function PostHogPageviewTracker() {
  const location = useLocation();
  const posthog = usePostHog();

  React.useEffect(() => {
    posthog?.capture('$pageview', {
      $current_url: window.location.href,
      path: `${location.pathname}${location.search}`,
    });
  }, [location.pathname, location.search, posthog]);

  return null;
}

function PostHogIdentityTracker() {
  const posthog = usePostHog();
  const session = useSession();
  const { isLoading } = useSessionContext();
  const identifiedUserId = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (isLoading) return;

    const userId = session?.user?.id ?? null;

    if (userId && identifiedUserId.current !== userId) {
      posthog?.identify(userId);
      identifiedUserId.current = userId;
      return;
    }

    if (!userId && identifiedUserId.current) {
      posthog?.reset();
      identifiedUserId.current = null;
    }
  }, [isLoading, posthog, session?.user?.id]);

  return null;
}

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

function UserProfileRoute() {
  const { userId } = useParams<{ userId: string }>();

  if (!userId) {
    return <Navigate to="/profile" replace />;
  }

  return <UserProfile userId={userId} />;
}

function PostThreadRoute() {
  const { postId } = useParams<{ postId: string }>();

  if (!postId) {
    return <Navigate to="/feed" replace />;
  }

  return <PostThread postId={postId} />;
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

  return (
    <Sentry.ErrorBoundary
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <p className="text-sm text-slate-500">Something went wrong. Please refresh the page.</p>
        </div>
      }
    >
      <SessionContextProvider supabaseClient={supabase}>
        <SsoAutoFinisher />
        <PostHogIdentityTracker />
        <StripeProvider>
          <NotificationProvider>
            <Router>
              <PostHogPageviewTracker />

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
                  <Route path="/reset-password/verify" element={<PublicLayout><ResetPasswordVerify /></PublicLayout>} />
                  <Route path="/signup" element={<PublicLayout><Signup /></PublicLayout>} />
                  <Route path="/signup/:signupStep" element={<PublicLayout><Signup /></PublicLayout>} />
                  <Route path="/privacy-policy" element={<PublicLayout><PrivacyPolicy /></PublicLayout>} />
                  <Route path="/terms-of-service" element={<PublicLayout><TermsOfService /></PublicLayout>} />
                  <Route path="/Community-Guidelines" element={<PublicLayout><CommunityGuidelines /></PublicLayout>} />
                  <Route path="/community-guidelines" element={<PublicLayout><CommunityGuidelines /></PublicLayout>} />
                  <Route path="/anonymous-mode" element={<PublicLayout><AnonymousModeExplained /></PublicLayout>} />
                  <Route path="/faq" element={<PublicLayout><Faq /></PublicLayout>} />
                  <Route path="/how-it-works" element={<PublicLayout><HowItWorks /></PublicLayout>} />
                  <Route path="/logout" element={<Logout />} />
                  <Route path="/profile" element={<AppLayout><OwnProfileRoute /></AppLayout>} />
                  <Route path="/users/:userId" element={<AppLayout><UserProfileRoute /></AppLayout>} />
                  <Route path="/posts/:postId" element={<AppLayout><PostThreadRoute /></AppLayout>} />
                  <Route path="/feed" element={<AppLayout><GenderFeed /></AppLayout>} />
                  <Route path="/upload" element={<AppLayout><UploadPost /></AppLayout>} />
                  <Route path="/opposite-feed" element={<AppLayout><OppositeGenderFeed /></AppLayout>} />

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
                    path="/"
                    element={
                      <PublicLayout showHeader={false}>
                        <HomePage />
                      </PublicLayout>
                    }
                  />

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </React.Suspense>
            </Router>
          </NotificationProvider>
        </StripeProvider>
      </SessionContextProvider>
    </Sentry.ErrorBoundary>
  );
}

export default App;