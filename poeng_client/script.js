const debug = (msg) => {};//console.log(msg);

const points = document.getElementById("points");
const playArea = document.getElementById("play-area");
const leftPlayer = document.getElementById("left-player");
const rightPlayer = document.getElementById("right-player");
const ball = document.getElementById("ball");

const server = "ws://localhost:4321";
let ws;
let refreshInterval;

const data = {
	playerId: "",
	me: null,
	opponent: null,
	config: {
		width: 0,
		height: 0,
		padHeight: 0
	},
	leftPlayer: {
		points: 0,
		y: 0
	},
	rightPlayer: {
		points: 0,
		y: 0
	},
	ball: {
		x: 0,
		y: 0,
		vx: 0,
		vy: 0
	}
}

const init = () => {
	ws = new WebSocket(server);
	ws.onmessage = (msg) => handleResponse(msg.data);
	ws.onopen = () => ws.send("register");
	window.onbeforeunload = () => sendMessage("exit");
	window.addEventListener('keydown', handleKeyPress);
}

const handleKeyPress = (event) => {
	switch (event.key) {
		case "j":
    case "ArrowDown":
			data.me.y += 1;
			data.me.y = Math.min(data.me.y, data.config.height - data.config.padHeight / 2);
			sendMessage(`move ${data.me.y}`)
			break;
		case "k":
    case "ArrowUp":
			data.me.y -= 1;
			data.me.y = Math.max(data.me.y, data.config.padHeight / 2);
			sendMessage(`move ${data.me.y}`)
			break;
	}
}

const handleResponse = (response) => {
	debug(response);
	const parts = response.split(" ")
	const command = parts[0];

	if (command == "err" || parts[1] == "err") {
		debug("error in response");
		endGame();
		return;
	}

	switch (command) {
		case "register":
			data.playerId = parts[1];
			sendMessage("play");
			break;
		case "play":
			if (parts[1] == "ok") startGame();
			else setTimeout(() => sendMessage("play"), 250);
			break;
		case "config":
			data.config.width = +parts[1];
			data.config.height = +parts[2];
			data.config.padHeight = +parts[3];
			data.leftPlayer.y = parts[2] / 2;
			data.rightPlayer.y = parts[2] / 2;
			break;
		case "side":
			if (parts[1] == "left") {
				data.me = data.leftPlayer;
				data.opponent = data.rightPlayer;
			} else {
				data.me = data.rightPlayer;
				data.opponent = data.leftPlayer;
			}
			break;
		case "opponent":
			data.opponent.y = +parts[1];
			break;
		case "points":
			data.leftPlayer.points = +parts[1];
			data.rightPlayer.points = +parts[2];
			break;
		case "ball":
			data.ball.x = +parts[1];
			data.ball.y = +parts[2];
			data.ball.vx = +parts[3];
			data.ball.vy = +parts[4];
			break;
		case "move":
			break;
		case "exit":
			debug("game closed");
			break;
		default:
			debug("could not parse response");
	}
}

const startGame = () => {
	playArea.style.display = "initial";

	sendMessage("config");
	sendMessage("side");

	refreshInterval = setInterval(() => {
		sendMessage("points");
		sendMessage("opponent");
		sendMessage("ball");
	}, 60);

	requestAnimationFrame(draw);
}

const endGame = () => {
	clearInterval(refreshInterval);
}

const sendMessage = (msg) => {
	ws.send(`${data.playerId} ${msg}`);
}

const draw = () => {
	points.innerText = `${data.leftPlayer.points} : ${data.rightPlayer.points}`;

	playArea.style.width = `${data.config.width}em`;
	playArea.style.height = `${data.config.height}em`;

	leftPlayer.style.height = `${data.config.padHeight}em`;
	leftPlayer.style.marginTop = `-${data.config.padHeight / 2}em`;
	leftPlayer.style.left = `${data.leftPlayer.x}em`;
	leftPlayer.style.top = `${data.leftPlayer.y}em`;

	rightPlayer.style.height = `${data.config.padHeight}em`;
	rightPlayer.style.marginTop = `-${data.config.padHeight / 2}em`;
	rightPlayer.style.left = `${data.rightPlayer.x}em`;
	rightPlayer.style.top = `${data.rightPlayer.y}em`;

	ball.style.left = `${data.ball.x}em`;
	ball.style.top = `${data.ball.y}em`;
	requestAnimationFrame(draw);
}

debug("debug mode active");
init();
