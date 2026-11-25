class CenmaxAiChatModel {
  description = {
    displayName: 'Cenmax AI Chat Model', name: 'cenmaxAiChatModel', group: ['transform'], version: 1,
    description: 'Use a Cenmax AI subscription for model inference', defaults: {name: 'Cenmax AI Chat Model'},
    icon: 'file:cenmax-ai.svg',
    codex: {categories: ['AI'], subcategories: {AI: ['Language Models']}, resources: {primaryDocumentation: [{url: 'https://github.com/cloudcenmax/cenmax-ai-n8n#readme'}]}},
    inputs: [], outputs: ['ai_languageModel'], outputNames: ['Model'],
    credentials: [{name: 'cenmaxAiOAuth', required: true}],
    properties: [
      {displayName: 'Model', name: 'model', type: 'options', default: '', required: true,
        typeOptions: {loadOptionsMethod: 'getModels'}, description: 'Models available to the connected Cenmax AI account'},
      {displayName: 'Temperature', name: 'temperature', type: 'number', default: 0.2, typeOptions: {minValue: 0, maxValue: 2}},
      {displayName: 'Maximum Output Tokens', name: 'maxTokens', type: 'number', default: 2048, typeOptions: {minValue: 1}},
    ],
  };
  methods = {loadOptions: {async getModels() {
    const {availableModels} = await import('../lib/connections.mjs');
    const credentials = await this.getCredentials('cenmaxAiOAuth');
    return (await availableModels(credentials.connectionId)).map(model => ({name: model.label, value: model.id}));
  }}};

  async supplyData(itemIndex) {
    const [{ChatOpenAICompletions}, {connection, availableModels}, {subscriptionFetch}, {API}, {cenmaxModelClass}] = await Promise.all([
      import('@langchain/openai'), import('../lib/connections.mjs'), import('../lib/transport.mjs'), import('../lib/oauth.mjs'), import('../lib/model-class.mjs'),
    ]);
    const credentials = await this.getCredentials('cenmaxAiOAuth');
    const model = this.getNodeParameter('model', itemIndex);
    const selected = (await availableModels(credentials.connectionId)).find(entry => entry.id === model);
    if (!selected) throw new Error('Choose an available Cenmax AI model.');
    const temperature = this.getNodeParameter('temperature', itemIndex, 0.2);
    const maxTokens = this.getNodeParameter('maxTokens', itemIndex, 2048);
    if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2 || !Number.isSafeInteger(maxTokens) || maxTokens < 1 || (selected.output && maxTokens > selected.output)) throw new Error('Choose valid Cenmax AI generation limits.');
    const CenmaxAIModel = cenmaxModelClass(ChatOpenAICompletions);
    return {response: new CenmaxAIModel({
      model, temperature, maxTokens, streaming: true, maxRetries: 0,
      apiKey: 'cenmax-oauth-managed', supportsStrictToolCalling: false,
      configuration: {baseURL: API, fetch: subscriptionFetch(connection(credentials.connectionId), model)},
    })};
  }
}
module.exports = {CenmaxAiChatModel};
