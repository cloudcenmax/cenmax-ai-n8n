// Extend the published Chat Completions class, preserving tool binding while
// keeping customer-visible tracing and serialization in the Cenmax AI identity.
export function cenmaxModelClass(ChatCompletionsModel) {
  return class CenmaxAIChatModel extends ChatCompletionsModel {
    lc_namespace = ['cenmax_ai', 'chat_models'];
    static lc_name() { return 'CenmaxAIChatModel'; }
    _llmType() { return 'cenmax_ai'; }
    getLsParams(options = {}) {
      return {ls_provider: 'cenmax-ai', ls_model_name: this.model, ls_model_type: 'chat',
        ls_temperature: this.temperature, ls_max_tokens: this.maxTokens,
        ...(options.stop ? {ls_stop: options.stop} : {})};
    }
    _identifyingParams() {
      return {provider: 'Cenmax AI', model: this.model, model_name: this.model,
        temperature: this.temperature, max_tokens: this.maxTokens};
    }
    identifyingParams() { return this._identifyingParams(); }
    toJSON() {
      // Live OAuth transports cannot be reconstructed from serialized traces.
      return {lc: 1, type: 'not_implemented', id: ['cenmax_ai', 'chat_models', 'CenmaxAIChatModel'],
        kwargs: this._identifyingParams()};
    }
  };
}
