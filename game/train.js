import {Game} from './game.js';
import {Agent} from './agent.js';
import {copyWeights} from './dqn';
import * as fs from 'fs';
//const tf = require('@tensorflow/tfjs-node-gpu');
const tf = require('@tensorflow/tfjs-node');

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

const game = new Game();
const agentConfig = {
    replayBufferSize: 1e4,
    epsilonInit: 0.5,
    epsilonFinal: 0.01,
    epsilonDecayFrames: 1e5,
    learningRate: 1e-3
  };

  

const agent = new Agent(game, agentConfig);
train(agent, trainConfig);

 async function train(agent) {
  //const batchSize, gamma, learningRate, cumulativeRewardThreshold,
  //  maxNumFrames, syncEveryFrames, savePath, logDir = config;
    
  let summaryWriter;
  if (config.logDir != null) {
      summaryWriter = tf.node.summaryFileWriter(config.logDir);
  }
  console.log("got summary");
  for (let i = 0; i < agent.replayBufferSize; ++i) {
    agent.playStep();
  }

  // Moving averager: cumulative reward across 100 most recent 100 episodes.
  const rewardAverager100 = new MovingAverager(100);

  const optimizer = tf.train.adam(config.learningRate);

  let tPrev = new Date().getTime();
  let frameCountPrev = agent.frameCount;
  let averageReward100Best = -Infinity;
  
  while (true) {
    agent.trainOnReplayBatch(config.batchSize, config.gamma, optimizer);
    const {action, cumulativeReward, gameOver} = agent.playStep();

    if (gameOver) {
      
      const t = new Date().getTime();
      const framesPerSecond =
          (agent.frameCount - frameCountPrev) / (t - tPrev) * 1e3;
      tPrev = t;
      frameCountPrev = agent.frameCount;

      rewardAverager100.append(cumulativeReward);

      const averageReward100 = rewardAverager100.average();

      console.log(
          `Frame #${agent.frameCount}: ` +
          `cumulativeReward100=${averageReward100.toFixed(1)}; ` +
          `(epsilon=${agent.epsilon.toFixed(3)}) ` +
          `(${framesPerSecond.toFixed(1)} frames/s)`);

      if (summaryWriter != null) {
        summaryWriter.scalar(
            'cumulativeReward100', averageReward100, agent.frameCount);
        summaryWriter.scalar('epsilon', agent.epsilon, agent.frameCount);
        summaryWriter.scalar(
            'framesPerSecond', framesPerSecond, agent.frameCount);
      }

      if (averageReward100 >= config.cumulativeRewardThreshold ||
          agent.frameCount >= config.maxNumFrames) {
        // TODO(cais): Save online network.
        break;
      }

      if (averageReward100 > averageReward100Best) {
        averageReward100Best = averageReward100;
        if (config.savePath != null) {
          if (!fs.existsSync(config.savePath)) {
            mkdir('-p', config.savePath);
          }
          await agent.onlineNetwork.save(`file://${config.savePath}`);
          console.log(`Saved DQN to ${config.savePath}`);
        }
      }
    }
    if (agent.frameCount % config.syncEveryFrames === 0) {
      copyWeights(agent.targetNetwork, agent.onlineNetwork);
      console.log('Sync\'ed weights from online network to target network');
    }

  }
}



