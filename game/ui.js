import {Game} from './game.js'
import {Agent, loadModel, trainConfig} from './agent.js'
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

	scoreText.innerText = score;
	
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
	} else {
		game.reset();
	}
	
	playEnabled = false;
	
	renderGame(game, canvas);

	startBotBtn.innerText = "RESET";

	console.log("set up pre model");

	let gameOver = false;

	// const qNet = await tf.loadLayersModel('./models/dqn/model.json');

	console.log("agent not defined, creating a new one");
	try {
		const qNet = await loadModel();
		if (qNet) console.log("LOADED QNET FROM STORAGE");
		agent = new Agent(game, qNet); //pass qNet to load from memory
	} catch (err) {
		console.log("EEERR")
		console.log(err)
		if (!agent)
			agent = new Agent(game);
	}
	

	agent.game = game;
	agent.actions = [];

	console.log("model created");

	let k = 0;
	let stepResult = {};
	stepResult.gameOver = false;

	while(!stepResult.gameOver) {
		k++;
		console.log("stepping "+k);
		stepResult = await agent.playStep();
		scoreAndRender(stepResult);
		await sleep(600);
	}
}

async function initTrain() {
	scoreText.innerText = "TRAINING IN PROGRESS: LOADING MEMORY";

	if (!game)
		game = new Game();
	if (!agent) {
		agent = new Agent(game);
		console.log("created new MODEL");
	}
	let trainLoop = undefined;
	const maxFrames = trainConfig.maxNumFrames - agent.replayBufferSize;
	let progressLoop = setInterval(() => {

		scoreText.innerText = "TRAINING IN PROGRESS: "+((agent.frameCount-agent.replayBufferSize)*100.0/maxFrames).toFixed(2)+"%";
		if (maxFrames <= agent.frameCount) {
			scoreText.innerText = "TRAINING COMPLETED!"
			agent.saveModel();
			clearInterval(progressLoop);
			clearInterval(trainLoop);
		}
	},
		1000);

	
	setTimeout(() => {trainLoop = agent.train(scoreText)}, 10);
	
}

function renderGame(game, canvas) {
	console.log(game.getState())
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
	if (result.reward)
		score += result.reward;
	if (result.cumulativeReward)
		score = result.cumulativeReward;
	scoreText.innerText = score;

	renderGame(game, canvas);

	if (result.gameOver) {
		scoreText.innerText = "GAME OVER! FINAL SCORE: "+score;
		console.log("game over! ")
		playEnabled = false;
		return;
	}

	// console.log(result);
}

document.onkeydown = function(e) {
	if (game == undefined || !playEnabled)
		return;
    switch (e.keyCode) {
        case 37:
            scoreAndRender(game.step(2));
            break;
        case 38:
            scoreAndRender(game.step(0));
            break;
        case 39:
            scoreAndRender(game.step(3));
            break;
        case 40:
            scoreAndRender(game.step(1));
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
