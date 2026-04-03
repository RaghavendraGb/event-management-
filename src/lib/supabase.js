import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jfqynyxhzusyiwavuijg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmcXlueXhoenVzeWl3YXZ1aWpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNjY4NjEsImV4cCI6MjA5MDc0Mjg2MX0._5clBR5d0gCd-LXiB4mEcXyV486nODPXI0hVE-OwOwA';

export const supabase = createClient(supabaseUrl, supabaseKey);
