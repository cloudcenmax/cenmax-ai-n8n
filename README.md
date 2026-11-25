# Cenmax AI for n8n

Use a Cenmax AI subscription as a chat model in self-hosted n8n. The node supplies a LangChain chat model to n8n AI chains and agents. Device authorization happens in the browser; reusable OAuth credentials stay in a private directory on the n8n host.

## Status

This initial integration is for **self-hosted n8n on a POSIX host**. It does not claim n8n Cloud support or verified-community-node status. Native n8n credential forms do not perform this package's device-code flow. A host helper authorizes the connection, and n8n stores only an opaque, random connection reference. Do not paste OAuth access or refresh tokens into n8n.

The Cenmax AI service must register public client `cenmax-n8n` with device-code and refresh-token grants and scope `chat`. Client registration is a service prerequisite, not something installation performs.

## Install and connect

The qualified installation uses n8n's custom-extension loader. It exports the `Cenmax AI Chat Model` node and `Cenmax AI OAuth` credential. n8n **2.49.5** was tested in its official Linux ARM64 image with Node.js **26.13.0**, `@langchain/openai` **1.8.5**, and `@langchain/core` **1.5.1**. Both LangChain runtime dependencies are pinned explicitly; a host's older core package is not sufficient. See [qualification](QUALIFICATION.md) for acceptance checks and limits.

Install the npm package into a dedicated custom-extension directory on your n8n host:

```sh
npm install --prefix ./cenmax-n8n-custom --omit=dev --ignore-scripts --legacy-peer-deps @cenmax/n8n-nodes-cenmax-ai@0.1.1
```

Set `N8N_CUSTOM_EXTENSIONS` to the absolute path of `cenmax-n8n-custom/node_modules/@cenmax/n8n-nodes-cenmax-ai` and restart n8n. Run the helper from that installed directory as the n8n process user. This is the qualified custom-extension loading route; publishing to npm does not make the node verified or Cloud-compatible.

Alternatively, download and extract the archive attached to this repository's GitHub release into a dedicated directory, then install its dependencies:

```sh
tar -xzf cenmax-n8n-nodes-cenmax-ai-0.1.1.tgz
cd package
npm install --omit=dev --ignore-scripts --legacy-peer-deps
```

Set `N8N_CUSTOM_EXTENSIONS` to that extracted package's absolute directory, make the directory readable by the n8n process user, and restart n8n. Include the entire package, not just the `nodes` directory: the loader needs its credential definition, and the node needs `lib` plus its installed runtime dependencies. In Docker, mount the directory at a path accessible to the `node` user and configure the same absolute path in the container. No npm registry publication is required for this route. Do not install a second n8n server as a package dependency.

Run the helper as the same operating-system user as n8n:

```sh
node lib/cli.mjs login
```

Open the printed Cenmax AI approval URL, confirm the matching code, and choose the account whose allowance should be used. The helper prints a 256-bit connection reference after successful approval. Keep that reference private and enter it in a new **Cenmax AI OAuth** credential. It is a local capability: anyone holding it and access to the configured credential directory can use that connection.

Add **Cenmax AI Chat Model**, choose the credential, and select a model from its authenticated model list. Connect its Model output to an n8n AI chain or agent. Models such as `pro` or `worker` are selectable only if returned for that account. Context/output limits come from discovery. The model uses Chat Completions and supports normal LangChain tool binding and streaming.

Import [the calculator example](examples/cenmax-calculator.json), assign your own Cenmax AI credential to the model node, and choose an entitled model before executing it. The template contains no credential or connection reference. Its `CUSTOM.cenmaxAiChatModel` type matches the qualified custom-extension installation; an eventual npm community-package installation uses its registered package-prefixed type instead. The expected calculation result is `59677`.

```sh
node lib/cli.mjs models CONNECTION_REFERENCE
node lib/cli.mjs logout CONNECTION_REFERENCE
```

Logout revokes the current grant and removes local credentials. If revocation cannot complete, retry on a working connection. Approval codes and connection references should not be posted in public issues.

## Deployment boundary

Default credential directory: `~/.config/cenmax-n8n`. To configure a persistent mount, set `CENMAX_N8N_CREDENTIAL_DIR` to an absolute, private directory shared by the helper and all workers executing this node. Its owner must be the n8n process user, mode 0700; token files use 0600. Symlinks and unsafe file permissions are refused. Cross-process locks serialize refresh; an uncertain rotating-refresh result requires reconnect rather than replay.

The connection reference is random and hashed into its filename; it is not an account ID or a guessable tenant name. Store a distinct connection reference in each n8n credential and use n8n's credential sharing controls intentionally. Mutually untrusted tenants need separate operating-system identities and data directories. This plugin does not isolate code running as the same user.

Only `https://console.ai.cenmax.in` is contacted. Model traffic goes to `/app/v1/chat/completions`; model discovery uses `/app/v1/models`. Redirects, alternate origins, arbitrary URL/header overrides, and other API routes are rejected. The LangChain model holds a placeholder credential; the transport obtains the current bearer token immediately before each request. No telemetry is added. The user's plan allowance applies; subscription use is not unlimited.

## Development and release

```sh
npm test
npm pack --dry-run
```

Unit tests cover real credential-store permissions, concurrent refresh, secret redaction, entitlement filtering, and guarded transport. A genuine n8n AI Agent workflow, native Calculator tool, streamed model generation, forced-expiry refresh, and revocation were also qualified; see [the versioned record](QUALIFICATION.md). Other host versions and installation modes require separate checks.

The package `files` allowlist excludes credentials, test output and local configuration. Inspect the exact npm archive before publishing. No installation lifecycle scripts or automatic global installs are used. See [discovery and publication requirements](DISCOVERY.md) for the self-hosted launch route, npm provenance workflow, and verified-node/Cloud blockers.

References: [n8n AI Chat Model](https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.lmchatopenai/), [community-node publication](https://docs.n8n.io/connect/create-nodes/deploy-your-node/submit-community-nodes.md).
