import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, clearToken, getToken, setToken } from "../api/client";
const Ctx = createContext(null);
export function AuthProvider({ children }) {
    const [token, setTok] = useState(getToken());
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const fetchMe = async (nextToken) => {
        const t = nextToken ?? token;
        if (!t) {
            setUser(null);
            return;
        }
        const me = await api.me();
        setUser(me);
    };
    useEffect(() => {
        (async () => {
            if (!token) {
                setLoading(false);
                return;
            }
            try {
                await fetchMe();
            }
            catch (e) {
                clearToken();
                setUser(null);
            }
            finally {
                setLoading(false);
            }
        })();
    }, [token]);
    const value = useMemo(() => ({
        token,
        user,
        loading,
        login: async (email, password) => {
            const res = await api.login(email, password);
            const t = res.access_token;
            setToken(t);
            setTok(t);
            await fetchMe(t);
        },
        logout: () => {
            clearToken();
            setTok(null);
            setUser(null);
        },
    }), [token, user, loading]);
    return _jsx(Ctx.Provider, { value: value, children: children });
}
export function useAuth() {
    const ctx = useContext(Ctx);
    if (!ctx)
        throw new Error("AuthProvider missing");
    return ctx;
}
