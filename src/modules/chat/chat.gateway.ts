import { Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

import { ChatEvent } from '@/common/enum/chat-event.enum';
import { ChatService } from '@/modules/chat/chat.service';
import { CreateConversationDto } from '@/modules/chat/dto/create-conversation.dto';
import { MarkReadDto } from '@/modules/chat/dto/mark-read.dto';
import { SendMessageDto } from '@/modules/chat/dto/send-message.dto';
import { TypingIndicatorDto } from '@/modules/chat/dto/typing-indicator.dto';
import { ConfigService } from '@nestjs/config';

interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    email: string;
  };
}

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private userSockets: Map<string, Set<string>> = new Map();
  private typingUsers: Map<string, Set<string>> = new Map();
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const userId = await this.authenticateSocket(client);

      if (!userId) {
        client.disconnect();
        return;
      }

      client.user = { id: userId, email: '' };

      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)?.add(client.id);

      this.logger.log(`Client connected: ${client.id}, User: ${userId}`);

      const conversations = await this.chatService.getUserConversations(userId);
      for (const conv of conversations) {
        await client.join(`conversation:${conv.id}`);
      }

      this.server.emit(ChatEvent.USER_ONLINE, {
        userId,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error('Connection error:', error);
      client.emit(ChatEvent.ERROR, { message: 'Authentication failed' });
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    const userId = client.user?.id;

    if (userId) {
      const userSocketSet = this.userSockets.get(userId);
      userSocketSet?.delete(client.id);

      if (userSocketSet?.size === 0) {
        this.userSockets.delete(userId);
        this.server.emit(ChatEvent.USER_OFFLINE, {
          userId,
          timestamp: new Date(),
        });
      }

      this.typingUsers.forEach((users, conversationId) => {
        if (users.has(userId)) {
          users.delete(userId);
          this.server
            .to(`conversation:${conversationId}`)
            .emit(ChatEvent.TYPING_STOP, {
              conversationId,
              userId,
            });
        }
      });
    }

    this.logger.log(`Client disconnected: ${client.id}`);
  }

  private async authenticateSocket(
    client: AuthenticatedSocket,
  ): Promise<string | null> {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        throw new UnauthorizedException('No token provided');
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });

      return payload.sub || payload.userId || payload.id;
    } catch (error) {
      this.logger.error('Socket authentication error:', error);
      return null;
    }
  }

  private ensureAuthenticated(client: AuthenticatedSocket): string {
    const userId = client.user?.id;
    if (!userId) {
      throw new WsException('Unauthorized');
    }
    return userId;
  }

  @SubscribeMessage(ChatEvent.CONVERSATION_CREATE)
  async createConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() createConversationDto: CreateConversationDto,
  ) {
    try {
      const userId = this.ensureAuthenticated(client);

      const conversation = await this.chatService.createConversation(
        userId,
        createConversationDto,
      );

      for (const participant of conversation.participants) {
        const sockets = this.userSockets.get(participant.id);
        if (sockets) {
          for (const socketId of sockets) {
            const socket = this.server.sockets.sockets.get(socketId);
            if (socket) {
              await socket.join(`conversation:${conversation.id}`);
            }
          }
        }
      }

      this.server
        .to(`conversation:${conversation.id}`)
        .emit(ChatEvent.CONVERSATION_CREATED, conversation);

      return { success: true, data: conversation };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage(ChatEvent.CONVERSATION_JOIN)
  async joinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    try {
      const userId = this.ensureAuthenticated(client);

      const conversation = await this.chatService.getConversationById(
        userId,
        data.conversationId,
      );
      const otherUser = conversation.participants.find((p) => p.id !== userId);

      if (!otherUser) {
        return { success: false, error: 'Other user not found' };
      }

      await client.join(`conversation:${data.conversationId}`);

      return {
        success: true,
        userDetails: {
          id: otherUser.id,
          name: otherUser.name,
          profilePicture: otherUser.profilePicture,
          gender: otherUser.gender,
        },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage(ChatEvent.CONVERSATIONS_GET)
  async getUserConversations(@ConnectedSocket() client: AuthenticatedSocket) {
    try {
      const userId = this.ensureAuthenticated(client);
      const conversations = await this.chatService.getUserConversations(userId);
      return { success: true, data: conversations };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage(ChatEvent.MESSAGES_GET)
  async getMessages(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: { conversationId: string; limit?: number; offset?: number },
  ) {
    try {
      const userId = this.ensureAuthenticated(client);

      const messages = await this.chatService.getConversationMessages(
        userId,
        data.conversationId,
        data.limit || 50,
        data.offset || 0,
      );

      return { success: true, data: messages };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage(ChatEvent.MESSAGE_SEND)
  async sendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() sendMessageDto: SendMessageDto,
  ) {
    try {
      const userId = this.ensureAuthenticated(client);

      const message = await this.chatService.sendMessage(
        userId,
        sendMessageDto,
      );

      this.clearTypingIndicator(userId, sendMessageDto.conversationId);

      client
        .to(`conversation:${sendMessageDto.conversationId}`)
        .emit(ChatEvent.MESSAGE_NEW, message);

      return { success: true, data: message };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage(ChatEvent.MESSAGE_READ)
  async markMessageRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() markReadDto: MarkReadDto,
  ) {
    try {
      const userId = this.ensureAuthenticated(client);

      const message = await this.chatService.markMessageAsRead(
        userId,
        markReadDto.messageId,
      );

      this.server
        .to(`conversation:${message.conversationId}`)
        .emit(ChatEvent.MESSAGE_READ, {
          messageId: message.id,
          conversationId: message.conversationId,
          readBy: userId,
        });

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage(ChatEvent.MESSAGE_DELETE)
  async deleteMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { messageId: string },
  ) {
    try {
      const userId = this.ensureAuthenticated(client);
      const result = await this.chatService.deleteMessage(
        userId,
        data.messageId,
      );

      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage(ChatEvent.TYPING_START)
  handleTypingStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() typingDto: TypingIndicatorDto,
  ) {
    const userId = this.ensureAuthenticated(client);
    const { conversationId } = typingDto;

    if (!this.typingUsers.has(conversationId)) {
      this.typingUsers.set(conversationId, new Set());
    }
    this.typingUsers.get(conversationId)?.add(userId);

    client.to(`conversation:${conversationId}`).emit(ChatEvent.TYPING_START, {
      conversationId,
      userId,
    });

    return { success: true };
  }

  @SubscribeMessage(ChatEvent.TYPING_STOP)
  handleTypingStop(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() typingDto: TypingIndicatorDto,
  ) {
    const userId = this.ensureAuthenticated(client);
    const { conversationId } = typingDto;

    this.clearTypingIndicator(userId, conversationId);
    return { success: true };
  }

  @SubscribeMessage(ChatEvent.USERS_GET_ONLINE)
  getOnlineUsers(@ConnectedSocket() client: AuthenticatedSocket) {
    try {
      this.ensureAuthenticated(client);
      const onlineUserIds = Array.from(this.userSockets.keys());
      return { success: true, data: onlineUserIds };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  private clearTypingIndicator(userId: string, conversationId: string) {
    const typingSet = this.typingUsers.get(conversationId);
    if (typingSet?.has(userId)) {
      typingSet.delete(userId);
      this.server
        .to(`conversation:${conversationId}`)
        .emit(ChatEvent.TYPING_STOP, {
          conversationId,
          userId,
        });
    }
  }
}
