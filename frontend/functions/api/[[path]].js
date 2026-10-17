export async function onRequest(context) {
  if (context.env.BACKEND) {
    return context.env.BACKEND.fetch(context.request);
  }
  return new Response(JSON.stringify({ error: "Service Binding not configured" }), {
    status: 500,
    headers: { "Content-Type": "application/json" }
  });
}