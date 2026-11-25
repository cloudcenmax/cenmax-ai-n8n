# Discovery and publication

Checked 25 November 2026 against n8n's [verification requirements](https://docs.n8n.io/connect/create-nodes/build-your-node/reference/verification-guidelines.md) and [custom Docker installation guide](https://docs.n8n.io/connect/create-nodes/deploy-your-node/install-private-nodes.md).

The initial release supports self-hosted custom-node installation. It includes the n8n package manifest, searchable community-package keyword, Cenmax AI icon, install instructions, and an importable example workflow. GitHub release archives can be installed without waiting for npm publication. A public repository does not create a node-panel listing.

For npm distribution, confirm ownership of the `@cenmax-ai` scope, configure this repository as an npm trusted publisher, and run the manually dispatched `publish-npm` workflow from the reviewed version tag. The workflow publishes with provenance through GitHub Actions. Registry authentication and scope ownership must be configured by a maintainer; no reusable npm secret is included. No registry publication has been performed as part of qualification.

Verified-node discovery and n8n Cloud support are not available with this design. Current requirements prohibit external runtime dependencies, environment-variable access, and filesystem access. They also call for TypeScript, the n8n-node development tool, and a passing community-package scanner. This implementation deliberately uses a private host credential store and LangChain runtime dependencies. An eligible implementation needs a separate credential architecture and verification work; do not submit this package as verification-ready or advertise Cloud compatibility.

After a compatible redesign, use n8n's [submission process](https://docs.n8n.io/connect/create-nodes/deploy-your-node/submit-community-nodes.md). Useful workflow templates can aid discovery, but template publication does not verify the model node or install its dependencies.
