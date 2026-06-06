export const SYNONYMS = new Map([
  ['auth', ['authentication', 'authorization', 'authorize', 'login', 'signin', 'sign-in', 'session', 'token', 'jwt']],
  ['config', ['configuration', 'settings', 'preferences', 'options', 'env', 'environment']],
  ['db', ['database', 'storage', 'data', 'query', 'sql', 'migration', 'schema', 'table']],
  ['api', ['endpoint', 'route', 'handler', 'request', 'response', 'rest', 'http']],
  ['ui', ['interface', 'component', 'view', 'page', 'screen', 'layout', 'render']],
  ['util', ['utility', 'helper', 'tool', 'common', 'shared', 'lib']],
  ['test', ['spec', 'suite', 'assert', 'mock', 'stub', 'fixture', 'coverage']],
  ['log', ['logging', 'logger', 'console', 'debug', 'trace', 'monitor']],
  ['err', ['error', 'exception', 'fault', 'failure', 'crash', 'panic']],
  ['req', ['request', 'incoming', 'client', 'input', 'payload']],
  ['res', ['response', 'output', 'result', 'reply', 'return']],
  ['fn', ['function', 'method', 'handler', 'callback', 'closure', 'procedure']],
  ['ctx', ['context', 'state', 'environment', 'scope']],
  ['svc', ['service', 'provider', 'manager', 'controller', 'handler']],
  ['repo', ['repository', 'store', 'collection', 'data-access']],
  ['dto', ['data-transfer', 'payload', 'schema', 'model', 'type']],
  ['mw', ['middleware', 'interceptor', 'guard', 'filter', 'pipe']],
  ['conn', ['connection', 'socket', 'link', 'channel', 'session']],
  ['cache', ['memo', 'buffer', 'store', 'redis', 'memory']],
  ['queue', ['buffer', 'pipeline', 'worker', 'job', 'task']],
  ['sync', ['synchronize', 'update', 'refresh', 'poll', 'webhook']],
  ['async', ['promise', 'await', 'callback', 'deferred', 'concurrent']],
  ['parse', ['extract', 'decode', 'deserialize', 'transform', 'convert']],
  ['validate', ['check', 'verify', 'sanitize', 'assert', 'schema']],
  ['encrypt', ['hash', 'cipher', 'encode', 'secure', 'crypto', 'sign']],
  ['deploy', ['release', 'publish', 'build', 'ship', 'rollout']],
  ['route', ['path', 'url', 'endpoint', 'uri', 'link']],
  ['middleware', ['hook', 'interceptor', 'guard', 'filter', 'plugin']],
  ['component', ['widget', 'element', 'module', 'block', 'part']],
  ['hook', ['lifecycle', 'callback', 'listener', 'event', 'effect']],
  ['state', ['store', 'context', 'reducer', 'atom', 'signal']],
  ['prop', ['property', 'attribute', 'field', 'param', 'option']],
  ['event', ['emit', 'dispatch', 'trigger', 'listener', 'callback']],
  ['stream', ['pipe', 'flow', 'channel', 'observable', 'iterator']],
  ['template', ['layout', 'partial', 'snippet', 'boilerplate', 'scaffold']],
  ['schema', ['type', 'interface', 'model', 'definition', 'contract']],
  ['index', ['key', 'lookup', 'search', 'catalog', 'registry']],
  ['migrate', ['migration', 'upgrade', 'transform', 'convert', 'version']],
  ['seed', ['fixture', 'sample', 'mock', 'test-data', 'initial']],
  ['worker', ['thread', 'process', 'task', 'job', 'runner']],
]);

export const TURKISH_SYNONYMS = new Map([
  ['giriş', ['login', 'signin', 'authentication', 'auth', 'giriş yap']],
  ['çıkış', ['logout', 'signout', 'exit', 'leave', 'çıkış yap']],
  ['kullanıcı', ['user', 'account', 'profile', 'member', 'kullanici']],
  ['dosya', ['file', 'document', 'record', 'belge']],
  ['ayar', ['setting', 'config', 'configuration', 'preference', 'option']],
  ['ayarlar', ['settings', 'config', 'configuration', 'preferences', 'options']],
  ['veritabanı', ['database', 'db', 'storage', 'data']],
  ['veri', ['data', 'record', 'entry', 'information']],
  ['arama', ['search', 'query', 'find', 'lookup', 'fetch']],
  ['bul', ['find', 'search', 'locate', 'get', 'fetch']],
  ['göster', ['show', 'display', 'render', 'view', 'list']],
  ['sil', ['delete', 'remove', 'destroy', 'drop', 'clear']],
  ['ekle', ['add', 'create', 'insert', 'put', 'post']],
  ['güncelle', ['update', 'modify', 'edit', 'patch', 'change']],
  ['değiştir', ['change', 'modify', 'update', 'switch', 'toggle']],
  ['liste', ['list', 'array', 'collection', 'items', 'all']],
  ['sayfa', ['page', 'view', 'screen', 'route']],
  ['hata', ['error', 'exception', 'fault', 'bug', 'issue']],
  ['istek', ['request', 'req', 'call', 'query']],
  ['yanıt', ['response', 'res', 'reply', 'result']],
  ['bağlantı', ['connection', 'link', 'url', 'route', 'conn']],
  ['güvenlik', ['security', 'auth', 'permission', 'access', 'role']],
  ['izin', ['permission', 'access', 'role', 'authorization', 'grant']],
  ['rol', ['role', 'permission', 'access', 'group', 'level']],
  ['bildirim', ['notification', 'alert', 'message', 'notice', 'push']],
  ['mesaj', ['message', 'msg', 'text', 'content', 'chat']],
  ['sohbet', ['chat', 'conversation', 'thread', 'discussion', 'message']],
  ['resim', ['image', 'picture', 'photo', 'img', 'figure']],
  ['video', ['video', 'media', 'clip', 'stream']],
  ['ses', ['audio', 'sound', 'voice', 'media']],
  ['yükle', ['upload', 'send', 'post', 'push', 'submit']],
  ['indir', ['download', 'get', 'fetch', 'pull', 'export']],
  ['dışa aktar', ['export', 'download', 'save', 'output', 'dump']],
  ['içe aktar', ['import', 'upload', 'load', 'input', 'read']],
  ['kod', ['code', 'source', 'script', 'program', 'snippet']],
  ['fonksiyon', ['function', 'fn', 'method', 'handler', 'procedure']],
  ['değişken', ['variable', 'var', 'let', 'const', 'value']],
  ['döngü', ['loop', 'iteration', 'cycle', 'repeat', 'for', 'while']],
  ['koşul', ['condition', 'if', 'else', 'switch', 'check', 'branch']],
  ['sınıf', ['class', 'type', 'model', 'entity', 'constructor']],
  ['nesne', ['object', 'instance', 'entity', 'item', 'element']],
  ['dizi', ['array', 'list', 'collection', 'vector', 'sequence']],
  ['yapı', ['structure', 'config', 'schema', 'type', 'interface']],
  ['arayüz', ['interface', 'ui', 'view', 'component', 'layout']],
  ['sunucu', ['server', 'host', 'backend', 'instance', 'node']],
  ['istemci', ['client', 'browser', 'frontend', 'consumer', 'caller']],
  ['ağ', ['network', 'net', 'web', 'connection', 'protocol']],
  ['test', ['test', 'spec', 'check', 'verify', 'validate']],
  ['hata ayıklama', ['debug', 'debugging', 'trace', 'inspect', 'diagnose']],
  ['güncelleme', ['update', 'upgrade', 'patch', 'release', 'version']],
  ['sürüm', ['version', 'release', 'build', 'tag', 'milestone']],
  ['başlat', ['start', 'init', 'launch', 'run', 'begin']],
  ['durdur', ['stop', 'halt', 'kill', 'terminate', 'end']],
  ['yeniden başlat', ['restart', 'reboot', 'reload', 'refresh']],
  ['temizle', ['clean', 'clear', 'reset', 'purge', 'wipe']],
  ['sıfırla', ['reset', 'clear', 'restore', 'default', 'initialize']],
  ['tarih', ['date', 'time', 'timestamp', 'datetime', 'calendar']],
  ['zaman', ['time', 'date', 'duration', 'timer', 'clock']],
]);

function tokenize(str) {
  return str
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function expandFromMap(tokens, synonymMap) {
  const expanded = new Set();
  for (const token of tokens) {
    const synonyms = synonymMap.get(token);
    if (synonyms) {
      for (const s of synonyms) expanded.add(s);
    }
    expanded.add(token);
  }
  return [...expanded];
}

export function expandQuery(query) {
  if (!query || typeof query !== 'string') return [];
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  return expandFromMap(tokens, SYNONYMS);
}

export function expandQueryTurkish(query) {
  if (!query || typeof query !== 'string') return [];
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const expanded = new Set();
  for (const token of tokens) {
    const trSynonyms = TURKISH_SYNONYMS.get(token);
    if (trSynonyms) {
      for (const s of trSynonyms) expanded.add(s);
    }
    const enSynonyms = SYNONYMS.get(token);
    if (enSynonyms) {
      for (const s of enSynonyms) expanded.add(s);
    }
    expanded.add(token);
  }
  return [...expanded];
}
