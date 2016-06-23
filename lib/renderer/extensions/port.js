const {ipcRenderer} = require('electron')
const Event = require('./event')
const MessageSender = require('./message-sender')

class Port {
  constructor (tabId, portId, extensionId, name) {
    this.tabId = tabId
    this.portId = portId
    this.disconnected = false

    this.name = name
    this.onDisconnect = new Event()
    this.onMessage = new Event()
    this.sender = new MessageSender(tabId, extensionId)

    ipcRenderer.once(`CHROME_PORT_DISCONNECT_${portId}`, () => {
      this._onDisconnect()
    })
    ipcRenderer.on(`CHROME_PORT_POSTMESSAGE_${portId}`, (event, message) => {
      const sendResponse = function () { console.error('sendResponse is not implemented') }
      this.onMessage.emit(message, this.sender, sendResponse)
    })
  }

  disconnect () {
    if (this.disconnected) return

    ipcRenderer.sendToAll(this.tabId, `CHROME_PORT_DISCONNECT_${this.portId}`)
    this._onDisconnect()
  }

  postMessage (message) {
    ipcRenderer.sendToAll(this.tabId, `CHROME_PORT_POSTMESSAGE_${this.portId}`, message)
  }

  _onDisconnect () {
    this.disconnected = true
    ipcRenderer.removeAllListeners(`CHROME_PORT_POSTMESSAGE_${this.portId}`)
    this.onDisconnect.emit()
  }
}

module.exports = Port
