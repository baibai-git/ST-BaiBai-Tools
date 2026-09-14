// Only unwrap the reply-envelope tool. This is NOT a general tool executor.
function getCompleteResponseToolName(body) {
    if (!['openai', 'custom'].includes(body?.chat_completion_source) || !Array.isArray(body?.tools) || body.tools.length !== 1) return '';
    const tool = body.tools[0];
    const fn = tool?.function;
    return tool?.type === 'function'
        && /^emit_complete_response(?:_[a-zA-Z0-9]+)?$/.test(fn?.name || '')
        && fn?.parameters?.type === 'object'
        && fn.parameters.properties?.content?.type === 'string'
        && Array.isArray(fn.parameters.required) && fn.parameters.required.includes('content')
        ? fn.name : '';
}

// ponytail: one local request identity, no content fingerprint or intent queue.
// JSON cloning/spreading
// by preset hooks keeps it; the inner retry hook removes it before network I/O.
const GENERATION_REQUEST_ID_KEY = '__baibai_generation_id';
let requestSerial = 0;

function createGenerationRequestId() {
    return `bbt:${globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}:${++requestSerial}`}`;
}

function getGenerationRequestId(body) {
    const id = body?.[GENERATION_REQUEST_ID_KEY];
    return typeof id === 'string' && id.startsWith('bbt:') ? id : '';
}

function markGenerationRequest(body, id = getGenerationRequestId(body) || createGenerationRequestId()) {
    body[GENERATION_REQUEST_ID_KEY] = id;
    return id;
}

function stripGenerationRequestId(body) {
    if (!getGenerationRequestId(body)) return body;
    const clean = { ...body };
    delete clean[GENERATION_REQUEST_ID_KEY];
    return clean;
}

export { createGenerationRequestId, getCompleteResponseToolName, getGenerationRequestId, markGenerationRequest, stripGenerationRequestId };
