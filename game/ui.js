import {Game} from './game.js'

const canvas = document.getElementById('main-canvas')
const startSoloBtn = document.getElementById('solo')
const startBotBtn = document.getElementById('bot')
const scoreText = document.getElementById('score')

let playEnabled = false;
let game = undefined;
let score = 0;

function initSoloGame() {
	game = new Game();
	game.reset();
	score = 0;
	playEnabled = true;
	
	renderGame(game, canvas);

	startSoloBtn.innerText = "RESET";
	startSoloBtn.addEventListener('click', async () => {
		initSoloGame();
	});
}

async function initBotGame() {
	game = new Game();
	game.reset();
	score = 0;
	playEnabled = false;
	
	renderGame(game, canvas);

	startBotBtn.innerText = "RESET";
	startBotBtn.addEventListener('click', async () => {
		initBotGame();
	});

	console.log("set up pre model");

	let gameOver = false;

	const qNet = await tf.loadLayersModel('./models/dqn/model.json');

	console.log("model created");

	let intervalId = setInterval(async () => {
		console.log("init step");
		let stateTensor = game.getStateTensor(game.getState());
		let actionInt = await qNet.predict(stateTensor).argMax(-1).dataSync()[0];
		let action = game.getActionFromInt(actionInt);
		console.log("action = "+action);
		let stepResult = game.step(action);
		scoreAndRender(stepResult);
		if (stepResult.gameOver) {
			clearInterval(intervalId);
		}
		// await qNet.predict(game.getStateTensor(game.getState()));
	}, 300)

}

function renderGame(game, canvas) {
	const ctx = canvas.getContext("2d");

	for (let [index, value] of game.getState().entries()) { 
	  let tile = game.popUp(index);
	  let color = game.getColorOfValue(value);

	  ctx.fillStyle = color;
	  ctx.fillRect(tile[0], tile[1], game.gridRatio, game.gridRatio);
	}
	
}

function destroyGame() {
	game = new Game();
	game.reset();
	score = 0;
	playEnabled = false;
	
	renderGame(game, canvas);
}

function scoreAndRender(result) {
	console.log(game.eater);

	if (result.gameOver) {
		destroyGame();
		return;
	}
	score += result.reward;
	scoreText.innerText = score;

	// console.log(result);
	renderGame(game, canvas);
}

document.onkeydown = function(e) {
	if (game == undefined)
		return;
    switch (e.keyCode) {
        case 37:
            scoreAndRender(game.step("LEFT"));
            break;
        case 38:
            scoreAndRender(game.step("UP"));
            break;
        case 39:
            scoreAndRender(game.step("RIGHT"));
            break;
        case 40:
            scoreAndRender(game.step("DOWN"));
            break;
    }
};

startSoloBtn.addEventListener('click', async () => {
	initSoloGame();
});

startBotBtn.addEventListener('click', async () => {
	initBotGame();
});


