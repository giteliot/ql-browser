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

function initBotGame() {
	game = new Game();
	game.reset();
	score = 0;
	playEnabled = false;
	
	renderGame(game, canvas);

	startBotBtn.innerText = "RESET";
	startBotBtn.addEventListener('click', async () => {
		initBotGame();
	});

	let gameOver = false;

	while (!gameOver) {
		
	}

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

function step(result) {
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
            step(game.step("LEFT"));
            break;
        case 38:
            step(game.step("UP"));
            break;
        case 39:
            step(game.step("RIGHT"));
            break;
        case 40:
            step(game.step("DOWN"));
            break;
    }
};

startSoloBtn.addEventListener('click', async () => {
	initSoloGame();
});

startBotBtn.addEventListener('click', async () => {
	initBotGame();
});


