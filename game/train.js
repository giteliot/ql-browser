import {Game} from './game.js'
import {Agent} from './agent.js'
const tf = require('@tensorflow/tfjs-node');

const game = new Game();
const agentConfig = {
    replayBufferSize: 1e4,
    epsilonInit: 0.5,
    epsilonFinal: 0.01,
    epsilonDecayFrames: 1e5,
    learningRate: 1e-3
  };

  const trainConfig = {
  batchSize: 64, 
    gamma: 0.99,
    learningRate: 1e-3,
    cumulativeRewardThreshold: 100, 
    maxNumFrames: 1e6,
    syncEveryFrames: 1e3, 
    savePath: './models/dqn', 
    logDir: null
  }

const agent = new Agent(game, agentConfig);

console.log(game);
train(agent, trainConfig);

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

export async function train(agent, config) {
	//const batchSize, gamma, learningRate, cumulativeRewardThreshold,
  //  maxNumFrames, syncEveryFrames, savePath, logDir = config;
    
	let summaryWriter;
	if (config.logDir != null) {
    	summaryWriter = tf.node.summaryFileWriter(config.logDir);
	}

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
    const {cumulativeReward, done, fruitsEaten} = agent.playStep();
    if (done) {
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
        if (savePath != null) {
          if (!fs.existsSync(config.savePath)) {
            mkdir('-p', config.savePath);
          }
          await agent.onlineNetwork.save(`file://${config.savePath}`);
          console.log(`Saved DQN to ${config.savePath}`);
        }
      }
    }
    if (agent.frameCount % syncEveryFrames === 0) {
      copyWeights(agent.targetNetwork, agent.onlineNetwork);
      console.log('Sync\'ed weights from online network to target network');
    }
  }

}



