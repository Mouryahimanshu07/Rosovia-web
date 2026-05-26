# Feature Roadmap — Rosovia

This document outlines the current feature state of the Rosovia talent marketplace and the roadmap toward the next production-level releases.

---

## 🚀 Completed MVP Features (Milestones B - L)

We have successfully implemented and hardened the core features of the Rosovia monorepo:

### 1. Payment Hardening & Disabling (Module B)
- **Central HSL Configuration**: Integrated central HSL-colored typed flags (`PAYMENTS_ENABLED`, `LIVE_PAYMENTS_ENABLED`) protecting all checkout routes.
- **Graceful Downgrades**: Standard checkout is disabled with friendly warnings, routing buyers to inquiries and custom negotiation pipelines instead.

### 2. Enhanced Public Profiles & Search (Modules C & J)
- **Trust Surfacing**: Surgically embedded verified blue badges and star rating averages across public directories, listing detail pages, and search listing cards.
- **Blended Postgres Search**: Fully patched PostgreSQL `search_listings_ranked()` RPC to support fuzzy typotolerance trigrams, recency boosts, and verified creator priority sorting.
- **Top Rated Sorting**: Exposed advanced filters like "Top Rated" (`rating_high`) on directory pages.

### 3. Bookmarks & Collections (Modules D & E)
- **Saved Bookmarks**: Dual-tab buyer panel that supports adding, searching, and toggling saved listings and creators in real time.
- **Featured Showcases**: Creator portfolio showcases where approved listings can be categorized and displayed under custom showcases on creator public pages.

### 4. Inquiry and Custom Order Hardening (Module F)
- **Server Validation**: Reinforced custom order quoting pipelines with Zod boundaries, ensuring budget caps, character limits, and structural timeline restraints are enforced.
- **ESU Escrow Flow**: Quoting negotiations (quoted -> accepted) work completely, preparing the marketplace for automated payment escrow integrations.

### 5. Persistent Notifications & Secure DMs (Modules G & H)
- **Notification Inbox**: Glassmorphic dashboard panel categorizing notifications (messages, inquiries, custom orders) with optimistic read syncs.
- **DM Participants Guard**: Bounded conversational messaging at the service layer, preventing posts on inactive or suspended accounts, and triggering automatic message notifications.

### 6. Backend Hardening & Coverage (Modules K & L)
- **Edge Rate-Limiting**: Connected global IP-based sliding rate-limiting middleware (defaulting to 100 requests/minute) with standard API headers.
- **Admin Server Guards**: Reinforced admin `service_role` clients with runtime browser execution checks to block any client-side token exposure.
- **Vast Test Coverage**: Implemented a comprehensive testing suite comprising **218 passing Vitest tests** covering all core schemas, validators, and service boundaries.

---

## 🔮 Future Development Milestones

We look forward to developing the following capabilities in the next releases:

### Phase 2: Automated Payments & Escrow
- **Escrow Release**: Hook up automated Razorpay Capture API to release held escrow funds to creators when the buyer confirms delivery.
- **Automated Refunds**: Connect Razorpay Refund API to immediately return escrow funds on disputed orders resolved in the buyer's favor.

### Phase 3: Automated Content & Media Moderation
- **AI Scanning**: Connect third-party image/text analysis APIs (e.g. AWS Rekognition) to scan listing pictures and bio stories for inappropriate content before review.
- **Spam Filtering**: Implement automated machine learning spam classifiers to evaluate incoming buyer inquiries.

### Phase 4: Bank Transfers & Payouts
- **RazorpayX Integration**: Automate the manual admin payout flow by connecting RazorpayX or bank transfer APIs to disburse earnings directly to creators' linked bank accounts upon order completion.
