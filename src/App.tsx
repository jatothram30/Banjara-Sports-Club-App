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

type Team = { id: string; name: string; createdAt?: unknown };
type Player = {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  phone?: string;
  createdAt?: unknown;
};
type ExtraType = "none" | "wide" | "no-ball" | "bye" | "leg-bye";
type ScoreSnapshot = {
  runs: number; wickets: number; legalBalls: number;
  striker: string; nonStriker: string; bowler: string;
  status: "live" | "completed"; result?: string;
};
type BallEvent = {
  id: string;
  runs: number; // runs off the bat, or completed extra runs for wides/byes/leg-byes
  extra: ExtraType;
  extraRuns: number;
  totalRuns: number;
  legal: boolean;
  wicket: boolean;
  wicketType?: string;
  dismissedBatter?: string;
  batter: string;
  bowler: string;
  over: number;
  ball: number;
  before: ScoreSnapshot;
};
type Match = {
  id: string;
  teamA: string;
  teamB: string;
  teamAId: string;
  teamBId: string;
  overs: number;
  status: "live" | "completed";
  innings: number;
  battingTeam: string;
  bowlingTeam: string;
  runs: number;
  wickets: number;
  legalBalls: number;
  target: number | null;
  striker: string;
  nonStriker: string;
  bowler: string;
  squadA: string[];
  squadB: string[];
  events: BallEvent[];
  firstInnings?: { runs: number; wickets: number; legalBalls: number; events: BallEvent[] };
  result?: string;
  createdAt?: unknown;
};

const emptyMatch = {
  teamAId: "",
  teamBId: "",
  overs: 10,
  squadA: [] as string[],
  squadB: [] as string[],
  striker: "",
  nonStriker: "",
  bowler: "",
};

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function App() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [page, setPage] = useState<"home" | "teams" | "players" | "new" | "matches" | "live">("home");
  const [teamName, setTeamName] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [playerTeam, setPlayerTeam] = useState("");
  const [playerPhone, setPlayerPhone] = useState("");
  const [setup, setSetup] = useState(emptyMatch);
  const [activeMatchId, setActiveMatchId] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const stopTeams = onSnapshot(query(collection(db, "teams"), orderBy("createdAt", "desc")), (s) =>
      setTeams(s.docs.map((d) => ({ id: d.id, ...d.data() } as Team)))
    );
    const stopPlayers = onSnapshot(query(collection(db, "players"), orderBy("createdAt", "desc")), (s) =>
      setPlayers(s.docs.map((d) => ({ id: d.id, ...d.data() } as Player)))
    );
    const stopMatches = onSnapshot(query(collection(db, "matches"), orderBy("createdAt", "desc")), (s) =>
      setMatches(s.docs.map((d) => ({ id: d.id, ...d.data() } as Match)))
    );
    return () => { stopTeams(); stopPlayers(); stopMatches(); };
  }, []);

  const activeMatch = matches.find((m) => m.id === activeMatchId) ?? null;
  const teamPlayers = (id: string) => players.filter((p) => p.teamId === id);
  const oversText = (balls: number) => `${Math.floor(balls / 6)}.${balls % 6}`;

  async function addTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!teamName.trim()) return;
    setBusy(true);
    try {
      await addDoc(collection(db, "teams"), { name: teamName.trim(), createdAt: serverTimestamp() });
      setTeamName(""); setNotice("Team added successfully.");
    } catch { setNotice("Team save failed. Check Firebase rules and connection."); }
    finally { setBusy(false); }
  }

  async function addPlayer(e: React.FormEvent) {
    e.preventDefault();
    const team = teams.find((t) => t.id === playerTeam);
    if (!playerName.trim() || !team) return;
    setBusy(true);
    try {
      await addDoc(collection(db, "players"), {
        name: playerName.trim(), teamId: team.id, teamName: team.name,
        phone: playerPhone.trim(), createdAt: serverTimestamp(),
      });
      setPlayerName(""); setPlayerPhone(""); setNotice("Player registered.");
    } catch { setNotice("Player save failed. Check Firebase rules and connection."); }
    finally { setBusy(false); }
  }

  function toggleSquad(team: "A" | "B", playerId: string) {
    setSetup((old) => {
      const key = team === "A" ? "squadA" : "squadB";
      const current = old[key];
      return { ...old, [key]: current.includes(playerId) ? current.filter((x) => x !== playerId) : current.length < 11 ? [...current, playerId] : current };
    });
  }

  async function createMatch(e: React.FormEvent) {
    e.preventDefault();
    const a = teams.find((t) => t.id === setup.teamAId);
    const b = teams.find((t) => t.id === setup.teamBId);
    if (!a || !b || a.id === b.id) return setNotice("Select two different teams.");
    if (setup.squadA.length < 2 || setup.squadB.length < 2) return setNotice("Select at least 2 players in each squad.");
    if (!setup.squadA.includes(setup.striker) || !setup.squadA.includes(setup.nonStriker) || setup.striker === setup.nonStriker || !setup.squadB.includes(setup.bowler)) return setNotice("Choose two different opening batters and one bowler.");
    setBusy(true);
    try {
      const ref = await addDoc(collection(db, "matches"), {
        teamA: a.name, teamB: b.name, teamAId: a.id, teamBId: b.id,
        overs: Math.max(1, Number(setup.overs) || 10), status: "live",
        innings: 1, battingTeam: a.name, bowlingTeam: b.name,
        runs: 0, wickets: 0, legalBalls: 0, target: null,
        striker: setup.striker, nonStriker: setup.nonStriker, bowler: setup.bowler,
        squadA: setup.squadA, squadB: setup.squadB, events: [], createdAt: serverTimestamp(),
      });
      setActiveMatchId(ref.id); setPage("live"); setSetup(emptyMatch); setNotice("Match started.");
    } catch { setNotice("Could not create match. Check Firebase rules."); }
    finally { setBusy(false); }
  }

  async function saveMatch(id: string, changes: Partial<Match>) {
    await updateDoc(doc(db, "matches", id), changes as Record<string, unknown>);
  }

  function chooseSquadPlayer(label: string, squad: string[], excluded: string[] = []): string | null {
    const choices = squad.filter((id) => !excluded.includes(id));
    if (!choices.length) return null;
    const menu = choices.map((id, i) => `${i + 1}. ${playerNameById(id)}`).join("\n");
    const answer = window.prompt(`${label}\n${menu}\nEnter number (Cancel to stop):`);
    if (answer === null) return null;
    const index = Number(answer) - 1;
    return Number.isInteger(index) && index >= 0 && index < choices.length ? choices[index] : null;
  }

  async function addBall(runs: number, extra: ExtraType = "none", wicket = false) {
    if (!activeMatch || activeMatch.status !== "live") return;
    const m = activeMatch;
    if (m.wickets >= 10 || m.legalBalls >= m.overs * 6 || (m.innings === 2 && m.target !== null && m.runs >= m.target)) return;

    const isLegal = extra !== "wide" && extra !== "no-ball";
    const extraRuns = extra === "wide" ? 1 + runs : extra === "no-ball" ? 1 : extra === "bye" || extra === "leg-bye" ? runs : 0;
    const batRuns = extra === "none" || extra === "no-ball" ? runs : 0;
    const totalRuns = batRuns + extraRuns;
    const nextRuns = m.runs + totalRuns;
    const nextBalls = m.legalBalls + (isLegal ? 1 : 0);

    let striker = m.striker;
    let nonStriker = m.nonStriker;
    let wicketsAdded = 0;
    let wicketType = "";
    let dismissedBatter = "";

    // Rotate strike for completed runs. The no-ball penalty itself is not a completed run.
    const completedRuns = extra === "wide" || extra === "bye" || extra === "leg-bye" ? runs : batRuns;
    if (completedRuns % 2 === 1) [striker, nonStriker] = [nonStriker, striker];

    if (wicket) {
      const typeAnswer = window.prompt("Dismissal type: 1 Bowled, 2 Caught, 3 LBW, 4 Run out, 5 Stumped, 6 Hit wicket, 7 Retired hurt", "1");
      if (typeAnswer === null) return;
      const types: Record<string, string> = { "1": "Bowled", "2": "Caught", "3": "LBW", "4": "Run out", "5": "Stumped", "6": "Hit wicket", "7": "Retired hurt" };
      wicketType = types[typeAnswer];
      if (!wicketType) { setNotice("Invalid dismissal type. Ball not recorded."); return; }
      if ((extra === "wide" && !["Run out", "Stumped", "Hit wicket"].includes(wicketType)) || (extra === "no-ball" && wicketType !== "Run out")) {
        setNotice("That dismissal is not valid on this delivery. Ball not recorded."); return;
      }
      const dismissedChoice = window.prompt(`Who is dismissed?\n1. ${playerNameById(striker)}\n2. ${playerNameById(nonStriker)}`, "1");
      if (dismissedChoice === null) return;
      if (dismissedChoice !== "1" && dismissedChoice !== "2") { setNotice("Choose 1 or 2. Ball not recorded."); return; }
      dismissedBatter = dismissedChoice === "2" ? nonStriker : striker;
      if (wicketType !== "Retired hurt") wicketsAdded = 1;
      const battingSquad = m.innings === 1 ? m.squadA : m.squadB;
      const nextBatter = wicketsAdded + m.wickets < 10 ? chooseSquadPlayer("Select next batter", battingSquad, [m.striker, m.nonStriker]) : null;
      if (dismissedBatter === striker) striker = nextBatter || "";
      else nonStriker = nextBatter || "";
    }

    const before: ScoreSnapshot = {
      runs: m.runs, wickets: m.wickets, legalBalls: m.legalBalls,
      striker: m.striker, nonStriker: m.nonStriker, bowler: m.bowler,
      status: m.status, ...(m.result ? { result: m.result } : {}),
    };
    const event: BallEvent = {
      id: makeId(), runs: batRuns, extra, extraRuns, totalRuns, legal: isLegal,
      wicket: wicketsAdded > 0, wicketType: wicketType || undefined,
      dismissedBatter: dismissedBatter || undefined, batter: m.striker, bowler: m.bowler,
      over: Math.floor(m.legalBalls / 6) + 1, ball: (m.legalBalls % 6) + 1, before,
    };
    const events = [...m.events, event];
    let finalBowler = m.bowler;
    if (isLegal && nextBalls > 0 && nextBalls % 6 === 0 && nextRuns < (m.target ?? Infinity)) {
      [striker, nonStriker] = [nonStriker, striker];
      const bowlingSquad = m.innings === 1 ? m.squadB : m.squadA;
      const alternatives = bowlingSquad.filter((id) => id !== m.bowler);
      const nextBowler = chooseSquadPlayer("Over completed. Select next bowler", bowlingSquad, [m.bowler]);
      finalBowler = nextBowler || alternatives[0] || m.bowler;
    }

    let status: Match["status"] = "live";
    let result = "";
    const inningsEnded = wicketsAdded + m.wickets >= 10 || nextBalls >= m.overs * 6;
    const chaseWon = m.innings === 2 && m.target !== null && nextRuns >= m.target;
    if (m.innings === 2 && (inningsEnded || chaseWon)) {
      status = "completed";
      result = chaseWon
        ? `${m.battingTeam} won by ${10 - (m.wickets + wicketsAdded)} wicket(s)`
        : `${m.bowlingTeam} won by ${Math.max(0, (m.target ?? 1) - 1 - nextRuns)} run(s)`;
    }

    try {
      await saveMatch(m.id, {
        runs: nextRuns, wickets: m.wickets + wicketsAdded, legalBalls: nextBalls, events,
        striker, nonStriker, bowler: finalBowler, status, result,
      });
    } catch { setNotice("Score update failed. Check your internet/Firebase rules."); }
  }

  async function startSecondInnings(m: Match) {
    if (m.innings !== 1 || m.status !== "live" || !(m.wickets >= 10 || m.legalBalls >= m.overs * 6)) return;
    const striker = chooseSquadPlayer(`Opening batter 1 (${m.teamB})`, m.squadB);
    if (!striker) return;
    const nonStriker = chooseSquadPlayer(`Opening batter 2 (${m.teamB})`, m.squadB, [striker]);
    if (!nonStriker) return;
    const bowler = chooseSquadPlayer(`Opening bowler (${m.teamA})`, m.squadA);
    if (!bowler) return;
    await saveMatch(m.id, {
      firstInnings: { runs: m.runs, wickets: m.wickets, legalBalls: m.legalBalls, events: m.events },
      innings: 2, battingTeam: m.teamB, bowlingTeam: m.teamA,
      target: m.runs + 1, runs: 0, wickets: 0, legalBalls: 0,
      striker, nonStriker, bowler, events: [], result: "",
    });
    setActiveMatchId(m.id); setPage("live");
  }

  async function undoLastBall() {
    if (!activeMatch || !activeMatch.events.length || activeMatch.status === "completed") return;
    const events = activeMatch.events.slice(0, -1);
    const old = activeMatch.events[activeMatch.events.length - 1];
    if (!old.before) { setNotice("This older delivery has no undo snapshot. New deliveries can be undone exactly."); return; }
    await saveMatch(activeMatch.id, { ...old.before, events });
  }

  const currentOver = activeMatch ? oversText(activeMatch.legalBalls) : "0.0";
  const playerNameById = (id: string) => players.find((p) => p.id === id)?.name ?? id;
  const liveMatches = useMemo(() => matches.filter((m) => m.status === "live"), [matches]);

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-mark">BSC</div>
        <div><h1>Banjara Sports Club</h1><p>Cricket • Live scoring • Players</p></div>
      </header>
      <nav className="app-nav">
        {(["home", "teams", "players", "new", "matches"] as const).map((item) =>
          <button key={item} className={page === item ? "active" : ""} onClick={() => setPage(item)}>
            {item === "new" ? "New Match" : item[0].toUpperCase() + item.slice(1)}
          </button>
        )}
      </nav>
      {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice("")}>×</button></div>}

      {page === "home" && <section className="panel">
        <h2>Club dashboard</h2>
        <div className="stat-grid">
          <div className="stat"><strong>{teams.length}</strong><span>Teams</span></div>
          <div className="stat"><strong>{players.length}</strong><span>Players</span></div>
          <div className="stat"><strong>{liveMatches.length}</strong><span>Live matches</span></div>
        </div>
        <h3>Live matches</h3>
        {liveMatches.length === 0 ? <p>No live matches right now.</p> : liveMatches.map((m) =>
          <button className="match-row" key={m.id} onClick={() => { setActiveMatchId(m.id); setPage("live"); }}>
            <b>{m.teamA} vs {m.teamB}</b><span>{m.battingTeam}: {m.runs}/{m.wickets} ({oversText(m.legalBalls)})</span>
          </button>
        )}
      </section>}

      {page === "teams" && <section className="panel">
        <h2>Teams</h2>
        <form onSubmit={addTeam} className="form-row">
          <input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Team name" required />
          <button disabled={busy}>Add team</button>
        </form>
        {teams.map((t) => <div className="list-row" key={t.id}><b>{t.name}</b><span>{teamPlayers(t.id).length} players</span></div>)}
      </section>}

      {page === "players" && <section className="panel">
        <h2>Player registration</h2>
        <form onSubmit={addPlayer} className="stack-form">
          <input value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="Player full name" required />
          <select value={playerTeam} onChange={(e) => setPlayerTeam(e.target.value)} required>
            <option value="">Select team</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <input value={playerPhone} onChange={(e) => setPlayerPhone(e.target.value)} placeholder="Phone (optional)" />
          <button disabled={busy || !teams.length}>Register player</button>
        </form>
        <h3>Registered players</h3>
        {players.map((p) => <div className="list-row" key={p.id}><b>{p.name}</b><span>{p.teamName}</span></div>)}
      </section>}

      {page === "new" && <section className="panel">
        <h2>Create match</h2>
        <form onSubmit={createMatch} className="stack-form">
          <label>Team A<select value={setup.teamAId} onChange={(e) => setSetup({ ...setup, teamAId: e.target.value, squadA: [], striker: "", nonStriker: "" })} required>
            <option value="">Select team</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select></label>
          <label>Team B<select value={setup.teamBId} onChange={(e) => setSetup({ ...setup, teamBId: e.target.value, squadB: [], bowler: "" })} required>
            <option value="">Select team</option>{teams.filter((t) => t.id !== setup.teamAId).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select></label>
          <label>Overs<input type="number" min="1" max="50" value={setup.overs} onChange={(e) => setSetup({ ...setup, overs: Number(e.target.value) })} /></label>
          {setup.teamAId && <fieldset><legend>Team A squad (max 11)</legend>{teamPlayers(setup.teamAId).map((p) =>
            <label className="check-row" key={p.id}><input type="checkbox" checked={setup.squadA.includes(p.id)} onChange={() => toggleSquad("A", p.id)} />{p.name}</label>)}</fieldset>}
          {setup.teamBId && <fieldset><legend>Team B squad (max 11)</legend>{teamPlayers(setup.teamBId).map((p) =>
            <label className="check-row" key={p.id}><input type="checkbox" checked={setup.squadB.includes(p.id)} onChange={() => toggleSquad("B", p.id)} />{p.name}</label>)}</fieldset>}
          <label>Opening striker<select value={setup.striker} onChange={(e) => setSetup({ ...setup, striker: e.target.value })}><option value="">Choose batter</option>{players.filter((p) => setup.squadA.includes(p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label>Non-striker<select value={setup.nonStriker} onChange={(e) => setSetup({ ...setup, nonStriker: e.target.value })}><option value="">Choose batter</option>{players.filter((p) => setup.squadA.includes(p.id) && p.id !== setup.striker).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label>Opening bowler<select value={setup.bowler} onChange={(e) => setSetup({ ...setup, bowler: e.target.value })}><option value="">Choose bowler</option>{players.filter((p) => setup.squadB.includes(p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <button disabled={busy}>Start match</button>
        </form>
      </section>}

      {page === "matches" && <section className="panel">
        <h2>Matches</h2>
        {matches.map((m) => <div className="match-card" key={m.id}>
          <b>{m.teamA} vs {m.teamB}</b><p>{m.battingTeam}: {m.runs}/{m.wickets} ({oversText(m.legalBalls)} overs)</p>
          {m.result && <strong>{m.result}</strong>}
          {m.status === "live" && <div className="button-row">
            <button onClick={() => { setActiveMatchId(m.id); setPage("live"); }}>Open scoring</button>
            {m.innings === 1 && (m.wickets >= 10 || m.legalBalls >= m.overs * 6) && <button onClick={() => startSecondInnings(m)}>Start 2nd innings</button>}
          </div>}
        </div>)}
      </section>}

      {page === "live" && activeMatch && <section className="panel live-panel">
        <div className="live-heading"><span className="live-dot">LIVE</span><span>Innings {activeMatch.innings}</span></div>
        <h2>{activeMatch.battingTeam}</h2>
        <div className="score-big">{activeMatch.runs}/{activeMatch.wickets}</div>
        <p className="overs-line">Overs {currentOver} / {activeMatch.overs} • Target {activeMatch.target ?? "—"}</p>
        <div className="current-players">
          <div><small>Striker</small><b>{playerNameById(activeMatch.striker)}</b></div>
          <div><small>Non-striker</small><b>{playerNameById(activeMatch.nonStriker)}</b></div>
          <div><small>Bowler</small><b>{playerNameById(activeMatch.bowler)}</b></div>
   
