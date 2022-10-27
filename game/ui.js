import {Game} from './game.js'
import {Agent} from './agent.js'
import {sleep} from './utils.js'

const canvas = document.getElementById('main-canvas')
const startSoloBtn = document.getElementById('solo')
const startTrainBtn = document.getElementById('train')
const startBotBtn = document.getElementById('bot')
const scoreText = document.getElementById('score')

let playEnabled = false;
let game = undefined;
let agent = undefined;
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
	if (!game) {
		game = new Game();
		game.reset();
		score = 0;
	}
	
	playEnabled = false;
	
	renderGame(game, canvas);

	startBotBtn.innerText = "RESET";

	console.log("set up pre model");

	let gameOver = false;

	// const qNet = await tf.loadLayersModel('./models/dqn/model.json');

	if (!agent)
		agent = new Agent(game);

	console.log("model created");

	let k = 0;
	let stepResult = {};
	stepResult.gameOver = false;

	while(!stepResult.gameOver) {
		k++;
		console.log("stepping "+k);
		stepResult = await agent.playStep();
		scoreAndRender(stepResult);
		await sleep(300);
	}
}

async function initTrain() {
	const trainConfig = {
	    batchSize: 64, 
	    gamma: 0.99,
	    learningRate: 1e-1,
	    cumulativeRewardThreshold: 100, 
	    maxNumFrames: 1e3,
	    syncEveryFrames: 1000, 
	    savePath: './game/models/dqn', 
	    logDir: null
	  };

	if (!game)
		game = new Game();
	if (!agent)
		agent = new Agent(game);

	agent.train(trainConfig);
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
	if (result.gameOver) {
		destroyGame();
		return;
	}
	if (result.reward)
		score += result.reward;
	if (result.cumulativeReward)
		score = result.cumulativeReward;
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

startTrainBtn.addEventListener('click', async () => {
	initTrain();
});
