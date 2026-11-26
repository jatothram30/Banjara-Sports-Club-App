
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

type Team = {
  id: string;
  name: string;
};

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
  squadA: string[];
  squadB: string[];
};

export default function App() {
  const [page, setPage] = useState("Home");
  const [teams, setTeams] = useState<Team[]>([]);
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

  const [squadA, setSquadA] = useState<string[]>([]);
  const [squadB, setSquadB] = useState<string[]>([]);
  const [striker, setStriker] = useState("");
  const [nonStriker, setNonStriker] = useState("");
  const [bowler, setBowler] = useState("");

  useEffect(() => {
    const unsubTeams = onSnapshot(
      collection(db, "teams"),
      snapshot => {
        setTeams(
          snapshot.docs.map(d => ({
            id: d.id,
            name: String(d.data().name || "")
          }))
        );
      },
      error => alert("Teams loading error: " + error.message)
    );

    const unsubPlayers = onSnapshot(
      collection(db, "players"),
      snapshot => {
        setPlayers(
          snapshot.docs.map(d => ({
            id: d.id,
            name: String(d.data().name || ""),
            team: String(d.data().team || "")
          }))
        );
      },
      error => alert("Players loading error: " + error.message)
    );

    const unsubMatches = onSnapshot(
      collection(db, "matches"),
      snapshot => {
        setMatches(
          snapshot.docs.map(d => {
            const data = d.data();
            return {
              ...data,
              id: d.id,
              history: data.history || [],
              squadA: data.squadA || [],
              squadB: data.squadB || []
            } as Match;
          })
        );
      },
      error => alert("Matches loading error: " + error.message)
    );

    return () => {
      unsubTeams();
      unsubPlayers();
      unsubMatches();
    };
  }, []);

  const playersOf = (team: string) =>
    players.filter(p => p.team === team);

  const toggleSquad = (
    playerId: string,
    side: "A" | "B"
  ) => {
    const current = side === "A" ? squadA : squadB;
    const setter = side === "A" ? setSquadA : setSquadB;

    if (current.includes(playerId)) {
      setter(current.filter(id => id !== playerId));
      return;
    }

    if (current.length >= 11) {
      alert("Maximum 11 players only");
      return;
    }

    setter([...current, playerId]);
  };

  const createTeam = async () => {
    if (!teamName.trim()) {
      alert("Enter team name");
      return;
    }

    try {
      await addDoc(collection(db, "teams"), {
        name: teamName.trim(),
        createdAt: serverTimestamp()
      });

      setTeamName("");
      alert("Team registered!");
    } catch (error) {
      alert("Team registration failed");
      console.error(error);
    }
  };

  const createPlayer = async () => {
    if (!playerName.trim() || !playerTeam) {
      alert("Enter player name and select team");
      return;
    }

    try {
      await addDoc(collection(db, "players"), {
        name: playerName.trim(),
        team: playerTeam,
        runs: 0,
        wickets: 0,
        matches: 0,
        createdAt: serverTimestamp()
      });

      setPlayerName("");
      alert("Player registered!");
    } catch (error) {
      alert("Player registration failed");
      console.error(error);
    }
  };

  const chooseFromList = (
    title: string,
    list: string[],
    excluded: string[] = []
  ): string => {
    const available = list.filter(
      name => !excluded.includes(name)
    );

    if (available.length === 0) {
      alert("No available players in this squad");
      return "";
    }

    const message =
      title +
      "\n\n" +
      available.map((name, index) =>
        `${index + 1}. ${name}`
      ).join("\n") +
      "\n\nEnter player number:";

    const answer = prompt(message);
    if (!answer) return "";

    const index = Number(answer) - 1;
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= available.length
    ) {
      alert("Invalid player number");
      return "";
    }

    return available[index];
  };

  const startMatch = async () => {
    if (!teamA || !teamB || teamA === teamB) {
      alert("Select two different teams");
      return;
    }

    if (overs < 1 || !Number.isFinite(overs)) {
      alert("Enter valid overs");
      return;
    }

    if (squadA.length < 2 || squadB.length < 1) {
      alert("Select at least 2 players in Team A and 1 in Team B");
      return;
    }

    const squadAPlayers = squadA
      .map(id => players.find(p => p.id === id)?.name)
      .filter((name): name is string => Boolean(name));

    const squadBPlayers = squadB
      .map(id => players.find(p => p.id === id)?.name)
      .filter((name): name is string => Boolean(name));

    if (
      !striker ||
      !nonStriker ||
      !bowler ||
      striker === nonStriker
    ) {
      alert("Select two different opening batters and a bowler");
      return;
    }

    if (
      !squadAPlayers.includes(striker) ||
      !squadAPlayers.includes(nonStriker) ||
      !squadBPlayers.includes(bowler)
    ) {
      alert("Choose opening players from the selected squads");
      return;
    }

    try {
      const data = {
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
        squadA: squadAPlayers,
        squadB: squadBPlayers,
        createdAt: serverTimestamp()
      };

      const ref = await addDoc(
        collection(db, "matches"),
        data
      );

      setMatch({
        ...data,
        id: ref.id,
        createdAt: undefined
      } as Match);

      setUndoStack([]);
      setPage("Scoring");
    } catch (error) {
      alert("Could not start match. Check Firebase.");
      console.error(error);
    }
  };

  const saveMatch = async (next: Match) => {
    if (!match) return;

    setUndoStack(old => [...old, match].slice(-30));
    setMatch(next);

    try {
      await updateDoc(doc(db, "matches", next.id), {
        teamA: next.teamA,
        teamB: next.teamB,
        format: next.format,
        overs: next.overs,
        venue: next.venue,
        status: next.status,
        innings: next.innings,
        batting: next.batting,
        bowling: next.bowling,
        runs: next.runs,
        wickets: next.wickets,
        balls: next.balls,
        target: next.target,
        striker: next.striker,
        nonStriker: next.nonStriker,
        bowler: next.bowler,
        history: next.history,
        squadA: next.squadA,
        squadB: next.squadB,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      alert("Could not save score. Check your internet/Firebase rules.");
      console.error(error);
    }
  };

  const bowlingSquad = (m: Match) =>
    m.bowling === m.teamA ? m.squadA : m.squadB;

  const battingSquad = (m: Match) =>
    m.batting === m.teamA ? m.squadA : m.squadB;

  const afterLegalBall = (next: Match) => {
    next.balls += 1;

    if (next.balls % 6 === 0) {
      [next.striker, next.nonStriker] = [
        next.nonStriker,
        next.striker
      ];

      const nextBowler = chooseFromList(
        "Over completed. Select next bowler:",
        bowlingSquad(next),
        [next.bowler]
      );

      if (nextBowler) {
        next.bowler = nextBowler;
      }
    }
  };

  const ball = async (runs: number) => {
    if (!match || match.status !== "LIVE") return;

    if (
      match.wickets >= 10 ||
      match.balls >= match.overs * 6
    ) {
      alert("Innings completed");
      return;
    }

    const next: Match = {
      ...match,
      history: [...match.history]
    };

    next.runs += runs;
    next.history.push(String(runs));

    if (runs % 2 === 1) {
      [next.striker, next.nonStriker] = [
        next.nonStriker,
        next.striker
      ];
    }

    afterLegalBall(next);

    await saveMatch(next);
  };

  const extra = async (type: "WD" | "NB" | "B" | "LB") => {
    if (!match || match.status !== "LIVE") return;

    if (
      match.wickets >= 10 ||
      match.balls >= match.overs * 6
    ) {
      alert("Innings completed");
      return;
    }

    let additionalRuns = 0;

    if (type === "WD" || type === "NB") {
      const answer = prompt(
        type === "WD"
          ? "Additional wide runs? Enter 0 if none:"
          : "Runs off the bat on this no-ball? Enter 0 if none:"
      );

      if (answer === null) return;

      additionalRuns = Number(answer);

      if (
        !Number.isInteger(additionalRuns) ||
        additionalRuns < 0
      ) {
        alert("Enter a valid run number");
        return;
      }
    } else {
      const answer = prompt(
        type === "B" ? "How many byes?" : "How many leg-byes?"
      );

      if (answer === null) return;

      additionalRuns = Number(answer);

      if (
        !Number.isInteger(additionalRuns) ||
        additionalRuns < 1
      ) {
        alert("Enter a valid run number");
        return;
      }
    }

    const next: Match = {
      ...match,
      history: [...match.history]
    };

    if (type === "WD") {
      next.runs += 1 + additionalRuns;
      next.history.push(
        additionalRuns ? `WD + ${additionalRuns}` : "WD"
      );
    }

    if (type === "NB") {
      next.runs += 1 + additionalRuns;
      next.history.push(
        additionalRuns ? `NB + ${additionalRuns}` : "NB"
      );

      if (additionalRuns % 2 === 1) {
        [next.striker, next.nonStriker] = [
          next.nonStriker,
          next.striker
        ];
      }
    }

    if (type === "B" || type === "LB") {
      next.runs += additionalRuns;
      next.history.push(`${type} ${additionalRuns}`);

      if (additionalRuns % 2 === 1) {
        [next.striker, next.nonStriker] = [
          next.nonStriker,
          next.striker
        ];
      }

      afterLegalBall(next);
    }

    await saveMatch(next);
  };

  const wicket = async () => {
    if (!match || match.status !== "LIVE") return;

    if (match.wickets >= 10) {
      alert("All wickets are down");
      return;
    }

    const answer = prompt(
      "Which batter got out?\n1. Striker\n2. Non-striker",
      "1"
    );

    if (answer !== "1" && answer !== "2") return;

    const dismissed =
      answer === "1" ? match.striker : match.nonStriker;

    const nextBatter = chooseFromList(
      "Select next batter:",
      battingSquad(match),
      [
        match.striker,
        match.nonStriker,
        dismissed
      ]
    );

    if (!nextBatter) return;

    const next: Match = {
      ...match,
      history: [...match.history],
      wickets: match.wickets + 1
    };

    if (answer === "1") {
      next.striker = nextBatter;
    } else {
      next.nonStriker = nextBatter;
    }

    next.history.push(`WICKET: ${dismissed}`);

    afterLegalBall(next);

    await saveMatch(next);
  };

  const undo = async () => {
    if (!match || undoStack.length === 0) {
      alert("Nothing to undo");
      return;
    }

    const previous = undoStack[undoStack.length - 1];

    setUndoStack(old => old.slice(0, -1));
    setMatch(previous);

    try {
      await updateDoc(doc(db, "matches", previous.id), {
        runs: previous.runs,
        wickets: previous.wickets,
        balls: previous.balls,
        striker: previous.striker,
        nonStriker: previous.nonStriker,
        bowler: previous.bowler,
        history: previous.history,
        status: previous.status,
        innings: previous.innings,
        batting: previous.batting,
        bowling: previous.bowling,
        target: previous.target
      });
    } catch (error) {
      alert("Undo could not be saved");
      console.error(error);
    }
  };

  const changeStrike = async () => {
    if (!match || match.status !== "LIVE") return;

    await saveMatch({
      ...match,
      striker: match.nonStriker,
      nonStriker: match.striker
    });
  };

  const changeBowler = async () => {
    if (!match || match.status !== "LIVE") return;

    const nextBowler = chooseFromList(
      "Select bowler:",
      bowlingSquad(match),
      [match.bowler]
    );

    if (!nextBowler) return;

    await saveMatch({
      ...match,
      bowler: nextBowler
    });
  };

  const endInnings = async () => {
    if (!match || match.status !== "LIVE") return;

    if (match.innings === 1) {
      const nextBatting = match.bowling;
      const nextBowling = match.batting;

      const battingPlayers =
        nextBatting === match.teamA
          ? match.squadA
          : match.squadB;

      const bowlingPlayers =
        nextBowling === match.teamA
          ? match.squadA
          : match.squadB;

      const newStriker = chooseFromList(
        "Second innings: Select opening striker",
        battingPlayers
      );

      if (!newStriker) return;

      const newNonStriker = chooseFromList(
        "Select non-striker",
        battingPlayers,
        [newStriker]
      );

      if (!newNonStriker) return;

      const newBowler = chooseFromList(
        "Select opening bowler",
        bowlingPlayers
      );

      if (!newBowler) return;

      const next: Match = {
        ...match,
        innings: 2,
        target: match.runs + 1,
        batting: nextBatting,
        bowling: nextBowling,
        runs: 0,
        wickets: 0,
        balls: 0,
        striker: newStriker,
        nonStriker: newNonStriker,
        bowler: newBowler,
        history: []
      };

      await saveMatch(next);
      alert("Second innings started!");
    } else {
      await saveMatch({
        ...match,
        status: "COMPLETED"
      });

      alert("Match completed!");
      setPage("Matches");
    }
  };

  const oversDisplay = (balls: number) =>
    `${Math.floor(balls / 6)}.${balls % 6}`;

  const selectedTeamPlayers = (side: "A" | "B") => {
    const ids = side === "A" ? squadA : squadB;
    return ids
      .map(id => players.find(p => p.id === id))
      .filter((p): p is Player => Boolean(p));
  };

  const currentBattingSquad = match
    ? battingSquad(match)
    : [];

  const currentBowlingSquad = match
    ? bowlingSquad(match)
    : [];

  return (
    <div className="app">
      <header>
        <div className="crest">🏏</div>
        <h1>BANJARA SPORTS CLUB</h1>
        <p>PLAY • COMPETE • WIN</p>
      </header>

      <nav>
        {[
          "Home",
          "Teams",
          "Players",
          "New Match",
          "Matches",
          "Admin"
        ].map(item => (
          <button key={item} onClick={() => setPage(item)}>
            {item}
          </button>
        ))}
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

            {matches.filter(m => m.status === "LIVE").map(m => (
              <div key={m.id} className="card">
                <b>{m.teamA} vs {m.teamB}</b>
                <h2>{m.runs}/{m.wickets}</h2>
                <p>{oversDisplay(m.balls)} Overs</p>
                <button onClick={() => {
                  setMatch(m);
                  setUndoStack([]);
                  setPage("Live Score");
                }}>
                  View Score
                </button>
              </div>
            ))}
          </section>
        )}

        {page === "Teams" && (
          <section className="card">
            <h2>Team Registration</h2>
            <input
              placeholder="Team name"
              value={teamName}
              onChange={e => setTeamName(e.target.value)}
            />
            <button onClick={createTeam}>Register Team</button>

            <h3>Registered Teams</h3>
            {teams.map(t => (
              <p key={t.id}>🏏 {t.name}</p>
            ))}
          </section>
        )}

        {page === "Players" && (
          <section className="card">
            <h2>Player Registration</h2>

            <input
              placeholder="Player name"
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
            />

            <select
              value={playerTeam}
              onChange={e => setPlayerTeam(e.target.value)}
            >
              <option value="">Select Team</option>
              {teams.map(t => (
                <option key={t.id} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>

            <button onClick={createPlayer}>
              Register Player
            </button>

            <h3>Player List</h3>
            {players.map(p => (
              <p key={p.id}>{p.name} — {p.team}</p>
            ))}
          </section>
        )}

        {page === "New Match" && (
          <section className="card">
            <h2>New Match Setup</h2>

            <label>Team A</label>
            <select
              value={teamA}
              onChange={e => {
                setTeamA(e.target.value);
                setSquadA([]);
                setStriker("");
                setNonStriker("");
              }}
            >
              <option value="">Select Team</option>
              {teams.map(t => (
                <option key={t.id} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>

            <label>Team B</label>
            <select
              value={teamB}
              onChange={e => {
                setTeamB(e.target.value);
                setSquadB([]);
                setBowler("");
              }}
            >
              <option value="">Select Team</option>
              {teams.map(t => (
                <option key={t.id} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>

            <label>Format</label>
            <select
              value={format}
              onChange={e => setFormat(e.target.value)}
            >
              {["T5", "T10", "T20", "ODI", "Test", "Custom"].map(f => (
                <option key={f}>{f}</option>
              ))}
            </select>

            <label>Overs</label>
            <input
              type="number"
              min="1"
              value={overs}
              onChange={e => setOvers(Number(e.target.value))}
            />

            <label>Venue</label>
            <input
              placeholder="Match venue"
              value={venue}
              onChange
