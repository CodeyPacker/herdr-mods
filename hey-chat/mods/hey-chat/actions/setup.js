// Whether Node and the agents are installed and signed in, and opening the setup screen when not.
import { checkSetup } from "../agent.js";

export const setup = {
  /** Checks Node and each agent again. `automatic` is the check a pane makes when it opens. @param {any} cx @param {boolean} [automatic] */
  refreshSetup(cx, automatic = false) {
    if (this.setupChecking) return;
    this.setupChecking = true;
    cx.spawn(async (/** @type {any} */ cx) => {
      const previous = this.setupState;
      try {
        this.setupState = await checkSetup();
        const state = this.setupState;
        this.agents = [...(state.node ? ["node"] : []), ...Object.keys(state.agents).filter(a => state.agents[a].installed)];
        const ready = Object.keys(state.agents).find(a => state.agents[a].auth === "ready");
        if (automatic && !this.chat(this.chatId)?.session && !this.chat(this.chatId)?.thread.length) {
          if (ready) this.chat(this.chatId).agent = ready;
          else this.setupOpen = true;
        }
        if (previous?.node === false && state.node) await this.loadChats(cx);
      } finally { this.setupChecking = false; cx.notify(); }
    });
  },

  /** Why a chat's agent can't run here, or null. Opens setup when something is missing. @param {string} agent */
  missingCli(agent) {
    if (!this.agents) return null;
    if (!this.agents.includes("node") || !this.agents.includes(agent)) { this.setupOpen = true; this.setupAgent = agent; }
    if (!this.agents.includes("node")) return "Hey, chat needs node on your PATH to run the agent.";
    if (!this.agents.includes(agent)) return `Hey, chat can't find the ${agent} command. Install it and sign in, then try again.`;
    return null;
  },
};
