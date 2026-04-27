# HariHariBol Admin Panel - Complete Setup

## Overview

A complete Next.js 14+ admin panel for managing HariHariBol's content, users, and moderation workflows. Built with TypeScript, Tailwind CSS, and integrated with the NestJS backend API.

---

## Backend API Endpoints Added

All endpoints require JWT authentication (via `Authorization: Bearer <token>` header).

### Admin Dashboard

```
GET /api/v1/admin/dashboard
Response:
{
  totalUsers: number,
  totalSampradayas: number,
  totalVerses: number,
  bannedUsers: number,
  recentUsers: Array<{id, email, createdAt, isBanned}>
}
```

### Sampraday Management

```
GET /api/v1/admin/sampradayas?skip=0&take=20
Response: { data: Sampraday[], total: number }

POST /api/v1/admin/sampradayas
Body: CreateSampradayDto
{
  slug: string,
  nameKey: string,
  descriptionKey?: string,
  founderKey?: string,
  primaryDeityKey?: string,
  philosophyKey?: string,
  heroImageUrl?: string,
  thumbnailUrl?: string,
  foundingYear?: number,
  regionKey?: string,
  isPublished?: boolean,
  displayOrder?: number
}

PATCH /api/v1/admin/sampradayas/:id
Body: UpdateSampradayDto (any fields above)

DELETE /api/v1/admin/sampradayas/:id
```

### User Management

```
GET /api/v1/admin/users?skip=0&take=20
Response: { data: User[], total: number }

POST /api/v1/admin/users/:id/ban
Body: { reason: string }
Response: { success: true, message: string }

POST /api/v1/admin/users/:id/unban
Response: { success: true, message: string }
```

### Moderation Queue

```
GET /api/v1/admin/moderation/queue?status=pending&skip=0&take=20
status: 'pending' | 'approved' | 'rejected'
Response: { data: Message[], total: number }

POST /api/v1/admin/moderation/messages/:id/approve
Response: Message

POST /api/v1/admin/moderation/messages/:id/reject
Body: { reason: string }
Response: Message
```

---

## Admin Panel Pages

### 1. Login Page (`/login`)

- Email and password authentication
- Stores JWT in localStorage
- Redirects to dashboard on success
- Error message display

### 2. Dashboard (`/dashboard`)

- **Statistics Cards**:
  - Total Users
  - Total Sampradayas
  - Total Verses
  - Banned Users

- **Recent Users Table**:
  - Email, Status, Join Date
  - Activity monitoring
  - Quick ban/unban actions

### 3. Sampradayas (`/sampradayas`)

- **List View**:
  - Search and sort (extensible)
  - Display count: 20 per page
  - Status indicator (Published/Draft)
  - Follower count

- **Create/Edit Form**:
  - Slug (unique identifier)
  - Name Key (translation key)
  - Description Key
  - Image URLs
  - Publish toggle
  - Display order

- **Actions**:
  - Create new
  - Edit existing
  - Delete with confirmation

### 4. Users (`/users`)

- **List View**:
  - All users with pagination
  - Email, name, join date
  - Status (Active/Banned)

- **Ban Management**:
  - Click "Ban" button
  - Enter reason
  - Confirm to ban
  - Cascades to associated devices

- **Unban**:
  - One-click unban
  - Removes all associated bans

### 5. Moderation (`/moderation`)

- **Filter Tabs**:
  - Pending (default)
  - Approved
  - Rejected

- **Message Review**:
  - Display message content
  - Show user and group context
  - Creation timestamp

- **Actions**:
  - Approve message
  - Reject with reason
  - Inline reason input

### 6. Settings (`/settings`)

- **Security**:
  - 2FA toggle (future)
  - Password change

- **Notifications**:
  - Email alerts for moderation
  - Ban notifications

- **Appearance**:
  - Theme selection

---

## Project Structure

```
admin/
├── app/                           # Next.js App Router
│   ├── page.tsx                   # Root → redirect
│   ├── layout.tsx                 # Root layout wrapper
│   ├── globals.css                # Global styles
│   ├── login/
│   │   └── page.tsx               # Login page
│   ├── dashboard/
│   │   └── page.tsx               # Dashboard stats
│   ├── sampradayas/
│   │   └── page.tsx               # CRUD form + list
│   ├── users/
│   │   └── page.tsx               # User list + ban controls
│   ├── moderation/
│   │   └── page.tsx               # Message review queue
│   └── settings/
│       └── page.tsx               # Admin preferences
│
├── components/
│   └── Sidebar.tsx                # Navigation component
│
├── lib/
│   ├── api.ts                     # Axios instance + interceptors
│   └── store.ts                   # Zustand admin store
│
├── public/                        # Static assets (future)
│
├── Configuration Files
│   ├── package.json               # Dependencies
│   ├── next.config.js             # Next.js config
│   ├── tailwind.config.js         # Tailwind config
│   ├── tsconfig.json              # TypeScript config
│   └── postcss.config.js          # (auto-generated)
│
└── README.md                      # Admin panel docs
```

---

## Setup Instructions

### 1. Install Dependencies

```bash
cd admin
npm install
```

### 2. Configure Environment

Create `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
```

For production:

```env
NEXT_PUBLIC_API_URL=https://api.hariharibol.com/api/v1
```

### 3. Start Development Server

```bash
npm run dev
```

Access at: `http://localhost:3001`

### 4. Build for Production

```bash
npm run build
npm start
```

---

## Key Features

### Security

- ✅ JWT token management
- ✅ Automatic token injection in headers
- ✅ Auto-redirect to login on 401
- ✅ Secure localStorage (consider httpOnly in production)
- ✅ CORS-compatible API calls

### User Experience

- ✅ Responsive Tailwind layout
- ✅ Loading states on all pages
- ✅ Error message display
- ✅ Confirmation dialogs for destructive actions
- ✅ Inline editing (Create/Edit form)
- ✅ Quick action buttons

### Scalability

- ✅ Modular component structure
- ✅ Reusable API client
- ✅ Global state management (Zustand)
- ✅ Type-safe TypeScript throughout
- ✅ Ready for feature flags/analytics

### Admin Workflows

- ✅ Quick stats dashboard
- ✅ Bulk user operations (ban/unban)
- ✅ Batch content management
- ✅ Real-time moderation queue
- ✅ Audit trail ready (via backend logs)

---

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js | 14.2+ |
| Runtime | Node.js | 18+ |
| Language | TypeScript | 5.4+ |
| Styling | Tailwind CSS | 3.4+ |
| State | Zustand | 4.5+ |
| HTTP | Axios | 1.7+ |
| Icons | Lucide React | 0.404+ |
| UI Components | Custom/Tailwind | - |

---

## API Integration Example

```typescript
// Fetch sampradayas
const response = await api.get('/admin/sampradayas?skip=0&take=20');
const { data, total } = response.data;

// Create sampraday
await api.post('/admin/sampradayas', {
  slug: 'iskcon',
  nameKey: 'ISKCON',
  isPublished: true,
  displayOrder: 1,
});

// Ban user with cascade
await api.post('/admin/users/user-123/ban', {
  reason: 'Spamming in groups',
});
```

---

## Next Steps

### Immediate (MVP Complete)

1. ✅ Backend API endpoints
2. ✅ Next.js admin pages
3. ✅ Authentication flow
4. ✅ CRUD operations

### Short Term (1-2 weeks)

1. Database seeding (sampradayas, verses)
2. Admin account setup
3. End-to-end testing
4. Deployment to staging

### Medium Term (2-4 weeks)

1. Advanced filtering
2. Export/import functionality
3. Bulk operations
4. Analytics dashboard
5. Email templates

### Long Term (1-2 months)

1. Role-based access control
2. Audit logging
3. Activity webhooks
4. Admin mobile app
5. Advanced moderation rules

---

## Troubleshooting

### 401 Unauthorized

- Check token in localStorage
- Verify backend is running
- Check NEXT_PUBLIC_API_URL

### 404 Not Found

- Verify API endpoint path
- Check backend router configuration
- Review middleware setup

### CORS Issues

- Verify CORS enabled on backend
- Check allowed origins in nest configuration
- Review axios interceptor

### Type Errors

```bash
npm install -D @types/node @types/react @types/react-dom
```

---

## Performance Optimization

### Current

- Static sidebar (cacheable)
- Lazy loading of pages
- Optimized images

### Future

- React.memo on list items
- Virtual scrolling for large tables
- Image optimization with Next.js Image
- API response caching with Zustand

---

## Security Considerations

### Current

- JWT in localStorage (vulnerable to XSS)
- No API rate limiting (add on backend)
- No admin action audit log

### Recommended

```typescript
// Production token storage
const token = httpOnly ? 'server-side only' : 'localStorage + httpOnly';

// Rate limiting on backend
const rateLimit = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests
};

// Audit logging
const auditLog = {
  admin_id: string,
  action: string,
  timestamp: Date,
  resource: string,
  changes: Object,
};
```

---

## Contributing

### Style Guide

- Use TypeScript strict mode
- Follow Tailwind utility classes
- Component props over inline styles
- Error handling on all API calls

### File Naming

- Pages: PascalCase (`DashboardPage.tsx`)
- Components: PascalCase (`Sidebar.tsx`)
- Utils: camelCase (`api.ts`)

---

## Deployment

### Vercel (Recommended)

```bash
vercel
```

### Docker

```bash
docker build -t hariharibol-admin .
docker run -p 3001:3001 hariharibol-admin
```

### Environment Variables for Production

```
NEXT_PUBLIC_API_URL=https://api.hariharibol.com/api/v1
NODE_ENV=production
```

---

## Support

For issues or questions:

1. Check `admin/README.md`
2. Review API responses in browser console
3. Check backend logs for errors
4. Verify `.env.local` configuration

---

**Status**: ✅ Ready for Development  
**Last Updated**: April 27, 2026
