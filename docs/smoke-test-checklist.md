# Smoke Test Checklist

Run this checklist after UI, routing, authentication, or admin changes. Use `npm run dev` for local checks or `npm run preview` after `npm run build` for production-bundle checks.

## Core UX flows

- [ ] Home page loads at `/` and the primary “Get Started” CTA is visible.
- [ ] Signup Step 1 validation shows required-field, email, phone, username, and password feedback.
- [ ] Signup Step 2 allows a gender choice and clearly marks the selected option.
- [ ] Camera permission error state on Signup Step 3 shows retry guidance and a Contact support link.
- [ ] Login redirects pending/non-approved users to `/kyc-pending` after authentication status is checked.
- [ ] `/community` redirects users into the configured Discourse community/category path.
- [ ] Admin user table loads at `/admin/users`, filters/search work, and destructive actions show confirmation dialogs.

## Useful commands

```bash
npm run build
npm run lint
npm run preview
```
