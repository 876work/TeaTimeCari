import React from "react";
import { Link } from "react-router-dom";

const PendingApproval: React.FC = () => {
  return (
    <div className="max-w-md mx-auto p-6">
      <div className="rounded-2xl border p-6 shadow-sm bg-white">
        <h1 className="text-xl font-semibold mb-2">Application submitted</h1>
        <p className="text-sm text-gray-600 mb-4">
          Thanks! A team member will review your application. If approved, you'll receive an email with a 6-digit code and a verification link.
        </p>

        <div className="text-sm text-gray-600 mb-6">
          You can close this page. We'll notify you via email when it's your turn.
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-xl px-4 py-2 border bg-black text-white"
          >
            Go to Home
          </Link>
          <Link
            to="/help"
            className="inline-flex items-center justify-center rounded-xl px-4 py-2 border"
          >
            Need help?
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PendingApproval;