import { Plugin, registerPlugin } from "enmity-api/plugins";
import {
  create
} from "enmity-api/patcher"
import {
  getModuleByProps
} from "enmity-api/module"

// Fake console that sends to a WS server
function makeConsole():Console {
  const connection:WebSocket = new WebSocket("ws://10.0.0.83:1234")
  let canLoad = false
  let didError = false
  let delayed = []
  connection.onopen = () => {
    canLoad = true
    for (const delayedBody of delayed) connection.send(delayedBody)
  }
  connection.onerror = () => didError = true
  return new Proxy({}, {
    get: (target, prop) => (...args:any[]) => {
      if (didError) return
      const body = {
        time: Date.now(),
        type: prop,
        arguments: args,
        delayed: false
      }
      if (!canLoad) {
        body.delayed = true
        return delayed.push(JSON.stringify(body))
      }
      connection.send(JSON.stringify(body))
    }
  }) as Console
}
const console = makeConsole()
// Patcher
const patcher = create("showHiddenChannels")
// Modules
const modules = {
  channelPerms: getModuleByProps("getChannelPermissions").default,
  unreadManager: getModuleByProps("hasUnread").default,
  channelStore: getModuleByProps("getChannel").default,
  Permissions: getModuleByProps("Permissions").Permissions,
  ChannelTypes: getModuleByProps("ChannelTypes").ChannelTypes
}
const originalCan = modules.channelPerms.can.bind({})
// Channel types
const channelTypes = {
  ignore: [
    modules.ChannelTypes.DM, 
    modules.ChannelTypes.GROUP_DM, 
    modules.ChannelTypes.GUILD_CATEGORY
  ],
  good: [
    modules.ChannelTypes.GUILD_TEXT, 
    modules.ChannelTypes.GUILD_VOICE, 
    modules.ChannelTypes.GUILD_STAGE_VOICE, 
    modules.ChannelTypes.GUILD_ANNOUNCEMENT, 
    modules.ChannelTypes.ANNOUNCEMENT_THREAD, 
    modules.ChannelTypes.PRIVATE_THREAD, 
    modules.ChannelTypes.PUBLIC_THREAD
  ]
}
function userCanViewChannel(channel:string|{ type: number }) {
  let newChannel = (channel as { type: number })
  if (typeof channel === "string") newChannel = modules.channelStore.getChannel(channel)
  if (!newChannel || channelTypes.ignore.includes(newChannel.type)) return true
  return channelTypes.good.includes(newChannel.type) && originalCan(modules.Permissions.VIEW_CHANNEL, newChannel)
}

registerPlugin({
  name: "showHiddenChannels",
  patches: [],
  onStart() {
    patcher.after(modules.channelPerms, "can", (_:unknown, [permissionID]:Array<number>, res:Boolean) => {
      if (permissionID === modules.Permissions.VIEW_CHANNEL) return true
    })
    // Disable it's saying its unread
    patcher.after(modules.unreadManager, "hasUnread", (_:unknown, args:Array<string|unknown>, res:any) => {
      if (!userCanViewChannel(args[0] as string)) return false
    })
    patcher.after(modules.unreadManager, "hasUnreadPins", (_:unknown, args:Array<string|unknown>, res:any) => {
      if (!userCanViewChannel(args[0] as string)) return false
    })
    patcher.after(modules.unreadManager, "getMentionCount", (_:unknown, args:Array<string|unknown>, res:any) => {
      if (!userCanViewChannel(args[0] as string)) return 0
    })
    console.log("onStart")
  },
  onStop() {
    patcher.unpatchAll()
    console.log("onStop")
  }
})