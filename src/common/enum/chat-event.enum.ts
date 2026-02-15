export enum ChatEvent {
  // User presence
  USER_ONLINE = 'user:online',
  USER_OFFLINE = 'user:offline',
  USERS_GET_ONLINE = 'users:getOnline',

  // Conversations
  CONVERSATION_CREATE = 'conversation:create',
  CONVERSATION_CREATED = 'conversation:created',
  CONVERSATION_JOIN = 'conversation:join',
  CONVERSATIONS_GET = 'conversations:get',

  // Messages
  MESSAGE_SEND = 'message:send',
  MESSAGE_NEW = 'message:new',
  MESSAGE_READ = 'message:read',
  MESSAGE_DELETE = 'message:delete',
  MESSAGES_GET = 'messages:get',

  // Typing
  TYPING_START = 'typing:start',
  TYPING_STOP = 'typing:stop',

  // Error
  ERROR = 'error',
}
