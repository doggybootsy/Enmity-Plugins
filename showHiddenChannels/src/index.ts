import { Plugin, registerPlugin } from "enmity-api/plugins";

const showHiddenChannels: Plugin = {
  name: "Show Hidden Channels",
  commands: [],
  onStart() {
    
  },
  onStop() {
    
  }
}

showHiddenChannels.onStart()

registerPlugin(showHiddenChannels)