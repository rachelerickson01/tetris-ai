// this is the Q-learning agent
class QLearning {

    constructor(lr = 0.1, gamma = 0.9, epsilon = 0.1) {
        // this is our q table. stores values: { state ==> [q_actions_0, q_action_1, ...]}
        this.qTable = new Map(); 
        this.lr = lr; // ALPHA, the learning rate
        this.gamma = gamma; // DISCOUNT FACTOR, how much to value future rewards
        this.epsilon = epsilon; // EXPLORATION RATE, probability a random action (exploration) will be taken
    }

    // available: list of all legal placements for the active piece
    getQ(state, available) {
        // if current state does not exists in qTable, created an entry with values of 0
        if (!this.qTable.has(state)) {
            // creates an array sized to the number of possible landing positions. Initialized to zeros
            this.qTable.set(state, new Float32Array(available.length)); 
        }
        return this.qTable.get(state);
        
    }

    getAction(state, available){
        // if less than epsilon, explore. else, exploit
        if (Math.random() < this.epsilon) {
            return available[~~(Math.random() * available.length)] // returns a random action
        }
        const q = this.getQ(state, available);
        return available.reduce((best, a) => q[a] > q[best] ? a : best, available[0]) // returns best known move
    }

    // This is that q-learning function:
    // Q(s, a) ← Q(s, a) + α [r + γ max(a') Q(s', a') − Q(s, a)]
    update(s, a, r, s2, available2) {
        const q = this.getQ(s);
        const maxQ2 = available2.length ? Math.max(...available2.map(a_prime => this.getQ(s2)[a_prime])) : 0;
        q[a] += this.lr * (r + this.gamma * maxQ2 - q[a]); // updating the q-value for this action
    }
}

function enumeratePlacements();