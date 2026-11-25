# n8n qualification

Tested 25 November 2026 in the official `docker.n8n.io/n8nio/n8n:2.49.5` Linux ARM64 image, digest `sha256:c349b24d6e242b4ea14d75e6f1a90c50e348cf4b1c4512b4a0a50219ead6533d`, running Node.js 26.13.0. The integration used `@langchain/openai` 1.8.5 and explicitly pinned `@langchain/core` 1.5.1. The released n8n runtime was not modified.

| Check | Result |
| --- | --- |
| Genuine n8n custom-extension loader | Loaded the node and credential through the package directory |
| Device OAuth helper and private reference | Passed; no reusable token entered n8n's credential form |
| Live entitled model catalogue | Returned only public Cenmax AI model IDs and labels |
| Workflow and credential import through n8n CLI | Passed using the isolated native SQLite database |
| Native AI Agent 3.1 with Calculator tool | Passed; one successful calculation tool call and final result `59677` |
| Streamed Chat Completions transport | Passed through the real LangChain model and Cenmax AI service |
| Second execution from the stored workflow after forced credential expiry | Passed; refresh credential rotated and expiry renewed |
| Helper logout and local credential removal | Passed; old access credential returned HTTP 401 |

Live testing found that relying on the host's LangChain core package left the integration's ESM import unresolved. An explicit compatible core dependency fixed it. A separate security review checked fixed-origin transport, selected-model enforcement, bounded responses, public tracing identity, private stores, durable refresh retirement, and redacted failures.

The test connection was revoked and the temporary container removed after qualification. Only synthetic arithmetic was used; account identifiers, connection references, credentials, raw execution data, and host state are excluded from this repository.

Not qualified: editor UI interaction, npm community-package installation, n8n Cloud, verified-node listing, distributed workers, workflow memory, other platforms or versions, load testing, or allowance exhaustion. CLI workflow execution is the tested harness surface; this record does not imply Marketplace approval.
