import {createDeepQNetwork} from './dqn.js';
//import * as tf from '@tensorflow/tfjs';
const tf = require('@tensorflow/tfjs-node-gpu');
import {ReplayMemory} from './memory.js';

const NUM_ACTIONS = 4;

export class Agent {

  constructor(game, config) {

    this.game = game;

    this.epsilonInit = config.epsilonInit;
    this.epsilonFinal = config.epsilonFinal;
    this.epsilonDecayFrames = config.epsilonDecayFrames;
    this.epsilonIncrement_ = (this.epsilonFinal - this.epsilonInit) /
        this.epsilonDecayFrames;

    this.onlineNetwork =
        createDeepQNetwork(game.height,  game.width, NUM_ACTIONS);
    this.targetNetwork =
        createDeepQNetwork(game.height,  game.width, NUM_ACTIONS);
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
        const stateTensor = this.game.getStateTensor(this.game.getState());
        // what's this all_actions?
        //action = ALL_ACTIONS[
        //    this.onlineNetwork.predict(stateTensor).argMax(-1).dataSync()[0]];
        action = this.game.getActionFromInt(
          this.onlineNetwork.predict(stateTensor).argMax(-1).dataSync()[0]
          );
      });
    }
    const stepResult = this.game.step(action);

    this.replayMemory.append([state, action, stepResult.reward, stepResult.gameOver, stepResult.nextState]);

    const output = {
      action: action,
      cumulativeReward: this.game.score,
      gameOver: stepResult.gameOver
    };
    if (output.gameOver) {
      console.log("game over with "+this.game.score)
      this.reset();
    }
    return output;
  
  }

  trainOnReplayBatch(batchSize, gamma, optimizer) {
    
    // Get a batch of examples from the replay buffer.
    const batch = this.replayMemory.sample(batchSize);
    const lossFunction = () => tf.tidy(() => {
      const stateTensor = this.game.getStateTensor(
          batch.map(example => example[0])
          );
      const actionTensor = tf.tensor1d(
          batch.map(example => example[1]), 'int32');

      const qs = this.onlineNetwork.apply(stateTensor, {training: true})
          .mul(tf.oneHot(actionTensor, NUM_ACTIONS)).sum(-1);

      const rewardTensor = tf.tensor1d(batch.map(example => example[2]));

      const nextStateTensor = this.game.getStateTensor(
          batch.map(example => example[4])
          );

      const nextMaxQTensor =
          this.targetNetwork.predict(nextStateTensor).max(-1);
      const doneMask = tf.scalar(1).sub(
          tf.tensor1d(batch.map(example => example[3])).asType('float32'));
      const targetQs =
          rewardTensor.add(nextMaxQTensor.mul(doneMask).mul(gamma));
      return tf.losses.meanSquaredError(targetQs, qs);
    });

    // Calculate the gradients of the loss function with repsect to the weights
    // of the online DQN.
    const grads = tf.variableGrads(lossFunction);
    // Use the gradients to update the online DQN's weights.
    optimizer.applyGradients(grads.grads);
    tf.dispose(grads);
    // TODO(cais): Return the loss value here?
    
  }

}