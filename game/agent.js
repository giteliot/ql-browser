import {createDeepQNetwork} from './dqn.js';
import * as tf from '@tensorflow/tfjs';

export class Agent {
    constructor(game, config) {
    assertPositiveInteger(config.epsilonDecayFrames);

    this.game = game;

    this.epsilonInit = config.epsilonInit;
    this.epsilonFinal = config.epsilonFinal;
    this.epsilonDecayFrames = config.epsilonDecayFrames;
    this.epsilonIncrement_ = (this.epsilonFinal - this.epsilonInit) /
        this.epsilonDecayFrames;

    this.onlineNetwork =
        createDeepQNetwork(game.height,  game.width, 4);
    this.targetNetwork =
        createDeepQNetwork(game.height,  game.width, 4);
    // Freeze taget network: it's weights are updated only through copying from
    // the online network.
    this.targetNetwork.trainable = false;

    this.optimizer = tf.train.adam(config.learningRate);

    this.replayBufferSize = config.replayBufferSize;
    this.replayMemory = new ReplayMemory(config.replayBufferSize);
    this.frameCount = 0;
    this.reset();
  }

  reset() {
    this.game.reset();
  }

  playStep() {
    this.epsilon = this.frameCount >= this.epsilonDecayFrames ?
        this.epsilonFinal :
        this.epsilonInit + this.epsilonIncrement_  * this.frameCount;
    this.frameCount++;

    // The epsilon-greedy algorithm.
    let action;
    const state = this.game.getState();
    if (Math.random() < this.epsilon) {
      // Pick an action at random.
      action = this.game.getRandomAction();
    } else {
      // Greedily pick an action based on online DQN output.
      tf.tidy(() => {
        const stateTensor = game.getStateTensor()
        // what's this all_actions?
        //action = ALL_ACTIONS[
        //    this.onlineNetwork.predict(stateTensor).argMax(-1).dataSync()[0]];
        action = his.onlineNetwork.predict(stateTensor).argMax(-1).dataSync()[0];
      });
    }

    const {reward: reward, nextState: state, gameOver: gameOver} = this.game.step(action);

    this.replayMemory.append([state, action, reward, gameOver, nextState]);

    const output = {
      action,
      cumulativeReward: this.game.score,
      gameOver
    };
    if (gameOver) {
      this.reset();
    }
    return output;
  }
}