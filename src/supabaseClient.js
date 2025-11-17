import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://rojgnwqppqkosinifvsh.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvamdud3FwcHFrb3NpbmlmdnNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1ODgyMTUsImV4cCI6MjA3NzE2NDIxNX0.Q7hZinqQePdj8DeKHA6F_dv1Veo9A9dknZuKjkVn4xE";

const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;
