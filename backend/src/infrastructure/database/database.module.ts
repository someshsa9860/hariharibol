import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserSchema } from './schemas/user.schema';
import { DeviceSchema } from './schemas/device.schema';
import { BanSchema } from './schemas/ban.schema';
import { SampradayaSchema } from './schemas/sampraday.schema';
import { BookSchema } from './schemas/book.schema';
import { ChapterSchema } from './schemas/chapter.schema';
import { VerseSchema } from './schemas/verse.schema';
import { NarrationSchema } from './schemas/narration.schema';
import { MantraSchema } from './schemas/mantra.schema';
import { TranslationSchema } from './schemas/translation.schema';
import { LanguageSchema } from './schemas/language.schema';
import { ChantLogSchema } from './schemas/chant-log.schema';
import { FavoriteSchema } from './schemas/favorite.schema';
import { FollowSchema } from './schemas/follow.schema';
import { GroupSchema } from './schemas/group.schema';
import { GroupMemberSchema } from './schemas/group-member.schema';
import { MessageSchema } from './schemas/message.schema';
import { ChatbotSessionSchema } from './schemas/chatbot-session.schema';
import { ChatbotMessageSchema } from './schemas/chatbot-message.schema';

const schemas = [
  MongooseModule.forFeature([{ name: 'User', schema: UserSchema }]),
  MongooseModule.forFeature([{ name: 'Device', schema: DeviceSchema }]),
  MongooseModule.forFeature([{ name: 'Ban', schema: BanSchema }]),
  MongooseModule.forFeature([{ name: 'Sampraday', schema: SampradayaSchema }]),
  MongooseModule.forFeature([{ name: 'Book', schema: BookSchema }]),
  MongooseModule.forFeature([{ name: 'Chapter', schema: ChapterSchema }]),
  MongooseModule.forFeature([{ name: 'Verse', schema: VerseSchema }]),
  MongooseModule.forFeature([{ name: 'Narration', schema: NarrationSchema }]),
  MongooseModule.forFeature([{ name: 'Mantra', schema: MantraSchema }]),
  MongooseModule.forFeature([{ name: 'Translation', schema: TranslationSchema }]),
  MongooseModule.forFeature([{ name: 'Language', schema: LanguageSchema }]),
  MongooseModule.forFeature([{ name: 'ChantLog', schema: ChantLogSchema }]),
  MongooseModule.forFeature([{ name: 'Favorite', schema: FavoriteSchema }]),
  MongooseModule.forFeature([{ name: 'Follow', schema: FollowSchema }]),
  MongooseModule.forFeature([{ name: 'Group', schema: GroupSchema }]),
  MongooseModule.forFeature([{ name: 'GroupMember', schema: GroupMemberSchema }]),
  MongooseModule.forFeature([{ name: 'Message', schema: MessageSchema }]),
  MongooseModule.forFeature([{ name: 'ChatbotSession', schema: ChatbotSessionSchema }]),
  MongooseModule.forFeature([{ name: 'ChatbotMessage', schema: ChatbotMessageSchema }]),
];

@Module({
  imports: schemas,
  exports: schemas,
})
export class DatabaseModule {}
