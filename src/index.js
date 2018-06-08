import './scss/style.scss'
import {MDCSnackbar} from '@material/snackbar'
import JSZip from 'jszip'
import {saveAs} from 'file-saver'

const snackbar = new MDCSnackbar(document.querySelector('.mdc-snackbar'))
const status = document.querySelector("#status")

const parser = new DOMParser()
const serializer = new XMLSerializer()

function previousSibling( elem, until ) {
  // Adapted from jQuery
  let matched = null

  while ( ( elem = elem.previousSibling ) && elem.nodeType !== 9 ) {
    if ( elem.nodeType === 1 && elem.tagName === until) {
      matched = elem
      break
    }
  }
  return matched
}

function saveFile(feilData) {
  // Save file
  const a = document.createElement("a")
  document.body.appendChild(a)
  a.style = "display: none"
  const blob = new Blob([fileData.text], {type: "text/xml"})
  const url = window.URL.createObjectURL(blob)
  a.href = url
  a.download = fileData.name
  a.click();
  window.URL.revokeObjectURL(url)
}

function getIdForBeat(tstamp, staff, layer, from) {
  // Get nearest staffDef for slur's @staff and save time signature
  let closestScoreDef = previousSibling(from.closest('measure'), 'scoreDef')

  if (!closestScoreDef) {
    // Look further up
    closestScoreDef = previousSibling(from.closest('section'), 'scoreDef')
  }
  // Does the scoreDef have everything we need?
  let fullScoreDef = closestScoreDef
  while (!fullScoreDef.querySelector(`staffDef[n='${staff}']`)) {
    fullScoreDef = previousSibling(from.closest('section'), 'scoreDef')
  }

  const mCount = closestScoreDef.getAttribute('meter.count')
  const mUnit = closestScoreDef.getAttribute('meter.unit')

  // Determine @startid:
  // Go to parent::measure//staff[@n=@staff]//layer[@n=@layer] (if layer is specified)
  const staffEl = from.closest('measure').querySelector(`staff[n='${staff}']`)
  let layerEl
  if (layer) {
    layerEl = staffEl.querySelector(`layer[n='${layer}']`)
  } else {
    layerEl = staffEl.querySelector(`layer[n='1']`)
  }

  // For each event with @dur (except notes contained within chords)
  let beat = 1
  for (const evt of layerEl.querySelectorAll('*[dur]')) {
    // Skip if contained by a chord
    if (evt.tagName === 'note' && evt.closest('chord')) {
      continue
    }

    console.log(beat)

    // If matched, return
    if (beat === parseFloat(parseFloat(tstamp).toFixed(2))) {
      return evt.getAttribute('xml:id')
    }

    // Add this event's duration to the beat

    let dur = evt.getAttribute('dur')

    if (evt.closest('tuplet')) {
      // if this is the last number, round it up.
      const num = parseInt(evt.closest('tuplet').getAttribute('num')) // e.g. 3
      const beatPart = parseFloat((1 / num).toFixed(2)) // e.g. 0.33
      if (beat + beatPart === Math.floor(beat) + (beatPart * num)) { // e.g. 0.99
        console.log('h')
        beat = Math.round(beat + beatPart)
      } else {
        beat += beatPart
      }
    } else {
      if (dur === 'breve') {
        dur = 0.5
      } else if (dur === 'long') {
        dur = 0.25
      }
      let duration = parseFloat(parseFloat(dur).toFixed(2))
      beat += mUnit / duration
    }     

    if (evt.getAttribute('dots')) {
      // Quick and dirty solution because maths and MEI restricts 4 dots.
      switch (evt.getAttribute('dots')) {
        case '1':
          beat += mUnit / (duration * 2)
          break
        case '2':
          beat += mUnit / (duration * 2)
          beat += mUnit / (duration * 4)
          break
        case '3':
          beat += mUnit / (duration * 2)
          beat += mUnit / (duration * 4)
          beat += mUnit / (duration * 8)
          break
        case '4':
          beat += mUnit / (duration * 2)
          beat += mUnit / (duration * 4)
          beat += mUnit / (duration * 8)
          beat += mUnit / (duration * 16)
          break
        default:
      }
    }
  }
}

function refine(files, cb) {
  const slurs = document.querySelector('#slurs').checked
  const promises = []
  if (files.length > 0) {
    for (const file of files) {
      // Get file data
      const reader = new FileReader()
      const p = new Promise( (res, rej) => {
        reader.onload = (e) => {
          const data = reader.result
          let refined = data.replace(/\u0000/g, '')
          refined = refined.replace(/encoding=['"]UTF-16['"]/, 'encoding="UTF-8"')
          refined = refined.replace(/^.*?<\?xml/, '<?xml')

          if (slurs) {
            // fix slurs

            // Parse XML document
            const meiDoc = parser.parseFromString(refined, "application/xml")   
            
            // Store all measures as we'll need them
            const measures = meiDoc.querySelector('music').querySelectorAll('measure')

            // For each slur:
            for (const slur of meiDoc.querySelectorAll('slur')) {
              const tstamp = slur.getAttribute('tstamp')
              const tstamp2 = slur.getAttribute('tstamp2')
              const staff = slur.getAttribute('staff')
              const layer = slur.getAttribute('layer')

              const startid = getIdForBeat(parseFloat(parseFloat(tstamp).toFixed(2)), staff, layer, slur)

              if (startid) {
                slur.setAttribute('startid', startid)
              } else {
                status.insertAdjacentHTML( 'beforeend', `
                <li class="mdc-list-item">
                  Could not locate @startid for slur with id #${slur.getAttribute('xml:id')}
                </li>` )
              }

              // Determine @endid:
              // Parse @tstamp2 to figure out whether end is in this measure or following
              const tstamp2Full = tstamp2.split('m+')
              const tstamp2Measure = parseInt(tstamp2Full[0])
              const tstamp2Beat = parseFloat(parseFloat(tstamp2Full[1]).toFixed(2))

              // Retrieve correct measure and calculate beat as for @startid.
              let measure = slur.closest('measure')
              if (tstamp2Measure > 0) {                
                for (const [i, m] of measures.entries()) {
                  if (m.getAttribute('xml:id') === measure.getAttribute('xml:id')) {
                    measure = measures[i+tstamp2Measure]
                    break 
                  }
                }
              }

              const endid = getIdForBeat(tstamp2Beat, staff, layer, measure)
              if (!endid) {
                status.insertAdjacentHTML( 'beforeend', `
                <li class="mdc-list-item">
                  Could not locate @endid for slur with id #${slur.getAttribute('xml:id')}
                </li>` )
              } else {
                slur.setAttribute('endid', endid)
              }             
              
            }
            // Stringify XML and Resolve promise
            res({
              name: file.name,
              text: serializer.serializeToString(meiDoc)
            })
          } else {
            res({
              name: file.name,
              text: refined
            })
          }          
        }      
        reader.readAsText(file)
      })
      promises.push(p)
    }
    Promise.all(promises).then((all) => {
      if (all.length === 1) {
        saveAs(new Blob([all[0].text], {type: "text/xml"}), all[0].name)
      } else {
        // Zip
        const zip = new JSZip()
        for (const fileData of all) {          
          zip.file(fileData.name, fileData.text)          
        }
        zip.generateAsync({type:"blob"}).then(function(content) {              
          saveAs(content, "refined.zip")
        })
      }      
      cb()
    })
  }
}

function end() {
  snackbar.show({message:'Done!'})
}

document.querySelector('#addFiles').addEventListener('click', () => {
  document.querySelector('#meiFiles').click()
})

document.querySelector('#meiFiles').addEventListener('change', (e) => {
  if (e.target.files.length > 0) {    
    document.querySelector('#gorefine').removeAttribute('disabled')
    let fileList = ''
    for (const f of e.target.files) {
      fileList += `
      <li class="mdc-list-item">
        ${f.name}
      </li>`
    }
    document.querySelector('#selectedFiles').innerHTML = fileList
  } else {
    document.querySelector('#gorefine').setAttribute('disabled', 'disabled')
  }
})

document.querySelector('#gorefine').addEventListener('click', () => {
  status.innerHTML = ''
  refine(document.querySelector('#meiFiles').files, end)
})