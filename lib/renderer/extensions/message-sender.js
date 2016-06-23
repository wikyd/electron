const Tab = require('./tab')

class MessageSender {
  constructor (tabId, extensionId) {
    this.tab = tabId ? new Tab(tabId) : null
    this.id = extensionId
    this.url = `chrome-extension://${extensionId}`
  }
}

module.exports = MessageSender
