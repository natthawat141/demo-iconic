# User memory across conversations

This demo keeps two deliberately separate kinds of context:

| Context | Scope | Purpose |
| --- | --- | --- |
| Chat history | One conversation ID | Continue the current thread and show past messages |
| User memory | One Clerk/demo user ID across conversations | Keep durable preferences, project context, or working instructions |

## Flow

1. A signed-in user or demo-cookie user creates a memory in `/memory`, says an explicit phrase such as `จำไว้ว่า...`, or gives a durable working preference that the chat model elects to save.
2. The server rejects sensitive values, normalizes the text, produces an embedding with the configured OpenRouter embedding model (or the local fallback), and writes it to `user_memories` in PostgreSQL/SQLite.
3. Before a live chat response, the server compares the new question with that same user's memories and adds only the top relevant items to the system context.
4. The user can inspect and delete every saved item at `/memory`. Deletion immediately prevents it from being retrieved in later conversations.

The implementation follows the common open-source long-term-memory pattern—store durable facts after an interaction and semantically retrieve only relevant facts before the next answer—without adding a second agent framework or another database. See [Mem0's architecture overview](https://github.com/mem0ai/mem0/blob/main/docs/core-concepts/how-it-works.mdx) and [LangGraph's separation of thread and long-term memory](https://langchain-ai.github.io/langgraphjs/how-tos/manage-conversation-history/).

## Privacy and demo boundary

- Memory rows are always filtered by `user_id`; one user's context is not placed in another user's prompt.
- The feature does not store passwords, API keys, payment data, government-document numbers, precise addresses, or health information.
- A memory is personal context, never an approved ICONIC policy or Knowledge source.
- The Admin workspace keeps chat/file activity already needed for the demo. It does not expose a new cross-user personal-memory browser.

## Production work deliberately deferred

- explicit consent/versioning and retention expiry;
- data-subject export/delete workflow across all backups;
- encryption policy and a reviewed sensitive-data classifier;
- higher-scale user-memory vector index and recall/precision evaluation corpus.
