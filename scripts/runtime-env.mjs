// Offline .env.local credentials must never become local Worker bindings.
process.env.CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV = 'false';
process.env.CLOUDFLARE_INCLUDE_PROCESS_ENV = 'false';
delete process.env.ELEVENLABS_API_KEY;
