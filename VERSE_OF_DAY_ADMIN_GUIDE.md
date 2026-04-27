# Verse of Day Management - Admin Guide

## Overview

The Verse of Day management system allows admins to:
- Manually select verses for each day
- Auto-generate verses using AI (Gemini or OpenAI)
- Generate accompanying spiritual images
- Configure AI providers and API keys from the UI
- View verse of day history

## Backend Features

### Verse of Day Service
**File:** `src/modules/verses/verse-of-day.service.ts`

#### Configuration
- **aiProvider**: Select between 'gemini', 'openai', or 'none'
- **apiKey**: Store API key for selected provider
- **autoGenerate**: Enable/disable automatic daily generation
- **generateImage**: Enable/disable image generation for verses

#### API Endpoints

##### Public Endpoints
```
GET /api/v1/verses/of-day
- Returns today's verse with all details and image

GET /api/v1/verses/of-day/history?limit=10
- Returns history of previous verses of day
```

##### Admin Endpoints
```
GET /api/v1/verses/of-day/admin/config
- Returns current configuration

PATCH /api/v1/verses/of-day/admin/config
- Update configuration (aiProvider, apiKey, autoGenerate, generateImage)

POST /api/v1/verses/of-day/admin/select/:verseId
- Manually select a verse for today

POST /api/v1/verses/of-day/admin/generate
- Generate verse using configured AI provider

POST /api/v1/verses/of-day/admin/generate-image/:verseId
- Generate image for a specific verse
```

### AI Integration

#### Supported Providers
1. **Google Gemini** (Recommended - preferred by default)
   - Text generation for verse selection and explanations
   - Image generation for spiritual artwork
   - Lower cost, high quality output

2. **OpenAI**
   - Text generation with GPT models
   - Image generation with DALL-E

3. **None**
   - Manual selection only, no AI features

#### AIProviderService
**File:** `src/infrastructure/ai/ai-provider.service.ts`

Methods available:
- `generateText(prompt, provider, options)` - Generate text content
- `generateImage(prompt, provider)` - Generate images
- `moderateContent(content, context)` - Content moderation
- `countTokens(text)` - Token usage estimation

## Storage Integration

### Public/Private Folder Structure
```
public/
├── verses-of-day/        # Verse images (accessible without auth)
├── sampradayas/          # Public sampraday content
├── books/                # Public book content
└── verses/               # Public verse content

private/
├── sampradayas/          # Private sampraday content
├── books/                # Private book content
├── users/                # User profile data
└── translations/         # Translation files
```

**Verse of Day images are stored in `public/verses-of-day/` for universal access**

## FCM Integration

### Topic-Based Notifications
Instead of individual device tokens, the system now uses FCM topics for scalable notifications.

#### Available Topics
- `verse-of-day` - New verse of day announcements
- `announcements` - General admin announcements
- Custom topics can be created

#### NotificationsService Methods
```typescript
// Subscribe device to topic
subscribeToTopic(deviceToken, topic): Promise<boolean>

// Unsubscribe device from topic
unsubscribeFromTopic(deviceToken, topic): Promise<boolean>

// Send topic-based notification
notifyVerseOfDayUpdate(): Promise<boolean>

// Send general announcement
notifyGeneralAnnouncement(title, message): Promise<boolean>
```

#### Database Models
- **FCMTopic** - Defined topics for bulk notifications
- **FCMSubscription** - Device subscriptions to topics

## Admin Panel Features

### Verse of Day Management Page
**Location:** `/admin/verse-of-day`

#### Current Verse Display
- Shows today's verse with Sanskrit and transliteration
- Displays AI explanation if auto-generated
- Shows generated image (if available)
- Indicates generation method (AI or Manual)

#### Configuration Modal
- AI Provider selection (Gemini/OpenAI/None)
- API Key input (secure)
- Auto-generation toggle
- Image generation toggle

#### Verse Selection Modal
- Search functionality for verses
- Browse verse list
- Select verse for today
- Auto-updates notifications

#### Action Buttons
- **AI Generate** - Auto-select verse using AI
- **Select Verse** - Manually choose from list
- **Generate Image** - Create artwork for current verse
- **Settings** - Configure AI provider and options

#### History Section
- Shows last 10 verses of day
- Display date, verse text, and thumbnail
- Quick view of past selections

## Database Schema

### New Models

#### VerseOfDay
```prisma
model VerseOfDay {
  id            String    @id @default(cuid())
  date          DateTime  @unique
  verseId       String
  imageUrl      String?
  explanation   String?   @db.Text
  aiGenerated   Boolean   @default(false)
  
  verse         Verse     @relation(fields: [verseId], references: [id])
  
  @@index([verseId])
  @@index([date])
}
```

#### FCMTopic
```prisma
model FCMTopic {
  id              String    @id @default(cuid())
  name            String    @unique
  description     String?
  subscriberCount Int       @default(0)
  
  subscriptions   FCMSubscription[]
}
```

#### FCMSubscription
```prisma
model FCMSubscription {
  id          String    @id @default(cuid())
  topicId     String
  deviceToken String
  deviceId    String
  
  topic       FCMTopic  @relation(fields: [topicId], references: [id])
  
  @@unique([topicId, deviceToken])
}
```

## Configuration

### Environment Variables
```
# AI Provider Configuration
AI_PROVIDER=gemini                    # Default AI provider
GEMINI_API_KEY=your_gemini_key       # Gemini API key
OPENAI_API_KEY=your_openai_key       # OpenAI API key

# Verse of Day Configuration
VOD_AUTO_GENERATE=false              # Enable auto-generation
VOD_GENERATE_IMAGE=false             # Enable image generation
VOD_AI_PROVIDER=gemini               # Preferred AI provider

# Storage Configuration
STORAGE_PROVIDER=local               # local or s3
```

### UI Configuration
Admins can configure these settings directly from the admin panel without restarting the application.

## Workflow

### Manual Verse Selection
1. Admin opens Verse of Day management
2. Clicks "Select Verse"
3. Searches for desired verse
4. Clicks to select
5. System notifies all subscribed users via FCM topic

### AI-Generated Verse
1. Admin configures AI provider and API key
2. Clicks "AI Generate"
3. System selects relevant verse using AI
4. Optionally generates accompaniment image
5. Displays explanation generated by AI
6. Notifies users of new verse

### Image Generation
1. Admin can generate image for any verse
2. System creates spiritual artwork using AI
3. Image stored in public storage
4. Image automatically associated with verse

## Notifications

### Notification Types
- **Email** - For admin actions (requires email service integration)
- **Push** - Via FCM topics to all subscribed devices
- **In-app** - Stored in database for mobile app

### Topic Subscriptions
Devices automatically subscribe to `verse-of-day` topic on app launch, enabling broadcast notifications without individual token management.

## Performance Considerations

1. **Image Generation** - Resource intensive, may take 30-60 seconds
2. **AI Text Generation** - API calls are charged, monitor usage
3. **FCM Topics** - Efficient for large user bases, no token management overhead
4. **Storage** - Public/private separation enables proper access control

## Future Enhancements

1. **Scheduled Generation** - Automatically generate verse at specific time
2. **Multi-language Support** - Generate verses in different languages
3. **Analytics** - Track verse popularity and engagement
4. **Collections** - Group related verses by theme
5. **Custom Rules** - Define selection criteria (by sampraday, difficulty, etc.)

## Troubleshooting

### API Key Not Working
- Verify API key format for selected provider
- Check API key has required permissions
- Ensure quota not exceeded

### Image Generation Fails
- Check internet connectivity
- Verify AI provider API status
- Check image generation quota

### Notifications Not Received
- Verify FCM configuration in Firebase Console
- Check device subscribed to correct topic
- Verify FCM tokens are valid

### Performance Issues
- Enable caching for frequently accessed verses
- Limit image generation to off-peak hours
- Monitor API usage and costs
