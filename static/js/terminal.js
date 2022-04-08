/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */

async function handleCommandInput () {
  function submitOutputAndClearInput (output) {
    const terminal = document.querySelector('#response')
    const commandInput = document.querySelector('#commandInput')
    terminal.innerHTML += `$ ${commandInput.value}\n\n${output || ''}\n`
    terminal.scrollTop = terminal.scrollHeight
    commandInput.value = ''
  }

  const commandInput = document.querySelector('#commandInput')

  if (commandInput.value === '') {
    submitOutputAndClearInput()
    return
  }

  const response = await fetch('http://127.0.0.1:8080/command', {
    method: 'POST',
    mode: 'cors',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ command: commandInput.value })
  })

  const responseObj = await response.json()

  submitOutputAndClearInput(responseObj.commandOutput)

  if (responseObj.newContent) {
    await fetchNewContent()
  }
}

function fetchNewContent () {
  setInterval(async () => {
    const response = await fetch('http://127.0.0.1:8080/htmlcontent', {
      method: 'GET',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    const contentWindow = document.querySelector('.markdown-body')

    if (response.status === 404) {
      document.querySelector('#blur-page').style.display = 'block'
      document.querySelector('#loading-modal').style.display = 'block'
    } else {
      document.querySelector('#blur-page').style.display = 'none'
      document.querySelector('#loading-modal').style.display = 'none'
    }
    contentWindow.innerHTML = await response.text()
  }, 200)
}

let modalOpen = false

async function showModal () {
  if (modalOpen) {
    closeModal()
    return
  }

  modalOpen = true
  const response = await fetch('http://127.0.0.1:8080/history', {
    method: 'GET',
    mode: 'cors',
    headers: {
      'Content-Type': 'application/json'
    }
  })

  if (response.status === 204) {
    console.log('No current History')
  }

  try {
    const content = await response.json()
    const historyContainer = document.querySelector('#history-content')

    const startTime = document.createElement('p')
    startTime.id = 'start-time'
    startTime.innerHTML = `Content Started ${new Date(content[content.length - 1].startTime).toGMTString()}`
    historyContainer.appendChild(startTime)

    for (let i = content.length - 1; i >= 0; i--) {
      const newElement = document.createElement('div')
      const spacer = document.createElement('div')
      const commandAttempts = document.createElement('ul')
      const duration = document.createElement('div')

      spacer.className = 'history-spacer'
      newElement.className = 'history-element'
      document.className = 'history-attempts'

      newElement.innerHTML += `Started Chunk at ${new Date(content[i].startTime).toGMTString()}`

      content[i].commandAttempts.forEach(attempt => {
        const li = document.createElement('li')
        li.innerHTML = attempt
        li.className = 'history-single-command'
        commandAttempts.appendChild(li)
      })

      duration.className = 'history-duration'

      if (content[i].endTime) {
        const timeToCompleteInSeconds = Math.floor((content[i].endTime - content[i].startTime) / 1000)

        const completionTime = {
          hours: Math.floor(timeToCompleteInSeconds / 3600),
          minutes: Math.floor(timeToCompleteInSeconds / 60),
          seconds: timeToCompleteInSeconds
        }

        duration.innerHTML = `Took ${completionTime.hours} hours, ${completionTime.minutes} minutes, and ${completionTime.seconds} seconds`
      }

      newElement.appendChild(commandAttempts)
      newElement.appendChild(duration)
      historyContainer.appendChild(spacer)
      historyContainer.appendChild(newElement)
    }

    document.querySelector('#history-modal').style.display = 'block'
  } catch (error) {
    console.error(error)
  }
}

function closeModal () {
  modalOpen = false
  document.querySelector('#history-modal').style.display = 'none'
  document.querySelector('#history-content').innerHTML = ''
}

window.onload = async () => {
  fetchNewContent()
}
