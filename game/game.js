// -1 dead cell
// 0 free cell
// 1 food cell
// 7 eater cell
// -3 eater just ate

const ACTION = {
	"UP" : [0,-1],
	"DOWN" : [0,1],
	"LEFT" : [-1, 0],
	"RIGHT" : [1,0]
}

export class Game {
	constructor() {
		this.gridRatio = 32;
		this.width = 15;
		this.height = 10;
		this.visibility = 1;
		this.startingFood = 5;
		this.eaterColor = "#000000";
		this.foodColor = "#008000";
		this.poopColor = "#ff0000";
		this.backgroundColor = "#ffffff";

		this.reset();
	}

	flatten(coordinates) {
		return coordinates[1]*this.width+coordinates[0];
	}

	popUp(index) {
		return [(index%this.width)*this.gridRatio, Math.floor(index/this.width)*this.gridRatio];
	}

	getColorOfValue(cellValue) {
		switch (cellValue) {
			case -1: return this.poopColor;

		    case 0: return this.backgroundColor;

		    case 1: return this.foodColor;

		    case -3: return this.eaterColor;
		   
		    case 7: return this.eaterColor;
		   
		    default: return "#123456";
		}
	}

	getState() {
		return this.state;
	}

	print() {
		let tmpStr = "";
		for (let k = 1; k < this.width*(this.height+1); k++) {
			tmpStr += `${this.state[k-1]} `;
			if (k%(this.width)==0) {
				console.log(`${tmpStr}\n`);
				tmpStr = "";
			}
		}
	}

	reset() {
		this.score = 0;
		this.state = Array(this.height*this.width).fill(0);

		this.eater = [0,9]

		this.state[this.flatten(this.eater)] = 7;

		for (let k = 0; k < this.startingFood; k++) 
			this.addFood();

	}

	addFood() {
		let counter = 0;
		this.state.forEach( x => {if (x == 0) counter += 1;});

		let r = Math.floor(Math.random() * counter);
		for (let k = 0; k < this.width*this.height; k++) {
			let current = this.state[k]
			if (current == 0) {
				if  (r == 0) {
					this.state[k] = 1;
					break;
				} else {
					r -= 1;
				}
			}
		}
	}


	step(action) {
		const addedCoord = ACTION[action];

		const oldPosition = this.flatten(this.eater);
		const hasJustEaten = this.state[oldPosition] == -3;

		this.state[oldPosition] = hasJustEaten ? -1 : 0;

		let x = (this.eater[0]+addedCoord[0])%this.width;
		let y = (this.eater[1]+addedCoord[1])%this.height;
		x = x >= 0 ? x:x+this.width;
		y = y >= 0 ? y:y+this.width;
		this.eater = [x, y];

		const newPosition = this.flatten(this.eater);
		const objectInNewPosition = this.state[newPosition];

		let reward = -1;
		let gameOver = false;

		if (objectInNewPosition == 0) {
			this.state[newPosition] = 7;
		} else if (objectInNewPosition == 1) {
			this.state[newPosition] = -3;
			this.addFood();
			reward = 20;
		} else if (objectInNewPosition == -1) {
			reward = -30;
			gameOver = true;
		}

		return {reward: reward, 
				state: this.state, 
				gameOver: gameOver}

	}



}



