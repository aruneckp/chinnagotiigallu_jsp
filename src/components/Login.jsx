import { useState } from "react";
import { unlock } from "../lib/crypto.js";
import Icon from "./Icon.jsx";

export default function Login({ onUnlock }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!user.trim() || !pass) { setError("Enter your user id and password."); return; }
    setBusy(true); setError("");
    try {
      onUnlock(await unlock(user, pass, remember));
    } catch (err) {
      setError(err.message === "insecure"
        ? "This page must be opened over https (or on localhost) to sign in."
        : "That user id and password don't match. Check them and try again.");
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="login-side" aria-hidden="true">
        <span className="login-big">CG</span>
        <p>Local voter analytics</p>
        <ul>
          <li><Icon name="users" size={16} /> Every voter, searchable in Telugu or English</li>
          <li><Icon name="tree" size={16} /> Family trees worked out from the roll</li>
          <li><Icon name="chart" size={16} /> One-click analysis by part, block and age</li>
        </ul>
      </div>
      <form className="login-card" onSubmit={submit} noValidate>
        <div className="login-mark">CG</div>
        <h1>Chinnagottigallu · ZPTC</h1>
        <p className="login-sub">Voter list analytics. Sign in to open the list.</p>

        <label className="field">
          <span>User id</span>
          <span className="inputwrap">
            <Icon name="user" size={18} />
            <input value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username"
              autoCapitalize="none" autoCorrect="off" spellCheck="false" placeholder="Enter user id" />
          </span>
        </label>
        <label className="field">
          <span>Password</span>
          <span className="inputwrap">
            <Icon name="lock" size={18} />
            <input type={show ? "text" : "password"} value={pass} onChange={(e) => setPass(e.target.value)}
              autoComplete="current-password" placeholder="Enter password" />
            <button type="button" className="peek" onClick={() => setShow(!show)}
              aria-label={show ? "Hide password" : "Show password"}>
              <Icon name={show ? "eyeOff" : "eye"} size={18} />
            </button>
          </span>
        </label>
        <label className="remember">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Keep me signed in on this device
        </label>

        {error && <p className="login-error" role="alert">{error}</p>}
        <button className="btn primary block" type="submit" disabled={busy}>
          {busy ? <><span className="spinner" /> Opening the list…</> : "Sign in"}
        </button>
        <p className="login-foot"><Icon name="lock" size={12} /> The list is encrypted; it opens only with the right sign-in.</p>
      </form>
    </div>
  );
}
