// Source-only mapping for independent ChatGPT PR inboxes. A logical chatId is
// NOT evidence of a real ChatGPT chat_ref or a registered scheduled task.
// No default config, GitHub access, SQLite open, or Windows operation exists.
import {parseHandoff, routeHandoff} from './contract.mjs';

export const CHAT_BINDING_REGISTRY_SCHEMA = 'ZGMINI_HANDOFF_CHAT_BINDINGS_V1';
const REPOSITORY = 'ansqhd5774-Choi/zgmini-pc-control';
const CHAT_ID = /^[a-z][a-z0-9-]{2,79}$/;

function exactFields(value, fields, error) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).sort().join(',') !== [...fields].sort().join(',')) {
    throw new Error(error);
  }
}

function participant(value) {
  exactFields(value, ['chatId', 'inboxPr'], 'CHAT_BINDING_PARTICIPANT_INVALID');
  if (typeof value.chatId !== 'string' || !CHAT_ID.test(value.chatId) ||
      !Number.isSafeInteger(value.inboxPr) || value.inboxPr < 1) {
    throw new Error('CHAT_BINDING_PARTICIPANT_INVALID');
  }
  return Object.freeze({chatId: value.chatId, inboxPr: value.inboxPr});
}

function parsed(body) {
  return parseHandoff(typeof body === 'string' ? body : JSON.stringify(body));
}

/**
 * Only a trusted, separately approved caller may supply this complete mapping.
 * Config can add origin chats without editing broker or feature-specific code.
 * The origin chat ID inside an Issue is NEVER allowed to choose an arbitrary PR.
 */
export function createChatBindingRegistry(config) {
  exactFields(config, ['schema', 'repository', 'processOwner', 'origins'],
    'CHAT_BINDING_REGISTRY_INVALID');
  if (config.schema !== CHAT_BINDING_REGISTRY_SCHEMA ||
      config.repository !== REPOSITORY || !Array.isArray(config.origins) ||
      config.origins.length < 1 || config.origins.length > 64) {
    throw new Error('CHAT_BINDING_REGISTRY_INVALID');
  }
  const processOwner = participant(config.processOwner);
  const origins = new Map();
  const allChatIds = new Set([processOwner.chatId]);
  const allPrs = new Set([processOwner.inboxPr]);
  for (const candidate of config.origins) {
    const origin = participant(candidate);
    if (allChatIds.has(origin.chatId) || allPrs.has(origin.inboxPr)) {
      throw new Error('CHAT_BINDING_DUPLICATE_TARGET_STOP');
    }
    allChatIds.add(origin.chatId);
    allPrs.add(origin.inboxPr);
    origins.set(origin.chatId, origin);
  }

  const source = body => {
    const handoff = parsed(body);
    const origin = origins.get(handoff.origin.chatId);
    if (!origin) throw new Error('CHAT_BINDING_ORIGIN_UNREGISTERED_STOP');
    return {handoff, origin};
  };
  return Object.freeze({
    resolveWake(body) {
      const {handoff, origin} = source(body);
      const role = routeHandoff(handoff).role;
      const target = role === 'COMMON_PROCESS_OWNER' ? processOwner : origin;
      return Object.freeze({enabled: true, repository: REPOSITORY,
        pullRequestNumber: target.inboxPr, targetChatId: target.chatId, targetRole: role});
    },
    resolveReturn(body) {
      const {origin} = source(body);
      return Object.freeze({enabled: true, repository: REPOSITORY,
        pullRequestNumber: origin.inboxPr, targetChatId: origin.chatId});
    }
  });
}
