import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { CreateConversationDto } from '@/modules/chat/dto/create-conversation.dto';
import { SendMessageDto } from '@/modules/chat/dto/send-message.dto';
import { Conversation } from '@/modules/chat/entities/conversations.entity';
import { Message, MessageType } from '@/modules/chat/entities/message.entity';
import { User } from '@/modules/users/entities/user.entity';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async createConversation(
    userId: string,
    createConversationDto: CreateConversationDto,
  ) {
    const { participantIds } = createConversationDto;

    const allParticipantIds = [...new Set([userId, ...participantIds])];

    const participants = await this.userRepository.find({
      where: { id: In(allParticipantIds) },
    });

    if (participants.length !== allParticipantIds.length) {
      throw new NotFoundException('One or more participants not found');
    }

    if (allParticipantIds.length === 2) {
      const existing = await this.conversationRepository
        .createQueryBuilder('conversation')
        .innerJoin('conversation.participants', 'participant')
        .groupBy('conversation.id')
        .having('COUNT(DISTINCT participant.id) = :count', { count: 2 })
        .andHaving(
          'SUM(CASE WHEN participant.id IN (:...ids) THEN 1 ELSE 0 END) = :count',
          { ids: allParticipantIds, count: 2 },
        )
        .getOne();

      if (existing) {
        return this.getConversationById(userId, existing.id);
      }
    }

    const conversation = this.conversationRepository.create({
      participants,
    });

    await this.conversationRepository.save(conversation);
    return this.getConversationById(userId, conversation.id);
  }

  async getUserConversations(userId: string) {
    const conversations = await this.conversationRepository
      .createQueryBuilder('conversation')
      .leftJoinAndSelect('conversation.participants', 'participant')
      .leftJoinAndSelect('conversation.messages', 'lastMessage')
      .where('participant.id = :userId', { userId })
      .orderBy('conversation.updatedAt', 'DESC')
      .getMany();

    return conversations.map((conv) => ({
      ...conv,
      lastMessage: conv.messages?.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      )[0],
      messages: undefined,
    }));
  }

  async getConversationById(userId: string, conversationId: string) {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
      relations: ['participants'],
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const isParticipant = conversation.participants.some(
      (p) => p.id === userId,
    );
    if (!isParticipant) {
      throw new ForbiddenException(
        'You are not a participant in this conversation',
      );
    }

    return conversation;
  }

  async getConversationMessages(
    userId: string,
    conversationId: string,
    limit = 50,
    offset = 0,
  ) {
    await this.getConversationById(userId, conversationId);

    const messages = await this.messageRepository.find({
      where: { conversationId },
      relations: ['sender'],
      select: {
        sender: {
          id: true,
          name: true,
          profilePicture: true,
          gender: true,
        },
      },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return messages.reverse();
  }

  async sendMessage(userId: string, sendMessageDto: SendMessageDto) {
    const {
      conversationId,
      content,
      type = MessageType.TEXT,
      imageUrl,
    } = sendMessageDto;

    await this.getConversationById(userId, conversationId);

    const message = this.messageRepository.create({
      content,
      type,
      imageUrl,
      senderId: userId,
      conversationId,
    });

    await this.messageRepository.save(message);

    await this.conversationRepository.update(conversationId, {
      updatedAt: new Date(),
      lastMessageId: message.id,
    });

    return this.messageRepository.findOne({
      where: { id: message.id },
      relations: ['sender'],
      select: {
        sender: {
          id: true,
          name: true,
          profilePicture: true,
          gender: true,
        },
      },
    });
  }

  async markMessageAsRead(userId: string, messageId: string) {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
      relations: ['conversation', 'conversation.participants'],
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    const isParticipant = message.conversation.participants.some(
      (p) => p.id === userId,
    );
    if (!isParticipant) {
      throw new ForbiddenException(
        'You are not a participant in this conversation',
      );
    }

    if (message.senderId !== userId) {
      message.isRead = true;
      await this.messageRepository.save(message);
    }

    return message;
  }

  async deleteMessage(userId: string, messageId: string) {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    await this.messageRepository.remove(message);
    return { success: true };
  }
}
