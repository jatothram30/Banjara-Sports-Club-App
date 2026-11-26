import React, { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import "./styles.css";

type Team = { id: string; name: string };
type Player = { id: string; name: string; teamId: string; teamName: string };
type BallEvent = {
  id: string;
  label: string;
  runs: number;
  legal: boolean;
  wicket: boolean;
};
type Match = {
  id: string;
  teamAId: string;
  teamA: string;
  teamBId: string;
  teamB: string;
  oversLimit: number;
  status: "live" | "completed";
  innings: 1 | 2;
  battingTeamId: string;
  bowlingTeamId: string;
  runs: number;
  wickets: number;
  legalBalls: number;
  target: number | null;
  events: BallEvent[];
  result?: string;
  createdAt?: unknown;
};

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 980, margin: "0 auto", padding: 16, color: "#f7f3e8" },
  panel: { background: "#171717", border: "1px solid #393329", borderRadius: 14, padding: 16, marginBottom: 14 },
  row: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },
  input: { padding: 11, borderRadius: 8, border: "1px solid #777", background: "#242424", color: "white", minWidth: 0 },
  button: { padding: "10px 14px", borderRadius: 8, border: "1px solid #b58b35", background: "#b58b35", color: "#111", fontWeight: 700, cursor: "pointer" },
  secondary: { padding: "10px 14px", borderRadius: 8, border: "1px solid #777", background: "#292929", color: "white", fontWeight: 600, cursor: "pointer" },
  muted: { color: "#b8b1a3", fontSize: 13 },
};

export default function App() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [teamName, setTeamName] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [playerTeam, setPlayerTeam] = useState("");
  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");
  const [overs, setOvers] = useState("10");
  const [activeMatchId, setActiveMatchId] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsubTeams = onSnapshot(
      query(collection(db, "teams"), orderBy("name")),
      (snap) => setTeams(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Team, "id">) }))),
      (error) => setNotice(`Teams load error: ${error.message}`)
    );
    const unsubPlayers = onSnapshot(
      collection(db, "players"),
      (snap) => setPlayers(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Player, "id">) }))),
      (error) => setNotice(`Players load error: ${error.message}`)
    );
    const unsubMatches = onSnapshot(
      query(collection(db, "matches"), orderBy("createdAt", "desc")),
      (snap) => setMatches(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Match, "id">) }))),
      (error) => setNotice(`Matches load error: ${error.message}`)
    );
    return () => { unsubTeams(); unsubPlayers(); unsubMatches(); };
  }, []);

  const activeMatch = matches.find((m) => m.id === activeMatchId) ?? null;
  const teamPlayers = useMemo(
    () => players.filter((p) => p.teamId === playerTeam),
    [players, playerTeam]
  );

  async function addTeam() {
    const name = teamName.trim();
    if (!name) return setNotice("Team name enter cheyyi.");
    if (teams.some((t) => t.name.toLowerCase() === name.toLowerCase())) return setNotice("Ee team already undi.");
    setBusy(true);
    try {
      await addDoc(collection(db, "teams"), { name, createdAt: serverTimestamp() });
      setTeamName("");
      setNotice("Team added.");
    } catch (e) { setNotice(errorText(e)); }
    finally { setBusy(false); }
  }

  async function addPlayer() {
    const name = playerName.trim();
    const team = teams.find((t) => t.id === playerTeam);
    if (!name || !team) return setNotice("Player name and team select cheyyi.");
    setBusy(true);
    try {
      await addDoc(collection(db, "players"), { name, teamId: team.id, teamName: team.name, createdAt: serverTimestamp() });
      setPlayerName("");
      setNotice("Player added.");
    } catch (e) { setNotice(errorText(e)); }
    finally { setBusy(false); }
  }

  async function createMatch() {
    const a = teams.find((t) => t.id === teamA);
    const b = teams.find((t) => t.id === teamB);
    const limit = Number(overs);
    if (!a || !b || a.id === b.id) return setNotice("Two different teams select cheyyi.");
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) return setNotice("Overs 1 nunchi 50 madhya undali.");
    setBusy(true);
    try {
      const ref = await addDoc(collection(db, "matches"), {
        teamAId: a.id, teamA: a.name, teamBId: b.id, teamB: b.name,
        oversLimit: limit, status: "live", innings: 1,
        battingTeamId: a.id, bowlingTeamId: b.id,
        runs: 0, wickets: 0, legalBalls: 0, target: null, events: [],
        createdAt: serverTimestamp(),
      });
      setActiveMatchId(ref.id);
      setNotice("Match created. " + a.name + " batting first.");
    } catch (e) { setNotice(errorText(e)); }
    finally { setBusy(false); }
  }

async function saveMatch(match: Match, changes: Partial<Match>) {
  await updateDoc(
    doc(db, "matches", match.id),
    changes as any
  );
}
  async function addBall(kind: "0" | "1" | "2" | "3" | "4" | "6" | "WD" | "NB" | "B" | "LB" | "W") {
    if (!activeMatch || activeMatch.status !== "live") return;
    const m = activeMatch;
    const extra = kind === "WD" || kind === "NB" || kind === "B" || kind === "LB";
    const wicket = kind === "W";
    const legal = kind !== "WD" && kind !== "NB";
    const batterRuns = ["0", "1", "2", "3", "4", "6"].includes(kind) ? Number(kind) : 0;
    const total = kind === "WD" || kind === "NB" ? 1 : batterRuns;
    const nextRuns = m.runs + total;
    const nextWickets = m.wickets + (wicket ? 1 : 0);
    const nextBalls = m.legalBalls + (legal ? 1 : 0);
    const event: BallEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      label: kind === "B" ? "Bye" : kind === "LB" ? "Leg bye" : kind === "WD" ? "Wide" : kind === "NB" ? "No ball" : wicket ? "Wicket" : `${batterRuns} run${batterRuns === 1 ? "" : "s"}`,
      runs: total, legal, wicket,
    };
    const nextEvents = [...(m.events ?? []), event];
    const overDone = nextBalls >= m.oversLimit * 6;
    const chaseDone = m.innings === 2 && m.target !== null && nextRuns >= m.target;
    const allOut = nextWickets >= 10;
    const completed = overDone || chaseDone || allOut;
    try {
      await saveMatch(m, {
        runs: nextRuns, wickets: nextWickets, legalBalls: nextBalls,
        events: nextEvents, status: completed ? "completed" : "live",
        ...(completed && m.innings === 2 ? { result: `${m.battingTeamId === m.teamAId ? m.teamA : m.teamB} won` } : {}),
      } as Partial<Match>);
      if (completed) setNotice(chaseDone ? "Chase complete." : "Innings/match completed.");
    } catch (e) { setNotice(errorText(e)); }
  }

  async function undoLastBall() {
    if (!activeMatch || !activeMatch.events?.length) return setNotice("Undo cheyyadaniki ball ledu.");
    const remaining = activeMatch.events.slice(0, -1);
    const last = activeMatch.events[activeMatch.events.length - 1];
    const runs = Math.max(0, activeMatch.runs - last.runs);
    const wickets = Math.max(0, activeMatch.wickets - (last.wicket ? 1 : 0));
    const legalBalls = Math.max(0, activeMatch.legalBalls - (last.legal ? 1 : 0));
    try {
      await saveMatch(activeMatch, { events: remaining, runs, wickets, legalBalls, status: "live" });
      setNotice("Last ball undone.");
    } catch (e) { setNotice(errorText(e)); }
  }

  async function startSecondInnings() {
    if (!activeMatch || activeMatch.innings !== 1) return;
    const firstRuns = activeMatch.runs;
    try {
      await saveMatch(activeMatch, {
        innings: 2, target: firstRuns + 1,
        battingTeamId: activeMatch.bowlingTeamId,
        bowlingTeamId: activeMatch.battingTeamId,
        runs: 0, wickets: 0, legalBalls: 0, events: [], status: "live",
      });
      setNotice(`Second innings started. Target: ${firstRuns + 1}`);
    } catch (e) { setNotice(errorText(e)); }
  }

  function currentOvers(m: Match) {
    return `${Math.floor(m.legalBalls / 6)}.${m.legalBalls % 6}`;
  }

  return (
    <main style={styles.page}>
      <header style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ color: "#d6ad55", letterSpacing: 3, fontWeight: 800 }}>BANJARA SPORTS CLUB</div>
        <h1 style={{ margin: "6px 0", color: "#d6ad55" }}>CRICKET APP</h1>
        <div style={styles.muted}>Teams • Players • Live Match Scoring</div>
      </header>

      {notice && <div style={{ ...styles.panel, borderColor: "#9b7938" }}>{notice}</div>}

      <section style={styles.panel}>
        <h2>1. Add Team</h2>
        <div style={styles.row}>
          <input style={styles.input} value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Team name" />
          <button style={styles.button} disabled={busy} onClick={addTeam}>Add Team</button>
        </div>
        <p style={styles.muted}>Teams: {teams.length}</p>
        {teams.map((t) => <div key={t.id}>• {t.name}</div>)}
      </section>

      <section style={styles.panel}>
        <h2>2. Add Player</h2>
        <div style={styles.row}>
          <input style={styles.input} value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="Player name" />
          <select style={styles.input} value={playerTeam} onChange={(e) => setPlayerTeam(e.target.value)}>
            <option value="">Select team</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button style={styles.button} disabled={busy} onClick={addPlayer}>Add Player</button>
        </div>
        <p style={styles.muted}>Players: {players.length}</p>
        {players.map((p) => <div key={p.id}>• {p.name} — {p.teamName}</div>)}
      </section>

      <section style={styles.panel}>
        <h2>3. Create Match</h2>
        <div style={styles.row}>
          <select style={styles.input} value={teamA} onChange={(e) => setTeamA(e.target.value)}>
            <option value="">Team A (bat first)</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select style={styles.input} value={teamB} onChange={(e) => setTeamB(e.target.value)}>
            <option value="">Team B</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <input style={{ ...styles.input, width: 90 }} type="number" min="1" max="50" value={overs} onChange={(e) => setOvers(e.target.value)} />
          <button style={styles.button} disabled={busy} onClick={createMatch}>Create Match</button>
        </div>
      </section>

      <section style={styles.panel}>
        <h2>4. Matches</h2>
        {matches.length === 0 && <p style={styles.muted}>Matches inka levu.</p>}
        {matches.map((m) => (
          <div key={m.id} style={{ ...styles.row, justifyContent: "space-between", borderBottom: "1px solid #393329", padding: "9px 0" }}>
            <span>{m.teamA} vs {m.teamB} — {m.status === "live" ? "LIVE" : "COMPLETED"}</span>
            <button style={styles.secondary} onClick={() => setActiveMatchId(m.id)}>Open</button>
          </div>
        ))}
      </section>

      {activeMatch && (
        <section style={{ ...styles.panel, borderColor: "#d6ad55" }}>
          <h2>LIVE SCORE</h2>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#d6ad55" }}>
            {activeMatch.battingTeamId === activeMatch.teamAId ? activeMatch.teamA : activeMatch.teamB}
          </div>
          <div style={{ fontSize: 34, fontWeight: 900, margin: "8px 0" }}>
            {activeMatch.runs}/{activeMatch.wickets}
          </div>
          <div style={styles.muted}>Overs {currentOvers(activeMatch)} / {activeMatch.oversLimit} • Innings {activeMatch.innings}{activeMatch.target !== null ? ` • Target ${activeMatch.target}` : ""}</div>
          {activeMatch.status === "live" ? (
            <>
              <h3>Runs</h3>
              <div style={styles.row}>
                {(["0", "1", "2", "3", "4", "6"] as const).map((v) => <button key={v} style={styles.button} onClick={() => addBall(v)}>{v}</button>)}
              </div>
              <h3>Extras / Wicket</h3>
              <div style={styles.row}>
                {(["WD", "NB", "B", "LB", "W"] as const).map((v) => <button key={v} style={styles.secondary} onClick={() => addBall(v)}>{v}</button>)}
                <button style={styles.secondary} onClick={undoLastBall}>Undo last ball</button>
              </div>
            </>
          ) : <strong>{activeMatch.innings === 1 ? "First innings completed" : "Match completed"}</strong>}
          {activeMatch.innings === 1 && (
            <p><button style={styles.button} onClick={startSecondInnings}>Start 2nd Innings</button></p>
          )}
          <h3>Recent Balls</h3>
          <div style={styles.muted}>{(activeMatch.events ?? []).slice(-12).reverse().map((ev) => <span key={ev.id} style={{ display: "inline-block", margin: 4, padding: 7, border: "1px solid #555", borderRadius: 7 }}>{ev.label}</span>)}</div>
        </section>
      )}

      <footer style={{ ...styles.muted, textAlign: "center", padding: 16 }}>
        Banjara Sports Club • Admin scoring prototype
      </footer>
    </main>
  );
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Firebase settings check cheyyi.";
      }
