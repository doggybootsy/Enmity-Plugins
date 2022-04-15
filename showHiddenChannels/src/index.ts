import { Plugin, registerPlugin } from "enmity-api/plugins";
import {
  create
} from "enmity-api/patcher"
import {
  getModule
} from "enmity-api/module"

function getModuleByProps(...props:string[]):any {
  const defaultModule = getModule(m => props.every((prop) => m.default && m.default.includes(prop)))?.default
  if (defaultModule) return defaultModule
  return getModule(m => props.every((prop) => m && m.includes(prop)))
}

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
    get: (target, prop) => (...args) => {
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

const getChannelPermissions = getModuleByProps("getChannelPermissions")
const unreadManager = getModuleByProps("hasUnread")
const { getChannel } = getModuleByProps("getChannel")
const { Permissions, ChannelTypes } = getModuleByProps("Permissions", "ChannelTypes")

const originalCan = getChannelPermissions.can.bind({})

const patcher = create("showHiddenChannels")

const channelTypes = {
  ignore: [
    ChannelTypes.DM, 
    ChannelTypes.GROUP_DM, 
    ChannelTypes.GUILD_CATEGORY
  ],
  good: [
    ChannelTypes.GUILD_TEXT, 
    ChannelTypes.GUILD_VOICE, 
    ChannelTypes.GUILD_STAGE_VOICE, 
    ChannelTypes.GUILD_ANNOUNCEMENT, 
    ChannelTypes.ANNOUNCEMENT_THREAD, 
    ChannelTypes.PRIVATE_THREAD, 
    ChannelTypes.PUBLIC_THREAD
  ]
}
// Only thing i use so
type channelType = { type: number }
function userCanViewChannel(channel:string|channelType) {
  let newChannel = (channel as channelType)
  if (typeof channel === "string") newChannel = getChannel(channel)
  return !newChannel || channelTypes.ignore.includes(newChannel.type) || (channelTypes.good.includes(newChannel.type) && originalCan(Permissions.VIEW_CHANNEL, newChannel))
}

const showHiddenChannels:Plugin = {
  name: "showHiddenChannels",
  patches: [],
  onStart() {
    patcher.after(getChannelPermissions, "can", (_:unknown, [permissionID]:Array<number>, res:Boolean) => {
      if (permissionID === Permissions.VIEW_CHANNEL) return true
    })
    // Disable it's saying its unread
    patcher.after(unreadManager, "hasUnread", (_:unknown, args:Array<string|unknown>, res:any) => {
      if (!userCanViewChannel(args[0] as string)) return false
    })
    patcher.after(unreadManager, "hasUnreadPins", (_:unknown, args:Array<string|unknown>, res:any) => {
      if (!userCanViewChannel(args[0] as string)) return false
    })
    patcher.after(unreadManager, "getMentionCount", (_:unknown, args:Array<string|unknown>, res:any) => {
      if (!userCanViewChannel(args[0] as string)) return 0
    })

    console.log("onStart")
  },
  onStop() {
    console.log("onStop")
    patcher.unpatchAll()
  }
}

registerPlugin(showHiddenChannels)