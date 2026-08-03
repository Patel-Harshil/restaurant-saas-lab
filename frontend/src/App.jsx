import { useEffect, useState } from "react";
import { AuthPanel } from "./components/AuthPanel";
import { MenuManager } from "./components/MenuManager";
import "./App.css";

const STORAGE_KEY = "restaurant-saas-lab:session";

function App() {
  const [session, setSession] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    if (session) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [session]);

  return (
    <div className="app-shell">
      <header>
        <h1>🍽️ Restaurant SaaS Lab</h1>
        {session ? (
          <div className="session-bar">
            <span>Signed in as {session.user.email}</span>
            <button type="button" onClick={() => setSession(null)}>Log out</button>
          </div>
        ) : (
          <span className="session-bar">Browsing as a guest</span>
        )}
      </header>

      <main>
        <MenuManager token={session?.token} />
        {!session && (
          <AuthPanel onAuthenticated={(token, user) => setSession({ token, user })} />
        )}
      </main>
    </div>
  );
}

export default App;
