import { Plugin, registerPlugin } from "enmity-api/plugins"
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
  const delayed = []
  connection.onopen = () => {
    canLoad = true
    for (const delayedBody of delayed) connection.send(delayedBody)
  }
  connection.onerror = () => didError = true

  const consoleKeys = Object.keys(console)

  function send(prop:string, ...args:Array<unknown>) {
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

  const spoofedConsole = consoleKeys.map(key => [key, send.bind(this, key)])

  return Object.fromEntries(spoofedConsole)
}
const console = makeConsole()

const getChannelPermissions = getModuleByProps("getChannelPermissions").default
console.log("got getChannelPermissions")
const unreadManager = getModuleByProps("hasUnread").default
console.log("got unreadManager")
const { getChannel } = getModuleByProps("getChannel").default
console.log("got getChannel")
const { Permissions, ChannelTypes } = getModuleByProps("Permissions")
console.log("got Permissions")

const originalCan = getChannelPermissions.can.bind({})
console.log("got originalCan")
const patcher = create("showHiddenChannels")

const _channelTypes = {
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
console.log("got channelTypes")
const userCanViewChannel = (channel:string|{ type: number }) => {
  let newChannel = (channel as { type: number })
  if (typeof channel === "string") newChannel = getChannel(channel)
  if (!newChannel || _channelTypes.ignore.includes(newChannel.type)) return true
  return _channelTypes.good.includes(newChannel.type) && originalCan(Permissions.VIEW_CHANNEL, newChannel)
}
console.log("got userCanViewChannel")

const showHiddenChannels:Plugin = {
  name: "showHiddenChannels",
  patches: [],
  onStart() {
    console.log("onStart")

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
  },
  onStop() {
    console.log("onStop")
    patcher.unpatchAll()
  }
}

registerPlugin(showHiddenChannels)