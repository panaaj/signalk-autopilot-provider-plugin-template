'use strict'
const apModule = require('./myn2kpilot')

module.exports = function(app) {

  let autopilot = apModule(app)
  
  let plugin = {
    id: "sk-autopilot-provider",
    name: "Autopilot Template Provider",
    description: "V2 Plugin that controls an autopilot."
  }

  plugin.start = (props) => {
    autopilot.start(props)
    registerProvider()
  }

  plugin.stop = () => {
    autopilot.stop()
  }

  plugin.schema = autopilot.properties


  // Autopilot API - register with Autopilot API
  const registerProvider = ()=> {
    app.debug('**** registerProvider *****')
    try {
      app.registerAutopilotProvider(
        {
          getData: async (deviceId) => {
            return autopilot.status()
          },

          getState: async (deviceId) => {
            return autopilot.autopilot.status().state
          },
          setState: async (
            state,
            deviceId
          ) => {
            return autopilot.setState(state)
          },

          getMode: async (deviceId) => {
            return autopilot.status().mode
          },
          setMode: async (mode, deviceId) => {
            throw new Error('Not implemented!')
          },

          getTarget: async (deviceId) => {
            return autopilot.status().target
          },
          setTarget: async (value, deviceId) => {
            return autopilot.setTarget(value)
          },
          adjustTarget: async (
            value,
            deviceId
          ) => {
            return r = autopilot.adjustTarget(value)
          },
          engage: async (deviceId) => {
            return autopilot.engage()
          },
          disengage: async (deviceId) => {
            return autopilot.disengage()
          },
          tack: async (
            direction,
            deviceId
          ) => {
            throw new Error('Not implemented!')
          },
          gybe: async (
            direction,
            deviceId
          ) => {
            throw new Error('Not implemented!')
          },
          dodge: async (
            direction,
            deviceId
          ) => {
            throw new Error('Not implemented!')
          }
        },
        [autopilot.type]
      )
    } catch (error) {
      app.debug(error)
    }
  }

  return plugin;
}
