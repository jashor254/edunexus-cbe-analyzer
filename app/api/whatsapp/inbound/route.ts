// app/api/whatsapp/inbound/route.ts
//
// Historical WhatsApp inbound webhook URL. The real implementation now lives
// at app/api/webhooks/whatsapp/route.ts, which uses the WhatsApp webhook env
// vars actually configured in this project (WHATSAPP_WEBHOOK_VERIFY_TOKEN,
// WHATSAPP_APP_SECRET). Re-exported here so the pipeline keeps working
// regardless of which of the two URLs Meta has registered as the callback.

export { GET, POST } from '@/app/api/webhooks/whatsapp/route'
