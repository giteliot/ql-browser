import {Game} from './game.js'

const canvas = document.getElementById('main-canvas')
const startSoloBtn = document.getElementById('solo')
const startBotBtn = document.getElementById('bot')
const scoreTexr = document.getElementById('score')

let playEnabled = false;

function initGame(isSolo) {
	const game = new Game();
	game.reset();
	playEnabled = isSolo;
	
	renderGame(game, canvas);

	startSoloBtn.innerText = "RESET"
	startSoloBtn.addEventListener('click', async () => {
		initSoloGame(true);
	})
}

function renderGame(game, canvas) {
	const ctx = canvas.getContext("2d");

	for (let [value, index] of game.getState().entries()) { 
	  let tile = game.popUp(index);
	  let color = game.getColorOfValue(value);

	  ctx.fillStyle = color;
	  ctx.fillRect(tile[0], tile[1], game.gridRatio, game.gridRatio);
	}
	
}

startSoloBtn.addEventListener('click', async () => {
	initGame(true);
})

/*function manualMove() {

}


function renderEater(eater, canvas) {
	const ctx = canvas.getContext("2d")
	ctx.fillStyle = "#000000"
	ctx.fillRect(eater.x*GRID_RATIO, eater.y*GRID_RATIO, GRID_RATIO, GRID_RATIO);

	ctx.fillStyle = "#808080"
	ctx.fillRect(0, 0, canvas.width, (eater.y-1)*GRID_RATIO)
	ctx.fillRect(0, (eater.y+2)*GRID_RATIO, canvas.width, canvas.height-(eater.y+2)*GRID_RATIO)
	ctx.fillRect(0, 0, (eater.x-1)*GRID_RATIO, canvas.height)
	ctx.fillRect((eater.x+2)*GRID_RATIO, 0, canvas.width-(eater.x+2)*GRID_RATIO, canvas.height)
	
}

function renderFood(food, canvas) {
	const ctx = canvas.getContext("2d")
	ctx.fillStyle = "#FF0000"
	ctx.fillRect(food.x*GRID_RATIO, food.y*GRID_RATIO, GRID_RATIO, GRID_RATIO)
}

var loopName = undefined
var eater = undefined
var food = undefined

startBtn.addEventListener('click', async () => {
	let text = startBtn.textContent || startBtn.innerText
	if (text == "START") {
		console.log(loopName)
		if (!loopName) {
			eater = new Eater()
			food = new Food()
			renderEater(eater, canvas)
			renderFood(food, canvas)

		} 

		function lifeCycle() {
			eater.move()
			if (eater.x == food.x && eater.y == food.y) {
				eater.score += 1
				food = new Food()
			}

			const ctx = canvas.getContext("2d")
			ctx.clearRect(0,0, canvas.width, canvas.height)
			
			renderFood(food, canvas)
			renderEater(eater, canvas)
			score.innerText = `LIFE BEGINS - SCORE: ${eater.score}`
			
		}

		loopName = setInterval(lifeCycle, 300)

		startBtn.innerText = "STOP"
	} else if (text == "STOP") {
		console.log(loopName)
		clearInterval(loopName)
		startBtn.innerText = "START"
	}
  })



reset.addEventListener('click', async () => {
	const ctx = canvas.getContext("2d")
	ctx.clearRect(0,0, 480, 320)
	clearInterval(loopName)
	loopName = undefined
	eater = undefined
	food = undefined
	startBtn.innerText = "START"
	score.innerText = `LIFE BEGINS`

  })*/

