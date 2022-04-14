import { Plugin, registerPlugin } from "enmity-api/plugins";
import { getModuleByProps } from "enmity-api/module";
import { after } from "enmity-api/patcher";

const channelPerms = getModuleByProps("getChannelPermissions").default
const {
  Permissions, ChannelTypes
} = getModuleByProps("ChannelTypes")

let patches = []

const showHiddenChannels: Plugin = {
  name: "Show Hidden Channels",
  commands: [],
  onStart() {
    patches.push(after("showHiddenChannels", channelPerms, "can", ([permission], res) => {
      if (Permissions.VIEW_CHANNEL === permission) return true
      return res
    }))
  },
  onStop() {
    
  }
}

showHiddenChannels.onStart()

registerPlugin(showHiddenChannels)