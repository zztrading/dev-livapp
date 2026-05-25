// Index page - redirects to static landing or dashboard
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        window.location.replace("/dashboard");
      } else {
        window.location.replace("/landing/index.html");
      }
    });
  }, []);

  return null;
};

export default Index;
