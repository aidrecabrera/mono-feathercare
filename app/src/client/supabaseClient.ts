import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://ofwutctiuezihlprbwqs.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9md3V0Y3RpdWV6aWhscHJid3FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTgwOTIwODUsImV4cCI6MjAzMzY2ODA4NX0.RMO9URsAmSRpVd7RPWFmpdz6wmfHM1i_qQohCNfSyoc";

export const supabase = createClient(supabaseUrl, supabaseKey);
