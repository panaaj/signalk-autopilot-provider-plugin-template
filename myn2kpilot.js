/* 
  *********************************
  Autopilot communication methods.
  *********************************
  This is where communication with the autopilot device is managed.

  *************************************************************
  Update the sections with values relevant to the autopilot 
  device as per the comments below.
  *************************************************************
*/



/***********************************************************
 * Define the text used to discover the autopilot device.
 * The specify the string to match (startsWith) in the
 * n2k.hardwareVersion attribute of entries found under the
 * /signalk/sources path.
 * e.g. 'Raymarine EV-1 Course Computer'
 ***********************************************************/
const apDeviceSearchText = 'Raymarine EV-1 Course Computer'


/*********************************************************
 * Define the PGNs to be processed from incoming messages.
 * Processed by onStreamEvent() method.
*********************************************************/
const pgns = [
  65345, 65360, 65379, 
  65288,
  127237
]

/** Alarm text to map to Autopilot API alarm notifications */
apAlarms = ['WP Arrival','Pilot Way Point Advance','Pilot Route Complete']

/** Available autopilot device options.
 * These are returned to the API.
 * See API documentation.
*/
const apOptions = {
  states: [
    {name: 'auto', engaged: true},
    {name: 'wind', engaged: true},
    {name: 'route', engaged: true},
    {name: 'standby', engaged: false}
  ],
  modes: []
}

/***********************************************************
 * Define the states to use for engage / disengage commands
 ***********************************************************/
const defaultState = {
  engaged: 'auto',
  disengaged: 'standby'
}

/*******************************************
 * Replace these example N2K command values
 ******************************************/
const n2k_commands = {
  state: {  // Should be one entry for each name entry in apOptions.states.
    "auto": "%s,3,126208,%s,%s,17,01,63,ff,00,f8,04,01,3b,07,03,04,04,40,00,05,ff,ff",
    "wind": "%s,3,126208,%s,%s,17,01,63,ff,00,f8,04,01,3b,07,03,04,04,00,01,05,ff,ff",
    "route": "%s,3,126208,%s,%s,17,01,63,ff,00,f8,04,01,3b,07,03,04,04,80,01,05,ff,ff",
    "standby": "%s,3,126208,%s,%s,17,01,63,ff,00,f8,04,01,3b,07,03,04,04,00,00,05,ff,ff"
  },
  mode: "%s,3,126208,%s,%s,17,01,63,ff,00,f8,04,01,3b,07,03,04,04,00,00,05,ff,ff",
  heading: "%s,3,126208,%s,%s,14,01,50,ff,00,f8,03,01,3b,07,03,04,06,%s,%s",
  input: "%s,7,126720,%s,%s,22,3b,9f,f0,81,86,21,%s,ff,ff,ff,ff,ff,c1,c2,cd,66,80,d3,42,b1,c8",
  input_keys : {
    "+1":      "07,f8",
    "+10":     "08,f7",
    "-1":      "05,fa",
    "-10":     "06,f9",
    "-1-10":   "21,de",
    "+1+10":   "22,dd"
}
}

const util = require('util')
const _ = require('lodash')

const default_src = '1'
const autopilot_dst = '204' // fallback N2K destination id
const everyone_dst = '255'

let deviceId                // target device id
let discovered = false      // true if target device discovered

const apStatus = {          // device status
  state: null,
  mode: null,
  engaged: null,
  target: null
}

module.exports = function(app) {
  
  pilot.start = (props) => {
    deviceId = props.deviceId
    app.debug('props.deviceId =', props.deviceId)
    app.debug('deviceId =', deviceId)

    app.debug('**** intialise n2k stream listener *****')
    app.on('N2KAnalyzerOut', onStreamEvent)
  }

  pilot.stop = () => {
  }

  pilot.status = () => { 
    return  {...apOptions, ...apStatus}
  }

  pilot.setState = (value) => {
    if ( !n2k_commands.state[value] ) {
      throw new Error(`Invalid state: ${value}`)
    } else {
      let msg = util.format(n2k_commands.state[value], (new Date()).toISOString(), default_src, deviceId)
      sendN2k([msg])
      return !n2k_commands.state[value][engaged]
    }
  }

  pilot.engage = () => {
    return setState(defaultState.engaged)
  }

  pilot.disengage = () => {
    return setState(defaultState.disengaged)
  }

  /**********************************************
   * Update function for target autopilot device 
  ***********************************************/
  pilot.setTarget = (value) => {
    // Check autopilot is in the appropriate state.
    if (!n2k_commands.state[apStatus.state][engaged]) {
      throw new Error(`Autopilot current state (${apState} does not support this operation!`)
    } else { // ** example **
      const new_value = Math.trunc(value * 10000)
      const msg = util.format(
        n2k_commands.heading, 
        (new Date()).toISOString(),
        default_src,
        autopilot_dst,
        padd((new_value & 0xff).toString(16), 2), 
        padd(((new_value >> 8) & 0xff).toString(16), 2)
      )
      sendN2k([msg])
      return
    }
  }

  /**********************************************
   * Update function for target autopilot device 
  ***********************************************/
  pilot.adjustTarget = (value)  => {
    // Check autopilot is in the appropriate state.
    if (!n2k_commands.state[apStatus.state][engaged]) {
      throw new Error(`Autopilot current state (${apStatus.state} does not support this operation!`)
    } else { // ** example **
      let aString
      switch (value) {
      case 10:
        aString = '+10'
        break
      case -10:
        aString = '-10'
        break
      case 1:
        aString = '+1'
        break
      case -1:
        aString = '-1'
        break
      default:
        throw new Error(`Invalid adjustment: ${value}`)
      }
      sendN2k(
        [util.format(
          n2k_commands.input, 
          (new Date()).toISOString(), 
          default_src, 
          everyone_dst, 
          n2k_commands.input_keys[aString])]
      )
      return
    }
  }


  /*****************************
   * Autopilot device discovery
  ******************************/
  pilot.properties = () => {
    let discId = deviceId ?? autopilot_dst
    let description = 'No device found!'

    app.debug('***pre-discovery -> discId', discId)

    if (!discovered) {
      const sources = app.getPath('/sources')
      if ( sources ) {
        _.values(sources).forEach(v => {
          if ( typeof v === 'object' ) {
            _.keys(v).forEach(id => {
              if ( v[id] && v[id].n2k && v[id].n2k.hardwareVersion && v[id].n2k.hardwareVersion.startsWith(apDeviceSearchText) ) {
                discId = id
                discovered = true
              }
            })
          }
        })
      }
    }

    if (discovered) {
      deviceId = discId
      description = `Discovered autopilot device with id ${discId}`
      app.debug(description)
    }

    app.debug('*** post-discovery -> deviceId', deviceId)
      
    return {
      deviceId: {
        type: "string",
        title: "Autopilot NMEA2000 id.",
        description,
        default: deviceId
      }
    }
  }

  return pilot
}


/***********************************
 * NMEA2000 stream event handler.
 * Parse NMEA2000 stream input
 * 
 * Update to process target PGNs 
 * in the required maanner.
 * *********************************/
const onStreamEvent = (evt) => {
  
  if (!pgns.includes(evt.pgn) || String(evt.src) !== deviceId) {
    return
  }
  
  // 127237 `Heading / Track control (Rudder, etc.)`
  if (evt.pgn === 127237) { 
    //app.debug('n2k pgn=', evt.pgn, evt.fields, evt.description)
  }

  // 65288 = notifications.autopilot.<alarmName>
  if (evt.pgn === 65288) {
    if (evt.fields['Manufacturer Code'] !== 'Raymarine'
      || typeof evt.fields['Alarm Group'] === 'Autopilot'
      || typeof evt.fields['Alarm Status'] === 'undefined') {
      return
    }

    const method = [ 'visual' ]

    let state = evt.fields['Alarm Status']
    if ( state === 'Alarm condition met and not silenced' ) {
      method.push('sound')
    }

    if ( state === 'Alarm condition not met' ) {
      state = 'normal'
    } else {
      state = 'alarm'
    }

    let alarmId = evt.fields['Alarm ID']

    if ( typeof alarmId !== 'string' ) {
      alarmId = `Unknown Alarm ${alarmId}`
    } else if ( 
      state === 'alarm' &&
        apAlarms.includes(alarmId)
      ) {
      state = 'alert'
    }

    // normalise alarm name
    let alarmName = normaliseAlarmId(alarmId)
    if (!alarmName) {
      app.debug(`*** Normalise Alarm Failed: ${alarmId}`)
      return
    }

    const msg = {
      message: alarmName,
      method: method,
      state: state
    }

    app.autopilotAlarm(apType, alarmName, msg)
  }

  // 65345 = 'steering.autopilot.target (windAngleApparent)'
  if (evt.pgn === 65345) {
    let angle = evt.fields['Wind Datum'] ? Number(evt.fields['Wind Datum']) : null
    angle = ( typeof angle === 'number' && angle > Math.PI ) ? angle-(Math.PI*2) : angle
    apStatus.target = angle
    app.autopilotUpdate(apType, 'target', angle)
  }

  // 65360 = 'steering.autopilot.target (true/magnetic)'
  if (evt.pgn === 65360) {
    const targetTrue = evt.fields['Target Heading True'] ? Number(evt.fields['Target Heading True']) : null
    const targetMagnetic = evt.fields['Target Heading Magnetic'] ? Number(evt.fields['Target Heading Magnetic']) : null
    const target = typeof targetTrue === 'number' ? targetTrue :
      typeof targetMagnetic === 'number' ? targetMagnetic: null
    apStatus.target = target
    app.autopilotUpdate(apType, 'target', target)
  }
  
  // 65379 = 'steering.autopilot.state', 'steering.autopilot.engaged'
  if (evt.pgn === 65379) {
    const mode = evt.fields['Pilot Mode'] ? Number(evt.fields['Pilot Mode']) : null
    const subMode = evt.fields['Sub Mode'] ? Number(evt.fields['Sub Mode']) : null
    if ( mode !== null || subMode !== null) {
      if ( mode === 0 && subMode === 0 ) {
        apStatus.state = 'standby'
        apStatus.engaged = false
      }
      else if ( mode == 0 && subMode == 1 ) {
        apStatus.state = 'wind'
        apStatus.engaged = true
      }
      else if ( (mode == 128 || mode == 129) && subMode == 1 ) {
        apStatus.state = 'route'
        apStatus.engaged = true
      }
      else if ( mode == 64 && subMode == 0 ) {
        apStatus.state = 'auto'
        apStatus.engaged = true
      }
      else {
        apStatus.state = 'standby'
        apStatus.engaged = false
      }
      app.autopilotUpdate(apType, 'state', apStatus.state)
      app.autopilotUpdate(apType, 'engaged', apStatus.engaged)
    }
  }

}

// normalise SK alarm path 
const normaliseAlarmId = (id) => {
  switch (id) {
    case 'WP Arrival':
      return 'waypointArrival'
    case 'Pilot Way Point Advance':
      return 'waypointAdvance'
    case 'Pilot Route Complete':
      return 'routeComplete'
    default:
      return ''
  }
}

// Send NMEA2000 message.
const sendN2k = (msgs) => {
  if (!Array.isArray(msgs)) {
    return
  }
  app.debug(`sendN2k -> ${msgs}`)
  msgs.map((msg) => { app.emit('nmea2000out', msg) })
}

// format N2K msg data
const padd = (n, p, c) => {
  var pad_char = typeof c !== 'undefined' ? c : '0';
  var pad = new Array(1 + p).join(pad_char);
  return (pad + n).slice(-pad.length);
}
