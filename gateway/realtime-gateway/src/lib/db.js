import mongoose from 'mongoose';
import { createLogger } from '@dc/logger';

const log = createLogger('realtime-db');

const chatUri =
  process.env.CHAT_MONGO_URI ??
  process.env.MONGO_URI?.replace(/\/[^/?]+(\?.*)?$/, '/chat') ??
  'mongodb://localhost:27017/chat';
const groupUri = process.env.GROUP_MONGO_URI ?? 'mongodb://localhost:27017/group';
const callUri = process.env.CALL_MONGO_URI ?? 'mongodb://localhost:27017/call';

let chatConn;
let groupConn;
let callConn;

export async function connectDatabases() {
  [chatConn, groupConn, callConn] = await Promise.all([
    mongoose.createConnection(chatUri).asPromise(),
    mongoose.createConnection(groupUri).asPromise(),
    mongoose.createConnection(callUri).asPromise(),
  ]);
  log.info({ chatUri, groupUri, callUri }, 'Connected to chat, group, and call databases');
}

export const getChatConn = () => {
  if (!chatConn) throw new Error('Chat database not connected');
  return chatConn;
};

export const getGroupConn = () => {
  if (!groupConn) throw new Error('Group database not connected');
  return groupConn;
};

export const getCallConn = () => {
  if (!callConn) throw new Error('Call database not connected');
  return callConn;
};
