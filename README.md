# The Paper Castle

A thirteen-game asymmetric party tournament. One shared 16:9 main screen, up to six
players on their phones, joined by a four-letter room code. Everything on screen is
drawn in code — vintage paper, watercolor washes, loose ink lines and a cast of
Stickmen in mid-century hats. There are no image assets.

## Run it

```bash
npm install
```

```bash
npm start
```

- Main screen: open `http://localhost:3000/host` on the TV/laptop (press `f` for fullscreen).
- Players: open the address shown on the main screen's ticket (`http://<your-LAN-IP>:3000`)
  on a phone on the same network, type the room code and a name.
- The first player in is the Master of Ceremonies (★) and picks games from their phone.
  Clicking a ticket on the main screen works too. `Esc` on the main screen abandons a game.

Set `PORT` to change the port. Bridge Ball's tilt control needs a secure origin on most
phones (browsers only expose the gyroscope over HTTPS), so serve it through an HTTPS
tunnel or reverse proxy if you want real tilting; over plain HTTP the drag bar is used instead.

## Project structure

```
server/
  index.js          rooms, join/reconnect, VIP, scoring, 30 Hz authoritative loop
  games/
    index.js        menu order
    util.js
    honeycomb.js    1  Honeycomb Maze     runner vs monsters, hidden information
    stones.js       2  Skipping Stones    secret setup, bluffing
    bridge.js       3  Bridge Ball        gyro balance vs cannon fire
    knock.js        4  Knock Knock        secret setup, blind charge
    avalanche.js    5  Avalanche          run / hide vs boulder timing
    rollers.js      6  High Rollers       spinning drums the others re-spin
    dragon.js       7  Dragon Lake        pendulum physics vs wind gusts
    mushroom.js     8  Mushroom Trip      one-press release timing (everyone rides)
    hands.js        9  Show of Hands      first correct card wins the round
    showdown.js     10 Final Showdown     bumper carts, water, paper rings
    tug.js          11 Tug of War         two teams, rapid tapping
    sumo.js         12 Sumo Rings         one-on-one tapping bouts
    skittles.js     13 Skittles           one bowler vs tilting human pins
public/
  host.html         main screen (canvas, 1600x900 logical, letterboxed to 16:9)
  play.html/.css    phone controller
  js/art.js         paper texture, washes, ink, the Stickman (emotions, 4 directions, poses)
  js/scenes.js      one main-screen renderer per game
  js/sfx.js         SoundManager: recordings from public/sounds/ with synthesised fallbacks, music, room tone
  sounds/           optional MP3s that replace the synthesised sounds (see sounds/README.md)
  js/host.js        lobby, title cards, HUD, results
  js/play.js        join flow and one control surface per game
```

## How a game plugs in

Each file in `server/games/` exports:

| member | purpose |
| --- | --- |
| `id, name, kind, blurb, runnerTip, othersTip` | menu and title-card text; `kind` is `runner` (1 vs all) or `all` |
| `create(G)` | build state. `G = { players, ids, runnerId, others }` |
| `input(s, playerId, msg, G)` | validate and apply one phone input |
| `tick(s, dt, G)` | advance the simulation; set `s.over` to end the game |
| `view(s, G)` | what the main screen may see |
| `pview(s, playerId, G)` | what that one phone may see (this is where secrets are kept) |

The client side is a matching entry in `Scenes` (scenes.js) and `UI` (play.js).
Phones only ever send intent (`socket.emit('in', …)`); all outcomes are decided on the server.

## A round, step by step

1. **Lobby.** The Master of Ceremonies (first player in, ★) sets an optional score limit
   (10/20/30/50), turns team mode on or off and names the two teams, then picks a game.
2. **Choose your side.** The main screen splits right/left. In 1-vs-all games players pick
   runner or attackers (several volunteers draw lots; no volunteer falls back to rotation).
   In Tug of War they pick a team. The host can raise or lower the stage here.
3. **Title card, play, result.** After the result the host chooses *replay* (same game, next
   stage) or *home*.

Every game has six stages (`G.level`, 1–6); each module reads it in `create()` to add
obstacles: fewer doors and more guards, faster boulders, barrels in the arena, and so on.
A game's stage goes up by one each time it is finished.

Seats survive a closed browser: the phone keeps a device id and room token, and a seat left
empty can also be reclaimed by joining with the same name. Empty seats are kept for 30 minutes.

## Scoring

Runner games: the Runner earns 3 for succeeding, otherwise every opponent earns 1.
The Runner role rotates each game. Mushroom Trip pays 2 per safe landing, Show of Hands
1 per card won, and the last ring standing in Final Showdown earns 5 and is crowned champion.

Games are playable with any number from 1 to 6; when there are too few opponents the
castle guard (simple bots) fills in.
