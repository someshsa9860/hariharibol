import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { MessagesService } from './messages.service';
import { ModerationService } from '@modules/moderation/moderation.service';
import { BansService } from '@modules/bans/bans.service';

interface AuthenticatedSocket extends Socket {
  data: {
    user?: { sub: string; email: string };
  };
}

@WebSocketGateway({ namespace: 'chat', cors: { origin: '*', credentials: true } })
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private messagesService: MessagesService,
    private moderationService: ModerationService,
    private bansService: BansService,
  ) {}

  afterInit(server: Server) {
    // Give BansService a reference to the socket server for kicking users
    this.bansService.setSocketServer(server);

    // JWT auth middleware applied to every connection attempt
    server.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token =
          socket.handshake.auth?.token ||
          (socket.handshake.headers?.authorization as string)?.split(' ')[1];

        if (!token) return next(new UnauthorizedException('No token provided'));

        const payload = await this.jwtService.verifyAsync(token);
        socket.data.user = payload;
        next();
      } catch {
        next(new UnauthorizedException('Invalid or expired token'));
      }
    });
  }

  async handleConnection(socket: AuthenticatedSocket) {
    const user = socket.data.user;
    if (!user) {
      socket.disconnect(true);
      return;
    }

    // Reject banned users immediately
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { isBanned: true, bannedReason: true },
    });

    if (dbUser?.isBanned) {
      socket.emit('banned', { reason: dbUser.bannedReason });
      socket.disconnect(true);
      return;
    }

    // Each user joins their personal room so we can target all their connections
    await socket.join(`user:${user.sub}`);
    this.logger.log(`User ${user.sub} connected (socket ${socket.id})`);
  }

  handleDisconnect(socket: AuthenticatedSocket) {
    const userId = socket.data.user?.sub;
    if (userId) this.logger.log(`User ${userId} disconnected (socket ${socket.id})`);
  }

  @SubscribeMessage('join_group')
  async handleJoinGroup(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { groupId: string },
  ) {
    const userId = socket.data.user?.sub;
    if (!userId) return { error: 'Unauthorized' };

    const member = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: data.groupId, userId } },
    });

    if (!member) return { error: 'Not a member of this group' };

    await socket.join(`group:${data.groupId}`);
    this.logger.log(`User ${userId} joined socket room group:${data.groupId}`);
    return { success: true, groupId: data.groupId };
  }

  @SubscribeMessage('leave_group')
  async handleLeaveGroup(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { groupId: string },
  ) {
    await socket.leave(`group:${data.groupId}`);
    return { success: true };
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { groupId: string; content: string },
  ) {
    const userId = socket.data.user?.sub;
    if (!userId) return { error: 'Unauthorized' };

    if (!data.content?.trim()) return { error: 'Message content is required' };

    const member = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: data.groupId, userId } },
    });
    if (!member) return { error: 'Not a member of this group' };

    // Persist as PENDING before moderation
    const message = await this.messagesService.createMessage(
      data.groupId,
      userId,
      data.content.trim(),
    );

    // Run moderation asynchronously — don't block the ack
    this.processModeration(socket, message, userId, data.groupId).catch((err) =>
      this.logger.error(`Moderation pipeline error for message ${message.id}`, err),
    );

    return { success: true, messageId: message.id };
  }

  private async processModeration(
    senderSocket: AuthenticatedSocket,
    message: { id: string; content: string },
    userId: string,
    groupId: string,
  ) {
    const result = await this.moderationService.moderateContent(message.content);

    if (result.safe) {
      await this.messagesService.updateMessageStatus(message.id, 'approved', {
        aiVerdict: result.verdict.toLowerCase(),
        aiConfidence: result.confidence,
        aiReason: result.reason,
      });

      // Broadcast approved message to everyone in the group room
      this.server.to(`group:${groupId}`).emit('message_received', {
        id: message.id,
        groupId,
        userId,
        content: message.content,
        createdAt: new Date().toISOString(),
      });
    } else {
      await this.messagesService.updateMessageStatus(message.id, 'hidden', {
        aiVerdict: result.verdict.toLowerCase(),
        aiConfidence: result.confidence,
        aiReason: result.reason,
        hiddenReason: result.reason,
      });

      // Notify only the sender their message was hidden
      const humanReason =
        result.verdict === 'SPAM'
          ? 'Your message was flagged as spam and not delivered.'
          : 'Your message was flagged as inappropriate and not delivered.';

      this.server.to(`user:${userId}`).emit('message_hidden', {
        messageId: message.id,
        verdict: result.verdict,
        reason: humanReason,
      });

      // Count total AI-triggered hidden messages (strikeCount)
      const strikeCount = await this.moderationService.getUserViolationCount(userId);
      if (strikeCount >= 3) {
        const evidence = await this.prisma.message.findMany({
          where: { userId, status: 'hidden', aiVerdict: { not: null } },
          select: { id: true },
          take: 10,
        });

        await this.bansService.banUser(
          userId,
          `Auto-banned after ${strikeCount} content violations`,
          'ai',
          { evidenceMessageIds: evidence.map((m) => m.id) },
        );
      }
    }
  }
}
