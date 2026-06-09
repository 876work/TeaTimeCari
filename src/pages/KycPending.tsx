import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, Home, Loader2, LogOut, Mail, RefreshCw, ShieldAlert, ShieldCheck, Clock } from 'lucide-react';
import { AuthLayout } from '../components/AuthLayout';
import { supabase } from '@/lib/supabaseClient';
import { ApprovalStatus, getApprovalStatus, isBlockedStatus } from '@/lib/auth/approvalStatus';

type PageState = {
  status: ApprovalStatus | 'signed_out' | 'checking';
  error: string | null;
};

const statusContent: Record<Exclude<PageState['status'], 'checking'>, {
  icon: React.ReactNode;
  title: string;
  body: string;
  toneClass: string;
  detailTitle: string;
  details: string[];
}> = {
  signed_out: {
    icon: <Clock className="w-8 h-8 text-amber-600" />,
    title: 'Account Pending Approval',
    body: "Your secure status check needs an active login session. Please sign in with the same email used for your application to see the latest review result.",
    toneClass: 'bg-amber-100',
    detailTitle: 'What happens next?',
    details: [
      'Use the login page to resume your account status check.',
      'If you have not completed an application, please start signup again.',
      'Contact support only if you applied and cannot access the same email.',
    ],
  },
  pending: {
    icon: <Clock className="w-8 h-8 text-amber-600" />,
    title: 'Account Pending Approval',
    body: "Your application is still under review. You do not need to submit another application or retry login while this status is pending.",
    toneClass: 'bg-amber-100',
    detailTitle: 'What happens next?',
    details: [
      'Watch your email for the approval decision or any follow-up requests.',
      'Use Refresh Status if you were just notified that your account was approved.',
      'Contact support if your application has been pending longer than expected.',
    ],
  },
  rejected: {
    icon: <ShieldAlert className="w-8 h-8 text-red-600" />,
    title: 'Account Not Approved',
    body: 'This account was not approved for community access. To protect privacy and safety, we cannot show detailed review notes here.',
    toneClass: 'bg-red-100',
    detailTitle: 'Need help?',
    details: [
      'Review decisions are made to protect community privacy and safety.',
      'Contact support if you believe there was a mistake or need help understanding next steps.',
      'Do not submit duplicate applications unless support asks you to.',
    ],
  },
  suspended: {
    icon: <ShieldAlert className="w-8 h-8 text-orange-600" />,
    title: 'Account Suspended',
    body: 'This account is currently suspended, so access is paused. You have been signed out on this device for safety.',
    toneClass: 'bg-orange-100',
    detailTitle: 'What can you do?',
    details: [
      'Contact support if you believe this was a mistake.',
      'Our team may need to review your account before access can be restored.',
      'You have been signed out on this device for safety.',
    ],
  },
  banned: {
    icon: <ShieldAlert className="w-8 h-8 text-red-600" />,
    title: 'Account Unavailable',
    body: 'This account is not eligible to access Tea Time Cari. You have been signed out on this device for safety.',
    toneClass: 'bg-red-100',
    detailTitle: 'What can you do?',
    details: [
      'Contact support if you believe this was a mistake.',
      'Our team may need to review your account before access can be restored.',
      'You have been signed out on this device for safety.',
    ],
  },
  missing: {
    icon: <AlertCircle className="w-8 h-8 text-blue-600" />,
    title: 'Application Not Found',
    body: "We could not find a completed application for this account. This can happen if signup was not finished or you used a different login email.",
    toneClass: 'bg-blue-100',
    detailTitle: 'Recommended next steps',
    details: [
      'Make sure you signed in with the same email used during registration.',
      'Contact support if you already submitted an application with this email.',
      'Start signup again if you have not completed the application yet.',
    ],
  },
  not_approved: {
    icon: <AlertCircle className="w-8 h-8 text-blue-600" />,
    title: 'Account Needs Review',
    body: 'This account is not approved for community access yet. Please contact support if this status looks incorrect.',
    toneClass: 'bg-blue-100',
    detailTitle: 'Recommended next steps',
    details: [
      'Wait for the account review email if you recently applied.',
      'Use Refresh Status if you were just approved.',
      'Contact support if you need help with your account status.',
    ],
  },
  approved: {
    icon: <ShieldCheck className="w-8 h-8 text-emerald-600" />,
    title: 'Account Approved',
    body: 'Your account has been approved. Sending you to the community now…',
    toneClass: 'bg-emerald-100',
    detailTitle: 'You are all set',
    details: [
      'You now have access to the Tea Time Cari community.',
      'If you are not redirected automatically, use the community button below.',
    ],
  },
};

export default function KycPending() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialStatus = React.useMemo(() => {
    const status = new URLSearchParams(location.search).get('status');
    const knownStatuses: PageState['status'][] = [
      'approved',
      'pending',
      'rejected',
      'suspended',
      'banned',
      'missing',
      'not_approved',
    ];

    return knownStatuses.includes(status as PageState['status'])
      ? (status as PageState['status'])
      : 'checking';
  }, [location.search]);

  const [pageState, setPageState] = React.useState<PageState>({ status: initialStatus, error: null });
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const checkStatus = React.useCallback(async ({ redirectApproved = true } = {}) => {
    setIsRefreshing(true);
    setPageState((current) => ({ ...current, error: null }));

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const userId = session?.user?.id;

      if (!userId) {
        setPageState({ status: 'signed_out', error: null });
        return;
      }

      const status = await getApprovalStatus(userId);

      if (isBlockedStatus(status)) {
        await supabase.auth.signOut();
      }

      setPageState({ status, error: null });

      if (status === 'approved' && redirectApproved) {
        navigate('/community', { replace: true });
      }
    } catch {
      setPageState((current) => ({
        ...current,
        error: 'Unable to check your account status right now. Please try again, or contact support if this continues.',
      }));
    } finally {
      setIsRefreshing(false);
    }
  }, [navigate]);

  React.useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const handleGoHome = () => {
    navigate('/');
  };

  const handleContactSupport = () => {
    const params = new URLSearchParams({ topic: 'account-status' });

    if (pageState.status !== 'checking') {
      params.set('status', pageState.status);
    }

    navigate(`/contact-us?${params.toString()}`);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  if (pageState.status === 'checking') {
    return (
      <AuthLayout>
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-[#4B9EC8]" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Checking account status</h1>
          <p className="text-gray-600">Please wait while we confirm your latest review status.</p>
        </div>
      </AuthLayout>
    );
  }

  const content = statusContent[pageState.status];

  return (
    <AuthLayout>
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center">
          <div className={`mx-auto w-16 h-16 ${content.toneClass} rounded-full flex items-center justify-center mb-4`}>
            {content.icon}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{content.title}</h1>
          <p className="text-gray-600 mb-6">{content.body}</p>

          {pageState.error && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-left" role="alert">
              <div className="flex items-start">
                <AlertCircle className="w-5 h-5 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700">{pageState.error}</p>
              </div>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
              <div className="text-left">
                <p className="text-sm text-blue-800 font-medium mb-1">{content.detailTitle}</p>
                <ul className="text-sm text-blue-700 space-y-1">
                  {content.details.map((detail) => (
                    <li key={detail}>• {detail}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {pageState.status !== 'approved' && !isBlockedStatus(pageState.status) && (
              <button
                onClick={() => checkStatus()}
                disabled={isRefreshing}
                className="w-full px-6 py-3 bg-gradient-to-r from-[#4B9EC8] to-[#D96E6E] hover:from-[#3382AA] hover:to-[#BC5050] disabled:opacity-60 text-white rounded-lg font-medium transition-all shadow-md hover:shadow-lg flex items-center justify-center"
              >
                {isRefreshing ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <RefreshCw className="w-5 h-5 mr-2" />}
                Refresh Status
              </button>
            )}

            {pageState.status === 'approved' && (
              <button
                onClick={() => navigate('/community')}
                className="w-full px-6 py-3 bg-gradient-to-r from-[#4B9EC8] to-[#D96E6E] hover:from-[#3382AA] hover:to-[#BC5050] text-white rounded-lg font-medium transition-all shadow-md hover:shadow-lg flex items-center justify-center"
              >
                <Home className="w-5 h-5 mr-2" />
                Open Community
              </button>
            )}

            <button
              onClick={handleContactSupport}
              className="w-full px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center justify-center"
            >
              <Mail className="w-5 h-5 mr-2" />
              Contact Support
            </button>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                onClick={handleGoHome}
                className="w-full px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center justify-center"
              >
                <Home className="w-5 h-5 mr-2" />
                Homepage
              </button>

              {pageState.status !== 'signed_out' && (
                <button
                  onClick={handleSignOut}
                  className="w-full px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center justify-center"
                >
                  <LogOut className="w-5 h-5 mr-2" />
                  Sign Out
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}
