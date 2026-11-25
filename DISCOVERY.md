# Discovery and publication

Checked 25 November 2026 against n8n's [verification requirements](https://docs.n8n.io/connect/create-nodes/build-your-node/reference/verification-guidelines.md) and [custom Docker installation guide](https://docs.n8n.io/connect/create-nodes/deploy-your-node/install-private-nodes.md).

The initial release supports self-hosted custom-node installation. It includes the n8n package manifest, searchable community-package keyword, Cenmax AI icon, install instructions, and an importable example workflow. GitHub release archives can be installed without waiting for npm publication. A public repository does not create a node-panel listing.

The npm package is `@cenmax/n8n-nodes-cenmax-ai`. Its manually dispatched `publish-npm.yml` workflow publishes only from a matching reviewed version tag, through the `npm` GitHub environment, with provenance. Configure the package's trusted publisher to match this public repository, that workflow filename, and environment exactly. Publishing requires npm scope ownership; no reusable npm secret is included in this repository. Registry publication does not qualify a new host surface or establish verified-node status.

Verified-node discovery and n8n Cloud support are not available with this design. Current requirements prohibit external runtime dependencies, environment-variable access, and filesystem access. They also call for TypeScript, the n8n-node development tool, and a passing community-package scanner. This implementation deliberately uses a private host credential store and LangChain runtime dependencies. An eligible implementation needs a separate credential architecture and verification work; do not submit this package as verification-ready or advertise Cloud compatibility.

After a compatible redesign, use n8n's [submission process](https://docs.n8n.io/connect/create-nodes/deploy-your-node/submit-community-nodes.md). Useful workflow templates can aid discovery, but template publication does not verify the model node or install its dependencies.
