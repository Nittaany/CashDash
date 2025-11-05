import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://hjkpatqjwdqjfegkdfss.supabase.co"; 
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhqa3BhdHFqd2RxamZlZ2tkZnNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NDg4OTAsImV4cCI6MjA3NzQyNDg5MH0.mVC0JdlMhSp0KkpQmH04pMmtHRrFUNiZGf9qcaD98Zo";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
