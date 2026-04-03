import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // CORS Preflight check
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { to, type, event_id, user_id, extra_data } = await req.json();
    
    // Default Fallbacks
    let subject = "EventArena Notification";
    let html = "<p>Update from EventArena</p>";
    
    // Templating Engine
    if (type === 'registration_confirm') {
      subject = `Registration Confirmed: ${extra_data?.title || 'Your Event'}`;
      html = `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>You're In!</h2>
          <p>You have successfully registered for the event.</p>
          <p>Your QR code digital ticket is attached directly to your EventArena dashboard.</p>
        </div>
      `;
    } 
    else if (type === 'event_reminder') {
      subject = `Alert: Event Starts in 30 Minutes!`;
      html = `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>Get Ready.</h2>
          <p>Your competition engine spins up in exactly 30 minutes! Log in now to ensure your connection is stable before the countdown hits zero.</p>
        </div>
      `;
    } 
    else if (type === 'results_ready') {
      const rank = extra_data?.rank || '-';
      const score = extra_data?.score || 0;
      subject = "Your Official Results are Ready!";
      html = `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>The Ceremony Has Concluded.</h2>
          <p>Your mathematical performance resulted in:</p>
          <h3>Rank #${rank}</h3>
          <h3>Total Score: ${score}</h3>
          <p>You can securely log in right now to review your answers against the correct pipeline, and mint your cryptographically signed Certificate.</p>
        </div>
      `;
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        // For testing on specific free tier accounts, Resend requires onboarding@resend.dev as the from origin
        from: 'EventArena Engine <onboarding@resend.dev>',
        to: [to],
        subject: subject,
        html: html,
      }),
    });

    const data = await res.json();
    
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
