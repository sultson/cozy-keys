import supabase from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";


const useAuth = () => {
    const [session, setSession] = useState<Session | null>(null)
    const hasCheckedSession = useRef(false)


    useEffect(() => {
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (!session && !hasCheckedSession.current) {
            const { data, error } = await supabase.auth.signInAnonymously()
            if (error) {
                console.error(error)
            }
            hasCheckedSession.current = true
            setSession(data.session)
        }
        setSession(session)
      })
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session)
      })
      return () => subscription.unsubscribe()
    }, [])


    return { session }
};


export default useAuth;