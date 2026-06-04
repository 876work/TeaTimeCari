# Website URL Paths

Use these paths from the site root to access the main Tea Time Cari pages.

## Public and account pages

| Path | Page |
| --- | --- |
| `/` | Home / main app landing page |
| `/signup` | Signup page |
| `/login` | Member login page |
| `/logout` | Logout page |
| `/forgot-password` | Forgot password page |
| `/reset-password` | Reset password page |
| `/kyc-pending` | KYC pending status page |
| `/contact-us` | Contact page |
| `/community` | Community redirect |
| `/sso` | SSO callback page |

## Admin pages

| Path | Page |
| --- | --- |
| `/teamin` | Admin login page |
| `/admin` | Redirects to the admin portal overview |
| `/admin/dashboard` | Admin portal overview |
| `/admin/users` | User review and registration management |
| `/admin/flagged-posts` | Flagged posts moderation |
| `/admin/discourse-admins` | Discourse/community admin management |
| `/admin/logs` | Admin logs tab |
| `/admin/function-ping` | Admin function ping diagnostics |
| `/admin/registrations` | Registration review table |

## Deployment behavior

The `public/_redirects` file contains the SPA fallback rule `/* /index.html 200`, so direct visits to client-side routes load the React app instead of returning a 404.
