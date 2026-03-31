import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

interface PainelUser {
  id: string;
  nome: string;
  cargo: string;
}

const STORAGE_KEY = "painel_user";

export function getPainelUser(): PainelUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setPainelUser(user: PainelUser | null) {
  if (user) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function painelLogout() {
  localStorage.removeItem(STORAGE_KEY);
}

export function useAdmin() {
  const [user, setUser] = useState<PainelUser | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const stored = getPainelUser();
    if (!stored) {
      setLoading(false);
      navigate("/admin/login");
      return;
    }
    setUser(stored);
    setLoading(false);
  }, [navigate]);

  return { user, loading };
}
