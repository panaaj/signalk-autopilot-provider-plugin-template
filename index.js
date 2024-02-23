'use strict'
const autopilot  = require('./myn2kpilot')

/*****************************************************************
 * autopilot type identifier - set a value that is unique.
 * The value must be valid for use in URI path  as it is used 
 * to target commands to a specific device.
 * 
 * e.g.  * apType= 'mypilot'
 * 
 * POST "./steering/autopilot/mypilotid/engage"
 * ***************************************************************/
const apType = 'myN2kPilot'  

module.exports = function(app) {

  let plugin = {
    id: "sk-autopilot-provider",
    name: "Autopilot Control",
    description: "Plugin that controls an autopilot"
  }

  plugin.start = function(props) {
    autopilot.start(props)
    registerProvider()
  }

  plugin.stop = function() {
    autopilot.stop()
  }

  plugin.schema = function() {
    return {
      title: "Autopilot Control",
      type: "object",
      properties: autopilot.properties()
    }
  }

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
        [apType]
      )
    } catch (error) {
      app.debug(error)
    }
  }

  return plugin;
}
