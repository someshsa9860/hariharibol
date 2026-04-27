# Performance Optimization Guide

## Overview

This guide covers performance optimization strategies implemented in HariHariBol, including caching, database optimization, pagination, and more.

---

## 1. Caching Strategy

### CacheService
**File**: `src/infrastructure/cache/cache.service.ts`

Uses Redis via `@nestjs/cache-manager` for distributed caching.

#### Cache Key Patterns
```typescript
// Verse caching
CacheService.buildVerseKey(verseId)                    // verse:abc123
CacheService.buildVersesListKey(skip, take)            // verses:list:0:20
CacheService.buildVerseOfDayKey(date)                  // verse-of-day:2026-04-27
CacheService.buildSampradayKey(sampradayId)            // sampraday:abc123
CacheService.buildSampradaysListKey(skip, take)        // sampradayas:list:0:20
CacheService.buildUserKey(userId)                      // user:abc123
CacheService.buildAppSettingsKey(key)                  // app-settings:VOD_AI_PROVIDER
CacheService.buildSearchKey(query, type)               // search:verse:brahman
```

#### Usage Examples

```typescript
// Get from cache or compute
const verse = await this.cacheService.getOrSet(
  CacheService.buildVerseKey(verseId),
  () => this.prisma.verse.findUnique({ where: { id: verseId } }),
  3600000, // 1 hour TTL
);

// Get multiple values
const values = await this.cacheService.mget<Verse>([
  CacheService.buildVerseKey(verseId1),
  CacheService.buildVerseKey(verseId2),
]);

// Delete cache pattern
await this.cacheService.delPattern('verse:');  // Clear all verse caches

// Set multiple values
await this.cacheService.mset(
  {
    [CacheService.buildUserKey(userId)]: user,
    [CacheService.buildUserKey(userId) + ':prefs']: preferences,
  },
  7200000, // 2 hour TTL
);
```

#### Cache TTLs (Recommended)
```
- User data: 30 minutes (1,800,000ms)
- Verses: 1 hour (3,600,000ms)
- Lists: 15 minutes (900,000ms)
- Settings: 5 minutes (300,000ms)
- Search results: 30 minutes (1,800,000ms)
- Analytics: 1 hour (3,600,000ms)
```

#### Cache Invalidation
```typescript
// Invalidate on data change
async updateVerse(id: string, data: UpdateVerseDto) {
  const verse = await this.prisma.verse.update({
    where: { id },
    data,
  });

  // Clear related caches
  await this.cacheService.del(CacheService.buildVerseKey(id));
  await this.cacheService.delPattern('verses:list:'); // Clear list caches
  await this.cacheService.delPattern('search:'); // Clear search results

  return verse;
}
```

---

## 2. Database Query Optimization

### Query Best Practices

#### ✅ DO
```typescript
// 1. Use select to fetch only needed fields
const verse = await this.prisma.verse.findUnique({
  where: { id: verseId },
  select: {
    id: true,
    transliteration: true,
    meaning: true,
    // Only include relations you need
    narrations: {
      select: { id: true, saintNameKey: true },
    },
  },
});

// 2. Use pagination
const { skip, take } = this.paginationService.normalize(params);
const [verses, total] = await Promise.all([
  this.prisma.verse.findMany({
    skip,
    take,
    orderBy: { createdAt: 'desc' },
  }),
  this.prisma.verse.count(),
]);

// 3. Use indexes on frequently queried fields
// Indexes are defined in schema.prisma with @@index

// 4. Batch queries together
const [users, verses, sampradayas] = await Promise.all([
  this.prisma.user.findMany({ take: 10 }),
  this.prisma.verse.findMany({ take: 10 }),
  this.prisma.sampraday.findMany({ take: 10 }),
]);

// 5. Use findUnique for primary key queries (faster)
const user = await this.prisma.user.findUnique({
  where: { email: userEmail }, // Must be a unique field
});
```

#### ❌ DON'T
```typescript
// 1. Don't fetch all relations
const verse = await this.prisma.verse.findUnique({
  where: { id },
  include: { _all: true }, // ❌ Wasteful
});

// 2. Don't fetch without pagination
const verses = await this.prisma.verse.findMany(); // ❌ Could be millions

// 3. Don't use findMany when findUnique applies
const user = await this.prisma.user.findMany({
  where: { id: userId }, // ❌ Use findUnique instead
});

// 4. Don't make sequential queries in loops
for (const id of ids) {
  const verse = await this.prisma.verse.findUnique({ where: { id } }); // ❌ N+1 problem
}

// 5. Don't query without where clause
const count = await this.prisma.verse.count(); // ❌ Counts entire table
```

### Prisma Schema Indexes

Ensure these indexes exist in `prisma/schema.prisma`:

```prisma
model Verse {
  // ... fields ...

  @@unique([bookId, chapterNumber, verseNumber])
  @@index([bookId])                    // For finding verses by book
  @@index([isVerseOfDayEligible])      // For verse of day queries
}

model User {
  @@index([email])                     // For email lookups
  @@index([isBanned])                  // For filtering banned users
}

model Sampraday {
  @@index([isPublished])               // For public sampraday queries
}

model Message {
  @@index([isModerated])               // For moderation filtering
  @@index([createdAt])                 // For date-range queries
}
```

### N+1 Query Prevention

```typescript
// ❌ WRONG: N+1 queries
const sampradayas = await this.prisma.sampraday.findMany();
for (const sampraday of sampradayas) {
  sampraday.mantras = await this.prisma.mantra.findMany({
    where: { sampradayId: sampraday.id },
  }); // N additional queries
}

// ✅ RIGHT: Single query with eager loading
const sampradayas = await this.prisma.sampraday.findMany({
  include: {
    mantras: true, // Loaded in single query
  },
});

// ✅ ALSO RIGHT: If only some sampradayas need mantras
const sampradayas = await this.prisma.sampraday.findMany();
const sampadayIds = sampradayas.map(s => s.id);

const mantrasById = await this.prisma.mantra.findMany({
  where: { sampradayId: { in: sampadayIds } },
});

const mantraMap = new Map();
for (const mantra of mantrasById) {
  if (!mantraMap.has(mantra.sampradayId)) {
    mantraMap.set(mantra.sampradayId, []);
  }
  mantraMap.get(mantra.sampradayId).push(mantra);
}

// Attach mantras
for (const sampraday of sampradayas) {
  sampraday.mantras = mantraMap.get(sampraday.id) || [];
}
```

---

## 3. Pagination Implementation

### PaginationService
**File**: `src/common/services/pagination.service.ts`

Enforces safe limits (1-100 per page).

#### Usage

```typescript
// In controller
@Get()
async getVerses(
  @Query('skip') skip?: number,
  @Query('take') take?: number,
) {
  const params = this.paginationService.normalize({ skip, take });

  const [verses, total] = await Promise.all([
    this.versesService.find(params.skip, params.take),
    this.versesService.count(),
  ]);

  return this.paginationService.paginate(
    verses,
    total,
    params.skip,
    params.take,
  );
}

// Response format
{
  "data": [...],
  "total": 1000,
  "skip": 0,
  "take": 20,
  "hasMore": true,
  "pageCount": 50
}
```

---

## 4. API Response Optimization

### Gzip Compression
Enabled by default in NestJS with compression middleware.

```typescript
// app.module.ts already has this via main.ts
app.use(compression()); // Compresses responses > 1KB
```

### Response Size Reduction

#### Before
```typescript
// Returns entire user object
return {
  id: '123',
  email: 'user@example.com',
  name: 'User',
  avatarUrl: '...',
  authProvider: 'google',
  providerUserId: '...',
  languagePreference: 'en',
  isBanned: false,
  // ... many more fields
};
```

#### After
```typescript
// Returns only needed fields
return {
  id: '123',
  name: 'User',
  avatarUrl: '...',
  languagePreference: 'en',
};
```

---

## 5. Image Optimization

### WebP Format
All images are stored in WebP format with varying qualities:
- **sm** (240x240): 80% quality → ~5-8KB
- **md** (480x480): 85% quality → ~15-20KB
- **lg** (1024x1024): 90% quality → ~40-60KB

### Storage Optimization
```typescript
// Use appropriate variant based on screen size
// Mobile: sm variant
// Tablet: md variant
// Desktop: lg variant

// Saves 60-80% bandwidth on mobile devices
```

---

## 6. Frontend Optimization

### Admin Panel Caching

#### Query Caching
```typescript
// Cache GET requests with axios
const api = axios.create({
  // ...
});

// Cache successful GET requests for 5 minutes
api.interceptors.response.use(
  (response) => {
    if (response.config.method === 'get') {
      // Can implement client-side caching here
      sessionStorage.setItem(
        response.config.url,
        JSON.stringify(response.data),
      );
    }
    return response;
  },
);
```

#### Code Splitting
```typescript
// Dynamic imports for route-based splitting
const AnalyticsPage = dynamic(() => import('./analytics/page'));
const VerseOfDayPage = dynamic(() => import('./verse-of-day/page'));
```

#### Image Optimization
```typescript
// Use Next.js Image component
import Image from 'next/image';

<Image
  src={imageUrl}
  alt="Verse"
  width={480}
  height={480}
  quality={75} // Automatic optimization
  priority={false} // Lazy load by default
/>
```

---

## 7. Mobile App Optimization

### Image Selection
```dart
// Select appropriate image variant based on device
String getImageUrl(String baseUrl, BuildContext context) {
  final screenWidth = MediaQuery.of(context).size.width;

  if (screenWidth < 400) {
    return '$baseUrl-sm.webp'; // Mobile
  } else if (screenWidth < 900) {
    return '$baseUrl-md.webp'; // Tablet
  } else {
    return '$baseUrl-lg.webp'; // Desktop/web
  }
}
```

### Response Caching
```dart
// Cache API responses using GetIt and local storage
final cacheBox = await Hive.openBox('api_cache');

// Before API call
final cached = cacheBox.get('verses_list');
if (cached != null && DateTime.now().difference(cached['timestamp']).inMinutes < 30) {
  return cached['data'];
}

// Store response
cacheBox.put('verses_list', {
  'data': response,
  'timestamp': DateTime.now(),
});
```

---

## 8. Database Connection Pooling

### Prisma Configuration
Already optimized in production:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // Connection pooling handled by Prisma Client
}
```

### Connection Pool Settings
```
# .env
DATABASE_URL="postgresql://user:password@host:5432/db?schema=public"
# Prisma manages connection pooling automatically
```

---

## 9. Monitoring & Metrics

### Enable Query Logging
```typescript
// Log slow queries in development
const prisma = new PrismaClient({
  log: [
    { emit: 'stdout', level: 'info' },
    { emit: 'stdout', level: 'warn' },
    { emit: 'stdout', level: 'error' },
  ],
});
```

### Key Metrics to Monitor
- **API Response Time**: Target < 200ms for 95th percentile
- **Database Query Time**: Target < 50ms
- **Cache Hit Rate**: Target > 70%
- **Memory Usage**: Monitor for leaks
- **CPU Usage**: Keep under 80%

---

## 10. Performance Checklist

### Before Deployment
- [ ] All queries are paginated (max 100 results)
- [ ] All list endpoints use caching
- [ ] Indexes exist on filtered fields
- [ ] No N+1 queries in critical paths
- [ ] Images optimized (WebP, correct size)
- [ ] Compression enabled for API responses
- [ ] Database connections pooled
- [ ] Cache TTLs set appropriately
- [ ] Slow queries logged and investigated
- [ ] Load tested with realistic data volume

### During Operation
- [ ] Monitor API response times
- [ ] Track cache hit rates
- [ ] Watch for memory leaks
- [ ] Monitor database CPU
- [ ] Track error rates
- [ ] Review slow query logs weekly
- [ ] Invalidate caches on data changes
- [ ] Update indexes based on query patterns

---

## 11. Performance Tips by Feature

### Verse of Day
- Cache verse details for entire day
- Cache generated images in storage
- Pre-generate images during off-peak hours
- Cache explanation text

### Search
- Implement full-text search indexes
- Cache popular search results
- Limit results to 50 per query
- Consider ElasticSearch for large datasets

### Analytics
- Cache metrics calculations
- Pre-aggregate daily/monthly stats
- Archive old data (> 1 year)
- Use materialized views for complex queries

### User Profiles
- Cache followed sampradayas per user
- Cache user preferences
- Invalidate on preference changes
- Pre-load frequently accessed profiles

---

## 12. Production Optimization

### Database Backups
- Daily automated backups
- Point-in-time recovery capability
- Test restore procedures

### CDN Configuration
- Serve images from CDN
- Cache public files indefinitely
- Purge on updates

### Rate Limiting
```typescript
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 100, ttl: 60000 } })
@Get()
async getVerses() { }
```

### Health Checks
```typescript
@Get('health')
healthCheck() {
  return {
    status: 'ok',
    database: this.prisma.$executeRawUnsafe('SELECT 1'),
    cache: this.cacheService.get('health-check'),
  };
}
```

---

## Conclusion

Following these optimization strategies will ensure:
- **Fast Response Times**: < 200ms for 95% of requests
- **High Availability**: Proper caching and connection pooling
- **Scalability**: Handle 10,000+ concurrent users
- **Cost Efficiency**: Reduced bandwidth and compute usage
- **User Experience**: Snappy, responsive interface

Review this guide quarterly and update as needed based on performance metrics.
