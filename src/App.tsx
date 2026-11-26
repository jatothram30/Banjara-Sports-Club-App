
import React, { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";
import { db } from "./firebase";
import "./styles.css";

type Player = {
  id: string;
  name: string;
  team: string;
};

type Match = {
  id: string;
  teamA: string;
  teamB: string;
  format: string;
  overs: number;
  venue: string;
  status: string;
  innings: number;
  batting: string;
  bowling: string;
  runs: number;
  wickets: number;
  balls: number;
  target: number;
  striker: string;
  nonStriker: string;
  bowler: string;
  history: string[];
};

export default function App() {
  const [page, setPage] = useState("Home");
  const [teams, setTeams] = useState<any[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [match, setMatch] = useState<Match | null>(null);
  const [undoStack, setUndoStack] = useState<Match[]>([]);

  const [teamName, setTeamName] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [playerTeam, setPlayerTeam] = useState("");
  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");
  const [format, setFormat] = useState("T20");
  const [overs, setOvers] = useState(20);
  const [venue, setVenue] = useState("");
  const [striker, setStriker] = useState("");
  const [nonStriker, setNonStriker] = useState("");
  const [bowler, setBowler] = useState("");

  useEffect(() => {
    const a = onSnapshot(collection(db, "teams"), s =>
      setTeams(s.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    const b = onSnapshot(collection(db, "players"), s =>
      setPlayers(s.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as Player)))
    );

    const c = onSnapshot(collection(db, "matches"), s =>
      setMatches(s.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as Match)))
    );

    return () => {
      a();
      b();
      c();
    };
  }, []);

  const createTeam = async () => {
    if (!teamName.trim()) return alert("Enter team name");

    await addDoc(collection(db, "teams"), {
      name: teamName,
      createdAt: serverTimestamp()
    });

    setTeamName("");
    alert("Team registered!");
  };

  const createPlayer = async () => {
    if (!playerName.trim() || !playerTeam)
      return alert("Enter player details");

    await addDoc(collection(db, "players"), {
      name: playerName,
      team: playerTeam,
      runs: 0,
      wickets: 0,
      matches: 0,
      createdAt: serverTimestamp()
    });

    setPlayerName("");
    alert("Player registered!");
  };

  const startMatch = async () => {
    if (!teamA || !teamB || teamA === teamB)
      return alert("Select two different teams");

    if (!striker || !nonStriker || !bowler)
      return alert("Enter opening players and bowler");

    const ref = await addDoc(collection(db, "matches"), {
      teamA,
      teamB,
      format,
      overs,
      venue,
      status: "LIVE",
      innings: 1,
      batting: teamA,
      bowling: teamB,
      runs: 0,
      wickets: 0,
      balls: 0,
      target: 0,
      striker,
      nonStriker,
      bowler,
      history: [],
      createdAt: serverTimestamp()
    });

    setMatch({
      id: ref.id,
      teamA,
      teamB,
      format,
      overs,
      venue,
      status: "LIVE",
      innings: 1,
      batting: teamA,
      bowling: teamB,
      runs: 0,
      wickets: 0,
      balls: 0,
      target: 0,
      striker,
      nonStriker,
      bowler,
      history: []
    });

    setUndoStack([]);
    setPage("Scoring");
  };

  const saveMatch = async (next: Match) => {
    setUndoStack(old => [...old, match!].slice(-30));
    setMatch(next);

    await updateDoc(doc(db, "matches", next.id), {
      runs: next.runs,
      wickets: next.wickets,
      balls: next.balls,
      striker: next.striker,
      nonStriker: next.nonStriker,
      bowler: next.bowler,
      history: next.history,
      status: next.status,
      innings: next.innings,
      batting: next.batting,
      bowling: next.bowling,
      target: next.target
    });
  };

  const ball = async (runs: number) => {
    if (!match || match.status !== "LIVE") return;
    if (match.wickets >= 10 || match.balls >= match.overs * 6)
      return alert("Innings completed");

    const next = { ...match, history: [...match.history] };
    next.runs += runs;
    next.balls += 1;
    next.history.push(String(runs));

    if (runs % 2 === 1) {
      [next.striker, next.nonStriker] =
        [next.nonStriker, next.striker];
    }

    if (next.balls % 6 === 0) {
      [next.striker, next.nonStriker] =
        [next.nonStriker, next.striker];
    }

    await saveMatch(next);
  };

  const extra = async (type: string) => {
    if (!match || match.status !== "LIVE") return;

    const next = { ...match, history: [...match.history] };

    if (type === "WD" || type === "NB") {
      next.runs += 1;
      next.history.push(type);
    } else {
      next.history.push(type);
      next.balls += 1;
    }

    await saveMatch(next);
  };

  const wicket = async () => {
    if (!match || match.status !== "LIVE") return;
    if (match.wickets >= 10) return;

    const name = prompt("New batter name?");
    if (!name) return;

    const next = {
      ...match,
      wickets: match.wickets + 1,
      balls: match.balls + 1,
      striker: name,
      history: [...match.history, "WICKET"]
    };

    await saveMatch(next);
  };

  const undo = async () => {
    if (!match || undoStack.length === 0) return;

    const previous = undoStack[undoStack.length - 1];
    setUndoStack(old => old.slice(0, -1));
    setMatch(previous);

    await updateDoc(doc(db, "matches", previous.id), {
      runs: previous.runs,
      wickets: previous.wickets,
      balls: previous.balls,
      striker: previous.striker,
      nonStriker: previous.nonStriker,
      bowler: previous.bowler,
      history: previous.history
    });
  };

  const changeStrike = async () => {
    if (!match) return;
    await saveMatch({
      ...match,
      striker: match.nonStriker,
      nonStriker: match.striker
    });
  };

  const changeBowler = async () => {
    if (!match) return;
    const name = prompt("Enter next bowler name");
    if (!name) return;
    await saveMatch({ ...match, bowler: name });
  };

  const endInnings = async () => {
    if (!match) return;

    if (match.innings === 1) {
      const next = {
        ...match,
        innings: 2,
        target: match.runs + 1,
        batting: match.bowling,
        bowling: match.batting,
        runs: 0,
        wickets: 0,
        balls: 0,
        history: [],
        status: "LIVE"
      };
      await saveMatch(next);
      alert("Second innings started!");
    } else {
      await saveMatch({ ...match, status: "COMPLETED" });
      alert("Match completed!");
      setPage("Matches");
    }
  };

  const oversDisplay = (balls: number) =>
    `${Math.floor(balls / 6)}.${balls % 6}`;

  return (
    <div className="app">
      <header>
        <div className="crest">🏏</div>
        <h1>BANJARA SPORTS CLUB</h1>
        <p>PLAY • COMPETE • WIN</p>
      </header>

      <nav>
        {["Home", "Teams", "Players", "New Match", "Matches", "Admin"].map(item =>
          <button key={item} onClick={() => setPage(item)}>
            {item}
          </button>
        )}
      </nav>

      <main>
        {page === "Home" && (
          <section className="card">
            <h2>Welcome to BSC</h2>
            <h3>Cricket Community</h3>
            <p>Teams: {teams.length}</p>
            <p>Players: {players.length}</p>
            <p>Matches: {matches.length}</p>
            <h3>Live Matches</h3>
            {matches.filter(m => m.status === "LIVE").map(m =>
              <div key={m.id} className="card">
                <b>{m.teamA} vs {m.teamB}</b>
                <h2>{m.runs}/{m.wickets}</h2>
                <p>{oversDisplay(m.balls)} Overs</p>
                <button onClick={() => {
                  setMatch(m);
                  setPage("Live Score");
                }}>View Score</button>
              </div>
            )}
          </section>
        )}

        {page === "Teams" && (
          <section className="card">
            <h2>Team Registration</h2>
            <input placeholder="Team name" value={teamName}
              onChange={e => setTeamName(e.target.value)} />
            <button onClick={createTeam}>Register Team</button>
            <h3>Registered Teams</h3>
            {teams.map(t => <p key={t.id}>🏏 {t.name}</p>)}
          </section>
        )}

        {page === "Players" && (
          <section className="card">
            <h2>Player Registration</h2>
            <input placeholder="Player name" value={playerName}
              onChange={e => setPlayerName(e.target.value)} />
            <select value={playerTeam}
              onChange={e => setPlayerTeam(e.target.value)}>
              <option value="">Select Team</option>
              {teams.map(t =>
                <option key={t.id} value={t.name}>{t.name}</option>
              )}
            </select>
            <button onClick={createPlayer}>Register Player</button>
            <h3>Player List</h3>
            {players.map(p =>
              <p key={p.id}>{p.name} — {p.team}</p>
            )}
          </section>
        )}

        {page === "New Match" && (
          <section className="card">
            <h2>New Match Setup</h2>
            <label>Team A</label>
            <select value={teamA} onChange={e => setTeamA(e.target.value)}>
              <option value="">Select Team</option>
              {teams.map(t => <option key={t.id}>{t.name}</option>)}
            </select>

            <label>Team B</label>
            <select value={teamB} onChange={e => setTeamB(e.target.value)}>
              <option value="">Select Team</option>
              {teams.map(t => <option key={t.id}>{t.name}</option>)}
            </select>

            <label>Format</label>
            <select value={format} onChange={e => setFormat(e.target.value)}>
              {["T10", "T20", "ODI", "Test", "Custom"].map(f =>
                <option key={f}>{f}</option>
              )}
            </select>

            <label>Overs</label>
            <input type="number" value={overs}
              onChange={e => setOvers(Number(e.target.value))} />

            <input placeholder="Venue" value={venue}
              onChange={e => setVenue(e.target.value)} />

            <input placeholder="Opening striker" value={striker}
              onChange={e => setStriker(e.target.value)} />

            <input placeholder="Non-striker" value={nonStriker}
              onChange={e => setNonStriker(e.target.value)} />

            <input placeholder="Opening bowler" value={bowler}
              onChange={e => setBowler(e.target.value)} />

            <button className="gold" onClick={startMatch}>
              Start Match
            </button>
          </section>
        )}

        {(page === "Scoring" || page === "Live Score") && match && (
          <section className="card">
            <h2>{match.batting}</h2>
            <p>{match.teamA} vs {match.teamB}</p>
            <h1 className="score">
              {match.runs}/{match.wickets}
            </h1>
            <h3>Overs: {oversDisplay(match.balls)} / {match.overs}</h3>

            {match.target > 0 && <p>Target: {match.target}</p>}

            <p>Striker: {match.striker}</p>
            <p>Non-Striker: {match.nonStriker}</p>
            <p>Bowler: {match.bowler}</p>

            {match.status === "LIVE" && (
              <>
                <div className="score-grid">
                  {[0, 1, 2, 3, 4, 6].map(n =>
                    <button key={n} onClick={() => ball(n)}>{n}</button>
                  )}
                </div>

                <div className="score-grid">
                  <button onClick={() => extra("WD")}>Wide</button>
                  <button onClick={() => extra("NB")}>No Ball</button>
                  <button onClick={() => extra("B")}>Byes</button>
                  <button onClick={() => extra("LB")}>Leg Byes</button>
                  <button onClick={wicket}>Wicket</button>
                  <button onClick={undo}>Undo</button>
                </div>

                <button onClick={changeStrike}>Change Strike</button>
                <button onClick={changeBowler}>Change Bowler</button>
                <button className="gold" onClick={endInnings}>
                  End Innings / Finish Match
                </button>
              </>
            )}

            <h3>Ball History</h3>
            {match.history.slice().reverse().map((h, i) =>
              <span key={i} className="pill">{h}</span>
            )}
          </section>
        )}

        {page === "Matches" && (
          <section className="card">
            <h2>Match Centre</h2>
            {matches.map(m =>
              <div className="card" key={m.id}>
                <h3>{m.teamA} vs {m.teamB}</h3>
                <p>{m.format} • {m.venue}</p>
                <h2>{m.runs}/{m.wickets}</h2>
                <p>{m.status}</p>
                <button onClick={() => {
                  setMatch(m);
                  setPage("Live Score");
                }}>View Match</button>
              </div>
            )}
          </section>
        )}

        {page === "Admin" && (
          <section className="card">
            <h2>BSC Admin</h2>
            <p>Admin dashboard setup pending.</p>
            <p>Team management: {teams.length}</p>
            <p>Player management: {players.length}</p>
            <p>Match management: {matches.length}</p>
          </section>
        )}
      </main>

      <footer>
        Banjara Sports Club © 2026
      </footer>
    </div>
  );
      }
            
