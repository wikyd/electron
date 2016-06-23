const {ipcRenderer} = require('electron')
const Event = require('./extensions/event')
const MessageSender = require('./extensions/message-sender')
const Port = require('./extensions/port')
const Tab = require('./extensions/tab')
const url = require('url')

let nextId = 0

// Inject chrome API to the |context|
exports.injectTo = function (extensionId, isBackgroundPage, context) {
  const chrome = context.chrome = context.chrome || {}

  ipcRenderer.on(`CHROME_RUNTIME_ONCONNECT_${extensionId}`, (event, tabId, portId, connectInfo) => {
    chrome.runtime.onConnect.emit(new Port(tabId, portId, extensionId, connectInfo.name))
  })

  ipcRenderer.on(`CHROME_RUNTIME_ONMESSAGE_${extensionId}`, (event, tabId, message) => {
    chrome.runtime.onMessage.emit(message, new MessageSender(tabId, extensionId))
  })

  ipcRenderer.on('CHROME_TABS_ONCREATED', (event, tabId) => {
    chrome.tabs.onCreated.emit(new Tab(tabId))
  })

  ipcRenderer.on('CHROME_TABS_ONREMOVED', (event, tabId) => {
    chrome.tabs.onRemoved.emit(tabId)
  })

  chrome.runtime = {
    id: extensionId,

    getURL: function (path) {
      return url.format({
        protocol: 'chrome-extension',
        slashes: true,
        hostname: extensionId,
        pathname: path
      })
    },

    connect (...args) {
      if (isBackgroundPage) {
        console.error('chrome.runtime.connect is not supported in background page')
        return
      }

      // Parse the optional args.
      let targetExtensionId = extensionId
      let connectInfo = {name: ''}
      if (args.length === 1) {
        connectInfo = args[0]
      } else if (args.length === 2) {
        [targetExtensionId, connectInfo] = args
      }

      const {tabId, portId} = ipcRenderer.sendSync('CHROME_RUNTIME_CONNECT', targetExtensionId, connectInfo)
      return new Port(tabId, portId, extensionId, connectInfo.name)
    },

    sendMessage (...args) {
      if (isBackgroundPage) {
        console.error('chrome.runtime.sendMessage is not supported in background page')
        return
      }

      // Parse the optional args.
      let targetExtensionId = extensionId
      let message
      if (args.length === 1) {
        message = args[0]
      } else if (args.length === 2) {
        // A case of not provide extension-id: (message, responseCallback)
        if (typeof args[1] === 'function') {
          console.error('responseCallback is not supported')
          message = args[0]
        } else {
          [targetExtensionId, message] = args
        }
      } else {
        console.error('options and responseCallback are not supported')
      }

      ipcRenderer.send('CHROME_RUNTIME_SENDMESSAGE', targetExtensionId, message)
    },

    onConnect: new Event(),
    onMessage: new Event(),
    onInstalled: new Event()
  }

  chrome.tabs = {
    executeScript (tabId, details, callback) {
      const requestId = ++nextId
      ipcRenderer.once(`CHROME_TABS_EXECUTESCRIPT_RESULT_${requestId}`, (event, result) => {
        callback([event.result])
      })
      ipcRenderer.send('CHROME_TABS_EXECUTESCRIPT', requestId, tabId, extensionId, details)
    },

    sendMessage (tabId, message, options, responseCallback) {
      if (responseCallback) {
        console.error('responseCallback is not supported')
      }
      ipcRenderer.send('CHROME_TABS_SEND_MESSAGE', tabId, extensionId, isBackgroundPage, message)
    },

    onUpdated: new Event(),
    onCreated: new Event(),
    onRemoved: new Event()
  }

  const request = require('./extensions/request').setup(extensionId)

  chrome.extension = {
    getURL: chrome.runtime.getURL,
    connect: chrome.runtime.connect,
    onConnect: chrome.runtime.onConnect,
    sendMessage: chrome.runtime.sendMessage,
    onMessage: chrome.runtime.onMessage,
    sendRequest: request.sendRequest,
    onRequest: request.onRequest
  }

  chrome.storage = require('./extensions/storage')

  chrome.pageAction = {
    show () {},
    hide () {},
    setTitle () {},
    getTitle () {},
    setIcon () {},
    setPopup () {},
    getPopup () {}
  }

  chrome.i18n = require('./extensions/i18n').setup(extensionId)
  chrome.webNavigation = require('./extensions/web-navigation').setup()
}
