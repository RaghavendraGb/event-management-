import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req) => {
  return new Response(
    JSON.stringify({ message: "Hello Siddik 🚀 NO AUTH WORKING!" }),
    {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
    }
  );
});