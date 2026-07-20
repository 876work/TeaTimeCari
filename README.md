# Tea Time Cari

Tea Time Cari is a community platform designed for authentic conversations and connections, featuring gender-gated content, photo sharing, and a robust KYC (Know Your Customer) verification process. It integrates seamlessly with Discourse for forum functionalities, ensuring a secure and moderated environment for all users.

## 🌟 Features

### Core Platform Features
- **Multi-Step User Registration:** A guided registration process with invite code validation
- **KYC Verification:** Users submit selfie or ID photos for identity verification, reviewed by administrators
- **Gender-Gated Feeds:** Users can access content shared by individuals of their own gender
- **Premium Cross-Gender Feed:** Exclusive section allowing access to content from the opposite gender (paid feature)
- **Post Management:** Users can upload photos with community feedback via green/red flag counts
- **Commenting System:** Engage with posts through anonymous comments
- **Real-time & Push Notifications:** Users receive in-app notifications for new comments, replies, and post flags, with an optional browser push opt-in so they're notified even when the app isn't open

### Administrative Features
- **Admin Dashboard:** Comprehensive portal for administrators featuring:
  - User registration review and approval/rejection
  - Flagged post moderation
  - Invite code management
  - System activity monitoring and health checks
  - Moderation logs and analytics
  - Geography map: country-level member distribution (choropleth + bubbles) built from existing IP-based location tracking — aggregated only, no precise member locations

### Security & Integration
- **Discourse SSO Integration:** Seamless Single Sign-On with Discourse forum
- **Secure Authentication:** Email/password login with password reset functionality
- **Payment Processing:** Stripe integration for premium features
- **Email & SMS Notifications:** Automated communication via Resend and Twilio

## 🛠 Technologies Used

### Frontend
- **[React](https://react.dev/)** - Modern JavaScript library for building user interfaces
- **[TypeScript](https://www.typescriptlang.org/)** - Type-safe JavaScript development
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS framework for rapid UI development
- **[Vite](https://vitejs.dev/)** - Lightning-fast build tool and development server
- **[Lucide React](https://lucide.dev/)** - Beautiful, customizable SVG icons
- **[Leaflet](https://leafletjs.com/)** + **[React Leaflet](https://react-leaflet.js.org/)** - Interactive maps for admin geographic analytics (OpenStreetMap tiles, no API key required)

### Backend & Database
- **[Supabase](https://supabase.com/)** - Complete backend solution providing:
  - PostgreSQL database with Row Level Security (RLS)
  - Authentication and user management
  - File storage for user uploads
  - Edge Functions for serverless computing
  - Real-time subscriptions

### Payment & Communication
- **[Stripe](https://stripe.com/)** - Secure payment processing for premium features
- **[Resend](https://resend.com/)** - Transactional email delivery
- **[Twilio](https://www.twilio.com/)** - SMS messaging service

### Forum Integration
- **[Discourse](https://www.discourse.org/)** - Open-source discussion platform with SSO integration

## 🚀 Setup and Installation

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn package manager
- A Supabase project
- (Optional) Discourse forum instance
- (Optional) Stripe account for payments
- (Optional) Resend account for emails
- (Optional) Twilio account for SMS

### 1. Clone the Repository
```bash
git clone <your-repository-url>
cd tea-time-cari
npm install
```

### 2. Supabase Setup

#### Create Project
1. Create a new project on [Supabase](https://app.supabase.com/)
2. Get your Project URL and Anon Key from Project Settings > API

#### Database Setup
The application uses several database tables. The main schema is defined in `db/migrations/001_profiles.sql`:

**⚠️ Important:** This migration drops the `profiles` table if it exists. Use only for fresh environments.

Apply the migration by:
1. Opening Supabase Dashboard > Database > SQL Editor
2. Pasting the contents of `db/migrations/001_profiles.sql`
3. Running the query

#### Deploy Edge Functions
Deploy all Supabase Edge Functions:

```bash
# Install Supabase CLI first
npm install -g supabase

# Login to Supabase
supabase login

# Deploy all functions
supabase functions deploy --project-ref <your-project-ref>
```

### 3. Environment Configuration

Create a `.env` file in the project root:

```env
# Supabase Configuration (Required)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Site Configuration (Required)
SITE_BASE_URL=http://localhost:5173

# KYC JWT Secret (Required for verification tokens)
KYC_JWT_SECRET=your-secure-jwt-secret-here

# Discourse SSO Configuration (Optional)
DISCOURSE_BASE_URL=https://your-forum.discourse.com
DISCOURSE_ADMIN_API_KEY=your-discourse-admin-api-key
DISCOURSE_ADMIN_API_USERNAME=system
DISCOURSE_SSO_SECRET=your-shared-sso-secret

# Discourse Groups (Optional)
MEN_GROUP=men-slu
WOMEN_GROUP=women-slu
XACCESS_GROUP=xaccess
SEND_DISCOURSE_ACTIVATION=true
```

For deployed Supabase Edge Functions, set the server-side values above as Supabase secrets, not only as frontend hosting variables. `DISCOURSE_SSO_SECRET` is required for Discourse SSO login. `DISCOURSE_ADMIN_API_KEY` is only required for the optional approval-time pre-sync that makes approved users appear in Discourse immediately.

DiscourseConnect identity depends on a stable `external_id`; this app uses the Supabase registration/user ID for that value. Never regenerate the Supabase ID for the same user. See [`docs/discourse-sso-identity.md`](docs/discourse-sso-identity.md) for the internal permanence requirement. Discourse group and category privacy rules are documented in [`docs/discourse-permissions.md`](docs/discourse-permissions.md).

```bash
supabase secrets set \
  DISCOURSE_BASE_URL=https://community.teatimecari.app \
  DISCOURSE_SSO_SECRET=your-shared-sso-secret \
  DISCOURSE_ADMIN_API_KEY=your-discourse-admin-api-key \
  DISCOURSE_ADMIN_API_USERNAME=system
```

```env

# Stripe Configuration (Optional)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your-stripe-key
STRIPE_SECRET_KEY=sk_test_your-stripe-secret
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret

# Resend Configuration (Optional)
RESEND_API_KEY=re_your-resend-api-key
RESEND_FROM_EMAIL=noreply@your-domain.com
RESEND_FROM_NAME=Tea Time Cari

# Twilio Configuration (Optional)
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_FROM_NUMBER=+1234567890
```

#### Web Push Notifications (Optional)

Lets approved users opt in (via the bell icon in the header) to receive a
browser push notification — even when the app tab is closed — when someone
comments, replies, or flags their post.

1. Generate a VAPID key pair:
   ```bash
   npx web-push generate-vapid-keys
   ```
2. Set the public key for the frontend build and the private key + subject as
   Supabase Edge Function secrets:
   ```bash
   supabase secrets set \
     VAPID_PUBLIC_KEY=your-vapid-public-key \
     VAPID_PRIVATE_KEY=your-vapid-private-key \
     VAPID_SUBJECT=mailto:admin@your-domain.com \
     PUSH_WEBHOOK_SECRET=a-long-random-shared-secret
   ```
   Add `VITE_VAPID_PUBLIC_KEY=your-vapid-public-key` (same value as above) to
   your frontend `.env` / hosting provider env vars.
3. Deploy the `send-push-notification` function:
   ```bash
   supabase functions deploy send-push-notification --project-ref <your-project-ref>
   ```
4. In the Supabase Dashboard, go to **Database → Webhooks → Create a new
   webhook**, and configure:
   - Table: `notifications`
   - Events: `Insert`
   - Type: `HTTP Request`, method `POST`
   - URL: `https://<your-project-ref>.functions.supabase.co/send-push-notification`
   - Headers: `Content-Type: application/json` and
     `x-webhook-secret: <the PUSH_WEBHOOK_SECRET value from step 2>`

If these are left unset, the push opt-in toggle simply won't appear (browser
support check fails without `VITE_VAPID_PUBLIC_KEY`), and the app continues
to work exactly as before via in-app/realtime notifications.

### 4. Start Development Server
```bash
npm run dev
```

Visit `http://localhost:5173` to see the application running.


### Discourse User Download Watermark Plugin

This repository also includes a server-side Discourse plugin at [`discourse-user-download-watermark/`](discourse-user-download-watermark/) for serving temporary, per-user watermarked derivatives of post upload image downloads. The plugin keeps original Discourse uploads unchanged, checks Discourse permissions before generating a derivative, and documents installation/testing in its plugin README.

## 📊 Database Schema

### Core Tables

#### `profiles`
Main user profile table with KYC status and Discourse integration:
```sql
- id (uuid, primary key, references auth.users)
- email (text, unique)
- username (text)
- full_name (text)
- kyc_status ('pending' | 'approved' | 'rejected')
- gender ('men' | 'women')
- xaccess (boolean) - Premium cross-gender access
- approved_at (timestamptz)
- created_at, updated_at (timestamptz)
```

#### `registrations`
Temporary registration data during signup process:
```sql
- id (uuid, primary key)
- firstName, lastName, email, phone, username (text)
- gender ('Male' | 'Female')
- captureType ('selfie' | 'id')
- imageData (text) - Base64 encoded verification photo
- status ('pending' | 'approved' | 'rejected' | 'banned')
- invite_code_used (text)
- Various KYC and email verification fields
```

#### `posts`
User-uploaded content:
```sql
- id (uuid, primary key)
- user_id (uuid, foreign key)
- username, gender (text)
- photo_url (text)
- green_flag_count, red_flag_count (integer)
- created_at (timestamptz)
```

#### `comments`
Post comments and replies:
```sql
- id (uuid, primary key)
- post_id, user_id (uuid, foreign keys)
- username, gender, content (text)
- parent_comment_id (uuid) - For threaded replies
- created_at (timestamptz)
```

#### `payments`
Stripe payment records:
```sql
- id (uuid, primary key)
- user_id (uuid, foreign key)
- stripe_payment_intent_id (text, unique)
- feed_access ('opposite')
- amount (integer), currency (text)
- status ('pending' | 'completed' | 'failed')
- expires_at (timestamptz)
```

## 🔄 User Journey & KYC Flow

### 1. Registration Process
1. **Invite Code Entry:** User enters a valid invitation code
2. **Basic Information:** Name, email, phone, username validation
3. **Gender Selection:** Choose Male or Female (permanent choice)
4. **Photo Verification:** Live camera capture of selfie or ID document
5. **Pending Approval:** Application submitted for admin review

### 2. Admin Review Process
1. **Admin Login:** Administrators access `/teamin` with special credentials
2. **User Review:** View pending registrations with submitted photos
3. **Approval Decision:** 
   - **Approve:** Triggers KYC approval and Discourse sync
   - **Reject:** Sends rejection email with reason
4. **Discourse Integration:** Approved users are automatically provisioned in Discourse with appropriate group memberships

### 3. User Activation
1. **Approval Email:** User receives email with 6-digit verification code
2. **Code Verification:** User enters code via verification link
3. **Password Setup:** User creates account password
4. **Account Active:** Full platform access granted

### 4. Discourse SSO Flow
1. **Forum Access:** User visits Discourse forum
2. **SSO Redirect:** Discourse redirects to Tea Time Cari SSO endpoint
3. **Status Check:** System verifies user's KYC approval status
4. **Group Assignment:** User granted access to appropriate Discourse groups based on gender and premium status
5. **Forum Login:** User seamlessly logged into Discourse with proper permissions

## 🔐 Security Features

### Authentication & Authorization
- **Row Level Security (RLS):** All database tables protected with PostgreSQL RLS policies
- **JWT Token Verification:** Secure token-based authentication for KYC processes
- **Admin Role Verification:** Administrative functions protected by role-based access control
- **Session Management:** Secure session handling with automatic expiration

### Data Protection
- **Image Processing:** Automatic EXIF metadata removal from uploaded photos
- **Verification Photo Handling:** See [`docs/verification-photo-storage.md`](docs/verification-photo-storage.md) for restricted selfie/ID review, retention, visibility, and deletion expectations
- **Password Security:** Secure password hashing via Supabase Auth
- **Payment Security:** PCI-compliant payment processing through Stripe
- **CORS Protection:** Proper Cross-Origin Resource Sharing configuration

### Content Moderation
- **Flag System:** Community-driven content flagging (green/red flags)
- **Admin Moderation:** Manual review of flagged content
- **User Banning:** Administrative ability to ban problematic users
- **Audit Logging:** Complete moderation action logging

## 💳 Payment Integration

The platform includes Stripe integration for premium features:

### Premium Access
- **Cross-Gender Feed:** $29.99 for 3-day access to opposite gender content
- **Secure Processing:** PCI-compliant payment handling
- **Automatic Expiration:** Access automatically expires after 3 days
- **Webhook Integration:** Real-time payment status updates

### Payment Flow
1. User selects premium access
2. Stripe payment form with secure card input
3. Payment intent created via Edge Function
4. Stripe processes payment securely
5. Webhook confirms payment success
6. User granted immediate access to premium content

## 🔧 Development

### Available Scripts
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

### Environment Setup
1. Copy `.env.example` to `.env`
2. Fill in your Supabase credentials
3. Configure optional services (Stripe, Resend, Twilio, Discourse)
4. Deploy Edge Functions to Supabase
5. Run database migrations

### Testing Edge Functions
Use the built-in Function Ping tool at `/admin` > "Function Ping (Dev)" to test Edge Function connectivity and responses.

## 📱 Responsive Design

The application is fully responsive and optimized for:
- **Mobile devices** (320px and up)
- **Tablets** (768px and up)  
- **Desktop** (1024px and up)
- **Large screens** (1440px and up)

## 🌐 Deployment

### Netlify (Recommended)
The application is optimized for Netlify deployment:

1. **Build Command:** `npm run build`
2. **Publish Directory:** `dist`
3. **Environment Variables:** Configure all required environment variables in Netlify dashboard

### Other Platforms
The application can be deployed to any static hosting service that supports:
- Node.js build process
- Environment variable configuration
- SPA routing (for React Router)

## 🤝 Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript best practices
- Maintain component modularity (max 200 lines per file)
- Use proper error handling and validation
- Write descriptive commit messages
- Test thoroughly before submitting PRs

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- **Issues:** Open a GitHub issue for bugs or feature requests
- **Documentation:** Check this README and inline code comments
- **Contact:** Use the built-in contact form at `/contact-us`

## 🔮 Roadmap

Future enhancements planned:
- [ ] Mobile app development (React Native)
- [ ] Advanced analytics dashboard
- [ ] AI-powered content moderation
- [ ] Multi-language support
- [ ] Enhanced notification system
- [ ] Social features expansion

---

**Live Demo:** [https://teatimecari.netlify.app](https://teatimecari.netlify.app)

Built with ❤️ using modern web technologies and best practices.