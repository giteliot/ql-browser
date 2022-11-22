import {createDeepQNetwork} from './dqn.js';
// const tf = require('@tensorflow/tfjs-node')
// const tf = require('@tensorflow/tfjs-node-gpu');
import {ReplayMemory} from './memory.js';
import {copyWeights} from './dqn.js';

const NUM_ACTIONS = 4;

const config = {
    replayBufferSize: 1e4,
    epsilonInit: 0.5,
    epsilonFinal: 0,
    epsilonDecayFrames: 8e4
  };

export const trainConfig = {
    batchSize: 64, 
    gamma: 0.99,
    learningRate: 1e-4,
    cumulativeRewardThreshold: 200, 
    maxNumFrames: 10e4,
    syncEveryFrames: 1e4, 
    savePath: 'localstorage://qliaModel', 
    logDir: null
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

export async function loadModel() {
  return await tf.loadLayersModel(trainConfig.savePath);
}

export class Agent {

  constructor(game, qNet) {

    this.game = game;

    this.epsilonInit = config.epsilonInit;
    this.epsilonFinal = config.epsilonFinal;
    this.epsilonDecayFrames = config.epsilonDecayFrames;
    this.epsilonIncrement_ = (this.epsilonFinal - this.epsilonInit) /
        this.epsilonDecayFrames;
    this.frameCount = 0;


    if (qNet) {
      console.log("started from qnet")
      this.onlineNetwork = qNet;
      this.targetNetwork = qNet;
      this.frameCount = this.epsilonDecayFrames;
    } else {
      this.onlineNetwork = 
        createDeepQNetwork(game.height,  game.width, NUM_ACTIONS);
      this.targetNetwork =
        createDeepQNetwork(game.height,  game.width, NUM_ACTIONS);
    }
    
    // Freeze taget network: it's weights are updated only through copying from
    // the online network.
    this.targetNetwork.trainable = false;

    this.optimizer = tf.train.adam(trainConfig.learningRate);

    this.replayBufferSize = config.replayBufferSize;
    this.replayMemory = new ReplayMemory(config.replayBufferSize);
    this.reset();
    this.actions = [];
  }

  reset() {
    this.game.reset();
  }

  saveModel(path) {
    this.onlineNetwork.save(path);
  }

  playStep(isTraining) {
    //console.log(tf.memory ().numTensors)
    this.epsilon = this.frameCount >= this.epsilonDecayFrames ?
        this.epsilonFinal :
        this.epsilonInit + this.epsilonIncrement_  * this.frameCount;
    this.frameCount++;


    // The epsilon-greedy algorithm.
    let action;
    const state = this.game.getState().slice();
    // this.print(this.game.getState())

    if (Math.random() < this.epsilon) {
      // Pick an action at random.
      action = this.game.getRandomAction();
      // console.log("action from epsilon = "+action);
    } else {
      // Greedily pick an action based on online DQN output.
      tf.tidy(() => {
        const stateTensor = this.game.getStateTensor(this.game.getState());
        action = this.onlineNetwork.predict(stateTensor).argMax(-1).dataSync()[0]
        // console.log("action from model = "+action);
        // this.actions.push(action);
      });
    }
    
    const stepResult = this.game.step(action);
    // this.print(this.game.getState())

    this.replayMemory.append([state, action, stepResult.reward, stepResult.gameOver, stepResult.nextState]);

    const output = {
      action: action,
      cumulativeReward: this.game.score,
      gameOver: stepResult.gameOver
    };
    if (output.gameOver) {
      console.log("game over with "+this.game.score+"\n tensors = "+tf.memory().numTensors)
      if (isTraining) this.reset();
      // console.log(this.actions.join(","))
      this.actions = [];
    }
    return output;
  }

  print(state) {
    let outStr = "";
    let tmpStr = "";
    for (let k = 1; k < 15*(10+1); k++) {
      tmpStr += `${state[k-1]} `;
      if (k%(15)==0) {
        outStr+=`${tmpStr}\n`;
        tmpStr = "";
      }
    }
    console.log(outStr); 
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

      // here lies the problem, idk why tho
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

  train() {
    const startTime = Date.now();

    let summaryWriter;
    console.log("> filling memory");
    // put it back to i < this.replayBufferSize
    for (let i = 0; i < this.replayBufferSize; ++i) {
      this.playStep(true);
    }

    console.log("> memory filled");
    const rewardAverager100 = new MovingAverager(100);

    const optimizer = tf.train.adam(trainConfig.learningRate);

    let tPrev = new Date().getTime();
    let frameCountPrev = this.frameCount;
    let averageReward100Best = -Infinity;
    
    console.log("> starting training");

    const loop = setInterval(f, 1);

    const f = () => {
      this.trainOnReplayBatch(trainConfig.batchSize, trainConfig.gamma, optimizer);
      const {action, cumulativeReward, gameOver} = this.playStep(true);

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

        if (averageReward100 >= trainConfig.cumulativeRewardThreshold ||
          this.frameCount >= trainConfig.maxNumFrames) {
          console.log("finished training!! in "+Math.floor((Date.now() - startTime)/ 1000) + " seconds");
          copyWeights(this.targetNetwork, this.onlineNetwork);
          this.targetNetwork.save(trainConfig.savePath);
          clearInterval(loop);
        }
      }
      if (this.frameCount % trainConfig.syncEveryFrames === 0) {
        copyWeights(this.targetNetwork, this.onlineNetwork);
        console.log('Sync\'ed weights from online network to target network');
      }
    }
  }
}