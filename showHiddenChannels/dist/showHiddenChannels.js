function a(n){window.enmity.plugins.registerPlugin(n)}function t(...n){return window.enmity.getModuleByProps(n)}function r(n,e,i,s){return{unpatchAll:window.enmity.patcher.after(n,e,i,s)}}const u=t("getChannelPermissions").default,{Permissions:l,ChannelTypes:d}=t("ChannelTypes");let c=[];const o={name:"Show Hidden Channels",commands:[],onStart(){c.push(r("showHiddenChannels",u,"can",([n],e)=>l.VIEW_CHANNEL===n?!0:e))},onStop(){}};o.onStart(),a(o);
