// BEFORE RUNNING: Set up Clerk
// 1. Go to https://clerk.com and create a free account + new application
// 2. Copy your Publishable Key and add it to frontend/.env.local:
//      VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
// 3. Copy your Secret Key (starts with sk_) and add it to backend/.env:
//      CLERK_SECRET_KEY=sk_test_...
//      CLERK_JWKS_URL=https://<your-clerk-domain>/.well-known/jwks.json
//    (find your Clerk domain in Dashboard -> API Keys)

// This file is intentionally sparse -- Clerk is configured via ClerkProvider in main.tsx
export {};
