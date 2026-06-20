/**
 * @file Public surface of the headless editor core.
 *
 *       Re-exports the document model, command bus, and serializer so
 *       consumers can `import { ... } from './core/index.js'` (or
 *       `./core`) without caring about the internal file layout.
 */

export {
  createDocument,
  VOID_TAGS,
  parseHtmlFragment,
  parseStyleString,
} from './document-model.js';

export {
  createCommandBus,
  updateNodeCommand,
  insertNodeCommand,
  removeNodeCommand,
  moveNodeCommand,
} from './command-bus.js';

export {
  serialize,
  deserialize,
} from './serializer.js';
