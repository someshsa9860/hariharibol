# HariHariBol Admin Panel

Next.js 14+ admin dashboard for managing HariHariBol content, users, and moderation.

## Features

- 📊 **Dashboard** - Overview of users, traditions, verses, and activity
- 📚 **Content Management** - Create, edit, delete sampradayas with full metadata
- 👥 **User Management** - View all users with ban/unban functionality
- 🚨 **Moderation Queue** - Review and approve/reject user messages
- ⚙️ **Settings** - Admin security, notifications, and preferences

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **State**: Zustand
- **HTTP**: Axios with interceptors
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **UI Components**: Custom components

## Getting Started

### Installation

```bash
cd admin
npm install
```

### Configuration

Create a `.env.local` file:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
```

### Development

```bash
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser.

### Build for Production

```bash
npm run build
npm start
```

## Project Structure

```
admin/
├── app/
│   ├── page.tsx              # Root (redirects to login/dashboard)
│   ├── layout.tsx            # Root layout
│   ├── globals.css           # Global styles
│   ├── login/
│   │   └── page.tsx          # Login page
│   ├── dashboard/
│   │   └── page.tsx          # Dashboard with stats
│   ├── sampradayas/
│   │   └── page.tsx          # Sampraday CRUD
│   ├── users/
│   │   └── page.tsx          # User management & bans
│   ├── moderation/
│   │   └── page.tsx          # Moderation queue
│   └── settings/
│       └── page.tsx          # Admin settings
├── components/
│   └── Sidebar.tsx           # Navigation sidebar
├── lib/
│   ├── api.ts                # Axios instance with interceptors
│   └── store.ts              # Zustand store
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

## Features in Detail

### Dashboard

- **Statistics**: Total users, sampradayas, verses, banned users
- **Recent Activity**: Latest user signups with status
- **Quick Actions**: Navigate to content management

### Sampraday Management

- **List**: View all traditions with follower counts and status
- **Create**: Add new sampraday with metadata
- **Edit**: Update existing sampraday details
- **Delete**: Remove sampraday (with confirmation)
- **Publish**: Toggle draft/published status

### User Management

- **List**: View all users with join dates
- **Ban**: Disable user account with reason
- **Unban**: Re-enable banned user accounts
- **Ban Cascade**: Automatically bans associated devices

### Moderation Queue

- **Filter**: View pending, approved, or rejected messages
- **Approve**: Mark messages as safe for publication
- **Reject**: Flag messages with custom reason
- **Review**: See user and group context for each message

### Settings

- **Security**: 2FA, password change (future implementation)
- **Notifications**: Email alerts for moderation and bans
- **Appearance**: Theme selection

## API Integration

### Authentication

Tokens are stored in `localStorage` and automatically injected into all API requests via Axios interceptors.

```typescript
// Login
POST /auth/google
POST /auth/apple

// Dashboard
GET /admin/dashboard

// Sampradayas
GET /admin/sampradayas
POST /admin/sampradayas
PATCH /admin/sampradayas/:id
DELETE /admin/sampradayas/:id

// Users
GET /admin/users
POST /admin/users/:id/ban
POST /admin/users/:id/unban

// Moderation
GET /admin/moderation/queue
POST /admin/moderation/messages/:id/approve
POST /admin/moderation/messages/:id/reject
```

## Styling

### Color Scheme

- **Primary**: #C75A1A (Orange-brown)
- **Secondary**: #8B4513 (Saddle brown)
- **Accent**: #DAA520 (Goldenrod)
- **Light**: #FBF7EF (Cream background)
- **Dark**: #1A1410 (Dark brown text)

### Custom Classes

- `.card` - White card with shadow
- `.btn-primary` - Primary action button
- `.btn-secondary` - Secondary action button
- `.input-field` - Form input styling
- `.table-cell` - Table cell padding
- `.sidebar-active` - Active sidebar item

## Development Guidelines

### Component Structure

```typescript
'use client'; // Mark client components

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';

export default function PageName() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await api.get('/endpoint');
      setData(response.data.data || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  return <main>...</main>;
}
```

### Error Handling

- Axios interceptor automatically redirects to `/login` on 401
- Display user-friendly error messages
- Use console.error for debugging

### State Management

Use Zustand store for admin state:

```typescript
import { useAdminStore } from '@/lib/store';

const { admin, logout, setError } = useAdminStore();
```

## Future Enhancements

- [ ] Advanced filtering and search
- [ ] Bulk actions (ban multiple users)
- [ ] Analytics and charts
- [ ] Admin audit logs
- [ ] Role-based access control
- [ ] Email templates management
- [ ] A/B testing features
- [ ] Export/import functionality

## Testing

```bash
npm run dev
# Manual testing via http://localhost:3001
```

## Deployment

### Vercel (Recommended)

```bash
vercel deploy
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build
EXPOSE 3001
CMD ["npm", "start"]
```

### Environment Variables

```env
NEXT_PUBLIC_API_URL=https://api.hariharibol.com/api/v1
```

## License

Private project for HariHariBol.
