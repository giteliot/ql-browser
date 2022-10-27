import {createDeepQNetwork} from './dqn.js';
// const tf = require('@tensorflow/tfjs-node')
// const tf = require('@tensorflow/tfjs-node-gpu');
import {ReplayMemory} from './memory.js';
import {copyWeights} from './dqn.js';

const NUM_ACTIONS = 4;

const config = {
    replayBufferSize: 1e4,
    epsilonInit: 0.5,
    epsilonFinal: 0.01,
    epsilonDecayFrames: 1e5,
    learningRate: 1e-3
  };

class MovingAverager {
  constructor(bufferLength) {
    this.buffer = [];
    for (let i = 0; i < bufferLength; ++i) {
      this.buffer.push(null);
    }
  }

  append(x) {
    this.buffer.shift();
    this.buffer.push(x);
  }

  average() {
    return this.buffer.reduce((x, prev) => x + prev) / this.buffer.length;
  }
}

export class Agent {

  constructor(game, qNet) {

    this.game = game;

    this.epsilonInit = config.epsilonInit;
    this.epsilonFinal = config.epsilonFinal;
    this.epsilonDecayFrames = config.epsilonDecayFrames;
    this.epsilonIncrement_ = (this.epsilonFinal - this.epsilonInit) /
        this.epsilonDecayFrames;

    if (qNet) {
      this.onlineNetwork = qNet;
      this.targetNetwork = qNet;
    } else {
      this.onlineNetwork =
        createDeepQNetwork(game.height,  game.width, NUM_ACTIONS);
      this.targetNetwork =
        createDeepQNetwork(game.height,  game.width, NUM_ACTIONS);
    }
    
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
      //console.log("action from epsilon = "+action);
    } else {
      // Greedily pick an action based on online DQN output.
      tf.tidy(() => {
        const stateTensor = this.game.getStateTensor(this.game.getState());
        action = this.game.getActionFromInt(
          this.onlineNetwork.predict(stateTensor).argMax(-1).dataSync()[0]
          );
        //console.log("action from model = "+action);
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

  train(config) {
    let summaryWriter;
    console.log("> filling memory");

    for (let i = 0; i < this.replayBufferSize; ++i) {
      this.playStep();
    }

    console.log("> memory filled");
    const rewardAverager100 = new MovingAverager(100);

    const optimizer = tf.train.adam(config.learningRate);

    let tPrev = new Date().getTime();
    let frameCountPrev = this.frameCount;
    let averageReward100Best = -Infinity;
    
    console.log("> starting training");
    while (true) {
      this.trainOnReplayBatch(config.batchSize, config.gamma, optimizer);
      const {action, cumulativeReward, gameOver} = this.playStep();

      if (gameOver) {
        
        const t = new Date().getTime();
        const framesPerSecond =
            (this.frameCount - frameCountPrev) / (t - tPrev) * 1e3;
        tPrev = t;
        frameCountPrev = this.frameCount;

        rewardAverager100.append(cumulativeReward);

        const averageReward100 = rewardAverager100.average();

        console.log(
            `Frame #${this.frameCount}: ` +
            `cumulativeReward100=${averageReward100.toFixed(1)}; ` +
            `(epsilon=${this.epsilon.toFixed(3)}) ` +
            `(${framesPerSecond.toFixed(1)} frames/s)`);

        if (summaryWriter != null) {
          summaryWriter.scalar(
              'cumulativeReward100', averageReward100, this.frameCount);
          summaryWriter.scalar('epsilon', this.epsilon, this.frameCount);
          summaryWriter.scalar(
              'framesPerSecond', framesPerSecond, this.frameCount);
        }

        if (averageReward100 >= config.cumulativeRewardThreshold ||
            this.frameCount >= config.maxNumFrames) {
          console.log("finished training!!");
          copyWeights(this.targetNetwork, this.onlineNetwork);
          break;
        }
      }
      if (this.frameCount % config.syncEveryFrames === 0) {
        copyWeights(this.targetNetwork, this.onlineNetwork);
        console.log('Sync\'ed weights from online network to target network');
      }

    }
  }
}