# HariHariBol Project Guide for Claude

## Project Overview

**HariHariBol** is a comprehensive spiritual learning platform combining:
- **Mobile App** (Flutter) - iOS & Android client for verse learning, chanting, and spiritual content
- **Backend API** (NestJS) - RESTful API with PostgreSQL, real-time features, and AI integration
- **Admin Panel** (Next.js) - Content management, user moderation, analytics, and configuration
- **AI Integration** - Gemini and OpenAI support for verse selection, explanations, and image generation

### Core Mission
Provide accessible, personalized spiritual guidance through Vedic verses, mantras, narrations, and interactive features with AI-powered recommendations.

### Tech Stack
- **Backend**: NestJS 10+, Prisma ORM, PostgreSQL, JWT Auth, Firebase Cloud Messaging
- **Mobile**: Flutter 3.x, Riverpod, GetIt, Dio, Secure Storage
- **Admin**: Next.js 14+, React 18, TypeScript, Tailwind CSS, Zustand, Axios
- **Infrastructure**: Local/S3 Storage, Redis Cache, Firebase, Bull Queue
- **AI**: Google Gemini (preferred), OpenAI GPT, Image Generation

---

## ✅ Completed Features

### Authentication & Security
- ✅ OAuth 2.0 (Google & Apple sign-in)
- ✅ JWT token generation with 15-min expiry
- ✅ Refresh token rotation system
- ✅ Device tracking and fingerprinting
- ✅ Email & device-level ban cascade system
- ✅ JwtGuard with @Public() decorator for open endpoints
- ✅ Axios interceptors for automatic token injection and 401 handling

### Core Content Modules
- ✅ Sampradayas (spiritual traditions) - CRUD with follow/unfollow
- ✅ Books (Vedic texts) - Full management with chapters
- ✅ Verses (individual Sanskrit verses) - Complete verse system with search
- ✅ Mantras (chants) - With category support and recommendation counts
- ✅ Narrations (audio stories) - With saint attribution
- ✅ Translations (multi-language) - Key-based translation system
- ✅ Languages - 50+ language support

### User Features
- ✅ User profiles with language preferences
- ✅ User follow system for sampradayas
- ✅ Favorite/bookmark system for verses and mantras
- ✅ Chanting logs with count tracking
- ✅ Guru affinity signal (personalization algorithm)

### Storage System (Complete Redesign)
- ✅ **Factory Pattern** - Switches between S3 and local storage seamlessly
- ✅ **Public/Private Organization** - Separate folder structures for access control
- ✅ **Image Variants** - Auto-generates sm (240x240), md (480x480), lg (1024x1024)
- ✅ **WebP Compression** - Quality: sm=80, md=85, lg=90
- ✅ **Content-Based Paths** - sampradayas/{id}, books/{id}, verses/{id}, users/{id}, etc.
- ✅ **Centralized Configuration** - All storage config in one place

### Admin Panel
- ✅ **Dashboard** - Total users, sampradayas, verses, banned users stats
- ✅ **Sampradayas Management** - CRUD with image uploads (hero & thumbnail)
- ✅ **User Management** - List, ban, unban with reasons
- ✅ **Moderation Queue** - Message filtering, approve/reject with reasons
- ✅ **Settings** - Security, notifications, appearance
- ✅ **Analytics Dashboard** - Metrics, user growth charts, engagement data
- ✅ **Verse of Day Management** - Manual selection, AI generation, image creation
- ✅ **File Upload Endpoints** - For all content types with variant generation

### Verse of Day System
- ✅ **Manual Selection** - Select any verse for any date
- ✅ **AI Generation** - Auto-select using Gemini or OpenAI
- ✅ **Image Generation** - Create spiritual artwork (placeholder ready)
- ✅ **Explanation** - AI-generated insights about selected verse
- ✅ **Configuration UI** - Provider selection, API key management
- ✅ **History Tracking** - View previous verses of day
- ✅ **Public API** - Access without authentication
- ✅ **Admin API** - Full management endpoints

### Notifications System
- ✅ **Multi-Type Support** - Email, push (FCM), in-app notifications
- ✅ **FCM Topic System** - Broadcast to verse-of-day, announcements topics
- ✅ **Topic Management** - Subscribe/unsubscribe devices
- ✅ **Scalable Architecture** - No individual token overhead
- ✅ **Helper Methods** - Specialized notification triggers

### AI Integration
- ✅ **AIProviderService** - Wrapper for multiple AI providers
- ✅ **Gemini Support** - Text and image generation (preferred default)
- ✅ **OpenAI Support** - GPT and DALL-E integration
- ✅ **Content Moderation** - Safety checking for user content
- ✅ **Token Counting** - API usage tracking

### Mobile App
- ✅ **Clean Architecture** - Domain/Data/Presentation layers
- ✅ **Riverpod State Management** - Reactive, testable
- ✅ **Auth Flow** - OAuth, device tracking, automatic refresh
- ✅ **Splash Screen** - Auto-auth check with animation
- ✅ **Login Page** - OAuth buttons for Google and Apple
- ✅ **Home Screen** - Verse of Day, sampraday list, followed list, random verse
- ✅ **Verse Detail** - Full verse with Sanskrit, transliteration, meaning
- ✅ **Design Alignment** - Matches HTML mockup (#C75A1A primary color)
- ✅ **Pull-to-Refresh** - Reload content on home screen

### Data Validation & Security
- ✅ DTOs with validation decorators
- ✅ Input sanitization for file uploads
- ✅ Rate limiting support (infrastructure ready)
- ✅ CORS configuration
- ✅ Helmet middleware for HTTP headers

### Database & ORM
- ✅ Complete Prisma schema (532+ lines)
- ✅ Proper relationships and cascading
- ✅ Indexes on frequently queried fields
- ✅ Transaction support ready
- ✅ Migration system integrated

### Code Organization
- ✅ Feature-based module structure
- ✅ Separation of concerns (service/controller/dto)
- ✅ Dependency injection throughout
- ✅ Environment-based configuration
- ✅ Error handling with proper HTTP codes

---

## 🔄 Pending Work (Priority Order)

### HIGH PRIORITY

#### 1. Real Image Generation Implementation
- **Task**: Replace placeholder image generation with actual API calls
- **Providers**: 
  - Gemini Vision API for text-to-image
  - DALL-E 3 for OpenAI option
- **Files to Update**:
  - `src/infrastructure/ai/ai-provider.service.ts` - `generateImage()` method
  - `src/modules/verses/verse-of-day.service.ts` - Integration testing
- **Estimated Time**: 4-6 hours
- **Blocker**: None, can be done independently

#### 2. Database Migration & Deployment
- **Task**: Create and run Prisma migration for new models
- **New Models**: VerseOfDay, FCMTopic, FCMSubscription
- **Command**: `npx prisma migrate dev --name add_verse_of_day_and_fcm`
- **Verify**: All models created successfully
- **Estimated Time**: 1-2 hours

#### 3. Firebase Cloud Messaging Setup
- **Task**: Configure Firebase project and FCM initialization
- **Requirements**:
  - Firebase console project created
  - Service account key generated
  - FCM enabled for project
  - Send device tokens from mobile app
- **Files to Create**:
  - `src/infrastructure/fcm/fcm.service.ts` - Real FCM implementation
- **Implementation**: Topic subscription and notification sending
- **Estimated Time**: 6-8 hours

#### 4. AppSettings Table & Persistence
- **Task**: Create database table for persistent configuration
- **Model**: AppSettings (key-value store or individual fields)
- **Use Case**: Store AI provider config, API keys, feature flags
- **Security**: Encrypt sensitive fields
- **Files to Update**:
  - `prisma/schema.prisma` - Add AppSettings model
  - `src/modules/verses/verse-of-day.service.ts` - Use AppSettings
  - `src/modules/admin/admin.service.ts` - Settings management
- **Estimated Time**: 3-4 hours

### MEDIUM PRIORITY

#### 5. Email Notifications Service
- **Task**: Implement actual email sending
- **Providers**: SendGrid, AWS SES, or Resend
- **Setup Required**:
  - Email template system
  - SMTP configuration
  - Unsubscribe handling
- **Files to Update**:
  - `src/modules/notifications/notifications.service.ts` - `sendEmailNotification()`
- **Estimated Time**: 4-5 hours

#### 6. Scheduled Verse Generation
- **Task**: Automatic daily verse generation at specific time
- **Implementation**: Bull Queue job + Cron trigger
- **Configuration**: Set via admin panel
- **Fallback**: Manual selection if AI fails
- **Files to Create**:
  - `src/modules/verses/verse-of-day.scheduler.ts`
- **Estimated Time**: 3-4 hours

#### 7. Multi-Language Verse Generation
- **Task**: Generate verses and explanations in user's language preference
- **Implementation**: Update AI prompts with language context
- **Database**: Store translations of explanations
- **Files to Update**:
  - `src/modules/verses/verse-of-day.service.ts` - Add language parameter
  - Verse of Day controller - Accept language query param
- **Estimated Time**: 4-6 hours

#### 8. User Notification Preferences
- **Task**: Allow users to manage notification settings
- **Features**:
  - Topic subscriptions
  - Notification frequency
  - Quiet hours
  - Content preferences
- **Endpoints**: 
  - GET/PATCH `/api/v1/users/notification-preferences`
- **Files to Create**:
  - `src/modules/users/user-preferences.service.ts`
- **Estimated Time**: 4-5 hours

#### 9. Analytics Enhancement
- **Task**: Add more detailed metrics and dashboards
- **Features**:
  - Verse engagement metrics
  - User retention curves
  - Feature adoption rates
  - Revenue analytics (if monetized)
- **Files to Update**:
  - `src/modules/analytics/analytics.service.ts` - Add new queries
  - `admin/app/analytics/page.tsx` - More charts and visualizations
- **Estimated Time**: 5-7 hours

#### 10. Chatbot/GuruDev AI Integration
- **Task**: Implement actual AI chatbot for spiritual guidance
- **Features**:
  - Context-aware responses
  - Citation of relevant verses
  - Conversation history
  - Moderation of responses
- **Files to Update**:
  - `src/modules/chatbot/chatbot.service.ts` - Real AI implementation
  - `src/modules/chatbot/chatbot.controller.ts` - Streaming support
- **Estimated Time**: 8-10 hours

### LOW PRIORITY (Nice to Have)

#### 11. Admin Role-Based Access Control
- **Task**: Implement proper role hierarchy (SuperAdmin, Admin, Moderator)
- **Files to Create**:
  - `src/modules/admin/roles.enum.ts`
  - `src/common/guards/roles.guard.ts`
- **Current State**: All authenticated users treated as admin
- **Estimated Time**: 3-4 hours

#### 12. Audit Logging
- **Task**: Log all admin actions for compliance
- **Fields**: User, action, timestamp, changes before/after
- **Already Created**: AuditLog model in schema
- **Files to Update**:
  - `src/modules/admin/admin.service.ts` - Add audit logs
  - `admin/app/audit-log/page.tsx` - View audit trail
- **Estimated Time**: 3-4 hours

#### 13. Performance Optimization
- **Tasks**:
  - Add caching layer (Redis) for frequently accessed content
  - Implement database query optimization
  - Add pagination to list endpoints
  - Compress responses
- **Estimated Time**: 6-8 hours

#### 14. Testing Suite
- **Unit Tests**: Services, utilities
- **Integration Tests**: API endpoints
- **E2E Tests**: Critical user flows
- **Coverage Target**: 70%+
- **Estimated Time**: 12-15 hours

#### 15. Documentation & Guides
- **Create**: 
  - Mobile app development setup guide
  - Backend API documentation (OpenAPI/Swagger)
  - Deployment guide
  - Troubleshooting guide
- **Estimated Time**: 8-10 hours

---

## 📋 Guidelines & Rules

### Code Style & Quality

#### 1. **File Naming**
```
✅ DO:
- service.ts, controller.ts, module.ts, dto.ts
- feature-name.service.ts (descriptive)
- lowercase with hyphens for multi-word names

❌ DON'T:
- FeatureService.ts (use feature.service.ts)
- Feature_Service.ts (use hyphens, not underscores)
- feature (no extension specified)
```

#### 2. **Class & Function Naming**
```
✅ DO:
- PascalCase for classes: UserService, CreateUserDto
- camelCase for functions/methods: getUserById, createUser
- UPPER_SNAKE_CASE for constants: DEFAULT_PAGE_SIZE

❌ DON'T:
- userService, create_user_dto
- getUserbyid (inconsistent casing)
- defaultPageSize for constants
```

#### 3. **Import Organization**
```typescript
✅ DO:
// External libraries first
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma.service';

// Internal modules
import { UserService } from '@modules/users/users.service';
import { UserDto } from '@modules/users/dto/user.dto';

// Empty line between import groups

❌ DON'T:
// Mixed imports
import { UserService } from '@modules/users';
import { Injectable } from '@nestjs/common';
```

#### 4. **Comments & Documentation**
```typescript
✅ DO:
// Only add comments for WHY, not WHAT
// Skip cache if user has custom preferences
const cache = user.customPreferences ? null : getCache();

// Use meaningful variable names that explain themselves
const verseOfDayExplanation = generateVerseExplanation(verse);

❌ DON'T:
// Get all users
const users = await prisma.user.findMany();

// This function gets user by ID
async function getUserById(id) { ... }

// Multi-line comment blocks unless absolutely necessary
```

#### 5. **Error Handling**
```typescript
✅ DO:
try {
  // operation
} catch (error) {
  this.logger.error(`Context: Failed to ${action}`, error);
  throw new HttpException('User-friendly message', HttpStatus.INTERNAL_SERVER_ERROR);
}

❌ DON'T:
try {
  // operation
} catch (error) {
  console.log('Error'); // Too vague
  throw error; // Generic error
}
```

### Backend Development Rules

#### 6. **Service Layer**
- Services contain all business logic
- Services are injectable and testable
- Never access HTTP request/response directly in services
- Always validate inputs at service boundary
- Use logger for all significant operations

#### 7. **Controller Layer**
```typescript
✅ DO:
@Controller('api/v1/users')
@UseGuards(JwtGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get(':id')
  async getUser(@Param('id') id: string) {
    return this.usersService.getUser(id);
  }
}

❌ DON'T:
// Business logic in controller
@Get(':id')
async getUser(@Param('id') id: string) {
  const user = await db.query(...);
  // ... lots of processing
  return user;
}
```

#### 8. **Database Transactions**
- Use Prisma transactions for multi-step operations
- Always include error handling
- Log transaction boundaries
```typescript
✅ DO:
await this.prisma.$transaction(async (tx) => {
  const user = await tx.user.update({ ... });
  await tx.auditLog.create({ ... });
  return user;
});
```

#### 9. **DTOs (Data Transfer Objects)**
- Always create DTOs for input/output
- Use validation decorators (@IsString, @IsNotEmpty, etc.)
- Keep DTOs simple (no business logic)
- Use different DTOs for create/update/response

#### 10. **Module Structure**
```
Each feature module should have:
├── <feature>.module.ts          (main module)
├── <feature>.service.ts         (business logic)
├── <feature>.controller.ts      (HTTP layer)
└── dto/                         (data transfer objects)
    ├── create-<feature>.dto.ts
    ├── update-<feature>.dto.ts
    └── <feature>.dto.ts
```

### Storage & File Handling Rules

#### 11. **Public vs Private Files**
```
✅ DO:
- Public files: images, documents shared with all users
- Private files: user uploads, sensitive data
- Organize by: public/verses-of-day/, private/users/{id}/

❌ DON'T:
- Mix public and private in same folder
- Use random UUIDs without context
- Store sensitive data in public folder
```

#### 12. **File Upload Naming**
```typescript
✅ DO:
const filename = `verse-${verseId}-${Date.now()}.webp`;
// Result: verse-abc123-1703001234567.webp

❌ DON'T:
const filename = originalFile.name; // Can have spaces, special chars
const filename = Math.random().toString(); // No context
```

#### 13. **Storage Configuration**
- All storage paths defined in storage.config.ts
- Use folderStructure helpers: `folderStructure.publicVerse(id)`
- Never hardcode paths in services
- Support both S3 and local seamlessly

### API Design Rules

#### 14. **RESTful Endpoints**
```
✅ DO:
GET    /api/v1/verses              (list)
POST   /api/v1/verses              (create)
GET    /api/v1/verses/:id          (detail)
PATCH  /api/v1/verses/:id          (update)
DELETE /api/v1/verses/:id          (delete)

File uploads:
POST   /api/v1/sampradayas/:id/upload-image

Admin actions:
POST   /api/v1/verses/of-day/admin/select/:verseId
POST   /api/v1/admin/users/:id/ban

❌ DON'T:
GET    /api/v1/getVerses
POST   /api/v1/createVerse
GET    /api/v1/versesDetail/:id
```

#### 15. **Response Format**
```typescript
✅ DO:
// List endpoint
{ data: [...], total: 100 }

// Single item
{ data: {...} } or just {...}

// Success response
{ success: true, message: 'Created successfully' }

// Error response
{ 
  statusCode: 400,
  message: 'User-friendly error message',
  error: 'BadRequest'
}

❌ DON'T:
// Inconsistent wrapping
{ items: [...] }
{ users: [...] }

// Missing context
{ ... } (unclear if single or list)
```

#### 16. **Query Parameters**
```
✅ DO:
GET /api/v1/verses?skip=0&take=20&search=brahman
GET /api/v1/analytics/metrics?period=month
GET /api/v1/verses/of-day/history?limit=10

❌ DON'T:
GET /api/v1/verses?page=1&pageSize=20 (use skip/take)
GET /api/v1/analytics?p=m (unclear abbreviations)
```

### Admin Panel Rules

#### 17. **Component Structure**
```typescript
✅ DO:
'use client'; // Mark client components

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';

export default function FeaturePage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchData();
  }, []);
}

❌ DON'T:
// Mix server and client logic
// Fetch data without loading state
// Skip error handling
```

#### 18. **Form Handling**
```typescript
✅ DO:
const [formData, setFormData] = useState({ field: '' });
const [errors, setErrors] = useState({});

const handleSubmit = async (e) => {
  e.preventDefault();
  try {
    await api.post('/endpoint', formData);
    resetForm();
  } catch (error) {
    setErrors(error.response.data);
  }
};

❌ DON'T:
// No error handling
// No validation feedback
// Direct form submission without state
```

#### 19. **UI Components**
- Use existing `.card`, `.btn-primary`, `.input-field` classes
- Maintain consistent styling across pages
- Use lucide-react icons
- Responsive design with Tailwind Grid
- Loading states and error messages required

#### 20. **Data Fetching**
```typescript
✅ DO:
const [loading, setLoading] = useState(true);

useEffect(() => {
  const fetchData = async () => {
    try {
      const response = await api.get('/endpoint');
      setData(response.data);
    } catch (err) {
      console.error('Failed to fetch:', err);
      // Show error to user
    } finally {
      setLoading(false);
    }
  };
  
  fetchData();
}, []);

❌ DON'T:
// Call API during render
// Missing error state
// No loading indicator
```

### Git & Version Control

#### 21. **Commit Messages**
```
✅ DO:
feat: Add verse of day management with AI integration
fix: Resolve JWT token refresh timing issue
refactor: Simplify storage provider initialization
docs: Update API documentation

Format: <type>: <description>
Length: Under 70 characters for title

❌ DON'T:
made changes
fixed stuff
update
WIP
```

#### 22. **Branch Naming**
```
✅ DO:
feat/verse-of-day-management
fix/jwt-refresh-timeout
refactor/storage-factory

❌ DON'T:
feature/addstuff
fix_jwt
refactor_everything
```

#### 23. **Code Review Checklist**
Before pushing:
- [ ] Code follows naming conventions
- [ ] No hardcoded values (except constants)
- [ ] Error handling included
- [ ] No console.logs in production code
- [ ] DTOs/validation added
- [ ] Tests updated/added
- [ ] Related documentation updated
- [ ] No breaking changes to APIs

### Deployment Rules

#### 24. **Environment Variables**
```
✅ DO:
- Store in .env.example as template
- Use ConfigService for all config access
- Validate required variables on startup
- Encrypt sensitive values in database

❌ DON'T:
- Hardcode API keys or secrets
- Commit .env file
- Mix env-specific logic in code
```

#### 25. **Database Migrations**
```bash
✅ DO:
npx prisma migrate dev --name add_feature
# Review generated migration
# Test locally before pushing

❌ DON'T:
# Manual SQL queries
# Skip migration creation
# Push untested migrations
```

#### 26. **Production Checklist**
Before deployment:
- [ ] All environment variables configured
- [ ] Database migrations run
- [ ] Tests passing
- [ ] No console errors/warnings
- [ ] API endpoints tested
- [ ] Admin panel fully functional
- [ ] Firebase/FCM configured
- [ ] Backup strategy verified
- [ ] Rollback plan ready

### Security Rules

#### 27. **Authentication & Authorization**
```typescript
✅ DO:
@UseGuards(JwtGuard)
@Controller('api/v1/admin')
export class AdminController { ... }

// For public endpoints
@Public()
@Get('verses')
async getVerses() { ... }

❌ DON'T:
// Checking auth in controller logic
if (!req.user) { throw... }

// Forgetting to guard admin endpoints
```

#### 28. **Input Validation**
```typescript
✅ DO:
class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @MinLength(8)
  @Matches(/[A-Z]/, { message: 'Must contain uppercase' })
  password: string;
}

❌ DON'T:
// No validation
async createUser(email: string, password: string) { }
```

#### 29. **Data Protection**
- Never log passwords or tokens
- Encrypt sensitive fields in database
- Use HTTPS in production
- Implement rate limiting for sensitive endpoints
- Validate file uploads (size, type, content)

#### 30. **API Security**
```
✅ DO:
- Implement CORS properly
- Add request size limits
- Validate all inputs
- Use parameterized queries (Prisma does this)
- Add timeout for long operations
- Remove sensitive data from error messages

❌ DON'T:
- Expose full error traces to client
- Accept unlimited file sizes
- Trust user input
- Reveal system details
```

### Documentation Rules

#### 31. **Inline Documentation**
- Add CLAUDE.md to every new major feature
- Update README when architecture changes
- Keep API documentation in sync with code
- Document non-obvious decisions

#### 32. **README Files**
Each module should have context about:
- What it does
- Key classes/services
- Important dependencies
- Usage examples

---

## ⚡ Quick Reference

### Common Commands

```bash
# Backend
npm install                          # Install dependencies
npm run dev                          # Start dev server
npm run build                        # Build for production
npx prisma migrate dev              # Run migrations
npx prisma studio                   # Open Prisma Studio

# Mobile
flutter pub get                     # Install dependencies
flutter run                         # Run app
flutter build apk                  # Build Android APK

# Admin Panel
npm install                         # Install dependencies
npm run dev                         # Start dev server
npm run build                       # Build for production

# Database
psql -U user -d database_name       # Connect to PostgreSQL
\dt                                 # List tables
```

### Important Paths

```
Backend:
src/modules/              # Feature modules
src/infrastructure/       # Shared infrastructure (DB, Storage, AI, etc.)
src/common/              # Global decorators, guards, pipes
prisma/schema.prisma     # Database schema

Admin:
app/                     # Pages (dashboard, sampradayas, etc.)
components/              # Reusable components
lib/                     # Utilities (API, store, etc.)

Mobile:
lib/features/            # Feature modules
lib/core/                # Global configs, theme, routing
lib/data/                # Models, datasources, repositories
```

### Key Files to Know

```
Backend:
- app.module.ts                    # Main module, imports all feature modules
- src/infrastructure/storage/      # Storage configuration and services
- prisma/schema.prisma             # Complete database schema
- CLAUDE.md                        # This file

Admin:
- lib/api.ts                       # Axios instance with interceptors
- lib/store.ts                     # Zustand state management
- components/Sidebar.tsx           # Navigation

Mobile:
- lib/core/routing/app_router.dart # Navigation routes
- lib/core/theme/app_colors.dart   # Design colors
- lib/features/auth/               # Authentication feature
```

---

## 🎯 Current Status

### Completed: 35+ Features
### In Progress: Verse of Day Management
### Not Started: 15+ Features
### Overall Progress: ~65% Complete

### Last Updated
**April 27, 2026** - Comprehensive update with Verse of Day system, FCM topic integration, storage reorganization, and AI provider configuration.

---

## 💡 Working with Claude Code

### When Starting Work
1. Read this CLAUDE.md file completely
2. Check the relevant feature documentation (VERSE_OF_DAY_ADMIN_GUIDE.md, etc.)
3. Review existing code patterns in the feature module
4. Ask clarifying questions about ambiguous requirements

### During Development
- Follow the **Guidelines & Rules** section religiously
- Use existing patterns and conventions
- Don't introduce new patterns without discussion
- Keep commits small and logical
- Test before pushing

### Code Review Checklist
```
Frontend:
- [ ] Component uses 'use client' if needed
- [ ] Error handling included
- [ ] Loading states implemented
- [ ] Responsive design works
- [ ] Consistent with existing UI

Backend:
- [ ] Service methods are pure
- [ ] Error handling with proper HTTP codes
- [ ] Logger calls for significant operations
- [ ] DTOs with validation
- [ ] Database migrations created

Cross-platform:
- [ ] No hardcoded values
- [ ] Environment variables used
- [ ] Comments only for WHY
- [ ] Variable names are self-documenting
```

### What NOT to Do
❌ Don't introduce new patterns without discussing first
❌ Don't refactor working code unless needed
❌ Don't commit without testing locally
❌ Don't ignore the guidelines section
❌ Don't add features beyond the immediate task scope
❌ Don't skip error handling for "simple" cases
❌ Don't mock database in tests (use real test DB)
❌ Don't force push unless explicitly authorized

### What TO Do
✅ Ask before making architectural changes
✅ Write defensive code (validate all inputs)
✅ Test edge cases and error scenarios
✅ Document non-obvious logic
✅ Keep commits atomic and focused
✅ Review similar code first
✅ Follow the established patterns
✅ Update related documentation

---

## 📞 Support & Escalation

### When Stuck
1. Check existing documentation (README, guides)
2. Review similar code patterns
3. Check database schema for relationships
4. Run tests to identify failure points
5. Ask clarifying questions in comments

### Critical Issues
- Data loss or corruption
- Security vulnerabilities
- Authentication failures
- Deployment failures

**Always prioritize these over new features.**

---

## 📝 Final Notes

This project aims to be a reference implementation for:
- Enterprise-grade backend architecture
- Secure mobile app development
- Modern admin panel design
- Scalable AI integration
- Real-world feature implementation

Follow the guidelines, and the codebase will remain maintainable and scalable for years to come.

**Happy coding! 🚀**
