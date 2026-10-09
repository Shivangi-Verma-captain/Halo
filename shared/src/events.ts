// Socket.IO event names — shared so client/server can't drift.
export const Events = {
  // client -> server
  Join: "join",
  Move: "move",
  SetReady: "set-ready",
  StartRound: "start-round",
  CollectClue: "collect-clue",
  CompleteTask: "complete-task",
  SendMessage: "chat",
  Vote: "vote",
  PlayAgain: "play-again",
  BackToLobby: "back-to-lobby",
  // server -> client
  Joined: "joined",
  State: "state",
  Players: "players",
  Phase: "phase",
  ClueFound: "clue-found",
  TaskDone: "task-done",
  Chat: "chat",
  Votes: "votes",
  Result: "result",
  Error: "game-error",
} as const;

export type ClientToServerEvent =
  | typeof Events.Join
  | typeof Events.Move
  | typeof Events.SetReady
  | typeof Events.StartRound
  | typeof Events.CollectClue
  | typeof Events.CompleteTask
  | typeof Events.SendMessage
  | typeof Events.Vote
  | typeof Events.PlayAgain
  | typeof Events.BackToLobby;
