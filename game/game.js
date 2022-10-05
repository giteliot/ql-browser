// -1 dead cell
// 1 food cell
// 7 eater cell

export class Game {
	constructor() {
		this.gridRatio = 32;
		this.width = 15;
		this.height = 10;
		this.visibility = 1;
		this.startingFood = 5;

		this.reset();
	}

	reset() {
		this.score = 0;
		this.state = Array(this.height*this.width).fill(0);
		this.state[(this.height-1)*this.width] = 7;
		for (let k = 0; k < this.startingFood; k++) 
			this.addFood();
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

	addFood() {
		let counter = 0;
		this.state.forEach( x => {if (x == 0) counter += 1;})

		// get a random number R between 0 and counter
		// put the food (1) at the Rth free cell
	}
}