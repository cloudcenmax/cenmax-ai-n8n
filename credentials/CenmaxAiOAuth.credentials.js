class CenmaxAiOAuth {
  name = 'cenmaxAiOAuth';
  displayName = 'Cenmax AI OAuth';
  documentationUrl = 'https://console.ai.cenmax.in';
  properties = [{
    displayName: 'Connection Reference', name: 'connectionId', type: 'string', default: '', required: true,
    typeOptions: {password: true},
    description: 'Private connection reference created by cenmax-n8n login on this n8n host. OAuth tokens are never pasted into n8n.',
  }];
}
module.exports = {CenmaxAiOAuth};
